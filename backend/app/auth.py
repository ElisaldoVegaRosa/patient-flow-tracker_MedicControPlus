from collections.abc import Callable
from datetime import datetime, timezone
import sqlite3

from fastapi import HTTPException

from .security import hash_session_token


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
