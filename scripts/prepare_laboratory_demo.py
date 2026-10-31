"""Prepare a verified migrated copy; never migrate or replace the source database."""
from __future__ import annotations

import argparse
from contextlib import closing
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import os

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / 'backend'))

from app.laboratory_schema import migrate_laboratory_schema, SCHEMA_VERSION  # noqa: E402
from scripts.demo_db_backup import (  # noqa: E402
    LIVE_DATABASE, BackupError, create_backup, restore_backup, inspect_database, verify_backup,
)


def preserved_tables(connection: sqlite3.Connection) -> dict[str, tuple[str, str]]:
    """Bounded-memory fingerprints, without printing clinical rows or credentials."""
    result = {}
    for name, sql in connection.execute("SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name"):
        identifier = '"' + name.replace('"', '""') + '"'
        columns = [row[1] for row in connection.execute(f'PRAGMA table_info({identifier})')]
        ordering = ','.join('"' + column.replace('"', '""') + '"' for column in columns)
        digest = hashlib.sha256()
        for row in connection.execute(f'SELECT * FROM {identifier} ORDER BY {ordering}'):
            digest.update(repr(tuple(row)).encode('utf-8'))
            digest.update(b'\n')
        result[name] = (sql, digest.hexdigest())
    return result


def prepare(source: Path, destination: Path, backup: Path | None = None, *, communications: bool = False) -> dict:
    if destination.is_symlink():
        raise BackupError('El destino no puede ser un enlace simbolico')
    source, destination = source.resolve(), destination.resolve()
    protected = {Path(str(base) + suffix).resolve() for base in (source, LIVE_DATABASE.resolve())
                 for suffix in ('', '-wal', '-shm', '-journal')}
    if destination in protected:
        raise BackupError('La copia preparada requiere una ruta nueva, distinta del origen y de clinical.db')
    if backup is not None:
        backup_paths = {backup.resolve(), Path(str(backup.resolve()) + '.sha256')}
        destination_paths = {Path(str(destination) + suffix) for suffix in ('', '.sha256', '-wal', '-shm', '-journal')}
        if backup_paths & (protected | destination_paths):
            raise BackupError('El respaldo requiere otra ruta nueva, distinta del origen y de la copia preparada')
    for suffix in ('', '.sha256', '-wal', '-shm', '-journal'):
        candidate = Path(str(destination) + suffix)
        if candidate.exists() or candidate.is_symlink():
            raise BackupError('El destino o sus archivos auxiliares ya existen; no se sobrescribieron')
    inspect_database(source)
    destination.parent.mkdir(parents=True, exist_ok=True)
    rollback = create_backup(source, backup)
    verify_backup(rollback, require_checksum=True)
    descriptor, name = tempfile.mkstemp(prefix='.lab-prepare-', suffix='.sqlite3', dir=destination.parent)
    os.close(descriptor)
    temporary = Path(name)
    temporary.unlink()
    try:
        restore_backup(rollback, temporary)
        with closing(sqlite3.connect(temporary)) as connection:
            connection.execute('PRAGMA foreign_keys=ON')
            before = preserved_tables(connection)
            migrate_laboratory_schema(connection)
            from app.patient_communications import available as communication_available, migrate
            if communications:
                migrate(connection)
            communication_enabled = communication_available(connection)
            after = preserved_tables(connection)
            if any(after.get(table) != value for table, value in before.items()):
                raise BackupError('La migracion altero una tabla anterior; no se publico la copia preparada')
        counts = inspect_database(temporary)
        create_backup(temporary, destination)
        verify_backup(destination, require_checksum=True)
        return {'prepared': str(destination), 'rollback_backup': str(rollback), 'schema_version': SCHEMA_VERSION,
                'communications_enabled': communication_enabled,
                'original_tables_verified': len(before), **counts}
    finally:
        for suffix in ('', '-wal', '-shm', '-journal'):
            Path(str(temporary) + suffix).unlink(missing_ok=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description='Prepara una copia LAB con respaldo; no modifica ni activa el origen')
    parser.add_argument('--source', type=Path, default=LIVE_DATABASE)
    parser.add_argument('--destination', type=Path, required=True)
    parser.add_argument('--backup', type=Path, help='Archivo nuevo para respaldo anterior; por defecto se genera en backups/')
    parser.add_argument('--communications', action='store_true', help='Habilita registro de comunicacion solo en la copia nueva')
    args = parser.parse_args(argv)
    try:
        print(json.dumps(prepare(args.source, args.destination, args.backup, communications=args.communications), ensure_ascii=False, indent=2))
        return 0
    except (BackupError, OSError, ValueError, sqlite3.DatabaseError) as error:
        print(f'Preparacion no completada: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
