"""Archive verifies provisional identity without moving any clinical record."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..input_validation import Name, Document, BirthDate, ClinicalNote
from ..patient_identity import find_candidates, snapshot
from ..write_operations import atomic_write, transaction_factory


class VerifyIdentity(BaseModel):
    name: Name
    birth_date: BirthDate
    document: Document
    reason: ClinicalNote
    verification_source: ClinicalNote


def create_router(connection_factory, timestamp, detail, add_event, require_roles):
    connection_factory = transaction_factory(connection_factory)
    router = APIRouter()

    @router.get("/identity/pending")
    def pending(user: dict = Depends(require_roles("ADMISSION", "SUPERVISOR"))):
        connection = connection_factory()
        try:
            patients = [dict(row) for row in connection.execute(
                """SELECT patients.id AS patient_id, patients.name, patients.birth_date,
                patients.document, (SELECT id FROM episodes WHERE patient_id = patients.id
                  ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END, id DESC LIMIT 1) AS episode_id
                FROM patients WHERE identity_status = 'PROVISIONAL' ORDER BY patients.id"""
            )]
            return {"patients": patients, "total": len(patients), "requested_by": user["username"]}
        finally:
            connection.close()

    @router.patch("/episodes/{episode_id}/identity")
    @atomic_write(connection_factory, detail, require_key=True)
    def verify(episode_id: int, data: VerifyIdentity,
               user: dict = Depends(require_roles("ADMISSION"))):
        connection = connection_factory()
        episode = detail(connection, episode_id)
        patient = connection.execute("SELECT * FROM patients WHERE id = ?", (episode["patient_id"],)).fetchone()
        if patient["identity_status"] != "PROVISIONAL":
            raise HTTPException(409, "La identidad ya no es provisional. Consulta los datos vigentes.")
        candidates = find_candidates(connection, data.document, data.name, data.birth_date, patient["id"])
        if candidates:
            raise HTTPException(409, {"code": "identity_requires_review",
                "message": "Hay otra ficha posiblemente relacionada. Admisión/archivo debe revisarla; no se fusionó ni modificó ninguna ficha."})
        old_value = snapshot(patient)
        connection.execute(
            """UPDATE patients SET name = ?, birth_date = ?, document = ?,
            identity_status = 'VERIFIED', identity_revision = identity_revision + 1 WHERE id = ?""",
            (data.name, data.birth_date, data.document, patient["id"]),
        )
        updated = connection.execute("SELECT * FROM patients WHERE id = ?", (patient["id"],)).fetchone()
        connection.execute(
            """INSERT INTO patient_identity_changes
            (patient_id, episode_id, old_value, new_value, reason, verification_source, username, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (patient["id"], episode_id, old_value, snapshot(updated), data.reason,
             data.verification_source, user["username"], timestamp()),
        )
        add_event(connection, episode_id, "IDENTITY_VERIFIED", user["username"], "Identidad verificada por admisión/archivo")
        return detail(connection, episode_id)

    return router
