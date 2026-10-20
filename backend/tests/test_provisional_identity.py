"""Identity changes keep clinical ownership and use existing atomic write guards."""
import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from fastapi.testclient import TestClient

from app import main
from app.patient_identity import migrate_patients


VERIFIED = {"name": "Persona Verificada", "birth_date": "1988-04-03", "document": "DEMO-ID-VERIFY",
            "reason": "Completar identidad provisional", "verification_source": "Documento ficticio cotejado"}


@pytest.fixture
def identity(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "provisional.db")
    with TestClient(main.app) as client:
        tokens = {}
        def auth(username="recepcion", **headers):
            if username not in tokens:
                response = client.post("/auth/login", json={"username": username, "password": "demo123"})
                assert response.status_code == 200
                tokens[username] = response.json()["access_token"]
            return {"Authorization": "Bearer " + tokens[username], **headers}
        yield client, auth


def rows(sql, args=()):
    connection = main.get_connection()
    try:
        result = connection.execute(sql, args).fetchall()
        connection.commit()
        return result
    finally:
        connection.close()


def provisional(client, auth, **data):
    response = client.post("/episodes", headers=auth(**{"Idempotency-Key": "provisional-create-test-key"}),
                           json={"provisional": True, **data})
    assert response.status_code == 201, response.text
    return response.json()


def verify(client, auth, episode, key="verify-identity-test-key", **data):
    return client.patch(f"/episodes/{episode['id']}/identity", json={**VERIFIED, **data},
                        headers=auth("archivo", **{"Idempotency-Key": key, "If-Match": episode["identity_version"]}))


def test_unknown_intake_preserves_nulls_unique_label_and_replay(identity):
    client, auth = identity
    first = provisional(client, auth)
    again = provisional(client, auth)
    assert again["id"] == first["id"]
    assert first["name"] == f"Paciente desconocido {first['patient_id']}"
    assert first["birth_date"] is None and first["document"] is None
    assert first["identity_status"] == "PROVISIONAL"
    second = client.post("/episodes", headers=auth(), json={"provisional": True}).json()
    assert second["name"] != first["name"]
    assert second["patient_id"] != first["patient_id"]
    assert len(rows("SELECT id FROM patients")) == 2


def test_partial_identity_is_preserved_and_known_intake_still_requires_fields(identity):
    client, auth = identity
    first = provisional(client, auth, name="Nombre comunicado", birth_date="1988-04-03")
    assert first["name"] == "Nombre comunicado" and first["document"] is None
    for payload in ({}, {"name": "Incompleto"}, {"provisional": True, "birth_date": "1900-02-31"},
                    {"provisional": True, "document": " "}, {"provisional": True, "patient_id": first["patient_id"]}):
        assert client.post("/episodes", headers=auth(), json=payload).status_code == 422


def test_verification_preserves_episode_qr_and_activity_and_replays_once(identity):
    client, auth = identity
    episode = provisional(client, auth)
    vital_response = client.post(f"/episodes/{episode['id']}/vitals", headers=auth("enfermeria"), json={
        "temperature": 37, "heart_rate": 80, "systolic": 120, "diastolic": 80, "spo2": 98, "respiratory_rate": 16,
    })
    assert vital_response.status_code == 201
    before = client.get(f"/episodes/{episode['id']}", headers=auth()).json()
    response = verify(client, auth, episode)
    assert response.status_code == 200, response.text
    result = response.json()
    assert (result["id"], result["patient_id"], result["qr_token"]) == (episode["id"], episode["patient_id"], episode["qr_token"])
    assert result["vitals"] == before["vitals"]
    assert result["identity_status"] == "VERIFIED"
    change = result["identity_changes"][0]
    assert json.loads(change["old_value"])["document"] is None
    assert json.loads(change["new_value"])["document"] == VERIFIED["document"]
    assert change["username"] == "archivo" and change["verification_source"] == VERIFIED["verification_source"]
    assert result["clinical_version"] != before["clinical_version"]
    assert verify(client, auth, episode).status_code == 200
    assert len(rows("SELECT id FROM patient_identity_changes")) == 1
    assert len(rows("SELECT id FROM events WHERE type = 'IDENTITY_VERIFIED'")) == 1
    pending = client.get("/identity/pending", headers=auth("archivo")).json()
    assert pending["patients"] == []


