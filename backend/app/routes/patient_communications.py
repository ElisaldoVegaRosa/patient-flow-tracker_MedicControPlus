"""Contact workflow has its own projection; it never grants access to clinical followups."""
from datetime import datetime
import json
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, ConfigDict, StrictBool, model_validator

from .. import auth, patient_communications as comm
from ..input_validation import ClinicalNote
from ..write_operations import atomic_write, transaction_factory


class Authorize(BaseModel):
    model_config = ConfigDict(extra='forbid')
    mode: Literal['CONTACT_ONLY', 'MESSAGE']
    message: ClinicalNote | None = None
    reason: ClinicalNote


class Attempt(BaseModel):
    model_config = ConfigDict(extra='forbid')
    channel: Literal['PHONE', 'IN_PERSON', 'WHATSAPP']
    outcome: Literal['NO_RESPONSE', 'SENT', 'READ', 'CONFIRMED']
    identity_verified: StrictBool = False
    transmitted: StrictBool = False
    notify_doctor: StrictBool = False
    next_attempt_at: datetime | None = None
    reason: ClinicalNote

    @model_validator(mode='after')
    def consistent(self):
        if self.outcome == 'CONFIRMED' and not self.identity_verified:
            raise ValueError('Confirma la identidad antes de registrar contacto confirmado')
        if self.identity_verified and self.outcome != 'CONFIRMED':
            raise ValueError('La verificacion requiere respuesta confirmada')
        if self.transmitted and self.outcome != 'CONFIRMED':
            raise ValueError('Transmitir requiere respuesta e identidad verificada')
        if self.channel != 'WHATSAPP' and self.outcome in ('SENT', 'READ'):
            raise ValueError('Enviado o leido corresponde a WhatsApp')
        if self.next_attempt_at and self.next_attempt_at.utcoffset() is None:
            raise ValueError('La fecha requiere zona horaria')
        if not (self.outcome == 'CONFIRMED' and self.transmitted) and self.next_attempt_at is None:
            raise ValueError('Programa el proximo intento; no se cierra automaticamente')
        return self


class Reason(BaseModel):
    model_config = ConfigDict(extra='forbid')
    reason: ClinicalNote


class Rectify(Reason):
    event_id: int


