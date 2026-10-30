"""Sample protocol on disposable DBs, with parity checks for the mounted main API."""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from threading import Barrier
from types import SimpleNamespace
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from app import main, laboratory_samples
from app.laboratory_schema import migrate_laboratory_schema
from app.routes.laboratory_samples import create_router
from test_accounts import accounts, query  # noqa: F401


BODY = {
    'title': 'Orden ficticia con varias muestras', 'reason': 'Prueba aislada de muestras',
    'analyses': [{'key': 'blood_count', 'title': 'Hemograma ficticio'}, {'key': 'glucose', 'title': 'Glucosa ficticia'},
                 {'key': 'urine', 'title': 'Orina ficticia'}],
    'specimens': [{'key': 'blood', 'kind': 'BLOOD', 'analysis_keys': ['blood_count', 'glucose']},
                  {'key': 'urine', 'kind': 'URINE', 'analysis_keys': ['urine']}],
}


class SampleAPI(SimpleNamespace):
    def __repr__(self):
        return 'SampleAPI(base temporal y sesiones omitidas)'


@pytest.fixture
def api(accounts):
    original, login, _ = accounts
    connection = main.get_connection()
    try:
        migrate_laboratory_schema(connection)
    finally:
        connection.close()
    application = FastAPI()
    application.include_router(create_router(main.get_connection, main.utc_now, main.episode_detail,
        main.add_event, main.require_active_episode, main.require_roles))
    with TestClient(application, raise_server_exceptions=False) as client:
        episode = original.post('/episodes', headers=login('recepcion', 'demo123'), json={'provisional': True}).json()
        yield SampleAPI(client=client, original=original, login=login, episode=episode,
                              doctor=login('medico', 'demo123'), nurse=login('enfermeria', 'demo123'), lab=login('laboratorio', 'demo123'))


def post(api, path, data=None, auth=None, version=None, key=None):
    return api.client.post(path, headers={**(auth or api.lab), 'Idempotency-Key': key or str(uuid4()),
        **({'If-Match': version} if version is not None else {})}, json={'reason': 'Motivo ficticio de muestra', **(data or {})})


def create(api, body=None, key=None):
    clinical = api.original.get(f"/episodes/{api.episode['id']}", headers=api.doctor).json()
    return post(api, f"/episodes/{api.episode['id']}/lab-orders", body or deepcopy(BODY), api.doctor, clinical['clinical_version'], key)


def state(api):
    response = api.client.get(f"/episodes/{api.episode['id']}/laboratory", headers=api.lab)
    assert response.status_code == 200, response.text
    return response.json()


def specimen(api, kind='BLOOD'):
    return next(item for item in state(api)['orders'][0]['specimens'] if item['kind'] == kind)


def write_sample(api, action, data=None, auth=None, kind='BLOOD', key=None):
    item = specimen(api, kind)
    return post(api, f"/lab/specimens/{item['id']}/{action}", data, auth, item['version'], key)


def test_create_explicit_many_to_many_order_and_reading_has_no_effects(api):
    response = create(api)
    assert response.status_code == 201, response.text
    order = response.json()['laboratory']['orders'][0]
    assert len(order['analyses']) == 3 and len(order['specimens']) == 2
    assert len(order['specimens'][0]['analysis_ids']) == 2
    assert all(item['suitability'] == 'UNKNOWN' and item['received_at'] is None for item in order['specimens'])
    changes = len(query('SELECT id FROM lab_changes'))
    events = len(query('SELECT id FROM events'))
    for _ in range(2):
        assert state(api)['orders'][0] == order
    assert len(query('SELECT id FROM lab_changes')) == changes and len(query('SELECT id FROM events')) == events
    mounted = api.original.get(f"/episodes/{api.episode['id']}/laboratory", headers=api.lab)
    assert mounted.status_code == 200
    assert mounted.json()['orders'][0] == order


