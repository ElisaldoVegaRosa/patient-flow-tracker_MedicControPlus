from contextlib import closing

import pytest
from fastapi.testclient import TestClient

from app import main


def login(client, username):
    response = client.post('/auth/login', json={'username': username, 'password': 'demo123'})
    assert response.status_code == 200
    return {'Authorization': 'Bearer ' + response.json()['access_token']}


def snapshot():
    with closing(main.get_connection()) as connection:
        return {
            table: [tuple(row) for row in connection.execute(f'SELECT * FROM {table} ORDER BY id')]
            for table in ['patients', 'episodes', 'tasks', 'events', 'alerts', 'alert_history', 'vitals']
        }


@pytest.mark.parametrize('username', ['recepcion', 'enfermeria', 'medico', 'laboratorio', 'supervisor'])
def test_task_permissions_by_service_and_episode_state(tmp_path, monkeypatch, username):
    monkeypatch.setattr(main, 'DATABASE_PATH', tmp_path / 'task-permissions.db')
    with TestClient(main.app) as client:
        reception = login(client, 'recepcion')
        doctor = login(client, 'medico')
        headers = login(client, username)
        created = client.post('/episodes', headers=reception, json={
            'name': 'Paciente ficticio 35A', 'birth_date': '1990-01-01',
            'document': 'TEST-35A', 'priority': 3,
        })
        assert created.status_code == 201
        episode_id = created.json()['id']
        path = f'/episodes/{episode_id}/tasks'
        pending_ids = []
        for service in ['NURSING', 'MEDICAL', 'LAB']:
            data = {'title': 'Tarea ficticia 35A', 'service': service}
            before = snapshot()
            assert client.post(path, json=data).status_code == 401
            assert snapshot() == before
            response = client.post(path, headers=headers, json=data)
            assert response.status_code == (201 if username == 'medico' else 403)
            if username != 'medico':
                assert snapshot() == before
            task = client.post(path, headers=doctor, json=data)
            assert task.status_code == 201
            task_id = task.json()['tasks'][0]['id']
            completion_path = f'/tasks/{task_id}/complete'
            before = snapshot()
            assert client.patch(completion_path, json={'result': 'Ficticio'}).status_code == 401
            assert snapshot() == before
            allowed = username == 'laboratorio' or (
                username in ['enfermeria', 'medico'] and service != 'LAB'
            )
            response = client.patch(completion_path, headers=headers, json={'result': 'Ficticio'})
            assert response.status_code == (200 if allowed else 403)
            if allowed:
                completed = next(t for t in response.json()['tasks'] if t['id'] == task_id)
                assert completed['status'] == 'COMPLETED'
                assert completed['result'] == 'Ficticio'
                event = response.json()['events'][0]
                assert event['type'] == 'TASK_COMPLETED'
                assert event['username'] == username
                before = snapshot()
                assert client.patch(completion_path, headers=headers,
                                    json={'result': 'Repetido'}).status_code == 409
                assert snapshot() == before
            else:
                assert snapshot() == before
            pending = client.post(path, headers=doctor, json=data)
            assert pending.status_code == 201
            pending_ids.append(pending.json()['tasks'][0]['id'])
        assert client.post(f'/episodes/{episode_id}/discharge', headers=doctor, json={}).status_code == 200
        before = snapshot()
        for service in ['NURSING', 'MEDICAL', 'LAB']:
            response = client.post(path, headers=headers,
                                   json={'title': 'Rechazada', 'service': service})
            assert response.status_code == (409 if username == 'medico' else 403)
            assert snapshot() == before
        for task_id in pending_ids:
            response = client.patch(f'/tasks/{task_id}/complete', headers=headers,
                                    json={'result': 'Rechazado'})
            assert response.status_code == (409 if username in ['enfermeria', 'medico', 'laboratorio'] else 403)
            assert snapshot() == before
