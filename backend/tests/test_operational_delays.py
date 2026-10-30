"""Operational projections use real schema, deterministic time and no live demo."""
from datetime import datetime

import pytest
from fastapi import HTTPException

from app import database, main
from app.laboratory_schema import migrate_laboratory_schema
from app.operational_delays import minutes, read
from test_accounts import accounts, create, query  # noqa: F401
from test_staffing import grant

NOW = '2026-10-29T13:00:00+00:00'


@pytest.fixture
def connection(tmp_path):
    path = tmp_path / 'delays.db'
    database.initialize_database(database.get_connection(path), {}, lambda _: ('unused', 'unused'), lambda: NOW)
    c = database.get_connection(path)
    c.execute("INSERT INTO patients(name,identity_status) VALUES ('Paciente ficticio','PROVISIONAL')")
    c.execute("INSERT INTO episodes(patient_id,qr_token,status,priority,location,started_at) VALUES (1,'qr-ficticio','ACTIVE',3,'Espera','2026-10-29T12:00:00+00:00')")
    for identifier, role in ((1, 'DOCTOR'), (2, 'LAB')):
        c.execute('INSERT INTO users(id,username,password_hash,password_salt,role,active,created_at) VALUES (?,?,?,?,?,1,?)',
                  (identifier, f'profesional.{identifier}', 'unused', 'unused', role, NOW))
    c.commit()
    yield c
    c.close()


def patient(c):
    before = c.total_changes
    value = read(c, NOW, 'supervisor')['patients'][0]
    assert c.total_changes == before
    return value


def laboratory(c):
    migrate_laboratory_schema(c)
    c.execute("INSERT INTO tasks(id,episode_id,title,service,status,created_at) VALUES (1,1,'Orden ficticia','LAB','PENDING','2026-10-29T12:00:00+00:00')")
    c.execute("INSERT INTO lab_orders(task_id,episode_id,created_by,created_at) VALUES (1,1,1,'2026-10-29T12:00:00+00:00')")
    for identifier, kind in ((1, 'BLOOD'), (2, 'URINE')):
        c.execute('INSERT INTO lab_analyses(id,order_task_id,title) VALUES (?,1,?)', (identifier, f'Analitica ficticia {identifier}'))
        c.execute('INSERT INTO lab_specimens(id,order_task_id,kind) VALUES (?,1,?)', (identifier, kind))
        c.execute('INSERT INTO lab_analysis_specimens(order_task_id,analysis_id,specimen_id) VALUES (1,?,?)', (identifier, identifier))


def specimen_stages(c, identifier=1):
    return [item for item in patient(c)['laboratory'] if item['resource_id'] == identifier and item['stage'] != 'LAB_REVIEW']


def accept(c, identifier=1):
    c.execute("""UPDATE lab_specimens SET received_at='2026-10-29T12:20:00+00:00',received_by=2,
        suitability='ACCEPTED',assessed_at='2026-10-29T12:30:00+00:00',assessed_by=2 WHERE id=?""", (identifier,))


def test_stay_triage_and_first_start_are_separate_and_handoff_does_not_restart(connection):
    c = connection
    initial = patient(c)
    assert initial['stay_minutes'] == 60 and initial['triage']['minutes'] == 60
    assert all(item['wait']['state'] == 'BEFORE_TRIAGE' for item in initial['attention'])
    c.execute("INSERT INTO care_episodes(episode_id,ready_at) VALUES (1,'2026-10-29T12:10:00+00:00')")
    c.execute("""INSERT INTO care_slots(episode_id,discipline,user_id,started_at,first_started_at)
        VALUES (1,'DOCTOR',1,'2026-10-29T12:55:00+00:00','2026-10-29T12:25:00+00:00')""")
    value = patient(c)
    assert 'qr_token' not in value and 'birth_date' not in value and 'document' not in value
    assert value['triage']['state'] == 'COMPLETED' and value['triage']['minutes'] == 10
    assert value['attention'][0]['wait']['minutes'] == 15
    assert value['attention'][0]['wait']['state'] == 'COMPLETED'
    assert value['attention'][1]['wait']['minutes'] == 50
    c.execute('UPDATE care_episodes SET historical=1')
    assert all(item['wait']['minutes'] is None for item in patient(c)['attention'])