def test_collection_delivery_receipt_and_suitability_are_independent_audited_facts(api):
    assert create(api).status_code == 201
    original_urine = specimen(api, 'URINE')
    assert write_sample(api, 'suitability', {'suitability': 'ACCEPTED'}).status_code == 409
    assert write_sample(api, 'collection', {'location': 'Cama ficticia', 'collector_kind': 'USER'}, api.nurse).status_code == 200
    assert specimen(api)['received_at'] is None
    assert write_sample(api, 'delivery', {'deliverer_kind': 'USER'}, api.nurse).status_code == 200
    assert specimen(api)['received_at'] is None
    assert write_sample(api, 'receipt').status_code == 200
    assert specimen(api)['suitability'] == 'UNKNOWN'
    assessed = write_sample(api, 'suitability', {'suitability': 'REJECTED', 'reason': 'Muestra ficticia no apta'})
    assert assessed.status_code == 200, assessed.text
    current_urine = specimen(api, 'URINE')
    assert {key: value for key, value in current_urine.items() if key != 'version'} == {key: value for key, value in original_urine.items() if key != 'version'}
    assert specimen(api)['suitability_reason'] == 'Muestra ficticia no apta'
    assert write_sample(api, 'suitability', {'suitability': 'ACCEPTED'}).status_code == 409
    assert query("SELECT status FROM tasks WHERE service='LAB'")[0][0] == 'PENDING'
    assert not query('SELECT id FROM lab_result_versions')
    assert {row[0] for row in query('SELECT action FROM lab_changes')} == {'CREATE', 'COLLECT', 'DELIVER', 'RECEIVE', 'ASSESS'}
    assert len(query("SELECT id FROM events WHERE type LIKE 'LAB_SAMPLE_%'")) == 4


def test_receipt_without_recorded_collection_does_not_invent_collection(api):
    assert create(api).status_code == 201
    assert write_sample(api, 'receipt', kind='URINE').status_code == 200
    urine = specimen(api, 'URINE')
    assert urine['collected_at'] is None and urine['delivered_at'] is None
    assert urine['received_at'] and urine['suitability'] == 'UNKNOWN'
    assert write_sample(api, 'suitability', {'suitability': 'ACCEPTED'}, kind='URINE').status_code == 200
    assert specimen(api)['received_at'] is None


def test_patient_and_other_professional_are_distinct_from_authenticated_recorder(api):
    assert create(api).status_code == 201
    assert write_sample(api, 'collection', {'location': 'Lugar ficticio', 'collector_kind': 'PATIENT'}, api.lab, 'URINE').status_code == 200
    assert write_sample(api, 'delivery', {'deliverer_kind': 'PATIENT'}, api.lab, 'URINE').status_code == 200
    urine = specimen(api, 'URINE')
    assert urine['collector_user_id'] is None and urine['deliverer_user_id'] is None
    nurse_id = query("SELECT id FROM users WHERE username='enfermeria'")[0][0]
    lab_id = query("SELECT id FROM users WHERE username='laboratorio'")[0][0]
    assert write_sample(api, 'collection', {'location': 'Cama ficticia', 'collector_kind': 'USER', 'collector_user_id': nurse_id}).status_code == 200
    assert specimen(api)['collector_user_id'] == nurse_id
    assert query("SELECT actor_user_id FROM lab_changes WHERE action='COLLECT' ORDER BY id DESC")[0][0] == lab_id


@pytest.mark.parametrize('username', ['recepcion', 'archivo', 'enfermeria', 'medico', 'laboratorio', 'supervisor', 'admin.demo'])
def test_role_matrix_for_reads_creating_and_sample_actions(api, username):
    assert create(api).status_code == 201
    auth = api.login() if username == 'admin.demo' else api.login(username, 'demo123')
    read = api.client.get(f"/episodes/{api.episode['id']}/laboratory", headers=auth)
    assert read.status_code == (200 if username in ('enfermeria', 'medico', 'laboratorio', 'supervisor') else 403)
    clinical = api.original.get(f"/episodes/{api.episode['id']}", headers=api.doctor).json()
    created = post(api, f"/episodes/{api.episode['id']}/lab-orders", BODY, auth, clinical['clinical_version'])
    assert created.status_code == (201 if username == 'medico' else 403)
    for action, body in (('collection', {'location': 'Lugar ficticio', 'collector_kind': 'USER'}),
                         ('delivery', {'deliverer_kind': 'USER'}), ('receipt', {}), ('suitability', {'suitability': 'ACCEPTED'})):
        allowed = username == 'laboratorio' or (username == 'enfermeria' and action in ('collection', 'delivery'))
        response = write_sample(api, action, body, auth)
        assert response.status_code == (200 if allowed else 403), (username, action, response.text)


