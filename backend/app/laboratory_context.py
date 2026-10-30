"""Persisted episode cycle and explicitly accepted responsibility for LAB work."""
from fastapi import HTTPException


def lifecycle_revision(connection, episode_id):
    return connection.execute("""SELECT COALESCE(MAX(id),0) FROM events WHERE episode_id=?
        AND type IN ('DISCHARGE','EPISODE_REOPENED','ARRIVAL_ANNULLED')""", (episode_id,)).fetchone()[0]


def current_followup(connection, episode_id):
    return connection.execute("""SELECT f.* FROM lab_followups f JOIN episodes e ON e.id=f.episode_id
        WHERE f.episode_id=? AND e.status='CLOSED' AND f.discharge_event_id=?""",
        (episode_id, lifecycle_revision(connection, episode_id))).fetchone()


def scoped_followup(connection, episode_id, analysis_ids):
    case = current_followup(connection, episode_id)
    if case is None or not analysis_ids:
        raise HTTPException(409, 'El episodio cerrado no tiene seguimiento vigente para estas analiticas')
    scope = {row[0] for row in connection.execute('SELECT analysis_id FROM lab_followup_scope WHERE followup_id=?', (case['id'],))}
    if not set(analysis_ids) <= scope:
        raise HTTPException(409, 'La analitica no forma parte del seguimiento autorizado al alta')
    return case


def allow_lab_write(connection, episode_id, analysis_ids):
    episode = connection.execute('SELECT status FROM episodes WHERE id=?', (episode_id,)).fetchone()
    if episode is None:
        raise HTTPException(404, 'Episodio no encontrado')
    if episode['status'] == 'ACTIVE':
        return
    if episode['status'] != 'CLOSED':
        raise HTTPException(409, 'El episodio no admite esta accion')
    scoped_followup(connection, episode_id, analysis_ids)


def medical_responsibility(connection, episode_id, analysis_id):
    episode = connection.execute('SELECT status FROM episodes WHERE id=?', (episode_id,)).fetchone()
    if episode['status'] == 'ACTIVE':
        row = connection.execute("""SELECT c.revision AS owner_revision,u.id,u.username,u.display_name,u.role,u.active
            FROM care_slots c LEFT JOIN users u ON u.id=c.user_id WHERE c.episode_id=? AND c.discipline='DOCTOR'""", (episode_id,)).fetchone()
        return {**dict(row), 'context': 'ACTIVE_EPISODE', 'context_id': episode_id} if row is not None else None
    if episode['status'] != 'CLOSED':
        return None
    case = current_followup(connection, episode_id)
    if case is None or not connection.execute('SELECT 1 FROM lab_followup_scope WHERE followup_id=? AND analysis_id=?',
                                               (case['id'], analysis_id)).fetchone():
        return None
    row = connection.execute('SELECT id,username,display_name,role,active FROM users WHERE id=?', (case['owner_user_id'],)).fetchone()
    return {**dict(row), 'owner_revision': case['revision'], 'context': 'FOLLOWUP', 'context_id': case['id']}
