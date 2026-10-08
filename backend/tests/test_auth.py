from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app import auth, main


@pytest.mark.parametrize("state", ["valid", "expired", "revoked", "inactive", "unknown"])
def test_session_validation_preserves_status_and_revocation(tmp_path, monkeypatch, state) -> None:
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "auth-test.db")
    main.initialize_database()
    token = "token-ficticio-validacion"
    now = datetime.now(timezone.utc)
    expired = state == "expired"
    revoked_at = now.isoformat() if state == "revoked" else None
    expires_at = (now + timedelta(hours=-1 if expired else 1)).isoformat()
    connection = main.get_connection()
    try:
        user_id = connection.execute("SELECT id FROM users WHERE username = 'medico'").fetchone()[0]
        if state == "inactive":
            connection.execute("UPDATE users SET active = 0 WHERE id = ?", (user_id,))
        connection.execute(
            "INSERT INTO sessions (user_id, token_hash, created_at, expires_at, revoked_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (user_id, main.hash_session_token(token), now.isoformat(), expires_at, revoked_at),
        )
        connection.commit()
    finally:
        connection.close()

    authorization = "Bearer " + ("token-ficticio-desconocido" if state == "unknown" else token)
    if state == "valid":
        assert main.authenticated_user(authorization) == {"username": "medico", "role": "DOCTOR"}
    else:
        with pytest.raises(HTTPException) as error:
            main.authenticated_user(authorization)
        assert error.value.status_code == 401
        assert error.value.detail == {
            "expired": "Sesión expirada", "revoked": "Sesión requerida",
            "inactive": "Usuario inactivo", "unknown": "Sesión requerida",
        }[state]
    connection = main.get_connection()
    try:
        stored = connection.execute("SELECT expires_at, revoked_at FROM sessions").fetchone()
        assert stored["expires_at"] == expires_at
        if expired:
            assert stored["revoked_at"] is not None
        else:
            assert stored["revoked_at"] == revoked_at
    finally:
        connection.close()


def test_missing_session_does_not_open_database() -> None:
    def unexpected_connection():
        raise AssertionError("No debe abrir una conexión sin token")
    with pytest.raises(HTTPException) as error:
        auth.validate_session(None, unexpected_connection, main.utc_now)
    assert error.value.status_code == 401
    assert error.value.detail == "Sesión requerida"


@pytest.mark.parametrize("role", ["RECEPTION", "NURSE", "DOCTOR", "LAB", "SUPERVISOR"])
def test_role_dependency_preserves_allowed_roles(role) -> None:
    user = {"username": "usuario-ficticio", "role": role}
    dependency = main.require_roles("DOCTOR", "SUPERVISOR")
    if role in ("DOCTOR", "SUPERVISOR"):
        assert dependency(user) is user
    else:
        with pytest.raises(HTTPException) as error:
            dependency(user)
        assert error.value.status_code == 403
        assert error.value.detail == "Su rol no tiene permiso para esta acción"
