-- Explicit, additive feature activation; no migration on startup or read.
CREATE TABLE IF NOT EXISTS comm_schema (version INTEGER NOT NULL CHECK(version=1));
INSERT INTO comm_schema(version) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM comm_schema);
CREATE TABLE IF NOT EXISTS comm_notices (
 id INTEGER PRIMARY KEY,
 followup_id INTEGER NOT NULL REFERENCES lab_followups(id),
 authorized_by INTEGER NOT NULL REFERENCES users(id),
 authorized_at TEXT NOT NULL,
 clinical_version TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('CONTACT_ONLY','MESSAGE')),
 message TEXT NOT NULL,
 reason TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS comm_notices_followup ON comm_notices(followup_id,id);
CREATE TABLE IF NOT EXISTS comm_events (
 id INTEGER PRIMARY KEY,
 notice_id INTEGER NOT NULL REFERENCES comm_notices(id),
 actor_id INTEGER NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('ATTEMPT','EXPLAIN','RECTIFY')),
 payload TEXT NOT NULL,
 reason TEXT NOT NULL,
 rectifies_id INTEGER REFERENCES comm_events(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS comm_rectification ON comm_events(rectifies_id) WHERE rectifies_id IS NOT NULL;
