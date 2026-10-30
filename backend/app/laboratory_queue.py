"""LAB queue projection: actual analytical work is separate from medical review."""
from .concurrency import task_version
from .laboratory_integration import available
from .laboratory_context import current_followup
from .laboratory_samples import order_state


TERMINAL = {'COMPLETED', 'COMPLETED_WITH_CANCELLATIONS', 'CANCELLED', 'ANNULLED'}


def structured_summary(connection, detail):
    case = current_followup(connection, detail['episode_id'])
    context = 'ACTIVE' if detail['episode_status'] == 'ACTIVE' else 'UNAVAILABLE'
    if case is not None:
        scope = {row[0] for row in connection.execute(
            'SELECT analysis_id FROM lab_followup_scope WHERE followup_id=?', (case['id'],))}
        if detail['analyses'] and {item['id'] for item in detail['analyses']} <= scope:
            context = 'FOLLOWUP'
    analyses = []
    for item in detail['results']:
        latest = item['current_version']
        review = latest['review'] if latest else None
        analyses.append({
            'id': item['id'], 'title': item['title'], 'cancelled_at': item['cancelled_at'],
            'version': item['version'],
            'reviewer_username': (item['medical_owner']['username'] if item['medical_owner']
                and item['medical_owner']['role'] == 'DOCTOR' and item['medical_owner']['active'] == 1 else None),
            'required_specimens': [{key: source[key] for key in ('id', 'received_at', 'suitability')}
                for source in item['required_specimens']],
            'versions': [{'id': value['id'], 'sequence': value['sequence'], 'action': value['action'],
                'result': value['result'], 'reason': value['reason'], 'published_at': value['published_at'],
                'reviewed_at': value['review']['reviewed_at'] if value['review'] else None}
                for value in item['versions']],
            'cancellation_reason': item['cancellation_reason'],
            'has_result': item['has_published_result'],
            'current_result': latest['result'] if latest else None,
            'result_annulled': bool(latest and latest['action'] == 'ANNUL'),
            'result_sequence': latest['sequence'] if latest else None,
            'needs_medical_review': item['needs_medical_review'],
            'reviewed_at': review['reviewed_at'] if review else None,
            'satisfies_current_samples': item['satisfies_current_samples'],
            'reinstatement_requires_plan': bool(context == 'FOLLOWUP' and case['review_due_at'] is None
                and not item['satisfies_current_samples']),
        })
    return {
        'status': detail['laboratory_status'], 'processing_context': context,
        **{key: detail[key] for key in ('published_results', 'pending_results', 'pending_reviews', 'cancelled_analyses')},
        'analyses': analyses,
        'repeats': [{key: item[key] for key in (
            'id', 'analysis_id', 'previous_specimen_id', 'new_specimen_id',
            'requested_by_username', 'requested_at', 'reason',
        )} for item in detail['repeats']],
        'specimens': [{key: item[key] for key in (
            'id', 'version', 'kind', 'kind_description', 'collected_at', 'delivered_at', 'received_at',
            'suitability', 'assessed_at', 'analysis_ids', 'historical_analysis_ids',
        )} for item in detail['specimens']],
    }


def read(connection, status, username):
    enabled = available(connection)
    structured_ids = {row[0] for row in connection.execute('SELECT task_id FROM lab_orders')} if enabled else set()
    rows = connection.execute("""SELECT t.id,t.episode_id,t.title,t.service,t.status,t.result,t.created_at,
        (SELECT MAX(id) FROM record_changes WHERE target_type='TASK' AND target_id=t.id) AS last_change_id,
        p.name AS patient_name,p.identity_status AS patient_identity_status,e.priority,e.location,e.status AS episode_status
        FROM tasks t JOIN episodes e ON e.id=t.episode_id JOIN patients p ON p.id=e.patient_id
        WHERE t.service='LAB' AND e.status!='ANNULLED' ORDER BY t.id DESC""").fetchall()
    orders = []
    for row in rows:
        item = dict(row)
        item['workflow'] = 'STRUCTURED' if item['id'] in structured_ids else 'LEGACY'
        effective = item['status']
        if item['workflow'] == 'STRUCTURED':
            detail = order_state(connection, item['id'])
            item['laboratory'] = structured_summary(connection, detail)
            item['version'] = detail['version']
            effective = detail['laboratory_status']
        else:
            item['version'] = task_version(item)
        if status == 'PENDING' and effective in TERMINAL:
            continue
        if status == 'COMPLETED' and effective not in TERMINAL:
            continue
        item['record_changes'] = [dict(change) for change in connection.execute(
            "SELECT * FROM record_changes WHERE target_type='TASK' AND target_id=? ORDER BY id DESC", (item['id'],))]
        orders.append(item)
    return {'status_filter': status, 'total': len(orders), 'orders': orders, 'requested_by': username}