def test_only_archive_can_verify_and_only_archive_or_supervisor_read_pending(identity):
    client, auth = identity
    episode = provisional(client, auth)
    for username in ("recepcion", "enfermeria", "medico", "laboratorio", "supervisor"):
        response = client.patch(f"/episodes/{episode['id']}/identity", json=VERIFIED,
                                headers=auth(username, **{"If-Match": episode["identity_version"], "Idempotency-Key": "verify-role-test-key"}))
        assert response.status_code == 403
        expected = 200 if username == "supervisor" else 403
        assert client.get("/identity/pending", headers=auth(username)).status_code == expected
    assert client.get("/identity/pending").status_code == 401
    assert client.post("/episodes", headers=auth("archivo"), json={"provisional": True}).status_code == 403
    assert len(rows("SELECT id FROM patient_identity_changes")) == 0


@pytest.mark.parametrize("status", ["CLOSED", "ANNULLED"])
def test_pending_contains_closed_provisionals_and_verification_does_not_reopen(identity, status):
    client, auth = identity
    episode = provisional(client, auth)
    rows("UPDATE episodes SET status = ?, closed_at = '2026-10-19T00:00:00Z'", (status,))
    queue = client.get("/identity/pending", headers=auth("archivo")).json()
    assert queue["patients"][0]["episode_id"] == episode["id"]
    result = verify(client, auth, episode)
    assert result.status_code == 200 and result.json()["status"] == status


@pytest.mark.parametrize("same_document", [True, False])
def test_existing_identity_blocks_verification_without_merging(identity, same_document):
    client, auth = identity
    payload = {key: VERIFIED[key] for key in ("name", "birth_date", "document")}
    payload["document"] = VERIFIED["document"] if same_document else "OTRO-DOCUMENTO"
    assert client.post("/episodes", headers=auth(), json=payload).status_code == 201
    episode = provisional(client, auth)
    response = verify(client, auth, episode)
    assert response.status_code == 409 and response.json()["detail"]["code"] == "identity_requires_review"
    assert len(rows("SELECT id FROM patients")) == 2
    assert rows("SELECT identity_status FROM patients WHERE id = ?", (episode["patient_id"],))[0][0] == "PROVISIONAL"
    assert not rows("SELECT id FROM patient_identity_changes")


def test_required_guards_and_validation_do_not_write(identity):
    client, auth = identity
    episode = provisional(client, auth)
    url = f"/episodes/{episode['id']}/identity"
    assert client.patch(url, headers=auth("archivo", **{"If-Match": ""}), json=VERIFIED).status_code == 428
    assert client.patch(url, headers=auth("archivo", **{"If-Match": "", "Idempotency-Key": "verify-missing-version"}), json=VERIFIED).status_code == 428
    for field in ("reason", "verification_source", "document"):
        assert verify(client, auth, episode, **{field: " "}).status_code == 422
    assert verify(client, auth, {**episode, "identity_version": '"old"'}).status_code == 409
    assert not rows("SELECT id FROM patient_identity_changes")


def test_concurrent_confirmations_commit_only_one_and_stale_clinical_write_is_blocked(identity):
    client, auth = identity
    episode = provisional(client, auth)
    headers = [auth("archivo", **{"If-Match": episode["identity_version"], "Idempotency-Key": f"verify-racing-test-key-{n}"}) for n in range(2)]
    barrier = Barrier(2)
    def submit(index):
        barrier.wait(timeout=10)
        return client.patch(f"/episodes/{episode['id']}/identity", headers=headers[index], json=VERIFIED)
    with ThreadPoolExecutor(max_workers=2) as pool:
        result = list(pool.map(submit, range(2)))
    assert sorted(item.status_code for item in result) == [200, 409]
    assert len(rows("SELECT id FROM patient_identity_changes")) == 1
    assert client.post(f"/episodes/{episode['id']}/triage", headers=auth("enfermeria", **{"If-Match": episode["triage_version"]}),
                       json={"priority": 3, "location": "Observación", "assigned_to": "medico"}).status_code == 409


