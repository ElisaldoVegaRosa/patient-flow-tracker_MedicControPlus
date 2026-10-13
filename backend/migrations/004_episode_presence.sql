-- Advisory presence only; clinical versions and write receipts are unchanged.
CREATE TABLE IF NOT EXISTS episode_presence (
    episode_id INTEGER NOT NULL REFERENCES episodes(id),
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    tab_id TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('VIEW', 'EDIT')),
    sequence INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    PRIMARY KEY (episode_id, session_id, tab_id)
);
CREATE INDEX IF NOT EXISTS idx_episode_presence_expiry ON episode_presence(expires_at);
