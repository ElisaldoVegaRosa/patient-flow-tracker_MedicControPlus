"""Versioned result publication/review behind explicit LAB schema activation."""
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import Field, model_validator

from .. import auth, laboratory_results as results, laboratory_samples as samples
from ..input_validation import TaskResult
from ..laboratory_context import allow_lab_write, scoped_followup
from ..write_operations import atomic_write, transaction_factory
from .laboratory_samples import Reason


class Publication(Reason):
    result: TaskResult
    specimen_ids: list[Annotated[int, Field(strict=True, gt=0)]] = Field(min_length=1, max_length=30)

    @model_validator(mode='after')
    def distinct_sources(self):
        if len(set(self.specimen_ids)) != len(self.specimen_ids):
            raise ValueError('Selecciona cada muestra fuente una sola vez')
        self.specimen_ids = sorted(self.specimen_ids)
        return self


class Correction(Reason):
    result: TaskResult


def create_router(connection_factory, timestamp, detail, add_event, require_active_episode, require_roles):
    router = APIRouter()
    factory = transaction_factory(connection_factory)

    def episode_detail(connection, episode_id):
        return {**detail(connection, episode_id), 'laboratory': samples.episode_state(connection, episode_id)}

    write = atomic_write(connection_factory, episode_detail, require_key=True)

    def version(actual, expected):
        if not expected:
            raise HTTPException(428, 'Consulta la version actual antes de guardar')
        if actual != expected:
            raise HTTPException(409, {'code': 'version_conflict', 'message': 'Cambio el resultado, sus muestras o el responsable. Consulta los datos actuales.'})

    def actor(connection, user):
        row = connection.execute('SELECT id FROM users WHERE username=? AND active=1 AND role=?', (user['username'], user['role'])).fetchone()
        if row is None:
            raise HTTPException(403, 'La cuenta profesional ya no esta disponible')
        return row['id']

    def current(connection, analysis_id, allow_cancelled=False):
        item = results.analysis_state(connection, analysis_id)
        # Pre-replay authorization receives raw path strings; scope IDs are persisted integers.
        allow_lab_write(connection, item['episode_id'], [item['id']])
        if item['task_status'] not in ('PENDING', 'COMPLETED'):
            raise HTTPException(409, 'La orden no admite acciones sobre resultados')
        if item['cancelled_at'] is not None and not allow_cancelled:
            raise HTTPException(409, 'La analitica esta cancelada')
        return item

    def by_result(connection, result_id):
        row = connection.execute('SELECT analysis_id FROM lab_result_versions WHERE id=?', (result_id,)).fetchone()
        if row is None:
            raise HTTPException(404, 'Resultado no encontrado')
        return current(connection, row['analysis_id'], allow_cancelled=True)

    def published(item, result_id):
        latest = item['current_version']
        if latest is None or latest['id'] != result_id or latest['action'] == 'ANNUL':
            raise HTTPException(409, 'Selecciona la version vigente de un resultado publicado')
        return latest

    def confirmed_owner(item, user):
        owner = item['medical_owner']
        if not owner or owner['username'] != user['username'] or owner['role'] != 'DOCTOR' or owner['active'] != 1:
            raise HTTPException(403, 'Solo el medico responsable confirmado puede registrar esta accion; el sustituto debe aceptar el relevo')
        return owner

    def authorize_medical(connection, request, user):
        fresh = auth.validate_session(request.headers.get('Authorization'), lambda: factory(), timestamp)
        if fresh['username'] != user['username'] or fresh['role'] != 'DOCTOR':
            raise HTTPException(403, 'La autorizacion medica cambio antes de guardar')
        # Runs before receipt replay too: a former owner cannot reuse an old acknowledgment.
        item = (by_result(connection, request.path_params['result_id']) if 'result_id' in request.path_params else
                current(connection, request.path_params['analysis_id'], allow_cancelled=True))
        confirmed_owner(item, fresh)

    medical_write = atomic_write(connection_factory, episode_detail, require_key=True, authorize=authorize_medical)

    def finish(connection, item, action, user, reason):
        connection.execute('UPDATE lab_analyses SET revision=revision+1 WHERE id=?', (item['id'],))
        connection.execute('UPDATE lab_orders SET revision=revision+1 WHERE task_id=?', (item['order_task_id'],))
        after = results.analysis_state(connection, item['id'])
        samples.audit(connection, item['order_task_id'], 'ANALYSIS', item['id'], action, actor(connection, user),
                      reason, item, after, timestamp)
        event = {'CANCEL_ANALYSIS': 'LAB_ANALYSIS_CANCELLED', 'REINSTATE_ANALYSIS': 'LAB_ANALYSIS_REINSTATED'}.get(action, 'LAB_RESULT_' + action)
        add_event(connection, item['episode_id'], event, user['username'], f"{item['title']}. Motivo: {reason}")
        return episode_detail(connection, item['episode_id'])

    def insert_version(connection, item, action, text, source_ids, reason, user):
        previous = item['current_version']
        result_id = connection.execute('''INSERT INTO lab_result_versions(order_task_id,analysis_id,sequence,action,
            previous_version_id,result,reason,published_by,published_at) VALUES (?,?,?,?,?,?,?,?,?)''',
            (item['order_task_id'], item['id'], previous['sequence'] + 1 if previous else 1, action,
             previous['id'] if previous else None, text, reason, actor(connection, user), timestamp())).lastrowid
        for source_id in source_ids:
            connection.execute('INSERT INTO lab_result_specimens(result_version_id,order_task_id,analysis_id,specimen_id) VALUES (?,?,?,?)',
                               (result_id, item['order_task_id'], item['id'], source_id))
        return result_id

    @router.post('/lab/analyses/{analysis_id}/results', status_code=201)
    @write
    def publish(analysis_id: int, data: Publication, expected: str | None = Header(None, alias='If-Match'),
                user: dict = Depends(require_roles('LAB'))):
        connection = factory()
        item = current(connection, analysis_id)
        version(item['version'], expected)
        required = item['required_specimens']
        if not required or set(data.specimen_ids) != {source['id'] for source in required}:
            raise HTTPException(422, 'Selecciona exactamente las muestras requeridas actuales de esta analitica')
        if not all(source['received_at'] and source['suitability'] == 'ACCEPTED' for source in required):
            raise HTTPException(409, 'Todas las muestras fuente deben estar recibidas y ser aptas')
        if item['satisfies_current_samples']:
            raise HTTPException(409, 'Ya existe un resultado para estas muestras; usa la correccion con motivo')
        insert_version(connection, item, 'PUBLISH', data.result, data.specimen_ids, data.reason, user)
        return finish(connection, item, 'PUBLISH', user, data.reason)

    @router.post('/lab/results/{result_id}/corrections')
    @write
    def correct(result_id: int, data: Correction, expected: str | None = Header(None, alias='If-Match'),
                user: dict = Depends(require_roles('LAB'))):
        connection = factory()
        item = by_result(connection, result_id)
        version(item['version'], expected)
        latest = published(item, result_id)
        insert_version(connection, item, 'CORRECT', data.result, latest['specimen_ids'], data.reason, user)
        return finish(connection, item, 'CORRECT', user, data.reason)

    @router.post('/lab/results/{result_id}/annul')
    @write
    def annul(result_id: int, data: Reason, expected: str | None = Header(None, alias='If-Match'),
              user: dict = Depends(require_roles('LAB'))):
        connection = factory()
        item = by_result(connection, result_id)
        version(item['version'], expected)
        published(item, result_id)
        insert_version(connection, item, 'ANNUL', None, [], data.reason, user)
        return finish(connection, item, 'ANNUL', user, data.reason)

    @router.post('/lab/results/{result_id}/review')
    @medical_write
    def review(result_id: int, data: Reason, expected: str | None = Header(None, alias='If-Match'),
               user: dict = Depends(require_roles('DOCTOR'))):
        connection = factory()
        item = by_result(connection, result_id)
        owner = confirmed_owner(item, user)
        version(item['version'], expected)
        latest = published(item, result_id)
        if latest['review'] is not None:
            raise HTTPException(409, 'Esta version ya tiene revision medica registrada')
        connection.execute('''INSERT INTO lab_result_reviews(result_version_id,reviewed_by,reviewed_at,
            responsibility_context,owner_revision) VALUES (?,?,?,?,?)''',
            (result_id, actor(connection, user), timestamp(), owner['context'], owner['owner_revision']))
        return finish(connection, item, 'REVIEW', user, data.reason)

    @router.post('/lab/analyses/{analysis_id}/cancel')
    @medical_write
    def cancel_analysis(analysis_id: int, data: Reason, expected: str | None = Header(None, alias='If-Match'),
                        user: dict = Depends(require_roles('DOCTOR'))):
        connection = factory()
        item = current(connection, analysis_id, allow_cancelled=True)
        version(item['version'], expected)
        if item['cancelled_at'] is not None:
            raise HTTPException(409, 'La analitica ya esta cancelada')
        if item['needs_medical_review']:
            raise HTTPException(409, 'Revisa el resultado publicado antes de cancelar el trabajo pendiente')
        if item['satisfies_current_samples']:
            raise HTTPException(409, 'La analitica ya esta completada; las correcciones o anulaciones del resultado corresponden a laboratorio')
        connection.execute('UPDATE lab_analyses SET cancelled_at=?,cancelled_by=?,cancellation_reason=? WHERE id=?',
                           (timestamp(), actor(connection, user), data.reason, analysis_id))
        return finish(connection, item, 'CANCEL_ANALYSIS', user, data.reason)

    @router.post('/lab/analyses/{analysis_id}/reinstate')
    @medical_write
    def reinstate_analysis(analysis_id: int, data: Reason, expected: str | None = Header(None, alias='If-Match'),
                           user: dict = Depends(require_roles('DOCTOR'))):
        connection = factory()
        item = current(connection, analysis_id, allow_cancelled=True)
        version(item['version'], expected)
        if item['cancelled_at'] is None:
            raise HTTPException(409, 'La analitica no esta cancelada')
        if item['episode_status'] == 'CLOSED' and not item['satisfies_current_samples']:
            case = scoped_followup(connection, item['episode_id'], [analysis_id])
            if case['review_due_at'] is None:
                raise HTTPException(409, 'Registra un plan de seguimiento antes de restituir trabajo pendiente tras el alta')
        connection.execute('UPDATE lab_analyses SET cancelled_at=NULL,cancelled_by=NULL,cancellation_reason=NULL WHERE id=?', (analysis_id,))
        return finish(connection, item, 'REINSTATE_ANALYSIS', user, data.reason)

    return router
