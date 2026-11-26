-- Additive: existing patients have no inferred negative medical or surgical history.
CREATE TABLE IF NOT EXISTS patient_background_profiles (
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
