-- Replay window: 24 hours. Expired keys remain reserved; no clinical payload copies.
CREATE TABLE IF NOT EXISTS write_receipts (
    username TEXT NOT NULL,
    operation_key TEXT NOT NULL,
    role TEXT NOT NULL,
    scope TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    episode_id INTEGER REFERENCES episodes(id),
    summary TEXT,
    expires_at TEXT NOT NULL,
    PRIMARY KEY (username, operation_key)
);