@pytest.mark.parametrize('start,end', [
    (None, NOW), ('invalida', NOW), ('2026-10-29T12:00:00', NOW),
    ('2026-10-29T14:00:00+00:00', NOW), (NOW, '2026-10-29T14:00:00+00:00'),
    (NOW, '2026-10-29T12:00:00+00:00'), (NOW, None),
])
def test_missing_naive_future_or_inverted_dates_never_become_zero(start, end):
    assert minutes(start, end, datetime.fromisoformat(NOW)) is None


def test_timezone_offsets_and_real_zero_are_valid():
    now = datetime.fromisoformat(NOW)
    assert minutes('2026-10-29T08:00:00-04:00', NOW, now) == 60
    assert minutes(NOW, NOW, now) == 0


def test_legacy_database_is_not_migrated_and_only_active_episodes_are_returned(connection):
    c = connection
    c.execute("INSERT INTO tasks(episode_id,title,service,status,created_at) VALUES (1,'Orden anterior','LAB','PENDING','2026-10-29T12:15:00+00:00')")
    value = patient(c)
    assert value['laboratory'][0]['stage'] == 'LAB_LEGACY'
    assert value['laboratory'][0]['minutes'] == 45
    assert c.execute("SELECT name FROM sqlite_master WHERE name GLOB 'lab_*'").fetchall() == []
    c.execute("UPDATE episodes SET status='CLOSED'")
    assert read(c, NOW, 'supervisor')['patients'] == []
    c.execute("UPDATE episodes SET status='ANNULLED'")
    assert read(c, NOW, 'supervisor')['patients'] == []


def test_sample_stages_deduplicate_shared_samples_and_do_not_invent_collection(connection):
    c = connection
    laboratory(c)
    c.execute("INSERT INTO lab_analyses(id,order_task_id,title) VALUES (3,1,'Analitica compartida')")
    c.execute('INSERT INTO lab_analysis_specimens(order_task_id,analysis_id,specimen_id) VALUES (1,3,1)')
    assert len(patient(c)['laboratory']) == 2  # Two samples, not three analytical requirements.
    assert specimen_stages(c)[0]['stage'] == 'LAB_COLLECTION'
    c.execute("UPDATE lab_specimens SET collected_at='2026-10-29T12:05:00+00:00',collector_kind='USER',collector_user_id=2,collection_location='Laboratorio' WHERE id=1")
    assert specimen_stages(c)[0]['stage'] == 'LAB_DELIVERY'
    c.execute("UPDATE lab_specimens SET delivered_at='2026-10-29T12:15:00+00:00',deliverer_kind='USER',deliverer_user_id=2 WHERE id=1")
    assert specimen_stages(c)[0]['stage'] == 'LAB_RECEIPT'
    c.execute("UPDATE lab_specimens SET received_at='2026-10-29T12:20:00+00:00',received_by=2 WHERE id=2")
    assert specimen_stages(c, 2)[0]['stage'] == 'LAB_SUITABILITY'
    assert c.execute('SELECT collected_at FROM lab_specimens WHERE id=2').fetchone()[0] is None
    accept(c)
    ready = [item for item in patient(c)['laboratory'] if item['stage'] == 'LAB_RESULT']
    assert {item['resource_id'] for item in ready} == {1, 3}
    assert all(item['minutes'] == 30 for item in ready)


