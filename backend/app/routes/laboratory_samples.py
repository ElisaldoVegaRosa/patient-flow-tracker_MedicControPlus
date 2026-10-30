"""Structured sample API; schema activation remains an explicit offline operation."""
from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from ..input_validation import ClinicalNote, Location, TaskTitle
from ..laboratory_context import allow_lab_write
from .. import laboratory_samples as samples
from ..write_operations import atomic_write, transaction_factory


Key = Annotated[str, Field(min_length=1, max_length=40, pattern=r'^[A-Za-z0-9_-]+$')]
UserId = Annotated[int, Field(strict=True, gt=0)]


class Reason(BaseModel):
    model_config = ConfigDict(extra='forbid')
    reason: ClinicalNote


class Analysis(BaseModel):
    model_config = ConfigDict(extra='forbid')
    key: Key
    title: TaskTitle


class Specimen(BaseModel):
    model_config = ConfigDict(extra='forbid')
    key: Key
    kind: Literal['BLOOD', 'SALIVA', 'STOOL', 'URINE', 'OTHER']
    kind_description: TaskTitle | None = None
    analysis_keys: list[Key] = Field(min_length=1, max_length=30)

    @model_validator(mode='after')
    def distinct_links(self):
        if len(set(self.analysis_keys)) != len(self.analysis_keys):
            raise ValueError('No repitas la misma analitica en una muestra')
        if self.kind == 'OTHER' and self.kind_description is None:
            raise ValueError('Describe el tipo de muestra')
        return self


class CreateOrder(Reason):
    title: TaskTitle
    analyses: list[Analysis] = Field(min_length=1, max_length=30)
    specimens: list[Specimen] = Field(min_length=1, max_length=30)

    @model_validator(mode='after')
    def complete_mapping(self):
        keys = {item.key for item in self.analyses}
        if len(keys) != len(self.analyses) or len({item.key for item in self.specimens}) != len(self.specimens):
            raise ValueError('Cada analitica y muestra requiere una clave distinta')
        linked = {key for item in self.specimens for key in item.analysis_keys}
        if linked != keys:
            raise ValueError('Relaciona todas las analiticas con muestras de esta orden')
        return self


class Occurrence(Reason):
    occurred_at: AwareDatetime | None = None


class Collection(Occurrence):
    location: Location
    collector_kind: Literal['USER', 'PATIENT']
    collector_user_id: UserId | None = None

    @model_validator(mode='after')
    def patient_without_account(self):
        if self.collector_kind == 'PATIENT' and self.collector_user_id is not None:
            raise ValueError('La toma por el paciente no usa una cuenta profesional')
        return self


class Delivery(Occurrence):
    deliverer_kind: Literal['USER', 'PATIENT', 'THIRD_PARTY']
    deliverer_user_id: UserId | None = None

    @model_validator(mode='after')
    def professional_account(self):
        if self.deliverer_kind != 'USER' and self.deliverer_user_id is not None:
            raise ValueError('Solo un profesional del sistema usa identificador de cuenta')
        return self


class Suitability(Reason):
    suitability: Literal['ACCEPTED', 'REJECTED']


class Repeat(Reason):
    analysis_ids: list[Annotated[int, Field(strict=True, gt=0)]] = Field(min_length=1, max_length=30)

    @model_validator(mode='after')
    def distinct_analyses(self):
        if len(set(self.analysis_ids)) != len(self.analysis_ids):
            raise ValueError('Selecciona cada analitica una sola vez')
        self.analysis_ids = sorted(self.analysis_ids)
        return self


