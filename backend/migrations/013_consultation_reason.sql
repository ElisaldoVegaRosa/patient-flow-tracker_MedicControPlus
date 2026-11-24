-- Runtime equivalent: app.database.initialize_database checks the column first.
-- Existing episodes retain NULL; no clinical information is inferred.
-- Apply this one-time SQL only when PRAGMA table_info(episodes) lacks the column.
BEGIN IMMEDIATE;
ALTER TABLE episodes ADD COLUMN consultation_reason TEXT;
COMMIT;
