from __future__ import annotations

import hashlib
import json
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


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


def hash_password(password: str) -> tuple[str, str]:
    """Genera una sal y un hash PBKDF2 para una contraseña."""

    salt = secrets.token_bytes(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_HASH_ITERATIONS,
    )

    return salt.hex(), password_hash.hex()


def verify_password(
    password: str,
    password_salt: str,
    expected_hash: str,
) -> bool:
    """Compara una contraseña con su hash almacenado."""

    candidate_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(password_salt),
        PASSWORD_HASH_ITERATIONS,
    ).hex()

    return secrets.compare_digest(
        candidate_hash,
        expected_hash,
    )

ACTIVE_TOKENS: dict[str, dict[str, str]] = {}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database() -> None:
    connection = get_connection()

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

    for username, demo_user in DEMO_USERS.items():
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


class LoginRequest(BaseModel):
    username: str
    password: str


class EpisodeCreate(BaseModel):
    name: str
    birth_date: str
    document: str
    priority: int = Field(default=3, ge=1, le=5)
    location: str = "Recepción"


class TriageRequest(BaseModel):
    priority: int = Field(ge=1, le=5)
    location: str
    assigned_to: str = "Enfermería"


class VitalSignsRequest(BaseModel):
    temperature: float
    heart_rate: int
    systolic: int
    diastolic: int
    spo2: int
    respiratory_rate: int


class AlertActionRequest(BaseModel):
    status: Literal["ACKNOWLEDGED", "ESCALATED", "RESOLVED"]

class MedicalEvaluationRequest(BaseModel):
    clinical_note: str = Field(min_length=3, max_length=2000)
    diagnosis: str = Field(min_length=2, max_length=500)
    disposition: Literal[
        "CONTINUE_OBSERVATION",
        "ORDER_TESTS",
        "READY_FOR_DISCHARGE",
    ] = "CONTINUE_OBSERVATION"

class TaskCreateRequest(BaseModel):
    title: str
    service: Literal["NURSING", "LAB", "MEDICAL"]


class TaskResultRequest(BaseModel):
    result: str


class DischargeRequest(BaseModel):
    note: str = "Alta médica"


def authenticated_user(
    authorization: str | None = Header(default=None),
) -> dict[str, str]:
    token = (authorization or "").removeprefix("Bearer ")

    if token not in ACTIVE_TOKENS:
        raise HTTPException(status_code=401, detail="Sesión requerida")

    return ACTIVE_TOKENS[token]


def require_roles(*allowed_roles: str):
    def dependency(
        user: dict[str, str] = Depends(authenticated_user),
    ) -> dict[str, str]:
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="Su rol no tiene permiso para esta acción",
            )

        return user

    return dependency


