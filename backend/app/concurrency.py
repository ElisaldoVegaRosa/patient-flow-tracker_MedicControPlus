"""Resource versions derived from persisted state, checked inside atomic_write."""
import hashlib
import json
import re

from fastapi import HTTPException


def etag(value):
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return '"' + hashlib.sha256(encoded.encode()).hexdigest() + '"'


def task_version(task):
    value = {key: task.get(key) for key in (
        "id", "episode_id", "title", "service", "status", "result", "created_at", "due_at",
    )}
    if task.get("last_change_id") is not None:
        value["last_change_id"] = task["last_change_id"]
    return etag(value)


def event_version(event, changes):
    return etag([event["id"], event["episode_id"], event["type"], event["note"],
                 event["created_at"], [change["id"] for change in changes]])


def annotate_versions(episode):
    # Historical clinical events distinguish successive writes even if values repeat.
    # Keep existing version fingerprints unchanged until an actual lifecycle write.
    clinical_events = [{key: value for key, value in event.items()
                        if key not in ("current_note", "annulled", "version")}
                       for event in episode["events"] if event["type"] != "QR_SCANNED"]
    clinical_tasks = [{key: value for key, value in task.items() if key != "last_change_id"}
                      for task in episode["tasks"]]
    triage_events = [event["id"] for event in clinical_events if event["type"] == "TRIAGE"]
    identity_revision = episode.get("identity_revision", 0)
    episode["identity_version"] = etag([
        episode.get("patient_id"), episode.get("name"), episode.get("birth_date"),
        episode.get("document"), episode.get("identity_status"), identity_revision,
    ])
    triage_state = [
        episode["id"], episode["status"], episode["priority"], episode["location"],
        episode.get("assigned_to"), triage_events,
    ]
    if identity_revision:
        triage_state.append(identity_revision)
    episode["triage_version"] = etag(triage_state)
    clinical_state = [
        episode["triage_version"], episode.get("closed_at"), episode["vitals"],
        clinical_tasks, episode["alerts"], clinical_events,
    ]
    if episode.get("record_changes"):
        clinical_state.append(episode["record_changes"])
    episode["clinical_version"] = etag(clinical_state)
    for task in episode["tasks"]:
        task["version"] = task_version(task)
    for alert in episode["alerts"]:
        alert["version"] = etag({key: value for key, value in alert.items() if key != "version"})
    return episode


def guarded_resource(method, path):
    if method == "POST":
        match = re.fullmatch(r"/episodes/(\d+)/(triage|discharge|reopen|annul)", path)
        if match:
            return match[2], int(match[1])
    if method == "PATCH":
        match = re.fullmatch(r"/episodes/(\d+)/identity", path)
        if match:
            return "identity", int(match[1])
        match = re.fullmatch(r"/tasks/(\d+)/(complete|result)", path)
        if match:
            return "task" if match[2] == "complete" else "task_result", int(match[1])
        match = re.fullmatch(r"/events/(\d+)/note", path)
        if match:
            return "event_note", int(match[1])
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
    if kind in ("task", "task_result", "alert", "event_note"):
        table = "tasks" if kind in ("task", "task_result") else "events" if kind == "event_note" else "alerts"
        row = connection.execute(f"SELECT * FROM {table} WHERE id = ?", (identifier,)).fetchone()
        if row is None:
            return  # The endpoint retains its existing 404 contract.
        episode_id = row["episode_id"]
        if kind == "alert" and payload.get("data", {}).get("status") == "RESOLVED" and user["role"] not in {"DOCTOR", "SUPERVISOR"}:
            raise HTTPException(403, "Solo médico o supervisor puede resolver alertas")
    episode = detail(connection, episode_id)
    if kind != "identity" and (episode["status"] == "ANNULLED" or (episode["status"] != "ACTIVE" and kind not in ("task_result", "event_note", "reopen"))):
        raise HTTPException(409, "El episodio está cerrado")
    if kind == "task" and row["status"] == "COMPLETED":
        raise HTTPException(409, "La tarea ya está completada")
    if kind == "task" and row["service"] == "LAB" and user["role"] != "LAB":
        raise HTTPException(403, "Esta tarea está asignada a laboratorio")
    expected = request.headers.get("If-Match")
    if not expected:
        raise HTTPException(428, "Consulta la versión actual antes de guardar")
    if kind == "identity":
        actual = episode["identity_version"]
    elif kind == "triage":
        actual = episode["triage_version"]
    elif kind in ("discharge", "reopen", "annul"):
        actual = episode["clinical_version"]
    elif kind == "event_note":
        actual = next(item["version"] for item in episode["events"] if item["id"] == identifier)
    else:
        collection = episode["tasks" if kind in ("task", "task_result") else "alerts"]
        actual = next(item["version"] for item in collection if item["id"] == identifier)
    if expected != actual:
        raise HTTPException(409, {
            "code": "version_conflict",
            "message": "Otra sesión modificó estos datos. Consulta los cambios y revísalos antes de guardar.",
        })
