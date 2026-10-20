"""Patient identity migration and snapshots, independent of episode lifecycle."""
import json
import sqlite3


PATIENT_COLUMNS = """
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    birth_date TEXT,
    document TEXT,
    identity_status TEXT NOT NULL DEFAULT 'REGISTERED'
        CHECK (identity_status IN ('REGISTERED', 'PROVISIONAL', 'VERIFIED')),
    identity_revision INTEGER NOT NULL DEFAULT 0,
    CHECK (identity_status = 'PROVISIONAL' OR (birth_date IS NOT NULL AND document IS NOT NULL))
"""


def migrate_patients(connection):
    """Rebuild the legacy table transactionally; never rewrite episode references."""
    columns = {row["name"]: row for row in connection.execute("PRAGMA table_info(patients)")}
    if "identity_status" in columns:
        if "identity_revision" not in columns or columns["birth_date"]["notnull"] or columns["document"]["notnull"]:
            raise RuntimeError("Migracion de identidad incompleta; revisar esquema.")
        return
    if set(columns) != {"id", "name", "birth_date", "document"}:
        raise RuntimeError("Esquema patients desconocido; revisar antes de migrar identidad.")
    if connection.in_transaction:
        raise RuntimeError("La migracion de identidad requiere una conexion sin transaccion activa.")
    connection.execute("PRAGMA foreign_keys = OFF")
    try:
        connection.execute("BEGIN IMMEDIATE")
        # Recheck after the lock: two startup processes must not both rebuild.
        if any(row["name"] == "identity_status" for row in connection.execute("PRAGMA table_info(patients)")):
            connection.commit()
            return
        if connection.execute("PRAGMA foreign_key_check").fetchone():
            raise RuntimeError("Hay referencias invalidas; no se migro patients.")
        objects = connection.execute(
            "SELECT sql FROM sqlite_schema WHERE tbl_name = 'patients' AND type IN ('index', 'trigger') AND sql IS NOT NULL"
        ).fetchall()
        sequence = connection.execute("SELECT seq FROM sqlite_sequence WHERE name = 'patients'").fetchone()
        connection.execute(f"CREATE TABLE patients_identity_new ({PATIENT_COLUMNS})")
        connection.execute(
            "INSERT INTO patients_identity_new (id, name, birth_date, document) SELECT id, name, birth_date, document FROM patients"
        )
        connection.execute("DROP TABLE patients")
        connection.execute("ALTER TABLE patients_identity_new RENAME TO patients")
        for item in objects:
            connection.execute(item["sql"])
        if sequence:
            changed = connection.execute("UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name = 'patients'", (sequence["seq"],))
            if not changed.rowcount:
                connection.execute("INSERT INTO sqlite_sequence (name, seq) VALUES ('patients', ?)", (sequence["seq"],))
        if connection.execute("PRAGMA foreign_key_check").fetchone():
            raise RuntimeError("Fallo la integridad referencial; migracion revertida.")
        connection.commit()
    except BaseException:
        connection.rollback()
        raise
    finally:
        connection.execute("PRAGMA foreign_keys = ON")


def snapshot(patient):
    return json.dumps({key: patient[key] for key in ("name", "birth_date", "document", "identity_status")}, ensure_ascii=False)


def find_candidates(connection: sqlite3.Connection, document, name=None, birth_date=None, exclude=None):
    """Conservative review, never automatic merge. Nulls are never identity keys."""
    connection.create_function("identity_document", 1, lambda value: value.strip() if value else None, deterministic=True)
    connection.create_function("identity_name", 1, lambda value: value.strip().casefold() if value else None, deterministic=True)
    return connection.execute(
        """SELECT id, name, birth_date, document, identity_status FROM patients
        WHERE (? IS NULL OR id != ?) AND
        ((? IS NOT NULL AND identity_document(document) = ?) OR
         (? IS NOT NULL AND ? IS NOT NULL AND identity_name(name) = ? AND birth_date = ?))
        ORDER BY id""",
        (exclude, exclude, document, document.strip() if document else None,
         name, birth_date, name.strip().casefold() if name else None, birth_date),
    ).fetchall()
