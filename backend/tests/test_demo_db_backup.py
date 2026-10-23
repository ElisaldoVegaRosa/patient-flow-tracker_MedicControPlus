"""A verified backup can be restored without changing the live source."""

import sqlite3

import pytest

from app.database import get_connection, initialize_database
from scripts.demo_db_backup import BackupError, create_backup, restore_backup, verify_backup


def test_backup_requires_identity_audit_for_new_patient_schema(tmp_path):
    source = tmp_path / "identity.db"
    demo_database(source)
    with sqlite3.connect(source) as connection:
        connection.execute("DROP TABLE patient_identity_changes")
    with pytest.raises(BackupError, match="patient_identity_changes"):
        create_backup(source, tmp_path / "missing-audit.sqlite3")


def demo_database(path):
    initialize_database(get_connection(path), {}, lambda _: ("salt", "hash"), lambda: "2026-10-17T00:00:00Z")
    connection = get_connection(path)
    connection.execute(
        "INSERT INTO patients (name, birth_date, document) VALUES (?, ?, ?)",
        ("Paciente Ficticio", "1990-01-01", "DEMO-BACKUP"),
    )
    connection.execute(
        "INSERT INTO episodes (patient_id, qr_token, status, priority, location, started_at) "
        "VALUES (1, 'backup-qr', 'ACTIVE', 3, 'Recepcion', '2026-10-17T00:00:00Z')"
    )
    connection.execute(
        "INSERT INTO events (episode_id, type, username, created_at, note) "
        "VALUES (1, 'EPISODE_CREATED', 'recepcion', '2026-10-17T00:00:00Z', 'Ingreso ficticio')"
    )
    connection.commit()
    connection.close()


@pytest.mark.parametrize('table', ['care_schema', 'care_episodes', 'care_slots', 'care_changes'])
def test_care_schema_requires_all_responsibility_tables(tmp_path, table):
    source = tmp_path / 'care-incomplete.db'
    demo_database(source)
    with sqlite3.connect(source) as connection:
        connection.execute(f'DROP TABLE {table}')
    with pytest.raises(BackupError, match=table):
        create_backup(source, tmp_path / 'incomplete.sqlite3')


def test_backup_and_isolated_restore_preserve_snapshot(tmp_path):
    source = tmp_path / "clinical.db"
    backup = tmp_path / "backup.sqlite3"
    restored = tmp_path / "restored.sqlite3"
    demo_database(source)

    assert create_backup(source, backup) == backup
    assert (tmp_path / "backup.sqlite3.sha256").is_file()
    digest, counts = verify_backup(backup, require_checksum=True)
    assert len(digest) == 64
    assert counts == {"patients": 1, "episodes": 1}

    with sqlite3.connect(source) as connection:
        connection.execute("UPDATE patients SET name = 'Edicion posterior'")
    assert restore_backup(backup, restored) == restored
    assert restored.read_bytes() == backup.read_bytes()
    with sqlite3.connect(restored) as connection:
        assert connection.execute("SELECT name FROM patients").fetchone()[0] == "Paciente Ficticio"
    with sqlite3.connect(source) as connection:
        assert connection.execute("SELECT name FROM patients").fetchone()[0] == "Edicion posterior"


def test_modified_backup_fails_checksum_and_cannot_restore(tmp_path):
    source = tmp_path / "clinical.db"
    backup = tmp_path / "backup.sqlite3"
    demo_database(source)
    create_backup(source, backup)
    with backup.open("ab") as output:
        output.write(b"modified")

    with pytest.raises(BackupError, match="SHA-256"):
        verify_backup(backup, require_checksum=True)
    with pytest.raises(BackupError, match="SHA-256"):
        restore_backup(backup, tmp_path / "restored.sqlite3")
    assert not (tmp_path / "restored.sqlite3").exists()


def test_restore_requires_checksum_and_refuses_existing_target(tmp_path):
    source = tmp_path / "clinical.db"
    backup = tmp_path / "backup.sqlite3"
    target = tmp_path / "existing.sqlite3"
    demo_database(source)
    create_backup(source, backup)
    original_backup = backup.read_bytes()
    with pytest.raises(BackupError, match="ya existe"):
        create_backup(source, backup)
    assert backup.read_bytes() == original_backup
    target.write_bytes(b"keep this file")

    with pytest.raises(BackupError, match="ya existe"):
        restore_backup(backup, target)
    assert target.read_bytes() == b"keep this file"

    (tmp_path / "backup.sqlite3.sha256").unlink()
    with pytest.raises(BackupError, match="Falta el archivo"):
        restore_backup(backup, tmp_path / "new.sqlite3")


def test_invalid_schema_is_not_accepted_as_demo_backup(tmp_path):
    source = tmp_path / "empty.db"
    sqlite3.connect(source).close()
    with pytest.raises(BackupError, match="Faltan tablas"):
        create_backup(source, tmp_path / "backup.sqlite3")
    assert not (tmp_path / "backup.sqlite3").exists()


def test_account_schema_requires_its_audit_table(tmp_path):
    source = tmp_path / "accounts-incomplete.db"
    demo_database(source)
    with sqlite3.connect(source) as connection:
        columns = {row[1] for row in connection.execute("PRAGMA table_info(users)")}
        if "account_revision" not in columns:
            connection.execute("ALTER TABLE users ADD COLUMN account_revision INTEGER NOT NULL DEFAULT 0")
        connection.execute("DROP TABLE IF EXISTS account_changes")
    with pytest.raises(BackupError, match="account_changes"):
        create_backup(source, tmp_path / "backup-accounts.sqlite3")


@pytest.mark.parametrize("table", ["staff_areas", "staff_shifts", "staff_assignments", "staff_changes"])
def test_staff_schema_requires_all_operational_tables(tmp_path, table):
    source = tmp_path / "staff-incomplete.db"
    demo_database(source)
    with sqlite3.connect(source) as connection:
        connection.execute(f"DROP TABLE {table}")
    with pytest.raises(BackupError, match=table):
        create_backup(source, tmp_path / "incomplete.sqlite3")


def test_broken_foreign_key_is_not_backed_up(tmp_path):
    source = tmp_path / "clinical.db"
    output = tmp_path / "backup.sqlite3"
    demo_database(source)
    with sqlite3.connect(source) as connection:
        connection.execute(
            "INSERT INTO tasks (episode_id, title, service, status, created_at) "
            "VALUES (999, 'Orden ficticia', 'LAB', 'PENDING', '2026-10-17T00:00:00Z')"
        )

    with pytest.raises(BackupError, match="referencias"):
        create_backup(source, output)
    assert not output.exists()
