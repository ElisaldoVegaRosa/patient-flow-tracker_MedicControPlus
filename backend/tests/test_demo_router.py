import pytest
from fastapi.testclient import TestClient

from app import main


def test_demo_route_registered_once() -> None:
    routes = [route for route in main.app.routes if route.path == "/demo/seed"]
    assert len(routes) == 1
    assert routes[0].methods == {"POST"}
    assert routes[0].endpoint.__module__ == "app.routes.demo"


@pytest.mark.parametrize("username", ["recepcion", "enfermeria", "medico", "laboratorio", "supervisor"])
def test_demo_permissions_and_repeated_seed_preserve_data(tmp_path, monkeypatch, username) -> None:
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "demo-router.db")
    with TestClient(main.app) as client:
        assert client.post("/demo/seed").status_code == 401
        login = client.post("/auth/login", json={"username": username, "password": "demo123"})
        assert login.status_code == 200
        headers = {"Authorization": "Bearer " + login.json()["access_token"]}
        response = client.post("/demo/seed", headers=headers)
        if username != "supervisor":
            assert response.status_code == 403
            connection = main.get_connection()
            try:
                for table in ["patients", "episodes", "events", "tasks", "alerts"]:
                    assert connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] == 0
            finally:
                connection.close()
            return
        assert response.status_code == 200
        result = response.json()
        assert result["created"] > 0
        assert result["existing"] == 0
        assert len(result["episode_ids"]) == result["created"]
        assert result["requested_by"] == username
        connection = main.get_connection()
        try:
            tables = ["patients", "episodes", "events", "tasks", "alerts"]
            before = {table: [tuple(row) for row in connection.execute(f"SELECT * FROM {table} ORDER BY id")]
                      for table in tables}
            repeated = client.post("/demo/seed", headers=headers)
            assert repeated.status_code == 200
            assert repeated.json()["created"] == 0
            assert repeated.json()["existing"] == result["created"]
            after = {table: [tuple(row) for row in connection.execute(f"SELECT * FROM {table} ORDER BY id")]
                     for table in tables}
            assert after == before
        finally:
            connection.close()
