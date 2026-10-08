from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app import main


@pytest.mark.parametrize("condition", ["incorrect", "unknown", "inactive"])
def test_rejected_login_does_not_create_session(tmp_path, monkeypatch, condition) -> None:
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "rejected-login.db")
    with TestClient(main.app) as client:
        if condition == "inactive":
            connection = main.get_connection()
            try:
                connection.execute("UPDATE users SET active = 0 WHERE username = 'medico'")
                connection.commit()
            finally:
                connection.close()
        result = client.post("/auth/login", json={
            "username": "desconocido-ficticio" if condition == "unknown" else "medico",
            "password": "incorrecta-ficticia" if condition == "incorrect" else "demo123",
        })
        assert result.status_code == 401
        assert result.json() == {"detail": "Credenciales inválidas"}
        connection = main.get_connection()
        try:
            assert connection.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 0
        finally:
            connection.close()


def test_logout_revokes_only_current_persisted_session(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "independent-sessions.db")
    with TestClient(main.app) as client:
        sessions = [client.post("/auth/login", json={
            "username": "medico", "password": "demo123",
        }).json() for _ in range(2)]
        tokens = [session["access_token"] for session in sessions]
        assert tokens[0] != tokens[1]
        headers = [{"Authorization": "Bearer " + token} for token in tokens]
        connection = main.get_connection()
        try:
            rows = connection.execute("SELECT * FROM sessions ORDER BY id").fetchall()
            assert len(rows) == 2
            for row, token in zip(rows, tokens):
                assert row["token_hash"] == main.hash_session_token(token)
                assert row["token_hash"] != token
                assert datetime.fromisoformat(row["expires_at"]) - datetime.fromisoformat(row["created_at"]) == timedelta(hours=8)
                assert row["revoked_at"] is None
        finally:
            connection.close()
        for header in headers:
            assert client.get("/auth/me", headers=header).json() == {"username": "medico", "role": "DOCTOR"}
        result = client.post("/auth/logout", headers=headers[0])
        assert result.status_code == 200
        assert result.json() == {"message": "Sesión cerrada correctamente", "username": "medico"}
        assert client.get("/auth/me", headers=headers[0]).status_code == 401
        assert client.get("/auth/me", headers=headers[1]).status_code == 200
        connection = main.get_connection()
        try:
            rows = connection.execute("SELECT revoked_at FROM sessions ORDER BY id").fetchall()
            assert rows[0]["revoked_at"] is not None
            assert rows[1]["revoked_at"] is None
        finally:
            connection.close()
