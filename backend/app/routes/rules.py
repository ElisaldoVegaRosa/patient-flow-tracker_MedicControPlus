from ..write_operations import atomic_write, transaction_factory
from collections.abc import Callable
import sqlite3

from fastapi import APIRouter, Depends


def create_router(
    connection_factory: Callable[[], sqlite3.Connection],
    timestamp: Callable[[], str],
    evaluate: Callable[[sqlite3.Connection], dict[str, int]],
    require_roles: Callable[..., Callable[..., dict[str, str]]],
) -> APIRouter:
    connection_factory = transaction_factory(connection_factory)
    router = APIRouter()

    @router.post("/rules/evaluate")
    @atomic_write(connection_factory)
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
