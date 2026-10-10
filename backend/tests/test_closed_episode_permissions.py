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
def test_closed_episode_rejections_preserve_clinical_tables(tmp_path, monkeypatch, username):
    monkeypatch.setattr(main, 'DATABASE_PATH', tmp_path / 'closed-permissions.db')
    with TestClient(main.app) as client:
        reception = login(client, 'recepcion')
        doctor = login(client, 'medico')
        headers = login(client, username)
        response = client.post('/episodes', headers=reception, json={
            'name': 'Paciente ficticio 35B', 'birth_date': '1990-01-01',
            'document': 'TEST-35B', 'priority': 3,
        })
        assert response.status_code == 201
        episode = response.json()
        episode_id = episode['id']
        with closing(main.get_connection()) as connection:
            main.create_alert_if_missing(connection, episode_id, 'Alerta ficticia 35B', 'HIGH')
            connection.commit()
            alert_id = connection.execute('SELECT id FROM alerts WHERE episode_id = ?', (episode_id,)).fetchone()[0]
        prefix = f'/episodes/{episode_id}'
        assert client.post(prefix + '/discharge', headers=doctor,
                           json={'note': 'Alta ficticia 35B'}).status_code == 200
        before = snapshot()
        actions = [
            (prefix + '/triage', {'priority': 1, 'location': 'Cambio rechazado'},
             ['enfermeria', 'supervisor']),
            (prefix + '/vitals', {'temperature': 39, 'heart_rate': 121, 'systolic': 120,
                                 'diastolic': 80, 'spo2': 91, 'respiratory_rate': 18},
             ['enfermeria', 'medico']),
            (prefix + '/medical-evaluation', {'diagnosis': 'Ficticio', 'clinical_note': 'Nota rechazada'},
             ['medico']),
            (prefix + '/discharge', {'note': 'Alta repetida rechazada'}, ['medico']),
        ]
        for path, data, allowed in actions:
            assert client.post(path, json=data).status_code == 401
            assert snapshot() == before
            response = client.post(path, headers=headers, json=data)
            assert response.status_code == (409 if username in allowed else 403)
            assert snapshot() == before
        for status in ['ACKNOWLEDGED', 'ESCALATED', 'RESOLVED']:
            path = f'/alerts/{alert_id}'
            data = {'status': status}
            assert client.patch(path, json=data).status_code == 401
            assert snapshot() == before
            allowed = ['medico', 'supervisor'] if status == 'RESOLVED' else ['enfermeria', 'medico', 'supervisor']
            response = client.patch(path, headers=headers, json=data)
            assert response.status_code == (409 if username in allowed else 403)
            assert snapshot() == before
        scan_path = '/scan/' + episode['qr_token']
        assert client.get(scan_path).status_code == 401
        assert snapshot() == before
        assert client.get(scan_path, headers=headers).status_code == 404
        assert snapshot() == before
        detail = client.get(prefix, headers=headers)
        assert detail.status_code == 200
        assert detail.json()['status'] == 'CLOSED'
        assert snapshot() == before
