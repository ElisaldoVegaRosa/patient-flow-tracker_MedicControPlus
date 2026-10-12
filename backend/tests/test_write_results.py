from test_write_operations import setup, keyed, rows  # noqa: F401
from app import main


def test_receipt_query_confirms_without_writing_or_replaying(setup):
    client, users, episode = setup
    key = "result-confirmation-0001"
    headers = keyed(users["medico"], key)
    before = len(rows("SELECT id FROM events"))
    assert client.get("/write-result", headers=headers).json() == {"status": "unknown"}
    response = client.post(f"/episodes/{episode['id']}/medical-evaluation", headers=headers,
                           json={"diagnosis": "Ficticio", "clinical_note": "Control"})
    assert response.status_code == 200
    found = client.get("/write-result", headers=headers)
    assert found.status_code == 200
    assert found.json()["status"] == "confirmed"
    assert found.json()["result"]["id"] == episode["id"]
    assert len(rows("SELECT id FROM events")) == before + 1
    assert len(rows("SELECT * FROM write_receipts")) == 1
    assert client.get("/write-result", headers=keyed(users["enfermeria"], key)).json() == {"status": "unknown"}


def test_receipt_query_requires_current_session_role_and_valid_key(setup):
    client, users, episode = setup
    key = "result-permissions-0001"
    headers = keyed(users["medico"], key)
    client.post(f"/episodes/{episode['id']}/medical-evaluation", headers=headers,
                json={"diagnosis": "Ficticio", "clinical_note": "Control"})
    assert client.get("/write-result", headers={"Idempotency-Key": key}).status_code == 401
    assert client.get("/write-result", headers=keyed(users["medico"], "bad")).status_code == 400
    connection = main.get_connection()
    connection.execute("UPDATE write_receipts SET role = 'NURSE', expires_at = '2000-01-01T00:00:00+00:00'")
    connection.commit()
    connection.close()
    assert client.get("/write-result", headers=headers).status_code == 403


def test_expired_receipt_can_be_consulted_without_reusing_key(setup):
    client, users, episode = setup
    headers = keyed(users["medico"], "expired-result-0001")
    client.post(f"/episodes/{episode['id']}/medical-evaluation", headers=headers,
                json={"diagnosis": "Ficticio", "clinical_note": "Control"})
    connection = main.get_connection()
    connection.execute("UPDATE write_receipts SET expires_at = '2000-01-01T00:00:00+00:00'")
    connection.commit()
    connection.close()
    assert client.get("/write-result", headers=headers).json()["status"] == "confirmed"
    assert len(rows("SELECT * FROM write_receipts")) == 1
