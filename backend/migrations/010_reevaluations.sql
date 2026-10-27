-- Documented schema; runtime migration: app.reevaluations.migrate_reevaluations.
-- Additive only: no legacy deadlines or care owners are inferred.
BEGIN IMMEDIATE;
CREATE TABLE reevaluation_actions (
                task_id INTEGER PRIMARY KEY REFERENCES tasks(id), group_id INTEGER NOT NULL REFERENCES reevaluation_groups(id),
                due_at TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0);

CREATE TABLE reevaluation_changes (
                id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER NOT NULL REFERENCES reevaluation_actions(task_id),
                action TEXT NOT NULL, actor TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL,
                old_value TEXT NOT NULL, new_value TEXT NOT NULL);

CREATE TABLE reevaluation_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT, episode_id INTEGER NOT NULL REFERENCES episodes(id),
                title TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);

CREATE INDEX idx_reevaluation_changes ON reevaluation_changes(task_id,id);

CREATE INDEX idx_reevaluation_episode ON reevaluation_groups(episode_id,id);

CREATE INDEX idx_reevaluation_group ON reevaluation_actions(group_id,task_id);
COMMIT;
