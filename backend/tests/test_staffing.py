"""Staff planning remains separate from clinical care and account administration."""
import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import pytest
from test_accounts import accounts, create, query, status  # noqa: F401
from app.staffing import migrate_staffing

REASON = "Prueba ficticia de planificacion"


def write(client, auth, path, data, current=None, method="POST", key=None):
    headers = {**auth, "Idempotency-Key": key or str(uuid4())}
    if current:
        headers["If-Match"] = current["version"]
    return client.request(method, path, headers=headers, json={"reason": REASON, **data})


def grant(client, admin, account, enabled=True):
    return write(client, admin, f"/accounts/{account['id']}/coordination", {"can_coordinate": enabled}, account, "PATCH")


@pytest.fixture
def staff(accounts):
    client, login, _ = accounts
    admin = login()
    doctor = create(client, admin).json()
    coordinator = grant(client, admin, doctor).json()
    nurse = create(client, admin, "enfermera.uno", "NURSE").json()
    return client, login, admin, coordinator, nurse, login(doctor["username"])


def shift(client, auth, coordinator, start="2026-10-20T20:00:00-04:00", end="2026-10-21T08:00:00-04:00"):
    return write(client, auth, "/staff/shifts", {"name": "Noche ficticia", "starts_at": start, "ends_at": end, "coordinator_id": coordinator["id"]})


def duty(client, auth, shift, person, area=1, key=None):
    return write(client, auth, "/staff/assignments", {"shift_id": shift["id"], "user_id": person["id"], "area_id": area}, key=key)


def transition(client, auth, resource, value, target):
    return write(client, auth, f"/staff/{resource}/{value['id']}/status", {"status": target}, value)


def test_permission_revokes_sessions_is_explicit_and_does_not_expand_clinical_role(accounts):
    client, login, administrator = accounts
    admin = login()
    nurse = create(client, admin, "enfermera.uno", "NURSE").json()
    old = login(nurse["username"])
    assert client.get("/staff/planning", headers=old).status_code == 403
    enabled = grant(client, admin, nurse)
    assert enabled.status_code == 200
    assert client.get("/auth/me", headers=old).status_code == 401
    new = login(nurse["username"])
    assert client.get("/auth/me", headers=new).json()["can_coordinate"] is True
    assert client.get("/staff/planning", headers=new).status_code == 200
    assert client.get("/accounts", headers=new).status_code == 403
    assert client.get("/supervisor/dashboard", headers=new).status_code == 403
    assert client.get("/staff/planning", headers=admin).status_code == 403
    assert client.get("/staff/mine", headers=admin).status_code == 403
    assert grant(client, admin, administrator).status_code == 409
    demo = next(item for item in client.get("/accounts", headers=admin).json()["accounts"] if item["username"] == "medico")
    assert grant(client, admin, demo).status_code == 409
    assert grant(client, new, nurse).status_code == 403
    disabled = grant(client, admin, enabled.json(), False)
    assert disabled.status_code == 200
    assert client.get("/auth/me", headers=new).status_code == 401
    assert client.get("/staff/planning", headers=login(nurse["username"])).status_code == 403


