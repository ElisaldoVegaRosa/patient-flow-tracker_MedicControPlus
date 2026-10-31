"""Communication tests use temporary databases, sessions and the mounted API only."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException
from app import main, patient_communications as comm
from app.laboratory_schema import migrate_laboratory_schema
from test_accounts import accounts, query  # noqa: F401


@pytest.fixture
def workflow(accounts):
    client, login, _ = accounts
    reception = login('recepcion', 'demo123')
    doctor = login('medico', 'demo123')
    episode = client.post('/episodes', headers=reception, json={'provisional': True}).json()
    c = main.get_connection()
    try:
        migrate_laboratory_schema(c)
        comm.migrate(c)
        doctor_id = c.execute("SELECT id FROM users WHERE username='medico'").fetchone()[0]
        c.execute("UPDATE episodes SET status='CLOSED',closed_at=? WHERE id=?", (main.utc_now(), episode['id']))
        event = c.execute("INSERT INTO events(episode_id,type,note,created_at,username) VALUES (?,'DISCHARGE','Alta ficticia',?,'medico')", (episode['id'], main.utc_now())).lastrowid
        identifier = c.execute('''INSERT INTO lab_followups(episode_id,discharge_event_id,owner_user_id,reason,created_by,created_at)
            VALUES (?,?,?,'Seguimiento ficticio',?,?)''', (episode['id'], event, doctor_id, doctor_id, main.utc_now())).lastrowid
        c.commit()
    finally:
        c.close()
    return client, login, reception, doctor, identifier


def case(w, auth=None):
    client, _, _, doctor, _ = w
    r = client.get('/communications?include_resolved=true', headers=auth or doctor)
    assert r.status_code == 200, r.text
    return r.json()['items'][0]


def save(w, action, body, auth=None, version=None, key=None):
    client, _, _, doctor, identifier = w
    return client.post(f'/communications/{identifier}/{action}', json={'reason': 'Gestion ficticia sin datos reales', **body},
                      headers={**(auth or doctor), 'If-Match': version or case(w)['version'], 'Idempotency-Key': key or str(uuid4())})


def authorize(w, **body):
    response = save(w, 'authorize', {'mode': 'CONTACT_ONLY', **body})
    assert response.status_code == 200, response.text


def attempt(**body):
    return {'channel': 'PHONE', 'outcome': 'NO_RESPONSE',
            'next_attempt_at': (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(), **body}


def test_disabled_read_does_not_migrate_and_roles_are_enforced(accounts):
    client, login, _ = accounts
    for name in ('recepcion', 'medico', 'supervisor'):
        assert client.get('/communications', headers=login(name, 'demo123')).json()['enabled'] is False
    assert not query("SELECT name FROM sqlite_master WHERE name LIKE 'comm_%'")
    assert client.get('/communications').status_code == 401
    for name in ('enfermeria', 'laboratorio'):
        assert client.get('/communications', headers=login(name, 'demo123')).status_code == 403
    assert client.get('/communications', headers=login()).status_code == 403


def test_reception_projection_authorization_and_clinical_access_remain_separate(workflow):
    w = workflow
    assert w[0].get('/communications', headers=w[2]).json()['items'] == []
    assert save(w, 'authorize', {'mode': 'CONTACT_ONLY'}, auth=w[2]).status_code == 403
    authorize(w)
    value = case(w, w[2])
    assert value['valid'] and value['can_attempt'] and not value['can_authorize']
    assert 'analyses' not in value and 'communication_plan' not in value and 'document' not in value
    assert w[0].get('/lab/followups', headers=w[2]).status_code == 403
    assert save(w, 'attempt', attempt()).status_code == 403
    assert save(w, 'explain', {}, auth=w[2]).status_code == 403


@pytest.mark.parametrize('display_name,expected', [('', 'medico'), ('Medico ficticio visible', 'Medico ficticio visible')])
def test_responsible_identity_uses_username_when_display_name_is_empty(workflow, display_name, expected):
    query("UPDATE users SET display_name=? WHERE username='medico'", (display_name,))
    authorize(workflow)
    value = case(workflow, workflow[2])
    assert value['owner_name'] == expected
    assert value['valid'] and value['can_attempt']
    assert query("SELECT active FROM users WHERE username='medico'")[0]['active'] == 1


@pytest.mark.parametrize('body', [
    {'outcome': 'CONFIRMED'}, {'transmitted': True}, {'next_attempt_at': None},
    {'next_attempt_at': '2026-01-01T10:00:00'}, {'outcome': 'READ'}, {'phone': 'no guardar'},
])
def test_invalid_or_unconfirmed_attempts_do_not_close_contact(workflow, body):
    authorize(workflow)
    assert save(workflow, 'attempt', attempt(**body), auth=workflow[2]).status_code == 422
    assert not case(workflow)['contacted']


def test_whatsapp_send_and_read_remain_pending_and_message_restriction(workflow):
    w = workflow
    authorize(w)
    for outcome in ('SENT', 'READ'):
        assert save(w, 'attempt', attempt(channel='WHATSAPP', outcome=outcome, notify_doctor=True), auth=w[2]).status_code == 200
        assert not case(w)['contacted'] and case(w)['next_attempt_at']
    authorize(w, mode='MESSAGE', message='Texto ficticio autorizado')
    assert save(w, 'attempt', attempt(channel='WHATSAPP'), auth=w[2]).status_code == 409


def test_confirmed_contact_explanation_rectification_and_resolved_filter(workflow):
    w = workflow
    authorize(w)
    r = save(w, 'attempt', attempt(outcome='CONFIRMED', identity_verified=True, transmitted=True, next_attempt_at=None), auth=w[2])
    assert r.status_code == 200, r.text
    assert case(w)['contacted'] and not case(w)['explained']
    assert w[0].get('/communications', headers=w[2]).json()['total'] == 1
    assert save(w, 'explain', {'reason': 'Explicacion clinica ficticia reservada'}).status_code == 200
    assert case(w)['explained']
    assert w[0].get('/communications', headers=w[2]).json()['total'] == 0
    assert 'Explicacion clinica ficticia reservada' not in str(case(w, w[2]))
    identifier = case(w)['history'][0]['id']
    assert save(w, 'rectify', {'event_id': identifier}).status_code == 403
    assert save(w, 'rectify', {'event_id': identifier}, auth=w[2]).status_code == 200
    assert not case(w)['contacted'] and case(w)['history'][0]['voided']
    assert save(w, 'rectify', {'event_id': identifier}, auth=w[2]).status_code == 409


def test_stale_version_retry_and_no_duplicate_attempt(workflow):
    w = workflow
    authorize(w)
    version, key, body = case(w)['version'], str(uuid4()), attempt()
    r = save(w, 'attempt', body, auth=w[2], version=version, key=key)
    assert r.status_code == 200, r.text
    assert save(w, 'attempt', body, auth=w[2], version=version, key=key).json() == r.json()
    assert len(case(w)['history']) == 1
    assert save(w, 'attempt', attempt(), auth=w[2], version=version).status_code == 409


def test_changed_followup_requires_reauthorization_and_retains_history(workflow):
    w = workflow
    authorize(w)
    assert save(w, 'attempt', attempt(), auth=w[2]).status_code == 200
    query('UPDATE lab_followups SET revision=revision+1 WHERE id=?', (w[-1],))
    assert not case(w)['valid'] and case(w)['message'] is None
    assert w[0].get('/communications', headers=w[2]).json()['total'] == 0
    assert save(w, 'attempt', attempt(), auth=w[2]).status_code == 409
    authorize(w)
    history = w[0].get(f'/communications/{w[-1]}/history', headers=w[2]).json()
    assert len(history['items']) == 2 and len(history['items'][1]['history']) == 1
    assert history['items'][1]['message'] is None
    assert all('historical_message' not in item and 'authorization_reason' not in item for item in history['items'])
    medical_history = w[0].get(f'/communications/{w[-1]}/history', headers=w[3]).json()
    assert medical_history['items'][1]['historical_message'] == comm.CONTACT_MESSAGE
    assert medical_history['items'][1]['authorization_reason'] == 'Gestion ficticia sin datos reales'


def test_reopening_prevents_old_cycle_actions(workflow):
    w = workflow
    authorize(w)
    query("UPDATE episodes SET status='ACTIVE' WHERE id=(SELECT episode_id FROM lab_followups WHERE id=?)", (w[-1],))
    assert w[0].get('/communications', headers=w[2]).json()['total'] == 0
    assert w[0].post(f'/communications/{w[-1]}/authorize', headers={**w[3], 'Idempotency-Key': str(uuid4())},
                     json={'mode': 'CONTACT_ONLY', 'reason': 'Aviso ficticio'}).status_code == 403


def test_partial_schema_rejected_without_repair(workflow):
    c = main.get_connection()
    try:
        c.execute('DROP TABLE comm_events')
        c.commit()
        with pytest.raises(HTTPException):
            comm.migrate(c)
        assert c.execute("SELECT name FROM sqlite_master WHERE name='comm_events'").fetchone() is None
    finally:
        c.close()


def test_missing_version_expired_permission_and_history_redaction(workflow):
    w = workflow
    authorize(w)
    r = w[0].post(f'/communications/{w[-1]}/attempt', headers={**w[2], 'Idempotency-Key': str(uuid4())},
                  json=attempt(reason='Prueba ficticia'))
    assert r.status_code == 428
    assert save(w, 'explain', {'reason': 'Detalle medico reservado ficticio'}).status_code == 200
    history = w[0].get(f'/communications/{w[-1]}/history', headers=w[2])
    assert 'Detalle medico reservado ficticio' not in history.text
    query("UPDATE users SET active=0,account_revision=account_revision+1 WHERE username='recepcion'")
    assert w[0].get('/communications', headers=w[2]).status_code == 401


def test_concurrent_intents_only_one_matches_the_version(workflow):
    from concurrent.futures import ThreadPoolExecutor
    w = workflow
    authorize(w)
    version = case(w)['version']
    body = attempt()
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(save, w, 'attempt', body, w[2], version) for _ in range(2)]
        statuses = sorted(f.result().status_code for f in futures)
    assert statuses == [200, 409]
    assert len(case(w)['history']) == 1


def test_copy_activation_preserves_source_and_existing_tables(workflow, tmp_path):
    from scripts.prepare_laboratory_demo import prepare, preserved_tables
    import sqlite3
    source = main.DATABASE_PATH
    c = main.get_connection()
    try:
        before = preserved_tables(c)
    finally:
        c.close()
    destination = tmp_path / 'communication-copy.sqlite3'
    result = prepare(source, destination, tmp_path / 'rollback.sqlite3', communications=True)
    assert result['communications_enabled'] is True
    with sqlite3.connect(destination) as copy:
        assert preserved_tables(copy) == before
    c = main.get_connection()
    try:
        assert preserved_tables(c) == before
    finally:
        c.close()
    with pytest.raises(Exception, match='no se sobrescribieron'):
        prepare(source, destination, tmp_path / 'rollback2.sqlite3', communications=True)
