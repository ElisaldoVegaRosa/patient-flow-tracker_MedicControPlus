"""Read-only batched operational handover; no clinical notes or write baselines."""
from .laboratory_integration import available


def read(connection, now, username):
    patients = {row['episode_id']: dict(row) for row in connection.execute("""
        SELECT e.id episode_id,p.name,p.identity_status,e.priority,e.location,c.area_id,a.name area_name
        FROM episodes e JOIN patients p ON p.id=e.patient_id
        LEFT JOIN care_episodes c ON c.episode_id=e.id LEFT JOIN staff_areas a ON a.id=c.area_id
        WHERE e.status='ACTIVE' ORDER BY e.priority,e.started_at,e.id""")}
    for p in patients.values():
        p.update(owners=[], reevaluations=[], tasks={'MEDICAL': 0, 'NURSING': 0},
                 open_alerts=0, legacy_lab_orders=0, lab_results=0, lab_reviews=0)
    for row in connection.execute("""SELECT s.episode_id,s.discipline,u.username,u.display_name,u.active,
        v.username proposed_username,v.display_name proposed_name FROM care_slots s
        LEFT JOIN users u ON u.id=s.user_id LEFT JOIN users v ON v.id=s.pending_user_id
        JOIN episodes e ON e.id=s.episode_id WHERE e.status='ACTIVE'"""):
        patients[row['episode_id']]['owners'].append(dict(row))
    for row in connection.execute("""SELECT t.episode_id,t.service,t.title,a.due_at FROM tasks t
        JOIN reevaluation_actions a ON a.task_id=t.id JOIN episodes e ON e.id=t.episode_id
        WHERE e.status='ACTIVE' AND t.status='PENDING' ORDER BY a.due_at,t.id"""):
        patients[row['episode_id']]['reevaluations'].append(dict(row))
    tasks = [dict(row) for row in connection.execute("""SELECT t.id,t.episode_id,t.service,t.status FROM tasks t
        JOIN episodes e ON e.id=t.episode_id WHERE e.status='ACTIVE'""")]
    for row in connection.execute("""SELECT a.episode_id,COUNT(*) n FROM alerts a JOIN episodes e ON e.id=a.episode_id
        WHERE e.status='ACTIVE' AND a.status!='RESOLVED' GROUP BY a.episode_id"""):
        patients[row['episode_id']]['open_alerts'] = row['n']
    structured = available(connection)
    order_ids = set()
    if structured:
        order_ids = {r[0] for r in connection.execute('SELECT task_id FROM lab_orders')}
        analyses = connection.execute("""SELECT a.id,a.cancelled_at,o.episode_id,v.id version_id,v.action,
            r.id review_id FROM lab_analyses a JOIN lab_orders o ON o.task_id=a.order_task_id
            JOIN episodes e ON e.id=o.episode_id JOIN tasks t ON t.id=o.task_id
            LEFT JOIN lab_result_versions v ON v.id=(SELECT x.id FROM lab_result_versions x
                WHERE x.analysis_id=a.id ORDER BY x.sequence DESC LIMIT 1)
            LEFT JOIN lab_result_reviews r ON r.result_version_id=v.id
            WHERE e.status='ACTIVE' AND t.status IN ('PENDING','COMPLETED')""").fetchall()
        required = {}
        for r in connection.execute("""SELECT a.analysis_id,s.id,s.received_at,s.suitability FROM lab_analysis_specimens a
            JOIN lab_specimens s ON s.id=a.specimen_id WHERE a.current_requirement=1"""):
            required.setdefault(r['analysis_id'], []).append(dict(r))
        sources = {}
        for r in connection.execute('SELECT result_version_id,specimen_id FROM lab_result_specimens'):
            sources.setdefault(r[0], set()).add(r[1])
        for a in analyses:
            p = patients[a['episode_id']]
            published = bool(a['version_id'] and a['action'] != 'ANNUL')
            if published and a['review_id'] is None:
                p['lab_reviews'] += 1
            req = required.get(a['id'], [])
            satisfied = published and bool(req) and {s['id'] for s in req} == sources.get(a['version_id'], set()) and all(s['received_at'] and s['suitability']=='ACCEPTED' for s in req)
            if not a['cancelled_at'] and not satisfied:
                p['lab_results'] += 1
    for t in tasks:
        p = patients[t['episode_id']]
        if t['status'] == 'PENDING':
            if t['service'] in p['tasks']:
                p['tasks'][t['service']] += 1
            if t['service'] == 'LAB' and t['id'] not in order_ids:
                p['legacy_lab_orders'] += 1
    return {'patients': list(patients.values()), 'generated_at': now, 'requested_by': username}
