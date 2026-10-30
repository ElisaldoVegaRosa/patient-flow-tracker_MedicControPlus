"""Exercise the real backup CLI on disposable, populated laboratory databases."""
import hashlib
import sqlite3

import pytest

from app.laboratory_schema import SCHEMA_VERSION, migrate_laboratory_schema
from scripts.demo_db_backup import (
    BackupError, LABORATORY_SCHEMA_VERSION, LABORATORY_TABLES,
    create_backup, restore_backup, verify_backup,
)
from test_laboratory_schema import (  # noqa: F401
    STAMP, legacy, add_order, add_analysis, add_specimen, link, publish,
    review, repeat, snapshot, schema,
)


@pytest.fixture
def populated_lab(legacy):
    migrate_laboratory_schema(legacy)
    add_order(legacy)
    analysis = add_analysis(legacy)
    first = add_specimen(legacy)
    replacement = add_specimen(legacy)
    link(legacy, analysis, first)
    link(legacy, analysis, replacement)
    legacy.execute('UPDATE lab_analysis_specimens SET current_requirement=0 WHERE specimen_id=?', (first,))
    repeat(legacy, analysis, first, replacement)
    version = publish(legacy, analysis)
    legacy.execute('INSERT INTO lab_result_specimens VALUES (?,?,?,?)', (version, 1, analysis, replacement))
    review(legacy, version)
    corrected = publish(legacy, analysis, sequence=2, previous=version, action='CORRECT')
    legacy.execute('INSERT INTO lab_result_specimens VALUES (?,?,?,?)', (corrected, 1, analysis, replacement))
    event = legacy.execute("""INSERT INTO events(episode_id,type,username,created_at,note)
        VALUES (1,'DISCHARGE','schema.demo1',?,'Alta ficticia para respaldo')""", (STAMP,)).lastrowid
    legacy.execute("UPDATE episodes SET status='CLOSED',closed_at=? WHERE id=1", (STAMP,))
    case = legacy.execute("""INSERT INTO lab_followups(episode_id,discharge_event_id,owner_user_id,
        reason,created_by,created_at) VALUES (1,?,1,'Custodia ficticia',1,?)""", (event, STAMP)).lastrowid
    legacy.execute('INSERT INTO lab_followup_scope VALUES (?,?,?,?,?,?)',
                   (case, 1, 1, analysis, corrected, '{"pending_review":true}'))
    legacy.execute("""INSERT INTO lab_changes(episode_id,order_task_id,resource_type,resource_id,
        action,actor_user_id,created_at,reason,old_value,new_value)
        VALUES (1,1,'ANALYSIS',?,'CORRECT',3,?,'Correccion ficticia','{}','{}')""", (analysis, STAMP))
    legacy.commit()
    return legacy


def test_populated_laboratory_backup_restores_every_table_and_guard(populated_lab, tmp_path):
    connection = populated_lab
    source = tmp_path / 'isolated.sqlite3'
    before, ddl = snapshot(connection), schema(connection)
    assert LABORATORY_SCHEMA_VERSION == SCHEMA_VERSION
    assert {name for name in before if name.startswith('lab_')} == LABORATORY_TABLES
    assert all(before[name][1] for name in LABORATORY_TABLES)
    backup = create_backup(source, tmp_path / 'laboratory.sqlite3')
    digest, counts = verify_backup(backup, require_checksum=True)
    assert len(digest) == 64 and counts == {'patients': 2, 'episodes': 2}
    restored = restore_backup(backup, tmp_path / 'restored.sqlite3')
    with sqlite3.connect(restored) as recovered:
        assert snapshot(recovered) == before
        assert schema(recovered) == ddl
        assert recovered.execute('PRAGMA foreign_key_check').fetchall() == []
        with pytest.raises(sqlite3.IntegrityError, match='inmutables'):
            recovered.execute("UPDATE lab_result_versions SET result='Cambio indebido'")
    assert snapshot(connection) == before and schema(connection) == ddl


@pytest.mark.parametrize('table', sorted(LABORATORY_TABLES))
def test_incomplete_laboratory_cannot_be_published_as_backup(legacy, tmp_path, table):
    migrate_laboratory_schema(legacy)
    legacy.execute(f'DROP TABLE "{table}"')
    legacy.commit()
    output = tmp_path / 'invalid.sqlite3'
    with pytest.raises(BackupError, match=table):
        create_backup(tmp_path / 'isolated.sqlite3', output)
    assert not output.exists() and not output.with_suffix('.sqlite3.sha256').exists()
    assert not list(tmp_path.glob('.mediccontrol-*.tmp'))


@pytest.mark.parametrize('versions', [[], [1], [999], [2, 999]])
def test_unregistered_or_unsupported_laboratory_version_is_rejected(legacy, tmp_path, versions):
    migrate_laboratory_schema(legacy)
    legacy.execute('DROP TABLE lab_schema')
    legacy.execute('CREATE TABLE lab_schema(version INTEGER PRIMARY KEY)')
    legacy.executemany('INSERT INTO lab_schema VALUES (?)', [(value,) for value in versions])
    legacy.commit()
    before = snapshot(legacy)
    with pytest.raises(BackupError, match='Version de laboratorio'):
        create_backup(tmp_path / 'isolated.sqlite3', tmp_path / 'invalid.sqlite3')
    assert snapshot(legacy) == before


def test_restore_rejects_incomplete_laboratory_even_with_matching_checksum(legacy, tmp_path):
    migrate_laboratory_schema(legacy)
    backup = create_backup(tmp_path / 'isolated.sqlite3', tmp_path / 'laboratory.sqlite3')
    with sqlite3.connect(backup) as connection:
        connection.execute('DROP TABLE lab_changes')
    backup.with_suffix('.sqlite3.sha256').write_text(hashlib.sha256(backup.read_bytes()).hexdigest(), encoding='ascii')
    destination = tmp_path / 'restored.sqlite3'
    with pytest.raises(BackupError, match='lab_changes'):
        restore_backup(backup, destination)
    assert not destination.exists()
