"""Production reads/legacy writes against disposable migrated and legacy databases."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app import main, laboratory_followups
from app.laboratory_integration import enrich_episode, guard_legacy_write
from app.laboratory_schema import migrate_laboratory_schema
from test_laboratory_samples import accounts, api, create, query, state  # noqa: F401
from test_laboratory_schema import legacy, add_order, add_analysis, followup  # noqa: F401


@pytest.mark.parametrize('operation', ['complete', 'result'])
def test_production_legacy_writes_cannot_bypass_structured_laboratory(api, operation):
    assert create(api).status_code == 201
    item = state(api)['orders'][0]
    clinical = api.original.get(f"/episodes/{api.episode['id']}", headers=api.doctor).json()
    before = query('SELECT status,result FROM tasks WHERE id=?', (item['task_id'],))
    task = next(row for row in clinical['tasks'] if row['id'] == item['task_id'])
    body = {'result': 'Resultado ficticio sin muestras'} if operation == 'complete' else {
        'action': 'CORRECT', 'value': 'Correccion ficticia', 'reason': 'Intento de prueba'}
    response = api.original.patch(f"/tasks/{item['task_id']}/{operation}", headers={
        **api.lab, 'If-Match': task['version'], 'Idempotency-Key': str(uuid4())}, json=body)
    assert response.status_code == 409, response.text
    assert response.json()['detail']['code'] == 'structured_laboratory_required'
    assert query('SELECT status,result FROM tasks WHERE id=?', (item['task_id'],)) == before
    assert query('SELECT status FROM episodes WHERE id=?', (api.episode['id'],))[0]['status'] == 'ACTIVE'


def test_original_detail_and_write_receipts_return_current_laboratory_without_duplicate_write(api):
    key = str(uuid4())
    created = create(api, key=key)
    assert created.status_code == 201
    path = f"/episodes/{api.episode['id']}"
    first = api.original.get(path, headers=api.doctor).json()
    assert first['laboratory']['orders'] == state(api)['orders']
    assert first['lab_followups'] == [] and first['laboratory_version']
    connection = main.get_connection()
    try:
        connection.execute('UPDATE lab_orders SET revision=revision+1')
        connection.commit()
    finally:
        connection.close()
    current = api.original.get(path, headers=api.doctor).json()
    assert current['laboratory_version'] != first['laboratory_version']
    assert current['clinical_version'] != first['clinical_version']
    receipt = api.original.get('/write-result', headers={**api.doctor, 'Idempotency-Key': key})
    assert receipt.status_code == 200, receipt.text
    assert receipt.json() == {'status': 'confirmed', 'result': current}
    assert len(query('SELECT task_id FROM lab_orders')) == 1
    assert query('SELECT summary FROM write_receipts WHERE operation_key=?', (key,))[0]['summary'] is None


def test_legacy_order_keeps_completion_correction_and_discharge_without_inventing_samples(api):
    episode_id = api.episode['id']
    path = f'/episodes/{episode_id}'
    created = api.original.post(path + '/tasks', headers=api.doctor,
        json={'title': 'Orden anterior ficticia', 'service': 'LAB'})
    assert created.status_code == 201
    task = created.json()['tasks'][0]
    assert created.json()['laboratory']['legacy_order_ids'] == [task['id']]
    completed = api.original.patch(f"/tasks/{task['id']}/complete", headers={**api.lab, 'If-Match': task['version']},
        json={'result': 'Resultado anterior ficticio'})
    assert completed.status_code == 200, completed.text
    task = completed.json()['tasks'][0]
    corrected = api.original.patch(f"/tasks/{task['id']}/result", headers={**api.lab, 'If-Match': task['version'],
        'Idempotency-Key': str(uuid4())}, json={'action': 'CORRECT', 'value': 'Resultado anterior rectificado', 'reason': 'Prueba de compatibilidad'})
    assert corrected.status_code == 200, corrected.text
    closed = api.original.post(path + '/discharge', headers={**api.doctor, 'If-Match': corrected.json()['clinical_version']},
        json={'note': 'Cierre ficticio del circuito anterior'})
    assert closed.status_code == 200 and closed.json()['status'] == 'CLOSED', closed.text
    assert closed.json()['laboratory']['orders'] == []
    assert query('SELECT id FROM lab_specimens') == [] and query('SELECT id FROM lab_result_reviews') == []


def test_database_without_lab_retains_original_payload_and_guards(legacy):
    before = main.episode_detail(legacy, 1)
    assert 'laboratory' not in before and 'laboratory_version' not in before
    assert enrich_episode(legacy, before.copy()) == before
    for kind in ['task', 'task_result', 'discharge']:
        guard_legacy_write(legacy, kind, 1)
    migrate_laboratory_schema(legacy)
    empty = main.episode_detail(legacy, 1)
    assert empty['clinical_version'] == before['clinical_version']
    assert empty['laboratory']['legacy_order_ids'] == [1]


@pytest.mark.parametrize('damage', ['missing_table', 'missing_marker', 'empty_version', 'unsupported_version'])
def test_partial_or_incompatible_lab_fails_closed_without_mutation(legacy, damage):
    migrate_laboratory_schema(legacy)
    if damage == 'missing_table':
        legacy.execute('DROP TABLE lab_changes')
    elif damage == 'missing_marker':
        legacy.execute('DROP TABLE lab_schema')
    elif damage == 'empty_version':
        legacy.execute('DELETE FROM lab_schema')
    else:
        legacy.execute('DROP TABLE lab_schema')
        legacy.execute('CREATE TABLE lab_schema(version INTEGER PRIMARY KEY)')
        legacy.execute('INSERT INTO lab_schema VALUES (999)')
    legacy.commit()
    with pytest.raises(HTTPException) as error:
        guard_legacy_write(legacy, 'task', 1)
    assert error.value.status_code == 409
    assert legacy.execute('SELECT status FROM episodes WHERE id=1').fetchone()[0] == 'ACTIVE'


def test_followup_clock_does_not_change_clinical_version_but_persisted_revision_does(legacy, monkeypatch):
    migrate_laboratory_schema(legacy)
    add_order(legacy, 2, 2)
    analysis = add_analysis(legacy, task=2)
    case = followup(legacy)
    legacy.execute('INSERT INTO lab_followup_scope(followup_id,episode_id,order_task_id,analysis_id) VALUES (?,2,2,?)', (case, analysis))
    due = datetime.now(timezone.utc) + timedelta(hours=1)
    legacy.execute('UPDATE lab_followups SET review_due_at=?', (due.isoformat(),))
    legacy.commit()
    first = main.episode_detail(legacy, 2)
    assert first['lab_followups'][0]['overdue'] is False

    class Later(datetime):
        @classmethod
        def now(cls, tz=None):
            return due + timedelta(hours=1)

    monkeypatch.setattr(laboratory_followups, 'datetime', Later)
    later = main.episode_detail(legacy, 2)
    assert later['lab_followups'][0]['overdue'] is True
    assert later['clinical_version'] == first['clinical_version']
    legacy.execute('UPDATE lab_followups SET revision=revision+1')
    assert main.episode_detail(legacy, 2)['clinical_version'] != first['clinical_version']
