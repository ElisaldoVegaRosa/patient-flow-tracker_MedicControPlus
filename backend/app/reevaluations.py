"""Scheduled actions use existing tasks and accepted care owners, without inferred deadlines."""
import json
from .concurrency import etag


def migrate_reevaluations(connection):
    try:
        connection.execute("BEGIN IMMEDIATE")
        for sql in (
            """CREATE TABLE IF NOT EXISTS reevaluation_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT, episode_id INTEGER NOT NULL REFERENCES episodes(id),
                title TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL)""",
            """CREATE TABLE IF NOT EXISTS reevaluation_actions (
                task_id INTEGER PRIMARY KEY REFERENCES tasks(id), group_id INTEGER NOT NULL REFERENCES reevaluation_groups(id),
                due_at TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0)""",
            """CREATE TABLE IF NOT EXISTS reevaluation_changes (
                id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER NOT NULL REFERENCES reevaluation_actions(task_id),
                action TEXT NOT NULL, actor TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL,
                old_value TEXT NOT NULL, new_value TEXT NOT NULL)""",
            "CREATE INDEX IF NOT EXISTS idx_reevaluation_episode ON reevaluation_groups(episode_id,id)",
            "CREATE INDEX IF NOT EXISTS idx_reevaluation_group ON reevaluation_actions(group_id,task_id)",
            "CREATE INDEX IF NOT EXISTS idx_reevaluation_changes ON reevaluation_changes(task_id,id)",
        ):
            connection.execute(sql)
        connection.commit()
    except BaseException:
        connection.rollback()
        raise


def actions(connection, episode_id):
    rows = connection.execute("""SELECT t.*,a.group_id,a.due_at,a.revision,g.title AS group_title,
        g.created_by,e.status AS episode_status,e.closed_at,
        c.user_id AS owner_id,c.revision AS owner_revision,u.username AS owner_username,u.display_name AS owner_name
        FROM reevaluation_actions a JOIN tasks t ON t.id=a.task_id
        JOIN reevaluation_groups g ON g.id=a.group_id JOIN episodes e ON e.id=t.episode_id
        LEFT JOIN care_slots c ON c.episode_id=t.episode_id AND c.discipline=CASE t.service WHEN 'MEDICAL' THEN 'DOCTOR' ELSE 'NURSE' END
        LEFT JOIN users u ON u.id=c.user_id WHERE t.episode_id=? ORDER BY a.due_at,t.id""", (episode_id,)).fetchall()
    result = []
    for row in rows:
        item = dict(row)
        item['version'] = etag(item)
        result.append(item)
    return result


def history(connection, episode_id):
    return [dict(row) for row in connection.execute("""SELECT c.* FROM reevaluation_changes c
        JOIN tasks t ON t.id=c.task_id WHERE t.episode_id=? ORDER BY c.id DESC""", (episode_id,))]


def audit(connection, task_id, action, user, reason, before, after, timestamp):
    # Operational snapshots exclude QR/session secrets and retain the owner at the time of the action.
    connection.execute("""INSERT INTO reevaluation_changes(task_id,action,actor,reason,created_at,old_value,new_value)
        VALUES (?,?,?,?,?,?,?)""", (task_id, action, user['username'], reason, timestamp(),
        json.dumps(before, ensure_ascii=False), json.dumps(after, ensure_ascii=False)))
