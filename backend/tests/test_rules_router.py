from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app import main


def test_rules_route_registered_once() -> None:
    routes = [route for route in main.app.routes if route.path == "/rules/evaluate"]
    assert len(routes) == 1
    assert routes[0].methods == {"POST"}
    assert routes[0].endpoint.__module__ == "app.routes.rules"


@pytest.mark.parametrize("username", ["recepcion", "enfermeria", "medico", "laboratorio", "supervisor"])
def test_rules_permissions_and_empty_evaluation(tmp_path, monkeypatch, username) -> None:
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "rules-roles.db")
    with TestClient(main.app) as client:
        assert client.post("/rules/evaluate").status_code == 401
        login = client.post("/auth/login", json={"username": username, "password": "demo123"})
        assert login.status_code == 200
        headers = {"Authorization": "Bearer " + login.json()["access_token"]}
        response = client.post("/rules/evaluate", headers=headers)
        allowed = username in ["medico", "supervisor"]
        assert response.status_code == (200 if allowed else 403)
        if allowed:
            result = response.json()
            assert set(result) == {"evaluated_episodes", "generated_alerts", "evaluated_at", "requested_by"}
            assert result["evaluated_episodes"] == result["generated_alerts"] == 0
            assert result["requested_by"] == username
            assert datetime.fromisoformat(result["evaluated_at"]).utcoffset().total_seconds() == 0
        connection = main.get_connection()
        try:
            assert connection.execute("SELECT COUNT(*) FROM alerts").fetchone()[0] == 0
            assert connection.execute("SELECT COUNT(*) FROM events").fetchone()[0] == 0
        finally:
            connection.close()
