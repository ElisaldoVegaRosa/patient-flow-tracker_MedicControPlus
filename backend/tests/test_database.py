import sqlite3

import pytest

from app.database import get_connection


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
