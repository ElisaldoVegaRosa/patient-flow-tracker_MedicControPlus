import pytest
from fastapi.testclient import TestClient
from app import main


class Context(tuple):
    def __repr__(self):
        return "GeneralHistoryContext(temporary database)"


@pytest.fixture
def flow(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "general-history.db")
    with TestClient(main.app) as client:
        def login(name="medico"):
            response = client.post("/auth/login", json={"username": name, "password": "demo123"})
            assert response.status_code == 200
            return {"Authorization": "Bearer " + response.json()["access_token"]}
        connection = main.get_connection()
        try:
            patients = [("José Lara", "123456"), ("Ana Pérez", "DOC_%'"), ("José Lara", "OTHER")]
            for name, document in patients:
                connection.execute("INSERT INTO patients(name,birth_date,document) VALUES (?,'1990-01-01',?)", (name, document))
            rows = [(1, "CLOSED", "2026-11-24T03:59:59+00:00"),
                    (1, "CLOSED", "2026-11-24T04:00:00+00:00"),
                    (2, "ANNULLED", "2026-11-25T03:59:59+00:00"),
                    (3, "CLOSED", "2026-11-25T04:00:00+00:00"),
                    (1, "ACTIVE", None), (1, "CLOSED", None)]
            ids = []
            for patient, status, closed in rows:
                ids.append(connection.execute("INSERT INTO episodes(patient_id,qr_token,status,priority,location,started_at,closed_at) VALUES (?,?,?,3,'Consulta','2026-11-01T12:00:00Z',?)", (patient, f"general-qr-{len(ids)}", status, closed)).lastrowid)
            for _ in range(23):
                ids.append(connection.execute("INSERT INTO episodes(patient_id,qr_token,status,priority,location,started_at,closed_at) VALUES (1,?,'CLOSED',3,'Consulta','2026-11-01T12:00:00Z','2026-11-22T12:00:00Z')", (f"general-extra-{len(ids)}",)).lastrowid)
            connection.execute("INSERT INTO events(episode_id,type,note,username,created_at) VALUES (?,'TEST','Ficticio','medico','2026-11-24T12:00:00Z')", (ids[1],))
            connection.commit()
        finally:
            connection.close()
        yield Context((client, login, ids))


def get(flow, query=""):
    client, login, _ = flow
    response = client.get("/episodes/history" + query, headers=login())
    assert response.status_code == 200
    return response.json()


def test_bounded_pages_order_summaries_and_active_exclusion(flow):
    _, _, ids = flow
    first = get(flow)
    assert first["total"] == 28 and first["limit"] == 20 and first["offset"] == 0
    assert len(first["episodes"]) == 20
    assert [row["id"] for row in first["episodes"][:4]] == [ids[3], ids[2], ids[1], ids[0]]
    assert first["episodes"][2]["event_count"] == 1
    assert "events" not in first["episodes"][0]
    second = get(flow, "?offset=20")
    found = [row["id"] for row in first["episodes"] + second["episodes"]]
    assert len(found) == len(set(found)) == 28 and ids[4] not in found
    assert found[-1] == ids[5]  # Unknown closure sorts last and remains accessible.
    assert get(flow, "?offset=999")["episodes"] == []


def test_search_accents_word_order_documents_and_literal_characters(flow):
    _, _, ids = flow
    assert get(flow, "?q=lara+JOSE")["total"] == 27
    assert get(flow, "?q=perez")["episodes"][0]["id"] == ids[2]
    assert get(flow, "?q=123456")["total"] == 26
    assert get(flow, "?q=_%25%27")["total"] == 1
    assert get(flow, "?q=%27+OR+1%3D1--")["total"] == 0
    assert get(flow, f"?q=EP-00{ids[1]}")["episodes"][0]["id"] == ids[1]
    assert get(flow, f"?q={ids[2]}")["total"] >= 1  # Numeric values can also identify documents.
    assert get(flow, "?q=EP-999999999999999999999999999999999999")["total"] == 0


def test_inclusive_dominican_days_combined_status_and_unknown_dates(flow):
    _, _, ids = flow
    day = "?closed_from=2026-11-24&closed_to=2026-11-24"
    assert [row["id"] for row in get(flow, day)["episodes"]] == [ids[2], ids[1]]
    assert [row["id"] for row in get(flow, day + "&status=CLOSED&q=jose")["episodes"]] == [ids[1]]
    assert get(flow, day + "&status=ANNULLED")["total"] == 1
    assert get(flow, "?closed_from=9999-12-31&closed_to=9999-12-31")["total"] == 0


@pytest.mark.parametrize("query", ["limit=0", "limit=51", "offset=-1", "offset=2147483648", "status=ACTIVE", "status=ALL", "closed_from=invalid", "closed_to=2026-02-30", "closed_from=2026-11-25&closed_to=2026-11-24", "q=" + "x" * 101])
def test_rejects_invalid_bounds_and_filters(flow, query):
    client, login, _ = flow
    assert client.get("/episodes/history?" + query, headers=login()).status_code == 422


@pytest.mark.parametrize("username", ["recepcion", "medico", "supervisor", "enfermeria", "laboratorio", "archivo"])
def test_filtered_history_keeps_role_permissions(flow, username):
    client, login, _ = flow
    assert client.get("/episodes/history?limit=1").status_code == 401
    response = client.get("/episodes/history?q=lara&limit=1", headers=login(username))
    assert response.status_code == (200 if username in {"recepcion", "medico", "supervisor"} else 403)


def test_history_is_read_only_and_revoked_session_cannot_read(flow, monkeypatch):
    client, login, _ = flow
    headers = login()
    original = main.get_connection
    def readonly():
        connection = original()
        connection.execute("PRAGMA query_only = ON")
        return connection
    monkeypatch.setattr(main, "get_connection", readonly)
    assert client.get("/episodes/history?q=jose&limit=1", headers=headers).status_code == 200
    monkeypatch.setattr(main, "get_connection", original)
    assert client.post("/auth/logout", headers=headers).status_code == 200
    assert client.get("/episodes/history", headers=headers).status_code == 401
