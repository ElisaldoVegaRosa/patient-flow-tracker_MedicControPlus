from collections.abc import Callable
import json
import sqlite3

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field


class TriageRequest(BaseModel):
    priority: int = Field(ge=1, le=5)
    location: str
    assigned_to: str = "Enfermería"


class VitalSignsRequest(BaseModel):
    """Signos vitales con límites plausibles para el demo."""

    temperature: float = Field(ge=25, le=45)
    heart_rate: int = Field(ge=20, le=250)
    systolic: int = Field(ge=40, le=300)
    diastolic: int = Field(ge=20, le=200)
    spo2: int = Field(ge=50, le=100)
    respiratory_rate: int = Field(ge=4, le=80)


def create_router(
    connection_factory: Callable[[], sqlite3.Connection],
    timestamp: Callable[[], str],
    detail: Callable[[sqlite3.Connection, int], dict],
    add_event: Callable[..., None],
    require_active_episode: Callable[[sqlite3.Connection, int], None],
    require_roles: Callable[..., Callable[..., dict[str, str]]],
) -> APIRouter:
    router = APIRouter()

    @router.post("/episodes/{episode_id}/triage")
    def register_triage(
        episode_id: int,
        data: TriageRequest,
        user: dict[str, str] = Depends(
            require_roles("NURSE", "SUPERVISOR")
        ),
    ) -> dict:
        connection = connection_factory()
        require_active_episode(connection, episode_id)

        connection.execute(
            """
            UPDATE episodes
            SET priority = ?,
            location = ?,
            assigned_to = ?
            WHERE id = ?
            AND status = 'ACTIVE'
            """,
            (
                data.priority,
                data.location,
                data.assigned_to,
                episode_id,
            ),
        )

        add_event(
            connection,
            episode_id,
            "TRIAGE",
            user["username"],
            f"Prioridad {data.priority}; ubicación {data.location}",
        )

        connection.commit()
        result = detail(connection, episode_id)
        connection.close()

        return result


    @router.post("/episodes/{episode_id}/vitals", status_code=201)
    def register_vitals(
        episode_id: int,
        data: VitalSignsRequest,
        user: dict[str, str] = Depends(
            require_roles("NURSE", "DOCTOR")
        ),
    ) -> dict:
        connection = connection_factory()
        require_active_episode(connection, episode_id)

        connection.execute(
            """
            INSERT INTO vitals (
                episode_id,
                temperature,
                heart_rate,
                systolic,
                diastolic,
                spo2,
                respiratory_rate,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                episode_id,
                data.temperature,
                data.heart_rate,
                data.systolic,
                data.diastolic,
                data.spo2,
                data.respiratory_rate,
                timestamp(),
            ),
        )

        add_event(
            connection,
            episode_id,
            "VITALS_RECORDED",
            user["username"],
            json.dumps(data.model_dump()),
        )

        generated_alerts: list[tuple[str, str]] = []

        if data.spo2 < 92:
            generated_alerts.append(
                ("Saturación de oxígeno baja", "CRITICAL")
            )

        if data.heart_rate > 120:
            generated_alerts.append(
                ("Frecuencia cardíaca alta", "HIGH")
            )

        if data.temperature >= 39:
            generated_alerts.append(
                ("Fiebre alta", "HIGH")
            )

        for reason, severity in generated_alerts:
            existing_alert = connection.execute(
                """
                SELECT id
                FROM alerts
                WHERE episode_id = ?
                AND reason = ?
                AND status != 'RESOLVED'
                """,
                (
                    episode_id,
                    reason,
                ),
            ).fetchone()

            if existing_alert is None:
                connection.execute(
                    """
                    INSERT INTO alerts (
                        episode_id,
                        reason,
                        severity,
                        status,
                        created_at,
                        updated_at
                    )
                    VALUES (?, ?, ?, 'ACTIVE', ?, ?)
                    """,
                    (
                        episode_id,
                        reason,
                        severity,
                        timestamp(),
                        timestamp(),
                    ),
                )

                add_event(
                    connection,
                    episode_id,
                    "ALERT_CREATED",
                    "rules-engine",
                    reason,
                )

        connection.commit()
        result = detail(connection, episode_id)
        connection.close()

        return result

    return router
