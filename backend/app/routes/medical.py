from collections.abc import Callable
import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field


class MedicalEvaluationRequest(BaseModel):
    clinical_note: str = Field(min_length=3, max_length=2000)
    diagnosis: str = Field(min_length=2, max_length=500)
    disposition: Literal[
        "CONTINUE_OBSERVATION",
        "ORDER_TESTS",
        "READY_FOR_DISCHARGE",
    ] = "CONTINUE_OBSERVATION"

class DischargeRequest(BaseModel):
    note: str = "Alta médica"


def create_router(
    connection_factory: Callable[[], sqlite3.Connection],
    timestamp: Callable[[], str],
    detail: Callable[[sqlite3.Connection, int], dict],
    add_event: Callable[..., None],
    require_active_episode: Callable[[sqlite3.Connection, int], None],
    require_roles: Callable[..., Callable[..., dict[str, str]]],
) -> APIRouter:
    router = APIRouter()

    @router.post("/episodes/{episode_id}/medical-evaluation")
    def register_medical_evaluation(
        episode_id: int,
        data: MedicalEvaluationRequest,
        user: dict[str, str] = Depends(require_roles("DOCTOR")),
    ) -> dict:
        connection = connection_factory()

        episode = connection.execute(
            """
            SELECT id, status
            FROM episodes
            WHERE id = ?
            """,
            (episode_id,),
        ).fetchone()

        if episode is None:
            connection.close()
            raise HTTPException(
                status_code=404,
                detail="Episodio no encontrado",
            )

        if episode["status"] != "ACTIVE":
            connection.close()
            raise HTTPException(
                status_code=409,
                detail="No se puede evaluar un episodio cerrado",
            )

        note = (
            f"Diagnóstico: {data.diagnosis}. "
            f"Evaluación: {data.clinical_note}. "
            f"Decisión: {data.disposition}"
        )

        add_event(
            connection,
            episode_id,
            "MEDICAL_EVALUATION",
            user["username"],
            note,
        )

        connection.commit()
        result = detail(connection, episode_id)
        connection.close()

        return result

    @router.post("/episodes/{episode_id}/discharge")
    def discharge_episode(
        episode_id: int,
        data: DischargeRequest,
        user: dict[str, str] = Depends(require_roles("DOCTOR")),
    ) -> dict:
        connection = connection_factory()
        require_active_episode(connection, episode_id)

        connection.execute(
            """
            UPDATE episodes
            SET status = 'CLOSED',
            closed_at = ?
            WHERE id = ?
            AND status = 'ACTIVE'
            """,
            (
                timestamp(),
                episode_id,
            ),
        )

        add_event(
            connection,
            episode_id,
            "DISCHARGE",
            user["username"],
            data.note,
        )

        connection.commit()
        result = detail(connection, episode_id)
        connection.close()

        return result

    return router
