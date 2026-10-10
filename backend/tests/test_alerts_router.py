import pytest
from fastapi.testclient import TestClient

from app import main
from app.routes import alerts


def login(client, username):
    response = client.post("/auth/login", json={"username": username, "password": "demo123"})
    assert response.status_code == 200
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def create_alert(client):
    response = client.post("/episodes", headers=login(client, "recepcion"), json={
        "name": "Paciente Ficticio 33E", "birth_date": "1990-01-01",
        "document": "TEST-33E", "priority": 3,
    })
    assert response.status_code == 201
    episode_id = response.json()["id"]
    connection = main.get_connection()
    try:
        main.create_alert_if_missing(connection, episode_id, "Motivo ficticio", "HIGH")
        connection.commit()
        alert_id = connection.execute("SELECT id FROM alerts WHERE episode_id = ?", (episode_id,)).fetchone()[0]
    finally:
        connection.close()
    return episode_id, alert_id


def test_alert_route_registered_once_and_matrix_remains_available() -> None:
    routes = [route for route in main.app.routes if route.path == "/alerts/{alert_id}"]
    assert len(routes) == 1
    assert routes[0].methods == {"PATCH"}
    assert routes[0].endpoint.__module__ == "app.routes.alerts"
    assert main.ALLOWED_ALERT_TRANSITIONS is alerts.ALLOWED_ALERT_TRANSITIONS


@pytest.mark.parametrize("username", ["recepcion", "enfermeria", "medico", "laboratorio", "supervisor"])
def test_alert_role_permissions_and_history(tmp_path, monkeypatch, username) -> None:
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "alert-roles.db")
    with TestClient(main.app) as client:
        episode_id, alert_id = create_alert(client)
        path = f"/alerts/{alert_id}"
        assert client.patch(path, json={"status": "ACKNOWLEDGED"}).status_code == 401
        headers = login(client, username)
        response = client.patch(path, headers=headers, json={"status": "ACKNOWLEDGED"})
        allowed = username in ["enfermeria", "medico", "supervisor"]
        assert response.status_code == (200 if allowed else 403)
        resolved = client.patch(path, headers=headers, json={"status": "RESOLVED"})
        can_resolve = username in ["medico", "supervisor"]
        assert resolved.status_code == (200 if can_resolve else 403)
        connection = main.get_connection()
        try:
            history = connection.execute("SELECT new_status, username FROM alert_history WHERE alert_id = ? ORDER BY id", (alert_id,)).fetchall()
            expected = (["ACKNOWLEDGED"] if allowed else []) + (["RESOLVED"] if can_resolve else [])
            assert [row["new_status"] for row in history] == expected
            assert all(row["username"] == username for row in history)
            events = connection.execute("SELECT type FROM events WHERE episode_id = ? AND type IN ('ALERT_ACKNOWLEDGED', 'ALERT_RESOLVED') ORDER BY id", (episode_id,)).fetchall()
            assert [row["type"] for row in events] == ["ALERT_" + status for status in expected]
        finally:
            connection.close()


def test_closed_episode_rejects_alert_change_without_mutation(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "alert-closed.db")
    with TestClient(main.app) as client:
        episode_id, alert_id = create_alert(client)
        connection = main.get_connection()
        try:
            connection.execute("UPDATE episodes SET status = 'CLOSED' WHERE id = ?", (episode_id,))
            connection.commit()
            before = tuple(connection.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,)).fetchone())
            count = connection.execute("SELECT COUNT(*) FROM events WHERE episode_id = ?", (episode_id,)).fetchone()[0]
            response = client.patch(f"/alerts/{alert_id}", headers=login(client, "medico"), json={"status": "ACKNOWLEDGED"})
            assert response.status_code == 409
            assert tuple(connection.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,)).fetchone()) == before
            assert connection.execute("SELECT COUNT(*) FROM alert_history WHERE alert_id = ?", (alert_id,)).fetchone()[0] == 0
            assert connection.execute("SELECT COUNT(*) FROM events WHERE episode_id = ?", (episode_id,)).fetchone()[0] == count
        finally:
            connection.close()
