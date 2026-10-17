from ..input_validation import Name, Document, Location, BirthDate
from ..write_operations import atomic_write, transaction_factory
from collections.abc import Callable
import secrets
import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_serializer


class EpisodeCreate(BaseModel):
    name: Name
    birth_date: BirthDate
    document: Document
    priority: int = Field(default=3, ge=1, le=5)
    location: Location = "Recepción"
    patient_id: int | None = Field(default=None, gt=0)

    @model_serializer(mode="wrap")
    def serialize_intent(self, handler):
        # Preserve fingerprints of admission receipts issued before patient selection.
        result = handler(self)
        if self.patient_id is None:
            result.pop("patient_id", None)
        return result


def create_router(
    connection_factory: Callable[[], sqlite3.Connection],
    timestamp: Callable[[], str],
    detail: Callable[[sqlite3.Connection, int], dict],
    add_event: Callable[..., None],
    require_roles: Callable[..., Callable[..., dict[str, str]]],
) -> APIRouter:
    connection_factory = transaction_factory(connection_factory)
    router = APIRouter()

    @router.post("/episodes", status_code=201)
    @atomic_write(connection_factory, detail)
    def create_episode(
        data: EpisodeCreate,
        user: dict[str, str] = Depends(
            require_roles("RECEPTION", "SUPERVISOR")
        ),
    ) -> dict:
        connection = connection_factory()

        # atomic_write holds BEGIN IMMEDIATE across lookup, selection and insertion.
        # Documents compare exactly after outer whitespace; names ignore case and
        # outer whitespace only. Stored identities are never normalized or merged.
        connection.create_function("admission_document", 1, lambda value: value.strip(), deterministic=True)
        patients = connection.execute(
            "SELECT id, name, birth_date, document FROM patients WHERE admission_document(document) = ? ORDER BY id",
            (data.document.strip(),),
        ).fetchall()
        candidates = []
        for patient in patients:
            matches = (patient["name"].strip().casefold() == data.name.strip().casefold()
                       and patient["birth_date"] == data.birth_date)
            active = connection.execute(
                "SELECT id FROM episodes WHERE patient_id = ? AND status = 'ACTIVE' ORDER BY id",
                (patient["id"],),
            ).fetchall()
            candidates.append(dict(patient) | {
                "matches": matches,
                "active_episode_ids": [row["id"] for row in active],
            })
        selected = next((item for item in candidates if item["id"] == data.patient_id), None)
        active_match = any(item["matches"] and item["active_episode_ids"] for item in candidates)
        if (candidates and (selected is None or not selected["matches"] or active_match)) or (
            data.patient_id is not None and selected is None
        ):
            raise HTTPException(status_code=409, detail={
                "code": "patient_identity_review",
                "message": "Revisa la identidad y los episodios existentes antes de registrar el ingreso.",
                "candidates": candidates,
            })
        if selected:
            patient_id = selected["id"]
        else:
            patient_id = connection.execute(
                "INSERT INTO patients (name, birth_date, document) VALUES (?, ?, ?)",
                (data.name, data.birth_date, data.document),
            ).lastrowid

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
                patient_id,
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
