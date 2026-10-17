import pytest
import sqlite3
from fastapi.testclient import TestClient

from app import main
from app.concurrency import etag


@pytest.fixture
def flow(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "lifecycle.db")
    with TestClient(main.app) as client:
        def user(name):
            response = client.post("/auth/login", json={"username": name, "password": "demo123"})
            assert response.status_code == 200
            return {"Authorization": "Bearer " + response.json()["access_token"]}
        users = {name: user(name) for name in ("recepcion", "medico", "laboratorio", "supervisor", "enfermeria")}
        yield client, users


def arrival(client, users, document="LIFECYCLE-01"):
    response = client.post("/episodes", headers=users["recepcion"], json={
        "name": "Paciente Ficticio Ciclo", "birth_date": "1990-01-01", "document": document,
    })
    assert response.status_code == 201
    return response.json()


def keyed(headers, suffix):
    return headers | {"Idempotency-Key": f"lifecycle-{suffix}-012345"}


def test_lab_correction_and_annul_keep_original_and_replay(flow):
    client, users = flow
    episode = arrival(client, users)
    eid = episode["id"]
    created = client.post(f"/episodes/{eid}/tasks", headers=users["medico"],
                          json={"title": "Prueba ficticia", "service": "LAB"}).json()
    task = created["tasks"][0]
    completed = client.patch(f"/tasks/{task['id']}/complete", headers=users["laboratorio"],
                             json={"result": "Primer resultado ficticio"}).json()
    path = f"/tasks/{task['id']}/result"
    correction = {"action": "CORRECT", "value": "Resultado corregido ficticio", "reason": "Error de transcripción"}
    baseline = completed["tasks"][0]["version"]
    headers = keyed(users["laboratorio"], "result-a") | {"If-Match": baseline}
    assert client.patch(path, headers=users["medico"] | {"If-Match": baseline}, json=correction).status_code == 403
    assert client.patch(path, headers=users["laboratorio"] | {"If-Match": baseline}, json=correction).status_code == 428
    first = client.patch(path, headers=headers, json=correction)
    assert first.status_code == 200
    assert first.json()["tasks"][0]["result"] == "Resultado corregido ficticio"
    assert first.json()["record_changes"][0]["old_value"] == "Primer resultado ficticio"
    assert first.json()["record_changes"][0]["reason"] == "Error de transcripción"
    assert client.patch(path, headers=headers, json=correction).status_code == 200
    assert len(client.get(f"/episodes/{eid}", headers=users["supervisor"]).json()["record_changes"]) == 1
    assert client.patch(path, headers=keyed(users["laboratorio"], "result-b") | {"If-Match": baseline},
                        json=correction).status_code == 409
    latest = client.get(f"/episodes/{eid}", headers=users["laboratorio"]).json()
    annulled = client.patch(path, headers=keyed(users["laboratorio"], "result-c") | {"If-Match": latest["tasks"][0]["version"]},
                           json={"action": "ANNUL", "reason": "Resultado no válido"})
    assert annulled.status_code == 200
    assert annulled.json()["tasks"][0]["status"] == "PENDING"
    assert len(annulled.json()["record_changes"]) == 2
    assert client.get("/lab/orders?status=PENDING", headers=users["laboratorio"]).json()["orders"][0]["id"] == task["id"]


