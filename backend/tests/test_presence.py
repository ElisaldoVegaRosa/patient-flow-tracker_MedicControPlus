from datetime import timedelta

import pytest
from app import main
from app.routes import presence
from test_flow import login
from test_write_operations import setup, rows  # noqa: F401

TAB = "presence-tab-stage61"
OTHER = "presence-other-stage61"


def path(episode, tab=TAB):
    return f"/episodes/{episode['id']}/presence/{tab}"


def renew(client, episode, headers, tab=TAB, mode="VIEW", sequence=1):
    return client.put(path(episode, tab), headers=headers, json={"mode": mode, "sequence": sequence})


def test_users_sessions_and_tabs_are_distinguished_without_exposing_identifiers(setup):
    client, users, episode = setup
    assert renew(client, episode, users['medico']).status_code == 200
    assert renew(client, episode, users['medico'], OTHER, 'EDIT').status_code == 200
    second_session = login(client, 'medico')
    assert renew(client, episode, second_session, TAB, 'EDIT').status_code == 200
    result = renew(client, episode, users['enfermeria']).json()
    assert result['members'] == [{'username': 'medico', 'role': 'DOCTOR', 'tabs': 3, 'sessions': 2, 'editing_tabs': 2}]
    own = client.get(path(episode), headers=users['medico']).json()
    assert next(member for member in own['members'] if member['username'] == 'medico')['tabs'] == 2
    assert 'token' not in str(result) and 'session_id' not in str(result) and TAB not in str(result)


@pytest.mark.parametrize('username', ['recepcion', 'medico', 'enfermeria', 'laboratorio', 'supervisor'])
def test_all_authenticated_roles_can_view_but_only_episode_editors_report_editing(setup, username):
    client, users, episode = setup
    assert renew(client, episode, users[username]).status_code == 200
    result = renew(client, episode, users[username], mode='EDIT', sequence=2)
    assert result.status_code == (403 if username in ('recepcion', 'laboratorio') else 200)


def test_expiry_hidden_or_disconnected_tabs_and_resume(setup, monkeypatch):
    client, users, episode = setup
    start = presence.now()
    monkeypatch.setattr(presence, 'now', lambda: start)
    renew(client, episode, users['medico'])
    monkeypatch.setattr(presence, 'now', lambda: start + timedelta(seconds=44))
    assert client.get(path(episode), headers=users['enfermeria']).json()['members']
    monkeypatch.setattr(presence, 'now', lambda: start + timedelta(seconds=45))
    assert client.get(path(episode), headers=users['enfermeria']).json()['members'] == []
    assert renew(client, episode, users['medico'], sequence=2).status_code == 200
    assert client.get(path(episode), headers=users['enfermeria']).json()['members']


def test_release_is_scoped_to_session_and_blocks_an_older_heartbeat(setup):
    client, users, episode = setup
    renew(client, episode, users['medico'])
    renew(client, episode, users['enfermeria'])
    assert client.delete(path(episode), headers=users['medico']).status_code == 200
    assert renew(client, episode, users['medico'], sequence=2).status_code == 200
    assert client.get(path(episode), headers=users['enfermeria']).json()['members'] == []
    assert client.get(path(episode), headers=users['medico']).json()['members'][0]['username'] == 'enfermeria'


def test_older_or_repeated_heartbeat_cannot_overwrite_mode_or_extend_lease(setup, monkeypatch):
    client, users, episode = setup
    start = presence.now()
    monkeypatch.setattr(presence, 'now', lambda: start)
    renew(client, episode, users['medico'], mode='EDIT', sequence=2)
    expires = rows('SELECT expires_at FROM episode_presence')[0]['expires_at']
    monkeypatch.setattr(presence, 'now', lambda: start + timedelta(seconds=10))
    renew(client, episode, users['medico'], sequence=1)
    renew(client, episode, users['medico'], sequence=2)
    assert rows('SELECT mode, expires_at FROM episode_presence')[0]['mode'] == 'EDIT'
    assert rows('SELECT expires_at FROM episode_presence')[0]['expires_at'] == expires


