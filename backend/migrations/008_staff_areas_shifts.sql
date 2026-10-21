-- Documentation of runtime app/staffing.py:migrate_staffing.
-- The runtime conditionally adds users.can_coordinate INTEGER NOT NULL DEFAULT 0
-- CHECK(can_coordinate IN (0,1)) inside the same transaction as these tables.
-- It seeds Triaje, Consulta, Observacion, Laboratorio only on first catalog creation.
-- It never seeds permissions, shifts, assignments or clinical changes.
CREATE TABLE IF NOT EXISTS staff_areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS staff_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    coordinator_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'PLANNED' CHECK(status IN ('PLANNED','ACTIVE','CLOSED','CANCELLED')),
    revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS staff_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER NOT NULL REFERENCES staff_shifts(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    area_id INTEGER NOT NULL REFERENCES staff_areas(id),
    status TEXT NOT NULL DEFAULT 'PLANNED' CHECK(status IN ('PLANNED','AVAILABLE','UNAVAILABLE','FINISHED','CANCELLED')),
    revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS staff_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT NOT NULL,
    new_value TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_user ON staff_assignments(user_id,shift_id);
CREATE INDEX IF NOT EXISTS idx_staff_changes_target ON staff_changes(resource,target_id,id);
