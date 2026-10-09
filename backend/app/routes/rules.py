from collections.abc import Callable
import sqlite3

from fastapi import APIRouter, Depends


def create_router(
    connection_factory: Callable[[], sqlite3.Connection],
    timestamp: Callable[[], str],
    evaluate: Callable[[sqlite3.Connection], dict[str, int]],
    require_roles: Callable[..., Callable[..., dict[str, str]]],
) -> APIRouter:
    router = APIRouter()

    @router.post("/rules/evaluate")
    def evaluate_rules(
        user: dict[str, str] = Depends(
            require_roles("SUPERVISOR", "DOCTOR")
        ),
    ) -> dict:
        connection = connection_factory()

        result = evaluate(connection)
        connection.close()

        return {
            **result,
            "evaluated_at": timestamp(),
            "requested_by": user["username"],
        }

    return router
