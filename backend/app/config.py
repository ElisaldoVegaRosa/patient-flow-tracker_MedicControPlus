from pathlib import Path
import os
from .database_selection import select_database


DATABASE_PATH = select_database(Path(__file__).parents[1] / "clinical.db", os.environ.get("MEDICCONTROL_DATABASE_PATH"))

DEMO_USERS = {
    "recepcion": {
        "password": "demo123",
        "role": "RECEPTION",
    },
    "enfermeria": {
        "password": "demo123",
        "role": "NURSE",
    },
    "medico": {
        "password": "demo123",
        "role": "DOCTOR",
    },
    "laboratorio": {
        "password": "demo123",
        "role": "LAB",
    },
    "supervisor": {
        "password": "demo123",
        "role": "SUPERVISOR",
    },
    "archivo": {
        "password": "demo123",
        "role": "ADMISSION",
    },
}

PASSWORD_HASH_ITERATIONS = 210_000

SESSION_DURATION_HOURS = 8
