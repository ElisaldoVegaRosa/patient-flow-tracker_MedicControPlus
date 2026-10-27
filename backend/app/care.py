"""Explicit patient responsibility, independent from location and clinical actions."""
import json
from datetime import datetime, timezone
from fastapi import HTTPException
from .concurrency import etag
from .reevaluations import actions as reevaluation_actions

DISCIPLINES = ("DOCTOR", "NURSE")


def migrate_care(connection):
    try:
        connection.execute("BEGIN IMMEDIATE")
        for sql in (
            "CREATE TABLE IF NOT EXISTS care_schema (version INTEGER PRIMARY KEY CHECK(version=1))",
            """CREATE TABLE IF NOT EXISTS care_episodes (
                episode_id INTEGER PRIMARY KEY REFERENCES episodes(id), area_id INTEGER REFERENCES staff_areas(id),
                ready_at TEXT NOT NULL, historical INTEGER NOT NULL DEFAULT 0 CHECK(historical IN (0,1)),
                revision INTEGER NOT NULL DEFAULT 0)""",
            """CREATE TABLE IF NOT EXISTS care_slots (
                episode_id INTEGER NOT NULL REFERENCES care_episodes(episode_id),
                discipline TEXT NOT NULL CHECK(discipline IN ('DOCTOR','NURSE')),
                user_id INTEGER REFERENCES users(id), started_at TEXT, first_started_at TEXT,
                pending_user_id INTEGER REFERENCES users(id), revision INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(episode_id,discipline), CHECK(pending_user_id IS NULL OR
                    (user_id IS NOT NULL AND pending_user_id!=user_id)))""",
            """CREATE TABLE IF NOT EXISTS care_changes (
                id INTEGER PRIMARY KEY AUTOINCREMENT, episode_id INTEGER NOT NULL REFERENCES episodes(id),
                discipline TEXT, action TEXT NOT NULL, target_user_id INTEGER REFERENCES users(id),
                actor TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL,
                old_value TEXT NOT NULL, new_value TEXT NOT NULL)""",
            "CREATE INDEX IF NOT EXISTS idx_care_slots_user ON care_slots(user_id,pending_user_id)",
            "CREATE INDEX IF NOT EXISTS idx_care_changes_episode ON care_changes(episode_id,id)",
            "CREATE INDEX IF NOT EXISTS idx_care_rotation ON care_changes(discipline,target_user_id,action,id)",
        ):
            connection.execute(sql)
        connection.execute("INSERT OR IGNORE INTO care_schema(version) VALUES (1)")
        # Existing text assignees never become users. No area/owner is inferred.
        connection.execute("""INSERT OR IGNORE INTO care_episodes(episode_id,ready_at,historical)
            SELECT episode_id,MIN(created_at),1 FROM events WHERE type='TRIAGE' GROUP BY episode_id""")
        for discipline in DISCIPLINES:
            connection.execute("""INSERT OR IGNORE INTO care_slots(episode_id,discipline)
                SELECT episode_id,? FROM care_episodes""", (discipline,))
        connection.commit()
    except BaseException:
        connection.rollback()
        raise


def ready(connection, episode_id):
    at = connection.execute("SELECT MIN(created_at) FROM events WHERE episode_id=? AND type='TRIAGE'", (episode_id,)).fetchone()[0]
    if at:
        connection.execute("INSERT OR IGNORE INTO care_episodes(episode_id,ready_at) VALUES (?,?)", (episode_id, at))
        for discipline in DISCIPLINES:
            connection.execute("INSERT OR IGNORE INTO care_slots(episode_id,discipline) VALUES (?,?)", (episode_id, discipline))


def person(connection, identifier):
    if identifier is None:
        return None
    row = connection.execute("SELECT id,username,display_name,role,active FROM users WHERE id=?", (identifier,)).fetchone()
    return dict(row) if row else None


def available(connection, identifier, discipline, area_id, *, retained=False):
    if identifier is None or area_id is None:
        return False
    return connection.execute("""SELECT 1 FROM users u JOIN staff_assignments d ON d.user_id=u.id
        JOIN staff_shifts s ON s.id=d.shift_id JOIN staff_areas a ON a.id=d.area_id
        WHERE u.id=? AND u.active=1 AND u.role=? AND TRIM(u.display_name)!=''
        AND d.status='AVAILABLE' AND s.status='ACTIVE' AND a.active=1
        AND (d.area_id=? OR ?=1) LIMIT 1""", (identifier, discipline, area_id, int(retained and discipline == 'DOCTOR'))).fetchone() is not None


