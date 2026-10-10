import pytest
from fastapi.testclient import TestClient

from app import main


def login(client, username):
    response = client.post("/auth/login", json={"username": username, "password": "demo123"})
    assert response.status_code == 200
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def test_query_routes_registered_once_and_history_precedes_episode() -> None:
    paths = ["/episodes/history", "/episodes/{episode_id}", "/scan/{qr_token}"]
    routes = [route for route in main.app.routes if route.path in paths]
    assert [route.path for route in routes] == paths
    assert all(route.methods == {"GET"} for route in routes)
    assert {route.endpoint.__module__ for route in routes} == {"app.routes.episode_queries"}


@pytest.mark.parametrize("username", ["recepcion", "enfermeria", "medico", "laboratorio", "supervisor"])
def test_empty_history_permissions_and_missing_episode(tmp_path, monkeypatch, username) -> None:
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "queries.db")
    with TestClient(main.app) as client:
        for path in ["/episodes/history", "/episodes/999", "/scan/token-ficticio"]:
            assert client.get(path).status_code == 401
        headers = login(client, username)
        response = client.get("/episodes/history", headers=headers)
        if username in ["recepcion", "medico", "supervisor"]:
            assert response.status_code == 200
            assert response.json() == {"total": 0, "episodes": [], "requested_by": username}
        else:
            assert response.status_code == 403
        missing = client.get("/episodes/999", headers=headers)
        assert missing.status_code == 404
        assert missing.json() == {"detail": "Episodio no encontrado"}


def test_scan_records_one_event_and_rejects_closed_episode(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "scan.db")
    with TestClient(main.app) as client:
        headers = login(client, "recepcion")
        response = client.post("/episodes", headers=headers, json={
            "name": "Paciente Ficticio 33C", "birth_date": "1990-01-01",
            "document": "TEST-33C", "priority": 3,
        })
        assert response.status_code == 201
        episode = response.json()
        scanned = client.get("/scan/" + episode["qr_token"], headers=headers)
        assert scanned.status_code == 200
        assert scanned.json()["id"] == episode["id"]
        connection = main.get_connection()
        try:
            events = connection.execute(
                "SELECT username FROM events WHERE episode_id = ? AND type = 'QR_SCANNED'",
                (episode["id"],),
            ).fetchall()
            assert [event["username"] for event in events] == ["recepcion"]
            connection.execute("UPDATE episodes SET status = 'CLOSED' WHERE id = ?", (episode["id"],))
            connection.commit()
            for token in [episode["qr_token"], "token-ficticio-desconocido"]:
                rejected = client.get("/scan/" + token, headers=headers)
                assert rejected.status_code == 404
                assert rejected.json() == {"detail": "Pulsera inválida o episodio cerrado"}
            assert connection.execute(
                "SELECT COUNT(*) FROM events WHERE episode_id = ? AND type = 'QR_SCANNED'",
                (episode["id"],),
            ).fetchone()[0] == 1
        finally:
            connection.close()
