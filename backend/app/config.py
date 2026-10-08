from pathlib import Path


DATABASE_PATH = Path(__file__).parents[1] / "clinical.db"

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
}

PASSWORD_HASH_ITERATIONS = 210_000

SESSION_DURATION_HOURS = 8