def test_note_correction_closed_episode_and_reopen(flow):
    client, users = flow
    episode = arrival(client, users)
    eid = episode["id"]
    evaluated = client.post(f"/episodes/{eid}/medical-evaluation", headers=users["medico"], json={
        "diagnosis": "Ficticio", "clinical_note": "Nota inicial ficticia", "disposition": "CONTINUE_OBSERVATION",
    }).json()
    event = evaluated["events"][0]
    closed = client.post(f"/episodes/{eid}/discharge", headers=users["medico"], json={"note": "Alta ficticia"}).json()
    note_path = f"/events/{event['id']}/note"
    corrected = client.patch(note_path, headers=keyed(users["medico"], "note-a") | {"If-Match": event["version"]},
                             json={"action": "CORRECT", "value": "Nota corregida ficticia", "reason": "Rectificación clínica"})
    assert corrected.status_code == 200
    assert corrected.json()["status"] == "CLOSED"
    assert corrected.json()["events"][1]["note"] == event["note"]
    assert corrected.json()["events"][1]["current_note"] == "Nota corregida ficticia"
    assert client.patch(note_path, headers=keyed(users["laboratorio"], "note-b") | {"If-Match": event["version"]},
                        json={"action": "ANNUL", "reason": "Nota equivocada"}).status_code == 403
    stale = client.post(f"/episodes/{eid}/reopen", headers=keyed(users["supervisor"], "reopen-a") | {"If-Match": closed["clinical_version"]},
                        json={"reason": "Alta registrada por error"})
    assert stale.status_code == 409
    current = corrected.json()
    reopened = client.post(f"/episodes/{eid}/reopen", headers=keyed(users["supervisor"], "reopen-b") | {"If-Match": current["clinical_version"]},
                           json={"reason": "Alta registrada por error"})
    assert reopened.status_code == 200
    assert reopened.json()["status"] == "ACTIVE"
    assert reopened.json()["events"][0]["type"] == "EPISODE_REOPENED"
    assert client.post(f"/episodes/{eid}/reopen", headers=keyed(users["supervisor"], "reopen-b") | {"If-Match": current["clinical_version"]},
                       json={"reason": "Alta registrada por error"}).status_code == 200
    discharge_event = next(item for item in reopened.json()["events"] if item["type"] == "DISCHARGE")
    discharge_note = client.patch(f"/events/{discharge_event['id']}/note",
                                  headers=keyed(users["medico"], "note-discharge") | {"If-Match": discharge_event["version"]},
                                  json={"action": "CORRECT", "value": "Nota de alta rectificada", "reason": "Error en indicación"})
    assert discharge_note.status_code == 200
    revised = next(item for item in discharge_note.json()["events"] if item["id"] == discharge_event["id"])
    assert revised["note"] == "Alta ficticia"
    assert revised["current_note"] == "Nota de alta rectificada"
    annul_note = client.patch(f"/events/{discharge_event['id']}/note",
                              headers=keyed(users["medico"], "note-discharge-annul") | {"If-Match": revised["version"]},
                              json={"action": "ANNUL", "reason": "Nota inválida"})
    assert annul_note.status_code == 200
    assert next(item for item in annul_note.json()["events"] if item["id"] == discharge_event["id"])["annulled"] is True


def test_reopen_rejects_other_active_matching_identity(flow):
    client, users = flow
    original = arrival(client, users)
    eid = original["id"]
    closed = client.post(f"/episodes/{eid}/discharge", headers=users["medico"], json={"note": "Alta ficticia"}).json()
    candidate = client.post("/episodes", headers=users["recepcion"], json={
        "name": original["name"], "birth_date": original["birth_date"], "document": original["document"],
    }).json()["detail"]["candidates"][0]
    assert client.post("/episodes", headers=users["recepcion"], json={
        "name": original["name"], "birth_date": original["birth_date"], "document": original["document"],
        "patient_id": candidate["id"],
    }).status_code == 201
    blocked = client.post(f"/episodes/{eid}/reopen", headers=keyed(users["medico"], "reopen-c") | {"If-Match": closed["clinical_version"]},
                          json={"reason": "Alta equivocada"})
    assert blocked.status_code == 409
    assert client.get(f"/episodes/{eid}", headers=users["medico"]).json()["status"] == "CLOSED"


def test_annul_arrival_only_without_clinical_activity(flow):
    client, users = flow
    episode = arrival(client, users)
    eid = episode["id"]
    path = f"/episodes/{eid}/annul"
    assert client.post(path, headers=keyed(users["medico"], "annul-a") | {"If-Match": episode["clinical_version"]},
                       json={"reason": "Ingreso por error"}).status_code == 403
    result = client.post(path, headers=keyed(users["recepcion"], "annul-b") | {"If-Match": episode["clinical_version"]},
                         json={"reason": "Ingreso por error"})
    assert result.status_code == 200
    assert result.json()["status"] == "ANNULLED"
    assert eid not in [item["id"] for item in client.get("/dashboard", headers=users["recepcion"]).json()["patients"]]
    assert eid in [item["id"] for item in client.get("/episodes/history", headers=users["recepcion"]).json()["episodes"]]
    assert client.post(path, headers=keyed(users["recepcion"], "annul-b") | {"If-Match": episode["clinical_version"]},
                       json={"reason": "Ingreso por error"}).status_code == 200
    active = arrival(client, users, "LIFECYCLE-02")
    client.post(f"/episodes/{active['id']}/medical-evaluation", headers=users["medico"], json={
        "diagnosis": "Ficticio", "clinical_note": "Evaluación ficticia",
    })
    assert client.post(f"/episodes/{active['id']}/annul", headers=keyed(users["supervisor"], "annul-c"),
                       json={"reason": "Ingreso por error"}).status_code == 409


