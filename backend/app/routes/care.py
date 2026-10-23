"""Patient assignment uses shared atomic writes, fresh eligibility and explicit handoffs."""
from typing import Literal
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from .. import auth, care
from ..input_validation import ClinicalNote
from ..write_operations import atomic_write, transaction_factory

Discipline = Literal['DOCTOR', 'NURSE']


class Reason(BaseModel):
    model_config = ConfigDict(extra='forbid')
    reason: ClinicalNote


class Target(Reason):
    user_id: int = Field(gt=0, strict=True)


class Area(Reason):
    area_id: int = Field(gt=0, strict=True)


def create_router(connection_factory, timestamp, clinical_user):
    router = APIRouter(prefix='/care')
    factory = transaction_factory(connection_factory)

    def authorize(connection, request, user):
        current = auth.validate_session(request.headers.get('Authorization'), lambda: factory(), timestamp)
        if current['role'] == 'ACCOUNT_ADMIN' or current['username'] != user['username']:
            raise HTTPException(403, 'Acceso clinico requerido')
        # Refresh permission inside the same transaction as the write.
        user.clear()
        user.update(current)

    write = atomic_write(connection_factory, require_key=True, authorize=authorize)

    def coordinate(user):
        if not user.get('can_coordinate'):
            raise HTTPException(403, 'Se requiere coordinacion para esta accion')

    def owns(slot, user, proposed=False):
        person = slot['proposed' if proposed else 'owner']
        return bool(person and person['username'] == user['username'] and user['role'] == slot['discipline'])

    def eligible(connection, target, discipline, area_id):
        if not care.available(connection, target, discipline, area_id):
            raise HTTPException(409, 'El receptor debe tener cuenta personal activa, rol y area compatibles, turno iniciado y disponibilidad confirmada')

    def changed(connection, before, user, action, reason, discipline=None, target=None):
        after = care.state(connection, before['episode_id'])
        # Audit also records the resulting rotation baseline after this write.
        return care.audit(connection, before, after, user, action, reason, timestamp, discipline, target)

    @router.get('/queue')
    def queue(mine: bool = False, user: dict = Depends(clinical_user)):
        connection = factory()
        try:
            connection.execute('BEGIN')
            return {'episodes': care.queue(connection, user['username'], mine),
                    'areas': [dict(row) for row in connection.execute('SELECT id,name,active FROM staff_areas ORDER BY id')],
                    'requested_by': user['username']}
        finally:
            connection.close()

    @router.get('/episodes/{episode_id}')
    def detail(episode_id: int, user: dict = Depends(clinical_user)):
        connection = factory()
        try:
            connection.execute('BEGIN')
            return {**care.state(connection, episode_id), 'changes': [dict(row) for row in connection.execute(
                'SELECT * FROM care_changes WHERE episode_id=? ORDER BY id DESC', (episode_id,))]}
        finally:
            connection.close()

    @router.post('/episodes/{episode_id}/area')
    @write
    def area(episode_id: int, data: Area, expected: str | None = Header(None, alias='If-Match'), user: dict = Depends(clinical_user)):
        connection = factory()
        before = care.require_version(connection, episode_id, expected)
        initial_nurse = user['role'] == 'NURSE' and before['area_id'] is None and all(slot['user_id'] is None for slot in before['slots'])
        if not (user.get('can_coordinate') or initial_nurse or any(owns(slot, user) for slot in before['slots'])):
            raise HTTPException(403, 'Solo coordinacion, el responsable o enfermeria al derivar tras triaje')
        if not connection.execute('SELECT 1 FROM staff_areas WHERE id=? AND active=1', (data.area_id,)).fetchone():
            raise HTTPException(409, 'Selecciona un area activa')
        if before['area_id'] == data.area_id:
            raise HTTPException(409, 'El episodio ya tiene esa area de seguimiento')
        connection.execute('UPDATE care_episodes SET area_id=?,revision=revision+1 WHERE episode_id=?', (data.area_id, episode_id))
        return changed(connection, before, user, 'AREA', data.reason)

    @router.post('/episodes/{episode_id}/{discipline}/assign')
    @write
    def assign(episode_id: int, discipline: Discipline, data: Target, expected: str | None = Header(None, alias='If-Match'), user: dict = Depends(clinical_user)):
        connection = factory()
        before = care.require_version(connection, episode_id, expected)
        slot = next(slot for slot in before['slots'] if slot['discipline'] == discipline)
        target = care.person(connection, data.user_id)
        if not (user.get('can_coordinate') or (target and target['username'] == user['username'] and user['role'] == discipline)):
            raise HTTPException(403, 'Solo puedes tomar pacientes para ti; coordinacion puede confirmar otra cuenta')
        if slot['user_id'] is not None:
            raise HTTPException(409, 'Ya hay responsable; utiliza relevo con aceptacion')
        eligible(connection, data.user_id, discipline, before['area_id'])
        connection.execute('UPDATE care_slots SET user_id=?,revision=revision+1 WHERE episode_id=? AND discipline=?', (data.user_id, episode_id, discipline))
        return changed(connection, before, user, 'ASSIGN', data.reason, discipline, data.user_id)

    @router.post('/episodes/{episode_id}/{discipline}/start')
    @write
    def start(episode_id: int, discipline: Discipline, data: Reason, expected: str | None = Header(None, alias='If-Match'), user: dict = Depends(clinical_user)):
        connection = factory()
        before = care.require_version(connection, episode_id, expected)
        slot = next(slot for slot in before['slots'] if slot['discipline'] == discipline)
        if not owns(slot, user):
            raise HTTPException(403, 'Solo el responsable puede confirmar su inicio de atencion')
        if slot['started_at']:
            raise HTTPException(409, 'El inicio ya esta registrado para este responsable')
        if not slot['covered']:
            raise HTTPException(409, 'Revisa turno, disponibilidad y area antes de confirmar inicio')
        at = timestamp()
        connection.execute('UPDATE care_slots SET started_at=?,first_started_at=COALESCE(first_started_at,?),revision=revision+1 WHERE episode_id=? AND discipline=?', (at, at, episode_id, discipline))
        return changed(connection, before, user, 'START', data.reason, discipline, slot['user_id'])

    @router.post('/episodes/{episode_id}/{discipline}/handoff')
    @write
    def handoff(episode_id: int, discipline: Discipline, data: Target, expected: str | None = Header(None, alias='If-Match'), user: dict = Depends(clinical_user)):
        connection = factory()
        before = care.require_version(connection, episode_id, expected)
        slot = next(slot for slot in before['slots'] if slot['discipline'] == discipline)
        if not (user.get('can_coordinate') or owns(slot, user)):
            raise HTTPException(403, 'Solo coordinacion o responsable actual pueden proponer relevo')
        if slot['user_id'] is None or slot['pending_user_id'] is not None or data.user_id == slot['user_id']:
            raise HTTPException(409, 'Revisa responsable y relevo pendiente antes de proponer otro')
        eligible(connection, data.user_id, discipline, before['area_id'])
        connection.execute('UPDATE care_slots SET pending_user_id=?,revision=revision+1 WHERE episode_id=? AND discipline=?', (data.user_id, episode_id, discipline))
        return changed(connection, before, user, 'PROPOSE', data.reason, discipline, data.user_id)

    @router.post('/episodes/{episode_id}/{discipline}/accept')
    @write
    def accept(episode_id: int, discipline: Discipline, data: Reason, expected: str | None = Header(None, alias='If-Match'), user: dict = Depends(clinical_user)):
        connection = factory()
        before = care.require_version(connection, episode_id, expected)
        slot = next(slot for slot in before['slots'] if slot['discipline'] == discipline)
        if not owns(slot, user, proposed=True):
            raise HTTPException(403, 'Solo el receptor propuesto puede aceptar el relevo')
        eligible(connection, slot['pending_user_id'], discipline, before['area_id'])
        target = slot['pending_user_id']
        connection.execute('UPDATE care_slots SET user_id=?,pending_user_id=NULL,started_at=NULL,revision=revision+1 WHERE episode_id=? AND discipline=?', (target, episode_id, discipline))
        return changed(connection, before, user, 'ACCEPT', data.reason, discipline, target)

    @router.post('/episodes/{episode_id}/{discipline}/cancel-handoff')
    @write
    def cancel(episode_id: int, discipline: Discipline, data: Reason, expected: str | None = Header(None, alias='If-Match'), user: dict = Depends(clinical_user)):
        connection = factory()
        before = care.require_version(connection, episode_id, expected)
        slot = next(slot for slot in before['slots'] if slot['discipline'] == discipline)
        if not (user.get('can_coordinate') or owns(slot, user) or owns(slot, user, proposed=True)):
            raise HTTPException(403, 'Solo participantes del relevo o coordinacion')
        if slot['pending_user_id'] is None:
            raise HTTPException(409, 'No hay relevo pendiente')
        connection.execute('UPDATE care_slots SET pending_user_id=NULL,revision=revision+1 WHERE episode_id=? AND discipline=?', (episode_id, discipline))
        return changed(connection, before, user, 'CANCEL_HANDOFF', data.reason, discipline, slot['pending_user_id'])

    @router.post('/episodes/{episode_id}/{discipline}/override')
    @write
    def override(episode_id: int, discipline: Discipline, data: Target, expected: str | None = Header(None, alias='If-Match'), user: dict = Depends(clinical_user)):
        coordinate(user)
        connection = factory()
        before = care.require_version(connection, episode_id, expected)
        slot = next(slot for slot in before['slots'] if slot['discipline'] == discipline)
        if slot['user_id'] is None or data.user_id == slot['user_id']:
            raise HTTPException(409, 'Esta excepcion sustituye un responsable existente por otra cuenta')
        eligible(connection, data.user_id, discipline, before['area_id'])
        connection.execute('UPDATE care_slots SET user_id=?,pending_user_id=NULL,started_at=NULL,revision=revision+1 WHERE episode_id=? AND discipline=?', (data.user_id, episode_id, discipline))
        return changed(connection, before, user, 'OVERRIDE', data.reason, discipline, data.user_id)

    return router
