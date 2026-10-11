from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier

import pytest
from fastapi.testclient import TestClient

from app import main
from test_flow import login


@pytest.fixture
def setup(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "writes.db")
    with TestClient(main.app) as client:
        users = {name: login(client, name) for name in ["recepcion", "enfermeria", "medico", "laboratorio", "supervisor"]}
        episode = client.post("/episodes", headers=users["recepcion"], json={"name": "Ficticio", "birth_date": "1990-01-01", "document": "TEST-WRITES"}).json()
        yield client, users, episode


def keyed(headers, key="operation-53b-test-key"):
    return {**headers, "Idempotency-Key": key}


def rows(sql, params=()):
    connection = main.get_connection()
    try:
        return connection.execute(sql, params).fetchall()
    finally:
        connection.close()


@pytest.mark.parametrize("kind", ["arrival", "evaluation", "order", "vitals", "triage", "discharge", "demo", "rules"])
def test_replay_lost_response_without_duplicate_effect(setup, kind):
    client, users, episode = setup
    eid = episode["id"]
    cases = {
        "arrival": ("/episodes", "recepcion", {"name": "Nuevo ficticio", "birth_date": "1990-01-01", "document": "TEST-REPLAY"}),
        "evaluation": (f"/episodes/{eid}/medical-evaluation", "medico", {"clinical_note": "Nota ficticia", "diagnosis": "Control"}),
        "order": (f"/episodes/{eid}/tasks", "medico", {"title": "Control ficticio", "service": "LAB"}),
        "vitals": (f"/episodes/{eid}/vitals", "enfermeria", {"temperature": 37, "heart_rate": 80, "systolic": 120, "diastolic": 80, "spo2": 98, "respiratory_rate": 16}),
        "triage": (f"/episodes/{eid}/triage", "enfermeria", {"priority": 3, "location": "Triaje"}),
        "discharge": (f"/episodes/{eid}/discharge", "medico", {"note": "Alta ficticia"}),
        "demo": ("/demo/seed", "supervisor", None),
        "rules": ("/rules/evaluate", "supervisor", None),
    }
    path, username, payload = cases[kind]
    headers = keyed(users[username])
    first = client.post(path, headers=headers, json=payload)
    assert first.status_code in (200, 201), first.text
    counts = [len(rows(f"SELECT id FROM {table}")) for table in ["patients", "episodes", "events", "tasks", "vitals", "alerts", "alert_history"]]
    second = client.post(path, headers=headers, json=payload)
    assert second.status_code == first.status_code
    assert second.json() == first.json()
    assert counts == [len(rows(f"SELECT id FROM {table}")) for table in ["patients", "episodes", "events", "tasks", "vitals", "alerts", "alert_history"]]
    receipt = dict(rows("SELECT * FROM write_receipts")[0])
    assert "Nota ficticia" not in str(receipt)
    assert "Alta ficticia" not in str(receipt)
    assert receipt["summary"] is None if kind not in ("demo", "rules") else receipt["episode_id"] is None


def test_new_evaluation_intent_allows_identical_content(setup):
    client, users, episode = setup
    path = f"/episodes/{episode['id']}/medical-evaluation"
    payload = {"clinical_note": "Nota ficticia", "diagnosis": "Control"}
    for key in ["first-intent-53b-key", "second-intent-53b-key"]:
        assert client.post(path, headers=keyed(users["medico"], key), json=payload).status_code == 200
    assert len(rows("SELECT id FROM events WHERE type = 'MEDICAL_EVALUATION'")) == 2


