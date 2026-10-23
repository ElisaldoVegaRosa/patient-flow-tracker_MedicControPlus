"""Responsibility, recommendation and accepted handoffs without fabricated clinical work."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4
import json
import sqlite3
import pytest
from test_accounts import accounts, create, query, status  # noqa: F401
from test_staffing import staff, shift, duty, transition, write, grant  # noqa: F401
from app.care import migrate_care


@pytest.fixture
def team(staff):
    client, login, admin, doctor, nurse, auth = staff
    doctor2 = create(client, admin, 'medico.dos').json()
    nurse2 = create(client, admin, 'enfermera.dos', 'NURSE').json()
    turn = shift(client, auth, doctor).json()
    for person, area in ((doctor, 2), (doctor2, 2), (nurse, 2), (nurse2, 3)):
        assert duty(client, auth, turn, person, area).status_code == 201
    active = transition(client, auth, 'shifts', turn, 'ACTIVE')
    assert active.status_code == 200
    duties = client.get('/staff/planning', headers=auth).json()['assignments']
    for item in duties:
        assert transition(client, auth, 'assignments', item, 'AVAILABLE').status_code == 200
    return client, login, admin, doctor, doctor2, nurse, nurse2, auth


def episode(team, priority=3, triage=True):
    client, login, *_, auth = team
    value = client.post('/episodes', headers=login('recepcion', 'demo123'), json={'provisional': True}).json()
    if triage:
        response = client.post(f"/episodes/{value['id']}/triage", headers={**login('enfermeria', 'demo123'), 'If-Match': value['triage_version']},
            json={'priority': priority, 'location': 'Sala de espera', 'assigned_to': 'Texto previo ficticio'})
        assert response.status_code == 200, response.text
        value = response.json()
    return client.get(f"/care/episodes/{value['id']}", headers=auth).json()


def apply(team, current, action, data=None, auth=None, key=None):
    client, *_, coordinator = team
    return write(client, auth or coordinator, f"/care/episodes/{current['episode_id']}/{action}", data or {}, current, key=key)


def refresh(team, current, auth=None):
    return team[0].get(f"/care/episodes/{current['episode_id']}", headers=auth or team[-1]).json()


def routed(team, priority=3):
    value = episode(team, priority)
    response = apply(team, value, 'area', {'area_id': 2})
    assert response.status_code == 200, response.text
    return response.json()


def test_legacy_and_ready_time_are_preserved_without_inferred_owners(team):
    client, login, *_, auth = team
    value = episode(team)
    assert value['area_id'] is None and value['ready_at']
    assert all(slot['user_id'] is None for slot in value['slots'])
    old_time = value['ready_at']
    clinical = client.get(f"/episodes/{value['episode_id']}", headers=auth).json()
    repeated = client.post(f"/episodes/{value['episode_id']}/triage", headers={**login('enfermeria', 'demo123'), 'If-Match': clinical['triage_version']},
        json={'priority': 1, 'location': 'Consultorio 1', 'assigned_to': 'Otro texto previo'})
    assert repeated.status_code == 200
    value = refresh(team, value)
    assert value['ready_at'] == old_time and value['area_id'] is None
    assert value['legacy_assigned_to'] == 'Otro texto previo'
    assert value['open_alert_count'] == query("SELECT COUNT(*) FROM alerts WHERE episode_id=? AND status!='RESOLVED'", (value['episode_id'],))[0][0]
    value = apply(team, value, 'area', {'area_id': 2}).json()
    assert value['location'] == 'Consultorio 1'
    assert value['slots'][0]['candidates'][0]['id'] == team[3]['id']
    untriaged = episode(team, triage=False)
    assert apply(team, untriaged, 'area', {'area_id': 2}).status_code == 409


def test_assignment_self_take_and_start_are_independent_of_clinical_events(team):
    client, login, _, doctor, doctor2, nurse, _, auth = team
    value = routed(team)
    before = [tuple(row) for row in query('SELECT * FROM events')]
    assert apply(team, value, 'DOCTOR/assign', {'user_id': doctor2['id']}, login(doctor['username'])).status_code == 200  # coordinator
    value = refresh(team, value)
    assert value['slots'][0]['started_at'] is None
    assert apply(team, value, 'DOCTOR/start', auth=auth).status_code == 403
    started = apply(team, value, 'DOCTOR/start', auth=login(doctor2['username']))
    assert started.status_code == 200 and started.json()['slots'][0]['started_at']
    value = started.json()
    assert apply(team, value, 'DOCTOR/start', auth=login(doctor2['username'])).status_code == 409
    assert apply(team, value, 'NURSE/assign', {'user_id': nurse['id']}, login(doctor2['username'])).status_code == 403
    assert apply(team, value, 'NURSE/assign', {'user_id': nurse['id']}, login(nurse['username'])).status_code == 200
    assert before == [tuple(row) for row in query('SELECT * FROM events')]
    assert client.get('/care/queue?mine=true', headers=login(doctor2['username'])).json()['episodes'][0]['episode_id'] == value['episode_id']


def test_observation_keeps_doctor_and_nurse_until_recipient_accepts(team):
    client, login, _, doctor, _, nurse, nurse2, auth = team
    value = routed(team)
    value = apply(team, value, 'DOCTOR/assign', {'user_id': doctor['id']}).json()
    value = apply(team, value, 'NURSE/assign', {'user_id': nurse['id']}).json()
    value = apply(team, value, 'NURSE/start', auth=login(nurse['username'])).json()
    first = value['slots'][1]['first_started_at']
    value = apply(team, value, 'area', {'area_id': 3}).json()
    assert value['slots'][0]['owner']['id'] == doctor['id'] and value['slots'][0]['covered']
    assert value['slots'][1]['owner']['id'] == nurse['id'] and not value['slots'][1]['covered']
    proposed = apply(team, value, 'NURSE/handoff', {'user_id': nurse2['id']})
    assert proposed.status_code == 200
    value = proposed.json()
    assert value['slots'][1]['user_id'] == nurse['id'] and value['slots'][1]['pending_user_id'] == nurse2['id']
    assert apply(team, value, 'NURSE/accept').status_code == 403
    accepted = apply(team, value, 'NURSE/accept', auth=login(nurse2['username']))
    assert accepted.status_code == 200
    value = accepted.json()
    assert value['slots'][1]['user_id'] == nurse2['id'] and value['slots'][1]['pending_user_id'] is None
    assert value['slots'][1]['started_at'] is None and value['slots'][1]['first_started_at'] == first
    old_mine = client.get('/care/queue?mine=true', headers=login(nurse['username'])).json()['episodes']
    assert not old_mine
    audit = client.get(f"/care/episodes/{value['episode_id']}", headers=auth).json()['changes']
    assert audit[0]['action'] == 'ACCEPT' and json.loads(audit[0]['new_value'])['version'] == value['version']


def test_competing_initial_assignments_versions_and_replay_are_atomic(team):
    client, _, _, doctor, doctor2, *_, auth = team
    value = routed(team)
    barrier = Barrier(2)
    def run(target):
        barrier.wait()
        return apply(team, value, 'DOCTOR/assign', {'user_id': target['id']})
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, (doctor, doctor2)))
    assert sorted(result.status_code for result in results) == [200, 409]
    value = refresh(team, value)
    key = str(uuid4())
    area = apply(team, value, 'area', {'area_id': 3}, key=key)
    assert area.status_code == 200
    assert apply(team, value, 'area', {'area_id': 3}, key=key).json() == area.json()
    receipt = client.get('/write-result', headers={**auth, 'Idempotency-Key': key}).json()
    assert receipt['result'] == area.json()
    assert query("SELECT episode_id FROM write_receipts WHERE operation_key=?", (key,))[0][0] is None
    assert write(client, auth, f"/care/episodes/{value['episode_id']}/area", {'area_id': 2}).status_code == 428


def test_recommendation_uses_priority_own_tasks_then_total_and_rotation(team):
    client, login, _, doctor, doctor2, *_, auth = team
    high = routed(team, 1)
    apply(team, high, 'DOCTOR/assign', {'user_id': doctor['id']})
    low = routed(team, 3)
    apply(team, low, 'DOCTOR/assign', {'user_id': doctor2['id']})
    waiting = routed(team)
    assert waiting['slots'][0]['candidates'][0]['id'] == doctor2['id']
    low2 = routed(team)
    assert apply(team, low2, 'DOCTOR/assign', {'user_id': doctor2['id']}).status_code == 200
    # Nurse queue has no actual owners: LAB/MEDICAL tasks cannot burden nurses.
    clinical = client.get(f"/episodes/{low2['episode_id']}", headers=auth).json()
    for service in ('LAB', 'MEDICAL'):
        assert client.post(f"/episodes/{clinical['id']}/tasks", headers=auth, json={'title': 'Pendiente ficticio', 'service': service}).status_code == 201
    low2 = refresh(team, low2)
    assert low2['slots'][1]['candidates'][0]['pending_tasks'] == 0
    queue = client.get('/care/queue', headers=auth).json()['episodes']
    assert queue[0]['priority'] == 1
    assert next(item for item in queue if item['episode_id'] == low2['episode_id'])['lab_pending'] == 1
    # Any candidate load change invalidates a previously consulted recommendation.
    assert apply(team, waiting, 'DOCTOR/assign', {'user_id': doctor2['id']}).status_code == 409


def test_lost_availability_closed_episode_and_revoked_permission_do_not_lose_owner(team):
    client, login, admin, doctor, doctor2, nurse, _, auth = team
    value = routed(team)
    value = apply(team, value, 'DOCTOR/assign', {'user_id': doctor2['id']}).json()
    current = client.get('/staff/planning', headers=auth).json()['assignments']
    duty2 = next(item for item in current if item['user_id'] == doctor2['id'])
    assert transition(client, auth, 'assignments', duty2, 'UNAVAILABLE').status_code == 200
    assert apply(team, value, 'DOCTOR/start', auth=login(doctor2['username'])).status_code == 409
    value = refresh(team, value)
    assert value['slots'][0]['user_id'] == doctor2['id'] and value['slots'][0]['needs_coverage']
    assert apply(team, value, 'DOCTOR/override', {'user_id': doctor['id']}, login(nurse['username'])).status_code == 403
    value = apply(team, value, 'DOCTOR/override', {'user_id': doctor['id']}).json()
    account = next(item for item in client.get('/accounts', headers=admin).json()['accounts'] if item['id'] == doctor['id'])
    assert grant(client, admin, account, False).status_code == 200
    assert apply(team, value, 'NURSE/assign', {'user_id': nurse['id']}, auth).status_code == 401
    new = login(doctor['username'])
    assert apply(team, value, 'NURSE/assign', {'user_id': nurse['id']}, new).status_code == 403
    detail = client.get(f"/episodes/{value['episode_id']}", headers=new).json()
    close = client.post(f"/episodes/{detail['id']}/discharge", headers={**new,'If-Match':detail['clinical_version']}, json={'note':'Cierre ficticio'})
    assert close.status_code == 200
    assert not client.get('/care/queue', headers=new).json()['episodes']
    archived = refresh(team, value, new)
    assert archived['slots'][0]['user_id'] == doctor['id']
    assert apply(team, archived, 'DOCTOR/start', auth=new).status_code == 409


def test_admin_forbidden_and_payload_target_validation(team):
    client, login, admin, doctor, doctor2, nurse, _, auth = team
    value = routed(team)
    assert client.get('/care/queue', headers=admin).status_code == 403
    assert client.get(f"/care/episodes/{value['episode_id']}", headers=admin).status_code == 403
    assert apply(team, value, 'DOCTOR/assign', {'user_id': nurse['id']}).status_code == 409
    assert apply(team, value, 'DOCTOR/assign', {'user_id': doctor2['id']}, login(nurse['username'])).status_code == 403
    assert apply(team, value, 'DOCTOR/assign', {'user_id': str(doctor['id'])}).status_code == 422
    assert apply(team, value, 'DOCTOR/assign', {'user_id': doctor['id'], 'started_at':'inventado'}).status_code == 422


def test_migration_rolls_back_and_never_infers_assignees(tmp_path):
    from app.database import get_connection, initialize_database
    path = tmp_path/'old.db'
    initialize_database(get_connection(path), {}, lambda _:('salt','hash'), lambda:'2026-10-21T00:00:00Z')
    c = get_connection(path)
    for table in ('care_slots', 'care_changes', 'care_episodes', 'care_schema'):
        c.execute(f'DROP TABLE {table}')
    c.execute("INSERT INTO patients(name,identity_status) VALUES ('Demo','PROVISIONAL')")
    c.execute("INSERT INTO episodes(patient_id,qr_token,status,priority,location,assigned_to,started_at) VALUES (1,'demo','ACTIVE',3,'Observacion','medico.demo1','2026-10-20T12:00:00Z')")
    c.execute("INSERT INTO events(episode_id,type,username,created_at) VALUES (1,'TRIAGE','demo','2026-10-20T13:00:00Z')")
    c.commit()
    c.set_authorizer(lambda action, first, second, db, source: sqlite3.SQLITE_DENY if action == sqlite3.SQLITE_CREATE_TABLE and first == 'care_slots' else sqlite3.SQLITE_OK)
    with pytest.raises(sqlite3.DatabaseError): migrate_care(c)
    c.set_authorizer(None)
    assert not c.execute("SELECT 1 FROM sqlite_schema WHERE name='care_schema'").fetchone()
    migrate_care(c)
    migrate_care(c)
    assert c.execute('SELECT area_id,ready_at FROM care_episodes').fetchone()['area_id'] is None
    assert all(row['user_id'] is None for row in c.execute('SELECT * FROM care_slots'))
    assert c.execute('SELECT COUNT(*) FROM care_slots').fetchone()[0] == 2
    assert c.execute('SELECT historical FROM care_episodes').fetchone()[0] == 1
    c.close()


def test_receiver_unavailability_decline_and_fresh_acceptance(team):
    client, login, _, _, _, nurse, nurse2, auth = team
    value = routed(team)
    value = apply(team, value, 'NURSE/assign', {'user_id': nurse['id']}).json()
    value = apply(team, value, 'area', {'area_id': 3}).json()
    value = apply(team, value, 'NURSE/handoff', {'user_id': nurse2['id']}).json()
    mine = client.get('/care/queue?mine=true', headers=login(nurse2['username'])).json()['episodes']
    assert mine[0]['slots'][1]['user_id'] == nurse['id']
    item = next(row for row in client.get('/staff/planning', headers=auth).json()['assignments'] if row['user_id'] == nurse2['id'])
    unavailable = transition(client, auth, 'assignments', item, 'UNAVAILABLE').json()
    assert apply(team, value, 'NURSE/accept', auth=login(nurse2['username'])).status_code == 409
    value = refresh(team, value)
    assert apply(team, value, 'NURSE/accept', auth=login(nurse2['username'])).status_code == 409
    assert value['slots'][1]['user_id'] == nurse['id']
    value = apply(team, value, 'NURSE/cancel-handoff', auth=login(nurse2['username'])).json()
    assert value['slots'][1]['user_id'] == nurse['id'] and value['slots'][1]['pending_user_id'] is None
    assert transition(client, auth, 'assignments', unavailable, 'AVAILABLE').status_code == 200
    value = refresh(team, value)
    value = apply(team, value, 'NURSE/handoff', {'user_id': nurse2['id']}).json()
    assert apply(team, value, 'NURSE/accept', auth=login(nurse2['username'])).status_code == 200


def test_equal_priority_compares_own_tasks_before_total_and_rotates_ties(team):
    client, _, _, doctor, doctor2, *_, auth = team
    one = routed(team)
    one = apply(team, one, 'DOCTOR/assign', {'user_id': doctor['id']}).json()
    two = routed(team)
    apply(team, two, 'DOCTOR/assign', {'user_id': doctor2['id']})
    three = routed(team)
    apply(team, three, 'DOCTOR/assign', {'user_id': doctor2['id']})
    for service in ('LAB','NURSING'):
        assert client.post(f"/episodes/{one['episode_id']}/tasks", headers=auth, json={'title':'Dependencia ficticia','service':service}).status_code == 201
    waiting = routed(team)
    assert waiting['slots'][0]['candidates'][0]['id'] == doctor['id']  # fewer total, non-medical tasks ignored
    assert client.post(f"/episodes/{one['episode_id']}/tasks", headers=auth, json={'title':'Trabajo medico ficticio','service':'MEDICAL'}).status_code == 201
    waiting = refresh(team, waiting)
    assert waiting['slots'][0]['candidates'][0]['id'] == doctor2['id']  # fewer own tasks despite larger total
    for value in (one, two, three):
        detail = client.get(f"/episodes/{value['episode_id']}", headers=auth).json()
        assert client.post(f"/episodes/{value['episode_id']}/discharge", headers={**auth,'If-Match':detail['clinical_version']},json={'note':'Fin ficticio de carga'}).status_code == 200
    waiting = refresh(team, waiting)
    candidates = waiting['slots'][0]['candidates']
    assert all(row['total'] == row['pending_tasks'] == row['high_priority'] == 0 for row in candidates)
    assert candidates[0]['id'] == doctor['id']  # older confirmed assignment wins the tie


def test_close_reopen_and_priority_aba_invalidate_old_allocation_but_qr_does_not(team):
    client, login, _, doctor, *_, auth = team
    value = routed(team)
    clinical = client.get(f"/episodes/{value['episode_id']}", headers=auth).json()
    assert client.get(f"/scan/{clinical['qr_token']}", headers=auth).status_code == 200
    assert refresh(team, value)['version'] == value['version']
    close = client.post(f"/episodes/{value['episode_id']}/discharge", headers={**auth,'If-Match':clinical['clinical_version']}, json={'note':'Cierre ficticio de concurrencia'})
    assert close.status_code == 200
    closed = close.json()
    reopen = client.post(f"/episodes/{value['episode_id']}/reopen", headers={**auth,'If-Match':closed['clinical_version'],'Idempotency-Key':str(uuid4())},json={'reason':'Reapertura ficticia de concurrencia'})
    assert reopen.status_code == 200, reopen.text
    assert apply(team, value, 'DOCTOR/assign', {'user_id':doctor['id']}).status_code == 409
    value = refresh(team, value)
    for priority in (1, 3):
        clinical = client.get(f"/episodes/{value['episode_id']}", headers=auth).json()
        updated = client.post(f"/episodes/{value['episode_id']}/triage", headers={**login('enfermeria','demo123'),'If-Match':clinical['triage_version']},
            json={'priority':priority,'location':clinical['location'],'assigned_to':clinical['assigned_to']})
        assert updated.status_code == 200
    assert apply(team, value, 'DOCTOR/assign', {'user_id':doctor['id']}).status_code == 409
    assert apply(team, refresh(team, value), 'DOCTOR/assign', {'user_id':doctor['id']}).status_code == 200
