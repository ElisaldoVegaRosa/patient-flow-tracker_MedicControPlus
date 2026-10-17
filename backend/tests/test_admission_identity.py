from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import hashlib
import json

import pytest
from fastapi.testclient import TestClient
from app import main


DATA = {"name": "Paciente Identidad", "birth_date": "1990-01-01", "document": "IDENTITY-64"}


@pytest.fixture
def admission(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "identity.db")
    with TestClient(main.app) as client:
        def headers(username="recepcion", key=None):
            token = client.post("/auth/login", json={"username": username, "password": "demo123"}).json()["access_token"]
            result = {"Authorization": "Bearer " + token}
            if key:
                result["Idempotency-Key"] = key
            return result
        yield client, headers


def execute(sql, parameters=()):
    connection = main.get_connection()
    try:
        result = connection.execute(sql, parameters).fetchall()
        connection.commit()
        return result
    finally:
        connection.close()


def review(response):
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "patient_identity_review"
    return response.json()["detail"]["candidates"]


def test_active_identity_blocks_new_intentions_and_keeps_legacy_replay(admission):
    client, headers = admission
    auth = headers(key="identity64-original-key")
    first = client.post("/episodes", headers=auth, json=DATA)
    assert first.status_code == 201
    # This is the pre-selection payload shape, including its original defaults.
    payload = {"data": DATA | {"priority": 3, "location": "Recepción"}}
    expected = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    assert execute("SELECT fingerprint FROM write_receipts")[0][0] == expected
    assert client.post("/episodes", headers=auth, json=DATA).json()["id"] == first.json()["id"]
    candidates = review(client.post("/episodes", headers=headers(), json=DATA))
    assert candidates[0]["matches"] is True
    assert candidates[0]["active_episode_ids"] == [first.json()["id"]]
    review(client.post("/episodes", headers=headers(), json=DATA | {"patient_id": candidates[0]["id"]}))
    assert len(execute("SELECT id FROM patients")) == 1
    assert len(execute("SELECT id FROM episodes")) == 1
    assert len(execute("SELECT id FROM events")) == 1
    assert len(execute("SELECT operation_key FROM write_receipts")) == 1


def test_closed_patient_requires_selection_then_reuses_patient_and_receipt(admission):
    client, headers = admission
    first = client.post("/episodes", headers=headers(), json=DATA).json()
    execute("UPDATE episodes SET status = 'CLOSED' WHERE id = ?", (first["id"],))
    candidates = review(client.post("/episodes", headers=headers(), json=DATA))
    assert candidates[0]["active_episode_ids"] == []
    selected = DATA | {"patient_id": candidates[0]["id"], "location": "Nueva ubicación"}
    auth = headers("supervisor", "identity64-reentry-key")
    result = client.post("/episodes", headers=auth, json=selected)
    assert result.status_code == 201
    assert result.json()["id"] != first["id"]
    assert client.post("/episodes", headers=auth, json=selected).json()["id"] == result.json()["id"]
    assert client.post("/episodes", headers=auth, json=selected | {"patient_id": 999}).status_code == 409
    assert len(execute("SELECT id FROM patients")) == 1
    assert len(execute("SELECT id FROM episodes")) == 2
    assert execute("SELECT status FROM episodes WHERE id = ?", (first["id"],))[0][0] == "CLOSED"


@pytest.mark.parametrize("change", [{"name": "Otra persona"}, {"birth_date": "1991-01-01"}])
def test_document_alone_never_merges_or_opens_active_episode(admission, change):
    client, headers = admission
    client.post("/episodes", headers=headers(), json=DATA)
    altered = DATA | change
    candidates = review(client.post("/episodes", headers=headers(), json=altered))
    assert candidates[0]["matches"] is False
    review(client.post("/episodes", headers=headers(), json=altered | {"patient_id": candidates[0]["id"]}))
    assert len(execute("SELECT id FROM patients")) == 1
    assert len(execute("SELECT id FROM episodes")) == 1


def test_stale_selection_and_changed_document_are_rechecked(admission):
    client, headers = admission
    review(client.post("/episodes", headers=headers(), json=DATA | {"patient_id": 999}))
    client.post("/episodes", headers=headers(), json=DATA)
    pid = execute("SELECT id FROM patients")[0][0]
    review(client.post("/episodes", headers=headers(), json=DATA | {"patient_id": pid, "document": "OTHER"}))
    assert len(execute("SELECT id FROM episodes")) == 1


def test_comparison_preserves_original_fields_and_legacy_duplicate_fiches(admission):
    client, headers = admission
    first = client.post("/episodes", headers=headers(), json=DATA).json()
    execute("UPDATE episodes SET status = 'CLOSED'")
    execute("INSERT INTO patients (name, birth_date, document) VALUES (?, ?, ?)", tuple(DATA.values()))
    variants = DATA | {"name": "  paciente identidad  ", "document": " IDENTITY-64 "}
    candidates = review(client.post("/episodes", headers=headers(), json=variants))
    assert len(candidates) == 2 and all(item["matches"] for item in candidates)
    chosen = candidates[1]["id"]
    created = client.post("/episodes", headers=headers(), json=variants | {"patient_id": chosen})
    assert created.status_code == 201
    # An active matching identity in a different historical fiche still blocks admission.
    review(client.post("/episodes", headers=headers(), json=DATA | {"patient_id": candidates[0]["id"]}))
    assert execute("SELECT name FROM patients WHERE id = ?", (chosen,))[0][0] == DATA["name"]
    assert len(execute("SELECT id FROM patients")) == 2
    assert len(execute("SELECT id FROM episodes")) == 2
    assert created.json()["id"] != first["id"]


@pytest.mark.parametrize("existing", [False, True])
def test_concurrent_distinct_intentions_create_only_one_active_episode(admission, existing):
    client, headers = admission
    data = dict(DATA)
    if existing:
        client.post("/episodes", headers=headers(), json=data)
        execute("UPDATE episodes SET status = 'CLOSED'")
        data["patient_id"] = execute("SELECT id FROM patients")[0][0]
    auth = [headers(key=f"identity64-racing-key-{n}") for n in range(2)]
    barrier = Barrier(2)
    def submit(index):
        with TestClient(main.app) as concurrent:
            barrier.wait(timeout=10)
            return concurrent.post("/episodes", headers=auth[index], json=data)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(submit, range(2)))
    assert sorted(result.status_code for result in results) == [201, 409]
    assert len(execute("SELECT id FROM patients")) == 1
    assert len(execute("SELECT id FROM episodes WHERE status = 'ACTIVE'")) == 1
    assert len(execute("SELECT operation_key FROM write_receipts")) == 1


@pytest.mark.parametrize("username", ["enfermeria", "medico", "laboratorio"])
def test_review_does_not_disclose_candidates_to_other_roles(admission, username):
    client, headers = admission
    client.post("/episodes", headers=headers(), json=DATA)
    result = client.post("/episodes", headers=headers(username), json=DATA)
    assert result.status_code == 403
    assert "candidates" not in result.text


def test_document_outer_unicode_whitespace_is_consistent(admission):
    client, headers = admission
    stored = DATA | {"document": "\t" + DATA["document"] + "\u00a0"}
    client.post("/episodes", headers=headers(), json=stored)
    candidates = review(client.post("/episodes", headers=headers(), json=DATA))
    assert candidates[0]["matches"] is True
    assert candidates[0]["document"] == stored["document"]
    assert len(execute("SELECT id FROM patients")) == 1
