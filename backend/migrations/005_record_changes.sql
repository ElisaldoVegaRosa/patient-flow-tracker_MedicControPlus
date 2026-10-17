-- Non-destructive lifecycle journal. Existing clinical rows and receipts remain intact.
CREATE TABLE IF NOT EXISTS record_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL REFERENCES episodes(id),
    target_type TEXT NOT NULL CHECK (target_type IN ('TASK', 'EVENT', 'EPISODE')),
    target_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT NOT NULL,
    username TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_record_changes_episode ON record_changes (episode_id, id);
CREATE INDEX IF NOT EXISTS idx_record_changes_target ON record_changes (target_type, target_id, id);
