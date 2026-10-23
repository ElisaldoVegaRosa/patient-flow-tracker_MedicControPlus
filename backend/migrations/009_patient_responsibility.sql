-- Runtime: app/care.py:migrate_care; transactional and idempotent.
-- Preserves all previous tables. Backfills only episodes with persisted TRIAGE,
-- using the first timestamp and historical=1. No area or owner is inferred.
-- New triage uses care.ready in the same transaction, with historical=0.
CREATE TABLE IF NOT EXISTS care_schema (version INTEGER PRIMARY KEY CHECK(version=1));
CREATE TABLE IF NOT EXISTS care_episodes (
    episode_id INTEGER PRIMARY KEY REFERENCES episodes(id),
    area_id INTEGER REFERENCES staff_areas(id),
    ready_at TEXT NOT NULL,
    historical INTEGER NOT NULL DEFAULT 0 CHECK(historical IN (0,1)),
    revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS care_slots (
    episode_id INTEGER NOT NULL REFERENCES care_episodes(episode_id),
    discipline TEXT NOT NULL CHECK(discipline IN ('DOCTOR','NURSE')),
    user_id INTEGER REFERENCES users(id),
    started_at TEXT,
    first_started_at TEXT,
    pending_user_id INTEGER REFERENCES users(id),
    revision INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(episode_id,discipline),
    CHECK(pending_user_id IS NULL OR (user_id IS NOT NULL AND pending_user_id!=user_id))
);
CREATE TABLE IF NOT EXISTS care_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL REFERENCES episodes(id),
    discipline TEXT,
    action TEXT NOT NULL,
    target_user_id INTEGER REFERENCES users(id),
    actor TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL,
    old_value TEXT NOT NULL,
    new_value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_care_slots_user ON care_slots(user_id,pending_user_id);
CREATE INDEX IF NOT EXISTS idx_care_changes_episode ON care_changes(episode_id,id);
CREATE INDEX IF NOT EXISTS idx_care_rotation ON care_changes(discipline,target_user_id,action,id);
