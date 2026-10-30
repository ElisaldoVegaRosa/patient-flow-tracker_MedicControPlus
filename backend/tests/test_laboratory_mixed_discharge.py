"""Mixed episodes require actual completion and explicit versioned legacy review."""
import json
from uuid import uuid4

import pytest
from test_laboratory_unified_discharge import (  # noqa: F401
    accounts, api, ready, assigned, staff, team, query, close, current, plan,
)


def legacy(api, completed=True):
    created = api.original.post(f"/episodes/{api.episode['id']}/tasks", headers=api.doctor,
        json={'title': 'Analitica anterior ficticia', 'service': 'LAB'})
    assert created.status_code == 201
    item = next(row for row in created.json()['tasks'] if row['service'] == 'LAB' and row['id'] in created.json()['laboratory']['legacy_order_ids'] and row['status'] == 'PENDING')
    if completed:
        done = api.original.patch(f"/tasks/{item['id']}/complete", headers={**api.lab, 'If-Match': item['version']}, json={'result': 'Resultado anterior ficticio'})
        assert done.status_code == 200
        item = next(row for row in done.json()['tasks'] if row['id'] == item['id'])
    return item


def payload(*items):
    return {'note': 'Alta mixta ficticia', 'reason': 'Revision expresa ficticia al alta', 'followup': plan(),
        'legacy_reviews': [{'task_id': item['id'], 'version': item['version']} for item in items]}


def test_mixed_close_requires_exact_legacy_review_and_records_it_once_without_converting_orders(assigned):
    api = assigned
    item = legacy(api)
    assert close(api).status_code == 409
    physical = [tuple(row) for row in query('SELECT * FROM lab_specimens')]
    body, key = payload(item), str(uuid4())
    closed = close(api, body=body, key=key)
    assert closed.status_code == 200, closed.text
    assert closed.json()['status'] == 'CLOSED' and len(closed.json()['lab_followups'][0]['scope']) == 3
    audit = query("SELECT * FROM lab_changes WHERE resource_type='LEGACY_RESULT'")
    assert len(audit) == 1 and audit[0]['actor_user_id'] == api.team[3]['id']
    snapshot = json.loads(audit[0]['new_value'])
    assert snapshot['id'] == item['id'] and snapshot['version'] == item['version'] and snapshot['result'] == item['result']
    assert snapshot['discharge_event_id']
    assert close(api, body=body, key=key).status_code == 200
    assert len(query("SELECT id FROM lab_changes WHERE resource_type='LEGACY_RESULT'")) == 1
    assert len(query('SELECT task_id FROM lab_orders')) == 1
    assert query('SELECT id FROM lab_result_reviews') == []
    assert [tuple(row) for row in query('SELECT * FROM lab_specimens')] == physical


def test_pending_old_order_cannot_be_acknowledged_or_hidden_by_followup_plan(assigned):
    api = assigned
    item = legacy(api, completed=False)
    blocked = close(api, body=payload(item))
    assert blocked.status_code == 409 and 'pendientes' in blocked.text
    assert current(api)['status'] == 'ACTIVE' and query('SELECT id FROM lab_followups') == []


def test_changed_old_report_requires_both_current_clinical_version_and_explicit_report_version(assigned):
    api = assigned
    item = legacy(api)
    clinical = current(api)['clinical_version']
    corrected = api.original.patch(f"/tasks/{item['id']}/result", headers={**api.lab, 'If-Match': item['version'], 'Idempotency-Key': str(uuid4())},
        json={'action': 'CORRECT', 'value': 'Texto anterior corregido ficticio', 'reason': 'Rectificacion ficticia'})
    assert corrected.status_code == 200
    assert close(api, body=payload(item), version=clinical).status_code == 409
    assert close(api, body=payload(item)).status_code == 409
    latest = next(row for row in corrected.json()['tasks'] if row['id'] == item['id'])
    assert close(api, body=payload(latest)).status_code == 200


def test_review_list_cannot_skip_duplicate_or_include_other_orders_and_only_owner_reviews(assigned):
    api = assigned
    first, second = legacy(api), legacy(api)
    assert close(api, body=payload(first)).status_code == 409
    duplicate = payload(first, second)
    duplicate['legacy_reviews'].append(duplicate['legacy_reviews'][0])
    assert close(api, body=duplicate).status_code == 422
    unknown = payload(first, second)
    unknown['legacy_reviews'].append({'task_id': 999999, 'version': 'inventada'})
    assert close(api, body=unknown).status_code == 409
    assert close(api, body=payload(first, second), auth=api.alternate).status_code == 403
    assert close(api, body=payload(first, second)).status_code == 200


def test_legacy_review_audit_failure_rolls_back_discharge_and_retry_is_safe(assigned, monkeypatch):
    api = assigned
    item = legacy(api)
    body, key = payload(item), str(uuid4())
    import app.laboratory_discharge as discharge
    original_json = discharge.json.dumps
    def fail_snapshot(value, **options):
        if isinstance(value, dict) and 'discharge_event_id' in value:
            raise RuntimeError('Fallo ficticio de auditoria')
        return original_json(value, **options)
    with monkeypatch.context() as patch:
        patch.setattr(discharge.json, 'dumps', fail_snapshot)
        with pytest.raises(RuntimeError, match='Fallo ficticio de auditoria'):
            close(api, body=body, key=key)
    assert current(api)['status'] == 'ACTIVE'
    assert query('SELECT id FROM lab_followups') == []
    assert query("SELECT id FROM lab_changes WHERE resource_type='LEGACY_RESULT'") == []
    assert close(api, body=body, key=key).status_code == 200
