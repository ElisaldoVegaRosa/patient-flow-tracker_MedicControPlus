"""Recent history is cross-session, bounded, read-only and coordination-only."""
from datetime import date, datetime, timedelta, timezone
import json
import sqlite3

from test_staffing import staff, shift, duty, grant  # noqa: F401
from test_accounts import accounts, query  # noqa: F401
from app.staff_history import history_page


def test_history_window_pagination_and_dominican_dates():
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    connection.execute("CREATE TABLE staff_assignments(id INTEGER,shift_id INTEGER,user_id INTEGER)")
    connection.execute("CREATE TABLE staff_changes(id INTEGER,resource TEXT,target_id INTEGER,created_at TEXT)")
    rows = [(1, "shift", 2, "2026-10-18T23:59:59Z"), (2, "shift", 2, "2026-10-19T00:00:00Z"),
            (3, "shift", 2, "2026-10-25T03:59:59Z"), (4, "shift", 2, "2026-10-25T04:00:00Z"),
            (5, "shift", 2, "2026-10-26T00:00:00Z"), (6, "shift", 2, "2026-10-26T00:00:01Z")]
    connection.executemany("INSERT INTO staff_changes VALUES (?,?,?,?)", rows)
    now = "2026-10-26T00:00:00Z"
    recent = history_page(connection, now, page_size=2)
    assert recent["total"] == 4 and recent["has_more"]
    assert [r["id"] for r in recent["changes"]] == [5, 4]
    assert [r["id"] for r in history_page(connection, now, page=2, page_size=2)["changes"]] == [3, 2]
    assert history_page(connection, now, recent=False)["total"] == 5
    day = history_page(connection, now, recent=False, start_date=date(2026, 10, 25), end_date=date(2026, 10, 25))
    assert [r["id"] for r in day["changes"]] == [5, 4]
    connection.close()


def test_history_api_permissions_filters_other_authors_and_read_only(staff):
    client, login, admin, coord, nurse, auth = staff
    planned = shift(client, auth, coord).json()
    duty(client, auth, planned, nurse)
    query("UPDATE staff_changes SET actor=? WHERE resource='assignment'", ("otra.coordinacion",))
    before = [tuple(row) for row in query("SELECT * FROM staff_changes ORDER BY id")]
    recent = client.get("/staff/planning", headers=auth).json()
    assert any(row["actor"] == "otra.coordinacion" for row in recent["changes"])
    result = client.get("/staff/changes", headers=auth, params={"shift_id": planned["id"], "professional_id": nurse["id"], "action": "PLAN"}).json()
    assert result["total"] == 1 and result["changes"][0]["actor"] == "otra.coordinacion"
    snapshot = json.loads(result["changes"][0]["new_value"])
    assert snapshot["user_id"] == nurse["id"]
    assert client.get("/staff/changes", headers=auth, params={"page_size": 1}).json()["has_more"]
    for params in ({"page_size": 51}, {"page": 0}, {"shift_id": -1}, {"action": "bad"},
                   {"start_date": "2026-10-26", "end_date": "2026-10-25"}, {"end_date": "9999-12-31"}):
        assert client.get("/staff/changes", headers=auth, params=params).status_code == 422
    assert client.get("/staff/changes").status_code == 401
    assert client.get("/staff/changes", headers=admin).status_code == 403
    assert client.get("/staff/changes", headers=login(nurse["username"])).status_code == 403
    # Old events remain in the full history after leaving the recent window.
    old = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
    query("UPDATE staff_changes SET created_at=?", (old,))
    assert client.get("/staff/planning", headers=auth).json()["changes"] == []
    assert client.get("/staff/changes", headers=auth).json()["total"] == len(before)
    assert [tuple(row)[:7] for row in query("SELECT * FROM staff_changes ORDER BY id")] == [row[:7] for row in before]
    grant(client, admin, coord, False)
    assert client.get("/staff/changes", headers=auth).status_code == 401
    assert client.get("/staff/changes", headers=login(coord["username"])).status_code == 403
