"""The production discharge route owns LAB custody and preserves legacy receipts."""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import json
from threading import Barrier
from uuid import uuid4

import pytest

from app import laboratory_followups, main
from test_laboratory_followups import (  # noqa: F401
    accounts, api, ready, assigned, staff, team, plan, query, publish, action, order,
)


def current(api):
    response = api.original.get(f"/episodes/{api.episode['id']}", headers=api.doctor)
    assert response.status_code == 200, response.text
    return response.json()


def close(api, *, body=None, auth=None, key=None, version=None, omit_key=False):
    headers = {**(auth or api.doctor), 'If-Match': version or current(api)['clinical_version']}
    if not omit_key:
        headers['Idempotency-Key'] = key or str(uuid4())
    return api.original.post(f"/episodes/{api.episode['id']}/discharge", headers=headers,
        json=body if body is not None else {
            'note': 'Alta ficticia por la ruta habitual', 'reason': 'Prueba de alta unificada', 'followup': plan()})


def test_production_close_creates_custody_scope_and_receipt_once(assigned):
    api = assigned
    body = {'note': 'Alta ficticia unificada', 'reason': 'Motivo ficticio', 'followup': plan()}
    key = str(uuid4())
    closed = close(api, body=body, key=key)
    assert closed.status_code == 200, closed.text
    result = closed.json()
    assert result['status'] == 'CLOSED'
    case = result['lab_followups'][0]
    assert case['owner_user_id'] == api.team[3]['id']
    assert len(case['scope']) == 3 and case['pending_results'] == 3
    assert case['communication_plan'] == body['followup']['communication_plan']
    assert publish(api).status_code == 201
    assert action(api, 'review', auth=api.doctor).status_code == 200
    replay = close(api, body=body, key=key)
    assert replay.status_code == 200 and replay.json() == current(api), replay.text
    receipt = api.original.get('/write-result', headers={**api.doctor, 'Idempotency-Key': key})
    assert receipt.json()['result'] == current(api)
    assert len(query('SELECT id FROM events WHERE episode_id=? AND type=\'DISCHARGE\'', (api.episode['id'],))) == 1
    assert len(query('SELECT id FROM lab_followups')) == 1


def test_pending_close_requires_key_reason_confirmed_owner_and_explicit_future_plan(assigned):
    api = assigned
    before = current(api)
    assert close(api, omit_key=True).status_code == 428
    assert close(api, body={'note': 'Sin motivo ficticio', 'followup': plan()}).status_code == 422
    assert close(api, body={'note': 'Sin plan ficticio', 'reason': 'Motivo ficticio'}).status_code == 422
    assert close(api, auth=api.alternate).status_code == 403
    for auth in [api.lab, api.nurse, api.login('supervisor', 'demo123')]:
        assert close(api, auth=auth).status_code == 403
    invalid = plan()
    invalid['review_due_at'] = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    assert close(api, body={'reason': 'Prueba de fecha', 'followup': invalid}).status_code == 422
    assert current(api) == before and not query('SELECT id FROM lab_followups')


def test_unreviewed_reports_and_mixed_legacy_orders_still_block_production_close(assigned):
    api = assigned
    assert publish(api).status_code == 201
    blocked = close(api)
    assert blocked.status_code == 409 and 'Revisa' in blocked.text
    assert action(api, 'review', auth=api.doctor).status_code == 200
    response = api.original.post(f"/episodes/{api.episode['id']}/tasks", headers=api.doctor,
        json={'title': 'Orden anterior sin desglose', 'service': 'LAB'})
    assert response.status_code == 201
    mixed = close(api)
    assert mixed.status_code == 409 and 'heredadas' in mixed.text
    assert current(api)['status'] == 'ACTIVE' and not query('SELECT id FROM lab_followups')


def test_fully_reviewed_reports_create_custody_without_inventing_a_deadline(assigned):
    api = assigned
    for index in range(3):
        assert publish(api, index).status_code == 201
        assert action(api, 'review', index=index, auth=api.doctor).status_code == 200
    closed = close(api, body={'note': 'Alta ficticia revisada', 'reason': 'Custodia de resultados revisados'})
    assert closed.status_code == 200, closed.text
    case = closed.json()['lab_followups'][0]
    assert case['review_due_at'] is None and case['communication_plan'] is None
    assert case['pending_results'] == case['pending_reviews'] == 0


