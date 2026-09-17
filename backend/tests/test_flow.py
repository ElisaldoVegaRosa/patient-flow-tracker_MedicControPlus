from pathlib import Path
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app import main


def login(client: TestClient, username: str) -> dict[str, str]:
    response = client.post(
        "/auth/login",
        json={
            "username": username,
            "password": "demo123",
        },
    )

    assert response.status_code == 200

    token = response.json()["access_token"]

    return {
        "Authorization": f"Bearer {token}",
    }


def test_complete_clinical_flow(tmp_path: Path) -> None:
    main.DATABASE_PATH = tmp_path / "clinical-test.db"
    main.initialize_database()

    with TestClient(main.app) as client:
        reception_headers = login(client, "recepcion")

        create_response = client.post(
            "/episodes",
            headers=reception_headers,
            json={
                "name": "Paciente Automatizado",
                "birth_date": "1990-01-01",
                "document": "TEST-001",
                "priority": 2,
                "location": "Recepción",
            },
        )

        assert create_response.status_code == 201

        episode = create_response.json()

        assert episode["name"] == "Paciente Automatizado"
        assert episode["status"] == "ACTIVE"
        assert episode["priority"] == 2
        assert episode["qr_token"]

        scan_response = client.get(
            f"/scan/{episode['qr_token']}",
            headers=reception_headers,
        )

        assert scan_response.status_code == 200
        assert scan_response.json()["id"] == episode["id"]

        nurse_headers = login(client, "enfermeria")

        triage_response = client.post(
            f"/episodes/{episode['id']}/triage",
            headers=nurse_headers,
            json={
                "priority": 1,
                "location": "Área de choque",
                "assigned_to": "Enfermería A",
            },
        )

        assert triage_response.status_code == 200
        assert triage_response.json()["priority"] == 1
        assert triage_response.json()["location"] == "Área de choque"

        vitals_response = client.post(
            f"/episodes/{episode['id']}/vitals",
            headers=nurse_headers,
            json={
                "temperature": 39.2,
                "heart_rate": 130,
                "systolic": 100,
                "diastolic": 60,
                "spo2": 88,
                "respiratory_rate": 28,
            },
        )

        assert vitals_response.status_code == 201

        episode_with_alerts = vitals_response.json()

        assert len(episode_with_alerts["alerts"]) == 3

        alert_id = episode_with_alerts["alerts"][0]["id"]

        acknowledge_response = client.patch(
            f"/alerts/{alert_id}",
            headers=nurse_headers,
            json={
                "status": "ACKNOWLEDGED",
            },
        )

        assert acknowledge_response.status_code == 200

        acknowledged_alert = next(
            alert
            for alert in acknowledge_response.json()["alerts"]
            if alert["id"] == alert_id
        )

        assert acknowledged_alert["status"] == "ACKNOWLEDGED"

        doctor_headers = login(client, "medico")
                # El médico registra una evaluación clínica sobre el episodio activo.
        evaluation_response = client.post(
            f"/episodes/{episode['id']}/medical-evaluation",
            headers=doctor_headers,
            json={
                "clinical_note": (
                    "Paciente evaluado, consciente y orientado"
                ),
                "diagnosis": "Síndrome febril en estudio",
                "disposition": "ORDER_TESTS",
            },
        )

        assert evaluation_response.status_code == 200

        # La evaluación debe quedar registrada en el timeline auditable.
        evaluation_events = {
            event["type"]
            for event in evaluation_response.json()["events"]
        }

        assert "MEDICAL_EVALUATION" in evaluation_events
        
                # El médico crea una orden de laboratorio.
        order_response = client.post(
            f"/episodes/{episode['id']}/tasks",
            headers=doctor_headers,
            json={
                "title": "Hemograma completo",
                "service": "LAB",
            },
        )

        assert order_response.status_code == 201

        laboratory_tasks = [
            task
            for task in order_response.json()["tasks"]
            if task["service"] == "LAB"
        ]

        assert len(laboratory_tasks) == 1
        assert laboratory_tasks[0]["title"] == "Hemograma completo"
        assert laboratory_tasks[0]["status"] == "PENDING"

        laboratory_headers = login(client, "laboratorio")
        
                # Laboratorio consulta su bandeja de órdenes pendientes.
        queue_response = client.get(
            "/lab/orders?status=PENDING",
            headers=laboratory_headers,
        )

        assert queue_response.status_code == 200
        assert queue_response.json()["total"] == 1

        queued_order = queue_response.json()["orders"][0]

        assert queued_order["title"] == "Hemograma completo"
        assert queued_order["patient_name"] == "Paciente Automatizado"
        assert queued_order["status"] == "PENDING"
        assert queued_order["episode_status"] == "ACTIVE"

        # Laboratorio completa la orden y publica un resultado simulado.
        completion_response = client.patch(
            f"/tasks/{laboratory_tasks[0]['id']}/complete",
            headers=laboratory_headers,
            json={
                "result": (
                    "Hemoglobina 13.8 g/dL; "
                    "leucocitos 8,400/mm3; "
                    "plaquetas 245,000/mm3"
                ),
            },
        )

        assert completion_response.status_code == 200

        completed_task = next(
            task
            for task in completion_response.json()["tasks"]
            if task["id"] == laboratory_tasks[0]["id"]
        )

        assert completed_task["status"] == "COMPLETED"
        assert "Hemoglobina" in completed_task["result"]


        resolve_response = client.patch(
            f"/alerts/{alert_id}",
            headers=doctor_headers,
            json={
                "status": "RESOLVED",
            },
        )

        assert resolve_response.status_code == 200

        discharge_response = client.post(
            f"/episodes/{episode['id']}/discharge",
            headers=doctor_headers,
            json={
                "note": "Paciente estable",
            },
        )

        assert discharge_response.status_code == 200

        closed_episode = discharge_response.json()

        assert closed_episode["status"] == "CLOSED"
        assert closed_episode["closed_at"] is not None

        event_types = {
            event["type"]
            for event in closed_episode["events"]
        }

        assert "EPISODE_CREATED" in event_types
        assert "QR_SCANNED" in event_types
        assert "TRIAGE" in event_types
        assert "VITALS_RECORDED" in event_types
        assert "ALERT_ACKNOWLEDGED" in event_types
        assert "MEDICAL_EVALUATION" in event_types
        assert "TASK_CREATED" in event_types
        assert "TASK_COMPLETED" in event_types
        assert "DISCHARGE" in event_types


