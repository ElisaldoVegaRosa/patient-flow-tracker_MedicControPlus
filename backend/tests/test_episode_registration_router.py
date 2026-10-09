import pytest
from fastapi.testclient import TestClient

from app import main


def login(client, username):
    response = client.post("/auth/login", json={"username": username, "password": "demo123"})
    assert response.status_code == 200
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def patient(document):
    return {"name": "Paciente Ficticio 33H", "birth_date": "1990-01-01", "document": document}


def test_registration_route_registered_once() -> None:
    routes = [route for route in main.app.routes if route.path == "/episodes"]
    assert len(routes) == 1
    assert routes[0].methods == {"POST"}
    assert routes[0].status_code == 201
    assert routes[0].endpoint.__module__ == "app.routes.episode_registration"


@pytest.mark.parametrize("username", ["recepcion", "enfermeria", "medico", "laboratorio", "supervisor"])
def test_registration_permissions_defaults_and_persistence(tmp_path, monkeypatch, username) -> None:
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "registration.db")
    with TestClient(main.app) as client:
        data = patient("TEST-33H")
        assert client.post("/episodes", json=data).status_code == 401
        headers = login(client, username)
        response = client.post("/episodes", headers=headers, json=data)
        allowed = username in ["recepcion", "supervisor"]
        assert response.status_code == (201 if allowed else 403)
        connection = main.get_connection()
        try:
            assert connection.execute("SELECT COUNT(*) FROM patients").fetchone()[0] == int(allowed)
            assert connection.execute("SELECT COUNT(*) FROM episodes").fetchone()[0] == int(allowed)
            assert connection.execute("SELECT COUNT(*) FROM events").fetchone()[0] == int(allowed)
            if allowed:
                episode = response.json()
                assert episode["status"] == "ACTIVE"
                assert episode["priority"] == 3
                assert episode["location"] == "Recepción"
                assert episode["qr_token"]
                assert episode["started_at"]
                assert episode["closed_at"] is None
                event = episode["events"][0]
                assert event["type"] == "EPISODE_CREATED"
                assert event["username"] == username
                assert event["note"] == "Ingreso registrado"
                stored = connection.execute("SELECT patient_id, qr_token FROM episodes WHERE id = ?", (episode["id"],)).fetchone()
                assert stored["qr_token"] == episode["qr_token"]
                assert connection.execute("SELECT document FROM patients WHERE id = ?", (stored["patient_id"],)).fetchone()[0] == data["document"]
        finally:
            connection.close()


def test_registration_priority_validation_and_unique_qr(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "registration-validation.db")
    with TestClient(main.app) as client:
        headers = login(client, "recepcion")
        for priority in [0, 6]:
            assert client.post("/episodes", headers=headers, json=dict(patient("INVALID"), priority=priority)).status_code == 422
        episodes = []
        for number in range(2):
            response = client.post("/episodes", headers=headers, json=patient(f"TEST-33H-{number}"))
            assert response.status_code == 201
            episodes.append(response.json())
        assert episodes[0]["id"] != episodes[1]["id"]
        assert episodes[0]["qr_token"] != episodes[1]["qr_token"]
        connection = main.get_connection()
        try:
            assert connection.execute("SELECT COUNT(*) FROM patients").fetchone()[0] == 2
            assert connection.execute("SELECT COUNT(*) FROM episodes").fetchone()[0] == 2
        finally:
            connection.close()
