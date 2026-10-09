import pytest
from fastapi.testclient import TestClient

from app import main


VITALS = {"temperature": 39, "heart_rate": 121, "systolic": 120,
          "diastolic": 80, "spo2": 91, "respiratory_rate": 18}


def login(client, username):
    response = client.post("/auth/login", json={"username": username, "password": "demo123"})
    assert response.status_code == 200
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def create_episode(client):
    response = client.post("/episodes", headers=login(client, "recepcion"), json={
        "name": "Paciente Ficticio 33F", "birth_date": "1990-01-01",
        "document": "TEST-33F", "priority": 3,
    })
    assert response.status_code == 201
    return response.json()["id"]


def test_nursing_routes_registered_once() -> None:
    paths = ["/episodes/{episode_id}/triage", "/episodes/{episode_id}/vitals"]
    routes = [route for route in main.app.routes if route.path in paths]
    assert [route.path for route in routes] == paths
    assert all(route.methods == {"POST"} for route in routes)
    assert routes[1].status_code == 201
    assert {route.endpoint.__module__ for route in routes} == {"app.routes.nursing"}


@pytest.mark.parametrize("username", ["recepcion", "enfermeria", "medico", "laboratorio", "supervisor"])
def test_nursing_permissions_remain_distinct(tmp_path, monkeypatch, username) -> None:
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "nursing-roles.db")
    with TestClient(main.app) as client:
        episode_id = create_episode(client)
        headers = login(client, username)
        triage = client.post(f"/episodes/{episode_id}/triage", headers=headers,
                             json={"priority": 2, "location": "Observación"})
        assert triage.status_code == (200 if username in ["enfermeria", "supervisor"] else 403)
        vitals = client.post(f"/episodes/{episode_id}/vitals", headers=headers, json=VITALS)
        assert vitals.status_code == (201 if username in ["enfermeria", "medico"] else 403)


def test_vital_thresholds_and_repeated_alerts(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "nursing-alerts.db")
    with TestClient(main.app) as client:
        episode_id = create_episode(client)
        headers = login(client, "enfermeria")
        path = f"/episodes/{episode_id}/vitals"
        normal = dict(VITALS, temperature=38.9, heart_rate=120, spo2=92)
        response = client.post(path, headers=headers, json=normal)
        assert response.status_code == 201
        assert response.json()["alerts"] == []
        for _ in range(2):
            response = client.post(path, headers=headers, json=VITALS)
            assert response.status_code == 201
        result = response.json()
        assert {(alert["reason"], alert["severity"]) for alert in result["alerts"]} == {
            ("Saturación de oxígeno baja", "CRITICAL"),
            ("Frecuencia cardíaca alta", "HIGH"), ("Fiebre alta", "HIGH"),
        }
        assert len(result["alerts"]) == 3
        assert sum(event["type"] == "ALERT_CREATED" for event in result["events"]) == 3
        assert sum(event["type"] == "VITALS_RECORDED" for event in result["events"]) == 3
