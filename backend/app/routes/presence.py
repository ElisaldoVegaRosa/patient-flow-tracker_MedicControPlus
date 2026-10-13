"""Expiring advisory presence, never an episode reservation or clinical write."""
from datetime import datetime, timedelta, timezone
from typing import Literal
import re

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from ..security import hash_session_token

PRESENCE_TTL_SECONDS = 45


def now():
    return datetime.now(timezone.utc)


class PresenceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["VIEW", "EDIT"]
    sequence: int = Field(strict=True, ge=1, le=2_147_483_646)


def create_router(connection_factory, authenticated_user):
    router = APIRouter()

    def session(connection, authorization, current_time):
        token = (authorization or "").removeprefix("Bearer ")
        row = connection.execute(
            """SELECT sessions.id, users.role FROM sessions JOIN users ON users.id = sessions.user_id
               WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ? AND users.active = 1""",
            (hash_session_token(token), current_time.isoformat()),
        ).fetchone()
        if row is None:
            raise HTTPException(401, "Sesión requerida")
        return row

    def episode(connection, episode_id):
        row = connection.execute("SELECT status FROM episodes WHERE id = ?", (episode_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "Episodio no encontrado")
        return row["status"] == "ACTIVE"

    def result(connection, episode_id, session_id, tab_id, current_time, active):
        rows = connection.execute(
            """SELECT users.username, users.role, COUNT(*) AS tabs,
                      COUNT(DISTINCT sessions.id) AS sessions,
                      SUM(CASE WHEN presence.mode = 'EDIT' AND users.role IN ('NURSE', 'DOCTOR', 'SUPERVISOR') THEN 1 ELSE 0 END) AS editing_tabs
               FROM episode_presence AS presence
               JOIN sessions ON sessions.id = presence.session_id
               JOIN users ON users.id = sessions.user_id
               WHERE presence.episode_id = ? AND presence.expires_at > ?
                 AND sessions.revoked_at IS NULL AND sessions.expires_at > ? AND users.active = 1
                 AND presence.sequence < 2147483647
                 AND NOT (presence.session_id = ? AND presence.tab_id = ?)
               GROUP BY users.username, users.role ORDER BY users.username, users.role""",
            (episode_id, current_time.isoformat(), current_time.isoformat(), session_id, tab_id),
        ).fetchall() if active else []
        return {"active": active, "ttl_seconds": PRESENCE_TTL_SECONDS,
                "members": [dict(row) for row in rows]}

    def handle(episode_id, tab_id, authorization, update=None, release=False):
        if not re.fullmatch(r"[A-Za-z0-9_-]{16,128}", tab_id):
            raise HTTPException(400, "Identificador de pestaña no válido")
        connection = connection_factory()
        try:
            connection.execute("BEGIN IMMEDIATE")
            current_time = now()
            current = session(connection, authorization, current_time)
            active = episode(connection, episode_id)
            # Expired leases carry no clinical content; they need no archival receipt.
            connection.execute("DELETE FROM episode_presence WHERE expires_at <= ?", (current_time.isoformat(),))
            if update:
                if not active:
                    raise HTTPException(409, "El episodio está cerrado")
                if update.mode == "EDIT" and current["role"] not in ("NURSE", "DOCTOR", "SUPERVISOR"):
                    raise HTTPException(403, "Su rol solo puede consultar este episodio")
                connection.execute(
                    """INSERT INTO episode_presence (episode_id, session_id, tab_id, mode, sequence, expires_at)
                       VALUES (?, ?, ?, ?, ?, ?)
                       ON CONFLICT (episode_id, session_id, tab_id) DO UPDATE
                       SET mode = excluded.mode, sequence = excluded.sequence, expires_at = excluded.expires_at
                       WHERE excluded.sequence > episode_presence.sequence""",
                    (episode_id, current["id"], tab_id, update.mode, update.sequence,
                     (current_time + timedelta(seconds=PRESENCE_TTL_SECONDS)).isoformat()),
                )
            if release:
                # A short-lived tombstone prevents an older heartbeat overtaking release.
                connection.execute(
                    """INSERT INTO episode_presence (episode_id, session_id, tab_id, mode, sequence, expires_at)
                       VALUES (?, ?, ?, 'VIEW', 2147483647, ?)
                       ON CONFLICT (episode_id, session_id, tab_id) DO UPDATE
                       SET sequence = 2147483647, expires_at = excluded.expires_at""",
                    (episode_id, current["id"], tab_id,
                     (current_time + timedelta(seconds=PRESENCE_TTL_SECONDS)).isoformat()),
                )
            response = result(connection, episode_id, current["id"], tab_id, current_time, active)
            connection.commit()
            return response
        finally:
            connection.close()

    @router.get("/episodes/{episode_id}/presence/{tab_id}")
    def read_presence(episode_id: int, tab_id: str, authorization: str | None = Header(default=None),
                      user: dict = Depends(authenticated_user)):
        return handle(episode_id, tab_id, authorization)

    @router.put("/episodes/{episode_id}/presence/{tab_id}")
    def renew_presence(episode_id: int, tab_id: str, payload: PresenceUpdate,
                       authorization: str | None = Header(default=None), user: dict = Depends(authenticated_user)):
        return handle(episode_id, tab_id, authorization, update=payload)

    @router.delete("/episodes/{episode_id}/presence/{tab_id}")
    def release_presence(episode_id: int, tab_id: str, authorization: str | None = Header(default=None),
                         user: dict = Depends(authenticated_user)):
        return handle(episode_id, tab_id, authorization, release=True)

    return router
