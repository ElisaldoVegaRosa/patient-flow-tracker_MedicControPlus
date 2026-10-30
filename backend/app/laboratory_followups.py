"""Discharge preconditions and result custody; no clock-derived write versions."""
from datetime import datetime, timezone
import json

from fastapi import HTTPException

from .concurrency import etag
from .laboratory_context import lifecycle_revision, medical_responsibility
from . import laboratory_results as results, laboratory_samples as samples


def person(connection, user_id):
    row = connection.execute('SELECT id,username,display_name,role,active FROM users WHERE id=?', (user_id,)).fetchone()
    return dict(row) if row is not None else None


def discharge_state(connection, episode_id, detail):
    clinical = detail(connection, episode_id)
    lab = samples.episode_state(connection, episode_id)
    analyses = [item for order in lab['orders'] for item in order['results']]
    legacy_ids = set(lab['legacy_order_ids'])
    legacy_orders = [{key: item.get(key) for key in ('id', 'title', 'status', 'result', 'version')}
                     for item in clinical['tasks'] if item['id'] in legacy_ids]
    state = {
        'episode_id': episode_id, 'episode_status': clinical['status'],
        'clinical_version': clinical['clinical_version'],
        'medical_owner': medical_responsibility(connection, episode_id, analyses[0]['id'] if analyses else 0),
        'analyses': analyses,
        'orders': [{'task_id': order['task_id'], 'version': order['version']} for order in lab['orders']],
        'legacy_order_ids': lab['legacy_order_ids'],
        'legacy_orders': legacy_orders,
        'pending_legacy_orders': sum(item['status'] not in ('COMPLETED', 'ANNULLED') for item in legacy_orders),
        'pending_results': sum(order['pending_results'] for order in lab['orders']),
        'pending_reviews': sum(order['pending_reviews'] for order in lab['orders']),
        'cancelled_analyses': sum(order['cancelled_analyses'] for order in lab['orders']),
        'pending_reevaluations': connection.execute("""SELECT COUNT(*) FROM reevaluation_actions r
            JOIN tasks t ON t.id=r.task_id WHERE t.episode_id=? AND t.status='PENDING'""", (episode_id,)).fetchone()[0],
    }
    state['version'] = etag(state)
    return state


def followup_state(connection, followup_id, now=None):
    row = connection.execute("""SELECT f.*,e.status AS episode_status,p.name AS patient_name,
        p.identity_status FROM lab_followups f JOIN episodes e ON e.id=f.episode_id
        JOIN patients p ON p.id=e.patient_id WHERE f.id=?""", (followup_id,)).fetchone()
    if row is None:
        raise HTTPException(404, 'Seguimiento de laboratorio no encontrado')
    state = dict(row)
    state['current_cycle'] = bool(state['episode_status'] == 'CLOSED'
        and state['discharge_event_id'] == lifecycle_revision(connection, state['episode_id']))
    state['owner'] = person(connection, state['owner_user_id'])
    state['proposed'] = person(connection, state['pending_user_id'])
    scope = []
    analyses = []
    for row in connection.execute('SELECT * FROM lab_followup_scope WHERE followup_id=? ORDER BY analysis_id', (followup_id,)):
        item = dict(row)
        item['discharge_snapshot'] = json.loads(item['discharge_snapshot'])
        scope.append(item)
        analyses.append(results.analysis_state(connection, item['analysis_id']))
    state['scope'] = scope
    state['analyses'] = analyses
    active = [item for item in analyses if item['cancelled_at'] is None]
    state['pending_results'] = sum(not item['satisfies_current_samples'] for item in active)
    state['pending_reviews'] = sum(item['needs_medical_review'] for item in analyses)
    state['clinical_work_pending'] = bool(state['pending_results'] or state['pending_reviews'])
    state['requires_plan'] = bool(state['clinical_work_pending'] and state['review_due_at'] is None)
    state['coverage_pending'] = bool(state['clinical_work_pending'] and
        (not state['owner'] or state['owner']['role'] != 'DOCTOR' or state['owner']['active'] != 1))
    state['version'] = etag(state)
    clock = now or datetime.now(timezone.utc)
    state['overdue'] = bool(state['clinical_work_pending'] and state['review_due_at']
                            and datetime.fromisoformat(state['review_due_at']) < clock)
    return state


def episode_followups(connection, episode_id):
    return [followup_state(connection, row[0]) for row in connection.execute(
        'SELECT id FROM lab_followups WHERE episode_id=? ORDER BY id DESC', (episode_id,))]


def require_current(connection, followup_id):
    state = followup_state(connection, followup_id)
    if not state['current_cycle']:
        raise HTTPException(409, 'Este seguimiento corresponde a otro ciclo del episodio; consulta el estado actual')
    return state


def audit(connection, followup_id, action, actor_id, reason, before, after, timestamp):
    episode = connection.execute('SELECT episode_id FROM lab_followups WHERE id=?', (followup_id,)).fetchone()[0]
    def persisted(value):
        return {key: item for key, item in value.items() if key != 'overdue'} if value is not None else None
    connection.execute('''INSERT INTO lab_changes(episode_id,order_task_id,resource_type,resource_id,action,actor_user_id,
        created_at,reason,old_value,new_value) VALUES (?,NULL,'FOLLOWUP',?,?,?,?,?,?,?)''',
        (episode, followup_id, action, actor_id, timestamp(), reason,
         json.dumps(persisted(before), ensure_ascii=False), json.dumps(persisted(after), ensure_ascii=False)))


def scope_snapshot(item):
    latest = item['current_version']
    return {
        'required_specimen_ids': [row['id'] for row in item['required_specimens']],
        'version_id': latest['id'] if latest else None,
        'has_published_result': item['has_published_result'],
        'pending_result': item['cancelled_at'] is None and not item['satisfies_current_samples'],
        'pending_medical_review': item['needs_medical_review'],
        'cancelled_at': item['cancelled_at'],
        'cancellation_reason': item['cancellation_reason'],
    }