def test_rejected_replaced_and_cancelled_samples_do_not_create_false_backlogs(connection):
    c = connection
    laboratory(c)
    c.execute("""UPDATE lab_specimens SET received_at='2026-10-29T12:20:00+00:00',received_by=2,
        suitability='REJECTED',assessed_at='2026-10-29T12:30:00+00:00',assessed_by=2,suitability_reason='Rechazo ficticio' WHERE id=1""")
    assert specimen_stages(c)[0]['stage'] == 'LAB_REPLACEMENT'
    c.execute("INSERT INTO lab_specimens(id,order_task_id,kind) VALUES (3,1,'BLOOD')")
    c.execute('UPDATE lab_analysis_specimens SET current_requirement=0 WHERE specimen_id=1')
    c.execute('INSERT INTO lab_analysis_specimens(order_task_id,analysis_id,specimen_id) VALUES (1,1,3)')
    c.execute("""INSERT INTO lab_specimen_repeats(order_task_id,analysis_id,previous_specimen_id,new_specimen_id,requested_by,requested_at,reason)
        VALUES (1,1,1,3,2,'2026-10-29T12:40:00+00:00','Repeticion ficticia')""")
    c.execute("UPDATE lab_analyses SET cancelled_at=?,cancelled_by=1,cancellation_reason='Cancelacion ficticia' WHERE id=2", (NOW,))
    pending = patient(c)['laboratory']
    assert len(pending) == 1
    assert pending[0]['resource_id'] == 3 and pending[0]['stage'] == 'LAB_COLLECTION' and pending[0]['minutes'] == 20


def test_current_result_review_clock_restarts_after_correction(connection):
    c = connection
    laboratory(c)
    accept(c)
    c.execute("""INSERT INTO lab_result_versions(id,order_task_id,analysis_id,sequence,action,result,reason,published_by,published_at)
        VALUES (1,1,1,1,'PUBLISH','Resultado ficticio','Publicacion ficticia',2,'2026-10-29T12:50:00+00:00')""")
    c.execute('INSERT INTO lab_result_specimens(result_version_id,order_task_id,analysis_id,specimen_id) VALUES (1,1,1,1)')
    assert next(item for item in patient(c)['laboratory'] if item['stage'] == 'LAB_REVIEW')['minutes'] == 10
    c.execute("INSERT INTO lab_result_reviews(result_version_id,reviewed_by,reviewed_at,responsibility_context,owner_revision) VALUES (1,1,?,'ACTIVE_EPISODE',0)", (NOW,))
    assert not any(item['stage'] == 'LAB_REVIEW' for item in patient(c)['laboratory'])
    c.execute("""INSERT INTO lab_result_versions(id,order_task_id,analysis_id,sequence,action,previous_version_id,result,reason,published_by,published_at)
        VALUES (2,1,1,2,'CORRECT',1,'Texto ficticio rectificado','Correccion ficticia',2,'2026-10-29T12:55:00+00:00')""")
    c.execute('INSERT INTO lab_result_specimens(result_version_id,order_task_id,analysis_id,specimen_id) VALUES (2,1,1,1)')
    assert next(item for item in patient(c)['laboratory'] if item['stage'] == 'LAB_REVIEW')['minutes'] == 5


def test_partial_laboratory_schema_fails_closed_without_repairing_it(connection):
    c = connection
    c.execute('CREATE TABLE lab_schema(version INTEGER)')
    with pytest.raises(HTTPException) as error:
        read(c, NOW, 'supervisor')
    assert error.value.status_code == 409
    assert len(c.execute("SELECT name FROM sqlite_master WHERE name GLOB 'lab_*'").fetchall()) == 1


def test_endpoint_permissions_revocation_and_no_implicit_migration(accounts):
    client, login, _ = accounts
    assert client.get('/operations/delays').status_code == 401
    for username in ('recepcion', 'archivo', 'enfermeria', 'medico', 'laboratorio', 'admin.demo'):
        password = 'demo123' if username != 'admin.demo' else 'Demo-Account-Only-42'
        assert client.get('/operations/delays', headers=login(username, password)).status_code == 403
    assert client.get('/operations/delays', headers=login('supervisor', 'demo123')).status_code == 200
    admin = login()
    for role in ('DOCTOR', 'NURSE', 'LAB'):
        account = create(client, admin, f'coordinador.{role.lower()}', role).json()
        permitted = grant(client, admin, account).json()
        auth = login(account['username'])
        assert client.get('/operations/delays', headers=auth).json()['patients'] == []
        assert client.get('/supervisor/dashboard', headers=auth).status_code == 403
        assert grant(client, admin, permitted, False).status_code == 200
        assert client.get('/operations/delays', headers=auth).status_code == 401
        assert client.get('/operations/delays', headers=login(account['username'])).status_code == 403
    assert query("SELECT name FROM sqlite_master WHERE name GLOB 'lab_*'") == []
