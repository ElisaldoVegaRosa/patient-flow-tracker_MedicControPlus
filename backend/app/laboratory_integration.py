"""Read-only bridge and legacy-write guards; never migrates or adopts orders."""
from fastapi import HTTPException

from .concurrency import etag
from .laboratory_schema import LABORATORY_TABLES, SCHEMA_VERSION


def available(connection):
    tables = {row[0] for row in connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'lab_*'")}
    if not tables:
        return False
    if not LABORATORY_TABLES <= tables:
        raise HTTPException(409, 'El esquema de laboratorio esta incompleto; requiere revision tecnica')
    versions = [row[0] for row in connection.execute('SELECT version FROM lab_schema')]
    if versions != [SCHEMA_VERSION]:
        raise HTTPException(409, 'Version de laboratorio no compatible; requiere revision tecnica')
    return True


def guard_legacy_write(connection, kind, identifier):
    if kind not in {'task', 'task_result'} or not available(connection):
        return
    structured = connection.execute('SELECT 1 FROM lab_orders WHERE task_id=?', (identifier,)).fetchone()
    if structured:
        message = 'Esta orden requiere el circuito de muestras y resultados por analitica'
        raise HTTPException(409, {'code': 'structured_laboratory_required', 'message': message})


def enrich_episode(connection, episode):
    if not available(connection):
        return episode
    # Lazy imports avoid a cycle through concurrency and laboratory read models.
    from .laboratory_samples import episode_state
    from .laboratory_followups import episode_followups

    lab = episode_state(connection, episode['id'])
    followups = episode_followups(connection, episode['id'])
    episode['laboratory'] = lab
    episode['lab_followups'] = followups
    if lab['orders'] or followups:
        # The deadline is persisted; whether it has passed must not age a draft.
        persisted = [{key: value for key, value in case.items() if key != 'overdue'} for case in followups]
        episode['laboratory_version'] = etag([lab, persisted])
    return episode