def candidates(connection, discipline, area_id):
    rows = connection.execute("""SELECT DISTINCT u.id,u.username,u.display_name FROM users u
        JOIN staff_assignments d ON d.user_id=u.id JOIN staff_shifts s ON s.id=d.shift_id
        JOIN staff_areas a ON a.id=d.area_id WHERE u.active=1 AND u.role=? AND TRIM(u.display_name)!=''
        AND d.status='AVAILABLE' AND s.status='ACTIVE' AND a.active=1 AND a.id=?""", (discipline, area_id)).fetchall()
    result = []
    for row in rows:
        item = dict(row)
        owned = connection.execute("""SELECT e.id,e.priority FROM care_slots c JOIN episodes e ON e.id=c.episode_id
            WHERE c.discipline=? AND c.user_id=? AND e.status='ACTIVE'""", (discipline, row['id'])).fetchall()
        service = 'MEDICAL' if discipline == 'DOCTOR' else 'NURSING'
        pending = connection.execute("""SELECT COUNT(*) FROM tasks t JOIN episodes e ON e.id=t.episode_id
            JOIN care_slots c ON c.episode_id=e.id WHERE e.status='ACTIVE' AND c.discipline=?
            AND c.user_id=? AND t.status='PENDING' AND t.service=?""", (discipline, row['id'], service)).fetchone()[0]
        incoming = connection.execute("""SELECT COUNT(*) FROM care_slots c JOIN episodes e ON e.id=c.episode_id
            WHERE c.discipline=? AND c.pending_user_id=? AND e.status='ACTIVE'""", (discipline, row['id'])).fetchone()[0]
        last = connection.execute("""SELECT id,created_at FROM care_changes WHERE discipline=? AND target_user_id=?
            AND action IN ('ASSIGN','ACCEPT','OVERRIDE') ORDER BY id DESC LIMIT 1""", (discipline, row['id'])).fetchone()
        item.update(high_priority=sum(episode['priority'] <= 2 for episode in owned), pending_tasks=pending,
                    total=len(owned), by_priority={str(priority): sum(e['priority'] == priority for e in owned) for priority in range(1, 6)},
                    incoming=incoming, last_assignment_at=last['created_at'] if last else None,
                    last_assignment_order=last['id'] if last else 0)
        result.append(item)
    result.sort(key=lambda item: (item['high_priority'], item['pending_tasks'], item['total'], item['last_assignment_order'], item['id']))
    return result


def state(connection, episode_id, *, suggestions=True, candidate_cache=None):
    row = connection.execute("""SELECT e.id AS episode_id,p.name,e.status,e.priority,e.location,e.assigned_to AS legacy_assigned_to,
        e.started_at AS arrival_at,p.identity_status,c.area_id,c.ready_at,c.historical,c.revision,a.name AS area_name,a.active AS area_active
        FROM episodes e JOIN patients p ON p.id=e.patient_id LEFT JOIN care_episodes c ON c.episode_id=e.id
        LEFT JOIN staff_areas a ON a.id=c.area_id WHERE e.id=?""", (episode_id,)).fetchone()
    if row is None:
        raise HTTPException(404, 'Episodio no encontrado')
    result = dict(row)
    # A close/reopen or priority ABA requires review even when values return to
    # the old state. Scanning a QR is a read and must not invalidate allocation.
    result['event_revision'] = connection.execute("SELECT COALESCE(MAX(id),0) FROM events WHERE episode_id=? AND type!='QR_SCANNED'", (episode_id,)).fetchone()[0]
    result['open_alert_count'] = connection.execute("SELECT COUNT(*) FROM alerts WHERE episode_id=? AND status!='RESOLVED'", (episode_id,)).fetchone()[0]
    result['slots'] = []
    for discipline in DISCIPLINES:
        row = connection.execute('SELECT * FROM care_slots WHERE episode_id=? AND discipline=?', (episode_id, discipline)).fetchone()
        slot = dict(row) if row else dict(episode_id=episode_id, discipline=discipline, user_id=None, started_at=None, first_started_at=None, pending_user_id=None, revision=0)
        slot['owner'] = person(connection, slot['user_id'])
        slot['proposed'] = person(connection, slot['pending_user_id'])
        slot['covered'] = bool(result['status'] == 'ACTIVE' and result['area_active'] and available(connection, slot['user_id'], discipline, result['area_id'], retained=True))
        slot['needs_coverage'] = bool(result['status'] == 'ACTIVE' and not slot['covered'])
        key = (discipline, result['area_id'])
        slot['candidates'] = []
        if suggestions and result['status'] == 'ACTIVE' and result['area_active']:
            if candidate_cache is None:
                slot['candidates'] = candidates(connection, discipline, result['area_id'])
            else:
                if key not in candidate_cache:
                    candidate_cache[key] = candidates(connection, discipline, result['area_id'])
                slot['candidates'] = candidate_cache[key]
        result['slots'].append(slot)
    # Dynamic elapsed minutes never enter the write baseline.
    result['version'] = etag(result)
    return result


