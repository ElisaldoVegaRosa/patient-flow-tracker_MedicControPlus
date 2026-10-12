"""Resource versions derived from persisted state, checked inside atomic_write."""
import hashlib
import json
import re

from fastapi import HTTPException


def etag(value):
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return '"' + hashlib.sha256(encoded.encode()).hexdigest() + '"'


def task_version(task):
    return etag({key: task.get(key) for key in (
        "id", "episode_id", "title", "service", "status", "result", "created_at", "due_at",
    )})


def annotate_versions(episode):
    # Historical clinical events distinguish successive writes even if values repeat.
    clinical_events = [event for event in episode["events"] if event["type"] != "QR_SCANNED"]
    triage_events = [event["id"] for event in clinical_events if event["type"] == "TRIAGE"]
    episode["triage_version"] = etag([
        episode["id"], episode["status"], episode["priority"], episode["location"],
        episode.get("assigned_to"), triage_events,
    ])
    episode["clinical_version"] = etag([
        episode["triage_version"], episode.get("closed_at"), episode["vitals"],
        episode["tasks"], episode["alerts"], clinical_events,
    ])
    for task in episode["tasks"]:
        task["version"] = task_version(task)
    for alert in episode["alerts"]:
        alert["version"] = etag({key: value for key, value in alert.items() if key != "version"})
    return episode


def guarded_resource(method, path):
    if method == "POST":
        match = re.fullmatch(r"/episodes/(\d+)/(triage|discharge)", path)
        if match:
            return match[2], int(match[1])
    if method == "PATCH":
        match = re.fullmatch(r"/tasks/(\d+)/complete", path)
        if match:
            return "task", int(match[1])
        match = re.fullmatch(r"/alerts/(\d+)", path)
        if match:
            return "alert", int(match[1])
    return None


def check_version(connection, detail, request, user, payload):
    resource = guarded_resource(request.method, request.url.path)
    if resource is None:
        return
    kind, identifier = resource
    episode_id = identifier
    if kind in ("task", "alert"):
        table = "tasks" if kind == "task" else "alerts"
        row = connection.execute(f"SELECT * FROM {table} WHERE id = ?", (identifier,)).fetchone()
        if row is None:
            return  # The endpoint retains its existing 404 contract.
        episode_id = row["episode_id"]
        if kind == "alert" and payload.get("data", {}).get("status") == "RESOLVED" and user["role"] not in {"DOCTOR", "SUPERVISOR"}:
            raise HTTPException(403, "Solo médico o supervisor puede resolver alertas")
    episode = detail(connection, episode_id)
    if episode["status"] != "ACTIVE":
        raise HTTPException(409, "El episodio está cerrado")
    if kind == "task" and row["status"] == "COMPLETED":
        raise HTTPException(409, "La tarea ya está completada")
    if kind == "task" and row["service"] == "LAB" and user["role"] != "LAB":
        raise HTTPException(403, "Esta tarea está asignada a laboratorio")
    expected = request.headers.get("If-Match")
    if not expected:
        raise HTTPException(428, "Consulta la versión actual antes de guardar")
    if kind == "triage":
        actual = episode["triage_version"]
    elif kind == "discharge":
        actual = episode["clinical_version"]
    else:
        collection = episode["tasks" if kind == "task" else "alerts"]
        actual = next(item["version"] for item in collection if item["id"] == identifier)
    if expected != actual:
        raise HTTPException(409, {
            "code": "version_conflict",
            "message": "Otra sesión modificó estos datos. Consulta los cambios y revísalos antes de guardar.",
        })
