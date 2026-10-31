"""Limited reception projection and immutable communication events; no outbound transport."""
from pathlib import Path
import json
import sqlite3

from fastapi import HTTPException
from .concurrency import etag
from .laboratory_integration import available as laboratory_available
from .laboratory_followups import followup_state

TABLES = {'comm_schema', 'comm_notices', 'comm_events'}
SCHEMA = Path(__file__).resolve().parents[1] / 'migrations' / '012_patient_communications.sql'
CONTACT_MESSAGE = 'Solicite al paciente que contacte al medico responsable o regrese al centro.'


def available(c):
    tables = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'comm_*'")}
    if not tables:
        return False
    if not TABLES <= tables or [r[0] for r in c.execute('SELECT version FROM comm_schema')] != [1]:
        raise HTTPException(409, 'Esquema de comunicacion incompleto o no compatible; requiere revision tecnica')
    if not laboratory_available(c):
        raise HTTPException(409, 'Comunicacion requiere laboratorio habilitado')
    return True


def migrate(c):
    if c.in_transaction or not c.execute('PRAGMA foreign_keys').fetchone()[0]:
        raise ValueError('Se requiere conexion inactiva con referencias externas activas')
    if not laboratory_available(c):
        raise ValueError('Prepara primero el esquema de laboratorio')
    tables = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'comm_*'")}
    if tables:
        available(c)
        return
    try:
        c.execute('BEGIN IMMEDIATE')
        statement = ''
        for line in SCHEMA.read_text(encoding='utf-8').splitlines(keepends=True):
            statement += line
            if sqlite3.complete_statement(statement):
                c.execute(statement)
                statement = ''
        if statement.strip():
            raise ValueError('Esquema incompleto')
        c.commit()
    except BaseException:
        c.rollback()
        raise


def state(c, followup_id, user, notice_id=None):
    case = followup_state(c, followup_id)
    row = c.execute('SELECT * FROM comm_notices WHERE followup_id=? ORDER BY id DESC LIMIT 1', (followup_id,)).fetchone()
    latest_id = row['id'] if row else None
    if notice_id is not None:
        row = c.execute('SELECT * FROM comm_notices WHERE id=? AND followup_id=?', (notice_id, followup_id)).fetchone()
    notice = dict(row) if row else None
    events = []
    if notice:
        for event in c.execute('''SELECT e.*,u.username,u.display_name FROM comm_events e
            JOIN users u ON u.id=e.actor_id WHERE notice_id=? ORDER BY e.id''', (notice['id'],)):
            value = dict(event)
            value['payload'] = json.loads(value['payload'])
            events.append(value)
    voided = {e['rectifies_id'] for e in events if e['kind'] == 'RECTIFY'}
    effective = [e for e in events if e['id'] not in voided and e['kind'] != 'RECTIFY']
    valid = bool(notice and notice['id'] == latest_id and case['current_cycle'] and notice['clinical_version'] == case['version'])
    contacted = valid and any(e['kind'] == 'ATTEMPT' and e['payload']['outcome'] == 'CONFIRMED'
                             and e['payload']['transmitted'] for e in effective)
    explained = valid and any(e['kind'] == 'EXPLAIN' for e in effective)
    version = etag([case['version'], notice, events])
    owns = bool(user['role'] == 'DOCTOR' and case['owner'] and case['owner']['username'] == user['username'])
    result = {'followup_id': case['id'], 'episode_id': case['episode_id'], 'patient_name': case['patient_name'],
              'current_cycle': case['current_cycle'], 'owner_name': ((case['owner'] or {}).get('display_name')
                  or (case['owner'] or {}).get('username')),
              'version': version, 'notice_id': notice['id'] if notice else None, 'valid': valid,
              'contacted': bool(contacted), 'explained': bool(explained), 'can_authorize': owns and case['current_cycle'],
              'can_explain': owns and valid, 'can_attempt': user['role'] == 'RECEPTION' and valid,
              'mode': notice['mode'] if valid else None, 'message': notice['message'] if valid else None,
              'authorized_at': notice['authorized_at'] if notice else None,
              'next_attempt_at': next((e['payload'].get('next_attempt_at') for e in reversed(effective)
                                       if e['kind'] == 'ATTEMPT'), None) if not contacted else None}
    # Reception never receives reports, clinical reasons or explanations, even in history.
    result['history'] = [{'id': e['id'], 'kind': e['kind'], 'actor': e['display_name'] or e['username'],
        'own': e['username'] == user['username'], 'created_at': e['created_at'], 'voided': e['id'] in voided,
        'reason': e['reason'] if user['role'] != 'RECEPTION' or e['kind'] == 'ATTEMPT' else None,
        'payload': e['payload'] if e['kind'] == 'ATTEMPT' else {}, 'rectifies_id': e['rectifies_id']}
        for e in events]
    result['history_count'] = c.execute('SELECT COUNT(*) FROM comm_notices WHERE followup_id=?', (followup_id,)).fetchone()[0]
    return result, case
