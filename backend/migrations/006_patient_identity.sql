-- Identity verification audit; legacy rows remain REGISTERED, never retroactively VERIFIED.
-- The patients rebuild (nullable birth_date/document, identity_status/revision)
-- is performed by app.patient_identity.migrate_patients during initialization.
-- That tested routine preserves IDs, AUTOINCREMENT high-water, indexes/triggers
-- and checks foreign keys before commit. Do not replace it with DROP/CREATE here.
-- Back up and verify an isolated migrated copy before authorizing a demo restart.
CREATE TABLE IF NOT EXISTS patient_identity_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    episode_id INTEGER NOT NULL REFERENCES episodes(id),
    old_value TEXT NOT NULL,
    new_value TEXT NOT NULL,
    reason TEXT NOT NULL,
    verification_source TEXT NOT NULL,
    username TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_patient_identity_changes
ON patient_identity_changes(patient_id, id);
