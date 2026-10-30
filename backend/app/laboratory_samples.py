"""Structured sample read models; no migration or startup side effects."""
import json

from fastapi import HTTPException

from .concurrency import etag
from .laboratory_results import lifecycle_revision, order_results


def order_state(connection, task_id):
    row = connection.execute("""SELECT o.*,t.title,t.status AS task_status,e.status AS episode_status,
        p.identity_revision FROM lab_orders o JOIN tasks t ON t.id=o.task_id
        JOIN episodes e ON e.id=o.episode_id JOIN patients p ON p.id=e.patient_id
        WHERE o.task_id=?""", (task_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Orden estructurada no encontrada")
    order = dict(row)
    order['lifecycle_revision'] = lifecycle_revision(connection, order['episode_id'])
    order['analyses'] = [dict(item) for item in connection.execute(
        'SELECT * FROM lab_analyses WHERE order_task_id=? ORDER BY id', (task_id,))]
    specimens = []
    for item in connection.execute('SELECT * FROM lab_specimens WHERE order_task_id=? ORDER BY id', (task_id,)):
        specimen = dict(item)
        specimen['analysis_ids'] = [link[0] for link in connection.execute(
            'SELECT analysis_id FROM lab_analysis_specimens WHERE specimen_id=? AND current_requirement=1 ORDER BY analysis_id', (item['id'],))]
        specimen['historical_analysis_ids'] = [link[0] for link in connection.execute(
            'SELECT analysis_id FROM lab_analysis_specimens WHERE specimen_id=? AND current_requirement=0 ORDER BY analysis_id', (item['id'],))]
        specimen['version'] = etag([specimen, order['revision'], order['episode_status'], order['identity_revision'], order['lifecycle_revision']])
        specimens.append(specimen)
    order['specimens'] = specimens
    order['repeats'] = [dict(item) for item in connection.execute(
        '''SELECT r.*,u.username AS requested_by_username FROM lab_specimen_repeats r
           JOIN users u ON u.id=r.requested_by WHERE r.order_task_id=? ORDER BY r.id''', (task_id,))]
    order.update(order_results(connection, task_id))
    order['version'] = etag(order)
    return order


def episode_state(connection, episode_id):
    if not connection.execute('SELECT 1 FROM episodes WHERE id=?', (episode_id,)).fetchone():
        raise HTTPException(404, "Episodio no encontrado")
    return {
        'orders': [order_state(connection, row[0]) for row in connection.execute(
            'SELECT task_id FROM lab_orders WHERE episode_id=? ORDER BY task_id', (episode_id,))],
        'legacy_order_ids': [row[0] for row in connection.execute("""SELECT id FROM tasks WHERE episode_id=? AND service='LAB'
            AND NOT EXISTS (SELECT 1 FROM lab_orders WHERE task_id=tasks.id) ORDER BY id""", (episode_id,))],
        'changes': [dict(row) for row in connection.execute(
            'SELECT * FROM lab_changes WHERE episode_id=? ORDER BY id DESC', (episode_id,))],
    }


def audit(connection, order_id, resource, resource_id, action, actor_id, reason, before, after, timestamp):
    episode_id = connection.execute('SELECT episode_id FROM lab_orders WHERE task_id=?', (order_id,)).fetchone()[0]
    connection.execute("""INSERT INTO lab_changes(episode_id,order_task_id,resource_type,resource_id,action,
        actor_user_id,created_at,reason,old_value,new_value) VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (episode_id, order_id, resource, resource_id, action, actor_id, timestamp(), reason,
         json.dumps(before, ensure_ascii=False), json.dumps(after, ensure_ascii=False)))
