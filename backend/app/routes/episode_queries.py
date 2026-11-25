from ..write_operations import atomic_write, transaction_factory
from collections.abc import Callable
import sqlite3
import re
import unicodedata
from datetime import date
from typing import Literal

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
        q: str = Query(default="", max_length=100),
        status: Literal["CLOSED", "ANNULLED"] | None = Query(default=None),
        closed_from: date | None = Query(default=None),
        closed_to: date | None = Query(default=None),
        limit: int = Query(default=20, ge=1, le=50),
        offset: int = Query(default=0, ge=0, le=2**31 - 1),
        user: dict[str, str] = Depends(
            require_roles(
                "RECEPTION",
                "DOCTOR",
                "SUPERVISOR",
            )
        ),
    ) -> dict:
        if closed_from and closed_to and closed_from > closed_to:
            raise HTTPException(status_code=422, detail="La fecha final debe ser posterior o igual a la inicial")

        def normalize(value):
            text = unicodedata.normalize("NFD", value or "")
            return " ".join("".join(c for c in text if not unicodedata.combining(c)).casefold().split())

        query = normalize(q)
        clauses = ["episodes.status IN ('CLOSED', 'ANNULLED')"]
        parameters: list = []
        if status:
            clauses.append("episodes.status = ?")
            parameters.append(status)
        # SQLite parses UTC offsets before applying Dominican civil time (UTC-4).
        for value, operator in [(closed_from, ">="), (closed_to, "<=")]:
            if value:
                clauses.append(f"date(episodes.closed_at, '-4 hours') {operator} ?")
                parameters.append(value.isoformat())
        episode = re.fullmatch(r"ep\s*-?\s*([0-9]+)", query)
        if episode:
            clauses.append("CAST(episodes.id AS TEXT) = ?")
            parameters.append(episode[1].lstrip("0") or "0")
        elif query:
            # instr treats %, _ and quotes literally; all values stay bound.
            name_words = " AND ".join("instr(history_normalize(patients.name), ?) > 0" for _ in query.split())
            condition = f"(({name_words}) OR instr(history_normalize(patients.document), ?) > 0"
            parameters.extend(query.split())
            parameters.append(query)
            if query.isascii() and query.isdigit():
                condition += " OR CAST(episodes.id AS TEXT) = ?"
                parameters.append(query.lstrip("0") or "0")
            clauses.append(condition + ")")
        where = " AND ".join(clauses)
        source = "FROM episodes JOIN patients ON patients.id = episodes.patient_id"
        connection = connection_factory()
        try:
            connection.create_function("history_normalize", 1, normalize, deterministic=True)
            connection.execute("BEGIN")
            total = connection.execute(f"SELECT COUNT(*) {source} WHERE {where}", parameters).fetchone()[0]
            rows = connection.execute(
                f"""SELECT episodes.id, episodes.status, episodes.priority, episodes.location,
                    episodes.assigned_to, episodes.started_at, episodes.closed_at,
                    patients.name, patients.birth_date, patients.document, patients.identity_status,
                    (SELECT COUNT(*) FROM events WHERE events.episode_id = episodes.id) AS event_count,
                    (SELECT COUNT(*) FROM alerts WHERE alerts.episode_id = episodes.id) AS alert_count,
                    (SELECT COUNT(*) FROM tasks WHERE tasks.episode_id = episodes.id) AS task_count
                    {source} WHERE {where}
                    ORDER BY julianday(episodes.closed_at) DESC, episodes.id DESC LIMIT ? OFFSET ?""",
                [*parameters, limit, offset],
            ).fetchall()
            return {"total": total, "episodes": [dict(row) for row in rows], "requested_by": user["username"],
                    "limit": limit, "offset": offset}
        finally:
            connection.close()

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
