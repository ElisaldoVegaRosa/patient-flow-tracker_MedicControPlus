from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import main
from app.routes.auth import create_router


def test_auth_routes_registered_once_with_existing_methods() -> None:
    routes = [route for route in main.app.routes if route.path.startswith("/auth/")]
    assert [(route.path, route.methods) for route in routes] == [
        ("/auth/login", {"POST"}),
        ("/auth/me", {"GET"}),
        ("/auth/logout", {"POST"}),
    ]


def test_router_uses_supplied_authentication_dependency() -> None:
    def unused_connection():
        raise AssertionError("La consulta de usuario no debe abrir SQLite")

    def current_user():
        return {"username": "usuario-ficticio", "role": "SUPERVISOR"}

    app = FastAPI()
    app.include_router(create_router(unused_connection, main.utc_now, current_user))
    with TestClient(app) as client:
        response = client.get("/auth/me")
    assert response.status_code == 200
    assert response.json() == current_user()
