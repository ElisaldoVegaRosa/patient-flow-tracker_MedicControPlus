"""Independent current medical and surgical history by explicit patient identity."""
import json
from .clinical_profiles import context, owns, version as profile_version

SCHEMA = """CREATE TABLE IF NOT EXISTS patient_background_profiles (
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    category TEXT NOT NULL CHECK (category IN ('MEDICAL','SURGICAL')),
    status TEXT NOT NULL CHECK (status IN ('UNKNOWN','NONE_REPORTED','REPORTED')),
    description TEXT NOT NULL, source TEXT NOT NULL,
    reviewed_by TEXT NOT NULL REFERENCES users(username), reviewed_at TEXT NOT NULL,
    episode_id INTEGER NOT NULL REFERENCES episodes(id), revision INTEGER NOT NULL CHECK(revision > 0),
    PRIMARY KEY(patient_id,category)
);
CREATE TABLE IF NOT EXISTS patient_background_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER NOT NULL REFERENCES patients(id),
    category TEXT NOT NULL CHECK (category IN ('MEDICAL','SURGICAL')),
    episode_id INTEGER NOT NULL REFERENCES episodes(id), username TEXT NOT NULL REFERENCES users(username),
    created_at TEXT NOT NULL, reason TEXT NOT NULL, old_value TEXT NOT NULL, new_value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_patient_background_changes ON patient_background_changes(patient_id,category,id DESC);
"""


def migrate_background(connection):
    connection.executescript(SCHEMA)


def profile(connection, patient_id, category):
    row = connection.execute('SELECT * FROM patient_background_profiles WHERE patient_id=? AND category=?',
                             (patient_id,category)).fetchone()
    return dict(row) if row else dict(status='UNKNOWN',description='',source='',reviewed_by=None,
                                     reviewed_at=None,episode_id=None,revision=0)


def version(connection,current,record,category):
    return profile_version(connection,current,record,['background',category])


def snapshot(record):
    return {key:record[key] for key in ('status','description','source')}


def read(connection,episode_id,category,user,limit=10,offset=0):
    current=context(connection,episode_id)
    record=profile(connection,current['patient_id'],category)
    params=(current['patient_id'],category)
    total=connection.execute('SELECT COUNT(*) FROM patient_background_changes WHERE patient_id=? AND category=?',params).fetchone()[0]
    history=[]
    for row in connection.execute('SELECT * FROM patient_background_changes WHERE patient_id=? AND category=? ORDER BY id DESC LIMIT ? OFFSET ?',(*params,limit,offset)):
        item=dict(row);item['before']=json.loads(item.pop('old_value'));item['after']=json.loads(item.pop('new_value'));history.append(item)
    return dict(episode_id=episode_id,patient_id=current['patient_id'],category=category,profile=record,
                version=version(connection,current,record,category),can_edit=owns(current,user),
                responsible=current['owner_name'] or current['owner_username'],history=history,total=total,limit=limit,offset=offset)