def test_key_conflicts_expiry_and_current_permissions(setup):
    client, users, episode = setup
    path = f"/episodes/{episode['id']}/medical-evaluation"
    payload = {"clinical_note": "Nota ficticia", "diagnosis": "Control"}
    headers = keyed(users["medico"])
    assert client.post(path, headers=headers, json=payload).status_code == 200
    assert client.post(path, headers=headers, json={**payload, "diagnosis": "Distinto"}).status_code == 409
    assert client.post(f"/episodes/{episode['id']}/discharge", headers=headers, json={"note": "Alta"}).status_code == 409
    connection = main.get_connection()
    connection.execute("UPDATE users SET role = 'RECEPTION' WHERE username = 'medico'")
    connection.commit()
    connection.close()
    assert client.post(path, headers=headers, json=payload).status_code == 403
    connection = main.get_connection()
    connection.execute("UPDATE users SET role = 'DOCTOR' WHERE username = 'medico'")
    connection.execute("UPDATE write_receipts SET expires_at = ?", ((datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat(),))
    connection.commit()
    connection.close()
    assert client.post(path, headers=headers, json=payload).status_code == 409
    assert len(rows("SELECT id FROM events WHERE type = 'MEDICAL_EVALUATION'")) == 1
    assert client.post("/auth/logout", headers=users["medico"]).status_code == 200
    assert client.post(path, headers=headers, json=payload).status_code == 401


@pytest.mark.parametrize("kind", ["arrival", "evaluation", "order", "vitals", "triage", "task", "alert", "discharge", "demo", "rules"])
def test_concurrent_connections_record_effect_once(setup, kind):
    client, users, episode = setup
    eid = episode["id"]
    if kind == "task":
        task = client.post(f"/episodes/{eid}/tasks", headers=users["medico"], json={"title": "Control", "service": "LAB"}).json()["tasks"][0]
        method, path, payload, username = "PATCH", f"/tasks/{task['id']}/complete", {"result": "Ficticio"}, "laboratorio"
    elif kind == "alert":
        connection = main.get_connection()
        now = main.utc_now()
        cursor = connection.execute("INSERT INTO alerts (episode_id, reason, severity, status, created_at, updated_at) VALUES (?, 'Ficticia', 'HIGH', 'ACTIVE', ?, ?)", (eid, now, now))
        aid = cursor.lastrowid
        connection.commit()
        connection.close()
        method, path, payload, username = "PATCH", f"/alerts/{aid}", {"status": "ACKNOWLEDGED"}, "enfermeria"
    else:
        method = "POST"
        path, payload, username = {
            "arrival": ("/episodes", {"name": "Concurrente", "birth_date": "1990-01-01", "document": "TEST-CONCURRENT"}, "recepcion"),
            "evaluation": (f"/episodes/{eid}/medical-evaluation", {"clinical_note": "Nota ficticia", "diagnosis": "Control"}, "medico"),
            "order": (f"/episodes/{eid}/tasks", {"title": "Control", "service": "LAB"}, "medico"),
            "vitals": (f"/episodes/{eid}/vitals", {"temperature": 37, "heart_rate": 80, "systolic": 120, "diastolic": 80, "spo2": 98, "respiratory_rate": 16}, "enfermeria"),
            "triage": (f"/episodes/{eid}/triage", {"priority": 3, "location": "Triaje"}, "enfermeria"),
            "discharge": (f"/episodes/{eid}/discharge", {"note": "Alta ficticia"}, "medico"),
            "demo": ("/demo/seed", None, "supervisor"),
            "rules": ("/rules/evaluate", None, "supervisor"),
        }[kind]
    if kind == "rules":
        connection = main.get_connection()
        connection.execute("UPDATE episodes SET started_at = ? WHERE id = ?", ((datetime.now(timezone.utc) - timedelta(minutes=40)).isoformat(), eid))
        connection.commit()
        connection.close()
    # Transitions are protected even for legacy clients without operation keys.
    headers = users[username] if kind in ("task", "alert", "discharge", "demo", "rules") else keyed(users[username])
    barrier = Barrier(2)
    def submit():
        with TestClient(main.app) as concurrent:
            barrier.wait(timeout=10)
            return concurrent.request(method, path, headers=headers, json=payload)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: submit(), range(2)))
    expected = [200, 409] if kind in ("task", "alert", "discharge") else ([201, 201] if kind in ("arrival", "order", "vitals") else [200, 200])
    assert sorted(result.status_code for result in results) == expected
    event = {"task": "TASK_COMPLETED", "alert": "ALERT_ACKNOWLEDGED", "discharge": "DISCHARGE", "evaluation": "MEDICAL_EVALUATION", "order": "TASK_CREATED", "vitals": "VITALS_RECORDED", "triage": "TRIAGE"}.get(kind)
    if event:
        assert len(rows("SELECT id FROM events WHERE type = ?", (event,))) == 1
    if kind == "arrival":
        assert len(rows("SELECT id FROM patients WHERE document = 'TEST-CONCURRENT'")) == 1
    if kind == "rules":
        assert len(rows("SELECT id FROM alerts")) == 1
        assert len(rows("SELECT id FROM events WHERE type = 'ALERT_CREATED'")) == 1
    if kind == "demo":
        assert len(rows("SELECT id FROM patients WHERE document LIKE 'DEMO-SEED-%'")) == 12


