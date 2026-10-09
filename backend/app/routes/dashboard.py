from collections.abc import Callable
from datetime import datetime, timezone
import sqlite3

from fastapi import APIRouter, Depends


def create_router(
    connection_factory: Callable[[], sqlite3.Connection],
    timestamp: Callable[[], str],
    detail: Callable[[sqlite3.Connection, int], dict],
    authenticated_user: Callable[..., dict[str, str]],
    require_roles: Callable[..., Callable[..., dict[str, str]]],
) -> APIRouter:
    router = APIRouter()

    @router.get("/dashboard")
    def dashboard(
        user: dict[str, str] = Depends(authenticated_user),
    ) -> dict:
        connection = connection_factory()

        episode_rows = connection.execute(
            """
            SELECT id
            FROM episodes
            WHERE status = 'ACTIVE'
            ORDER BY priority, started_at
            """
        ).fetchall()

        patients = [
            detail(connection, row["id"])
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

    @router.get("/supervisor/dashboard")
    def supervisor_dashboard(
        user: dict[str, str] = Depends(
            require_roles("SUPERVISOR")
        ),
    ) -> dict:
        connection = connection_factory()
        # El panel siempre presenta la evaluación temporal más reciente.
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
            patient = detail(connection, row["id"])

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

        rules_result = {
            "evaluated_episodes": len(patients),
            "generated_alerts": 0,
        }

        connection.close()

        return {
            "metrics": metrics,
            "rules": rules_result,
            "patients": patients,
            "generated_at": timestamp(),
            "requested_by": user["username"],
        }

    return router
