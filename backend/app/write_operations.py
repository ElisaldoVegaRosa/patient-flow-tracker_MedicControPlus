"""One transaction per operational write; replay metadata contains no clinical text."""
from contextvars import ContextVar
from datetime import datetime, timedelta, timezone
from functools import wraps
import hashlib
import inspect
import json
import re
import sqlite3

from fastapi import HTTPException, Request
from pydantic import BaseModel
from .concurrency import check_version

_active = ContextVar("write_connection", default=None)


class TransactionConnection:
    def __init__(self, connection):
        self.connection = connection

    def __getattr__(self, name):
        return getattr(self.connection, name)

    def commit(self):
        # The outer operation commits the effects and replay receipt together.
        pass

    def close(self):
        pass


def active_connection():
    return _active.get()


def transaction_factory(factory):
    return lambda: active_connection() or factory()


def atomic_write(connection_factory, detail=None, *, require_key=False):
    """Dependencies (including current authorization) run before this wrapper."""
    def decorate(endpoint):
        signature = inspect.signature(endpoint)

        @wraps(endpoint)
        def execute(*args, **kwargs):
            request = kwargs.pop("operation_request")
            key = request.headers.get("Idempotency-Key")
            if require_key and key is None:
                raise HTTPException(428, "Esta acción requiere un identificador de operación")
            if key is not None and not re.fullmatch(r"[A-Za-z0-9_-]{16,128}", key):
                raise HTTPException(400, "Clave de idempotencia no válida")
            user = kwargs["user"]
            scope = f"{request.method}:{request.url.path}"
            payload = {name: value.model_dump(mode="json") if isinstance(value, BaseModel) else value
                       for name, value in kwargs.items() if name != "user"}
            fingerprint = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
            connection = connection_factory()
            context = None
            try:
                connection.execute("BEGIN IMMEDIATE")
                context = _active.set(TransactionConnection(connection))
                now = datetime.now(timezone.utc)
                if key:
                    receipt = connection.execute(
                        "SELECT * FROM write_receipts WHERE username = ? AND operation_key = ?",
                        (user["username"], key),
                    ).fetchone()
                    if receipt:
                        if receipt["role"] != user["role"]:
                            raise HTTPException(403, "La operación corresponde a otro rol")
                        if receipt["scope"] != scope or receipt["fingerprint"] != fingerprint:
                            raise HTTPException(409, "La clave ya se utilizó para otra operación")
                        if now >= datetime.fromisoformat(receipt["expires_at"]):
                            raise HTTPException(409, "La clave expiró; verifica el resultado registrado antes de una nueva acción")
                        if receipt["episode_id"] is not None:
                            result = detail(connection, receipt["episode_id"])
                        else:
                            result = json.loads(receipt["summary"])
                        connection.commit()
                        return result
                check_version(connection, detail, request, user, payload)
                result = endpoint(*args, **kwargs)
                if key:
                    episode_id = result.get("id") if detail else None
                    summary = None if episode_id is not None else json.dumps(result)
                    connection.execute(
                        "INSERT INTO write_receipts (username, operation_key, role, scope, fingerprint, episode_id, summary, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        (user["username"], key, user["role"], scope, fingerprint, episode_id, summary,
                         (now + timedelta(hours=24)).isoformat()),
                    )
                connection.commit()
                return result
            except sqlite3.OperationalError as error:
                connection.rollback()
                if "locked" in str(error).lower():
                    raise HTTPException(503, "Escritura temporalmente ocupada; reintenta la misma operación") from error
                raise
            except BaseException:
                connection.rollback()
                raise
            finally:
                if context is not None:
                    _active.reset(context)
                connection.close()

        execute.__signature__ = signature.replace(parameters=[*signature.parameters.values(),
            inspect.Parameter("operation_request", inspect.Parameter.KEYWORD_ONLY, annotation=Request)])
        return execute
    return decorate