def add_event(
    connection: sqlite3.Connection,
    episode_id: int,
    event_type: str,
    username: str,
    note: str = "",
) -> None:
    connection.execute(
        """
        INSERT INTO events (
            episode_id,
            type,
            username,
            created_at,
            note
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            episode_id,
            event_type,
            username,
            utc_now(),
            note,
        ),
    )

def create_alert_if_missing(
    connection: sqlite3.Connection,
    episode_id: int,
    reason: str,
    severity: str,
) -> bool:
    """
    Crea una alerta solamente cuando no existe otra alerta abierta
    con el mismo motivo para el episodio.

    Retorna True cuando se crea una alerta y False cuando ya existía.
    Esta verificación evita duplicados en cada ciclo del motor.
    """

    existing_alert = connection.execute(
        """
        SELECT id
        FROM alerts
        WHERE episode_id = ?
        AND reason = ?
        AND status != 'RESOLVED'
        """,
        (
            episode_id,
            reason,
        ),
    ).fetchone()

    if existing_alert is not None:
        return False

    current_time = utc_now()

    connection.execute(
        """
        INSERT INTO alerts (
            episode_id,
            reason,
            severity,
            status,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, 'ACTIVE', ?, ?)
        """,
        (
            episode_id,
            reason,
            severity,
            current_time,
            current_time,
        ),
    )

    add_event(
        connection,
        episode_id,
        "ALERT_CREATED",
        "time-rules-engine",
        reason,
    )

    return True

def evaluate_time_rules(
    connection: sqlite3.Connection,
) -> dict[str, int]:
    """
    Evalúa reglas de tiempo sobre todos los episodios activos.

    Reglas iniciales:
    - episodio sin triaje después de 30 minutos;
    - tarea pendiente durante más de 60 minutos;
    - paciente P1 o P2 sin eventos recientes durante 15 minutos.
    """

    current_time = datetime.now(timezone.utc)

    active_episodes = connection.execute(
        """
        SELECT *
        FROM episodes
        WHERE status = 'ACTIVE'
        """
    ).fetchall()

    evaluated_episodes = 0
    generated_alerts = 0

    for episode in active_episodes:
        evaluated_episodes += 1
        episode_id = episode["id"]

        started_at = datetime.fromisoformat(
            episode["started_at"]
        )

        minutes_since_arrival = (
            current_time - started_at
        ).total_seconds() / 60

        # Regla 1: el paciente continúa sin triaje después de 30 minutos.
        triage_event = connection.execute(
            """
            SELECT id
            FROM events
            WHERE episode_id = ?
            AND type = 'TRIAGE'
            LIMIT 1
            """,
            (episode_id,),
        ).fetchone()

        if triage_event is None and minutes_since_arrival > 30:
            was_created = create_alert_if_missing(
                connection,
                episode_id,
                "Tiempo de espera de triaje excedido",
                "HIGH",
            )

            if was_created:
                generated_alerts += 1

        # Regla 2: existe una tarea pendiente durante más de 60 minutos.
        pending_tasks = connection.execute(
            """
            SELECT id, created_at
            FROM tasks
            WHERE episode_id = ?
            AND status = 'PENDING'
            """,
            (episode_id,),
        ).fetchall()

        for task in pending_tasks:
            task_created_at = datetime.fromisoformat(
                task["created_at"]
            )

            task_age_minutes = (
                current_time - task_created_at
            ).total_seconds() / 60

            if task_age_minutes > 60:
                was_created = create_alert_if_missing(
                    connection,
                    episode_id,
                    "Tarea pendiente con tiempo excedido",
                    "HIGH",
                )

                if was_created:
                    generated_alerts += 1

        # Regla 3: paciente prioritario sin actualización en 15 minutos.
        if episode["priority"] <= 2:
            # Los eventos creados por el propio motor no cuentan como
            # seguimiento humano o clínico del paciente.
            latest_event = connection.execute(
                """
                SELECT created_at
                FROM events
                WHERE episode_id = ?
                AND type != 'ALERT_CREATED'
                ORDER BY id DESC
                LIMIT 1
                """,
                (episode_id,),
            ).fetchone()

            if latest_event is not None:
                latest_event_time = datetime.fromisoformat(
                    latest_event["created_at"]
                )

                minutes_without_update = (
                    current_time - latest_event_time
                ).total_seconds() / 60

                if minutes_without_update > 15:
                    was_created = create_alert_if_missing(
                        connection,
                        episode_id,
                        "Paciente prioritario sin actualización reciente",
                        "CRITICAL",
                    )

                    if was_created:
                        generated_alerts += 1

    connection.commit()

    return {
        "evaluated_episodes": evaluated_episodes,
        "generated_alerts": generated_alerts,
    }

def episode_detail(
    connection: sqlite3.Connection,
    episode_id: int,
) -> dict:
    episode = connection.execute(
        """
        SELECT
            episodes.*,
            patients.name,
            patients.birth_date,
            patients.document
        FROM episodes
        JOIN patients ON patients.id = episodes.patient_id
        WHERE episodes.id = ?
        """,
        (episode_id,),
    ).fetchone()

    if episode is None:
        raise HTTPException(status_code=404, detail="Episodio no encontrado")

    result = dict(episode)

    result["vitals"] = [
        dict(row)
        for row in connection.execute(
            """
            SELECT *
            FROM vitals
            WHERE episode_id = ?
            ORDER BY id DESC
            """,
            (episode_id,),
        )
    ]
    
    result["alerts"] = [
    dict(row)
    for row in connection.execute(
        """
        SELECT *
        FROM alerts
        WHERE episode_id = ?
        ORDER BY id DESC
        """,
        (episode_id,),
    )
]   

    # Cada alerta incluye sus transiciones auditadas.
    for alert in result["alerts"]:
        alert["history"] = [
            dict(row)
            for row in connection.execute(
                """
                SELECT *
                FROM alert_history
                WHERE alert_id = ?
                ORDER BY id ASC
                """,
                (alert["id"],),
            )
        ]

    result["tasks"] = [
        dict(row)
        for row in connection.execute(
            """
            SELECT *
            FROM tasks
            WHERE episode_id = ?
            ORDER BY id DESC
            """,
            (episode_id,),
        )
    ]

    result["events"] = [
        dict(row)
        for row in connection.execute(
            """
            SELECT *
            FROM events
            WHERE episode_id = ?
            ORDER BY id DESC
            """,
            (episode_id,),
        )
    ]

    return result


app = FastAPI(
    title="MedicControl+ API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    initialize_database()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

@app.post("/auth/login")
def login(data: LoginRequest) -> dict[str, str]:
    """Autentica un usuario activo almacenado en SQLite."""

    connection = get_connection()

    user = connection.execute(
        """
        SELECT
            username,
            password_hash,
            password_salt,
            role,
            active
        FROM users
        WHERE username = ?
        """,
        (data.username,),
    ).fetchone()

    connection.close()

    credentials_are_valid = (
        user is not None
        and user["active"] == 1
        and verify_password(
            data.password,
            user["password_salt"],
            user["password_hash"],
        )
    )

    if not credentials_are_valid:
        raise HTTPException(
            status_code=401,
            detail="Credenciales inválidas",
        )

    token = secrets.token_urlsafe(24)

    ACTIVE_TOKENS[token] = {
        "username": user["username"],
        "role": user["role"],
    }

    return {
        "access_token": token,
        "username": user["username"],
        "role": user["role"],
    }

@app.get("/auth/me")
def authenticated_session(
    user: dict[str, str] = Depends(authenticated_user),
) -> dict[str, str]:
    return {
        "username": user["username"],
        "role": user["role"],
    }


@app.post("/auth/logout")
def logout(
    authorization: str | None = Header(default=None),
    user: dict[str, str] = Depends(authenticated_user),
) -> dict[str, str]:
    token = (authorization or "").removeprefix("Bearer ")
    ACTIVE_TOKENS.pop(token, None)

    return {
        "message": "Sesión cerrada correctamente",
        "username": user["username"],
    }

@app.get("/dashboard")
def dashboard(
    user: dict[str, str] = Depends(authenticated_user),
) -> dict:
    connection = get_connection()

    episode_rows = connection.execute(
        """
        SELECT id
        FROM episodes
        WHERE status = 'ACTIVE'
        ORDER BY priority, started_at
        """
    ).fetchall()

    patients = [
        episode_detail(connection, row["id"])
        for row in episode_rows
    ]

    open_alerts = sum(
        1
        for patient in patients
        for alert in patient["alerts"]
        if alert["status"] != "RESOLVED"
    )

    connection.close()

    return {
        "active": len(patients),
        "open_alerts": open_alerts,
        "patients": patients,
        "requested_by": user["username"],
    }
    
    # ---------------------------------------------------------------------------
# DATOS FICTICIOS PARA DEMOSTRACIÓN
# ---------------------------------------------------------------------------
# Este endpoint agrega pacientes de ejemplo sin eliminar datos existentes.
# Utiliza documentos con prefijo DEMO-SEED para impedir duplicados.
# Solo el supervisor puede ejecutar esta operación.
# ---------------------------------------------------------------------------

@app.post("/demo/seed")
def seed_demo_data(
    user: dict[str, str] = Depends(
        require_roles("SUPERVISOR")
    ),
) -> dict:
    connection = get_connection()

    existing_demo_patients = connection.execute(
        """
        SELECT COUNT(*) AS total
        FROM patients
        WHERE document LIKE 'DEMO-SEED-%'
        """
    ).fetchone()["total"]

    if existing_demo_patients > 0:
        connection.close()

        return {
            "created": 0,
            "existing": existing_demo_patients,
            "message": "Los datos de demostración ya existen",
            "requested_by": user["username"],
        }

    demo_patients = [
        {
            "name": "Ana Torres",
            "birth_date": "1982-04-12",
            "priority": 1,
            "location": "Área de choque",
            "assigned_to": "Enfermería A",
            "status": "ACTIVE",
        },
        {
            "name": "Luis Rojas",
            "birth_date": "1975-08-23",
            "priority": 2,
            "location": "Observación",
            "assigned_to": "Enfermería B",
            "status": "ACTIVE",
        },
        {
            "name": "Marta Díaz",
            "birth_date": "1991-01-17",
            "priority": 3,
            "location": "Consultorio 1",
            "assigned_to": "Dr. Ramírez",
            "status": "ACTIVE",
        },
        {
            "name": "Carlos Vega",
            "birth_date": "1968-11-03",
            "priority": 2,
            "location": "Observación",
            "assigned_to": "Enfermería A",
            "status": "ACTIVE",
        },
        {
            "name": "Elena Ruiz",
            "birth_date": "2000-06-25",
            "priority": 4,
            "location": "Sala de espera",
            "assigned_to": "Enfermería C",
            "status": "ACTIVE",
        },
        {
            "name": "José Lara",
            "birth_date": "1959-09-14",
            "priority": 1,
            "location": "Área de choque",
            "assigned_to": "Equipo crítico",
            "status": "ACTIVE",
        },
        {
            "name": "Sofía Mora",
            "birth_date": "1987-02-08",
            "priority": 3,
            "location": "Laboratorio",
            "assigned_to": "Laboratorio",
            "status": "ACTIVE",
        },
        {
            "name": "Diego León",
            "birth_date": "1995-12-19",
            "priority": 5,
            "location": "Sala de espera",
            "assigned_to": "Enfermería C",
            "status": "ACTIVE",
        },
        {
            "name": "Laura Gil",
            "birth_date": "1979-07-30",
            "priority": 2,
            "location": "Consultorio 2",
            "assigned_to": "Dra. Santos",
            "status": "ACTIVE",
        },
        {
            "name": "Pablo Cruz",
            "birth_date": "1989-03-11",
            "priority": 3,
            "location": "Observación",
            "assigned_to": "Enfermería B",
            "status": "ACTIVE",
        },
        {
            "name": "Nora Paz",
            "birth_date": "1998-10-05",
            "priority": 4,
            "location": "Alta",
            "assigned_to": "Dr. Ramírez",
            "status": "CLOSED",
        },
        {
            "name": "Iván Soto",
            "birth_date": "1972-05-21",
            "priority": 3,
            "location": "Alta",
            "assigned_to": "Dra. Santos",
            "status": "CLOSED",
        },
    ]

    created_episodes: list[int] = []

    for index, demo in enumerate(demo_patients, start=1):
        patient_cursor = connection.execute(
            """
            INSERT INTO patients (
                name,
                birth_date,
                document
            )
            VALUES (?, ?, ?)
            """,
            (
                demo["name"],
                demo["birth_date"],
                f"DEMO-SEED-{index:03d}",
            ),
        )

        closed_at = (
            utc_now()
            if demo["status"] == "CLOSED"
            else None
        )

        episode_cursor = connection.execute(
            """
            INSERT INTO episodes (
                patient_id,
                qr_token,
                status,
                priority,
                location,
                assigned_to,
                started_at,
                closed_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                patient_cursor.lastrowid,
                secrets.token_urlsafe(24),
                demo["status"],
                demo["priority"],
                demo["location"],
                demo["assigned_to"],
                utc_now(),
                closed_at,
            ),
        )

        episode_id = episode_cursor.lastrowid
        created_episodes.append(episode_id)

        add_event(
            connection,
            episode_id,
            "EPISODE_CREATED",
            "demo-seeder",
            "Episodio ficticio creado para demostración",
        )

        add_event(
            connection,
            episode_id,
            "TRIAGE",
            "demo-seeder",
            (
                f"Prioridad {demo['priority']}; "
                f"ubicación {demo['location']}"
            ),
        )

        connection.execute(
            """
            INSERT INTO vitals (
                episode_id,
                temperature,
                heart_rate,
                systolic,
                diastolic,
                spo2,
                respiratory_rate,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                episode_id,
                36.5 + (index % 4) * 0.4,
                72 + index * 3,
                110 + index,
                68 + index,
                98 - (index % 3),
                16 + (index % 4),
                utc_now(),
            ),
        )

        add_event(
            connection,
            episode_id,
            "VITALS_RECORDED",
            "demo-seeder",
            "Signos vitales ficticios de demostración",
        )

        # Los episodios activos reciben tareas operacionales.
        if demo["status"] == "ACTIVE":
            task_status = (
                "COMPLETED"
                if index in {3, 7}
                else "PENDING"
            )

            task_result = (
                "Resultado simulado dentro de parámetros esperados"
                if task_status == "COMPLETED"
                else None
            )

            connection.execute(
                """
                INSERT INTO tasks (
                    episode_id,
                    title,
                    service,
                    status,
                    result,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    episode_id,
                    (
                        "Hemograma completo"
                        if index % 2 == 0
                        else "Control de signos vitales"
                    ),
                    (
                        "LAB"
                        if index % 2 == 0
                        else "NURSING"
                    ),
                    task_status,
                    task_result,
                    utc_now(),
                ),
            )

            add_event(
                connection,
                episode_id,
                "TASK_CREATED",
                "demo-seeder",
                "Tarea ficticia asignada",
            )

        # Algunos pacientes prioritarios reciben alertas abiertas.
        if (
            demo["status"] == "ACTIVE"
            and demo["priority"] <= 2
        ):
            reason = (
                "Paciente prioritario requiere seguimiento"
            )

            connection.execute(
                """
                INSERT INTO alerts (
                    episode_id,
                    reason,
                    severity,
                    status,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, 'ACTIVE', ?, ?)
                """,
                (
                    episode_id,
                    reason,
                    (
                        "CRITICAL"
                        if demo["priority"] == 1
                        else "HIGH"
                    ),
                    utc_now(),
                    utc_now(),
                ),
            )

            add_event(
                connection,
                episode_id,
                "ALERT_CREATED",
                "demo-seeder",
                reason,
            )

        if demo["status"] == "CLOSED":
            add_event(
                connection,
                episode_id,
                "DISCHARGE",
                "demo-seeder",
                "Alta ficticia completada",
            )

    connection.commit()
    connection.close()

    return {
        "created": len(demo_patients),
        "existing": 0,
        "episode_ids": created_episodes,
        "message": "Datos de demostración creados",
        "requested_by": user["username"],
    }
    
    # ---------------------------------------------------------------------------
