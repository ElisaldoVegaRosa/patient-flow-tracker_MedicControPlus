"""Operational visibility does not grant supervisor mutation permissions."""
from fastapi import APIRouter, Depends, HTTPException

from ..operational_delays import read


def create_router(connection_factory, timestamp, authenticated_user):
    router = APIRouter()

    @router.get('/operations/delays')
    def delays(user: dict = Depends(authenticated_user)):
        if user['role'] != 'SUPERVISOR' and not user.get('can_coordinate'):
            raise HTTPException(403, 'Se requiere supervision o permiso de coordinacion para consultar demoras')
        connection = connection_factory()
        try:
            connection.execute('BEGIN')
            return read(connection, timestamp(), user['username'])
        finally:
            connection.close()

    return router
