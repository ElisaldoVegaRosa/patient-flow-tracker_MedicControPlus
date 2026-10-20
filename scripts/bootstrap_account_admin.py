"""Interactive local setup; no password arguments, default credential or public endpoint."""
import argparse
import getpass
from pathlib import Path
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app import database  # noqa: E402
from app.accounts import BootstrapError, bootstrap_admin, validate_bootstrap_input  # noqa: E402
from app.config import DEMO_USERS, DATABASE_PATH  # noqa: E402
from app.security import hash_password  # noqa: E402
from datetime import datetime, timezone  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="Alta local del primer administrador de cuentas (demo detenido)")
    parser.add_argument("--database", type=Path, default=DATABASE_PATH)
    args = parser.parse_args()
    if not args.database.is_file():
        parser.exit(1, "La base debe existir; no se creo otra base.\n")
    try:
        username = input("Usuario del administrador (minusculas, 3-40 caracteres): ").strip()
        name = input("Nombre visible: ").strip()
        reason = input("Motivo del alta inicial: ").strip()
        password = getpass.getpass("Contrasena (12-128 caracteres, no se muestra): ")
        if password != getpass.getpass("Repite la contrasena: "):
            raise BootstrapError("Las contrasenas no coinciden; vuelve a escribirlas")
        validate_bootstrap_input(username, name, password, reason)
        timestamp = lambda: datetime.now(timezone.utc).isoformat()
        database.initialize_database(database.get_connection(args.database), DEMO_USERS, hash_password, timestamp)
        connection = database.get_connection(args.database)
        try:
            bootstrap_admin(connection, username, name, password, reason, timestamp)
        finally:
            connection.close()
        print("Administrador inicial creado. No se imprimen credenciales.")
    except BootstrapError as error:
        parser.exit(1, "Alta no completada. " + str(error) + ".\n")
    except (ValueError, sqlite3.Error, EOFError, KeyboardInterrupt):
        # Never echo an integrity error, a submitted credential or a traceback.
        parser.exit(1, "Alta no completada. Revisa formato, coincidencia, usuario unico y si ya existe administrador.\n")


if __name__ == "__main__":
    main()