# EJECUCIÓN DEL MOTOR TEMPORAL
# ---------------------------------------------------------------------------
# En el demo, supervisor y médico pueden solicitar una evaluación inmediata.
# Posteriormente este mismo servicio podrá ejecutarse mediante un proceso
# programado sin cambiar las reglas clínicas.
# ---------------------------------------------------------------------------

@app.post("/rules/evaluate")
def evaluate_rules(
    user: dict[str, str] = Depends(
        require_roles("SUPERVISOR", "DOCTOR")
    ),
) -> dict:
    connection = get_connection()

    result = evaluate_time_rules(connection)
    connection.close()

    return {
        **result,
        "evaluated_at": utc_now(),
        "requested_by": user["username"],
    }
    
    # ---------------------------------------------------------------------------
# CENTRO DE CONTROL DEL SUPERVISOR
# ---------------------------------------------------------------------------
# Consolida indicadores de pacientes activos, prioridades, alertas, tareas
# y tiempos desde el ingreso. La información se calcula en el servidor para
# ofrecer una única lectura operacional y auditable de la situación actual.
# ---------------------------------------------------------------------------
@app.get("/supervisor/dashboard")
def supervisor_dashboard(
    user: dict[str, str] = Depends(
        require_roles("SUPERVISOR")
    ),
) -> dict:
    connection = get_connection()
    # El panel siempre presenta la evaluación temporal más reciente.
    rules_result = evaluate_time_rules(connection)

    episode_rows = connection.execute(
        """
        SELECT id
        FROM episodes
        WHERE status = 'ACTIVE'
        ORDER BY priority, started_at
        """
    ).fetchall()

    patients: list[dict] = []

    for row in episode_rows:
        patient = episode_detail(connection, row["id"])

        started_at = datetime.fromisoformat(patient["started_at"])
        waiting_minutes = int(
            (
                datetime.now(timezone.utc) - started_at
            ).total_seconds()
            / 60
        )

        open_alerts = [
            alert
            for alert in patient["alerts"]
            if alert["status"] != "RESOLVED"
        ]

        pending_tasks = [
            task
            for task in patient["tasks"]
            if task["status"] == "PENDING"
        ]

        patient["waiting_minutes"] = waiting_minutes
        patient["open_alert_count"] = len(open_alerts)
        patient["pending_task_count"] = len(pending_tasks)

        patient["at_risk"] = (
            patient["priority"] <= 2
            or len(open_alerts) > 0
        )

        patients.append(patient)

    metrics = {
        "active_patients": len(patients),
        "high_priority_patients": sum(
            1
            for patient in patients
            if patient["priority"] <= 2
        ),
        "patients_at_risk": sum(
            1
            for patient in patients
            if patient["at_risk"]
        ),
        "open_alerts": sum(
            patient["open_alert_count"]
            for patient in patients
        ),
        "pending_tasks": sum(
            patient["pending_task_count"]
            for patient in patients
        ),
    }

    connection.close()

    return {
        "metrics": metrics,
        "rules": rules_result,
        "patients": patients,
        "generated_at": utc_now(),
        "requested_by": user["username"],
    }
    

