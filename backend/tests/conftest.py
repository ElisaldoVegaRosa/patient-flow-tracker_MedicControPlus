"""Existing flow tests express a fresh intention; supply its current API version.

Concurrency tests pass an explicit frozen If-Match (or empty to test 428).
No production validation is bypassed: the version comes from GET /episodes/id.
"""
import pytest
from fastapi.testclient import TestClient
from app import main
from app.concurrency import guarded_resource


@pytest.fixture(autouse=True)
def current_versions_for_existing_flows(monkeypatch):
    original = TestClient.request

    def request(client, method, url, **kwargs):
        resource = guarded_resource(method.upper(), str(url))
        headers = dict(kwargs.get("headers") or {})
        if resource and not any(key.lower() == "if-match" for key in headers):
            kind, identifier = resource
            episode_id = identifier
            if kind in ("task", "task_result", "alert", "event_note"):
                connection = main.get_connection()
                try:
                    table = "tasks" if kind in ("task", "task_result") else "events" if kind == "event_note" else "alerts"
                    row = connection.execute(f"SELECT episode_id FROM {table} WHERE id = ?", (identifier,)).fetchone()
                    episode_id = row["episode_id"] if row else None
                finally:
                    connection.close()
            if episode_id is not None:
                response = original(client, "GET", f"/episodes/{episode_id}", headers=headers)
                if response.status_code == 200:
                    episode = response.json()
                    if kind in ("triage", "discharge", "reopen", "annul", "identity"):
                        version = episode["identity_version" if kind == "identity" else "triage_version" if kind == "triage" else "clinical_version"]
                    else:
                        collection = "tasks" if kind in ("task", "task_result") else "events" if kind == "event_note" else "alerts"
                        version = next(item["version"] for item in episode[collection] if item["id"] == identifier)
                    kwargs["headers"] = {**headers, "If-Match": version}
        return original(client, method, url, **kwargs)

    monkeypatch.setattr(TestClient, "request", request)