def test_reception_cannot_register_vitals(tmp_path: Path) -> None:
    main.DATABASE_PATH = tmp_path / "permissions-test.db"
    main.initialize_database()

    with TestClient(main.app) as client:
        reception_headers = login(client, "recepcion")

        create_response = client.post(
            "/episodes",
            headers=reception_headers,
            json={
                "name": "Prueba de permisos",
                "birth_date": "1985-06-15",
                "document": "TEST-002",
                "priority": 3,
                "location": "Recepción",
            },
        )

        episode_id = create_response.json()["id"]

        response = client.post(
            f"/episodes/{episode_id}/vitals",
            headers=reception_headers,
            json={
                "temperature": 37,
                "heart_rate": 80,
                "systolic": 120,
                "diastolic": 80,
                "spo2": 98,
                "respiratory_rate": 16,
            },
        )

        assert response.status_code == 403
        
def test_reception_cannot_access_laboratory_queue(
    tmp_path: Path,
) -> None:
    """Comprueba que recepción no acceda a órdenes de laboratorio."""

    main.DATABASE_PATH = tmp_path / "laboratory-permissions.db"
    main.initialize_database()

    with TestClient(main.app) as client:
        reception_headers = login(client, "recepcion")

        response = client.get(
            "/lab/orders",
            headers=reception_headers,
        )

        assert response.status_code == 403
        
