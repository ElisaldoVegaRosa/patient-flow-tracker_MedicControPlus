import sqlite3

import pytest

from app.database import get_connection, initialize_database


def test_connection_uses_named_rows_and_enforces_foreign_keys(tmp_path) -> None:
    connection = get_connection(tmp_path / "connection-test.db")
    try:
        connection.executescript(
            "CREATE TABLE parent (id INTEGER PRIMARY KEY);"
            "CREATE TABLE child (parent_id INTEGER REFERENCES parent(id));"
        )
        connection.execute("INSERT INTO parent (id) VALUES (1)")
        connection.execute("INSERT INTO child (parent_id) VALUES (1)")
        row = connection.execute("SELECT parent_id FROM child").fetchone()
        assert isinstance(row, sqlite3.Row)
        assert row["parent_id"] == 1
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute("INSERT INTO child (parent_id) VALUES (99)")
    finally:
        connection.close()


def test_connections_use_the_supplied_database_independently(tmp_path) -> None:
    first = get_connection(tmp_path / "first.db")
    second = get_connection(tmp_path / "second.db")
    try:
        first.execute("CREATE TABLE first_only (id INTEGER)")
        first.commit()
        assert second.execute(
            "SELECT name FROM sqlite_master WHERE name = 'first_only'"
        ).fetchone() is None
        assert second.execute("PRAGMA foreign_keys").fetchone()[0] == 1
    finally:
        first.close()
        second.close()


def test_admission_reason_upgrade_preserves_existing_episodes_and_is_idempotent(tmp_path):
    database = tmp_path / "admission-reason-migration.db"
    def initialize():
        initialize_database(get_connection(database), {}, lambda password: ("unused", "unused"), lambda: "2026-11-23T12:00:00+00:00")

    initialize()
    connection = get_connection(database)
    try:
        connection.execute("INSERT INTO patients(name,birth_date,document) VALUES ('Paciente previo','1990-01-01','PREVIOUS-REASON')")
        connection.execute("INSERT INTO episodes(patient_id,qr_token,status,priority,location,started_at) VALUES (1,'previous-qr','CLOSED',3,'Recepción','2026-11-22')")
        connection.execute("ALTER TABLE episodes DROP COLUMN consultation_reason")
        connection.commit()
        initialize()
        previous = connection.execute("SELECT * FROM episodes").fetchone()
        assert previous["consultation_reason"] is None
        assert previous["qr_token"] == "previous-qr"
        assert previous["status"] == "CLOSED"
        connection.execute("UPDATE episodes SET consultation_reason='Motivo ficticio conservado' WHERE id=1")
        connection.commit()
        initialize()
        assert connection.execute("SELECT consultation_reason FROM episodes").fetchone()[0] == "Motivo ficticio conservado"
        assert connection.execute("SELECT COUNT(*) FROM episodes").fetchone()[0] == 1
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
    finally:
        connection.close()


def test_patient_history_index_upgrade_is_additive_and_repeatable(tmp_path):
    path = tmp_path / "patient-history-index.db"
    def initialize():
        initialize_database(get_connection(path), {}, lambda password: ("unused", "unused"), lambda: "2026-11-24T12:00:00+00:00")
    initialize()
    connection = get_connection(path)
    try:
        connection.execute("INSERT INTO patients(name,birth_date,document) VALUES ('Paciente indice ficticio','1990-01-01','HISTORY-INDEX')")
        connection.execute("INSERT INTO episodes(patient_id,qr_token,status,priority,location,started_at) VALUES (1,'index-qr','CLOSED',3,'Consulta','2026-11-23T12:00:00+00:00')")
        connection.execute("DROP INDEX idx_episodes_patient_history")
        connection.commit()
        before = tuple(connection.execute("SELECT * FROM episodes").fetchone())
        initialize()
        initialize()
        assert tuple(connection.execute("SELECT * FROM episodes").fetchone()) == before
        assert [row["name"] for row in connection.execute("PRAGMA index_info(idx_episodes_patient_history)")] == ["patient_id", "started_at", "id"]
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
    finally:
        connection.close()