def test_legacy_migration_preserves_ids_foreign_keys_objects_and_sequence(tmp_path):
    connection = sqlite3.connect(tmp_path / "legacy.db")
    connection.row_factory = sqlite3.Row
    connection.executescript("""
        PRAGMA foreign_keys=ON;
        CREATE TABLE patients(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, birth_date TEXT NOT NULL, document TEXT NOT NULL);
        CREATE TABLE episodes(id INTEGER PRIMARY KEY, patient_id INTEGER REFERENCES patients(id), qr_token TEXT);
        CREATE INDEX idx_patient_document ON patients(document);
        CREATE TABLE audit(name TEXT);
        CREATE TRIGGER patient_name AFTER UPDATE OF name ON patients BEGIN INSERT INTO audit VALUES(NEW.name); END;
        INSERT INTO patients VALUES(7, 'Nombre previo', '1990-01-01', 'DOC-LEGACY');
        INSERT INTO patients VALUES(100, 'Eliminar', '1990-01-01', 'DOC-OTHER');
        DELETE FROM patients WHERE id=100;
        INSERT INTO episodes VALUES(9,7,'qr-sin-cambios');
    """)
    migrate_patients(connection)
    migrate_patients(connection)
    assert dict(connection.execute("SELECT * FROM episodes").fetchone()) == {"id": 9, "patient_id": 7, "qr_token": "qr-sin-cambios"}
    assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
    assert connection.execute("PRAGMA foreign_keys").fetchone()[0] == 1
    patient = connection.execute("SELECT * FROM patients").fetchone()
    assert patient["identity_status"] == "REGISTERED" and patient["document"] == "DOC-LEGACY"
    assert connection.execute("INSERT INTO patients(name, identity_status) VALUES('Provisional', 'PROVISIONAL')").lastrowid == 101
    connection.execute("UPDATE patients SET name='Actualizado' WHERE id=7")
    assert connection.execute("SELECT name FROM audit").fetchone()[0] == "Actualizado"
    assert connection.execute("SELECT name FROM sqlite_schema WHERE name='idx_patient_document'").fetchone()
    connection.close()


def test_archive_has_no_clinical_write_permissions(identity):
    client, auth = identity
    episode = provisional(client, auth)
    denied = client.post(f"/episodes/{episode['id']}/triage", headers=auth("archivo"),
                         json={"priority": 3, "location": "Observación", "assigned_to": "medico"})
    assert denied.status_code == 403
    denied = client.post(f"/episodes/{episode['id']}/vitals", headers=auth("archivo"), json={
        "temperature": 37, "heart_rate": 80, "systolic": 120, "diastolic": 80, "spo2": 98, "respiratory_rate": 16,
    })
    assert denied.status_code == 403


def test_verification_is_not_clinical_activity_for_annulment(identity):
    client, auth = identity
    episode = provisional(client, auth)
    result = verify(client, auth, episode)
    assert result.status_code == 200
    annulled = client.post(f"/episodes/{episode['id']}/annul", json={"reason": "Ingreso creado por error"},
                          headers=auth(**{"Idempotency-Key": "annul-verified-test-key"}))
    assert annulled.status_code == 200
    assert annulled.json()["status"] == "ANNULLED"
    assert len(annulled.json()["identity_changes"]) == 1


def test_reopen_unknown_does_not_compare_missing_documents_as_identity(identity):
    client, auth = identity
    episode = provisional(client, auth)
    rows("UPDATE episodes SET status = 'CLOSED'")
    response = client.post("/episodes", headers=auth(), json={"provisional": True})
    assert response.status_code == 201
    reopened = client.post(f"/episodes/{episode['id']}/reopen", json={"reason": "Alta de prueba incorrecta"},
                           headers=auth("medico", **{"Idempotency-Key": "reopen-unknown-test-key"}))
    assert reopened.status_code == 200
    assert reopened.json()["id"] == episode["id"]


def test_migration_rolls_back_on_failure_after_copy(tmp_path):
    class FailingConnection(sqlite3.Connection):
        fail = False
        def execute(self, sql, *args):
            if self.fail and sql.startswith("ALTER TABLE patients_identity_new"):
                raise sqlite3.OperationalError("simulated rename failure")
            return super().execute(sql, *args)
    connection = sqlite3.connect(tmp_path / "failure.db", factory=FailingConnection)
    connection.row_factory = sqlite3.Row
    connection.executescript("""PRAGMA foreign_keys=ON;
        CREATE TABLE patients(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, birth_date TEXT NOT NULL, document TEXT NOT NULL);
        INSERT INTO patients VALUES(7, 'Conservar', '1990-01-01', 'DOC');""")
    connection.fail = True
    with pytest.raises(sqlite3.OperationalError, match="simulated"):
        migrate_patients(connection)
    assert dict(connection.execute("SELECT * FROM patients").fetchone()) == {
        "id": 7, "name": "Conservar", "birth_date": "1990-01-01", "document": "DOC"}
    assert connection.execute("PRAGMA foreign_keys").fetchone()[0] == 1
    assert not connection.execute("SELECT name FROM sqlite_schema WHERE name='patients_identity_new'").fetchone()
    connection.close()