def create_router(connection_factory, timestamp, authenticated_user):
    router = APIRouter()
    factory = transaction_factory(connection_factory)

    def eligible(user):
        if user['role'] not in ('RECEPTION', 'DOCTOR', 'SUPERVISOR') and not (
                user['role'] in ('NURSE', 'LAB') and user.get('can_coordinate')):
            raise HTTPException(403, 'Se requiere Recepcion, Medicina, supervision o coordinacion clinica')

    def enabled(c):
        if not comm.available(c):
            raise HTTPException(409, 'Comunicacion no habilitada: prepara una copia con el esquema correspondiente')

    def authorize_write(c, request, user):
        fresh = auth.validate_session(request.headers.get('Authorization'), lambda: factory(), timestamp)
        user.clear()
        user.update(fresh)
        eligible(user)
        enabled(c)
        value, _ = comm.state(c, int(request.path_params['followup_id']), user)
        action = request.url.path.rsplit('/', 1)[-1]
        if action == 'authorize' and not value['can_authorize']:
            raise HTTPException(403, 'Solo el medico responsable del ciclo vigente autoriza el aviso')
        if action == 'attempt' and user['role'] != 'RECEPTION':
            raise HTTPException(403, 'Solo Recepcion registra gestiones de contacto')
        if action == 'explain' and not (user['role'] == 'DOCTOR' and value['can_authorize']):
            raise HTTPException(403, 'Solo el medico responsable registra explicacion clinica')
        if action == 'rectify' and user['role'] not in ('RECEPTION', 'DOCTOR'):
            raise HTTPException(403, 'Solo el autor puede rectificar su gestion')

    write = atomic_write(connection_factory, require_key=True, authorize=authorize_write)

    @router.get('/communications')
    def queue(include_resolved: bool = False, offset: int = Query(0, ge=0),
              user: dict = Depends(authenticated_user)):
        eligible(user)
        c = factory()
        try:
            c.execute('BEGIN')
            if not comm.available(c):
                return {'enabled': False, 'items': [], 'total': 0, 'has_more': False}
            values = []
            for row in c.execute('SELECT id FROM lab_followups ORDER BY id DESC'):
                value, _ = comm.state(c, row[0], user)
                # Stale/missing authorizations are actionable for doctors, never exposed to Reception.
                if not value['current_cycle']:
                    continue
                if user['role'] == 'RECEPTION' and not value['valid']:
                    continue
                if not include_resolved and value['contacted'] and value['explained']:
                    continue
                values.append(value)
            return {'enabled': True, 'total': len(values), 'has_more': offset + 20 < len(values),
                    'items': values[offset:offset + 20]}
        finally:
            c.close()

    def current(followup_id, expected, user, *, require_valid=True):
        c = factory()
        value, case = comm.state(c, followup_id, user)
        if not expected:
            raise HTTPException(428, 'Consulta la version antes de guardar')
        if expected != value['version']:
            raise HTTPException(409, {'code': 'version_conflict', 'message': 'Cambio el aviso o el seguimiento; revisa los datos actuales'})
        if not value['current_cycle'] or (require_valid and not value['valid']):
            raise HTTPException(409, 'El aviso requiere nueva autorizacion del medico responsable')
        return c, value, case

    @router.get('/communications/{followup_id}/history')
    def history(followup_id: int, offset: int = Query(0, ge=0), user: dict = Depends(authenticated_user)):
        eligible(user)
        c = factory()
        try:
            c.execute('BEGIN')
            enabled(c)
            rows = c.execute('SELECT id FROM comm_notices WHERE followup_id=? ORDER BY id DESC LIMIT 21 OFFSET ?',
                             (followup_id, offset)).fetchall()
            items = []
            for row in rows[:20]:
                value, _ = comm.state(c, followup_id, user, row[0])
                # Historical text is evidence for clinical review, never a reusable Reception message.
                if user['role'] in ('DOCTOR', 'SUPERVISOR'):
                    notice = c.execute('SELECT message,reason FROM comm_notices WHERE id=?', (row[0],)).fetchone()
                    value['historical_message'] = notice['message']
                    value['authorization_reason'] = notice['reason']
                items.append(value)
            return {'items': items, 'has_more': len(rows) > 20}
        finally:
            c.close()

    @router.get('/communications/{followup_id}')
    def get_case(followup_id: int, user: dict = Depends(authenticated_user)):
        eligible(user)
        c = factory()
        try:
            c.execute('BEGIN')
            enabled(c)
            value, _ = comm.state(c, followup_id, user)
            if user['role'] == 'RECEPTION' and value['notice_id'] is None:
                raise HTTPException(403, 'No hay aviso autorizado para Recepcion')
            return value
        finally:
            c.close()

    def event(c, value, user, kind, data, rectifies=None):
        actor = c.execute('SELECT id FROM users WHERE username=?', (user['username'],)).fetchone()[0]
        reason = data.pop('reason')
        c.execute('INSERT INTO comm_events(notice_id,actor_id,created_at,kind,payload,reason,rectifies_id) VALUES (?,?,?,?,?,?,?)',
                  (value['notice_id'], actor, timestamp(), kind, json.dumps(data, ensure_ascii=False), reason, rectifies))
        return {'saved': True}

    @router.post('/communications/{followup_id}/authorize')
    @write
    def authorize(followup_id: int, data: Authorize, expected: str | None = Header(None, alias='If-Match'),
                  user: dict = Depends(authenticated_user)):
        c, value, case = current(followup_id, expected, user, require_valid=False)
        if data.mode == 'MESSAGE' and (case['pending_reviews'] or not data.message):
            raise HTTPException(409, 'Revisa los informes vigentes y escribe el mensaje que autorizas')
        message = data.message if data.mode == 'MESSAGE' else comm.CONTACT_MESSAGE
        actor = c.execute('SELECT id FROM users WHERE username=?', (user['username'],)).fetchone()[0]
        c.execute('INSERT INTO comm_notices(followup_id,authorized_by,authorized_at,clinical_version,mode,message,reason) VALUES (?,?,?,?,?,?,?)',
                  (followup_id, actor, timestamp(), case['version'], data.mode, message, data.reason))
        return {'saved': True}

    @router.post('/communications/{followup_id}/attempt')
    @write
    def attempt(followup_id: int, data: Attempt, expected: str | None = Header(None, alias='If-Match'),
                user: dict = Depends(authenticated_user)):
        c, value, _ = current(followup_id, expected, user)
        if value['mode'] == 'MESSAGE' and data.channel == 'WHATSAPP':
            raise HTTPException(409, 'WhatsApp institucional solo admite el aviso de contacto; solicita un aviso sin resultados')
        if data.next_attempt_at and data.next_attempt_at <= datetime.fromisoformat(timestamp()):
            raise HTTPException(422, 'El proximo intento debe ser futuro')
        return event(c, value, user, 'ATTEMPT', data.model_dump(mode='json'))

    @router.post('/communications/{followup_id}/explain')
    @write
    def explain(followup_id: int, data: Reason, expected: str | None = Header(None, alias='If-Match'),
                user: dict = Depends(authenticated_user)):
        c, value, case = current(followup_id, expected, user)
        if case['pending_results'] or case['pending_reviews']:
            raise HTTPException(409, 'Resuelve resultados y revisiones antes de confirmar la explicacion final')
        return event(c, value, user, 'EXPLAIN', data.model_dump())

    @router.post('/communications/{followup_id}/rectify')
    @write
    def rectify(followup_id: int, data: Rectify, expected: str | None = Header(None, alias='If-Match'),
                user: dict = Depends(authenticated_user)):
        c, value, _ = current(followup_id, expected, user)
        original = c.execute('''SELECT e.*,u.username FROM comm_events e JOIN users u ON u.id=e.actor_id
                                WHERE e.id=? AND e.notice_id=?''', (data.event_id, value['notice_id'])).fetchone()
        if not original or original['username'] != user['username'] or original['kind'] == 'RECTIFY':
            raise HTTPException(403, 'Solo puedes rectificar tus propios hechos')
        if c.execute('SELECT 1 FROM comm_events WHERE rectifies_id=?', (data.event_id,)).fetchone():
            raise HTTPException(409, 'Este hecho ya fue rectificado')
        return event(c, value, user, 'RECTIFY', {'reason': data.reason}, data.event_id)

    return router
