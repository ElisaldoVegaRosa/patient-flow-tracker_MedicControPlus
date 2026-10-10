from app import main


def test_reinitialization_preserves_schema_users_sessions_and_episodes(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(main, "DATABASE_PATH", tmp_path / "initialization-test.db")
    main.initialize_database()
    connection = main.get_connection()
    try:
        users = [tuple(row) for row in connection.execute("SELECT * FROM users ORDER BY id")]
        assert len(users) == len(main.DEMO_USERS)
        for row in connection.execute("SELECT * FROM users"):
            assert main.verify_password(
                main.DEMO_USERS[row["username"]]["password"],
                row["password_salt"], row["password_hash"],
            )
        schema = [tuple(row) for row in connection.execute(
            "SELECT type, name, sql FROM sqlite_master ORDER BY type, name"
        )]
        connection.execute(
            "INSERT INTO patients (name, birth_date, document) VALUES (?, ?, ?)",
            ("Paciente ficticio inicialización", "1990-01-01", "QA-INIT"),
        )
        connection.execute(
            "INSERT INTO episodes (patient_id, qr_token, status, priority, location, started_at) "
            "VALUES (1, 'qr-ficticio-init', 'ACTIVE', 3, 'Recepción', '2026-10-08T12:00:00Z')"
        )
        connection.execute(
            "INSERT INTO sessions (user_id, token_hash, created_at, expires_at) "
            "VALUES (?, ?, ?, ?)",
            (users[0][0], main.hash_session_token("token-ficticio-init"),
             "2026-10-08T12:00:00Z", "2026-10-08T20:00:00Z"),
        )
        connection.commit()
        preserved = {
            table: [tuple(row) for row in connection.execute(f"SELECT * FROM {table} ORDER BY id")]
            for table in ("patients", "episodes", "sessions")
        }
    finally:
        connection.close()

    main.initialize_database()
    connection = main.get_connection()
    try:
        assert [tuple(row) for row in connection.execute("SELECT * FROM users ORDER BY id")] == users
        assert [tuple(row) for row in connection.execute(
            "SELECT type, name, sql FROM sqlite_master ORDER BY type, name"
        )] == schema
        for table, rows in preserved.items():
            assert [tuple(row) for row in connection.execute(f"SELECT * FROM {table} ORDER BY id")] == rows
    finally:
        connection.close()
