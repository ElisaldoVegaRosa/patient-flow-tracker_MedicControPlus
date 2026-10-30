"""Versioned result read models; independent of sample writers and startup."""
from fastapi import HTTPException

from .concurrency import etag
from .laboratory_context import lifecycle_revision, medical_responsibility


def analysis_state(connection, analysis_id):
    row = connection.execute("""SELECT a.*,o.episode_id,o.revision AS order_revision,t.status AS task_status,
        e.status AS episode_status,p.identity_revision FROM lab_analyses a JOIN lab_orders o ON o.task_id=a.order_task_id
        JOIN tasks t ON t.id=o.task_id JOIN episodes e ON e.id=o.episode_id JOIN patients p ON p.id=e.patient_id
        WHERE a.id=?""", (analysis_id,)).fetchone()
    if row is None:
        raise HTTPException(404, 'Analitica estructurada no encontrada')
    result = dict(row)
    result['lifecycle_revision'] = lifecycle_revision(connection, result['episode_id'])
    result['medical_owner'] = medical_responsibility(connection, result['episode_id'], analysis_id)
    result['required_specimens'] = [dict(item) for item in connection.execute("""SELECT s.id,s.received_at,s.suitability,s.revision
        FROM lab_analysis_specimens r JOIN lab_specimens s ON s.id=r.specimen_id
        WHERE r.analysis_id=? AND r.current_requirement=1 ORDER BY s.id""", (analysis_id,))]
    versions = []
    for row in connection.execute('SELECT * FROM lab_result_versions WHERE analysis_id=? ORDER BY sequence', (analysis_id,)):
        item = dict(row)
        item['specimen_ids'] = [source[0] for source in connection.execute(
            'SELECT specimen_id FROM lab_result_specimens WHERE result_version_id=? ORDER BY specimen_id', (item['id'],))]
        review = connection.execute('SELECT * FROM lab_result_reviews WHERE result_version_id=?', (item['id'],)).fetchone()
        item['review'] = dict(review) if review is not None else None
        versions.append(item)
    result['versions'] = versions
    latest = versions[-1] if versions else None
    result['current_version'] = latest
    result['has_published_result'] = bool(latest and latest['action'] != 'ANNUL')
    required = {item['id'] for item in result['required_specimens']}
    result['satisfies_current_samples'] = bool(result['has_published_result'] and required
        and required == set(latest['specimen_ids'])
        and all(item['received_at'] and item['suitability'] == 'ACCEPTED' for item in result['required_specimens']))
    result['needs_medical_review'] = bool(result['has_published_result'] and latest['review'] is None)
    result['version'] = etag(result)
    return result


def order_results(connection, task_id):
    results = [analysis_state(connection, row[0]) for row in connection.execute(
        'SELECT id FROM lab_analyses WHERE order_task_id=? ORDER BY id', (task_id,))]
    active = [item for item in results if item['cancelled_at'] is None]
    published = sum(item['has_published_result'] for item in results)
    satisfied = sum(item['satisfies_current_samples'] for item in active)
    cancelled = len(results) - len(active)
    if results and cancelled == len(results):
        status = 'CANCELLED'
    elif cancelled and satisfied == len(active):
        status = 'COMPLETED_WITH_CANCELLATIONS'
    elif active and satisfied == len(active):
        status = 'COMPLETED'
    else:
        status = 'PARTIAL' if published else 'PENDING'
    return {
        'results': results,
        'laboratory_status': status,
        'published_results': published,
        'pending_results': len(active) - satisfied,
        'pending_reviews': sum(item['needs_medical_review'] for item in results),
        'cancelled_analyses': cancelled,
    }