@app.post("/episodes", status_code=201)
def create_episode(
    data: EpisodeCreate,
    user: dict[str, str] = Depends(
        require_roles("RECEPTION", "SUPERVISOR")
    ),
) -> dict:
    connection = get_connection()

    patient_cursor = connection.execute(
        """
        INSERT INTO patients (
            name,
            birth_date,
            document
        )
        VALUES (?, ?, ?)
        """,
        (
            data.name,
            data.birth_date,
            data.document,
        ),
    )

    episode_cursor = connection.execute(
        """
        INSERT INTO episodes (
            patient_id,
            qr_token,
            status,
            priority,
            location,
            started_at
        )
        VALUES (?, ?, 'ACTIVE', ?, ?, ?)
        """,
        (
            patient_cursor.lastrowid,
            secrets.token_urlsafe(24),
            data.priority,
            data.location,
            utc_now(),
        ),
    )

    episode_id = episode_cursor.lastrowid

    add_event(
        connection,
        episode_id,
        "EPISODE_CREATED",
        user["username"],
        "Ingreso registrado",
    )

    connection.commit()
    result = episode_detail(connection, episode_id)
    connection.close()

    return result

# ---------------------------------------------------------------------------
# HISTORIAL DE EPISODIOS CERRADOS
# ---------------------------------------------------------------------------
# Permite consultar episodios que ya finalizaron sin mezclarlos con la
# operación clínica activa. El historial es accesible para recepción,
# médicos y supervisores.
# ---------------------------------------------------------------------------

