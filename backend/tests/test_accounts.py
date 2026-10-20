"""Personal accounts, administrative isolation, receipts, revocation and migration."""
import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from app import main
from app.accounts import bootstrap_admin, migrate_accounts
from app.routes.accounts import AccountCreate

PASSWORD = "Demo-Account-Only-42"


def query(sql, values=()):
    c = main.get_connection()
    try:
        rows = c.execute(sql, values).fetchall()
        c.commit()
        return rows
    finally:
        c.close()


@pytest.fixture
def accounts(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "accounts.db")
    with TestClient(main.app) as client:
        c = main.get_connection()
        try:
            administrator = bootstrap_admin(c, "admin.demo", "Administrador ficticio", PASSWORD,
                                            "Alta local ficticia", main.utc_now)
        finally:
            c.close()
        def login(username="admin.demo", password=PASSWORD):
            response = client.post("/auth/login", json={"username": username, "password": password})
            assert response.status_code == 200
            return {"Authorization": "Bearer " + response.json()["access_token"]}
        yield client, login, administrator


def create(client, headers, username="medico.uno", role="DOCTOR", key=None, **changes):
    return client.post("/accounts", headers={**headers, "Idempotency-Key": key or str(uuid4())}, json={
        "username": username, "display_name": "Profesional ficticio", "password": PASSWORD,
        "role": role, "reason": "Prueba de cuenta personal", **changes,
    })


def status(client, headers, account, active, key=None, **changes):
    return client.patch(f"/accounts/{account['id']}/status", headers={**headers,
        "Idempotency-Key": key or str(uuid4()), "If-Match": account["version"]},
        json={"active": active, "reason": "Prueba de estado", **changes})


def test_two_personal_accounts_keep_distinct_authorship_and_permissions(accounts):
    client, login, _ = accounts
    admin = login()
    one = create(client, admin).json()
    two = create(client, admin, "medico.dos").json()
    reception = login("recepcion", "demo123")
    episode = client.post("/episodes", headers=reception, json={"provisional": True}).json()
    for account in (one, two):
        auth = login(account["username"])
        me = client.get("/auth/me", headers=auth).json()
        assert me == {"username": account["username"], "display_name": "Profesional ficticio", "role": "DOCTOR"}
        response = client.post(f"/episodes/{episode['id']}/medical-evaluation", headers=auth, json={
            "diagnosis": "Caso ficticio", "clinical_note": "Evaluacion ficticia individual", "decision": "CONTINUE_OBSERVATION",
        })
        assert response.status_code == 200, response.text
        assert client.get("/accounts", headers=auth).status_code == 403
    authors = {row[0] for row in query("SELECT username FROM events WHERE type='MEDICAL_EVALUATION'")}
    assert authors == {one["username"], two["username"]}


def test_admin_cannot_read_or_mutate_clinical_routes(accounts):
    client, login, _ = accounts
    admin = login()
    episode = client.post("/episodes", headers=login("recepcion", "demo123"), json={"provisional": True}).json()
    for path in ("/dashboard", f"/episodes/{episode['id']}", f"/scan/{episode['qr_token']}",
                 "/episodes/history", "/lab/orders", "/supervisor/dashboard", "/identity/pending",
                 f"/episodes/{episode['id']}/presence/abcdefgh-12345678"):
        assert client.get(path, headers=admin).status_code == 403, path
    assert client.post("/episodes", headers=admin, json={"provisional": True}).status_code == 403
    assert client.post("/demo/seed", headers=admin).status_code == 403
    assert client.post("/rules/evaluate", headers=admin).status_code == 403
    assert client.get("/auth/me", headers=admin).status_code == 200


@pytest.mark.parametrize("role", ["recepcion", "archivo", "enfermeria", "medico", "laboratorio", "supervisor"])
def test_non_admin_cannot_manage_or_read_account_audit(accounts, role):
    client, login, administrator = accounts
    auth = login(role, "demo123")
    assert client.get("/accounts", headers=auth).status_code == 403
    assert create(client, auth).status_code == 403
    assert status(client, auth, administrator, False).status_code == 403


def test_create_replay_receipt_and_audit_never_store_credentials(accounts):
    client, login, _ = accounts
    admin = login()
    key = str(uuid4())
    first = create(client, admin, key=key)
    assert first.status_code == 201
    assert create(client, admin, key=key).json() == first.json()
    assert create(client, admin, key=key, password="Different-Password-44").status_code == 409
    receipt = client.get("/write-result", headers={**admin, "Idempotency-Key": key}).json()
    assert receipt["status"] == "confirmed" and receipt["result"] == first.json()
    assert len(query("SELECT id FROM users WHERE username='medico.uno'")) == 1
    assert len(query("SELECT id FROM account_changes WHERE action='CREATE'")) == 1
    for text in (client.get("/accounts", headers=admin).text, json.dumps(receipt),
                 json.dumps([dict(row) for row in query("SELECT * FROM write_receipts")]),
                 json.dumps([dict(row) for row in query("SELECT * FROM account_changes")])):
        assert PASSWORD not in text
        assert "password_hash" not in text and "password_salt" not in text
    assert query("SELECT episode_id FROM write_receipts")[0][0] is None


def test_deactivation_revokes_all_sessions_and_reactivation_does_not_revive(accounts):
    client, login, _ = accounts
    admin = login()
    account = create(client, admin).json()
    sessions = [login(account["username"]), login(account["username"])]
    before = query("SELECT COUNT(*) FROM events")[0][0]
    inactive = status(client, admin, account, False)
    assert inactive.status_code == 200
    for auth in sessions:
        assert client.get("/auth/me", headers=auth).status_code == 401
    active = status(client, admin, inactive.json(), True)
    assert active.status_code == 200
    for auth in sessions:
        assert client.get("/auth/me", headers=auth).status_code == 401
    assert client.get("/auth/me", headers=login(account["username"])).status_code == 200
    assert query("SELECT COUNT(*) FROM events")[0][0] == before


