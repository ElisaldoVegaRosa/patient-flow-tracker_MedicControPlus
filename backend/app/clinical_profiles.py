"""Confirmed medical responsibility and versions for patient clinical profiles."""
from fastapi import HTTPException
from .concurrency import etag


def context(connection, episode_id):
    row = connection.execute("""SELECT e.id, e.patient_id, e.status, p.identity_revision,
        c.user_id, c.revision AS owner_revision, u.username AS owner_username,
        u.display_name AS owner_name, u.active AS owner_active, u.role AS owner_role
        FROM episodes e JOIN patients p ON p.id=e.patient_id
        LEFT JOIN care_slots c ON c.episode_id=e.id AND c.discipline='DOCTOR'
        LEFT JOIN users u ON u.id=c.user_id WHERE e.id=?""", (episode_id,)).fetchone()
    if row is None:
        raise HTTPException(404, 'Episodio no encontrado')
    return dict(row)


def owns(current, user):
    return (current['status']=='ACTIVE' and user['role']=='DOCTOR' and current['owner_active']==1
            and current['owner_role']=='DOCTOR' and current['owner_username']==user['username'])


def version(connection, current, record, namespace=None):
    lifecycle = connection.execute("""SELECT COALESCE(MAX(id),0) FROM events WHERE episode_id=?
        AND type IN ('DISCHARGE','EPISODE_REOPENED','ARRIVAL_ANNULLED')""", (current['id'],)).fetchone()[0]
    value = [current['id'], current['patient_id'], current['identity_revision'], current['status'],
                 current['user_id'], current['owner_revision'], current['owner_active'], current['owner_role'],
                 record['revision'], lifecycle]
    if namespace is not None:
        value.append(namespace)
    return etag(value)