@app.get("/episodes/history")
def episode_history(
    user: dict[str, str] = Depends(
        require_roles(
            "RECEPTION",
            "DOCTOR",
            "SUPERVISOR",
        )
    ),
) -> dict:
    connection = get_connection()

    rows = connection.execute(
        """
        SELECT
            episodes.id,
            episodes.status,
            episodes.priority,
            episodes.location,
            episodes.assigned_to,
            episodes.started_at,
            episodes.closed_at,
            patients.name,
            patients.birth_date,
            patients.document,
            (
                SELECT COUNT(*)
                FROM events
                WHERE events.episode_id = episodes.id
            ) AS event_count,
            (
                SELECT COUNT(*)
                FROM alerts
                WHERE alerts.episode_id = episodes.id
            ) AS alert_count,
            (
                SELECT COUNT(*)
                FROM tasks
                WHERE tasks.episode_id = episodes.id
            ) AS task_count
        FROM episodes
        JOIN patients ON patients.id = episodes.patient_id
        WHERE episodes.status = 'CLOSED'
        ORDER BY episodes.closed_at DESC, episodes.id DESC
        """
    ).fetchall()

    episodes = [dict(row) for row in rows]
    connection.close()

    return {
        "total": len(episodes),
        "episodes": episodes,
        "requested_by": user["username"],
    }

