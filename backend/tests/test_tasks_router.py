import pytest
from fastapi.testclient import TestClient

from app import main


def login(client, username):
    response = client.post("/auth/login", json={"username": username, "password": "demo123"})
    assert response.status_code == 200
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def test_task_routes_registered_once_with_existing_methods() -> None:
    paths = ["/episodes/{episode_id}/tasks", "/lab/orders", "/tasks/{task_id}/complete"]
    routes = [route for route in main.app.routes if route.path in paths]
    assert [(route.path, route.methods) for route in routes] == [
        (paths[0], {"POST"}), (paths[1], {"GET"}), (paths[2], {"PATCH"}),
    ]
    assert routes[0].status_code == 201
    assert {route.endpoint.__module__ for route in routes} == {"app.routes.tasks"}


@pytest.mark.parametrize("status", ["PENDING", "COMPLETED", "ALL"])
def test_laboratory_filters_preserve_service_and_order_fields(tmp_path, monkeypatch, status) -> None:
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "task-filters.db")
    with TestClient(main.app) as client:
        reception = login(client, "recepcion")
        doctor = login(client, "medico")
        laboratory = login(client, "laboratorio")
        created = client.post("/episodes", headers=reception, json={
            "name": "Paciente Ficticio 33D", "birth_date": "1990-01-01",
            "document": "TEST-33D", "priority": 3,
        })
        assert created.status_code == 201
        episode_id = created.json()["id"]
        task_ids = []
        for service in ["LAB", "LAB", "NURSING"]:
            response = client.post(f"/episodes/{episode_id}/tasks", headers=doctor,
                                   json={"title": "Tarea Ficticia 33D", "service": service})
            assert response.status_code == 201
            task_ids.append(response.json()["tasks"][0]["id"])
        completed = client.patch(f"/tasks/{task_ids[0]}/complete", headers=laboratory,
                                 json={"result": "Resultado ficticio"})
        assert completed.status_code == 200
        response = client.get("/lab/orders", headers=laboratory, params={"status": status})
        assert response.status_code == 200
        result = response.json()
        expected = {"PENDING": [task_ids[1]], "COMPLETED": [task_ids[0]],
                    "ALL": [task_ids[1], task_ids[0]]}[status]
        assert [order["id"] for order in result["orders"]] == expected
        assert result["total"] == len(expected)
        assert result["status_filter"] == status
        assert result["requested_by"] == "laboratorio"
        for order in result["orders"]:
            assert order["service"] == "LAB"
            assert "qr_token" not in order
            assert "birth_date" not in order
        assert client.get("/lab/orders", headers=laboratory,
                          params={"status": "INVALID"}).status_code == 422
