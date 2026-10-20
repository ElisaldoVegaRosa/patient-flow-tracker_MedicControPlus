-- Runtime migration: app/accounts.py:migrate_accounts (transactional, idempotent).
-- It conditionally adds users.display_name TEXT NOT NULL DEFAULT '' and
-- users.account_revision INTEGER NOT NULL DEFAULT 0, preserving existing IDs.
-- No administrator or password is seeded by startup. Use the interactive
-- scripts/bootstrap_account_admin.py once, with the demo stopped and a backup.
CREATE TABLE IF NOT EXISTS account_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT NOT NULL,
    new_value TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_account_changes_user ON account_changes(user_id, id);
