import pytest
from fastapi.testclient import TestClient

from app import main


def login(client, username):
    response = client.post("/auth/login", json={"username": username, "password": "demo123"})
    assert response.status_code == 200
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def create_episode(client):
    response = client.post("/episodes", headers=login(client, "recepcion"), json={
        "name": "Paciente Ficticio 33G", "birth_date": "1990-01-01",
        "document": "TEST-33G", "priority": 3,
    })
    assert response.status_code == 201
    return response.json()["id"]


def test_medical_routes_registered_once() -> None:
    paths = ["/episodes/{episode_id}/medical-evaluation", "/episodes/{episode_id}/discharge"]
    routes = [route for route in main.app.routes if route.path in paths]
    assert [route.path for route in routes] == paths
    assert all(route.methods == {"POST"} for route in routes)
    assert {route.endpoint.__module__ for route in routes} == {"app.routes.medical"}


@pytest.mark.parametrize("username", ["recepcion", "enfermeria", "medico", "laboratorio", "supervisor"])
def test_medical_actions_remain_doctor_only(tmp_path, monkeypatch, username) -> None:
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "medical-roles.db")
    with TestClient(main.app) as client:
        episode_id = create_episode(client)
        headers = login(client, username)
        data = {"diagnosis": "Diagnóstico ficticio", "clinical_note": "Evaluación ficticia"}
        evaluation = client.post(f"/episodes/{episode_id}/medical-evaluation", headers=headers, json=data)
        discharge = client.post(f"/episodes/{episode_id}/discharge", headers=headers, json={})
        expected = 200 if username == "medico" else 403
        assert evaluation.status_code == discharge.status_code == expected
        if username == "medico":
            event = next(event for event in evaluation.json()["events"] if event["type"] == "MEDICAL_EVALUATION")
            assert event["username"] == username
            assert event["note"] == "Diagnóstico: Diagnóstico ficticio. Evaluación: Evaluación ficticia. Decisión: CONTINUE_OBSERVATION"
            closed = discharge.json()
            assert closed["status"] == "CLOSED"
            assert closed["closed_at"]
            event = next(event for event in closed["events"] if event["type"] == "DISCHARGE")
            assert event["note"] == "Alta médica"
            assert event["username"] == username
            assert client.post(f"/episodes/{episode_id}/medical-evaluation", headers=headers, json=data).status_code == 409
            assert client.post(f"/episodes/{episode_id}/discharge", headers=headers, json={}).status_code == 409
        else:
            detail = client.get(f"/episodes/{episode_id}", headers=headers).json()
            assert detail["status"] == "ACTIVE"
            assert not any(event["type"] in ["MEDICAL_EVALUATION", "DISCHARGE"] for event in detail["events"])


def test_medical_evaluation_validation_preserved(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "medical-validation.db")
    with TestClient(main.app) as client:
        episode_id = create_episode(client)
        headers = login(client, "medico")
        for data in [{"diagnosis": "X", "clinical_note": "AB"},
                     {"diagnosis": "Diagnóstico ficticio", "clinical_note": "Nota ficticia", "disposition": "INVALID"}]:
            assert client.post(f"/episodes/{episode_id}/medical-evaluation", headers=headers, json=data).status_code == 422
        detail = client.get(f"/episodes/{episode_id}", headers=headers).json()
        assert not any(event["type"] == "MEDICAL_EVALUATION" for event in detail["events"])