def create_router(connection_factory, timestamp, detail, add_event, require_active_episode, require_roles, *, include_discharge=True):
    router = APIRouter()
    factory = transaction_factory(connection_factory)

    def episode_detail(connection, episode_id):
        return {**detail(connection, episode_id), 'laboratory': samples.episode_state(connection, episode_id)}

    write = atomic_write(connection_factory, episode_detail, require_key=True)

    def version(actual, expected):
        if not expected:
            raise HTTPException(428, 'Consulta la version actual antes de guardar')
        if actual != expected:
            raise HTTPException(409, {'code': 'version_conflict', 'message': 'Cambio la muestra, la orden o el episodio. Revisa los datos actuales.'})

    def actor(connection, user):
        row = connection.execute('SELECT id FROM users WHERE username=? AND active=1 AND role=?',
                                 (user['username'], user['role'])).fetchone()
        if row is None:
            raise HTTPException(403, 'La cuenta profesional ya no esta disponible')
        return row['id']

    def professional(connection, identifier):
        if not connection.execute("SELECT 1 FROM users WHERE id=? AND active=1 AND role IN ('NURSE','LAB')", (identifier,)).fetchone():
            raise HTTPException(422, 'Selecciona un profesional activo de enfermeria o laboratorio')
        return identifier

    def current(connection, specimen_id, expected):
        row = connection.execute('SELECT order_task_id FROM lab_specimens WHERE id=?', (specimen_id,)).fetchone()
        if row is None:
            raise HTTPException(404, 'Muestra no encontrada')
        order = samples.order_state(connection, row['order_task_id'])
        candidate = next(item for item in order['specimens'] if item['id'] == specimen_id)
        allow_lab_write(connection, order['episode_id'], candidate['analysis_ids'] + candidate['historical_analysis_ids'])
        if order['task_status'] != 'PENDING':
            raise HTTPException(409, 'La orden ya no admite registro de muestras')
        item = next(item for item in order['specimens'] if item['id'] == specimen_id)
        version(item['version'], expected)
        return order, item

    def occurred(data, *, earliest=None, latest=None):
        now = datetime.fromisoformat(timestamp())
        instant = data.occurred_at or now
        if instant > now:
            raise HTTPException(422, 'El hecho no puede tener una fecha futura')
        if earliest and instant < datetime.fromisoformat(earliest):
            raise HTTPException(422, 'La fecha es anterior al hecho precedente registrado')
        if latest and instant > datetime.fromisoformat(latest):
            raise HTTPException(422, 'La fecha es posterior al hecho siguiente registrado')
        return instant.astimezone(timezone.utc).isoformat()

    def finish(connection, order, item, action, user, reason, replacement_id=None):
        connection.execute('UPDATE lab_specimens SET revision=revision+1 WHERE id=?', (item['id'],))
        connection.execute('UPDATE lab_orders SET revision=revision+1 WHERE task_id=?', (order['task_id'],))
        updated = samples.order_state(connection, order['task_id'])
        after = next(row for row in updated['specimens'] if row['id'] == item['id'])
        before = item
        replacement_note = ''
        if replacement_id is not None:
            replacement = next(row for row in updated['specimens'] if row['id'] == replacement_id)
            before = {'source': item, 'replacement': None}
            after = {'source': after, 'replacement': replacement}
            replacement_note = f" Nueva muestra #{replacement_id}."
        samples.audit(connection, order['task_id'], 'SPECIMEN', item['id'], action, actor(connection, user), reason, before, after, timestamp)
        add_event(connection, order['episode_id'], 'LAB_SAMPLE_' + action, user['username'],
                  f"Muestra #{item['id']}.{replacement_note} Motivo: {reason}")
        return episode_detail(connection, order['episode_id'])

    @router.get('/lab/sample-professionals')
    def sample_professionals(user: dict = Depends(require_roles('NURSE', 'LAB'))):
        connection = factory()
        try:
            return {'professionals': [dict(row) for row in connection.execute(
                "SELECT id,username,display_name,role FROM users WHERE active=1 AND role IN ('NURSE','LAB') ORDER BY display_name,username")]}
        finally:
            connection.close()

    @router.get('/episodes/{episode_id}/laboratory')
    def get_laboratory(episode_id: int, user: dict = Depends(require_roles('DOCTOR', 'NURSE', 'LAB', 'SUPERVISOR'))):
        connection = factory()
        try:
            connection.execute('BEGIN')
            return samples.episode_state(connection, episode_id)
        finally:
            connection.close()

    @router.post('/episodes/{episode_id}/lab-orders', status_code=201)
    @write
    def create_order(episode_id: int, data: CreateOrder, expected: str | None = Header(None, alias='If-Match'),
                     user: dict = Depends(require_roles('DOCTOR'))):
        connection = factory()
        require_active_episode(connection, episode_id)
        version(detail(connection, episode_id)['clinical_version'], expected)
        user_id = actor(connection, user)
        created_at = timestamp()
        task_id = connection.execute("INSERT INTO tasks(episode_id,title,service,status,created_at) VALUES (?,?,'LAB','PENDING',?)",
                                     (episode_id, data.title, created_at)).lastrowid
        connection.execute('INSERT INTO lab_orders(task_id,episode_id,created_by,created_at) VALUES (?,?,?,?)',
                           (task_id, episode_id, user_id, created_at))
        analyses = {item.key: connection.execute('INSERT INTO lab_analyses(order_task_id,title) VALUES (?,?)',
                                                (task_id, item.title)).lastrowid for item in data.analyses}
        for item in data.specimens:
            specimen_id = connection.execute('INSERT INTO lab_specimens(order_task_id,kind,kind_description) VALUES (?,?,?)',
                                             (task_id, item.kind, item.kind_description)).lastrowid
            for key in item.analysis_keys:
                connection.execute('INSERT INTO lab_analysis_specimens(order_task_id,analysis_id,specimen_id) VALUES (?,?,?)',
                                   (task_id, analyses[key], specimen_id))
        samples.audit(connection, task_id, 'ORDER', task_id, 'CREATE', user_id, data.reason,
                      None, samples.order_state(connection, task_id), timestamp)
        add_event(connection, episode_id, 'LAB_ORDER_CREATED', user['username'], data.title)
        return episode_detail(connection, episode_id)

    @router.post('/lab/specimens/{specimen_id}/collection')
    @write
    def collect(specimen_id: int, data: Collection, expected: str | None = Header(None, alias='If-Match'),
                user: dict = Depends(require_roles('NURSE', 'LAB'))):
        connection = factory()
        order, item = current(connection, specimen_id, expected)
        if item['collected_at'] is not None:
            raise HTTPException(409, 'La toma de esta muestra ya esta registrada')
        user_id = professional(connection, data.collector_user_id or actor(connection, user)) if data.collector_kind == 'USER' else None
        instant = occurred(data, latest=item['delivered_at'] or item['received_at'])
        connection.execute('UPDATE lab_specimens SET collected_at=?,collection_location=?,collector_kind=?,collector_user_id=? WHERE id=?',
                           (instant, data.location, data.collector_kind, user_id, specimen_id))
        return finish(connection, order, item, 'COLLECT', user, data.reason)

    @router.post('/lab/specimens/{specimen_id}/delivery')
    @write
    def deliver(specimen_id: int, data: Delivery, expected: str | None = Header(None, alias='If-Match'),
                user: dict = Depends(require_roles('NURSE', 'LAB'))):
        connection = factory()
        order, item = current(connection, specimen_id, expected)
        if item['delivered_at'] is not None:
            raise HTTPException(409, 'La entrega de esta muestra ya esta registrada')
        user_id = professional(connection, data.deliverer_user_id or actor(connection, user)) if data.deliverer_kind == 'USER' else None
        instant = occurred(data, earliest=item['collected_at'], latest=item['received_at'])
        connection.execute('UPDATE lab_specimens SET delivered_at=?,deliverer_kind=?,deliverer_user_id=? WHERE id=?',
                           (instant, data.deliverer_kind, user_id, specimen_id))
        return finish(connection, order, item, 'DELIVER', user, data.reason)

    @router.post('/lab/specimens/{specimen_id}/receipt')
    @write
    def receive(specimen_id: int, data: Occurrence, expected: str | None = Header(None, alias='If-Match'),
                user: dict = Depends(require_roles('LAB'))):
        connection = factory()
        order, item = current(connection, specimen_id, expected)
        if item['received_at'] is not None:
            raise HTTPException(409, 'La recepcion de esta muestra ya esta registrada')
        instant = occurred(data, earliest=item['delivered_at'] or item['collected_at'])
        connection.execute('UPDATE lab_specimens SET received_at=?,received_by=? WHERE id=?', (instant, actor(connection, user), specimen_id))
        return finish(connection, order, item, 'RECEIVE', user, data.reason)

    @router.post('/lab/specimens/{specimen_id}/suitability')
    @write
    def assess(specimen_id: int, data: Suitability, expected: str | None = Header(None, alias='If-Match'),
               user: dict = Depends(require_roles('LAB'))):
        connection = factory()
        order, item = current(connection, specimen_id, expected)
        if item['received_at'] is None:
            raise HTTPException(409, 'Registra la recepcion antes de evaluar la aptitud')
        if item['suitability'] != 'UNKNOWN':
            raise HTTPException(409, 'La aptitud ya fue registrada; conserva el historial de esta muestra')
        connection.execute('UPDATE lab_specimens SET suitability=?,assessed_at=?,assessed_by=?,suitability_reason=? WHERE id=?',
                           (data.suitability, timestamp(), actor(connection, user), data.reason, specimen_id))
        return finish(connection, order, item, 'ASSESS', user, data.reason)

    @router.post('/lab/specimens/{specimen_id}/repeat')
    @write
    def repeat(specimen_id: int, data: Repeat, expected: str | None = Header(None, alias='If-Match'),
               user: dict = Depends(require_roles('LAB'))):
        connection = factory()
        order, item = current(connection, specimen_id, expected)
        if item['suitability'] != 'REJECTED':
            raise HTTPException(409, 'La repeticion requiere una muestra registrada como no apta')
        selected = set(data.analysis_ids)
        linked = set(item['analysis_ids']) | set(item['historical_analysis_ids'])
        if not selected <= linked:
            raise HTTPException(422, 'Selecciona analiticas vinculadas a esta muestra y orden')
        if not selected <= set(item['analysis_ids']):
            raise HTTPException(409, 'Alguna analitica seleccionada ya tiene otra muestra requerida; consulta la repeticion actual')
        if any(analysis['id'] in selected and analysis['cancelled_at'] is not None for analysis in order['analyses']):
            raise HTTPException(409, 'No se puede solicitar una muestra para una analitica cancelada')
        user_id = actor(connection, user)
        new_id = connection.execute('INSERT INTO lab_specimens(order_task_id,kind,kind_description) VALUES (?,?,?)',
                                    (order['task_id'], item['kind'], item['kind_description'])).lastrowid
        requested_at = timestamp()
        for analysis_id in data.analysis_ids:
            connection.execute('INSERT INTO lab_analysis_specimens(order_task_id,analysis_id,specimen_id) VALUES (?,?,?)',
                               (order['task_id'], analysis_id, new_id))
            connection.execute('UPDATE lab_analysis_specimens SET current_requirement=0 WHERE analysis_id=? AND specimen_id=?',
                               (analysis_id, specimen_id))
            connection.execute('''INSERT INTO lab_specimen_repeats(order_task_id,analysis_id,previous_specimen_id,
                new_specimen_id,requested_by,requested_at,reason) VALUES (?,?,?,?,?,?,?)''',
                (order['task_id'], analysis_id, specimen_id, new_id, user_id, requested_at, data.reason))
        return finish(connection, order, item, 'REPEAT', user, data.reason, replacement_id=new_id)

    from .laboratory_results import create_router as results_router
    router.include_router(results_router(connection_factory, timestamp, detail, add_event, require_active_episode, require_roles))
    from .laboratory_followups import create_router as followups_router
    router.include_router(followups_router(connection_factory, timestamp, detail, add_event, require_active_episode, require_roles,
                                         include_discharge=include_discharge))
    return router
