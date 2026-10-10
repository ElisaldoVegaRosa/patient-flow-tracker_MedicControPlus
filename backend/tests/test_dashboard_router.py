import pytest
from fastapi.testclient import TestClient

from app import main


def test_dashboard_routes_registered_once() -> None:
    paths = {"/dashboard", "/supervisor/dashboard"}
    routes = [route for route in main.app.routes if route.path in paths]
    assert len(routes) == 2
    assert all(route.methods == {"GET"} for route in routes)
    assert {route.endpoint.__module__ for route in routes} == {"app.routes.dashboard"}


@pytest.mark.parametrize("username", ["recepcion", "enfermeria", "medico", "laboratorio", "supervisor"])
def test_dashboard_access_and_empty_response(tmp_path, monkeypatch, username) -> None:
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "dashboard.db")
    with TestClient(main.app) as client:
        assert client.get("/dashboard").status_code == 401
        assert client.get("/supervisor/dashboard").status_code == 401
        login = client.post("/auth/login", json={"username": username, "password": "demo123"})
        assert login.status_code == 200
        headers = {"Authorization": "Bearer " + login.json()["access_token"]}
        response = client.get("/dashboard", headers=headers)
        assert response.status_code == 200
        assert response.json() == {
            "active": 0, "open_alerts": 0, "patients": [], "requested_by": username,
        }
        supervisor = client.get("/supervisor/dashboard", headers=headers)
        if username != "supervisor":
            assert supervisor.status_code == 403
        else:
            assert supervisor.status_code == 200
            result = supervisor.json()
            assert result["patients"] == []
            assert result["metrics"] == {
                "active_patients": 0, "high_priority_patients": 0,
                "patients_at_risk": 0, "open_alerts": 0, "pending_tasks": 0,
            }
            assert result["rules"] == {"evaluated_episodes": 0, "generated_alerts": 0}
            assert result["requested_by"] == username
            assert result["generated_at"]
