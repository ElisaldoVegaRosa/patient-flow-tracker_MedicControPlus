from concurrent.futures import ThreadPoolExecutor
import sqlite3

import pytest
from fastapi.testclient import TestClient
from app import main


class Context(tuple):
    def __repr__(self):
        return "ConsultationCorrectionContext(temporary database)"


@pytest.fixture
def flow(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "consultation-correction.db")
    with TestClient(main.app) as client:
        users = {}
        def login(name):
            if name not in users:
                token = client.post("/auth/login", json={"username": name, "password": "demo123"}).json()["access_token"]
                users[name] = {"Authorization": "Bearer " + token}
            return users[name]
        episode = client.post("/episodes", headers=login("recepcion"), json={
            "name": "Paciente ficticio correccion", "birth_date": "1990-01-01", "document": "CORRECTION-REASON",
            "consultation_reason": "Motivo original ficticio",
        }).json()
        yield Context((client, login, episode))


def headers(login, episode, key="consultation-correction-0001", user="recepcion"):
    return login(user) | {"Idempotency-Key": key, "If-Match": episode["consultation_reason_version"]}


payload = {"value": "  Motivo corregido ficticio\nSegundo renglon  ", "reason": "Error ficticio de transcripcion"}


def test_correction_preserves_original_audit_replay_and_other_versions(flow):
    client, login, episode = flow
    path = f"/episodes/{episode['id']}/consultation-reason"
    request_headers = headers(login, episode)
    result = client.patch(path, headers=request_headers, json=payload)
    assert result.status_code == 200
    corrected = result.json()
    assert corrected["consultation_reason"] == payload["value"]
    assert corrected["events"] == episode["events"]
    assert corrected["triage_version"] == episode["triage_version"]
    assert corrected["clinical_version"] != episode["clinical_version"]
    assert corrected["consultation_reason_version"] != episode["consultation_reason_version"]
    change = corrected["record_changes"][0]
    assert change == {
        "id": change["id"], "episode_id": episode["id"], "target_type": "EPISODE", "target_id": episode["id"],
        "action": "CORRECT_CONSULTATION_REASON", "old_value": episode["consultation_reason"],
        "new_value": payload["value"], "reason": payload["reason"], "username": "recepcion", "created_at": change["created_at"],
    }
    assert change["created_at"]
    assert client.patch(path, headers=request_headers, json=payload).json()["record_changes"] == [change]
    assert client.patch(path, headers=request_headers, json=payload | {"value": "Texto diferente"}).status_code == 409
    assert client.patch(path, headers=headers(login, episode, "consultation-correction-stale"), json=payload).status_code == 409
    returned = client.patch(path, headers=headers(login, corrected, "consultation-correction-return", "supervisor"),
                            json=payload | {"value": episode["consultation_reason"]})
    assert returned.status_code == 200
    assert returned.json()["consultation_reason_version"] != episode["consultation_reason_version"]
    assert returned.json()["record_changes"][0]["username"] == "supervisor"
    assert len(returned.json()["record_changes"]) == 2


def test_permissions_missing_preconditions_and_invalid_text_have_no_effects(flow):
    client, login, episode = flow
    path = f"/episodes/{episode['id']}/consultation-reason"
    assert client.patch(path, headers={"If-Match": ""}, json=payload).status_code == 401
    for name in ("medico", "enfermeria", "laboratorio", "archivo"):
        assert client.patch(path, headers=headers(login, episode, user=name), json=payload).status_code == 403
    assert client.patch(path, headers=login("recepcion") | {"If-Match": episode["consultation_reason_version"]}, json=payload).status_code == 428
    assert client.patch(path, headers=headers(login, episode) | {"If-Match": ""}, json=payload).status_code == 428
    for invalid in ("", "  ", "ab", "x" * 1001, None, 123):
        assert client.patch(path, headers=headers(login, episode), json=payload | {"value": invalid}).status_code == 422
    for invalid in ("", "   ", "ab", "x" * 2001):
        assert client.patch(path, headers=headers(login, episode), json=payload | {"reason": invalid}).status_code == 422
    assert client.patch(path, headers=headers(login, episode), json=payload | {"value": episode["consultation_reason"]}).status_code == 409
    assert client.patch("/episodes/99999/consultation-reason", headers=headers(login, episode), json=payload).status_code == 404
    latest = client.get(f"/episodes/{episode['id']}", headers=login("recepcion")).json()
    assert latest["record_changes"] == []
    assert latest["consultation_reason_version"] == episode["consultation_reason_version"]
    maximum = client.patch(path, headers=headers(login, latest), json=payload | {"value": "x" * 1000})
    assert maximum.status_code == 200
    assert maximum.json()["consultation_reason"] == "x" * 1000


@pytest.mark.parametrize("status", ["CLOSED", "ANNULLED"])
def test_closed_or_annulled_episode_cannot_be_changed(flow, status):
    client, login, episode = flow
    connection = main.get_connection()
    connection.execute("UPDATE episodes SET status=? WHERE id=?", (status, episode["id"]))
    connection.commit()
    connection.close()
    path = f"/episodes/{episode['id']}/consultation-reason"
    assert client.patch(path, headers=headers(login, episode), json=payload).status_code == 409
    latest = client.get(f"/episodes/{episode['id']}", headers=login("recepcion")).json()
    assert latest["consultation_reason"] == episode["consultation_reason"]
    assert latest["record_changes"] == []


def test_two_simultaneous_corrections_cannot_overwrite_each_other(flow):
    client, login, episode = flow
    path = f"/episodes/{episode['id']}/consultation-reason"
    intents = [headers(login, episode, f"consultation-parallel-{index:04}") for index in range(2)]
    def submit(index):
        return client.patch(path, headers=intents[index], json=payload | {"value": f"Correccion ficticia {index}"})
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(submit, range(2)))
    assert sorted(response.status_code for response in responses) == [200, 409]
    latest = client.get(f"/episodes/{episode['id']}", headers=login("recepcion")).json()
    assert len(latest["record_changes"]) == 1
    assert latest["consultation_reason"] == latest["record_changes"][0]["new_value"]


def test_missing_original_can_be_completed_and_audit_failure_rolls_back(flow):
    client, login, episode = flow
    connection = main.get_connection()
    connection.execute("UPDATE episodes SET consultation_reason=NULL WHERE id=?", (episode["id"],))
    connection.commit()
    connection.close()
    latest = client.get(f"/episodes/{episode['id']}", headers=login("recepcion")).json()
    path = f"/episodes/{episode['id']}/consultation-reason"
    corrected = client.patch(path, headers=headers(login, latest), json=payload).json()
    assert corrected["record_changes"][0]["old_value"] is None
    assert corrected["consultation_reason"] == payload["value"]
    connection = main.get_connection()
    connection.execute("CREATE TRIGGER reject_reason_audit BEFORE INSERT ON record_changes BEGIN SELECT RAISE(ABORT,'test audit failure'); END")
    connection.commit()
    connection.close()
    with pytest.raises(sqlite3.IntegrityError):
        client.patch(path, headers=headers(login, corrected, "consultation-audit-failure"), json=payload | {"value": "Otro motivo ficticio"})
    after = client.get(f"/episodes/{episode['id']}", headers=login("recepcion")).json()
    assert after == corrected