def elapsed(value, now):
    if not value:
        return None
    try:
        return max(0, int((now - datetime.fromisoformat(value.replace('Z', '+00:00'))).total_seconds() / 60))
    except (TypeError, ValueError):
        return None


def queue(connection, username, mine=False):
    now = datetime.now(timezone.utc)
    result = []
    cache = {}
    for row in connection.execute("SELECT id FROM episodes WHERE status='ACTIVE' ORDER BY priority,started_at,id"):
        item = state(connection, row['id'], candidate_cache=cache)
        if not item['ready_at']:
            continue
        if mine and not any(username in (slot['owner']['username'] if slot['owner'] else None,
                                        slot['proposed']['username'] if slot['proposed'] else None) for slot in item['slots']):
            continue
        item['since_arrival_minutes'] = elapsed(item['arrival_at'], now)
        item['since_ready_minutes'] = elapsed(item['ready_at'], now)
        for slot in item['slots']:
            slot['waiting_minutes'] = None if slot['first_started_at'] or item['historical'] else elapsed(item['ready_at'], now)
        item['reevaluations'] = reevaluation_actions(connection, row['id'])
        item['lab_pending'] = connection.execute("SELECT COUNT(*) FROM tasks WHERE episode_id=? AND service='LAB' AND status='PENDING'", (row['id'],)).fetchone()[0]
        result.append(item)
    result.sort(key=lambda item: (item['priority'], item['ready_at'] is None, item['ready_at'] or '', item['episode_id']))
    return result


def require_version(connection, episode_id, expected):
    current = state(connection, episode_id)
    if current['status'] != 'ACTIVE':
        raise HTTPException(409, {'code': 'version_conflict', 'message': 'El episodio ya no esta activo. Consulta su estado; tus campos se conservan.'})
    if not current['ready_at']:
        raise HTTPException(409, 'Registra el triaje antes de planificar seguimiento')
    if not expected:
        raise HTTPException(428, 'Consulta la version actual antes de guardar')
    if current['version'] != expected:
        raise HTTPException(409, {'code': 'version_conflict', 'message': 'Cambio la asignacion, disponibilidad o carga. Consulta y revisa antes de confirmar.'})
    return current


def audit(connection, before, after, user, action, reason, timestamp, discipline=None, target=None):
    def snapshot(value):
        return {**value, 'slots': [{k: v for k, v in slot.items() if k != 'candidates'} for slot in value['slots']]}
    identifier = connection.execute("""INSERT INTO care_changes(episode_id,discipline,action,target_user_id,actor,reason,created_at,old_value,new_value)
        VALUES (?,?,?,?,?,?,?,?,?)""", (after['episode_id'], discipline, action, target, user['username'], reason, timestamp(),
            json.dumps(snapshot(before), ensure_ascii=False), json.dumps(snapshot(after), ensure_ascii=False))).lastrowid
    final = state(connection, after['episode_id'])
    connection.execute('UPDATE care_changes SET new_value=? WHERE id=?', (json.dumps(snapshot(final), ensure_ascii=False), identifier))
    return final