def test_missing_preconditions_stale_version_replay_and_conflicting_intent(api):
    path = f"/episodes/{api.episode['id']}/lab-orders"
    assert post(api, path, BODY, api.doctor).status_code == 428
    assert api.client.post(path, headers={**api.doctor, 'If-Match': api.episode['clinical_version']}, json=BODY).status_code == 428
    key = str(uuid4())
    created = post(api, path, BODY, api.doctor, api.episode['clinical_version'], key)
    assert created.status_code == 201, created.text
    replay = post(api, path, BODY, api.doctor, api.episode['clinical_version'], key)
    assert replay.status_code == 201 and replay.json() == created.json()
    assert len(query('SELECT task_id FROM lab_orders')) == 1
    assert post(api, path, {**BODY, 'title': 'Otra orden ficticia'}, api.doctor, api.episode['clinical_version'], key).status_code == 409
    assert post(api, path, BODY, api.doctor, api.episode['clinical_version']).status_code == 409
    item = specimen(api)
    receive_path = f"/lab/specimens/{item['id']}/receipt"
    receive_key = str(uuid4())
    received = post(api, receive_path, auth=api.lab, version=item['version'], key=receive_key)
    assert received.status_code == 200
    assert post(api, receive_path, auth=api.lab, version=item['version'], key=receive_key).status_code == 200
    assert post(api, receive_path, auth=api.lab, version=item['version']).status_code == 409
    assert len(query("SELECT id FROM lab_changes WHERE action='RECEIVE'")) == 1
    assert all(row[0] is None for row in query('SELECT summary FROM write_receipts WHERE scope LIKE \'%/lab%\''))
    assert 'qr_token' not in str([dict(row) for row in query('SELECT * FROM lab_changes')])


@pytest.mark.parametrize('change', [
    {'analyses': []}, {'specimens': []}, {'reason': ' '}, {'unexpected': True},
    {'analyses': [{'key': 'same', 'title': 'Primera'}, {'key': 'same', 'title': 'Segunda'}]},
    {'specimens': [{'key': 'one', 'kind': 'BLOOD', 'analysis_keys': ['unknown']}]},
    {'specimens': [{'key': 'one', 'kind': 'OTHER', 'analysis_keys': ['blood_count', 'glucose', 'urine']}]},
])
def test_invalid_order_has_no_partial_tasks_samples_or_audit(api, change):
    before = len(query('SELECT id FROM tasks'))
    response = create(api, {**deepcopy(BODY), **change})
    assert response.status_code == 422, response.text
    assert len(query('SELECT id FROM tasks')) == before
    assert not query('SELECT id FROM lab_analyses') and not query('SELECT id FROM lab_changes')


def test_future_naive_dates_bad_performers_and_chronology_are_rejected(api):
    assert create(api).status_code == 201
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    assert write_sample(api, 'receipt', {'occurred_at': future}).status_code == 422
    assert write_sample(api, 'receipt', {'occurred_at': '2026-10-27T12:00:00'}).status_code == 422
    doctor_id = query("SELECT id FROM users WHERE username='medico'")[0][0]
    for kind, identifier in (('USER', doctor_id), ('USER', 999999), ('PATIENT', doctor_id)):
        assert write_sample(api, 'collection', {'location': 'Cama ficticia', 'collector_kind': kind, 'collector_user_id': identifier}).status_code == 422
    assert write_sample(api, 'receipt').status_code == 200
    assert write_sample(api, 'collection', {'location': 'Cama ficticia', 'collector_kind': 'PATIENT'}).status_code == 422
    assert specimen(api)['collected_at'] is None
    assert write_sample(api, 'collection', {'location': 'Cama ficticia', 'collector_kind': 'PATIENT',
        'occurred_at': specimen(api)['received_at']}).status_code == 200


