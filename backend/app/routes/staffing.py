"""Planning endpoints with atomic receipts, fresh coordination permission and versions."""
from datetime import date, datetime, timezone
import sqlite3
from typing import Literal
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, model_validator
from .. import auth
from ..staff_history import history_page
from ..input_validation import Name, ClinicalNote
from ..staffing import STAFF_ROLES, check_version, coordinator, detail, no_overlap, professional, record, responsible
from ..write_operations import atomic_write, transaction_factory


class Reason(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: ClinicalNote


class Area(Reason):
    name: Name
    active: bool = Field(default=True, strict=True)


class Shift(Reason):
    name: Name
    starts_at: datetime
    ends_at: datetime
    coordinator_id: int = Field(gt=0)

    @model_validator(mode="after")
    def valid_range(self):
        if self.starts_at.tzinfo is None or self.ends_at.tzinfo is None:
            raise ValueError("Indica fechas con zona horaria explicita")
        if self.ends_at <= self.starts_at:
            raise ValueError("El fin debe ser posterior al inicio, con fecha del dia siguiente si cruza medianoche")
        return self


class ShiftStatus(Reason):
    status: Literal["ACTIVE", "CLOSED", "CANCELLED"]


class ShiftExtension(Reason):
    ends_at: datetime

    @model_validator(mode="after")
    def explicit_zone(self):
        if self.ends_at.tzinfo is None:
            raise ValueError("Indica la nueva hora de fin con zona horaria explicita")
        return self


class Assignment(Reason):
    shift_id: int = Field(gt=0)
    user_id: int = Field(gt=0)
    area_id: int = Field(gt=0)


class AssignmentArea(Reason):
    area_id: int = Field(gt=0)


class AssignmentStatus(Reason):
    status: Literal["AVAILABLE", "UNAVAILABLE", "FINISHED", "CANCELLED"]


def create_router(connection_factory, timestamp, clinical_user, require_coordination):
    router = APIRouter(prefix="/staff")
    factory = transaction_factory(connection_factory)

    def reauthorize(connection, request, user):
        current = auth.validate_session(request.headers.get("Authorization"), lambda: factory(), timestamp)
        if not current.get("can_coordinate") or current["role"] == "ACCOUNT_ADMIN":
            raise HTTPException(403, "Permiso de coordinacion requerido")
        if current["username"] != user["username"]:
            raise HTTPException(401, "Sesion modificada")

    write = atomic_write(connection_factory, require_key=True, authorize=reauthorize)

    def save(connection, resource, identifier, user, action, before, reason):
        result = detail(connection, resource, identifier)
        record(connection, resource, identifier, user["username"], action, before, result, reason, timestamp)
        return result

    def active_area(connection, identifier):
        if not detail(connection, "area", identifier)["active"]:
            raise HTTPException(409, "El area esta inactiva")

    @router.get("/planning")
    def planning(user: dict = Depends(require_coordination)):
        connection = factory()
        try:
            resources = {name: [detail(connection, kind, row["id"]) for row in connection.execute(f"SELECT id FROM {table} ORDER BY id")]
                for name, kind, table in (("areas", "area", "staff_areas"), ("shifts", "shift", "staff_shifts"), ("assignments", "assignment", "staff_assignments"))}
            recent = history_page(connection, timestamp())
            people = [dict(row) for row in connection.execute("SELECT id,username,display_name,role,active,can_coordinate FROM users WHERE active=1 AND role!='ACCOUNT_ADMIN' ORDER BY id")]
            return {**resources, "professionals": [person for person in people if person["role"] in STAFF_ROLES and person["display_name"].strip()],
                    "coordinators": [person for person in people if person["can_coordinate"]],
                    "changes": recent["changes"], "changes_has_more": recent["has_more"],
                    "requested_by": user["username"]}
        finally:
            connection.close()

    @router.get("/changes")
    def changes(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=50),
                start_date: date | None = None, end_date: date | None = None,
                shift_id: int | None = Query(None, gt=0), professional_id: int | None = Query(None, gt=0),
                action: Literal["CREATE", "UPDATE", "EXTEND", "ASSUME_COORDINATION", "ACTIVE", "CLOSED", "CANCELLED",
                                "PLAN", "CHANGE_AREA", "AVAILABLE", "UNAVAILABLE", "FINISHED", "SHIFT_CANCELLED"] | None = None,
                user: dict = Depends(require_coordination)):
        if start_date and end_date and start_date > end_date:
            raise HTTPException(422, "La fecha inicial debe ser anterior o igual a la final")
        if end_date == date.max:
            raise HTTPException(422, "Selecciona una fecha final anterior al año 10000")
        connection = factory()
        try:
            return {**history_page(connection, timestamp(), recent=False, page=page, page_size=page_size,
                                   start_date=start_date, end_date=end_date, shift_id=shift_id,
                                   professional_id=professional_id, action=action),
                    "shifts": [dict(row) for row in connection.execute("SELECT id,name FROM staff_shifts ORDER BY id DESC")],
                    "professionals": [dict(row) for row in connection.execute(
                        "SELECT DISTINCT u.id,u.username,u.display_name FROM users u JOIN staff_assignments d ON d.user_id=u.id ORDER BY u.id")],
                    "requested_by": user["username"]}
        finally:
            connection.close()

    @router.get("/mine")
    def mine(user: dict = Depends(clinical_user)):
        connection = factory()
        try:
            assignments = [detail(connection, "assignment", row["id"]) for row in connection.execute(
                "SELECT d.id FROM staff_assignments d JOIN users u ON u.id=d.user_id WHERE u.username=? ORDER BY d.id", (user["username"],))]
            return {"assignments": assignments, "requested_by": user["username"]}
        finally:
            connection.close()

    @router.post("/areas", status_code=201)
    @write
    def create_area(data: Area, user: dict = Depends(require_coordination)):
        connection = factory()
        try:
            identifier = connection.execute("INSERT INTO staff_areas(name,name_key,active) VALUES (?,?,?)", (data.name.strip(), data.name.strip().casefold(), int(data.active))).lastrowid
        except sqlite3.IntegrityError:
            raise HTTPException(409, "Ya existe un area con ese nombre") from None
        return save(connection, "area", identifier, user, "CREATE", None, data.reason)

    @router.patch("/areas/{identifier}")
    @write
    def edit_area(identifier: int, data: Area, expected: str | None = Header(default=None, alias="If-Match"), user: dict = Depends(require_coordination)):
        connection = factory()
        before = check_version(connection, "area", identifier, expected)
        if not data.active and connection.execute("""SELECT 1 FROM staff_assignments d JOIN staff_shifts s ON s.id=d.shift_id
            WHERE d.area_id=? AND d.status IN ('PLANNED','AVAILABLE','UNAVAILABLE') AND s.status IN ('PLANNED','ACTIVE')""", (identifier,)).fetchone():
            raise HTTPException(409, "El area tiene personal planificado; revisa su planificacion antes de desactivarla")
        try:
            connection.execute("UPDATE staff_areas SET name=?,name_key=?,active=?,revision=revision+1 WHERE id=?", (data.name.strip(), data.name.strip().casefold(), int(data.active), identifier))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "Ya existe un area con ese nombre") from None
        return save(connection, "area", identifier, user, "UPDATE", before, data.reason)

    @router.post("/shifts", status_code=201)
    @write
    def create_shift(data: Shift, user: dict = Depends(require_coordination)):
        connection = factory()
        coordinator(connection, data.coordinator_id)
        identifier = connection.execute("INSERT INTO staff_shifts(name,starts_at,ends_at,coordinator_id) VALUES (?,?,?,?)",
            (data.name, data.starts_at.astimezone(timezone.utc).isoformat(), data.ends_at.astimezone(timezone.utc).isoformat(), data.coordinator_id)).lastrowid
        return save(connection, "shift", identifier, user, "CREATE", None, data.reason)

    @router.patch("/shifts/{identifier}")
    @write
    def edit_shift(identifier: int, data: Shift, expected: str | None = Header(default=None, alias="If-Match"), user: dict = Depends(require_coordination)):
        connection = factory()
        before = check_version(connection, "shift", identifier, expected)
        if before["status"] != "PLANNED":
            raise HTTPException(409, "Solo puede editarse el horario de un turno planificado")
        coordinator(connection, data.coordinator_id)
        starts, ends = data.starts_at.astimezone(timezone.utc).isoformat(), data.ends_at.astimezone(timezone.utc).isoformat()
        for row in connection.execute("SELECT user_id FROM staff_assignments WHERE shift_id=? AND status!='CANCELLED'", (identifier,)):
            no_overlap(connection, row["user_id"], starts, ends, identifier)
        connection.execute("UPDATE staff_shifts SET name=?,starts_at=?,ends_at=?,coordinator_id=?,revision=revision+1 WHERE id=?", (data.name, starts, ends, data.coordinator_id, identifier))
        return save(connection, "shift", identifier, user, "UPDATE", before, data.reason)

    @router.post("/shifts/{identifier}/extend")
    @write
    def extend_shift(identifier: int, data: ShiftExtension, expected: str | None = Header(default=None, alias="If-Match"), user: dict = Depends(require_coordination)):
        connection = factory()
        before = check_version(connection, "shift", identifier, expected)
        responsible(before, user)
        if before["status"] != "ACTIVE":
            raise HTTPException(409, "Solo puede extenderse un turno activo")
        new_end = data.ends_at.astimezone(timezone.utc).isoformat()
        if data.ends_at.astimezone(timezone.utc) <= datetime.fromisoformat(before["ends_at"]):
            raise HTTPException(409, "La nueva hora de fin debe ser posterior a la programada")
        for row in connection.execute("SELECT user_id FROM staff_assignments WHERE shift_id=? AND status!='CANCELLED'", (identifier,)).fetchall():
            no_overlap(connection, row["user_id"], before["starts_at"], new_end, identifier)
        connection.execute("UPDATE staff_shifts SET ends_at=?,revision=revision+1 WHERE id=?", (new_end, identifier))
        return save(connection, "shift", identifier, user, "EXTEND", before, data.reason)

    @router.post("/shifts/{identifier}/assume")
    @write
    def assume(identifier: int, data: Reason, expected: str | None = Header(default=None, alias="If-Match"), user: dict = Depends(require_coordination)):
        connection = factory()
        before = check_version(connection, "shift", identifier, expected)
        if before["status"] not in ("PLANNED", "ACTIVE"):
            raise HTTPException(409, "El turno ya termino o se cancelo")
        actor = connection.execute("SELECT id FROM users WHERE username=?", (user["username"],)).fetchone()["id"]
        connection.execute("UPDATE staff_shifts SET coordinator_id=?,revision=revision+1 WHERE id=?", (actor, identifier))
        return save(connection, "shift", identifier, user, "ASSUME_COORDINATION", before, data.reason)

    @router.post("/shifts/{identifier}/status")
    @write
    def shift_status(identifier: int, data: ShiftStatus, expected: str | None = Header(default=None, alias="If-Match"), user: dict = Depends(require_coordination)):
        connection = factory()
        before = check_version(connection, "shift", identifier, expected)
        responsible(before, user)
        if data.status not in {"PLANNED": ("ACTIVE", "CANCELLED"), "ACTIVE": ("CLOSED",)}.get(before["status"], ()):
            raise HTTPException(409, "Cambio de estado del turno no permitido")
        if data.status == "ACTIVE":
            coordinator(connection, before["coordinator_id"])
            if connection.execute("SELECT 1 FROM staff_shifts WHERE status='ACTIVE'").fetchone():
                raise HTTPException(409, "Ya hay un turno activo de urgencias; finalizalo antes de iniciar otro")
        if data.status == "CLOSED" and connection.execute("SELECT 1 FROM staff_assignments WHERE shift_id=? AND status NOT IN ('FINISHED','CANCELLED')", (identifier,)).fetchone():
            raise HTTPException(409, "Finaliza o cancela explicitamente la disponibilidad pendiente antes de cerrar el turno")
        cancelled = [detail(connection, "assignment", row["id"]) for row in connection.execute(
            "SELECT id FROM staff_assignments WHERE shift_id=? AND status='PLANNED'", (identifier,)).fetchall()] if data.status == "CANCELLED" else []
        connection.execute("UPDATE staff_shifts SET status=?,revision=revision+1 WHERE id=?", (data.status, identifier))
        for prior in cancelled:
            connection.execute("UPDATE staff_assignments SET status='CANCELLED',revision=revision+1 WHERE id=?", (prior["id"],))
            save(connection, "assignment", prior["id"], user, "SHIFT_CANCELLED", prior, data.reason)
        return save(connection, "shift", identifier, user, data.status, before, data.reason)

    @router.post("/assignments", status_code=201)
    @write
    def assign(data: Assignment, user: dict = Depends(require_coordination)):
        connection = factory()
        shift = detail(connection, "shift", data.shift_id)
        if shift["status"] not in ("PLANNED", "ACTIVE"):
            raise HTTPException(409, "El turno ya termino o se cancelo")
        if shift["status"] == "ACTIVE":
            responsible(shift, user)
        professional(connection, data.user_id)
        active_area(connection, data.area_id)
        no_overlap(connection, data.user_id, shift["starts_at"], shift["ends_at"])
        identifier = connection.execute("INSERT INTO staff_assignments(shift_id,user_id,area_id) VALUES (?,?,?)", (data.shift_id, data.user_id, data.area_id)).lastrowid
        return save(connection, "assignment", identifier, user, "PLAN", None, data.reason)

    @router.patch("/assignments/{identifier}/area")
    @write
    def change_area(identifier: int, data: AssignmentArea, expected: str | None = Header(default=None, alias="If-Match"), user: dict = Depends(require_coordination)):
        connection = factory()
        before = check_version(connection, "assignment", identifier, expected)
        if before["status"] != "PLANNED" or before["shift_status"] != "PLANNED":
            raise HTTPException(409, "El area solo cambia antes del inicio; no reasigna pacientes")
        active_area(connection, data.area_id)
        connection.execute("UPDATE staff_assignments SET area_id=?,revision=revision+1 WHERE id=?", (data.area_id, identifier))
        return save(connection, "assignment", identifier, user, "CHANGE_AREA", before, data.reason)

    @router.post("/assignments/{identifier}/status")
    @write
    def assignment_status(identifier: int, data: AssignmentStatus, expected: str | None = Header(default=None, alias="If-Match"), user: dict = Depends(require_coordination)):
        connection = factory()
        before = check_version(connection, "assignment", identifier, expected)
        shift = detail(connection, "shift", before["shift_id"])
        if shift["status"] not in ("PLANNED", "ACTIVE"):
            raise HTTPException(409, "El turno ya termino o se cancelo")
        responsible(shift, user)
        transitions = {"PLANNED": ("AVAILABLE", "CANCELLED"), "AVAILABLE": ("UNAVAILABLE", "FINISHED"), "UNAVAILABLE": ("AVAILABLE", "FINISHED")}
        if data.status not in transitions.get(before["status"], ()):
            raise HTTPException(409, "Cambio de disponibilidad no permitido")
        if data.status == "AVAILABLE":
            if shift["status"] != "ACTIVE":
                raise HTTPException(409, "Inicia el turno antes de confirmar disponibilidad")
            professional(connection, before["user_id"])
            active_area(connection, before["area_id"])
        connection.execute("UPDATE staff_assignments SET status=?,revision=revision+1 WHERE id=?", (data.status, identifier))
        return save(connection, "assignment", identifier, user, data.status, before, data.reason)

    return router
