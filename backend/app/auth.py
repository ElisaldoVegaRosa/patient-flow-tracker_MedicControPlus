from collections.abc import Callable
from datetime import datetime, timedelta, timezone
import sqlite3
import secrets

from fastapi import HTTPException

from .security import hash_session_token, verify_password
from .config import SESSION_DURATION_HOURS


def validate_session(
    authorization: str | None,
    connection_factory: Callable[[], sqlite3.Connection],
    timestamp: Callable[[], str],
) -> dict[str, str]:
    token = (authorization or "").removeprefix("Bearer ")

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Sesión requerida",
        )

    connection = connection_factory()

    session = connection.execute(
        """
        SELECT
            sessions.id AS session_id,
            sessions.expires_at,
            users.username,
            users.role,
            users.active
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token_hash = ?
        AND sessions.revoked_at IS NULL
        """,
        (hash_session_token(token),),
    ).fetchone()

    if session is None:
        connection.close()
        raise HTTPException(
            status_code=401,
            detail="Sesión requerida",
        )

    expires_at = datetime.fromisoformat(
        session["expires_at"]
    )

    if expires_at <= datetime.now(timezone.utc):
        connection.execute(
            """
            UPDATE sessions
            SET revoked_at = ?
            WHERE id = ?
            """,
            (
                timestamp(),
                session["session_id"],
            ),
        )
        connection.commit()
        connection.close()

        raise HTTPException(
            status_code=401,
            detail="Sesión expirada",
        )

    if session["active"] != 1:
        connection.close()
        raise HTTPException(
            status_code=401,
            detail="Usuario inactivo",
        )

    user = {
        "username": session["username"],
        "role": session["role"],
    }

    connection.close()

    return user


def authorize_role(user: dict[str, str], allowed_roles: tuple[str, ...]) -> dict[str, str]:
    if user["role"] not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="Su rol no tiene permiso para esta acción",
        )
    return user


def login(
    username: str,
    password: str,
    connection_factory: Callable[[], sqlite3.Connection],
) -> dict[str, str]:
    connection = connection_factory()

    user = connection.execute(
        """
        SELECT
            id,
            username,
            password_hash,
            password_salt,
            role,
            active
        FROM users
        WHERE username = ?
        """,
        (username,),
    ).fetchone()

    credentials_are_valid = (
        user is not None
        and user["active"] == 1
        and verify_password(
            password,
            user["password_salt"],
            user["password_hash"],
        )
    )

    if not credentials_are_valid:
        connection.close()
        raise HTTPException(
            status_code=401,
            detail="Credenciales inválidas",
        )

    token = secrets.token_urlsafe(32)
    created_at = datetime.now(timezone.utc)
    expires_at = created_at + timedelta(
        hours=SESSION_DURATION_HOURS
    )

    connection.execute(
        """
        INSERT INTO sessions (
            user_id,
            token_hash,
            created_at,
            expires_at,
            revoked_at
        )
        VALUES (?, ?, ?, ?, NULL)
        """,
        (
            user["id"],
            hash_session_token(token),
            created_at.isoformat(),
            expires_at.isoformat(),
        ),
    )

    connection.commit()
    connection.close()

    return {
        "access_token": token,
        "username": user["username"],
        "role": user["role"],
    }


def session_user(user: dict[str, str]) -> dict[str, str]:
    return {"username": user["username"], "role": user["role"]}


def logout(
    authorization: str | None,
    user: dict[str, str],
    connection_factory: Callable[[], sqlite3.Connection],
    timestamp: Callable[[], str],
) -> dict[str, str]:
    token = (authorization or "").removeprefix("Bearer ")
    connection = connection_factory()

    connection.execute(
        """
        UPDATE sessions
        SET revoked_at = ?
        WHERE token_hash = ?
        AND revoked_at IS NULL
        """,
        (
            timestamp(),
            hash_session_token(token),
        ),
    )

    connection.commit()
    connection.close()

    return {
        "message": "Sesión cerrada correctamente",
        "username": user["username"],
    }
