from collections.abc import Callable
import secrets
import sqlite3

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field


class EpisodeCreate(BaseModel):
    name: str
    birth_date: str
    document: str
    priority: int = Field(default=3, ge=1, le=5)
    location: str = "Recepción"


def create_router(
    connection_factory: Callable[[], sqlite3.Connection],
    timestamp: Callable[[], str],
    detail: Callable[[sqlite3.Connection, int], dict],
    add_event: Callable[..., None],
    require_roles: Callable[..., Callable[..., dict[str, str]]],
) -> APIRouter:
    router = APIRouter()

    @router.post("/episodes", status_code=201)
    def create_episode(
        data: EpisodeCreate,
        user: dict[str, str] = Depends(
            require_roles("RECEPTION", "SUPERVISOR")
        ),
    ) -> dict:
        connection = connection_factory()

        patient_cursor = connection.execute(
            """
            INSERT INTO patients (
                name,
                birth_date,
                document
            )
            VALUES (?, ?, ?)
            """,
            (
                data.name,
                data.birth_date,
                data.document,
            ),
        )

        episode_cursor = connection.execute(
            """
            INSERT INTO episodes (
                patient_id,
                qr_token,
                status,
                priority,
                location,
                started_at
            )
            VALUES (?, ?, 'ACTIVE', ?, ?, ?)
            """,
            (
                patient_cursor.lastrowid,
                secrets.token_urlsafe(24),
                data.priority,
                data.location,
                timestamp(),
            ),
        )

        episode_id = episode_cursor.lastrowid

        add_event(
            connection,
            episode_id,
            "EPISODE_CREATED",
            user["username"],
            "Ingreso registrado",
        )

        connection.commit()
        result = detail(connection, episode_id)
        connection.close()

        return result

    return router
