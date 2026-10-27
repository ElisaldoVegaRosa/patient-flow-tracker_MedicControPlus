from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, model_validator
from ..input_validation import ClinicalNote, TaskTitle
from ..write_operations import atomic_write, transaction_factory
from .. import reevaluations as reevaluation


class Reason(BaseModel):
    model_config = ConfigDict(extra='forbid')
    reason: ClinicalNote


class Schedule(Reason):
    due_at: datetime

    @model_validator(mode='after')
    def explicit_timezone(self):
        if self.due_at.tzinfo is None:
            raise ValueError('Indica fecha y hora con zona horaria explicita')
        return self


class Create(Schedule):
    title: TaskTitle
    medical_instruction: TaskTitle | None = None
    nursing_instruction: TaskTitle | None = None

    @model_validator(mode='after')
    def has_action(self):
        if not self.medical_instruction and not self.nursing_instruction:
            raise ValueError('Indica una accion de medicina, enfermeria o ambas')
        return self


class Complete(Reason):
    completion_note: ClinicalNote


def create_router(connection_factory, timestamp, detail, add_event, require_active_episode, require_roles):
    factory = transaction_factory(connection_factory)
    router = APIRouter()
    write = atomic_write(connection_factory, detail, require_key=True)

    def future(value):
        if value <= datetime.fromisoformat(timestamp()):
            raise HTTPException(422, 'La fecha de reevaluacion debe ser futura; revisa la hora antes de guardar')
        return value.astimezone(timezone.utc).isoformat()

    def version(actual, expected):
        if not expected:
            raise HTTPException(428, 'Consulta la version actual antes de guardar')
        if actual != expected:
            raise HTTPException(409, {'code': 'version_conflict', 'message': 'Cambio el episodio, la reevaluacion o su responsable. Revisa los datos actuales antes de guardar.'})

    def current(connection, task_id):
        row = connection.execute('SELECT episode_id FROM tasks WHERE id=?', (task_id,)).fetchone()
        if not row:
            raise HTTPException(404, 'Reevaluacion no encontrada')
        require_active_episode(connection, row['episode_id'])
        item = next((item for item in reevaluation.actions(connection, row['episode_id']) if item['id'] == task_id), None)
        if not item:
            raise HTTPException(404, 'Reevaluacion no encontrada')
        if item['status'] != 'PENDING':
            raise HTTPException(409, 'La accion ya esta realizada o cancelada')
        return item

    def finish(connection, item, action, user, reason, before):
        connection.execute('UPDATE reevaluation_actions SET revision=revision+1 WHERE task_id=?', (item['id'],))
        after = next(row for row in reevaluation.actions(connection, item['episode_id']) if row['id'] == item['id'])
        reevaluation.audit(connection, item['id'], action, user, reason, before, after, timestamp)
        labels = {'COMPLETE': 'Reevaluacion realizada', 'RESCHEDULE': 'Reevaluacion reprogramada', 'CANCEL': 'Reevaluacion cancelada'}
        add_event(connection, item['episode_id'], 'REEVALUATION_' + action, user['username'],
                  f"{labels[action]}: {item['title']}. Motivo: {reason}")
        return detail(connection, item['episode_id'])

    @router.post('/episodes/{episode_id}/reevaluations', status_code=201)
    @write
    def create(episode_id: int, data: Create, expected: str | None = Header(None, alias='If-Match'),
               user: dict = Depends(require_roles('DOCTOR'))):
        connection = factory()
        require_active_episode(connection, episode_id)
        version(detail(connection, episode_id)['clinical_version'], expected)
        due_at = future(data.due_at)
        group = connection.execute('INSERT INTO reevaluation_groups(episode_id,title,created_by,created_at) VALUES (?,?,?,?)',
                                   (episode_id, data.title, user['username'], timestamp())).lastrowid
        for service, instruction in (('MEDICAL', data.medical_instruction), ('NURSING', data.nursing_instruction)):
            if instruction is None:
                continue
            identifier = connection.execute("INSERT INTO tasks(episode_id,title,service,status,created_at) VALUES (?,?,?,'PENDING',?)",
                                             (episode_id, instruction, service, timestamp())).lastrowid
            connection.execute('INSERT INTO reevaluation_actions(task_id,group_id,due_at) VALUES (?,?,?)', (identifier, group, due_at))
            item = next(row for row in reevaluation.actions(connection, episode_id) if row['id'] == identifier)
            reevaluation.audit(connection, identifier, 'CREATE', user, data.reason, None, item, timestamp)
        add_event(connection, episode_id, 'REEVALUATION_CREATED', user['username'], f"Reevaluacion programada: {data.title}. Motivo: {data.reason}")
        return detail(connection, episode_id)

    @router.post('/reevaluations/{task_id}/reschedule')
    @write
    def reschedule(task_id: int, data: Schedule, expected: str | None = Header(None, alias='If-Match'),
                   user: dict = Depends(require_roles('DOCTOR'))):
        connection = factory()
        item = current(connection, task_id)
        version(item['version'], expected)
        due_at = future(data.due_at)
        if due_at == item['due_at']:
            raise HTTPException(409, 'Selecciona una fecha u hora diferente')
        connection.execute('UPDATE reevaluation_actions SET due_at=? WHERE task_id=?', (due_at, task_id))
        return finish(connection, item, 'RESCHEDULE', user, data.reason, item)

    @router.post('/reevaluations/{task_id}/cancel')
    @write
    def cancel(task_id: int, data: Reason, expected: str | None = Header(None, alias='If-Match'),
               user: dict = Depends(require_roles('DOCTOR'))):
        connection = factory()
        item = current(connection, task_id)
        version(item['version'], expected)
        connection.execute("UPDATE tasks SET status='CANCELLED' WHERE id=?", (task_id,))
        return finish(connection, item, 'CANCEL', user, data.reason, item)

    @router.post('/reevaluations/{task_id}/complete')
    @write
    def complete(task_id: int, data: Complete, expected: str | None = Header(None, alias='If-Match'),
                 user: dict = Depends(require_roles('DOCTOR', 'NURSE'))):
        connection = factory()
        item = current(connection, task_id)
        role = 'DOCTOR' if item['service'] == 'MEDICAL' else 'NURSE'
        if user['role'] != role or user['username'] != item['owner_username']:
            raise HTTPException(403, 'Solo el responsable confirmado de esta disciplina puede completar la reevaluacion; acepta el relevo antes de sustituirlo')
        version(item['version'], expected)
        connection.execute("UPDATE tasks SET status='COMPLETED',result=? WHERE id=?", (data.completion_note, task_id))
        return finish(connection, item, 'COMPLETE', user, data.reason, item)

    return router
