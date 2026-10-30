-- Isolated schema only: app.laboratory_schema is NOT called by startup.
-- The Python runner owns BEGIN/COMMIT and executes complete statements one by one.
-- Prototype v2: not deployed. Reject v1 copies without modifying their data.
-- No legacy order, specimen, result or review is inferred or inserted here.
CREATE TABLE IF NOT EXISTS lab_schema (
    version INTEGER PRIMARY KEY CHECK (version = 2)
);

CREATE TABLE IF NOT EXISTS lab_orders (
    task_id INTEGER PRIMARY KEY REFERENCES tasks(id),
    episode_id INTEGER NOT NULL REFERENCES episodes(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    UNIQUE (task_id, episode_id)
);

CREATE TRIGGER IF NOT EXISTS lab_order_matches_task_insert
BEFORE INSERT ON lab_orders
WHEN NOT EXISTS (SELECT 1 FROM tasks WHERE id=NEW.task_id
                 AND episode_id=NEW.episode_id AND service='LAB')
BEGIN
    SELECT RAISE(ABORT, 'La orden debe corresponder a una tarea LAB del episodio');
END;

CREATE TRIGGER IF NOT EXISTS lab_order_matches_task_update
BEFORE UPDATE OF task_id, episode_id ON lab_orders
BEGIN
    SELECT RAISE(ABORT, 'No se puede cambiar el episodio de una orden estructurada');
END;

CREATE TRIGGER IF NOT EXISTS lab_task_identity_update
BEFORE UPDATE OF id, episode_id, service ON tasks
WHEN EXISTS (SELECT 1 FROM lab_orders WHERE task_id=OLD.id)
     AND (NEW.id != OLD.id OR NEW.episode_id != OLD.episode_id OR NEW.service != OLD.service)
BEGIN
    SELECT RAISE(ABORT, 'No se puede desvincular una tarea de su orden LAB');
END;

CREATE TABLE IF NOT EXISTS lab_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_task_id INTEGER NOT NULL REFERENCES lab_orders(task_id),
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 300),
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    cancelled_at TEXT,
    cancelled_by INTEGER REFERENCES users(id),
    cancellation_reason TEXT,
    CHECK ((cancelled_at IS NULL AND cancelled_by IS NULL AND cancellation_reason IS NULL)
        OR (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL
            AND cancellation_reason IS NOT NULL AND length(trim(cancellation_reason)) BETWEEN 3 AND 2000)),
    UNIQUE (id, order_task_id)
);

CREATE TABLE IF NOT EXISTS lab_specimens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_task_id INTEGER NOT NULL REFERENCES lab_orders(task_id),
    kind TEXT NOT NULL CHECK (kind IN ('BLOOD','SALIVA','STOOL','URINE','OTHER')),
    kind_description TEXT,
    collected_at TEXT,
    collection_location TEXT,
    collector_kind TEXT CHECK (collector_kind IN ('USER','PATIENT','THIRD_PARTY')),
    collector_user_id INTEGER REFERENCES users(id),
    delivered_at TEXT,
    deliverer_kind TEXT CHECK (deliverer_kind IN ('USER','PATIENT','THIRD_PARTY')),
    deliverer_user_id INTEGER REFERENCES users(id),
    received_at TEXT,
    received_by INTEGER REFERENCES users(id),
    suitability TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (suitability IN ('UNKNOWN','ACCEPTED','REJECTED')),
    assessed_at TEXT,
    assessed_by INTEGER REFERENCES users(id),
    suitability_reason TEXT,
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    CHECK (kind != 'OTHER' OR (kind_description IS NOT NULL AND length(trim(kind_description)) > 0)),
    CHECK ((collected_at IS NULL AND collection_location IS NULL AND collector_kind IS NULL AND collector_user_id IS NULL)
        OR (collected_at IS NOT NULL AND collection_location IS NOT NULL AND length(trim(collection_location)) > 0
            AND collector_kind IS NOT NULL AND ((collector_kind='USER' AND collector_user_id IS NOT NULL)
                OR (collector_kind IN ('PATIENT','THIRD_PARTY') AND collector_user_id IS NULL)))),
    CHECK ((delivered_at IS NULL AND deliverer_kind IS NULL AND deliverer_user_id IS NULL)
        OR (delivered_at IS NOT NULL AND deliverer_kind IS NOT NULL
            AND ((deliverer_kind='USER' AND deliverer_user_id IS NOT NULL)
                OR (deliverer_kind IN ('PATIENT','THIRD_PARTY') AND deliverer_user_id IS NULL)))),
    CHECK ((received_at IS NULL AND received_by IS NULL) OR (received_at IS NOT NULL AND received_by IS NOT NULL)),
    CHECK ((suitability='UNKNOWN' AND assessed_at IS NULL AND assessed_by IS NULL AND suitability_reason IS NULL)
        OR (suitability IN ('ACCEPTED','REJECTED') AND received_at IS NOT NULL AND assessed_at IS NOT NULL
            AND assessed_by IS NOT NULL AND (suitability='ACCEPTED' OR
                (suitability_reason IS NOT NULL AND length(trim(suitability_reason)) BETWEEN 3 AND 2000)))),
    UNIQUE (id, order_task_id)
);

