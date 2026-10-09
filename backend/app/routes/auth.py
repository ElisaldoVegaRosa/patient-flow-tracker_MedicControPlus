from collections.abc import Callable
import sqlite3

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel

from .. import auth


class LoginRequest(BaseModel):
    username: str
    password: str


def create_router(
    connection_factory: Callable[[], sqlite3.Connection],
    timestamp: Callable[[], str],
    authenticated_user: Callable[..., dict[str, str]],
) -> APIRouter:
    router = APIRouter()

    @router.post("/auth/login")
    def login(data: LoginRequest) -> dict[str, str]:
        """Autentica al usuario y crea una sesión persistente."""
        return auth.login(data.username, data.password, connection_factory)

    @router.get("/auth/me")
    def authenticated_session(
        user: dict[str, str] = Depends(authenticated_user),
    ) -> dict[str, str]:
        return auth.session_user(user)

    @router.post("/auth/logout")
    def logout(
        authorization: str | None = Header(default=None),
        user: dict[str, str] = Depends(authenticated_user),
    ) -> dict[str, str]:
        """Revoca la sesión persistente utilizada por la petición."""
        return auth.logout(authorization, user, connection_factory, timestamp)

    return router
