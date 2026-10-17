"""Consistent, local SQLite backup and non-destructive restore for the demo."""

from __future__ import annotations

import argparse
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import os
from pathlib import Path
import re
import secrets
import shutil
import sqlite3
import sys
import tempfile


REPO_ROOT = Path(__file__).resolve().parents[1]
LIVE_DATABASE = REPO_ROOT / "backend" / "clinical.db"
BACKUP_DIRECTORY = REPO_ROOT / "backups"
REQUIRED_TABLES = frozenset({
    "users", "sessions", "episode_presence", "patients", "episodes", "events",
    "vitals", "alerts", "alert_history", "write_receipts", "tasks", "record_changes",
})


class BackupError(Exception):
    """A backup or restore cannot be completed safely."""


def _read_only_connection(path: Path) -> sqlite3.Connection:
    return sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True, timeout=5)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _checksum_path(path: Path) -> Path:
    return path.with_name(path.name + ".sha256")


def inspect_database(path: Path) -> dict[str, int]:
    """Check SQLite integrity, references and the schema needed by this demo."""
    if not path.is_file():
        raise BackupError(f"No existe la base de datos: {path}")
    try:
        with closing(_read_only_connection(path)) as connection:
            result = connection.execute("PRAGMA integrity_check").fetchall()
            if result != [("ok",)]:
                raise BackupError("La base no supera PRAGMA integrity_check")
            if connection.execute("PRAGMA foreign_key_check").fetchone() is not None:
                raise BackupError("La base contiene referencias externas invalidas")
            tables = {row[0] for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )}
            missing = REQUIRED_TABLES - tables
            if missing:
                raise BackupError("Faltan tablas del demo: " + ", ".join(sorted(missing)))
            return {
                "patients": connection.execute("SELECT COUNT(*) FROM patients").fetchone()[0],
                "episodes": connection.execute("SELECT COUNT(*) FROM episodes").fetchone()[0],
            }
    except sqlite3.DatabaseError as error:
        raise BackupError("No se pudo leer una base SQLite valida") from error


def verify_backup(path: Path, *, require_checksum: bool = False) -> tuple[str, dict[str, int]]:
    """Verify a snapshot; a sidecar checksum is mandatory when restoring."""
    if not path.is_file():
        raise BackupError(f"No existe el respaldo: {path}")
    checksum = _sha256(path)
    sidecar = _checksum_path(path)
    if sidecar.is_file():
        try:
            expected = sidecar.read_text(encoding="ascii").strip().lower()
        except UnicodeError as error:
            raise BackupError("El archivo SHA-256 no es valido") from error
        if not re.fullmatch(r"[0-9a-f]{64}", expected) or checksum != expected:
            raise BackupError("El respaldo no coincide con su SHA-256")
    elif require_checksum:
        raise BackupError("Falta el archivo .sha256 del respaldo")
    return checksum, inspect_database(path)


def _new_temp_file(directory: Path) -> Path:
    descriptor, name = tempfile.mkstemp(prefix=".mediccontrol-", suffix=".tmp", dir=directory)
    os.close(descriptor)
    return Path(name)


def _free_destination(path: Path) -> None:
    if path.exists() or path.is_symlink():
        raise BackupError(f"El destino ya existe; no se sobrescribio: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)


def create_backup(source: Path = LIVE_DATABASE, output: Path | None = None) -> Path:
    """Use SQLite's online backup API to capture a consistent live snapshot."""
    if not source.is_file():
        raise BackupError(f"No existe la base de origen: {source}")
    if output is None:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        output = BACKUP_DIRECTORY / f"clinical-{stamp}-{secrets.token_hex(4)}.sqlite3"
    _free_destination(output)
    sidecar = _checksum_path(output)
    _free_destination(sidecar)
    temporary = _new_temp_file(output.parent)
    published = False
    created_sidecar = False
    successful = False
    try:
        with closing(_read_only_connection(source)) as current, closing(sqlite3.connect(temporary)) as snapshot:
            current.backup(snapshot)
        inspect_database(temporary)
        checksum = _sha256(temporary)
        _free_destination(output)
        os.rename(temporary, output)
        published = True
        with sidecar.open("x", encoding="ascii", newline="\n") as checksum_file:
            created_sidecar = True
            checksum_file.write(checksum + "\n")
            checksum_file.flush()
            os.fsync(checksum_file.fileno())
        verify_backup(output, require_checksum=True)
        successful = True
        return output
    finally:
        temporary.unlink(missing_ok=True)
        if not successful:
            if created_sidecar:
                sidecar.unlink(missing_ok=True)
            if published:
                output.unlink(missing_ok=True)


def restore_backup(source: Path, destination: Path) -> Path:
    """Restore a verified snapshot only to a new path, never over existing data."""
    expected, _ = verify_backup(source, require_checksum=True)
    _free_destination(destination)
    temporary = _new_temp_file(destination.parent)
    try:
        shutil.copyfile(source, temporary)
        if _sha256(temporary) != expected:
            raise BackupError("La copia restaurada no coincide con el respaldo")
        inspect_database(temporary)
        _free_destination(destination)
        os.rename(temporary, destination)
        return destination
    finally:
        temporary.unlink(missing_ok=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Respaldo verificable de la base demo MedicControl+")
    commands = parser.add_subparsers(dest="command", required=True)
    backup_command = commands.add_parser("backup", help="Crear copia SQLite consistente")
    backup_command.add_argument("--source", type=Path, default=LIVE_DATABASE)
    backup_command.add_argument("--output", type=Path)
    verify_command = commands.add_parser("verify", help="Comprobar respaldo e integridad")
    verify_command.add_argument("source", type=Path)
    restore_command = commands.add_parser("restore", help="Restaurar a un archivo nuevo")
    restore_command.add_argument("source", type=Path)
    restore_command.add_argument("--target", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "backup":
            path = create_backup(args.source, args.output)
            checksum, counts = verify_backup(path, require_checksum=True)
        elif args.command == "verify":
            path = args.source
            checksum, counts = verify_backup(path, require_checksum=True)
        else:
            path = restore_backup(args.source, args.target)
            checksum, counts = _sha256(path), inspect_database(path)
        print(f"Verificado: {path.resolve()}")
        print(f"SHA-256: {checksum}")
        print(f"Pacientes: {counts['patients']}; episodios: {counts['episodes']}")
        return 0
    except (BackupError, OSError, sqlite3.Error) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
