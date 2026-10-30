"""Explicit additive laboratory migration; never invoked by API startup."""
from pathlib import Path
import sqlite3


SCHEMA_PATH = Path(__file__).resolve().parents[1] / "migrations" / "011_laboratory.sql"
SCHEMA_VERSION = 2
LABORATORY_TABLES = frozenset({
    'lab_schema', 'lab_orders', 'lab_analyses', 'lab_specimens',
    'lab_analysis_specimens', 'lab_specimen_repeats', 'lab_result_versions',
    'lab_result_specimens', 'lab_result_reviews', 'lab_followups',
    'lab_followup_scope', 'lab_changes',
})


def migrate_laboratory_schema(connection: sqlite3.Connection) -> None:
    """Apply additive DDL atomically, without adopting any legacy order.

    The caller must provide an idle connection with foreign keys enabled.
    Do not use executescript: it can commit a caller's transaction before DDL.
    """
    if connection.in_transaction:
        raise ValueError("La migracion requiere una conexion sin transaccion activa")
    if not connection.execute("PRAGMA foreign_keys").fetchone()[0]:
        raise ValueError("La migracion requiere referencias externas activas")
    statements = []
    pending = ""
    for line in SCHEMA_PATH.read_text(encoding="utf-8").splitlines(keepends=True):
        pending += line
        if sqlite3.complete_statement(pending):
            statements.append(pending)
            pending = ""
    if pending.strip():
        raise ValueError("Esquema de laboratorio incompleto")
    try:
        connection.execute("BEGIN IMMEDIATE")
        if connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='lab_schema'"
        ).fetchone():
            versions = connection.execute("SELECT version FROM lab_schema").fetchall()
            if any(row[0] != SCHEMA_VERSION for row in versions):
                raise ValueError("Version de laboratorio no compatible")
        for statement in statements:
            connection.execute(statement)
        connection.commit()
    except BaseException:
        connection.rollback()
        raise
