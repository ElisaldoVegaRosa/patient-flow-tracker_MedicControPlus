"""Read committed receipts without creating or replaying a write."""
import json
import re

from fastapi import APIRouter, Depends, Header, HTTPException


def create_router(connection_factory, detail, authenticated_user):
    router = APIRouter()

    @router.get("/write-result")
    def write_result(
        operation_key: str = Header(alias="Idempotency-Key"),
        user: dict = Depends(authenticated_user),
    ):
        if not re.fullmatch(r"[A-Za-z0-9_-]{16,128}", operation_key):
            raise HTTPException(400, "Clave de idempotencia no válida")
        connection = connection_factory()
        try:
            receipt = connection.execute(
                "SELECT * FROM write_receipts WHERE username = ? AND operation_key = ?",
                (user["username"], operation_key),
            ).fetchone()
            if receipt is None:
                # An in-flight writer may still commit after this read.
                return {"status": "unknown"}
            if receipt["role"] != user["role"]:
                raise HTTPException(403, "La operación corresponde a otro rol")
            result = (detail(connection, receipt["episode_id"])
                      if receipt["episode_id"] is not None else json.loads(receipt["summary"]))
            return {"status": "confirmed", "result": result}
        finally:
            connection.close()

    return router
