from __future__ import annotations

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
    demo_user = DEMO_USERS.get(data.username)

    if demo_user is None or demo_user["password"] != data.password:
        raise HTTPException(
            status_code=401,
            detail="Credenciales inválidas",
        )

    token = secrets.token_urlsafe(24)

    ACTIVE_TOKENS[token] = {
        "username": data.username,
        "role": demo_user["role"],
    }

    return {
        "access_token": token,
        "username": data.username,
        "role": demo_user["role"],
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
        raise HTTPException(status_code=404, detail="Alerta no encontrada")

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