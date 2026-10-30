"""Explicit selection of an already prepared LAB copy; never create or migrate it."""
from contextlib import closing
from pathlib import Path
import sqlite3

from fastapi import HTTPException
from .laboratory_integration import available


def select_database(default: Path, override: str | None) -> Path:
    if not override:
        return default
    candidate = Path(override)
    if not candidate.is_absolute() or not candidate.is_file():
        raise ValueError('La base elegida debe ser un archivo existente con ruta absoluta')
    path = candidate.resolve()
    try:
        with closing(sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)) as connection:
            if connection.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
                raise ValueError('La base elegida no supera la verificacion de integridad')
            tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if not {'users', 'sessions', 'patients', 'episodes', 'tasks', 'events', 'vitals', 'alerts', 'record_changes'} <= tables:
                raise ValueError('La base elegida no tiene el esquema del demo')
            if connection.execute('PRAGMA foreign_key_check').fetchone() is not None or not available(connection):
                raise ValueError('La base elegida requiere una copia LAB preparada y verificada')
    except (sqlite3.DatabaseError, HTTPException) as error:
        raise ValueError('La base elegida no es una copia LAB compatible y verificada') from error
    return path