@pytest.mark.parametrize('invalidate', ['logout', 'expiry', 'inactive'])
def test_invalid_sessions_are_not_shown_or_allowed_to_renew(setup, invalidate):
    client, users, episode = setup
    renew(client, episode, users['medico'])
    if invalidate == 'logout':
        assert client.post('/auth/logout', headers=users['medico']).status_code == 200
    else:
        connection = main.get_connection()
        if invalidate == 'expiry':
            connection.execute("UPDATE sessions SET expires_at = '2000-01-01T00:00:00+00:00' WHERE user_id = (SELECT id FROM users WHERE username = 'medico')")
        else:
            connection.execute("UPDATE users SET active = 0 WHERE username = 'medico'")
        connection.commit(); connection.close()
    assert client.get(path(episode), headers=users['enfermeria']).json()['members'] == []
    assert renew(client, episode, users['medico']).status_code == 401


def test_closed_and_missing_episodes_stop_presence(setup):
    client, users, episode = setup
    renew(client, episode, users['medico'])
    assert client.post(f"/episodes/{episode['id']}/discharge", headers=users['medico'], json={'note': 'Alta ficticia'}).status_code == 200
    assert client.get(path(episode), headers=users['enfermeria']).json()['members'] == []
    assert client.get(path(episode), headers=users['enfermeria']).json()['active'] is False
    assert renew(client, episode, users['medico'], sequence=2).status_code == 409
    assert client.delete(path(episode), headers=users['medico']).status_code == 200
    assert client.get('/episodes/999999/presence/' + TAB, headers=users['medico']).status_code == 404


def test_presence_does_not_change_clinical_versions_events_or_write_receipts(setup):
    client, users, episode = setup
    before = client.get(f"/episodes/{episode['id']}", headers=users['medico']).json()
    counts = [len(rows('SELECT * FROM ' + table)) for table in ('events', 'write_receipts')]
    for sequence, mode in [(1, 'VIEW'), (2, 'EDIT'), (3, 'VIEW')]:
        assert renew(client, episode, users['medico'], mode=mode, sequence=sequence).status_code == 200
    client.delete(path(episode), headers=users['medico'])
    after = client.get(f"/episodes/{episode['id']}", headers=users['medico']).json()
    assert after['clinical_version'] == before['clinical_version']
    assert after['triage_version'] == before['triage_version']
    assert counts == [len(rows('SELECT * FROM ' + table)) for table in ('events', 'write_receipts')]


def test_invalid_payload_or_tab_and_missing_auth_are_rejected(setup):
    client, users, episode = setup
    assert client.put(path(episode), json={'mode': 'VIEW', 'sequence': 1}).status_code == 401
    for payload in [{'mode': 'OTHER', 'sequence': 1}, {'mode': 'VIEW', 'sequence': 0}, {'mode': 'VIEW', 'sequence': True}, {'mode': 'EDIT', 'sequence': 1, 'note': 'No permitido'}]:
        assert client.put(path(episode), headers=users['medico'], json=payload).status_code == 422
    assert renew(client, episode, users['medico'], tab='invalid').status_code == 400
    assert not rows('SELECT * FROM episode_presence')


def test_role_change_stops_reporting_edit_capability(setup):
    client, users, episode = setup
    renew(client, episode, users['medico'], mode='EDIT')
    connection = main.get_connection()
    connection.execute("UPDATE users SET role = 'LAB' WHERE username = 'medico'")
    connection.commit(); connection.close()
    member = client.get(path(episode), headers=users['enfermeria']).json()['members'][0]
    assert member['role'] == 'LAB' and member['editing_tabs'] == 0
    assert renew(client, episode, users['medico'], mode='EDIT', sequence=2).status_code == 403


def test_simultaneous_sessions_keep_independent_leases(setup):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from fastapi.testclient import TestClient
    client, users, episode = setup
    barrier = Barrier(2)
    def open_as(username):
        with TestClient(main.app) as other:
            barrier.wait(timeout=10)
            return renew(other, episode, users[username], mode='EDIT')
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(open_as, username) for username in ('medico', 'enfermeria')]
        assert [future.result(timeout=30).status_code for future in futures] == [200, 200]
    members = client.get(path(episode), headers=users['supervisor']).json()['members']
    assert {member['username'] for member in members} == {'medico', 'enfermeria'}
    assert all(member['tabs'] == 1 and member['editing_tabs'] == 1 for member in members)
