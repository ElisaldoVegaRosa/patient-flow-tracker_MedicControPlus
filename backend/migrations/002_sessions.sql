-- Etapa 17: sesiones persistentes con expiración.
--
-- El cliente recibe el token original. La base de datos almacena
-- únicamente su hash SHA-256.

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token_hash TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash
ON sessions (token_hash);

CREATE INDEX IF NOT EXISTS idx_sessions_user_active
ON sessions (user_id, revoked_at, expires_at);