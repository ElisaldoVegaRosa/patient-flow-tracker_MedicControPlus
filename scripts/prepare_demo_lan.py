"""Prepare HTTPS files and a frontend build without starting the app."""
import argparse
import os
from pathlib import Path

from demo_lan import prepare


def main():
    parser = argparse.ArgumentParser(description="Preparar demo HTTPS en red local")
    parser.add_argument("--address", required=True, help="IPv4 privada de esta PC")
    args = parser.parse_args()
    if os.name != "nt":
        parser.exit(1, "La preparacion de certificados requiere Windows.\n")
    try:
        prepare(Path(__file__).resolve().parents[1], args.address)
    except ValueError as error:
        parser.exit(1, str(error) + "\n")
    except OSError:
        parser.exit(1, "Preparacion LAN no completada. Revisa direccion, permisos, dependencias y el build.log del destino creado.\n")


if __name__ == "__main__":
    main()
