from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .security import hash_session_token, hash_password, verify_password
from . import auth, database
from .routes.auth import create_router
from .routes.dashboard import create_router as create_dashboard_router
from .routes.episode_queries import create_router as create_episode_queries_router
from .routes.tasks import create_router as create_tasks_router
from .routes.nursing import create_router as create_nursing_router
from .routes.medical import create_router as create_medical_router
from .routes.rules import create_router as create_rules_router
from .routes.demo import create_router as create_demo_router
from .routes.episode_registration import create_router as create_episode_registration_router
from .routes.alerts import ALLOWED_ALERT_TRANSITIONS, create_router as create_alerts_router
from .config import (
    DATABASE_PATH,
    DEMO_USERS,
    SESSION_DURATION_HOURS,
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_connection() -> sqlite3.Connection:
    return database.get_connection(DATABASE_PATH)


def initialize_database() -> None:
    database.initialize_database(
        get_connection(), DEMO_USERS, hash_password, utc_now,
    )

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicializa la base de datos al comenzar FastAPI."""

    initialize_database()
    yield

def authenticated_user(
    authorization: str | None = Header(default=None),
) -> dict[str, str]:
    """Valida una sesión persistente y comprueba su expiración."""
    return auth.validate_session(authorization, get_connection, utc_now)


def require_roles(*allowed_roles: str):
    def dependency(
        user: dict[str, str] = Depends(authenticated_user),
    ) -> dict[str, str]:
        return auth.authorize_role(user, allowed_roles)

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
    
    
def require_active_episode(
    connection: sqlite3.Connection,
    episode_id: int,
) -> sqlite3.Row:
    """
    Obtiene un episodio y rechaza operaciones sobre episodios cerrados.

    Debe ejecutarse antes de registrar cualquier modificación clínica
    u operacional.
    """

    episode = connection.execute(
        """
        SELECT *
        FROM episodes
        WHERE id = ?
        """,
        (episode_id,),
    ).fetchone()

    if episode is None:
        raise HTTPException(
            status_code=404,
            detail="Episodio no encontrado",
        )

    if episode["status"] != "ACTIVE":
        raise HTTPException(
            status_code=409,
            detail="El episodio está cerrado",
        )

    return episode

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
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

app.include_router(create_router(get_connection, utc_now, authenticated_user))
app.include_router(create_dashboard_router(
    get_connection, utc_now, episode_detail, authenticated_user, require_roles,
))


    # ---------------------------------------------------------------------------
# DATOS FICTICIOS PARA DEMOSTRACIÓN
# ---------------------------------------------------------------------------
# Este endpoint agrega pacientes de ejemplo sin eliminar datos existentes.
# Utiliza documentos con prefijo DEMO-SEED para impedir duplicados.
# Solo el supervisor puede ejecutar esta operación.
# ---------------------------------------------------------------------------

app.include_router(create_demo_router(
    get_connection, utc_now, add_event, require_roles,
))

    # ---------------------------------------------------------------------------
# EJECUCIÓN DEL MOTOR TEMPORAL
# ---------------------------------------------------------------------------
# En el demo, supervisor y médico pueden solicitar una evaluación inmediata.
# Posteriormente este mismo servicio podrá ejecutarse mediante un proceso
# programado sin cambiar las reglas clínicas.
# ---------------------------------------------------------------------------

app.include_router(create_rules_router(
    get_connection, utc_now, evaluate_time_rules, require_roles,
))

    # ---------------------------------------------------------------------------
# CENTRO DE CONTROL DEL SUPERVISOR
# ---------------------------------------------------------------------------
# Consolida indicadores de pacientes activos, prioridades, alertas, tareas
# y tiempos desde el ingreso. La información se calcula en el servidor para
# ofrecer una única lectura operacional y auditable de la situación actual.
# ---------------------------------------------------------------------------
app.include_router(create_episode_registration_router(
    get_connection, utc_now, episode_detail, add_event, require_roles,
))

# ---------------------------------------------------------------------------
# HISTORIAL DE EPISODIOS CERRADOS
# ---------------------------------------------------------------------------
# Permite consultar episodios que ya finalizaron sin mezclarlos con la
# operación clínica activa. El historial es accesible para recepción,
# médicos y supervisores.
# ---------------------------------------------------------------------------

app.include_router(create_episode_queries_router(
    get_connection, episode_detail, add_event, authenticated_user, require_roles,
))


app.include_router(create_nursing_router(
    get_connection, utc_now, episode_detail, add_event, require_active_episode, require_roles,
))

app.include_router(create_alerts_router(
    get_connection, utc_now, episode_detail, add_event, require_active_episode, require_roles,
))

# ---------------------------------------------------------------------------
# EVALUACIÓN MÉDICA
# ---------------------------------------------------------------------------
# Este endpoint permite que un usuario con rol DOCTOR registre una evaluación
# clínica sobre un episodio activo. La evaluación no modifica el expediente
# histórico: crea un evento auditable que conserva médico, fecha y contenido.
# ---------------------------------------------------------------------------

app.include_router(create_tasks_router(
    get_connection, utc_now, episode_detail, add_event, require_active_episode, require_roles,
))


app.include_router(create_medical_router(
    get_connection, utc_now, episode_detail, add_event, require_active_episode, require_roles,
))