@app.get("/episodes/{episode_id}")
def get_episode(
    episode_id: int,
    user: dict[str, str] = Depends(authenticated_user),
) -> dict:
    connection = get_connection()
    result = episode_detail(connection, episode_id)
    connection.close()
    return result


@app.get("/scan/{qr_token}")
def scan_qr(
    qr_token: str,
    user: dict[str, str] = Depends(authenticated_user),
) -> dict:
    connection = get_connection()

    episode = connection.execute(
        """
        SELECT id
        FROM episodes
        WHERE qr_token = ?
        AND status = 'ACTIVE'
        """,
        (qr_token,),
    ).fetchone()

    if episode is None:
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Pulsera inválida o episodio cerrado",
        )

    add_event(
        connection,
        episode["id"],
        "QR_SCANNED",
        user["username"],
    )

    connection.commit()
    result = episode_detail(connection, episode["id"])
    connection.close()

    return result


@app.post("/episodes/{episode_id}/triage")
def register_triage(
    episode_id: int,
    data: TriageRequest,
    user: dict[str, str] = Depends(
        require_roles("NURSE", "SUPERVISOR")
    ),
) -> dict:
    connection = get_connection()

    connection.execute(
        """
        UPDATE episodes
        SET priority = ?,
        location = ?,
        assigned_to = ?
        WHERE id = ?
        AND status = 'ACTIVE'
        """,
        (
            data.priority,
            data.location,
            data.assigned_to,
            episode_id,
        ),
    )

    add_event(
        connection,
        episode_id,
        "TRIAGE",
        user["username"],
        f"Prioridad {data.priority}; ubicación {data.location}",
    )

    connection.commit()
    result = episode_detail(connection, episode_id)
    connection.close()

    return result


