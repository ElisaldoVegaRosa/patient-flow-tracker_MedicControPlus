from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.responses import JSONResponse

from .security import hash_session_token, hash_password, verify_password
from . import auth, database, reevaluations
from .write_operations import active_connection
from .routes.presence import create_router as create_presence_router
from .routes.write_results import create_router as create_write_results_router
from .routes.auth import create_router
from .routes.dashboard import create_router as create_dashboard_router
from .routes.episode_queries import create_router as create_episode_queries_router
from .routes.tasks import create_router as create_tasks_router
from .routes.reevaluations import create_router as create_reevaluations_router
from .routes.nursing import create_router as create_nursing_router
from .routes.medical import create_router as create_medical_router
from .routes.record_lifecycle import create_router as create_record_lifecycle_router
from .routes.rules import create_router as create_rules_router
from .routes.demo import create_router as create_demo_router
from .routes.episode_registration import create_router as create_episode_registration_router
from .routes.identity import create_router as create_identity_router
from .routes.accounts import create_router as create_accounts_router
from .routes.staffing import create_router as create_staffing_router
from .routes.care import create_router as create_care_router
from .routes.operational_delays import create_router as create_operational_delays_router
from .routes.patient_communications import create_router as create_patient_communications_router
from .routes.laboratory_samples import create_router as create_laboratory_router
from .care import state as care_state
from .routes.alerts import ALLOWED_ALERT_TRANSITIONS, create_router as create_alerts_router
from .config import (
    DATABASE_PATH,
    DEMO_USERS,
    SESSION_DURATION_HOURS,
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_connection() -> sqlite3.Connection:
    return active_connection() or database.get_connection(DATABASE_PATH)


def get_laboratory_connection() -> sqlite3.Connection:
    from .laboratory_integration import available
    connection = get_connection()
    try:
        if not available(connection):
            raise HTTPException(409, {'code': 'laboratory_not_enabled', 'message': 'El laboratorio por muestras requiere preparacion explicita de la base; no se ha migrado automaticamente'})
        return connection
    except BaseException:
        connection.close()
        raise


def initialize_database() -> None:
    database.initialize_database(
        get_connection(), DEMO_USERS, hash_password, utc_now,
    )

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicializa la base de datos al comenzar FastAPI."""

    initialize_database()
    yield

def session_user(
    authorization: str | None = Header(default=None),
) -> dict[str, str]:
    """Valida una sesión persistente y comprueba su expiración."""
    return auth.validate_session(authorization, get_connection, utc_now)


def authenticated_user(authorization: str | None = Header(default=None)):
    # Account administration alone never grants access to clinical reads.
    user = session_user(authorization)
    if user["role"] == "ACCOUNT_ADMIN":
        raise HTTPException(403, "Administrar cuentas no permite consultar datos clinicos")
    return user


def require_roles(*allowed_roles: str):
    def dependency(
        user: dict[str, str] = Depends(session_user),
    ) -> dict[str, str]:
        return auth.authorize_role(user, allowed_roles)

    return dependency


def require_coordination(user: dict = Depends(session_user)):
    if user["role"] == "ACCOUNT_ADMIN" or not user.get("can_coordinate"):
        raise HTTPException(403, "Permiso de coordinacion requerido")
    return user


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
            AND NOT EXISTS (SELECT 1 FROM reevaluation_actions r WHERE r.task_id=tasks.id)
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
            patients.document,
            patients.identity_status,
            patients.identity_revision
        FROM episodes
        JOIN patients ON patients.id = episodes.patient_id
        WHERE episodes.id = ?
        """,
        (episode_id,),
    ).fetchone()

    if episode is None:
        raise HTTPException(status_code=404, detail="Episodio no encontrado")

    result = dict(episode)
    result["identity_changes"] = [dict(row) for row in connection.execute(
        "SELECT * FROM patient_identity_changes WHERE patient_id = ? ORDER BY id DESC", (result["patient_id"],)
    )]

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

    result["record_changes"] = [
        dict(row) for row in connection.execute(
            "SELECT * FROM record_changes WHERE episode_id = ? ORDER BY id DESC",
            (episode_id,),
        )
    ]
    for task in result["tasks"]:
        task["last_change_id"] = next((change["id"] for change in result["record_changes"]
                                       if change["target_type"] == "TASK" and change["target_id"] == task["id"]), None)

    for event in result["events"]:
        changes = [change for change in reversed(result["record_changes"])
                   if change["target_type"] == "EVENT" and change["target_id"] == event["id"]]
        event["current_note"] = changes[-1]["new_value"] if changes else event["note"]
        event["annulled"] = bool(changes and changes[-1]["action"] == "ANNUL")
        from .concurrency import event_version
        event["version"] = event_version(event, changes)

    from .concurrency import annotate_versions
    result["reevaluations"] = reevaluations.actions(connection, episode_id)
    result["reevaluation_changes"] = reevaluations.history(connection, episode_id)
    reevaluation_by_task = {item['id']: item for item in result['reevaluations']}
    for task in result['tasks']:
        if task['id'] in reevaluation_by_task:
            task['due_at'] = reevaluation_by_task[task['id']]['due_at']
            task['reevaluation_group_id'] = reevaluation_by_task[task['id']]['group_id']
    result["care"] = care_state(connection, episode_id, suggestions=False)
    from .laboratory_integration import enrich_episode
    return annotate_versions(enrich_episode(connection, result))


