from collections.abc import Callable
import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel


class AlertActionRequest(BaseModel):
    status: Literal["ACKNOWLEDGED", "ESCALATED", "RESOLVED"]


ALLOWED_ALERT_TRANSITIONS: dict[str, set[str]] = {
    "ACTIVE": {
        "ACKNOWLEDGED",
        "ESCALATED",
    },
    "ACKNOWLEDGED": {
        "ESCALATED",
        "RESOLVED",
    },
    "ESCALATED": {
        "RESOLVED",
    },
    "RESOLVED": set(),
}


def create_router(
    connection_factory: Callable[[], sqlite3.Connection],
    timestamp: Callable[[], str],
    detail: Callable[[sqlite3.Connection, int], dict],
    add_event: Callable[..., None],
    require_active_episode: Callable[[sqlite3.Connection, int], None],
    require_roles: Callable[..., Callable[..., dict[str, str]]],
) -> APIRouter:
    router = APIRouter()

    @router.patch("/alerts/{alert_id}")
    def change_alert_status(
        alert_id: int,
        data: AlertActionRequest,
        user: dict[str, str] = Depends(
            require_roles("NURSE", "DOCTOR", "SUPERVISOR")
        ),
    ) -> dict:
        if (
            data.status == "RESOLVED"
            and user["role"] not in {"DOCTOR", "SUPERVISOR"}
        ):
            raise HTTPException(
                status_code=403,
                detail="Solo médico o supervisor puede resolver alertas",
            )

        connection = connection_factory()

        alert = connection.execute(
            """
            SELECT *
            FROM alerts
            WHERE id = ?
            """,
            (alert_id,),
        ).fetchone()

        if alert is None:
            connection.close()
            raise HTTPException(
                status_code=404,
                detail="Alerta no encontrada",
            )

        require_active_episode(
            connection,
            alert["episode_id"],
        )

        current_status = alert["status"]

        allowed_statuses = ALLOWED_ALERT_TRANSITIONS.get(
            current_status,
            set(),
        )

        if data.status not in allowed_statuses:
            connection.close()
            raise HTTPException(
                status_code=409,
                detail=(
                    "Transición de alerta no permitida: "
                    f"{current_status} → {data.status}"
                ),
            )


        connection.execute(
            """
            UPDATE alerts
            SET status = ?,
                responsible = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                data.status,
                user["username"],
                timestamp(),
                alert_id,
            ),
        )

        connection.execute(
            """
            INSERT INTO alert_history (
                alert_id,
                old_status,
                new_status,
                username,
                created_at
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                alert_id,
                alert["status"],
                data.status,
                user["username"],
                timestamp(),
            ),
        )

        add_event(
            connection,
            alert["episode_id"],
            f"ALERT_{data.status}",
            user["username"],
            alert["reason"],
        )

        connection.commit()
        result = detail(connection, alert["episode_id"])
        connection.close()

        return result

    return router
