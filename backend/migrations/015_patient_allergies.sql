-- Additive: no absence of allergies is inferred for existing patients.
CREATE TABLE IF NOT EXISTS patient_allergy_profiles (
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
