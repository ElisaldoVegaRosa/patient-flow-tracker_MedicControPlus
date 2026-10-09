from collections.abc import Callable
import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel


class TaskCreateRequest(BaseModel):
    title: str
    service: Literal["NURSING", "LAB", "MEDICAL"]


class TaskResultRequest(BaseModel):
    result: str


def create_router(
    connection_factory: Callable[[], sqlite3.Connection],
    timestamp: Callable[[], str],
    detail: Callable[[sqlite3.Connection, int], dict],
    add_event: Callable[..., None],
    require_active_episode: Callable[[sqlite3.Connection, int], None],
    require_roles: Callable[..., Callable[..., dict[str, str]]],
) -> APIRouter:
    router = APIRouter()

    @router.post("/episodes/{episode_id}/tasks", status_code=201)
    def create_task(
        episode_id: int,
        data: TaskCreateRequest,
        user: dict[str, str] = Depends(require_roles("DOCTOR")),
    ) -> dict:
        connection = connection_factory()
        require_active_episode(connection, episode_id)

        connection.execute(
            """
            INSERT INTO tasks (
                episode_id,
                title,
                service,
                status,
                created_at
            )
            VALUES (?, ?, ?, 'PENDING', ?)
            """,
            (
                episode_id,
                data.title,
                data.service,
                timestamp(),
            ),
        )

        add_event(
            connection,
            episode_id,
            "TASK_CREATED",
            user["username"],
            data.title,
        )

        connection.commit()
        result = detail(connection, episode_id)
        connection.close()

        return result

    # ---------------------------------------------------------------------------
    # BANDEJA DE LABORATORIO
    # ---------------------------------------------------------------------------
    # Devuelve las órdenes asignadas a laboratorio junto con los datos operativos
    # del episodio. No expone el token QR ni datos clínicos adicionales.
    # Solo laboratorio y supervisor pueden consultar esta bandeja.
    # ---------------------------------------------------------------------------

    @router.get("/lab/orders")
    def laboratory_orders(
        status: Literal["PENDING", "COMPLETED", "ALL"] = "PENDING",
        user: dict[str, str] = Depends(
            require_roles("LAB", "SUPERVISOR")
        ),
    ) -> dict:
        connection = connection_factory()

        query = """
            SELECT
                tasks.id,
                tasks.episode_id,
                tasks.title,
                tasks.service,
                tasks.status,
                tasks.result,
                tasks.created_at,
                patients.name AS patient_name,
                episodes.priority,
                episodes.location,
                episodes.status AS episode_status
            FROM tasks
            JOIN episodes ON episodes.id = tasks.episode_id
            JOIN patients ON patients.id = episodes.patient_id
            WHERE tasks.service = 'LAB'
        """

        parameters: tuple[str, ...] = ()

        if status != "ALL":
            query += " AND tasks.status = ?"
            parameters = (status,)

        query += " ORDER BY tasks.id DESC"

        rows = connection.execute(
            query,
            parameters,
        ).fetchall()

        orders = [dict(row) for row in rows]
        connection.close()

        return {
            "status_filter": status,
            "total": len(orders),
            "orders": orders,
            "requested_by": user["username"],
        }

    @router.patch("/tasks/{task_id}/complete")
    def complete_task(
        task_id: int,
        data: TaskResultRequest,
        user: dict[str, str] = Depends(
            require_roles("NURSE", "LAB", "DOCTOR")
        ),
    ) -> dict:
        connection = connection_factory()

        task = connection.execute(
            """
            SELECT *
            FROM tasks
            WHERE id = ?
            """,
            (task_id,),
        ).fetchone()

        if task is None:
            connection.close()
            raise HTTPException(status_code=404, detail="Tarea no encontrada")

        try:
            require_active_episode(
                connection,
                task["episode_id"],
            )
        except HTTPException:
            connection.close()
            raise

        if task["status"] == "COMPLETED":
            connection.close()
            raise HTTPException(
                status_code=409,
                detail="La tarea ya está completada",
            )

        if task["service"] == "LAB" and user["role"] != "LAB":
            connection.close()
            raise HTTPException(
                status_code=403,
                detail="Esta tarea está asignada a laboratorio",
            )

        connection.execute(
            """
            UPDATE tasks
            SET status = 'COMPLETED',
                result = ?
            WHERE id = ?
            """,
            (
                data.result,
                task_id,
            ),
        )

        add_event(
            connection,
            task["episode_id"],
            "TASK_COMPLETED",
            user["username"],
            data.result,
        )

        connection.commit()
        result = detail(connection, task["episode_id"])
        connection.close()

        return result

    return router
