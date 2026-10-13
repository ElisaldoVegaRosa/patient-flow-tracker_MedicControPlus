from datetime import date, timedelta
import pytest
from pydantic import ValidationError
from app.routes.episode_registration import EpisodeCreate
from app.routes.nursing import TriageRequest
from app.routes.medical import MedicalEvaluationRequest, DischargeRequest
from app.routes.tasks import TaskCreateRequest, TaskResultRequest
from test_write_operations import setup, keyed, rows  # noqa: F401

CASES = [
    (EpisodeCreate, {"name": "Ficticio", "birth_date": "1990-01-01", "document": "DEMO"}, {"name": 200, "document": 100, "location": 200}),
    (TriageRequest, {"priority": 3, "location": "Recepción"}, {"location": 200, "assigned_to": 200}),
    (MedicalEvaluationRequest, {"diagnosis": "Control", "clinical_note": "Nota válida"}, {"diagnosis": 500, "clinical_note": 2000}),
    (TaskCreateRequest, {"title": "Control", "service": "LAB"}, {"title": 300}),
    (TaskResultRequest, {"result": "Normal"}, {"result": 2000}),
    (DischargeRequest, {"note": "Alta válida"}, {"note": 2000}),
]

@pytest.mark.parametrize("model,payload,limits", CASES)
def test_text_limits_blank_and_preservation(model, payload, limits):
    for field, maximum in limits.items():
        for invalid in ["", " \t\n", "x" * (maximum + 1)]:
            with pytest.raises(ValidationError):
                model.model_validate({**payload, field: invalid})
        value = "x" * maximum
        assert getattr(model.model_validate({**payload, field: value}), field) == value
        original = "  Texto clínico\ncon acentos: evaluación  "
        assert getattr(model.model_validate({**payload, field: original}), field) == original
    minimum = {MedicalEvaluationRequest: {"diagnosis": "x", "clinical_note": "xx"}, TaskCreateRequest: {"title": "xx"}, TaskResultRequest: {"result": "xx"}}
    for field, value in minimum.get(model, {}).items():
        with pytest.raises(ValidationError): model.model_validate({**payload, field: value})

@pytest.mark.parametrize("value", ["no-fecha", "2026-02-30", "2026-1-01", "0000-01-01", (date.today() + timedelta(days=1)).isoformat()])
def test_invalid_birth_date(value):
    with pytest.raises(ValidationError): EpisodeCreate(name="Demo", document="Demo", birth_date=value)

def test_birth_date_valid_leap_and_today():
    for value in ["2000-02-29", date.today().isoformat()]:
        assert EpisodeCreate(name="Demo", document="Demo", birth_date=value).birth_date == value

def snapshot():
    return {table: [tuple(row) for row in rows(f"SELECT * FROM {table} ORDER BY " + ("username, operation_key" if table == "write_receipts" else "id"))]
            for table in ["patients", "episodes", "tasks", "events", "vitals", "alerts", "alert_history", "write_receipts"]}

def test_all_routes_reject_without_effects_and_corrected_intent_replays(setup):
    client, users, episode = setup
    eid = episode["id"]
    task = client.post(f"/episodes/{eid}/tasks", headers=users["medico"], json={"title": "Control", "service": "LAB"}).json()["tasks"][0]
    cases = [
        ("post", "/episodes", "recepcion", {"name": "  ", "birth_date": "1990-01-01", "document": "DEMO"}, "name", "Nuevo ficticio"),
        ("post", f"/episodes/{eid}/triage", "enfermeria", {"priority": 3, "location": "  "}, "location", "Observación"),
        ("post", f"/episodes/{eid}/medical-evaluation", "medico", {"diagnosis": "  ", "clinical_note": "Nota válida"}, "diagnosis", "Control"),
        ("post", f"/episodes/{eid}/tasks", "medico", {"title": "", "service": "LAB"}, "title", "Control"),
        ("patch", f"/tasks/{task['id']}/complete", "laboratorio", {"result": ""}, "result", "Resultado normal"),
        ("post", f"/episodes/{eid}/discharge", "medico", {"note": ""}, "note", "Alta válida"),
    ]
    for index, (method, path, username, payload, field, valid) in enumerate(cases):
        headers = keyed(users[username], f"validation-62-key-{index:02d}")
        before = snapshot()
        rejected = getattr(client, method)(path, headers=headers, json=payload)
        assert rejected.status_code == 422
        assert any(issue["loc"][-1] == field for issue in rejected.json()["detail"])
        assert snapshot() == before
        corrected = {**payload, field: valid}
        first = getattr(client, method)(path, headers=headers, json=corrected)
        assert first.status_code in (200, 201), first.text
        after = snapshot()
        assert getattr(client, method)(path, headers=headers, json=corrected).status_code == first.status_code
        assert snapshot() == after