CREATE TABLE IF NOT EXISTS lab_analysis_specimens (
    order_task_id INTEGER NOT NULL,
    analysis_id INTEGER NOT NULL,
    specimen_id INTEGER NOT NULL,
    current_requirement INTEGER NOT NULL DEFAULT 1 CHECK (current_requirement IN (0,1)),
    PRIMARY KEY (analysis_id, specimen_id),
    UNIQUE (analysis_id, specimen_id, order_task_id),
    FOREIGN KEY (analysis_id, order_task_id) REFERENCES lab_analyses(id, order_task_id),
    FOREIGN KEY (specimen_id, order_task_id) REFERENCES lab_specimens(id, order_task_id)
);

-- One row per affected analysis: repeating a shared sample need not repeat every test.
CREATE TABLE IF NOT EXISTS lab_specimen_repeats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_task_id INTEGER NOT NULL,
    analysis_id INTEGER NOT NULL,
    previous_specimen_id INTEGER NOT NULL,
    new_specimen_id INTEGER NOT NULL,
    requested_by INTEGER NOT NULL REFERENCES users(id),
    requested_at TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 2000),
    CHECK (previous_specimen_id != new_specimen_id),
    UNIQUE (analysis_id, new_specimen_id),
    FOREIGN KEY (analysis_id, previous_specimen_id, order_task_id)
        REFERENCES lab_analysis_specimens(analysis_id, specimen_id, order_task_id),
    FOREIGN KEY (analysis_id, new_specimen_id, order_task_id)
        REFERENCES lab_analysis_specimens(analysis_id, specimen_id, order_task_id)
);

CREATE TRIGGER IF NOT EXISTS lab_repeat_no_cycle
BEFORE INSERT ON lab_specimen_repeats
WHEN EXISTS (
    WITH RECURSIVE descendants(specimen_id) AS (
        SELECT NEW.new_specimen_id
        UNION
        SELECT r.new_specimen_id FROM lab_specimen_repeats r
        JOIN descendants d ON r.previous_specimen_id=d.specimen_id
        WHERE r.analysis_id=NEW.analysis_id
    )
    SELECT 1 FROM descendants WHERE specimen_id=NEW.previous_specimen_id
)
BEGIN
    SELECT RAISE(ABORT, 'Una repeticion no puede formar un ciclo');
END;

CREATE TABLE IF NOT EXISTS lab_result_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_task_id INTEGER NOT NULL,
    analysis_id INTEGER NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence >= 1),
    action TEXT NOT NULL CHECK (action IN ('PUBLISH','CORRECT','ANNUL')),
    previous_version_id INTEGER,
    result TEXT,
    reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 2000),
    published_by INTEGER NOT NULL REFERENCES users(id),
    published_at TEXT NOT NULL,
    CHECK ((action='ANNUL' AND result IS NULL) OR
        (action IN ('PUBLISH','CORRECT') AND result IS NOT NULL AND length(trim(result)) BETWEEN 3 AND 2000)),
    CHECK ((sequence=1 AND action='PUBLISH' AND previous_version_id IS NULL)
        OR (sequence>1 AND previous_version_id IS NOT NULL)),
    UNIQUE (analysis_id, sequence),
    UNIQUE (previous_version_id),
    UNIQUE (id, analysis_id, order_task_id),
    FOREIGN KEY (analysis_id, order_task_id) REFERENCES lab_analyses(id, order_task_id),
    FOREIGN KEY (previous_version_id, analysis_id, order_task_id)
        REFERENCES lab_result_versions(id, analysis_id, order_task_id)
);

CREATE TRIGGER IF NOT EXISTS lab_result_sequence
BEFORE INSERT ON lab_result_versions
WHEN NEW.sequence>1 AND NOT EXISTS (
    SELECT 1 FROM lab_result_versions WHERE id=NEW.previous_version_id
    AND analysis_id=NEW.analysis_id AND order_task_id=NEW.order_task_id AND sequence=NEW.sequence-1
)
BEGIN
    SELECT RAISE(ABORT, 'La version anterior no corresponde a la secuencia');
