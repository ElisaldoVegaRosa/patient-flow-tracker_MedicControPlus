"""Summary contract, bounded reads and cleanup without a running server."""
import sqlite3

import pytest

from app import main
from app.routes.dashboard import create_router


def endpoint(factory):
    def forbidden_detail(*args):
        raise AssertionError("The general dashboard must not load episode details")
    router = create_router(factory, main.utc_now, forbidden_detail, lambda: {}, lambda *roles: lambda: {})
    return next(route.endpoint for route in router.routes if route.path == "/dashboard")


@pytest.fixture
def database(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "summary.db")
    main.initialize_database()
    return main.get_connection


def add_episode(connection, identifier, priority=3, status="ACTIVE", started="2026-01-01"):
    connection.execute("INSERT INTO patients(id,name,identity_status) VALUES (?,?,'PROVISIONAL')", (identifier, f"Ficticio {identifier}"))
    connection.execute("INSERT INTO episodes(id,patient_id,qr_token,status,priority,location,started_at) VALUES (?,?,?,?,?,'Consulta',?)",
                       (identifier, identifier, f"qr-{identifier}", status, priority, started))


@pytest.mark.parametrize("size", [1, 67])
def test_summary_has_bounded_reads_and_no_detail(database, size):
    connection = database()
    for identifier in range(1, size + 1):
        add_episode(connection, identifier)
    connection.commit()
    statements = []
    connection.set_trace_callback(statements.append)
    result = endpoint(lambda: connection)({"username": "demo"})
    assert len(result["patients"]) == size
    assert len(statements) == 2  # One summary + one absent-LAB schema check.
    assert all(sql.lstrip().upper().startswith("SELECT") for sql in statements)
    assert result["patients"][0] == {
        "id": 1, "name": "Ficticio 1", "identity_status": "PROVISIONAL",
        "priority": 3, "location": "Consulta", "open_alert_count": 0, "pending_task_count": 0,
    }
    with pytest.raises(sqlite3.ProgrammingError, match="closed"):
        connection.execute("SELECT 1")


def test_summary_counts_without_cross_product_excludes_closed_and_preserves_order(database):
    connection = database()
    for args in [(1, 3), (2, 1, "ACTIVE", "2026-01-02"), (3, 1), (4, 1, "CLOSED"), (5, 1, "ANNULLED")]:
        add_episode(connection, *args)
    for identifier in (1, 4, 5):
        for state in ("ACTIVE", "ACKNOWLEDGED", "ESCALATED", "RESOLVED"):
            connection.execute("INSERT INTO alerts(episode_id,reason,severity,status,created_at,updated_at) VALUES (?,'Demo','HIGH',?,'2026-01-01','2026-01-01')", (identifier, state))
        for state in ("PENDING", "PENDING", "COMPLETED", "CANCELLED"):
            connection.execute("INSERT INTO tasks(episode_id,title,service,status,created_at) VALUES (?,'Demo','LAB',?,'2026-01-01')", (identifier, state))
    connection.commit()
    result = endpoint(lambda: connection)({"username": "demo"})
    assert result["active"] == 3 and result["open_alerts"] == 3
    assert [p["id"] for p in result["patients"]] == [3, 2, 1]
    assert [p["pending_task_count"] for p in result["patients"]] == [0, 0, 2]
    assert [p["open_alert_count"] for p in result["patients"]] == [0, 0, 3]


def test_connection_closed_on_summary_failure(database):
    connection = database()
    connection.execute("DROP TABLE alerts")
    with pytest.raises(sqlite3.OperationalError):
        endpoint(lambda: connection)({"username": "demo"})
    with pytest.raises(sqlite3.ProgrammingError, match="closed"):
        connection.execute("SELECT 1")
