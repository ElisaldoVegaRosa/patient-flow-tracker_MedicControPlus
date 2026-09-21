-- Etapa 16: usuarios persistentes con contraseñas protegidas.
--
-- Esta migración crea la estructura de usuarios utilizada por el login.
-- Las contraseñas se almacenan como una sal y un hash PBKDF2; nunca como
-- texto plano.

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    role TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_username
ON users (username);

CREATE INDEX IF NOT EXISTS idx_users_role_active
ON users (role, active);