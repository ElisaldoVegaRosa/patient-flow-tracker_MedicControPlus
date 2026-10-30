"""Shared discharge contract and transactional LAB custody; no route or migration."""
from datetime import datetime, timezone
import json

from fastapi import HTTPException
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from . import laboratory_followups as followups
from .input_validation import ClinicalNote, DischargeNote


class Plan(BaseModel):
    model_config = ConfigDict(extra='forbid')
    reason: ClinicalNote
    review_due_at: AwareDatetime
    communication_plan: ClinicalNote


class LegacyReview(BaseModel):
    model_config = ConfigDict(extra='forbid')
    task_id: int = Field(strict=True, gt=0)
    version: str = Field(min_length=1, max_length=256)


class DischargeRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    note: DischargeNote = 'Alta médica'
    reason: ClinicalNote | None = None
    followup: Plan | None = None
    legacy_reviews: list[LegacyReview] = Field(default_factory=list, max_length=100)

    @model_validator(mode='after')
    def distinct_reviews(self):
        if len({item.task_id for item in self.legacy_reviews}) != len(self.legacy_reviews):
            raise ValueError('Confirma cada resultado anterior una sola vez')
        return self


def fingerprint(payload, key):
    # Preserve receipts created before the optional LAB fields existed.
    result = dict(payload)
    data = dict(result.get('data', {}))
    for field in ('reason', 'followup'):
        if data.get(field) is None:
            data.pop(field, None)
    if not data.get('legacy_reviews'):
        data.pop('legacy_reviews', None)
    result['data'] = data
    return result


def future(plan, timestamp):
    if plan.review_due_at <= datetime.fromisoformat(timestamp()):
        raise HTTPException(422, 'La fecha prevista de revision debe ser futura al registrar el plan')
    return plan.review_due_at.astimezone(timezone.utc).isoformat()


def close(connection, episode_id, data, user, state, timestamp, add_event):
    # The caller owns BEGIN IMMEDIATE and validates the current episode version.
    if data.reason is None:
        raise HTTPException(422, 'Indica el motivo del alta con laboratorio')
    actor = connection.execute('SELECT id FROM users WHERE username=? AND active=1', (user['username'],)).fetchone()
    if actor is None:
        raise HTTPException(403, 'La cuenta profesional ya no esta disponible')
    actor_id = actor[0]
    if state['pending_reevaluations']:
        raise HTTPException(409, 'Completa o cancela con motivo las reevaluaciones pendientes antes del alta')
    if state['pending_legacy_orders']:
        raise HTTPException(409, 'Hay ordenes heredadas pendientes; resuelvelas en laboratorio antes del alta')
    legacy = [item for item in state['legacy_orders'] if item['status'] == 'COMPLETED']
    if any(not item['result'] or not item['result'].strip() for item in legacy):
        raise HTTPException(409, 'Hay ordenes heredadas completadas sin texto de resultado; revisalas en laboratorio')
    expected_legacy = {item['id']: item['version'] for item in legacy}
    if {item.task_id: item.version for item in data.legacy_reviews} != expected_legacy:
        raise HTTPException(409, {'code': 'version_conflict', 'message': 'Confirma la revision expresa de cada resultado heredado vigente antes del alta'})
    if state['pending_reviews']:
        raise HTTPException(409, 'Revisa los resultados publicados antes del alta')
    owner = state['medical_owner']
    if state['analyses'] and (not owner or owner['role'] != 'DOCTOR' or owner['active'] != 1):
        raise HTTPException(409, 'Confirma un medico responsable activo antes del alta con laboratorio')
    if legacy and (not owner or owner['username'] != user['username']):
        raise HTTPException(403, 'La revision de resultados heredados corresponde al medico responsable confirmado')
    if state['pending_results']:
        if owner['username'] != user['username']:
            raise HTTPException(403, 'El alta con resultados pendientes corresponde al medico responsable confirmado')
        if data.followup is None:
            raise HTTPException(422, 'Indica motivo, fecha de revision y como se informara al paciente')
    elif data.followup is not None:
        raise HTTPException(422, 'No hay resultados pendientes que requieran ese plan al alta')
    due = future(data.followup, timestamp) if data.followup is not None else None
    connection.execute("UPDATE episodes SET status='CLOSED',closed_at=? WHERE id=?", (timestamp(), episode_id))
    add_event(connection, episode_id, 'DISCHARGE', user['username'], data.note)
    event_id = connection.execute("SELECT MAX(id) FROM events WHERE episode_id=? AND type='DISCHARGE'", (episode_id,)).fetchone()[0]
    for item in legacy:
        snapshot = {**item, 'discharge_event_id': event_id}
        connection.execute('''INSERT INTO lab_changes(episode_id,order_task_id,resource_type,resource_id,action,
            actor_user_id,created_at,reason,old_value,new_value) VALUES (?,NULL,'LEGACY_RESULT',?,'REVIEW_AT_DISCHARGE',?,?,?,?,?)''',
            (episode_id, item['id'], actor_id, timestamp(), data.reason, 'null', json.dumps(snapshot, ensure_ascii=False)))
        add_event(connection, episode_id, 'LAB_LEGACY_RESULT_REVIEWED', user['username'],
                  f"Orden #{item['id']}: {item['title']}. Motivo: {data.reason}")
    if state['analyses']:
        reason = data.followup.reason if data.followup else 'Custodia de resultados revisados tras el alta'
        case_id = connection.execute('''INSERT INTO lab_followups(episode_id,discharge_event_id,owner_user_id,
            review_due_at,communication_plan,reason,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)''',
            (episode_id, event_id, owner['id'], due, data.followup.communication_plan if data.followup else None,
             reason, actor_id, timestamp())).lastrowid
        for item in state['analyses']:
            latest = item['current_version']
            connection.execute('''INSERT INTO lab_followup_scope(followup_id,episode_id,order_task_id,analysis_id,
                version_at_discharge,discharge_snapshot) VALUES (?,?,?,?,?,?)''',
                (case_id, episode_id, item['order_task_id'], item['id'], latest['id'] if latest else None,
                 json.dumps(followups.scope_snapshot(item), ensure_ascii=False)))
        followups.audit(connection, case_id, 'DISCHARGE', actor_id, data.reason, None,
                        followups.followup_state(connection, case_id), timestamp)