def test_full_lifecycle_preserves_clinical_records_and_own_view_is_private(staff):
    client, login, admin, coord, nurse, auth = staff
    tables = ("patients", "episodes", "events", "tasks", "alerts")
    before = {table: [tuple(row) for row in query(f"SELECT * FROM {table}")] for table in tables}
    planned = shift(client, auth, coord).json()
    assert planned["starts_at"] == "2026-10-21T00:00:00+00:00"
    own = duty(client, auth, planned, coord).json()
    other = duty(client, auth, planned, nurse).json()
    assert own["status"] == "PLANNED" and not own["effective_available"]
    assert transition(client, auth, "assignments", own, "AVAILABLE").status_code == 409
    active = transition(client, auth, "shifts", planned, "ACTIVE").json()
    current = client.get("/staff/planning", headers=auth).json()["assignments"]
    own, other = current
    assert transition(client, auth, "assignments", own, "AVAILABLE").json()["effective_available"]
    assert transition(client, auth, "shifts", active, "CLOSED").status_code == 409
    assert transition(client, auth, "assignments", other, "CANCELLED").status_code == 200
    available = client.get("/staff/mine", headers=auth).json()["assignments"][0]
    unavailable = transition(client, auth, "assignments", available, "UNAVAILABLE").json()
    assert not unavailable["effective_available"]
    available = transition(client, auth, "assignments", unavailable, "AVAILABLE").json()
    assert transition(client, auth, "assignments", available, "FINISHED").status_code == 200
    assert transition(client, auth, "shifts", active, "CLOSED").status_code == 200
    mine = client.get("/staff/mine", headers=login(nurse["username"])).json()
    assert set(mine) == {"assignments", "requested_by"}
    assert len(mine["assignments"]) == 1 and mine["assignments"][0]["user_id"] == nurse["id"]
    assert not mine["assignments"][0]["effective_available"]
    assert before == {table: [tuple(row) for row in query(f"SELECT * FROM {table}")] for table in tables}
    assert query("SELECT COUNT(*) FROM staff_changes")[0][0] == 10
    assert query("SELECT COUNT(*) FROM write_receipts WHERE scope LIKE '%/staff/%' AND episode_id IS NOT NULL")[0][0] == 0


def test_receipts_versions_and_permission_withdrawal(staff):
    client, login, admin, coord, _, auth = staff
    key = str(uuid4())
    first = write(client, auth, "/staff/areas", {"name": "Urgencias demo"}, key=key)
    assert first.status_code == 201
    assert write(client, auth, "/staff/areas", {"name": "Urgencias demo"}, key=key).json() == first.json()
    assert write(client, auth, "/staff/areas", {"name": "Otro nombre"}, key=key).status_code == 409
    assert client.get("/write-result", headers={**auth, "Idempotency-Key": key}).json()["result"] == first.json()
    path = f"/staff/areas/{first.json()['id']}"
    assert write(client, auth, path, {"name": "Nueva area"}, method="PATCH").status_code == 428
    changed = write(client, auth, path, {"name": "Nueva area"}, first.json(), "PATCH")
    assert changed.status_code == 200
    conflict = write(client, auth, path, {"name": "Nombre obsoleto"}, first.json(), "PATCH")
    assert conflict.status_code == 409 and conflict.json()["detail"]["code"] == "version_conflict"
    assert client.post("/staff/areas", headers=auth, json={"name": "Sin clave", "reason": REASON}).status_code == 428
    assert write(client, auth, "/staff/areas", {"name": " nueva AREA "}).status_code == 409
    grant(client, admin, coord, False)
    new = login(coord["username"])
    assert client.get("/write-result", headers={**new, "Idempotency-Key": key}).status_code == 403
    assert write(client, new, "/staff/areas", {"name": "Sin permiso"}).status_code == 403


@pytest.mark.parametrize("start,end", [("2026-10-20T20:00:00", "2026-10-21T08:00:00"), ("2026-10-20T20:00:00-04:00", "2026-10-20T08:00:00-04:00")])
def test_shift_dates_require_explicit_zone_and_next_day_for_midnight(staff, start, end):
    client, _, _, coord, _, auth = staff
    assert shift(client, auth, coord, start, end).status_code == 422
    assert not query("SELECT id FROM staff_shifts")