def test_supervisor_dashboard_and_permissions(
    tmp_path: Path,
) -> None:
    """Valida indicadores y acceso exclusivo del supervisor."""

    main.DATABASE_PATH = tmp_path / "supervisor-dashboard.db"
    main.initialize_database()

    with TestClient(main.app) as client:
        reception_headers = login(client, "recepcion")

        create_response = client.post(
            "/episodes",
            headers=reception_headers,
            json={
                "name": "Paciente supervisado",
                "birth_date": "1975-03-10",
                "document": "SUP-001",
                "priority": 1,
                "location": "Área de choque",
            },
        )

        assert create_response.status_code == 201

        supervisor_headers = login(client, "supervisor")

        dashboard_response = client.get(
            "/supervisor/dashboard",
            headers=supervisor_headers,
        )

        assert dashboard_response.status_code == 200

        dashboard = dashboard_response.json()

        assert dashboard["metrics"]["active_patients"] == 1
        assert dashboard["metrics"]["high_priority_patients"] == 1
        assert dashboard["metrics"]["patients_at_risk"] == 1
        assert len(dashboard["patients"]) == 1
        assert dashboard["patients"][0]["at_risk"] is True
        assert dashboard["patients"][0]["waiting_minutes"] >= 0

        forbidden_response = client.get(
            "/supervisor/dashboard",
            headers=reception_headers,
        )

        assert forbidden_response.status_code == 403
        
def test_time_rules_generate_alerts_without_duplicates(
    tmp_path: Path,
) -> None:
    """
    Simula el paso del tiempo y valida las tres reglas temporales.

    También ejecuta el motor dos veces para comprobar que no se
    creen alertas duplicadas.
    """

    main.DATABASE_PATH = tmp_path / "time-rules.db"
    main.initialize_database()

    with TestClient(main.app) as client:
        reception_headers = login(client, "recepcion")

        create_response = client.post(
            "/episodes",
            headers=reception_headers,
            json={
                "name": "Paciente con demora",
                "birth_date": "1968-11-05",
                "document": "TIME-001",
                "priority": 1,
                "location": "Sala de espera",
            },
        )

        assert create_response.status_code == 201

        episode_id = create_response.json()["id"]

        doctor_headers = login(client, "medico")

        task_response = client.post(
            f"/episodes/{episode_id}/tasks",
            headers=doctor_headers,
            json={
                "title": "Estudio pendiente",
                "service": "LAB",
            },
        )

        assert task_response.status_code == 201

        # Se simula un ingreso ocurrido hace 90 minutos.
        old_time = (
            datetime.now(timezone.utc) - timedelta(minutes=90)
        ).isoformat()

        connection = main.get_connection()

        connection.execute(
            """
            UPDATE episodes
            SET started_at = ?
            WHERE id = ?
            """,
            (
                old_time,
                episode_id,
            ),
        )

        connection.execute(
            """
            UPDATE events
            SET created_at = ?
            WHERE episode_id = ?
            """,
            (
                old_time,
                episode_id,
            ),
        )

        connection.execute(
            """
            UPDATE tasks
            SET created_at = ?
            WHERE episode_id = ?
            """,
            (
                old_time,
                episode_id,
            ),
        )

        connection.commit()
        connection.close()

        supervisor_headers = login(client, "supervisor")

        first_evaluation = client.post(
            "/rules/evaluate",
            headers=supervisor_headers,
        )

        assert first_evaluation.status_code == 200
        assert first_evaluation.json()["evaluated_episodes"] == 1
        assert first_evaluation.json()["generated_alerts"] == 3

        episode_response = client.get(
            f"/episodes/{episode_id}",
            headers=supervisor_headers,
        )

        assert episode_response.status_code == 200

        alert_reasons = {
            alert["reason"]
            for alert in episode_response.json()["alerts"]
        }

        assert "Tiempo de espera de triaje excedido" in alert_reasons
        assert "Tarea pendiente con tiempo excedido" in alert_reasons
        assert (
            "Paciente prioritario sin actualización reciente"
            in alert_reasons
        )

        # Una segunda ejecución no debe duplicar alertas abiertas.
        second_evaluation = client.post(
            "/rules/evaluate",
            headers=supervisor_headers,
        )

        assert second_evaluation.status_code == 200
        assert second_evaluation.json()["generated_alerts"] == 0

        second_episode_response = client.get(
            f"/episodes/{episode_id}",
            headers=supervisor_headers,
        )

        assert len(second_episode_response.json()["alerts"]) == 3