def test_changed_result_or_responsibility_invalidates_production_close_draft(assigned):
    api = assigned
    version = current(api)['clinical_version']
    assert publish(api).status_code == 201
    stale = close(api, version=version)
    assert stale.status_code == 409 and stale.json()['detail']['code'] == 'version_conflict'
    assert current(api)['status'] == 'ACTIVE' and not query('SELECT id FROM lab_followups')


def test_audit_failure_rolls_back_close_custody_scope_and_receipt(assigned, monkeypatch):
    api = assigned
    key = str(uuid4())
    body = {'note': 'Alta ficticia atomica', 'reason': 'Motivo ficticio', 'followup': plan()}
    before = current(api)

    def fail(*args, **kwargs):
        raise RuntimeError('Fallo ficticio de auditoria')

    with monkeypatch.context() as patch:
        patch.setattr(laboratory_followups, 'audit', fail)
        with pytest.raises(RuntimeError, match='Fallo ficticio de auditoria'):
            close(api, body=body, key=key)
    assert current(api) == before
    assert not query('SELECT id FROM lab_followups') and not query('SELECT followup_id FROM lab_followup_scope')
    assert not query('SELECT scope FROM write_receipts WHERE operation_key=?', (key,))
    assert close(api, body=body, key=key).status_code == 200


@pytest.mark.parametrize('same_key', [True, False])
def test_concurrent_production_closes_cannot_duplicate_custody(assigned, same_key):
    api = assigned
    barrier, key = Barrier(2), str(uuid4())
    version = current(api)['clinical_version']
    body = {'note': 'Alta ficticia concurrente', 'reason': 'Motivo ficticio', 'followup': plan()}

    def send(index):
        barrier.wait()
        return close(api, body=deepcopy(body), version=version, key=key if same_key else str(uuid4())).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        codes = sorted(pool.map(send, range(2)))
    assert codes == ([200, 200] if same_key else [200, 409])
    assert len(query('SELECT id FROM lab_followups')) == 1
    assert len(query("SELECT id FROM events WHERE episode_id=? AND type='DISCHARGE'", (api.episode['id'],))) == 1


def test_legacy_receipt_fingerprint_and_replay_remain_compatible(api):
    key, note = str(uuid4()), 'Alta ficticia del circuito anterior'
    response = close(api, key=key, body={'note': note})
    assert response.status_code == 200, response.text
    legacy_payload = {'episode_id': api.episode['id'], 'data': {'note': note}}
    fingerprint = hashlib.sha256(json.dumps(legacy_payload, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    assert query('SELECT fingerprint FROM write_receipts WHERE operation_key=?', (key,))[0]['fingerprint'] == fingerprint
    assert close(api, key=key, body={'note': note}).status_code == 200


def test_plan_cannot_be_silently_ignored_without_a_structured_order(api):
    response = close(api)
    assert response.status_code == 422 and 'no se han registrado' in response.text
    assert current(api)['status'] == 'ACTIVE' and not query('SELECT id FROM lab_followups')


def test_pending_reevaluation_still_blocks_the_unified_production_close(assigned):
    api = assigned
    clinical = current(api)
    scheduled = api.original.post(f"/episodes/{api.episode['id']}/reevaluations", headers={**api.doctor,
        'Idempotency-Key': str(uuid4()), 'If-Match': clinical['clinical_version']}, json={
        'title': 'Reevaluacion ficticia antes del alta', 'medical_instruction': 'Comprobacion ficticia',
        'due_at': (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(), 'reason': 'Prueba de alta unificada'})
    assert scheduled.status_code == 201, scheduled.text
    response = close(api)
    assert response.status_code == 409 and 'reevaluaciones pendientes' in response.text
    assert current(api)['status'] == 'ACTIVE' and not query('SELECT id FROM lab_followups')