def test_failure_rolls_back_effects_and_receipt(setup, monkeypatch):
    client, users, episode = setup
    from app.write_operations import TransactionConnection
    def fail_after_write(self):
        raise RuntimeError("Fictitious failure before commit")
    with monkeypatch.context() as changes:
        changes.setattr(TransactionConnection, "commit", fail_after_write)
        with pytest.raises(RuntimeError):
            client.post(f"/episodes/{episode['id']}/medical-evaluation", headers=keyed(users["medico"]), json={"clinical_note": "Nota ficticia", "diagnosis": "Control"})
    assert not rows("SELECT * FROM write_receipts")
    assert not rows("SELECT id FROM events WHERE type = 'MEDICAL_EVALUATION'")
    assert client.post(f"/episodes/{episode['id']}/medical-evaluation", headers=keyed(users["medico"]), json={"clinical_note": "Nota ficticia", "diagnosis": "Control"}).status_code == 200


@pytest.mark.parametrize("kind", ["task", "alert"])
def test_transition_replay_with_key_and_new_transition_rejected(setup, kind):
    client, users, episode = setup
    eid = episode["id"]
    if kind == "task":
        task = client.post(f"/episodes/{eid}/tasks", headers=users["medico"], json={"title": "Control", "service": "LAB"}).json()["tasks"][0]
        path, payload, username, event = f"/tasks/{task['id']}/complete", {"result": "Ficticio"}, "laboratorio", "TASK_COMPLETED"
    else:
        connection = main.get_connection()
        now = main.utc_now()
        cursor = connection.execute("INSERT INTO alerts (episode_id, reason, severity, status, created_at, updated_at) VALUES (?, 'Ficticia', 'HIGH', 'ACTIVE', ?, ?)", (eid, now, now))
        aid = cursor.lastrowid
        connection.commit()
        connection.close()
        path, payload, username, event = f"/alerts/{aid}", {"status": "ACKNOWLEDGED"}, "enfermeria", "ALERT_ACKNOWLEDGED"
    headers = keyed(users[username])
    first = client.patch(path, headers=headers, json=payload)
    second = client.patch(path, headers=headers, json=payload)
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert client.patch(path, headers=keyed(users[username], "new-transition-key-53b"), json=payload).status_code == 409
    assert len(rows("SELECT id FROM events WHERE type = ?", (event,))) == 1


def test_invalid_key_and_closed_episode_do_not_record_receipts(setup):
    client, users, episode = setup
    path = f"/episodes/{episode['id']}/medical-evaluation"
    payload = {"clinical_note": "Nota ficticia", "diagnosis": "Control"}
    assert client.post(path, headers=keyed(users["medico"], "short"), json=payload).status_code == 400
    assert client.post(f"/episodes/{episode['id']}/discharge", headers=users["medico"], json={"note": "Alta"}).status_code == 200
    assert client.post(path, headers=keyed(users["medico"]), json=payload).status_code == 409
    assert not rows("SELECT * FROM write_receipts")


def test_same_key_is_scoped_to_current_identity(setup):
    client, users, episode = setup
    payload = {"name": "Ficticio independiente", "birth_date": "1990-01-01", "document": "TEST-IDENTITY"}
    ids = [client.post("/episodes", headers=keyed(users[name]), json=payload).json()["id"] for name in ["recepcion", "supervisor"]]
    assert ids[0] != ids[1]
    assert len(rows("SELECT * FROM write_receipts")) == 2


def test_busy_write_releases_and_can_be_explicitly_retried(setup, monkeypatch):
    client, users, episode = setup
    original = main.database.get_connection
    def fast_timeout(path):
        connection = original(path)
        connection.execute("PRAGMA busy_timeout = 20")
        return connection
    monkeypatch.setattr(main.database, "get_connection", fast_timeout)
    locked = original(main.DATABASE_PATH)
    locked.execute("BEGIN IMMEDIATE")
    path = f"/episodes/{episode['id']}/medical-evaluation"
    payload = {"clinical_note": "Nota ficticia", "diagnosis": "Control"}
    try:
        assert client.post(path, headers=keyed(users["medico"]), json=payload).status_code == 503
    finally:
        locked.rollback()
        locked.close()
    assert not rows("SELECT * FROM write_receipts")
    assert client.post(path, headers=keyed(users["medico"]), json=payload).status_code == 200
