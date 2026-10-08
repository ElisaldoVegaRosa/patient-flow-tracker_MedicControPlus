from pathlib import Path

from app import config, main


def test_default_database_path_stays_in_backend() -> None:
    assert config.DATABASE_PATH.resolve() == (
        Path(__file__).resolve().parents[1] / "clinical.db"
    )


def test_connection_keeps_main_database_override(tmp_path, monkeypatch) -> None:
    temporary_database = tmp_path / "configuration-test.db"
    monkeypatch.setattr(main, "DATABASE_PATH", temporary_database)

    connection = main.get_connection()
    try:
        database_file = connection.execute("PRAGMA database_list").fetchone()[2]
        assert Path(database_file).resolve() == temporary_database.resolve()
        assert connection.execute("PRAGMA foreign_keys").fetchone()[0] == 1
    finally:
        connection.close()

    assert config.DATABASE_PATH != temporary_database