def test_password_reset_revokes_and_versions_protect_concurrent_edits(accounts):
    client, login, _ = accounts
    admin = login()
    account = create(client, admin).json()
    old = login(account["username"])
    key = str(uuid4())
    path = f"/accounts/{account['id']}/password"
    headers = {**admin, "Idempotency-Key": key, "If-Match": account["version"]}
    payload = {"password": "New-Demo-Password-66", "reason": "Restablecimiento ficticio"}
    response = client.post(path, headers=headers, json=payload)
    assert response.status_code == 200
    assert client.post(path, headers=headers, json=payload).json() == response.json()
    assert client.get("/auth/me", headers=old).status_code == 401
    assert client.post("/auth/login", json={"username": account["username"], "password": PASSWORD}).status_code == 401
    assert client.get("/auth/me", headers=login(account["username"], payload["password"])).status_code == 200
    assert status(client, admin, account, False).status_code == 409
    assert len(query("SELECT id FROM account_changes WHERE action='RESET_PASSWORD'")) == 1


def test_guards_unique_names_immutable_profiles_and_validation_do_not_leak_password(accounts):
    client, login, admin_account = accounts
    admin = login()
    model = AccountCreate(username="safe.user", display_name="Ficticio", role="NURSE", password=PASSWORD, reason="Prueba de representacion")
    assert PASSWORD not in repr(model) and PASSWORD not in str(model)
    account = create(client, admin).json()
    assert create(client, admin).status_code == 409
    assert create(client, admin, "bad user").status_code == 422
    assert create(client, admin, "proper.user", role="ROOT").status_code == 422
    secret = "SecretRejected"
    response = create(client, admin, "proper.user", password=secret, active=True)
    assert response.status_code == 422 and secret not in response.text
    assert "input" not in response.json()["detail"][0]
    malformed_login = client.post("/auth/login", json={"username": "admin.demo", "password": {"secret": secret}})
    assert malformed_login.status_code == 422 and secret not in malformed_login.text
    assert status(client, admin, account, "false").status_code == 422
    assert status(client, admin, account, False, role="ACCOUNT_ADMIN").status_code == 422
    assert client.post("/accounts", headers=admin, json={"username":"test.user","display_name":"Test", "role":"NURSE","password":PASSWORD,"reason":"test"}).status_code == 428
    assert client.patch(f"/accounts/{account['id']}/status", headers={**admin,"Idempotency-Key":str(uuid4())}, json={"active":False,"reason":"test"}).status_code == 428
    assert status(client, admin, admin_account, False).status_code == 409
    assert client.post(f"/accounts/{admin_account['id']}/password", headers={**admin,"Idempotency-Key":str(uuid4()),"If-Match":admin_account["version"]},json={"password":PASSWORD,"reason":"test"}).status_code == 409


def test_concurrent_admin_deactivation_preserves_one_active_and_denies_stale_actor(accounts):
    client, login, first = accounts
    first_auth = login()
    second = create(client, first_auth, "admin.second", role="ACCOUNT_ADMIN").json()
    second_auth = login(second["username"])
    barrier = Barrier(2)
    def run(index):
        barrier.wait(timeout=10)
        return status(client, first_auth if index == 0 else second_auth, second if index == 0 else first, False)
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(run, (0, 1)))
    assert sorted(result.status_code for result in results) == [200, 401]
    assert query("SELECT COUNT(*) FROM users WHERE role='ACCOUNT_ADMIN' AND active=1")[0][0] == 1


def test_clinical_write_rechecks_session_after_auth_dependency(accounts, monkeypatch):
    client, login, _ = accounts
    auth = login("recepcion", "demo123")
    original = main.auth.validate_session
    def authenticate(*args, **kwargs):
        user = original(*args, **kwargs)
        query("UPDATE users SET active=0 WHERE username='recepcion'")
        return user
    monkeypatch.setattr(main.auth, "validate_session", authenticate)
    before = query("SELECT COUNT(*) FROM episodes")[0][0]
    assert client.post("/episodes", headers=auth, json={"provisional":True}).status_code == 401
    assert query("SELECT COUNT(*) FROM episodes")[0][0] == before


def test_bootstrap_once_preserves_demo_users_and_migration_is_repeatable(accounts):
    _, _, _ = accounts
    before = [dict(row) for row in query("SELECT * FROM users")]
    main.initialize_database()
    assert [dict(row) for row in query("SELECT * FROM users")] == before
    c = main.get_connection()
    try:
        with pytest.raises(ValueError, match="Ya existe"):
            bootstrap_admin(c,"another.admin","Otro admin",PASSWORD,"Alta duplicada",main.utc_now)
    finally:
        c.close()
    assert len(query("SELECT id FROM account_changes WHERE action='BOOTSTRAP'")) == 1


def test_account_migration_rolls_back_both_columns_on_failure(tmp_path):
    class Failing(sqlite3.Connection):
        def execute(self, sql, *args):
            if "ADD COLUMN account_revision" in sql:
                raise sqlite3.OperationalError("migration-test-failure")
            return super().execute(sql, *args)
    c = sqlite3.connect(tmp_path / "legacy.db", factory=Failing)
    c.row_factory = sqlite3.Row
    c.execute("CREATE TABLE users(id INTEGER PRIMARY KEY, username TEXT)")
    with pytest.raises(sqlite3.OperationalError, match="migration-test"):
        migrate_accounts(c)
    assert [row["name"] for row in c.execute("PRAGMA table_info(users)")] == ["id", "username"]
    c.close()
