"""Initial setup failures explain the cause without exposing credentials."""
import sqlite3
from unittest.mock import Mock

import pytest
from app import main
from scripts import bootstrap_account_admin as cli


def setup(monkeypatch, path, passwords, username="admin.demo"):
    monkeypatch.setattr("sys.argv", ["bootstrap_account_admin.py", "--database", str(path)])
    answers = iter([username, "Administrador ficticio", "Alta de prueba local"])
    monkeypatch.setattr("builtins.input", lambda _: next(answers))
    values = iter(passwords)
    monkeypatch.setattr(cli.getpass, "getpass", lambda _: next(values))


@pytest.mark.parametrize("passwords,message", [
    (["short-demo", "short-demo"], "entre 12 y 128"),
    (["First-Demo-Password", "Second-Demo-Password"], "no coinciden"),
    ([" " * 12, " " * 12], "solo espacios"),
])
def test_invalid_credentials_explain_and_do_not_initialize(tmp_path, monkeypatch, capsys, passwords, message):
    path = tmp_path / "untouched.db"
    sqlite3.connect(path).close()
    original = path.read_bytes()
    setup(monkeypatch, path, passwords)
    initialize = Mock()
    monkeypatch.setattr(cli.database, "initialize_database", initialize)
    with pytest.raises(SystemExit) as result:
        cli.main()
    assert result.value.code == 1
    output = capsys.readouterr()
    assert message in output.err
    for password in passwords:
        assert password not in output.out + output.err
    initialize.assert_not_called()
    assert path.read_bytes() == original


def test_success_and_repeated_setup_never_echo_password(tmp_path, monkeypatch, capsys):
    path = tmp_path / "setup.db"
    monkeypatch.setattr(main, "DATABASE_PATH", path)
    main.initialize_database()
    password = "Ficticia-CLI-Demo-42"
    setup(monkeypatch, path, [password, password])
    cli.main()
    assert "Administrador inicial creado" in capsys.readouterr().out
    setup(monkeypatch, path, [password, password])
    with pytest.raises(SystemExit):
        cli.main()
    output = capsys.readouterr()
    assert "Ya existe administrador" in output.err
    assert password not in output.out + output.err
    with sqlite3.connect(path) as connection:
        assert connection.execute("SELECT COUNT(*) FROM users WHERE role='ACCOUNT_ADMIN'").fetchone()[0] == 1


def test_existing_username_explains_without_changing_legacy_user(tmp_path, monkeypatch, capsys):
    path = tmp_path / "occupied.db"
    monkeypatch.setattr(main, "DATABASE_PATH", path)
    main.initialize_database()
    password = "Ficticia-CLI-Demo-42"
    setup(monkeypatch, path, [password, password], "medico")
    with pytest.raises(SystemExit):
        cli.main()
    output = capsys.readouterr()
    assert "Ese usuario ya existe" in output.err
    assert password not in output.out + output.err
    with sqlite3.connect(path) as connection:
        assert connection.execute("SELECT role FROM users WHERE username='medico'").fetchone()[0] == "DOCTOR"
        assert connection.execute("SELECT COUNT(*) FROM users WHERE role='ACCOUNT_ADMIN'").fetchone()[0] == 0