@app.post("/episodes/{episode_id}/vitals", status_code=201)
def register_vitals(
    episode_id: int,
    data: VitalSignsRequest,
    user: dict[str, str] = Depends(
        require_roles("NURSE", "DOCTOR")
    ),
) -> dict:
    connection = get_connection()

    connection.execute(
        """
        INSERT INTO vitals (
            episode_id,
            temperature,
            heart_rate,
            systolic,
            diastolic,
            spo2,
            respiratory_rate,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            episode_id,
            data.temperature,
            data.heart_rate,
            data.systolic,
            data.diastolic,
            data.spo2,
            data.respiratory_rate,
            utc_now(),
        ),
    )

    add_event(
        connection,
        episode_id,
        "VITALS_RECORDED",
        user["username"],
        json.dumps(data.model_dump()),
    )

    generated_alerts: list[tuple[str, str]] = []

    if data.spo2 < 92:
        generated_alerts.append(
            ("Saturación de oxígeno baja", "CRITICAL")
        )

    if data.heart_rate > 120:
        generated_alerts.append(
            ("Frecuencia cardíaca alta", "HIGH")
        )

    if data.temperature >= 39:
        generated_alerts.append(
            ("Fiebre alta", "HIGH")
        )

    for reason, severity in generated_alerts:
        existing_alert = connection.execute(
            """
            SELECT id
            FROM alerts
            WHERE episode_id = ?
            AND reason = ?
            AND status != 'RESOLVED'
            """,
            (
                episode_id,
                reason,
            ),
        ).fetchone()

        if existing_alert is None:
            connection.execute(
                """
                INSERT INTO alerts (
                    episode_id,
                    reason,
                    severity,
                    status,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, 'ACTIVE', ?, ?)
                """,
                (
                    episode_id,
                    reason,
                    severity,
                    utc_now(),
                    utc_now(),
                ),
            )

            add_event(
                connection,
                episode_id,
                "ALERT_CREATED",
                "rules-engine",
                reason,
            )

    connection.commit()
    result = episode_detail(connection, episode_id)
    connection.close()

    return result

ALLOWED_ALERT_TRANSITIONS: dict[str, set[str]] = {
    "ACTIVE": {
        "ACKNOWLEDGED",
        "ESCALATED",
    },
    "ACKNOWLEDGED": {
        "ESCALATED",
        "RESOLVED",
    },
    "ESCALATED": {
        "RESOLVED",
    },
    "RESOLVED": set(),
}

@app.patch("/alerts/{alert_id}")
def change_alert_status(
    alert_id: int,
    data: AlertActionRequest,
    user: dict[str, str] = Depends(
        require_roles("NURSE", "DOCTOR", "SUPERVISOR")
    ),
) -> dict:
    if (
        data.status == "RESOLVED"
        and user["role"] not in {"DOCTOR", "SUPERVISOR"}
    ):
        raise HTTPException(
            status_code=403,
            detail="Solo médico o supervisor puede resolver alertas",
        )

    connection = get_connection()

    alert = connection.execute(
        """
        SELECT *
        FROM alerts
        WHERE id = ?
        """,
        (alert_id,),
    ).fetchone()

    if alert is None:
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Alerta no encontrada",
        )

    current_status = alert["status"]

    allowed_statuses = ALLOWED_ALERT_TRANSITIONS.get(
        current_status,
        set(),
    )

    if data.status not in allowed_statuses:
        connection.close()
        raise HTTPException(
            status_code=409,
            detail=(
                "Transición de alerta no permitida: "
                f"{current_status} → {data.status}"
            ),
        )


    connection.execute(
        """
        UPDATE alerts
        SET status = ?,
            responsible = ?,
            updated_at = ?
        WHERE id = ?
        """,
        (
            data.status,
            user["username"],
            utc_now(),
            alert_id,
        ),
    )

    connection.execute(
        """
        INSERT INTO alert_history (
            alert_id,
            old_status,
            new_status,
            username,
            created_at
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            alert_id,
            alert["status"],
            data.status,
            user["username"],
            utc_now(),
        ),
    )

    add_event(
        connection,
        alert["episode_id"],
        f"ALERT_{data.status}",
        user["username"],
        alert["reason"],
    )

    connection.commit()
    result = episode_detail(connection, alert["episode_id"])
    connection.close()

    return result

# ---------------------------------------------------------------------------
# EVALUACIÓN MÉDICA
# ---------------------------------------------------------------------------
# Este endpoint permite que un usuario con rol DOCTOR registre una evaluación
# clínica sobre un episodio activo. La evaluación no modifica el expediente
# histórico: crea un evento auditable que conserva médico, fecha y contenido.
# ---------------------------------------------------------------------------

@app.post("/episodes/{episode_id}/medical-evaluation")
def register_medical_evaluation(
    episode_id: int,
    data: MedicalEvaluationRequest,
    user: dict[str, str] = Depends(require_roles("DOCTOR")),
) -> dict:
    connection = get_connection()

    episode = connection.execute(
        """
        SELECT id, status
        FROM episodes
        WHERE id = ?
        """,
        (episode_id,),
    ).fetchone()

    if episode is None:
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Episodio no encontrado",
        )

    if episode["status"] != "ACTIVE":
        connection.close()
        raise HTTPException(
            status_code=409,
            detail="No se puede evaluar un episodio cerrado",
        )

    note = (
        f"Diagnóstico: {data.diagnosis}. "
        f"Evaluación: {data.clinical_note}. "
        f"Decisión: {data.disposition}"
    )

    add_event(
        connection,
        episode_id,
        "MEDICAL_EVALUATION",
        user["username"],
        note,
    )

    connection.commit()
    result = episode_detail(connection, episode_id)
    connection.close()

    return result

