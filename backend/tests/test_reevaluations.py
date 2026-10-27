"""Individual deadlines, independent actions, accepted handoffs and discharge integrity."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from uuid import uuid4
import sqlite3

import pytest
from test_care import accounts, staff, team, routed, apply, refresh  # noqa: F401
from test_accounts import query
from app.reevaluations import migrate_reevaluations


def future(minutes=30):
    return (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat()


def post(client, auth, path, body, version=None, key=None):
    return client.post(path, headers={**auth, 'Idempotency-Key': key or str(uuid4()),
                       **({'If-Match': version} if version else {})}, json={'reason': 'Prueba ficticia de seguimiento', **body})


@pytest.fixture
def assigned(team):
    value = routed(team)
    value = apply(team, value, 'DOCTOR/assign', {'user_id': team[3]['id']}).json()
    value = apply(team, value, 'NURSE/assign', {'user_id': team[5]['id']}).json()
    return team, value


def clinical(team, value):
    return team[0].get(f"/episodes/{value['episode_id']}", headers=team[-1]).json()


def schedule(team, value, **changes):
    current = clinical(team, value)
    return post(team[0], team[-1], f"/episodes/{current['id']}/reevaluations", {
        'title': 'Seguimiento ficticio', 'medical_instruction': 'Revisar evolucion ficticia',
        'nursing_instruction': 'Registrar comprobacion ficticia', 'due_at': future(), **changes}, current['clinical_version'])


def test_independent_actions_versions_audit_and_pending_discharge(assigned):
    team, value = assigned
    client, login, _, doctor, _, nurse, _, auth = team
    created = schedule(team, value)
    assert created.status_code == 201, created.text
    result = created.json()
    actions = result['reevaluations']
    medical = next(item for item in actions if item['service'] == 'MEDICAL')
    nursing = next(item for item in actions if item['service'] == 'NURSING')
    assert len(actions) == 2 and medical['group_id'] == nursing['group_id']
    assert medical['owner_username'] == doctor['username'] and nursing['owner_username'] == nurse['username']
    assert len(result['reevaluation_changes']) == 2
    assert client.get('/care/queue', headers=auth).json()['episodes'][0]['reevaluations']
    before = query('SELECT COUNT(*) FROM reevaluation_changes')[0][0]
    client.get(f"/episodes/{result['id']}", headers=auth)
    assert query('SELECT COUNT(*) FROM reevaluation_changes')[0][0] == before
    discharge = client.post(f"/episodes/{result['id']}/discharge", headers={**auth, 'If-Match': result['clinical_version']}, json={'note': 'Alta ficticia'})
    assert discharge.status_code == 409 and 'pendientes' in discharge.text
    rescheduled = post(client, auth, f"/reevaluations/{medical['id']}/reschedule", {'due_at': future(40)}, medical['version'])
    assert rescheduled.status_code == 200
    assert next(row for row in rescheduled.json()['reevaluations'] if row['id'] == nursing['id'])['due_at'] == nursing['due_at']
    generic = client.patch(f"/tasks/{nursing['id']}/complete", headers={**login(nurse['username']),
        'If-Match': next(t['version'] for t in result['tasks'] if t['id'] == nursing['id'])}, json={'result': 'Prueba ficticia'})
    assert generic.status_code == 409 and 'Reevaluaciones' in generic.text
    done = post(client, login(nurse['username']), f"/reevaluations/{nursing['id']}/complete", {'completion_note': 'Comprobacion ficticia realizada'}, nursing['version'])
    assert done.status_code == 200
    medical = next(item for item in done.json()['reevaluations'] if item['id'] == medical['id'])
    assert medical['status'] == 'PENDING'
    assert post(client, auth, f"/reevaluations/{medical['id']}/cancel", {}, medical['version']).status_code == 200
    result = clinical(team, value)
    assert {r['action'] for r in result['reevaluation_changes']} == {'CREATE', 'COMPLETE', 'CANCEL', 'RESCHEDULE'}
    assert post(client, auth, f"/reevaluations/{medical['id']}/complete", {'completion_note': 'No duplicar'}, medical['version']).status_code == 409
    assert client.post(f"/episodes/{result['id']}/discharge", headers={**auth, 'If-Match': result['clinical_version']}, json={'note': 'Alta ficticia final'}).status_code == 200


def test_schedule_validation_receipts_and_reschedule_aba(assigned):
    team, value = assigned
    client, login, _, _, doctor2, nurse, _, auth = team
    current = clinical(team, value)
    body = {'title': 'Plan ficticio', 'medical_instruction': 'Accion ficticia', 'due_at': future()}
    path = f"/episodes/{current['id']}/reevaluations"
    assert post(client, auth, path, body).status_code == 428
    for changes in ({'due_at': '2026-01-01T10:00:00Z'}, {'due_at': '2026-10-26T10:00:00'},
                    {'medical_instruction': None}, {'reason': ' '}, {'unexpected': True}):
        assert post(client, auth, path, {**body, **changes}, current['clinical_version']).status_code == 422
    for headers in (login(nurse['username']), login('laboratorio', 'demo123'), login('supervisor', 'demo123')):
        assert post(client, headers, path, body, current['clinical_version']).status_code == 403
    key = str(uuid4())
    first = post(client, auth, path, body, current['clinical_version'], key)
    assert first.status_code == 201
    assert post(client, auth, path, body, current['clinical_version'], key).status_code == 201
    assert query('SELECT COUNT(*) FROM reevaluation_actions')[0][0] == 1
    assert post(client, auth, path, body, current['clinical_version']).status_code == 409
    item = first.json()['reevaluations'][0]
    assert post(client, login(doctor2['username']), f"/reevaluations/{item['id']}/complete", {'completion_note': 'Sin ser responsable'}, item['version']).status_code == 403
    second = post(client, auth, f"/reevaluations/{item['id']}/reschedule", {'due_at': future(45)}, item['version'])
    assert second.status_code == 200
    changed = second.json()['reevaluations'][0]
    third = post(client, auth, f"/reevaluations/{item['id']}/reschedule", {'due_at': item['due_at']}, changed['version'])
    assert third.status_code == 200 and third.json()['reevaluations'][0]['version'] != item['version']
    assert post(client, auth, f"/reevaluations/{item['id']}/cancel", {}, item['version']).status_code == 409


def test_only_accepted_owner_can_complete_without_overtime_block(assigned):
    team, value = assigned
    client, login, _, _, _, nurse, nurse2, auth = team
    # Two independent nursing actions let us exercise both sides of the accepted handoff.
    schedule(team, value, medical_instruction=None)
    result = schedule(team, value, medical_instruction=None).json()
    value = refresh(team, value)
    value = apply(team, value, 'area', {'area_id': 3}).json()
    value = apply(team, value, 'NURSE/handoff', {'user_id': nurse2['id']}).json()
    actions = clinical(team, value)['reevaluations']
    old, pending = actions
    assert post(client, login(nurse2['username']), f"/reevaluations/{old['id']}/complete", {'completion_note': 'Aun sin relevo'}, old['version']).status_code == 403
    # The old owner retains responsibility despite area/coverage changes.
    assert post(client, login(nurse['username']), f"/reevaluations/{old['id']}/complete", {'completion_note': 'Accion antes del relevo'}, old['version']).status_code == 200
    value = refresh(team, value)
    assert apply(team, value, 'NURSE/accept', auth=login(nurse2['username'])).status_code == 200
    assert post(client, login(nurse['username']), f"/reevaluations/{pending['id']}/complete", {'completion_note': 'Ya no responsable'}, pending['version']).status_code == 403
    assert post(client, login(nurse2['username']), f"/reevaluations/{pending['id']}/complete", {'completion_note': 'Pantalla antigua'}, pending['version']).status_code == 409
    fresh = next(item for item in clinical(team, value)['reevaluations'] if item['id'] == pending['id'])
    assert post(client, login(nurse2['username']), f"/reevaluations/{fresh['id']}/complete", {'completion_note': 'Accion tras aceptar relevo'}, fresh['version']).status_code == 200


def test_pending_gate_and_final_completion_are_atomic(assigned):
    team, value = assigned
    client, _, _, _, _, _, _, auth = team
    current = schedule(team, value, nursing_instruction=None).json()
    item = current['reevaluations'][0]
    barrier = Barrier(2)
    def run(complete):
        barrier.wait()
        if complete:
            return post(client, auth, f"/reevaluations/{item['id']}/complete", {'completion_note': 'Finalizacion ficticia'}, item['version']).status_code
        return client.post(f"/episodes/{current['id']}/discharge", headers={**auth, 'If-Match': current['clinical_version']}, json={'note': 'Alta concurrente ficticia'}).status_code
    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(run, [True, False]))
    assert results == [200, 409]
    assert clinical(team, value)['status'] == 'ACTIVE'


def test_migration_is_additive_repeatable_and_does_not_infer_deadlines(accounts):
    from app import main
    connection = main.get_connection()
    names = ['tasks', 'events', 'patients', 'episodes', 'care_slots']
    before = {name: [tuple(row) for row in connection.execute(f'SELECT * FROM {name}')] for name in names}
    for name in ('reevaluation_changes', 'reevaluation_actions', 'reevaluation_groups'):
        connection.execute(f'DROP TABLE {name}')
    connection.commit()
    connection.set_authorizer(lambda action, first, second, db, source: sqlite3.SQLITE_DENY
                             if action == sqlite3.SQLITE_CREATE_TABLE and first == 'reevaluation_actions' else sqlite3.SQLITE_OK)
    with pytest.raises(sqlite3.DatabaseError):
        migrate_reevaluations(connection)
    connection.set_authorizer(None)
    assert not connection.execute("SELECT 1 FROM sqlite_schema WHERE name='reevaluation_groups'").fetchone()
    migrate_reevaluations(connection)
    migrate_reevaluations(connection)
    assert before == {name: [tuple(row) for row in connection.execute(f'SELECT * FROM {name}')] for name in names}
    assert connection.execute('SELECT COUNT(*) FROM reevaluation_groups').fetchone()[0] == 0
    assert connection.execute('PRAGMA foreign_key_check').fetchone() is None
    connection.close()


def test_individual_deadline_does_not_use_generic_sixty_minute_rule(assigned):
    team, value = assigned
    current = schedule(team, value, nursing_instruction=None, due_at=future(180)).json()
    identifier = current['reevaluations'][0]['id']
    old = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    query('UPDATE tasks SET created_at=? WHERE id=?', (old, identifier))
    from app import main
    connection = main.get_connection()
    main.evaluate_time_rules(connection)
    connection.commit()
    assert not connection.execute("SELECT 1 FROM alerts WHERE episode_id=? AND reason='Tarea pendiente con tiempo excedido'", (current['id'],)).fetchone()
    assert connection.execute('SELECT status FROM tasks WHERE id=?', (identifier,)).fetchone()[0] == 'PENDING'
    connection.close()
