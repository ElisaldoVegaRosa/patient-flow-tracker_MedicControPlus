"""Staff planning has its own lifecycle; it never assigns or transfers patients."""
import json
from fastapi import HTTPException
from .concurrency import etag

STAFF_ROLES = ("NURSE", "DOCTOR", "LAB")


def migrate_staffing(connection):
    try:
        connection.execute("BEGIN IMMEDIATE")
        columns = {row["name"] for row in connection.execute("PRAGMA table_info(users)")}
        if "can_coordinate" not in columns:
            connection.execute("ALTER TABLE users ADD COLUMN can_coordinate INTEGER NOT NULL DEFAULT 0 CHECK(can_coordinate IN (0,1))")
        seed = connection.execute("SELECT 1 FROM sqlite_schema WHERE name='staff_areas'").fetchone() is None
        for sql in (
            """CREATE TABLE IF NOT EXISTS staff_areas (
                id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
                name_key TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
                revision INTEGER NOT NULL DEFAULT 0)""",
            """CREATE TABLE IF NOT EXISTS staff_shifts (
                id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
                starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
                coordinator_id INTEGER NOT NULL REFERENCES users(id),
                status TEXT NOT NULL DEFAULT 'PLANNED' CHECK(status IN ('PLANNED','ACTIVE','CLOSED','CANCELLED')),
                revision INTEGER NOT NULL DEFAULT 0)""",
            """CREATE TABLE IF NOT EXISTS staff_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT, shift_id INTEGER NOT NULL REFERENCES staff_shifts(id),
                user_id INTEGER NOT NULL REFERENCES users(id), area_id INTEGER NOT NULL REFERENCES staff_areas(id),
                status TEXT NOT NULL DEFAULT 'PLANNED' CHECK(status IN ('PLANNED','AVAILABLE','UNAVAILABLE','FINISHED','CANCELLED')),
                revision INTEGER NOT NULL DEFAULT 0)""",
            """CREATE TABLE IF NOT EXISTS staff_changes (
                id INTEGER PRIMARY KEY AUTOINCREMENT, resource TEXT NOT NULL, target_id INTEGER NOT NULL,
                actor TEXT NOT NULL, action TEXT NOT NULL, old_value TEXT NOT NULL, new_value TEXT NOT NULL,
                reason TEXT NOT NULL, created_at TEXT NOT NULL)""",
            "CREATE INDEX IF NOT EXISTS idx_staff_assignments_user ON staff_assignments(user_id,shift_id)",
            "CREATE INDEX IF NOT EXISTS idx_staff_changes_target ON staff_changes(resource,target_id,id)",
        ):
            connection.execute(sql)
        if seed:
            for name in ("Triaje", "Consulta", "Observación", "Laboratorio"):
                connection.execute("INSERT INTO staff_areas(name,name_key) VALUES (?,?)", (name, name.casefold()))
        connection.commit()
    except BaseException:
        connection.rollback()
        raise


def detail(connection, resource, identifier):
    queries = {
        "area": "SELECT * FROM staff_areas WHERE id=?",
        "shift": """SELECT s.*, u.username AS coordinator_username, u.display_name AS coordinator_name,
            u.active AS coordinator_active, u.can_coordinate AS coordinator_permission
            FROM staff_shifts s JOIN users u ON u.id=s.coordinator_id WHERE s.id=?""",
        "assignment": """SELECT d.*, u.username, u.display_name, u.role, u.active AS account_active,
            a.name AS area_name, a.active AS area_active, s.name AS shift_name, s.starts_at, s.ends_at,
            s.status AS shift_status, s.coordinator_id
            FROM staff_assignments d JOIN users u ON u.id=d.user_id
            JOIN staff_areas a ON a.id=d.area_id JOIN staff_shifts s ON s.id=d.shift_id WHERE d.id=?""",
    }
    row = connection.execute(queries[resource], (identifier,)).fetchone()
    if row is None:
        raise HTTPException(404, "Registro de personal no encontrado")
    result = dict(row)
    if resource == "assignment":
        result["effective_available"] = bool(result["account_active"] and result["area_active"] and
            result["shift_status"] == "ACTIVE" and result["status"] == "AVAILABLE")
    result["version"] = etag(result)
    return result


def check_version(connection, resource, identifier, expected):
    current = detail(connection, resource, identifier)
    if not expected:
        raise HTTPException(428, "Consulta la version actual antes de guardar")
    if expected != current["version"]:
        raise HTTPException(409, {"code": "version_conflict", "message": "Otra sesion modifico la planificacion. Consulta y revisa antes de guardar."})
    return current


def record(connection, resource, identifier, actor, action, before, after, reason, timestamp):
    connection.execute("""INSERT INTO staff_changes(resource,target_id,actor,action,old_value,new_value,reason,created_at)
        VALUES (?,?,?,?,?,?,?,?)""", (resource, identifier, actor, action, json.dumps(before, ensure_ascii=False),
        json.dumps(after, ensure_ascii=False), reason, timestamp()))


def coordinator(connection, identifier):
    row = connection.execute("SELECT id FROM users WHERE id=? AND active=1 AND can_coordinate=1 AND role!='ACCOUNT_ADMIN'", (identifier,)).fetchone()
    if row is None:
        raise HTTPException(409, "El responsable debe ser una cuenta activa con permiso de coordinacion")


def professional(connection, identifier):
    row = connection.execute("SELECT role,active,display_name FROM users WHERE id=?", (identifier,)).fetchone()
    if row is None or not row["active"] or row["role"] not in STAFF_ROLES or not row["display_name"].strip():
        raise HTTPException(409, "Selecciona una cuenta personal activa de medicina, enfermeria o laboratorio")


def no_overlap(connection, user_id, starts_at, ends_at, exclude_shift=None):
    if connection.execute("""SELECT 1 FROM staff_assignments d JOIN staff_shifts s ON s.id=d.shift_id
        WHERE d.user_id=? AND d.status!='CANCELLED' AND s.status!='CANCELLED'
        AND (? IS NULL OR s.id!=?) AND s.starts_at < ? AND s.ends_at > ? LIMIT 1""",
        (user_id, exclude_shift, exclude_shift, ends_at, starts_at)).fetchone():
        raise HTTPException(409, "El profesional ya tiene una planificacion que se solapa con ese horario")


def responsible(shift, user):
    if shift["coordinator_username"] != user["username"]:
        raise HTTPException(403, "El responsable del turno debe confirmar esta accion; puedes asumir coordinacion explicitamente")
