"""Deterministic login races on a disposable database; no running demo traffic."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
import sqlite3

import pytest
from fastapi import HTTPException

from app import auth, main


@pytest.fixture
def database(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "login.db")
    main.initialize_database()
    return main.get_connection


def test_password_checks_overlap_without_holding_writer_lock(database, monkeypatch):
    barrier = Barrier(2)
    verify = auth.verify_password

    def concurrent_verify(*args):
        barrier.wait(timeout=10)
        return verify(*args)

    monkeypatch.setattr(auth, "verify_password", concurrent_verify)
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(auth.login, "medico", "demo123", database) for _ in range(2)]
        results = [future.result(timeout=15) for future in futures]
    assert results[0]["access_token"] != results[1]["access_token"]
    for result in results:
        assert auth.validate_session("Bearer " + result["access_token"], database, main.utc_now)["role"] == "DOCTOR"


@pytest.mark.parametrize("change", ["reset", "deactivate", "reactivate", "permission"])
def test_account_change_during_password_check_rejects_stale_login(database, monkeypatch, change):
    entered, resume = Event(), Event()
    verify = auth.verify_password

    def paused_verify(*args):
        result = verify(*args)
        entered.set()
        assert resume.wait(timeout=10)
        return result

    monkeypatch.setattr(auth, "verify_password", paused_verify)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(auth.login, "medico", "demo123", database)
        try:
            assert entered.wait(timeout=10)
            connection = database()
            try:
                connection.execute("BEGIN IMMEDIATE")
                if change == "reset":
                    salt, hashed = main.hash_password("otra-clave-ficticia")
                    connection.execute("UPDATE users SET password_salt=?, password_hash=?, account_revision=account_revision+1 WHERE username='medico'", (salt, hashed))
                elif change == "permission":
                    connection.execute("UPDATE users SET can_coordinate=1, account_revision=account_revision+1 WHERE username='medico'")
                else:
                    connection.execute("UPDATE users SET active=0, account_revision=account_revision+1 WHERE username='medico'")
                connection.commit()
                if change == "reactivate":
                    connection.execute("UPDATE users SET active=1, account_revision=account_revision+1 WHERE username='medico'")
                    connection.commit()
            finally:
                connection.close()
        finally:
            resume.set()
        with pytest.raises(HTTPException) as error:
            future.result(timeout=15)
        assert error.value.status_code == 401
    connection = database()
    try:
        assert connection.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 0
    finally:
        connection.close()


def test_busy_database_returns_controlled_retry_without_session(database):
    lock = database()
    lock.execute("BEGIN IMMEDIATE")

    def short_connection():
        connection = database()
        # Only this test shortens the wait; production retains its existing limit.
        connection.execute("PRAGMA busy_timeout=1")
        return connection

    try:
        with pytest.raises(HTTPException) as error:
            auth.login("medico", "demo123", short_connection)
        assert error.value.status_code == 503
        assert "sqlite" not in error.value.detail.lower()
        assert lock.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 0
    finally:
        lock.rollback()
        lock.close()


def test_unrelated_database_error_is_not_disguised_as_busy(database):
    connection = database()
    connection.execute("DROP TABLE sessions")
    connection.commit()
    connection.close()
    with pytest.raises(sqlite3.OperationalError, match="no such table"):
        auth.login("medico", "demo123", database)
