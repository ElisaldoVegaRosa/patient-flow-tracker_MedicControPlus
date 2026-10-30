from ..input_validation import TaskTitle, TaskResult
from ..write_operations import atomic_write, transaction_factory
from ..laboratory_queue import read as read_laboratory_queue
from collections.abc import Callable
import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel


class TaskCreateRequest(BaseModel):
    title: TaskTitle
    service: Literal["NURSING", "LAB", "MEDICAL"]


class TaskResultRequest(BaseModel):
    result: TaskResult


def create_router(
    connection_factory: Callable[[], sqlite3.Connection],
    timestamp: Callable[[], str],
    detail: Callable[[sqlite3.Connection, int], dict],
    add_event: Callable[..., None],
    require_active_episode: Callable[[sqlite3.Connection, int], None],
    require_roles: Callable[..., Callable[..., dict[str, str]]],
) -> APIRouter:
    connection_factory = transaction_factory(connection_factory)
    router = APIRouter()

    @router.post("/episodes/{episode_id}/tasks", status_code=201)
    @atomic_write(connection_factory, detail)
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

        try:
            connection.execute('BEGIN')
            return read_laboratory_queue(connection, status, user['username'])
        finally:
            connection.close()

    @router.patch("/tasks/{task_id}/complete")
    @atomic_write(connection_factory, detail)
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

        if connection.execute("SELECT 1 FROM reevaluation_actions WHERE task_id=?", (task_id,)).fetchone():
            raise HTTPException(409, "Completa esta accion desde Reevaluaciones programadas, con responsable y nota")

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
