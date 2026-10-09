from collections.abc import Callable
import sqlite3

from fastapi import APIRouter, Depends, HTTPException


def create_router(
    connection_factory: Callable[[], sqlite3.Connection],
    detail: Callable[[sqlite3.Connection, int], dict],
    add_event: Callable[..., None],
    authenticated_user: Callable[..., dict[str, str]],
    require_roles: Callable[..., Callable[..., dict[str, str]]],
) -> APIRouter:
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
            WHERE episodes.status = 'CLOSED'
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
