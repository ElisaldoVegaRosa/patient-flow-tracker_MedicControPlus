"""Read-only operational clocks; recorded facts never imply undocumented actions."""
from datetime import datetime, timezone

from .laboratory_integration import available
from .laboratory_samples import order_state


def instant(value):
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return parsed.astimezone(timezone.utc) if parsed.utcoffset() is not None else None
    except (AttributeError, TypeError, ValueError):
        return None


def minutes(start, end, now):
    first, last = instant(start), instant(end)
    if first is None or last is None or first > last or last > now:
        return None
    return int((last - first).total_seconds() // 60)


def clock(start, end, now, *, completed=False, historical=False, before_triage=False):
    state = 'BEFORE_TRIAGE' if before_triage else 'COMPLETED' if completed else 'PENDING'
    return {'state': state, 'since': start, 'until': end if completed else None,
            'minutes': None if historical or before_triage else minutes(start, end, now)}


def laboratory_delays(connection, episode_id, now_text, now, structured):
    pending = []

    def add(stage, order_id, resource_id, title, since):
        pending.append({'stage': stage, 'order_id': order_id, 'resource_id': resource_id,
                        'title': title, 'since': since, 'minutes': minutes(since, now_text, now)})

    for task in connection.execute("SELECT id,title,status,created_at FROM tasks WHERE episode_id=? AND service='LAB' ORDER BY id", (episode_id,)):
        if not structured or not connection.execute('SELECT 1 FROM lab_orders WHERE task_id=?', (task['id'],)).fetchone():
            if task['status'] == 'PENDING':
                add('LAB_LEGACY', task['id'], task['id'], task['title'], task['created_at'])
            continue
        if task['status'] not in ('PENDING', 'COMPLETED'):
            continue
        order = order_state(connection, task['id'])
        analyses = order['results']
        required = {source['id'] for item in analyses if not item['cancelled_at'] and not item['satisfies_current_samples']
                    for source in item['required_specimens']}
        specimens = {item['id']: item for item in order['specimens']}
        for identifier in sorted(required):
            item = specimens[identifier]
            title = f"Muestra #{identifier}"
            if item['suitability'] == 'REJECTED':
                add('LAB_REPLACEMENT', task['id'], identifier, title, item['assessed_at'])
            elif item['received_at']:
                if item['suitability'] != 'ACCEPTED':
                    add('LAB_SUITABILITY', task['id'], identifier, title, item['received_at'])
            elif item['delivered_at']:
                add('LAB_RECEIPT', task['id'], identifier, title, item['delivered_at'])
            elif item['collected_at']:
                add('LAB_DELIVERY', task['id'], identifier, title, item['collected_at'])
            else:
                requested = [repeat['requested_at'] for repeat in order['repeats'] if repeat['new_specimen_id'] == identifier]
                since = requested[0] if requested else order['created_at']
                add('LAB_COLLECTION', task['id'], identifier, title, since)
        for item in analyses:
            if item['needs_medical_review']:
                add('LAB_REVIEW', task['id'], item['id'], item['title'], item['current_version']['published_at'])
            if item['cancelled_at'] or item['satisfies_current_samples']:
                continue
            sources = [specimens[source['id']] for source in item['required_specimens']]
            if sources and all(source['received_at'] and source['suitability'] == 'ACCEPTED' for source in sources):
                dates = [instant(value) for source in sources for value in (source['received_at'], source['assessed_at'])]
                since = max(dates).isoformat() if all(value is not None for value in dates) else None
                add('LAB_RESULT', task['id'], item['id'], item['title'], since)
    return pending


def read(connection, now_text, username):
    now = instant(now_text)
    if now is None:
        raise ValueError('Se requiere una fecha actual con zona horaria')
    structured = available(connection)
    patients = []
    for row in connection.execute("""SELECT e.id AS episode_id,p.name,p.identity_status,e.priority,e.location,e.started_at,
        c.ready_at,c.historical,a.name AS area_name FROM episodes e JOIN patients p ON p.id=e.patient_id
        LEFT JOIN care_episodes c ON c.episode_id=e.id LEFT JOIN staff_areas a ON a.id=c.area_id
        WHERE e.status='ACTIVE' ORDER BY e.priority,e.started_at,e.id"""):
        patient = dict(row)
        ready = patient.pop('ready_at')
        historical = patient.pop('historical')
        # A historical event may exist without a reliable operational ready marker.
        triage = connection.execute("SELECT MIN(created_at) FROM events WHERE episode_id=? AND type='TRIAGE'", (row['episode_id'],)).fetchone()[0]
        recorded = ready or triage
        patient['stay_minutes'] = minutes(row['started_at'], now_text, now)
        patient['triage'] = clock(row['started_at'], recorded or now_text, now, completed=bool(recorded))
        patient['attention'] = []
        for discipline in ('DOCTOR', 'NURSE'):
            slot = connection.execute("""SELECT s.first_started_at,u.username,u.display_name FROM care_slots s
                LEFT JOIN users u ON u.id=s.user_id WHERE s.episode_id=? AND s.discipline=?""", (row['episode_id'], discipline)).fetchone()
            first = slot['first_started_at'] if slot else None
            wait = clock(ready, first or now_text, now, completed=bool(first), historical=bool(historical), before_triage=not recorded and not first)
            patient['attention'].append({'discipline': discipline, 'owner':
                {'username': slot['username'], 'display_name': slot['display_name']} if slot and slot['username'] else None,
                'wait': wait})
        patient['laboratory'] = laboratory_delays(connection, row['episode_id'], now_text, now, structured)
        patients.append(patient)
    return {'generated_at': now_text, 'requested_by': username, 'patients': patients}
