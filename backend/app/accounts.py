"""Account metadata and audit; no clinical privileges or credential snapshots."""
import hashlib
import json
import re
import sqlite3

from fastapi import HTTPException
from .concurrency import etag
from .security import hash_password
from .config import PASSWORD_HASH_ITERATIONS

ACCOUNT_ADMIN = "ACCOUNT_ADMIN"
ACCOUNT_ROLES = ("RECEPTION", "ADMISSION", "NURSE", "DOCTOR", "LAB", "SUPERVISOR", ACCOUNT_ADMIN)


class BootstrapError(ValueError):
    """Controlled setup message; never includes submitted values or credentials."""


def migrate_accounts(connection):
    try:
        connection.execute("BEGIN IMMEDIATE")
        columns = {row["name"] for row in connection.execute("PRAGMA table_info(users)")}
        if "display_name" not in columns:
            connection.execute("ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT ''")
        if "account_revision" not in columns:
            connection.execute("ALTER TABLE users ADD COLUMN account_revision INTEGER NOT NULL DEFAULT 0")
        connection.execute("""CREATE TABLE IF NOT EXISTS account_changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            actor TEXT NOT NULL, action TEXT NOT NULL,
            old_value TEXT NOT NULL, new_value TEXT NOT NULL,
            reason TEXT NOT NULL, created_at TEXT NOT NULL
        )""")
        connection.execute("CREATE INDEX IF NOT EXISTS idx_account_changes_user ON account_changes(user_id, id)")
        connection.commit()
    except BaseException:
        connection.rollback()
        raise


def account_detail(connection, account_id):
    row = connection.execute(
        "SELECT id, username, display_name, role, active, created_at, account_revision FROM users WHERE id = ?",
        (account_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Cuenta no encontrada")
    result = dict(row)
    result["version"] = etag(result)
    return result


def audit(connection, target, actor, action, before, after, reason, timestamp):
    # All snapshots originate from account_detail, never SELECT * or request payloads.
    connection.execute(
        """INSERT INTO account_changes (user_id, actor, action, old_value, new_value, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (target, actor, action, json.dumps(before, ensure_ascii=False),
         json.dumps(after, ensure_ascii=False), reason, timestamp()),
    )


def account_fingerprint(payload, key):
    """Avoid fast password guesses from receipts; never persist raw credential payloads."""
    safe = {**payload, "data": dict(payload["data"])}
    if "password" in safe["data"]:
        safe["data"]["password"] = hashlib.pbkdf2_hmac(
            "sha256", safe["data"]["password"].encode(), key.encode(), PASSWORD_HASH_ITERATIONS,
        ).hex()
    return safe


def validate_bootstrap_input(username, display_name, password, reason):
    if not re.fullmatch(r"[a-z][a-z0-9_.-]{2,39}", username):
        raise BootstrapError("Usuario: 3-40 caracteres, minusculas, digitos, punto, guion o guion bajo")
    if not 12 <= len(password) <= 128 or not password.strip():
        raise BootstrapError("La contrasena requiere entre 12 y 128 caracteres y no puede contener solo espacios")
    if not display_name.strip() or len(display_name) > 200 or not 3 <= len(reason.strip()) <= 2000:
        raise BootstrapError("Nombre visible: 1-200 caracteres; motivo: 3-2000 caracteres; no solo espacios")


def bootstrap_admin(connection: sqlite3.Connection, username, display_name, password, reason, timestamp):
    """Local first-account setup only, serialized with API writes."""
    validate_bootstrap_input(username, display_name, password, reason)
    try:
        connection.execute("BEGIN IMMEDIATE")
        if connection.execute("SELECT 1 FROM users WHERE role = ?", (ACCOUNT_ADMIN,)).fetchone():
            raise BootstrapError("Ya existe administrador; utiliza la gestion de cuentas")
        if connection.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone():
            raise BootstrapError("Ese usuario ya existe; elige otro nombre para el administrador inicial")
        salt, password_hash = hash_password(password)
        identifier = connection.execute(
            """INSERT INTO users (username, display_name, password_hash, password_salt, role, active, created_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)""",
            (username, display_name.strip(), password_hash, salt, ACCOUNT_ADMIN, timestamp()),
        ).lastrowid
        result = account_detail(connection, identifier)
        audit(connection, identifier, "LOCAL_BOOTSTRAP", "BOOTSTRAP", None, result, reason.strip(), timestamp)
        connection.commit()
        return result
    except BaseException:
        connection.rollback()
        raise