END;

CREATE TABLE IF NOT EXISTS lab_result_specimens (
    result_version_id INTEGER NOT NULL,
    order_task_id INTEGER NOT NULL,
    analysis_id INTEGER NOT NULL,
    specimen_id INTEGER NOT NULL,
    PRIMARY KEY (result_version_id, specimen_id),
    FOREIGN KEY (result_version_id, analysis_id, order_task_id)
        REFERENCES lab_result_versions(id, analysis_id, order_task_id),
    FOREIGN KEY (analysis_id, specimen_id, order_task_id)
        REFERENCES lab_analysis_specimens(analysis_id, specimen_id, order_task_id)
);

CREATE TABLE IF NOT EXISTS lab_result_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    result_version_id INTEGER NOT NULL UNIQUE REFERENCES lab_result_versions(id),
    reviewed_by INTEGER NOT NULL REFERENCES users(id),
    reviewed_at TEXT NOT NULL,
    responsibility_context TEXT NOT NULL CHECK (responsibility_context IN ('ACTIVE_EPISODE','FOLLOWUP')),
    owner_revision INTEGER NOT NULL CHECK (owner_revision >= 0)
);

CREATE TRIGGER IF NOT EXISTS lab_result_source_current
BEFORE INSERT ON lab_result_specimens
WHEN EXISTS (SELECT 1 FROM lab_result_reviews WHERE result_version_id=NEW.result_version_id)
    OR EXISTS (SELECT 1 FROM lab_result_versions WHERE previous_version_id=NEW.result_version_id)
    OR EXISTS (SELECT 1 FROM lab_result_versions WHERE id=NEW.result_version_id AND action='ANNUL')
BEGIN
    SELECT RAISE(ABORT, 'No se pueden agregar muestras a una version revisada, sustituida o anulada');
END;

CREATE TRIGGER IF NOT EXISTS lab_review_current_version
BEFORE INSERT ON lab_result_reviews
WHEN NOT EXISTS (
    SELECT 1 FROM lab_result_versions v WHERE v.id=NEW.result_version_id AND v.action!='ANNUL'
    AND NOT EXISTS (SELECT 1 FROM lab_result_versions n WHERE n.previous_version_id=v.id)
)
BEGIN
    SELECT RAISE(ABORT, 'Solo se revisa la version vigente de un resultado publicado');
END;

-- Distinct plans per discharge event preserve reopen/discharge cycles.
CREATE TABLE IF NOT EXISTS lab_followups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL REFERENCES episodes(id),
    discharge_event_id INTEGER NOT NULL UNIQUE REFERENCES events(id),
    owner_user_id INTEGER NOT NULL REFERENCES users(id),
    pending_user_id INTEGER REFERENCES users(id),
    review_due_at TEXT,
    communication_plan TEXT,
    reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 2000),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    CHECK (pending_user_id IS NULL OR pending_user_id!=owner_user_id),
    CHECK ((review_due_at IS NULL AND communication_plan IS NULL) OR
        (review_due_at IS NOT NULL AND length(trim(review_due_at)) > 0 AND communication_plan IS NOT NULL
         AND length(trim(communication_plan)) BETWEEN 3 AND 2000)),
    UNIQUE (id, episode_id)
);

CREATE TRIGGER IF NOT EXISTS lab_followup_discharge_event
BEFORE INSERT ON lab_followups
WHEN NOT EXISTS (SELECT 1 FROM events WHERE id=NEW.discharge_event_id
    AND episode_id=NEW.episode_id AND type='DISCHARGE')
BEGIN
    SELECT RAISE(ABORT, 'El plan debe corresponder al alta del mismo episodio');
END;

CREATE TRIGGER IF NOT EXISTS lab_followup_identity_update
BEFORE UPDATE OF episode_id, discharge_event_id ON lab_followups
BEGIN
    SELECT RAISE(ABORT, 'No se puede cambiar el alta de un plan existente');
END;