def test_active_shift_extension_is_audited_without_changing_clinical_work(staff):
    client, _, _, coord, nurse, auth = staff
    planned = shift(client, auth, coord).json()
    duty(client, auth, planned, nurse)
    active = transition(client, auth, "shifts", planned, "ACTIVE").json()
    assignment = client.get("/staff/planning", headers=auth).json()["assignments"][0]
    available = transition(client, auth, "assignments", assignment, "AVAILABLE").json()
    path = f"/staff/shifts/{active['id']}/extend"
    updated = write(client, auth, path, {"ends_at": "2026-10-21T09:00:00-04:00"}, active)
    assert updated.status_code == 200
    extended = updated.json()
    assert extended["status"] == "ACTIVE"
    assert extended["ends_at"] == "2026-10-21T13:00:00+00:00"
    assert extended["version"] != active["version"]
    own = client.get("/staff/mine", headers=auth).json()
    assert own["assignments"] == []
    nurse_auth = staff[1](nurse["username"])
    nurse_duty = client.get("/staff/mine", headers=nurse_auth).json()["assignments"][0]
    assert nurse_duty["ends_at"] == extended["ends_at"]
    assert nurse_duty["effective_available"] and nurse_duty["status"] == available["status"]
    audit = query("SELECT actor,action,reason,old_value,new_value FROM staff_changes WHERE resource='shift' AND target_id=? ORDER BY id DESC LIMIT 1", (active["id"],))[0]
    assert (audit["actor"], audit["action"], audit["reason"]) == (coord["username"], "EXTEND", REASON)
    assert json.loads(audit["old_value"])["ends_at"] == active["ends_at"]
    assert json.loads(audit["new_value"])["ends_at"] == extended["ends_at"]
    assert query("SELECT COUNT(*) FROM care_changes")[0][0] == 0


def test_extension_requires_current_coordinator_new_time_and_no_overlap(staff):
    client, login, admin, coord, nurse, auth = staff
    planned = shift(client, auth, coord).json()
    duty(client, auth, planned, nurse)
    path = f"/staff/shifts/{planned['id']}/extend"
    later = {"ends_at": "2026-10-21T09:00:00-04:00"}
    assert write(client, auth, path, later, planned).status_code == 409
    active = transition(client, auth, "shifts", planned, "ACTIVE").json()
    assert write(client, auth, path, later).status_code == 428
    assert write(client, auth, path, later, planned).status_code == 409
    assert write(client, auth, path, {"ends_at": "2026-10-21T09:00:00"}, active).status_code == 422
    assert write(client, auth, path, {"ends_at": "2026-10-21T08:00:00-04:00"}, active).status_code == 409
    other = grant(client, admin, nurse).json()
    assert other["can_coordinate"]
    assert write(client, login(nurse["username"]), path, later, active).status_code == 403
    next_shift = shift(client, auth, coord, "2026-10-21T10:00:00-04:00", "2026-10-21T14:00:00-04:00").json()
    assert duty(client, auth, next_shift, nurse).status_code == 201
    assert write(client, auth, path, {"ends_at": "2026-10-21T11:00:00-04:00"}, active).status_code == 409
    current_duty = next(item for item in client.get("/staff/planning", headers=auth).json()["assignments"] if item["shift_id"] == active["id"])
    available = transition(client, auth, "assignments", current_duty, "AVAILABLE").json()
    assert transition(client, auth, "assignments", available, "FINISHED").status_code == 200
    assert write(client, auth, path, {"ends_at": "2026-10-21T11:00:00-04:00"}, active).status_code == 409
    assert write(client, auth, path, later, active).status_code == 200


def test_overlap_is_atomic_adjacent_allowed_and_cancel_releases_time(staff):
    client, _, _, coord, nurse, auth = staff
    first = shift(client, auth, coord).json()
    barrier = Barrier(2)
    def run(_):
        barrier.wait()
        return duty(client, auth, first, nurse)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(run, range(2)))
    assert sorted(response.status_code for response in responses) == [201, 409]
    overlap = shift(client, auth, coord, "2026-10-21T07:00:00-04:00", "2026-10-21T10:00:00-04:00").json()
    assert duty(client, auth, overlap, nurse).status_code == 409
    adjacent = shift(client, auth, coord, "2026-10-21T08:00:00-04:00", "2026-10-21T12:00:00-04:00").json()
    assert duty(client, auth, adjacent, nurse).status_code == 201
    cancelled = transition(client, auth, "shifts", first, "CANCELLED")
    assert cancelled.status_code == 200
    audit = query("SELECT old_value,new_value FROM staff_changes WHERE action='SHIFT_CANCELLED'")[0]
    assert json.loads(audit["old_value"])["shift_status"] == "PLANNED"
    assert json.loads(audit["new_value"])["shift_status"] == "CANCELLED"
    assert duty(client, auth, first, nurse).status_code == 409
    assert duty(client, auth, overlap, coord).status_code == 201


