from collections.abc import Callable
import secrets
import sqlite3

from fastapi import APIRouter, Depends


def create_router(
    connection_factory: Callable[[], sqlite3.Connection],
    timestamp: Callable[[], str],
    add_event: Callable[..., None],
    require_roles: Callable[..., Callable[..., dict[str, str]]],
) -> APIRouter:
    router = APIRouter()

    @router.post("/demo/seed")
    def seed_demo_data(
        user: dict[str, str] = Depends(
            require_roles("SUPERVISOR")
        ),
    ) -> dict:
        connection = connection_factory()

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
                timestamp()
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
                    timestamp(),
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
                    timestamp(),
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
                        timestamp(),
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
                        timestamp(),
                        timestamp(),
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

    return router
