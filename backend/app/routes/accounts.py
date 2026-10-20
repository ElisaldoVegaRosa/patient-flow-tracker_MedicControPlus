"""Separate account administration, using shared atomic receipts and session checks."""
import re
import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from .. import auth
from ..accounts import ACCOUNT_ADMIN, account_detail, account_fingerprint, audit
from ..input_validation import Name, ClinicalNote
from ..security import hash_password
from ..write_operations import atomic_write, transaction_factory

Role = Literal["RECEPTION", "ADMISSION", "NURSE", "DOCTOR", "LAB", "SUPERVISOR", "ACCOUNT_ADMIN"]


class AccountReason(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    reason: ClinicalNote


class AccountPassword(AccountReason):
    password: str = Field(min_length=12, max_length=128)

    def __repr_args__(self):
        # FastAPI clones field metadata; avoid repr-only Field warnings in that
        # schema path, while keeping credentials out of model representations.
        return ((name, value) for name, value in super().__repr_args__() if name != "password")

    @field_validator("password")
    @classmethod
    def not_blank(cls, value):
        if not value.strip():
            raise ValueError("Contrasena no valida")
        return value


class AccountCreate(AccountPassword):
    username: str = Field(min_length=3, max_length=40)
    display_name: Name
    role: Role

    @field_validator("username")
    @classmethod
    def valid_username(cls, value):
        if not re.fullmatch(r"[a-z][a-z0-9_.-]{2,39}", value):
            raise ValueError("Usa minusculas, digitos, punto, guion o guion bajo; empieza con una letra")
        return value


class AccountStatus(AccountReason):
    active: bool = Field(strict=True)


def create_router(connection_factory, timestamp, require_roles):
    factory = transaction_factory(connection_factory)
    router = APIRouter(prefix="/accounts")
    administrator = require_roles(ACCOUNT_ADMIN)

    def reauthorize(connection, request, user):
        current = auth.validate_session(request.headers.get("Authorization"), lambda: factory(), timestamp)
        auth.authorize_role(current, (ACCOUNT_ADMIN,))
        if current["username"] != user["username"]:
            raise HTTPException(401, "Sesion modificada")

    write = atomic_write(connection_factory, require_key=True, authorize=reauthorize,
                         fingerprint_payload=account_fingerprint)

    def check(connection, identifier, expected):
        current = account_detail(connection, identifier)
        if not expected:
            raise HTTPException(428, "Consulta la version actual antes de guardar")
        if expected != current["version"]:
            raise HTTPException(409, {"code": "version_conflict", "message": "Otra sesion modifico esta cuenta. Consulta y revisa antes de guardar."})
        return current

    @router.get("")
    def accounts(user: dict = Depends(administrator)):
        connection = factory()
        try:
            return {"accounts": [account_detail(connection, row["id"]) for row in connection.execute("SELECT id FROM users ORDER BY id")],
                    "changes": [dict(row) for row in connection.execute("SELECT * FROM account_changes ORDER BY id DESC")],
                    "requested_by": user["username"]}
        finally:
            connection.close()

    @router.post("", status_code=201)
    @write
    def create(data: AccountCreate, user: dict = Depends(administrator)):
        connection = factory()
        salt, password_hash = hash_password(data.password)
        try:
            identifier = connection.execute(
                """INSERT INTO users (username, display_name, password_hash, password_salt, role, active, created_at)
                VALUES (?, ?, ?, ?, ?, 1, ?)""",
                (data.username, data.display_name, password_hash, salt, data.role, timestamp()),
            ).lastrowid
        except sqlite3.IntegrityError:
            raise HTTPException(409, "Ese usuario ya existe; no se creo otra cuenta") from None
        result = account_detail(connection, identifier)
        audit(connection, identifier, user["username"], "CREATE", None, result, data.reason, timestamp)
        return result

    @router.patch("/{account_id}/status")
    @write
    def status(account_id: int, data: AccountStatus, expected: str | None = Header(default=None, alias="If-Match"),
               user: dict = Depends(administrator)):
        connection = factory()
        before = check(connection, account_id, expected)
        if not data.active:
            if before["username"] == user["username"]:
                raise HTTPException(409, "No puedes desactivar tu propia cuenta")
            if before["role"] == ACCOUNT_ADMIN and before["active"] and connection.execute(
                "SELECT COUNT(*) FROM users WHERE role = ? AND active = 1", (ACCOUNT_ADMIN,),
            ).fetchone()[0] <= 1:
                raise HTTPException(409, "Debe conservarse un administrador activo")
        connection.execute("UPDATE users SET active = ?, account_revision = account_revision + 1 WHERE id = ?", (int(data.active), account_id))
        if not data.active:
            connection.execute("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", (timestamp(), account_id))
        result = account_detail(connection, account_id)
        audit(connection, account_id, user["username"], "ACTIVATE" if data.active else "DEACTIVATE", before, result, data.reason, timestamp)
        return result

    @router.post("/{account_id}/password")
    @write
    def password(account_id: int, data: AccountPassword, expected: str | None = Header(default=None, alias="If-Match"),
                 user: dict = Depends(administrator)):
        connection = factory()
        before = check(connection, account_id, expected)
        if before["username"] == user["username"]:
            raise HTTPException(409, "Otro administrador debe restablecer tu contrasena; esta accion revoca las sesiones")
        salt, password_hash = hash_password(data.password)
        connection.execute("UPDATE users SET password_hash = ?, password_salt = ?, account_revision = account_revision + 1 WHERE id = ?", (password_hash, salt, account_id))
        connection.execute("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", (timestamp(), account_id))
        result = account_detail(connection, account_id)
        audit(connection, account_id, user["username"], "RESET_PASSWORD", before, result, data.reason, timestamp)
        return result

    return router