def test_named_coordinator_assumption_active_shift_limit_and_area_guards(staff):
    client, login, admin, coord, nurse, auth = staff
    second = grant(client, admin, nurse).json()
    other = login(nurse["username"])
    planned = shift(client, auth, coord).json()
    d = duty(client, auth, planned, coord).json()
    area = client.get("/staff/planning", headers=auth).json()["areas"][0]
    assert write(client, auth, f"/staff/areas/{area['id']}", {"name": area["name"], "active": False}, area, "PATCH").status_code == 409
    assert transition(client, other, "shifts", planned, "ACTIVE").status_code == 403
    active = transition(client, auth, "shifts", planned, "ACTIVE").json()
    another = shift(client, other, second).json()
    assert transition(client, other, "shifts", another, "ACTIVE").status_code == 409
    assert duty(client, other, active, nurse).status_code == 403
    d = client.get("/staff/planning", headers=auth).json()["assignments"][0]
    assert write(client, auth, f"/staff/assignments/{d['id']}/area", {"area_id": 2}, d, "PATCH").status_code == 409
    grant(client, admin, coord, False)
    assert transition(client, other, "assignments", d, "AVAILABLE").status_code == 403
    current = client.get("/staff/planning", headers=other).json()["shifts"][0]
    assumed = write(client, other, f"/staff/shifts/{active['id']}/assume", {}, current)
    assert assumed.status_code == 200 and assumed.json()["coordinator_id"] == nurse["id"]
    d = client.get("/staff/planning", headers=other).json()["assignments"][0]
    available = transition(client, other, "assignments", d, "AVAILABLE").json()
    current_account = next(item for item in client.get("/accounts", headers=admin).json()["accounts"] if item["id"] == coord["id"])
    deactivated = status(client, admin, current_account, False)
    assert deactivated.status_code == 200
    mine = client.get("/staff/planning", headers=other).json()["assignments"][0]
    assert mine["status"] == "AVAILABLE" and not mine["effective_available"]
    assert transition(client, other, "assignments", available, "UNAVAILABLE").status_code == 409


def test_invalid_targets_and_payloads_do_not_mutate(staff):
    client, _, admin, coord, nurse, auth = staff
    planned = shift(client, auth, coord).json()
    demo = next(item for item in client.get("/accounts", headers=admin).json()["accounts"] if item["username"] == "medico")
    assert duty(client, auth, planned, demo).status_code == 409
    assert duty(client, auth, planned, nurse, 999).status_code == 404
    assert write(client, auth, "/staff/areas", {"name": "Nueva", "active": "true"}).status_code == 422
    assert write(client, auth, "/staff/areas", {"name": "Nueva", "assigned_to": "Paciente"}).status_code == 422
    assert write(client, admin, f"/accounts/{coord['id']}/coordination", {"can_coordinate": "true"}, coord, "PATCH").status_code == 422
    assert not query("SELECT id FROM staff_assignments")


def test_staff_migration_is_transactional_and_does_not_reseed_renamed_areas():
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    connection.execute("CREATE TABLE users(id INTEGER PRIMARY KEY)")
    connection.commit()
    connection.set_authorizer(lambda action, first, second, db, source: sqlite3.SQLITE_DENY if action == sqlite3.SQLITE_CREATE_TABLE and first == "staff_shifts" else sqlite3.SQLITE_OK)
    with pytest.raises(sqlite3.DatabaseError):
        migrate_staffing(connection)
    connection.set_authorizer(None)
    assert [row["name"] for row in connection.execute("PRAGMA table_info(users)")] == ["id"]
    assert not connection.execute("SELECT 1 FROM sqlite_schema WHERE name='staff_areas'").fetchone()
    migrate_staffing(connection)
    connection.execute("UPDATE staff_areas SET name='Triaje renombrado',name_key='triaje renombrado' WHERE id=1")
    connection.commit()
    migrate_staffing(connection)
    assert connection.execute("SELECT COUNT(*) FROM staff_areas").fetchone()[0] == 4
    assert connection.execute("SELECT name FROM staff_areas WHERE id=1").fetchone()[0] == "Triaje renombrado"
    connection.close()
