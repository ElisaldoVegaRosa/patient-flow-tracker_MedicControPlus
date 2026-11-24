"""Admission reason belongs to an episode, including receipts and later reads."""
import pytest
from fastapi.testclient import TestClient

from app import main


class AdmissionContext(tuple):
    def __repr__(self):
        return "AdmissionContext(temporary database)"


@pytest.fixture
def admission(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "consultation-reason.db")
    with TestClient(main.app) as client:
        token = client.post("/auth/login", json={"username": "recepcion", "password": "demo123"}).json()["access_token"]
        yield AdmissionContext((client, {"Authorization": "Bearer " + token}))


def patient(document):
    return {"name": "Paciente motivo ficticio", "birth_date": "1990-01-01", "document": document}


def test_reason_is_stored_audited_and_replayed_without_duplicate(admission):
    client, headers = admission
    headers = headers | {"Idempotency-Key": "consultation-reason-original-01"}
    reason = "  Motivo referido por el paciente\nTexto ficticio, sin diagnóstico.  "
    payload = patient("REASON-001") | {"consultation_reason": reason}
    created = client.post("/episodes", headers=headers, json=payload)
    assert created.status_code == 201
    episode = created.json()
    assert episode["consultation_reason"] == reason
    assert episode["events"][0]["note"] == "Ingreso registrado\nMotivo de consulta: " + reason
    assert client.get(f"/episodes/{episode['id']}", headers=headers).json()["consultation_reason"] == reason
    replay = client.post("/episodes", headers=headers, json=payload)
    assert replay.status_code == 201
    assert replay.json()["id"] == episode["id"]
    assert client.post("/episodes", headers=headers, json=payload | {"consultation_reason": "Otra intención ficticia"}).status_code == 409
    connection = main.get_connection()
    try:
        assert connection.execute("SELECT consultation_reason FROM episodes").fetchone()[0] == reason
        assert connection.execute("SELECT COUNT(*) FROM events").fetchone()[0] == 1
        connection.execute("UPDATE episodes SET status='CLOSED' WHERE id=?", (episode["id"],))
        connection.commit()
    finally:
        connection.close()
    doctor = client.post("/auth/login", json={"username": "medico", "password": "demo123"}).json()["access_token"]
    read = client.get(f"/episodes/{episode['id']}", headers={"Authorization": "Bearer " + doctor})
    assert read.status_code == 200
    assert read.json()["consultation_reason"] == reason
    # The same patient can return with a different reason in another episode.
    second_headers = {key: value for key, value in headers.items() if key != "Idempotency-Key"}
    second = client.post("/episodes", headers=second_headers, json=payload | {
        "patient_id": episode["patient_id"], "consultation_reason": "Motivo de otro episodio ficticio",
    })
    assert second.status_code == 201
    assert second.json()["patient_id"] == episode["patient_id"]
    assert second.json()["id"] != episode["id"]
    assert second.json()["consultation_reason"] == "Motivo de otro episodio ficticio"
    assert client.get(f"/episodes/{episode['id']}", headers=headers).json()["consultation_reason"] == reason


def test_reason_optional_validation_and_provisional_admission(admission):
    client, headers = admission
    for number, extra in enumerate([{}, {"consultation_reason": None}]):
        result = client.post("/episodes", headers=headers, json=patient(f"REASON-EMPTY-{number}") | extra)
        assert result.status_code == 201
        assert result.json()["consultation_reason"] is None
        assert result.json()["events"][0]["note"] == "Ingreso registrado"
    for invalid in ["", "  ", "\n\t ", "ab", "x" * 1001, 123]:
        rejected = client.post("/episodes", headers=headers, json=patient("REASON-INVALID") | {"consultation_reason": invalid})
        assert rejected.status_code == 422
    provisional = client.post("/episodes", headers=headers, json={"provisional": True, "consultation_reason": "x" * 1000})
    assert provisional.status_code == 201
    assert provisional.json()["consultation_reason"] == "x" * 1000
    connection = main.get_connection()
    try:
        assert connection.execute("SELECT COUNT(*) FROM patients").fetchone()[0] == 3
        assert connection.execute("SELECT COUNT(*) FROM episodes").fetchone()[0] == 3
    finally:
        connection.close()