app = FastAPI(
    title="MedicControl+ API",
    version="1.0.0",
    lifespan=lifespan,
)


@app.exception_handler(RequestValidationError)
async def safe_account_validation(request, exception):
    if request.url.path.startswith("/accounts") or request.url.path == "/auth/login":
        # Pydantic's default errors include submitted input, including passwords.
        return JSONResponse(status_code=422, content={"detail": [
            {key: error[key] for key in ("loc", "msg", "type") if key in error}
            for error in exception.errors()
        ]})
    return await request_validation_exception_handler(request, exception)

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

# Composición de rutas por área; el orden de registro se conserva.
app.include_router(create_router(get_connection, utc_now, session_user))
app.include_router(create_accounts_router(get_connection, utc_now, require_roles))
app.include_router(create_staffing_router(get_connection, utc_now, authenticated_user, require_coordination))
app.include_router(create_care_router(get_connection, utc_now, authenticated_user))
app.include_router(create_operational_delays_router(get_connection, utc_now, authenticated_user))
app.include_router(create_patient_communications_router(get_connection, utc_now, authenticated_user))
app.include_router(create_presence_router(get_connection, authenticated_user))
app.include_router(create_write_results_router(get_connection, episode_detail, session_user))
app.include_router(create_dashboard_router(
    get_connection, utc_now, episode_detail, authenticated_user, require_roles,
))

app.include_router(create_demo_router(
    get_connection, utc_now, add_event, require_roles,
))

app.include_router(create_rules_router(
    get_connection, utc_now, evaluate_time_rules, require_roles,
))

app.include_router(create_episode_registration_router(
    get_connection, utc_now, episode_detail, add_event, require_roles,
))

app.include_router(create_identity_router(
    get_connection, utc_now, episode_detail, add_event, require_roles,
))

app.include_router(create_episode_queries_router(
    get_connection, episode_detail, add_event, authenticated_user, require_roles,
))

app.include_router(create_nursing_router(
    get_connection, utc_now, episode_detail, add_event, require_active_episode, require_roles,
))

app.include_router(create_alerts_router(
    get_connection, utc_now, episode_detail, add_event, require_active_episode, require_roles,
))

app.include_router(create_tasks_router(
    get_connection, utc_now, episode_detail, add_event, require_active_episode, require_roles,
))

app.include_router(create_medical_router(
    get_connection, utc_now, episode_detail, add_event, require_active_episode, require_roles,
))

app.include_router(create_record_lifecycle_router(
    get_connection, utc_now, episode_detail, add_event, require_roles,
))

app.include_router(create_reevaluations_router(
    get_connection, utc_now, episode_detail, add_event, require_active_episode, require_roles,
))

app.include_router(create_laboratory_router(
    get_laboratory_connection, utc_now, episode_detail, add_event, require_active_episode, require_roles,
    include_discharge=False,
))
