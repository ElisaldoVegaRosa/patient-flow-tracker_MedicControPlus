import pytest
from fastapi.testclient import TestClient

from app import main, database


class Context(tuple):
    def __repr__(self):
        return "PatientHistoryContext(temporary database)"


@pytest.fixture
def flow(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "patient-history.db")
    with TestClient(main.app) as client:
        users = {}
        def login(name):
            if name not in users:
                response = client.post("/auth/login", json={"username": name, "password": "demo123"})
                assert response.status_code == 200
                users[name] = {"Authorization": "Bearer " + response.json()["access_token"]}
            return users[name]

        connection = main.get_connection()
        try:
            # Simulate separate legacy identity records with identical demographics.
            for _ in range(2):
                connection.execute("INSERT INTO patients(name,birth_date,document) VALUES ('Paciente historial ficticio','1990-01-01','HISTORY-SAME')")
            def episode(patient, status, start, reason=None):
                return connection.execute(
                    "INSERT INTO episodes(patient_id,qr_token,status,priority,location,started_at,closed_at,consultation_reason) VALUES (?,?,?,3,'Consulta',?,?,?)",
                    (patient, f"history-qr-{patient}-{status}-{start}-{reason}", status, start,
                     "2026-11-23T14:00:00+00:00" if status != "ACTIVE" else None, reason),
                ).lastrowid
            source = episode(1, "ACTIVE", "2026-11-24T12:00:00+00:00", "Motivo actual ficticio")
            visits = []
            for index, day in enumerate([1, 2, 3, 3, 5, 6, 7]):
                start = f"2026-11-{day:02}T12:00:00+00:00"
                identifier = episode(1, "ANNULLED" if index == 2 else "CLOSED", start, None if index == 0 else f"Motivo previo ficticio {index}")
                visits.append((start, identifier))
            other_active = episode(1, "ACTIVE", "2026-11-20T12:00:00+00:00", "Otro activo, no historico")
            other_identity = episode(2, "CLOSED", "2026-11-22T12:00:00+00:00", "Otra ficha con igual documento")
            connection.commit()
            expected = [identifier for _, identifier in sorted(visits, reverse=True)]
        finally:
            connection.close()
        yield Context((client, login, source, expected, other_active, other_identity))


def test_same_patient_only_stable_pagination_and_safe_summary(flow):
    client, login, source, expected, other_active, other_identity = flow
    path = f"/episodes/{source}/patient-history"
    first = client.get(path + "?limit=5&offset=0", headers=login("medico"))
    assert first.status_code == 200
    data = first.json()
    assert data | {"episodes": []} == {"source_episode_id": source, "patient_id": 1, "total": 7,
                                          "limit": 5, "offset": 0, "requested_by": "medico", "episodes": []}
    assert [row["id"] for row in data["episodes"]] == expected[:5]
    assert set(data["episodes"][0]) == {"id", "status", "priority", "location", "started_at", "closed_at", "consultation_reason"}
    second = client.get(path + "?limit=5&offset=5", headers=login("medico")).json()
    assert [row["id"] for row in second["episodes"]] == expected[5:]
    assert any(row["consultation_reason"] is None for row in second["episodes"])
    all_ids = [row["id"] for row in data["episodes"] + second["episodes"]]
    assert source not in all_ids and other_active not in all_ids and other_identity not in all_ids
    assert len(all_ids) == len(set(all_ids)) == 7
    assert any(row["status"] == "ANNULLED" for row in data["episodes"] + second["episodes"])
    assert client.get(path + "?offset=999", headers=login("medico")).json()["episodes"] == []


@pytest.mark.parametrize("username", ["recepcion", "medico", "supervisor", "enfermeria", "laboratorio", "archivo"])
def test_history_permissions_match_existing_general_history(flow, username):
    client, login, source, *_ = flow
    path = f"/episodes/{source}/patient-history"
    assert client.get(path).status_code == 401
    headers = login(username)
    allowed = username in {"recepcion", "medico", "supervisor"}
    response = client.get(path, headers=headers)
    assert response.status_code == (200 if allowed else 403)
    if allowed:
        assert response.json()["requested_by"] == username
    else:
        assert client.get("/episodes/99999/patient-history", headers=headers).status_code == 403


def test_closed_source_excludes_itself_and_empty_history_is_not_global(flow):
    client, login, source, expected, _, other_identity = flow
    headers = login("recepcion")
    closed_source = expected[0]
    closed = client.get(f"/episodes/{closed_source}/patient-history", headers=headers).json()
    assert closed["total"] == 6
    assert closed_source not in [row["id"] for row in closed["episodes"]]
    assert source not in [row["id"] for row in closed["episodes"]]
    empty = client.get(f"/episodes/{other_identity}/patient-history", headers=headers).json()
    assert empty["patient_id"] == 2 and empty["total"] == 0 and empty["episodes"] == []
    assert client.get("/episodes/99999/patient-history", headers=headers).status_code == 404


def test_provisional_identity_does_not_trigger_demographic_matching(flow):
    client, login, source, expected, *_ = flow
    connection = main.get_connection()
    connection.execute("UPDATE patients SET identity_status='PROVISIONAL', document=NULL, birth_date=NULL WHERE id=1")
    connection.commit()
    connection.close()
    response = client.get(f"/episodes/{source}/patient-history", headers=login("medico"))
    assert response.status_code == 200
    assert [row["id"] for row in response.json()["episodes"]] == expected


def test_query_is_read_only_and_uses_patient_index(flow, monkeypatch):
    client, login, source, *_ = flow
    headers = login("supervisor")
    original = database.get_connection
    def read_only(path):
        connection = original(path)
        connection.execute("PRAGMA query_only=ON")
        return connection
    with monkeypatch.context() as patch:
        patch.setattr(database, "get_connection", read_only)
        result = client.get(f"/episodes/{source}/patient-history", headers=headers)
    assert result.status_code == 200
    connection = main.get_connection()
    try:
        assert connection.execute("SELECT COUNT(*) FROM events").fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM record_changes").fetchone()[0] == 0
        plan = connection.execute("EXPLAIN QUERY PLAN SELECT id FROM episodes WHERE patient_id=1 AND id!=1 AND status IN ('CLOSED','ANNULLED') ORDER BY started_at DESC,id DESC LIMIT 5").fetchall()
        assert any("idx_episodes_patient_history" in row["detail"] for row in plan)
    finally:
        connection.close()


def test_pagination_bounds_and_revoked_session_are_enforced(flow):
    client, login, source, *_ = flow
    headers = login("medico")
    path = f"/episodes/{source}/patient-history"
    for query in ["limit=0", "limit=51", "offset=-1", "offset=9223372036854775808", "limit=1.5"]:
        assert client.get(path + "?" + query, headers=headers).status_code == 422
    assert client.get("/episodes/9223372036854775808/patient-history", headers=headers).status_code == 422
    connection = main.get_connection()
    connection.execute("UPDATE sessions SET revoked_at='2026-11-24T12:00:00+00:00'")
    connection.commit()
    connection.close()
    assert client.get(path, headers=headers).status_code == 401