@app.post("/episodes/{episode_id}/tasks", status_code=201)
def create_task(
    episode_id: int,
    data: TaskCreateRequest,
    user: dict[str, str] = Depends(require_roles("DOCTOR")),
) -> dict:
    connection = get_connection()

    connection.execute(
        """
        INSERT INTO tasks (
            episode_id,
            title,
            service,
            status,
            created_at
        )
        VALUES (?, ?, ?, 'PENDING', ?)
        """,
        (
            episode_id,
            data.title,
            data.service,
            utc_now(),
        ),
    )

    add_event(
        connection,
        episode_id,
        "TASK_CREATED",
        user["username"],
        data.title,
    )

    connection.commit()
    result = episode_detail(connection, episode_id)
    connection.close()

    return result

# ---------------------------------------------------------------------------
# BANDEJA DE LABORATORIO
# ---------------------------------------------------------------------------
# Devuelve las órdenes asignadas a laboratorio junto con los datos operativos
# del episodio. No expone el token QR ni datos clínicos adicionales.
# Solo laboratorio y supervisor pueden consultar esta bandeja.
# ---------------------------------------------------------------------------

@app.get("/lab/orders")
def laboratory_orders(
    status: Literal["PENDING", "COMPLETED", "ALL"] = "PENDING",
    user: dict[str, str] = Depends(
        require_roles("LAB", "SUPERVISOR")
    ),
) -> dict:
    connection = get_connection()

    query = """
        SELECT
            tasks.id,
            tasks.episode_id,
            tasks.title,
            tasks.service,
            tasks.status,
            tasks.result,
            tasks.created_at,
            patients.name AS patient_name,
            episodes.priority,
            episodes.location,
            episodes.status AS episode_status
        FROM tasks
        JOIN episodes ON episodes.id = tasks.episode_id
        JOIN patients ON patients.id = episodes.patient_id
        WHERE tasks.service = 'LAB'
    """

    parameters: tuple[str, ...] = ()

    if status != "ALL":
        query += " AND tasks.status = ?"
        parameters = (status,)

    query += " ORDER BY tasks.id DESC"

    rows = connection.execute(
        query,
        parameters,
    ).fetchall()

    orders = [dict(row) for row in rows]
    connection.close()

    return {
        "status_filter": status,
        "total": len(orders),
        "orders": orders,
        "requested_by": user["username"],
    }
    
@app.patch("/tasks/{task_id}/complete")
def complete_task(
    task_id: int,
    data: TaskResultRequest,
    user: dict[str, str] = Depends(
        require_roles("NURSE", "LAB", "DOCTOR")
    ),
) -> dict:
    connection = get_connection()

    task = connection.execute(
        """
        SELECT *
        FROM tasks
        WHERE id = ?
        """,
        (task_id,),
    ).fetchone()

    if task is None:
        connection.close()
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    if task["service"] == "LAB" and user["role"] != "LAB":
        connection.close()
        raise HTTPException(
            status_code=403,
            detail="Esta tarea está asignada a laboratorio",
        )

    connection.execute(
        """
        UPDATE tasks
        SET status = 'COMPLETED',
            result = ?
        WHERE id = ?
        """,
        (
            data.result,
            task_id,
        ),
    )

    add_event(
        connection,
        task["episode_id"],
        "TASK_COMPLETED",
        user["username"],
        data.result,
    )

    connection.commit()
    result = episode_detail(connection, task["episode_id"])
    connection.close()

    return result


@app.post("/episodes/{episode_id}/discharge")
def discharge_episode(
    episode_id: int,
    data: DischargeRequest,
    user: dict[str, str] = Depends(require_roles("DOCTOR")),
) -> dict:
    connection = get_connection()

    connection.execute(
        """
        UPDATE episodes
        SET status = 'CLOSED',
        closed_at = ?
        WHERE id = ?
        AND status = 'ACTIVE'
        """,
        (
            utc_now(),
            episode_id,
        ),
    )

    add_event(
        connection,
        episode_id,
        "DISCHARGE",
        user["username"],
        data.note,
    )

    connection.commit()
    result = episode_detail(connection, episode_id)
    connection.close()

    return result