CREATE TABLE IF NOT EXISTS lab_followup_scope (
    followup_id INTEGER NOT NULL,
    episode_id INTEGER NOT NULL,
    order_task_id INTEGER NOT NULL,
    analysis_id INTEGER NOT NULL,
    version_at_discharge INTEGER,
    discharge_snapshot TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(discharge_snapshot)),
    PRIMARY KEY (followup_id, analysis_id),
    FOREIGN KEY (followup_id, episode_id) REFERENCES lab_followups(id, episode_id),
    FOREIGN KEY (order_task_id, episode_id) REFERENCES lab_orders(task_id, episode_id),
    FOREIGN KEY (analysis_id, order_task_id) REFERENCES lab_analyses(id, order_task_id),
    FOREIGN KEY (version_at_discharge, analysis_id, order_task_id)
        REFERENCES lab_result_versions(id, analysis_id, order_task_id)
);

CREATE TABLE IF NOT EXISTS lab_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL REFERENCES episodes(id),
    order_task_id INTEGER,
    resource_type TEXT NOT NULL,
    resource_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    actor_user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 2000),
    old_value TEXT NOT NULL CHECK (json_valid(old_value)),
    new_value TEXT NOT NULL CHECK (json_valid(new_value)),
    FOREIGN KEY (order_task_id, episode_id) REFERENCES lab_orders(task_id, episode_id)
);

CREATE INDEX IF NOT EXISTS idx_lab_orders_episode ON lab_orders(episode_id, task_id);
CREATE INDEX IF NOT EXISTS idx_lab_analyses_order ON lab_analyses(order_task_id, id);
CREATE INDEX IF NOT EXISTS idx_lab_specimens_order ON lab_specimens(order_task_id, id);
CREATE INDEX IF NOT EXISTS idx_lab_followups_owner ON lab_followups(owner_user_id, review_due_at);
CREATE INDEX IF NOT EXISTS idx_lab_changes_episode ON lab_changes(episode_id, id);

CREATE TRIGGER IF NOT EXISTS lab_result_versions_no_update BEFORE UPDATE ON lab_result_versions
BEGIN
    SELECT RAISE(ABORT, 'Las versiones publicadas son inmutables');
END;
CREATE TRIGGER IF NOT EXISTS lab_result_versions_no_delete BEFORE DELETE ON lab_result_versions
BEGIN
    SELECT RAISE(ABORT, 'Las versiones publicadas son inmutables');
END;
CREATE TRIGGER IF NOT EXISTS lab_reviews_no_update BEFORE UPDATE ON lab_result_reviews
BEGIN
    SELECT RAISE(ABORT, 'Las revisiones historicas son inmutables');
END;
CREATE TRIGGER IF NOT EXISTS lab_reviews_no_delete BEFORE DELETE ON lab_result_reviews
BEGIN
    SELECT RAISE(ABORT, 'Las revisiones historicas son inmutables');
END;
CREATE TRIGGER IF NOT EXISTS lab_result_specimens_no_update BEFORE UPDATE ON lab_result_specimens
BEGIN
    SELECT RAISE(ABORT, 'Las muestras fuente publicadas son inmutables');
END;
CREATE TRIGGER IF NOT EXISTS lab_result_specimens_no_delete BEFORE DELETE ON lab_result_specimens
BEGIN
    SELECT RAISE(ABORT, 'Las muestras fuente publicadas son inmutables');
END;
CREATE TRIGGER IF NOT EXISTS lab_repeats_no_update BEFORE UPDATE ON lab_specimen_repeats
BEGIN
    SELECT RAISE(ABORT, 'Las solicitudes de repeticion son inmutables');
END;
CREATE TRIGGER IF NOT EXISTS lab_repeats_no_delete BEFORE DELETE ON lab_specimen_repeats
BEGIN
    SELECT RAISE(ABORT, 'Las solicitudes de repeticion son inmutables');
END;
CREATE TRIGGER IF NOT EXISTS lab_scope_no_update BEFORE UPDATE ON lab_followup_scope
BEGIN
    SELECT RAISE(ABORT, 'La instantanea al alta es inmutable');
END;
CREATE TRIGGER IF NOT EXISTS lab_scope_no_delete BEFORE DELETE ON lab_followup_scope
BEGIN
    SELECT RAISE(ABORT, 'La instantanea al alta es inmutable');
END;
CREATE TRIGGER IF NOT EXISTS lab_changes_no_update BEFORE UPDATE ON lab_changes
BEGIN
    SELECT RAISE(ABORT, 'La auditoria de laboratorio es inmutable');
END;
CREATE TRIGGER IF NOT EXISTS lab_changes_no_delete BEFORE DELETE ON lab_changes
BEGIN
    SELECT RAISE(ABORT, 'La auditoria de laboratorio es inmutable');
END;

INSERT OR IGNORE INTO lab_schema(version) VALUES (2);
