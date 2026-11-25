from ..write_operations import atomic_write, transaction_factory
from collections.abc import Callable
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Path, Query


def create_router(
    connection_factory: Callable[[], sqlite3.Connection],
    detail: Callable[[sqlite3.Connection, int], dict],
    add_event: Callable[..., None],
    authenticated_user: Callable[..., dict[str, str]],
    require_roles: Callable[..., Callable[..., dict[str, str]]],
) -> APIRouter:
    connection_factory = transaction_factory(connection_factory)
    router = APIRouter()

    @router.get("/episodes/history")
    def episode_history(
        user: dict[str, str] = Depends(
            require_roles(
                "RECEPTION",
                "DOCTOR",
                "SUPERVISOR",
            )
        ),
    ) -> dict:
        connection = connection_factory()

        rows = connection.execute(
            """
            SELECT
                episodes.id,
                episodes.status,
                episodes.priority,
                episodes.location,
                episodes.assigned_to,
                episodes.started_at,
                episodes.closed_at,
                patients.name,
                patients.birth_date,
                patients.document,
                patients.identity_status,
                (
                    SELECT COUNT(*)
                    FROM events
                    WHERE events.episode_id = episodes.id
                ) AS event_count,
                (
                    SELECT COUNT(*)
                    FROM alerts
                    WHERE alerts.episode_id = episodes.id
                ) AS alert_count,
                (
                    SELECT COUNT(*)
                    FROM tasks
                    WHERE tasks.episode_id = episodes.id
                ) AS task_count
            FROM episodes
            JOIN patients ON patients.id = episodes.patient_id
            WHERE episodes.status IN ('CLOSED', 'ANNULLED')
            ORDER BY episodes.closed_at DESC, episodes.id DESC
            """
        ).fetchall()

        episodes = [dict(row) for row in rows]
        connection.close()

        return {
            "total": len(episodes),
            "episodes": episodes,
            "requested_by": user["username"],
        }

    @router.get("/episodes/{episode_id}/patient-history")
    def patient_history(
        episode_id: int = Path(ge=1, le=2**63 - 1),
        limit: int = Query(default=10, ge=1, le=50),
        offset: int = Query(default=0, ge=0, le=2**31 - 1),
        user: dict[str, str] = Depends(require_roles("RECEPTION", "DOCTOR", "SUPERVISOR")),
    ) -> dict:
        connection = connection_factory()
        try:
            # A read snapshot keeps the patient, total and page consistent.
            connection.execute("BEGIN")
            source = connection.execute("SELECT patient_id FROM episodes WHERE id = ?", (episode_id,)).fetchone()
            if source is None:
                raise HTTPException(404, "Episodio no encontrado")
            patient_id = source["patient_id"]
            parameters = (patient_id, episode_id)
            total = connection.execute(
                "SELECT COUNT(*) FROM episodes WHERE patient_id = ? AND id != ? AND status IN ('CLOSED', 'ANNULLED')",
                parameters,
            ).fetchone()[0]
            rows = connection.execute(
                """
                SELECT id, status, priority, location, started_at, closed_at, consultation_reason
                FROM episodes
                WHERE patient_id = ? AND id != ? AND status IN ('CLOSED', 'ANNULLED')
                ORDER BY started_at DESC, id DESC
                LIMIT ? OFFSET ?
                """,
                (*parameters, limit, offset),
            ).fetchall()
            return {
                "source_episode_id": episode_id, "patient_id": patient_id, "total": total,
                "limit": limit, "offset": offset, "episodes": [dict(row) for row in rows],
                "requested_by": user["username"],
            }
        finally:
            connection.close()

    @router.get("/episodes/{episode_id}")
    def get_episode(
        episode_id: int,
        user: dict[str, str] = Depends(authenticated_user),
    ) -> dict:
        connection = connection_factory()
        result = detail(connection, episode_id)
        connection.close()
        return result


    @router.get("/scan/{qr_token}")
    @atomic_write(connection_factory, detail)
    def scan_qr(
        qr_token: str,
        user: dict[str, str] = Depends(authenticated_user),
    ) -> dict:
        connection = connection_factory()

        episode = connection.execute(
            """
            SELECT id
            FROM episodes
            WHERE qr_token = ?
            AND status = 'ACTIVE'
            """,
            (qr_token,),
        ).fetchone()

        if episode is None:
            connection.close()
            raise HTTPException(
                status_code=404,
                detail="Pulsera inválida o episodio cerrado",
            )

        add_event(
            connection,
            episode["id"],
            "QR_SCANNED",
            user["username"],
        )

        connection.commit()
        result = detail(connection, episode["id"])
        connection.close()

        return result

    return router
