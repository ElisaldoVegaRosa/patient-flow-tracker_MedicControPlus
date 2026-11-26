"""Current allergy information by explicit patient identity; append-only revisions."""
import json
from .clinical_profiles import context, owns, version

SCHEMA = """CREATE TABLE IF NOT EXISTS patient_allergy_profiles (
    patient_id INTEGER PRIMARY KEY REFERENCES patients(id),
    status TEXT NOT NULL CHECK (status IN ('UNKNOWN','NONE_KNOWN','REPORTED')),
    description TEXT NOT NULL, source TEXT NOT NULL,
    reviewed_by TEXT NOT NULL REFERENCES users(username), reviewed_at TEXT NOT NULL,
    episode_id INTEGER NOT NULL REFERENCES episodes(id), revision INTEGER NOT NULL CHECK(revision > 0)
);
CREATE TABLE IF NOT EXISTS patient_allergy_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER NOT NULL REFERENCES patients(id),
    episode_id INTEGER NOT NULL REFERENCES episodes(id), username TEXT NOT NULL REFERENCES users(username),
    created_at TEXT NOT NULL, reason TEXT NOT NULL, old_value TEXT NOT NULL, new_value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_patient_allergy_changes ON patient_allergy_changes(patient_id,id DESC);
"""


def migrate_allergies(connection):
    connection.executescript(SCHEMA)


def snapshot(record):
    return {key: record[key] for key in ('status', 'description', 'source')}



def profile(connection, patient_id):
    row = connection.execute('SELECT * FROM patient_allergy_profiles WHERE patient_id=?', (patient_id,)).fetchone()
    return dict(row) if row else dict(status='UNKNOWN', description='', source='', reviewed_by=None,
                                     reviewed_at=None, episode_id=None, revision=0)



def read(connection, episode_id, user, limit=10, offset=0):
    current = context(connection, episode_id)
    record = profile(connection, current['patient_id'])
    total = connection.execute('SELECT COUNT(*) FROM patient_allergy_changes WHERE patient_id=?',
                               (current['patient_id'],)).fetchone()[0]
    history = []
    for row in connection.execute('SELECT * FROM patient_allergy_changes WHERE patient_id=? ORDER BY id DESC LIMIT ? OFFSET ?',
                                  (current['patient_id'], limit, offset)):
        item = dict(row)
        item['before'] = json.loads(item.pop('old_value'))
        item['after'] = json.loads(item.pop('new_value'))
        history.append(item)
    return dict(episode_id=episode_id, patient_id=current['patient_id'], profile=record,
                version=version(connection,current,record), can_edit=owns(current,user),
                responsible=current['owner_name'] or current['owner_username'],
                history=history, total=total, limit=limit, offset=offset)
