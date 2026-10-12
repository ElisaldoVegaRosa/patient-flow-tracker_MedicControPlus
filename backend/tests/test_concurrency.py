from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from app import main
from test_write_operations import setup, keyed, rows  # noqa: F401


TRIAGE = {"priority": 2, "location": "Observación", "assigned_to": "Enfermería ficticia"}
EVALUATION = {"diagnosis": "Control ficticio", "clinical_note": "Nota ficticia"}


def test_two_sessions_cannot_silently_replace_triage(setup):
    client, users, episode = setup
    path = f"/episodes/{episode['id']}/triage"
    baseline = episode["triage_version"]
    barrier = Barrier(2)
    def write(username, location):
        with TestClient(main.app) as other:
            barrier.wait(timeout=10)
            return other.post(path, headers={**users[username], "If-Match": baseline}, json={**TRIAGE, "location": location})
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(write, "enfermeria", "Triaje"), pool.submit(write, "supervisor", "Observación")]
        results = [future.result(timeout=30) for future in futures]
    assert sorted(result.status_code for result in results) == [200, 409]
    conflict = next(result for result in results if result.status_code == 409)
    assert conflict.json()["detail"]["code"] == "version_conflict"
    assert len(rows("SELECT id FROM events WHERE type = 'TRIAGE'")) == 1
    current = client.get(f"/episodes/{episode['id']}", headers=users['enfermeria']).json()
    reviewed = client.post(path, headers={**users['enfermeria'], "If-Match": current['triage_version']}, json=TRIAGE)
    assert reviewed.status_code == 200


def test_missing_version_is_rejected_without_effects(setup):
    client, users, episode = setup
    before = len(rows("SELECT id FROM events"))
    for operation, username, payload in [('triage', 'enfermeria', TRIAGE), ('discharge', 'medico', {'note': 'Ficticio'})]:
        result = client.post(f"/episodes/{episode['id']}/{operation}", headers={**users[username], "If-Match": ""}, json=payload)
        assert result.status_code == 428
    assert len(rows("SELECT id FROM events")) == before


def test_new_records_are_independent_but_invalidate_discharge_review(setup):
    client, users, episode = setup
    eid = episode['id']
    for _ in range(2):
        assert client.post(f'/episodes/{eid}/medical-evaluation', headers=users['medico'], json=EVALUATION).status_code == 200
    assert client.post(f'/episodes/{eid}/triage', headers={**users['enfermeria'], 'If-Match': episode['triage_version']}, json=TRIAGE).status_code == 200
    rejected = client.post(f'/episodes/{eid}/discharge', headers={**users['medico'], 'If-Match': episode['clinical_version']}, json={'note': 'Alta ficticia'})
    assert rejected.status_code == 409
    assert rejected.json()['detail']['code'] == 'version_conflict'
    assert len(rows("SELECT id FROM events WHERE type = 'MEDICAL_EVALUATION'")) == 2
    assert not rows("SELECT id FROM events WHERE type = 'DISCHARGE'")


def test_scan_does_not_invalidate_clinical_review(setup):
    client, users, episode = setup
    scanned = client.get(f"/scan/{episode['qr_token']}", headers=users['medico'])
    assert scanned.status_code == 200
    assert scanned.json()['clinical_version'] == episode['clinical_version']
    assert client.post(f"/episodes/{episode['id']}/discharge", headers={**users['medico'], 'If-Match': episode['clinical_version']}, json={'note': 'Alta ficticia'}).status_code == 200


def test_replay_precedes_version_check_and_conflict_rolls_back_receipt(setup):
    client, users, episode = setup
    path = f"/episodes/{episode['id']}/triage"
    headers = {**keyed(users['enfermeria']), 'If-Match': episode['triage_version']}
    first = client.post(path, headers=headers, json=TRIAGE)
    assert first.status_code == 200
    newer = client.post(path, headers={**users['supervisor'], 'If-Match': first.json()['triage_version']}, json={**TRIAGE, 'priority': 3})
    assert newer.status_code == 200
    assert client.post(path, headers=headers, json=TRIAGE).json() == newer.json()
    rejected = client.post(path, headers={**keyed(users['enfermeria'], 'another-intent-stage55'), 'If-Match': episode['triage_version']}, json=TRIAGE)
    assert rejected.status_code == 409
    assert len(rows('SELECT * FROM write_receipts')) == 1
    assert len(rows("SELECT id FROM events WHERE type = 'TRIAGE'")) == 2


@pytest.mark.parametrize('kind', ['task', 'alert'])
def test_resource_versions_are_returned_and_stale_actions_rejected(setup, kind):
    client, users, episode = setup
    eid = episode['id']
    if kind == 'task':
        created = client.post(f'/episodes/{eid}/tasks', headers=users['medico'], json={'title': 'Hemograma ficticio', 'service': 'LAB'}).json()
        resource = created['tasks'][0]
        queue = client.get('/lab/orders?status=PENDING', headers=users['laboratorio']).json()
        assert queue['orders'][0]['version'] == resource['version']
        path, user, payload = f"/tasks/{resource['id']}/complete", 'laboratorio', {'result': 'Ficticio'}
    else:
        client.post(f'/episodes/{eid}/vitals', headers=users['enfermeria'], json={'temperature': 39, 'heart_rate': 80, 'systolic': 120, 'diastolic': 80, 'spo2': 98, 'respiratory_rate': 16})
        resource = client.get(f'/episodes/{eid}', headers=users['enfermeria']).json()['alerts'][0]
        path, user, payload = f"/alerts/{resource['id']}", 'enfermeria', {'status': 'ACKNOWLEDGED'}
    assert client.patch(path, headers={**users[user], 'If-Match': '"obsolete"'}, json=payload).status_code == 409
    assert client.patch(path, headers={**users[user], 'If-Match': resource['version']}, json=payload).status_code == 200


def test_same_values_still_change_triage_version_and_permissions_remain_first(setup):
    client, users, episode = setup
    path = f"/episodes/{episode['id']}/triage"
    first = client.post(path, headers={**users['enfermeria'], 'If-Match': episode['triage_version']}, json=TRIAGE).json()
    second = client.post(path, headers={**users['enfermeria'], 'If-Match': first['triage_version']}, json=TRIAGE).json()
    assert first['triage_version'] != second['triage_version']
    assert client.post(path, headers={**users['medico'], 'If-Match': '"obsolete"'}, json=TRIAGE).status_code == 403
