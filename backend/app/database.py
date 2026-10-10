from collections.abc import Callable, Mapping
import sqlite3
from pathlib import Path


def get_connection(database_path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database(
    connection: sqlite3.Connection,
    demo_users: Mapping[str, Mapping[str, str]],
    hash_password: Callable[[str], tuple[str, str]],
    utc_now: Callable[[], str],
) -> None:
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            role TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );

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

        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            birth_date TEXT NOT NULL,
            document TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS episodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL REFERENCES patients(id),
            qr_token TEXT UNIQUE NOT NULL,
            status TEXT NOT NULL,
            priority INTEGER NOT NULL,
            location TEXT NOT NULL,
            assigned_to TEXT,
            started_at TEXT NOT NULL,
            closed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            episode_id INTEGER NOT NULL REFERENCES episodes(id),
            type TEXT NOT NULL,
            username TEXT NOT NULL,
            created_at TEXT NOT NULL,
            note TEXT
        );

        CREATE TABLE IF NOT EXISTS vitals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            episode_id INTEGER NOT NULL REFERENCES episodes(id),
            temperature REAL NOT NULL,
            heart_rate INTEGER NOT NULL,
            systolic INTEGER NOT NULL,
            diastolic INTEGER NOT NULL,
            spo2 INTEGER NOT NULL,
            respiratory_rate INTEGER NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            episode_id INTEGER NOT NULL REFERENCES episodes(id),
            reason TEXT NOT NULL,
            severity TEXT NOT NULL,
            status TEXT NOT NULL,
            responsible TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS alert_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_id INTEGER NOT NULL REFERENCES alerts(id),
            old_status TEXT,
            new_status TEXT NOT NULL,
            username TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            episode_id INTEGER NOT NULL REFERENCES episodes(id),
            title TEXT NOT NULL,
            service TEXT NOT NULL,
            status TEXT NOT NULL,
            result TEXT,
            created_at TEXT NOT NULL
        );
        """
    )

    for username, demo_user in demo_users.items():
        existing_user = connection.execute(
            """
            SELECT id
            FROM users
            WHERE username = ?
            """,
            (username,),
        ).fetchone()

        if existing_user is not None:
            continue

        password_salt, password_hash = hash_password(
            demo_user["password"]
        )

        connection.execute(
            """
            INSERT INTO users (
                username,
                password_hash,
                password_salt,
                role,
                active,
                created_at
            )
            VALUES (?, ?, ?, ?, 1, ?)
            """,
            (
                username,
                password_hash,
                password_salt,
                demo_user["role"],
                utc_now(),
            ),
        )

    connection.commit()
    connection.close()
