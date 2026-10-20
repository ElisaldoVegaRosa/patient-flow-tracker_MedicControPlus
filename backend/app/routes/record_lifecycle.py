"""Explicit corrections and annulments, preserving every original record."""
from collections.abc import Callable
import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator

from ..write_operations import atomic_write, transaction_factory


class Reason(BaseModel):
    reason: str = Field(min_length=3, max_length=500)

    @model_validator(mode="after")
    def valid_reason(self):
        self.reason = self.reason.strip()
        if len(self.reason) < 3:
            raise ValueError("Explica el motivo")
        return self


class Correction(Reason):
    action: Literal["CORRECT", "ANNUL"]
    value: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def valid_value(self):
        if self.action == "CORRECT" and (self.value is None or len(self.value.strip()) < 3):
            raise ValueError("Escribe el texto corregido")
        if self.action == "ANNUL" and self.value is not None:
            raise ValueError("La anulación no admite un texto nuevo")
        if self.value is not None:
            self.value = self.value.strip()
        return self


def create_router(
    connection_factory: Callable[[], sqlite3.Connection],
    timestamp: Callable[[], str],
    detail: Callable[[sqlite3.Connection, int], dict],
    add_event: Callable[..., None],
    require_roles: Callable,
) -> APIRouter:
    connection_factory = transaction_factory(connection_factory)
    router = APIRouter()

    def record(connection, episode_id, target_type, target_id, action, old_value, new_value, reason, user):
        connection.execute(
            "INSERT INTO record_changes (episode_id, target_type, target_id, action, old_value, new_value, reason, username, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (episode_id, target_type, target_id, action, old_value, new_value, reason, user["username"], timestamp()),
        )

    @router.patch("/tasks/{task_id}/result")
    @atomic_write(connection_factory, detail, require_key=True)
    def change_result(task_id: int, data: Correction, user: dict[str, str] = Depends(require_roles("LAB"))) -> dict:
        connection = connection_factory()
        task = connection.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if task is None:
            raise HTTPException(404, "Orden no encontrada")
        episode = connection.execute("SELECT status FROM episodes WHERE id = ?", (task["episode_id"],)).fetchone()
        if task["service"] != "LAB" or task["status"] != "COMPLETED" or episode["status"] == "ANNULLED":
            raise HTTPException(409, "Solo se puede corregir un resultado LAB publicado")
        if data.action == "CORRECT":
            new_status, new_value = "COMPLETED", data.value
        else:
            new_status, new_value = ("PENDING" if episode["status"] == "ACTIVE" else "ANNULLED"), None
        connection.execute("UPDATE tasks SET status = ?, result = ? WHERE id = ?",
                           (new_status, new_value, task_id))
        record(connection, task["episode_id"], "TASK", task_id, data.action,
               task["result"], new_value, data.reason, user)
        return detail(connection, task["episode_id"])

    @router.patch("/events/{event_id}/note")
    @atomic_write(connection_factory, detail, require_key=True)
    def change_note(event_id: int, data: Correction, user: dict[str, str] = Depends(require_roles("DOCTOR"))) -> dict:
        connection = connection_factory()
        event = connection.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        if event is None:
            raise HTTPException(404, "Nota no encontrada")
        episode = connection.execute("SELECT status FROM episodes WHERE id = ?", (event["episode_id"],)).fetchone()
        if event["type"] not in {"MEDICAL_EVALUATION", "DISCHARGE"} or episode["status"] == "ANNULLED":
            raise HTTPException(409, "Solo se pueden rectificar notas médicas y de alta")
        previous = connection.execute(
            "SELECT new_value, action FROM record_changes WHERE target_type = 'EVENT' AND target_id = ? ORDER BY id DESC LIMIT 1",
            (event_id,),
        ).fetchone()
        if previous and previous["action"] == "ANNUL":
            raise HTTPException(409, "La evaluación ya fue anulada")
        old_value = previous["new_value"] if previous else event["note"]
        record(connection, event["episode_id"], "EVENT", event_id, data.action,
               old_value, data.value, data.reason, user)
        return detail(connection, event["episode_id"])

    @router.post("/episodes/{episode_id}/reopen")
    @atomic_write(connection_factory, detail, require_key=True)
    def reopen(episode_id: int, data: Reason, user: dict[str, str] = Depends(require_roles("DOCTOR", "SUPERVISOR"))) -> dict:
        connection = connection_factory()
        episode = connection.execute(
            "SELECT episodes.*, patients.name, patients.birth_date, patients.document FROM episodes "
            "JOIN patients ON patients.id = episodes.patient_id WHERE episodes.id = ?", (episode_id,),
        ).fetchone()
        if episode is None:
            raise HTTPException(404, "Episodio no encontrado")
        if episode["status"] != "CLOSED":
            raise HTTPException(409, "Solo puede reabrirse un episodio dado de alta")
        candidates = connection.execute(
            "SELECT episodes.id, episodes.patient_id, patients.name, patients.birth_date, patients.document FROM episodes "
            "JOIN patients ON patients.id = episodes.patient_id WHERE episodes.status = 'ACTIVE'"
        ).fetchall()
        if any(item["patient_id"] == episode["patient_id"] or
               (item["document"] is not None and episode["document"] is not None
               and item["document"].strip() == episode["document"].strip()
               and item["birth_date"] == episode["birth_date"]
               and item["name"].strip().casefold() == episode["name"].strip().casefold()
               ) for item in candidates):
            raise HTTPException(409, "Existe otro episodio activo de la misma identidad")
        connection.execute("UPDATE episodes SET status = 'ACTIVE', closed_at = NULL WHERE id = ?", (episode_id,))
        record(connection, episode_id, "EPISODE", episode_id, "REOPEN", "CLOSED", "ACTIVE", data.reason.strip(), user)
        add_event(connection, episode_id, "EPISODE_REOPENED", user["username"], data.reason.strip())
        return detail(connection, episode_id)

    @router.post("/episodes/{episode_id}/annul")
    @atomic_write(connection_factory, detail, require_key=True)
    def annul_arrival(episode_id: int, data: Reason, user: dict[str, str] = Depends(require_roles("RECEPTION", "SUPERVISOR"))) -> dict:
        connection = connection_factory()
        episode = connection.execute("SELECT status FROM episodes WHERE id = ?", (episode_id,)).fetchone()
        if episode is None:
            raise HTTPException(404, "Episodio no encontrado")
        if episode["status"] != "ACTIVE":
            raise HTTPException(409, "Solo puede anularse un ingreso activo")
        activity = connection.execute(
            "SELECT 1 FROM events WHERE episode_id = ? AND type NOT IN ('EPISODE_CREATED', 'QR_SCANNED', 'IDENTITY_VERIFIED') "
            "UNION SELECT 1 FROM vitals WHERE episode_id = ? "
            "UNION SELECT 1 FROM tasks WHERE episode_id = ? "
            "UNION SELECT 1 FROM alerts WHERE episode_id = ? LIMIT 1",
            (episode_id,) * 4,
        ).fetchone()
        if activity:
            raise HTTPException(409, "El ingreso ya tiene actividad clínica; requiere revisión específica")
        connection.execute("UPDATE episodes SET status = 'ANNULLED', closed_at = ? WHERE id = ?",
                           (timestamp(), episode_id))
        record(connection, episode_id, "EPISODE", episode_id, "ANNUL", "ACTIVE", "ANNULLED", data.reason.strip(), user)
        add_event(connection, episode_id, "ARRIVAL_ANNULLED", user["username"], data.reason.strip())
        return detail(connection, episode_id)

    return router