def test_closed_result_annul_is_historical_without_reopening_task(flow):
    client, users = flow
    episode = arrival(client, users)
    eid = episode["id"]
    task = client.post(f"/episodes/{eid}/tasks", headers=users["medico"],
                       json={"title": "Orden ficticia", "service": "LAB"}).json()["tasks"][0]
    completed = client.patch(f"/tasks/{task['id']}/complete", headers=users["laboratorio"],
                             json={"result": "Resultado ficticio"}).json()
    client.post(f"/episodes/{eid}/discharge", headers=users["medico"], json={"note": "Alta ficticia"})
    result = client.patch(f"/tasks/{task['id']}/result", headers=keyed(users["laboratorio"], "closed-result") |
                          {"If-Match": completed["tasks"][0]["version"]},
                          json={"action": "ANNUL", "reason": "Resultado equivocado"})
    assert result.status_code == 200
    assert result.json()["status"] == "CLOSED"
    assert result.json()["tasks"][0]["status"] == "ANNULLED"
    assert result.json()["record_changes"][0]["old_value"] == "Resultado ficticio"
    assert client.get("/lab/orders?status=PENDING", headers=users["laboratorio"]).json()["orders"] == []
    assert client.get("/lab/orders?status=ALL", headers=users["laboratorio"]).json()["orders"][0]["record_changes"][0]["old_value"] == "Resultado ficticio"


def test_existing_database_records_survive_journal_creation(tmp_path, monkeypatch):
    path = tmp_path / "before-lifecycle.db"
    connection = sqlite3.connect(path)
    connection.executescript("""
        CREATE TABLE patients (id INTEGER PRIMARY KEY, name TEXT NOT NULL, birth_date TEXT NOT NULL, document TEXT NOT NULL);
        CREATE TABLE episodes (id INTEGER PRIMARY KEY, patient_id INTEGER NOT NULL, qr_token TEXT NOT NULL,
            status TEXT NOT NULL, priority INTEGER NOT NULL, location TEXT NOT NULL, assigned_to TEXT,
            started_at TEXT NOT NULL, closed_at TEXT);
        CREATE TABLE events (id INTEGER PRIMARY KEY, episode_id INTEGER NOT NULL, type TEXT NOT NULL,
            username TEXT NOT NULL, created_at TEXT NOT NULL, note TEXT);
        CREATE TABLE tasks (id INTEGER PRIMARY KEY, episode_id INTEGER NOT NULL, title TEXT NOT NULL,
            service TEXT NOT NULL, status TEXT NOT NULL, result TEXT, created_at TEXT NOT NULL);
        INSERT INTO patients VALUES (1, 'Paciente previo', '1990-01-01', 'PREVIOUS-01');
        INSERT INTO episodes VALUES (1, 1, 'qr-previo', 'CLOSED', 3, 'Recepción', NULL, '2026-10-01T00:00:00+00:00', '2026-10-02T00:00:00+00:00');
        INSERT INTO events VALUES (1, 1, 'DISCHARGE', 'medico', '2026-10-02T00:00:00+00:00', 'Alta previa');
        INSERT INTO tasks VALUES (1, 1, 'Orden previa', 'LAB', 'COMPLETED', 'Resultado previo', '2026-10-01T00:00:00+00:00');
    """)
    connection.close()
    monkeypatch.setattr(main, "DATABASE_PATH", path)
    with TestClient(main.app) as client:
        token = client.post("/auth/login", json={"username": "laboratorio", "password": "demo123"}).json()["access_token"]
        headers = {"Authorization": "Bearer " + token}
        old = client.get("/episodes/1", headers=headers)
        assert old.status_code == 200
        assert old.json()["events"][0]["note"] == "Alta previa"
        assert old.json()["tasks"][0]["result"] == "Resultado previo"
        assert old.json()["record_changes"] == []
        detail = old.json()
        # A pre-upgrade form's If-Match must not conflict merely because the
        # read projection gained history and note-version fields.
        previous_fingerprint = etag([
            detail["triage_version"], detail["closed_at"], detail["vitals"],
            [{key: value for key, value in task.items() if key not in {"version", "last_change_id"}}
             for task in detail["tasks"]], detail["alerts"],
            [{key: value for key, value in event.items() if key not in {"version", "current_note", "annulled"}}
             for event in detail["events"]],
        ])
        assert detail["clinical_version"] == previous_fingerprint
