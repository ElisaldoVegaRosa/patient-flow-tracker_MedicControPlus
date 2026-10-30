"""Followup API; optional discharge endpoint is limited to isolated rehearsals."""

from fastapi import APIRouter, Depends, Header, HTTPException, Query
import json

from .. import auth, laboratory_followups as followups, laboratory_samples as samples
from ..input_validation import ClinicalNote, DischargeNote
from ..laboratory_discharge import DischargeRequest, Plan, close as close_laboratory, future as future_plan
from ..write_operations import atomic_write, transaction_factory
from .laboratory_samples import Reason, UserId


class Discharge(DischargeRequest):
    note: DischargeNote
    reason: ClinicalNote


class Target(Reason):
    user_id: UserId


def create_router(connection_factory, timestamp, detail, add_event, require_active_episode, require_roles, *, include_discharge=True):
    router = APIRouter()
    factory = transaction_factory(connection_factory)
    clinical = require_roles('DOCTOR', 'NURSE', 'LAB', 'SUPERVISOR')
    clinical_staff = clinical

    def episode_detail(connection, episode_id):
        return {**detail(connection, episode_id), 'laboratory': samples.episode_state(connection, episode_id),
                'lab_followups': followups.episode_followups(connection, episode_id)}

    write = atomic_write(connection_factory, episode_detail, require_key=True)

    def actor(connection, user):
        row = connection.execute('SELECT id FROM users WHERE username=? AND active=1', (user['username'],)).fetchone()
        if row is None:
            raise HTTPException(403, 'La cuenta profesional ya no esta disponible')
        return row[0]

    def version(actual, expected):
        if not expected:
            raise HTTPException(428, 'Consulta la version actual antes de guardar')
        if actual != expected:
            raise HTTPException(409, {'code': 'version_conflict', 'message': 'Cambio el episodio, los resultados o el seguimiento; consulta el estado actual'})

    def owner_matches(state, user, user_id):
        return user['role'] == 'DOCTOR' and state['owner_user_id'] == user_id

    def authorize_followup(connection, request, user):
        fresh = auth.validate_session(request.headers.get('Authorization'), lambda: factory(), timestamp)
        if fresh['username'] != user['username'] or fresh['role'] != user['role']:
            raise HTTPException(403, 'La autorizacion cambio antes de guardar')
        user.clear()
        user.update(fresh)
        case = followups.require_current(connection, request.path_params['followup_id'])
        user_id = actor(connection, user)
        action = request.url.path.rsplit('/', 1)[-1]
        permitted = owner_matches(case, user, user_id)
        if action == 'propose':
            permitted = permitted or bool(user.get('can_coordinate'))
        elif action == 'accept':
            permitted = user['role'] == 'DOCTOR' and user_id in (case['owner_user_id'], case['pending_user_id'])
        elif action == 'cancel-handoff':
            permitted = permitted or (user['role'] == 'DOCTOR' and user_id == case['pending_user_id']) or bool(user.get('can_coordinate'))
            if not permitted:
                # A receipt may confirm the actor's earlier cancellation, never a new mutation.
                receipt = connection.execute('SELECT scope FROM write_receipts WHERE username=? AND operation_key=?',
                    (user['username'], request.headers.get('Idempotency-Key'))).fetchone()
                permitted = bool(receipt and receipt['scope'] == f'POST:{request.url.path}')
        if not permitted:
            raise HTTPException(403, 'Solo el responsable, receptor autorizado o coordinacion segun la accion')

    guarded = atomic_write(connection_factory, episode_detail, require_key=True, authorize=authorize_followup)

    def future(plan):
        return future_plan(plan, timestamp)

    def changed(connection, case, action, user, reason):
        connection.execute('UPDATE lab_followups SET revision=revision+1 WHERE id=?', (case['id'],))
        after = followups.followup_state(connection, case['id'])
        followups.audit(connection, case['id'], action, actor(connection, user), reason, case, after, timestamp)
        add_event(connection, case['episode_id'], 'LAB_FOLLOWUP_' + action, user['username'], reason)
        return episode_detail(connection, case['episode_id'])

    @router.get('/episodes/{episode_id}/lab-discharge')
    def discharge_baseline(episode_id: int, user: dict = Depends(clinical)):
        connection = factory()
        try:
            connection.execute('BEGIN')
            return followups.discharge_state(connection, episode_id, detail)
        finally:
            connection.close()

    if include_discharge:
        @router.post('/episodes/{episode_id}/lab-discharge')
        @write
        def discharge(episode_id: int, data: Discharge, expected: str | None = Header(None, alias='If-Match'),
                      user: dict = Depends(require_roles('DOCTOR'))):
            connection = factory()
            require_active_episode(connection, episode_id)
            state = followups.discharge_state(connection, episode_id, detail)
            version(state['version'], expected)
            close_laboratory(connection, episode_id, data, user, state, timestamp, add_event)
            return episode_detail(connection, episode_id)

    @router.get('/lab/followups')
    def queue(include_resolved: bool = False, mine: bool = False, limit: int = Query(50, ge=1, le=100),
              offset: int = Query(0, ge=0), user: dict = Depends(clinical)):
        connection = factory()
        try:
            connection.execute('BEGIN')
            user_id = actor(connection, user)
            items = []
            for row in connection.execute('SELECT id FROM lab_followups ORDER BY (review_due_at IS NOT NULL),review_due_at,id'):
                case = followups.followup_state(connection, row[0])
                if not case['current_cycle'] or (not include_resolved and not case['clinical_work_pending'] and case['pending_user_id'] is None):
                    continue
                if mine and user_id not in (case['owner_user_id'], case['pending_user_id']):
                    continue
                items.append(case)
            return {'total': len(items), 'items': items[offset:offset+limit], 'limit': limit, 'offset': offset}
        finally:
            connection.close()

    @router.get('/lab/followup-doctors')
    def doctors(user: dict = Depends(clinical)):
        if user['role'] != 'DOCTOR' and not user.get('can_coordinate'):
            raise HTTPException(403, 'El catalogo de receptores corresponde a medicina o coordinacion')
        connection = factory()
        try:
            return {'doctors': [dict(row) for row in connection.execute(
                "SELECT id,username,display_name,role,active FROM users WHERE active=1 AND role='DOCTOR' ORDER BY display_name,username")]}
        finally:
            connection.close()

    @router.get('/lab/followups/{followup_id}/history')
    def history(followup_id: int, limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0),
                user: dict = Depends(clinical)):
        connection = factory()
        try:
            connection.execute('BEGIN')
            followups.followup_state(connection, followup_id)
            def summary(raw):
                value = json.loads(raw)
                if value is None:
                    return None
                return {'owner': value['owner'], 'proposed': value['proposed'], 'review_due_at': value['review_due_at'],
                        'communication_plan': value['communication_plan']}
            rows = connection.execute('''SELECT c.id,c.action,c.created_at,c.reason,c.old_value,c.new_value,u.username
                FROM lab_changes c JOIN users u ON u.id=c.actor_user_id WHERE c.resource_type='FOLLOWUP' AND c.resource_id=?
                ORDER BY c.id DESC LIMIT ? OFFSET ?''', (followup_id, limit + 1, offset)).fetchall()
            return {'items': [{'id': row['id'], 'action': row['action'], 'created_at': row['created_at'], 'reason': row['reason'],
                              'username': row['username'], 'previous': summary(row['old_value']), 'next': summary(row['new_value'])}
                             for row in rows[:limit]], 'has_more': len(rows) > limit, 'offset': offset, 'limit': limit}
        finally:
            connection.close()

    @router.get('/lab/followups/{followup_id}')
    def get_followup(followup_id: int, user: dict = Depends(clinical)):
        connection = factory()
        try:
            connection.execute('BEGIN')
            return followups.followup_state(connection, followup_id)
        finally:
            connection.close()

    @router.post('/lab/followups/{followup_id}/plan')
    @guarded
    def plan(followup_id: int, data: Plan, expected: str | None = Header(None, alias='If-Match'),
             user: dict = Depends(require_roles('DOCTOR'))):
        connection = factory()
        case = followups.require_current(connection, followup_id)
        version(case['version'], expected)
        connection.execute('UPDATE lab_followups SET review_due_at=?,communication_plan=?,reason=? WHERE id=?',
                           (future(data), data.communication_plan, data.reason, followup_id))
        return changed(connection, case, 'PLAN', user, data.reason)

    @router.post('/lab/followups/{followup_id}/propose')
    @guarded
    def propose(followup_id: int, data: Target, expected: str | None = Header(None, alias='If-Match'),
                user: dict = Depends(clinical_staff)):
        connection = factory()
        case = followups.require_current(connection, followup_id)
        version(case['version'], expected)
        if case['pending_user_id'] is not None or data.user_id == case['owner_user_id']:
            raise HTTPException(409, 'Revisa responsable y propuesta actual antes de proponer otro relevo')
        target = followups.person(connection, data.user_id)
        if not target or target['role'] != 'DOCTOR' or target['active'] != 1:
            raise HTTPException(422, 'Selecciona una cuenta medica activa para el seguimiento')
        connection.execute('UPDATE lab_followups SET pending_user_id=? WHERE id=?', (data.user_id, followup_id))
        return changed(connection, case, 'PROPOSE', user, data.reason)

    @router.post('/lab/followups/{followup_id}/accept')
    @guarded
    def accept(followup_id: int, data: Reason, expected: str | None = Header(None, alias='If-Match'),
               user: dict = Depends(require_roles('DOCTOR'))):
        connection = factory()
        case = followups.require_current(connection, followup_id)
        version(case['version'], expected)
        if case['pending_user_id'] != actor(connection, user):
            raise HTTPException(409, 'No hay propuesta pendiente para tu cuenta')
        connection.execute('UPDATE lab_followups SET owner_user_id=pending_user_id,pending_user_id=NULL WHERE id=?', (followup_id,))
        return changed(connection, case, 'ACCEPT', user, data.reason)

    @router.post('/lab/followups/{followup_id}/cancel-handoff')
    @guarded
    def cancel(followup_id: int, data: Reason, expected: str | None = Header(None, alias='If-Match'),
               user: dict = Depends(clinical_staff)):
        connection = factory()
        case = followups.require_current(connection, followup_id)
        user_id = actor(connection, user)
        if user_id not in (case['owner_user_id'], case['pending_user_id']) and not user.get('can_coordinate'):
            raise HTTPException(403, 'Solo los participantes o coordinacion pueden cancelar este relevo')
        version(case['version'], expected)
        if case['pending_user_id'] is None:
            raise HTTPException(409, 'No hay relevo pendiente que cancelar')
        connection.execute('UPDATE lab_followups SET pending_user_id=NULL WHERE id=?', (followup_id,))
        return changed(connection, case, 'CANCEL_HANDOFF', user, data.reason)

    return router
