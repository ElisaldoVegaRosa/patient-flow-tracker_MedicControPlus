import hashlib
import sqlite3

import pytest

from scripts import prepare_laboratory_demo as preparation
from scripts.demo_db_backup import BackupError, restore_backup, verify_backup
from app.laboratory_schema import LABORATORY_TABLES
from app.database_selection import select_database
from test_laboratory_schema import legacy  # noqa: F401


def source_path(connection):
    from pathlib import Path
    return Path(connection.execute('PRAGMA database_list').fetchone()[2])


def test_prepare_preserves_all_old_tables_and_keeps_verified_rollback_and_restorable_output(legacy, tmp_path):
    source = source_path(legacy)
    original = source.read_bytes()
    destination, backup = tmp_path / 'prepared.sqlite3', tmp_path / 'rollback.sqlite3'
    result = preparation.prepare(source, destination, backup)
    assert source.read_bytes() == original
    assert result['schema_version'] == 2 and result['patients'] == 2 and result['episodes'] == 2
    verify_backup(backup, require_checksum=True)
    verify_backup(destination, require_checksum=True)
    with sqlite3.connect(destination) as connection:
        tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        assert LABORATORY_TABLES <= tables
        assert connection.execute('SELECT count(*) FROM lab_orders').fetchone()[0] == 0
        assert connection.execute('SELECT count(*) FROM lab_analyses').fetchone()[0] == 0
    restored = restore_backup(destination, tmp_path / 'restored.sqlite3')
    assert hashlib.sha256(restored.read_bytes()).digest() == hashlib.sha256(destination.read_bytes()).digest()
    assert not list(tmp_path.glob('.lab-prepare-*'))


@pytest.mark.parametrize('kind', ['source', 'live', 'existing', 'journal', 'backup_alias', 'source_wal', 'backup_source_wal', 'backup_sidecar_alias'])
def test_prepare_refuses_unsafe_or_existing_destinations_without_altering_source(legacy, tmp_path, kind):
    source = source_path(legacy)
    original = source.read_bytes()
    destination, backup = tmp_path / 'prepared.sqlite3', tmp_path / 'rollback.sqlite3'
    if kind == 'source':
        destination = source
    elif kind == 'live':
        destination = preparation.LIVE_DATABASE
    elif kind == 'existing':
        destination.write_bytes(b'keep')
    elif kind == 'journal':
        (tmp_path / 'prepared.sqlite3-wal').write_bytes(b'keep')
    elif kind == 'source_wal':
        destination = source.with_name(source.name + '-wal')
    elif kind == 'backup_source_wal':
        backup = source.with_name(source.name + '-wal')
    elif kind == 'backup_sidecar_alias':
        destination, backup = tmp_path / 'collision.sha256', tmp_path / 'collision'
    else:
        backup = destination
    with pytest.raises(BackupError):
        preparation.prepare(source, destination, backup)
    assert source.read_bytes() == original
    if kind == 'existing':
        assert destination.read_bytes() == b'keep'


def test_migration_failure_keeps_source_and_rollback_and_does_not_publish_output(legacy, tmp_path, monkeypatch):
    source, destination, backup = source_path(legacy), tmp_path / 'prepared.sqlite3', tmp_path / 'rollback.sqlite3'
    original = source.read_bytes()
    def fail(connection):
        raise ValueError('Fallo ficticio de migracion')
    monkeypatch.setattr(preparation, 'migrate_laboratory_schema', fail)
    with pytest.raises(ValueError, match='Fallo ficticio'):
        preparation.prepare(source, destination, backup)
    assert source.read_bytes() == original and not destination.exists()
    verify_backup(backup, require_checksum=True)
    assert not list(tmp_path.glob('.lab-prepare-*'))


def test_altered_old_data_is_rejected_before_publishing(legacy, tmp_path, monkeypatch):
    source, destination, backup = source_path(legacy), tmp_path / 'prepared.sqlite3', tmp_path / 'rollback.sqlite3'
    migrate = preparation.migrate_laboratory_schema
    def corrupt(connection):
        migrate(connection)
        connection.execute("UPDATE patients SET name='Cambio ficticio indebido' WHERE id=1")
        connection.commit()
    monkeypatch.setattr(preparation, 'migrate_laboratory_schema', corrupt)
    with pytest.raises(BackupError, match='tabla anterior'):
        preparation.prepare(source, destination, backup)
    assert not destination.exists()
    verify_backup(backup, require_checksum=True)


def test_runtime_selects_only_an_existing_integral_prepared_copy(legacy, tmp_path):
    source, destination = source_path(legacy), tmp_path / 'prepared.sqlite3'
    assert select_database(source, None) == source
    with pytest.raises(ValueError, match='ruta absoluta'):
        select_database(source, 'missing-relative.sqlite3')
    with pytest.raises(ValueError):
        select_database(source, str(source))
    preparation.prepare(source, destination, tmp_path / 'rollback.sqlite3')
    assert select_database(source, str(destination)) == destination.resolve()
    with sqlite3.connect(destination) as connection:
        connection.execute('DROP TABLE lab_changes')
    with pytest.raises(ValueError, match='compatible'):
        select_database(source, str(destination))