def test_delayed_recording_keeps_fact_time_distinct_from_audit_time(api):
    assert create(api).status_code == 201
    earlier = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    assert write_sample(api, 'collection', {'location': 'Lugar ficticio', 'collector_kind': 'PATIENT',
        'occurred_at': earlier}, kind='URINE').status_code == 200
    assert specimen(api, 'URINE')['collected_at'] == earlier
    recorded_at = query("SELECT created_at FROM lab_changes WHERE action='COLLECT'")[0][0]
    assert datetime.fromisoformat(recorded_at) > datetime.fromisoformat(earlier)
    assert write_sample(api, 'receipt', kind='URINE').status_code == 200


def test_closed_annulled_or_nonpending_orders_do_not_accept_sample_writes(api):
    assert create(api).status_code == 201
    for status in ('CLOSED', 'ANNULLED'):
        query('UPDATE episodes SET status=? WHERE id=?', (status, api.episode['id']))
        assert write_sample(api, 'receipt').status_code == 409
    query("UPDATE episodes SET status='ACTIVE' WHERE id=?", (api.episode['id'],))
    query("UPDATE tasks SET status='COMPLETED' WHERE service='LAB'")
    assert write_sample(api, 'receipt').status_code == 409
    assert not query("SELECT id FROM lab_changes WHERE action='RECEIVE'")


def test_legacy_orders_are_listed_without_adopting_or_changing_them(api):
    response = api.original.post(f"/episodes/{api.episode['id']}/tasks", headers=api.doctor,
        json={'title': 'Orden antigua ficticia', 'service': 'LAB'})
    assert response.status_code == 201
    legacy_id = response.json()['tasks'][0]['id']
    before = [tuple(row) for row in query('SELECT * FROM tasks WHERE id=?', (legacy_id,))]
    assert create(api).status_code == 201
    assert state(api)['legacy_order_ids'] == [legacy_id]
    assert [tuple(row) for row in query('SELECT * FROM tasks WHERE id=?', (legacy_id,))] == before


def test_expired_session_and_deactivated_account_cannot_replay_a_receipt(api):
    assert create(api).status_code == 201
    item = specimen(api)
    path, key = f"/lab/specimens/{item['id']}/receipt", str(uuid4())
    assert post(api, path, version=item['version'], key=key).status_code == 200
    query("UPDATE sessions SET expires_at='2000-01-01T00:00:00+00:00' WHERE user_id=(SELECT id FROM users WHERE username='laboratorio')")
    assert post(api, path, version=item['version'], key=key).status_code == 401
    api.lab = api.login('laboratorio', 'demo123')
    query("UPDATE users SET active=0 WHERE username='laboratorio'")
    assert post(api, path, version=item['version'], key=key).status_code == 401
    assert len(query("SELECT id FROM lab_changes WHERE action='RECEIVE'")) == 1


def test_concurrent_receipts_cannot_both_commit(api):
    assert create(api).status_code == 201
    item, barrier = specimen(api), Barrier(2)
    def receive():
        barrier.wait()
        return post(api, f"/lab/specimens/{item['id']}/receipt", version=item['version']).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(lambda _: receive(), range(2)))
    assert sorted(outcomes) == [200, 409]
    assert len(query("SELECT id FROM lab_changes WHERE action='RECEIVE'")) == 1


def test_audit_failure_rolls_back_entire_create_and_sample_write(api, monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError('Fallo de auditoria inyectado para prueba aislada')
    with monkeypatch.context() as patch:
        patch.setattr(laboratory_samples, 'audit', fail)
        assert create(api).status_code == 500
    assert not query('SELECT task_id FROM lab_orders') and not query("SELECT id FROM tasks WHERE service='LAB'")
    assert create(api).status_code == 201
    before = specimen(api)
    with monkeypatch.context() as patch:
        patch.setattr(laboratory_samples, 'audit', fail)
        assert write_sample(api, 'receipt').status_code == 500
    assert specimen(api) == before
    assert not query("SELECT id FROM events WHERE type='LAB_SAMPLE_RECEIVE'")
