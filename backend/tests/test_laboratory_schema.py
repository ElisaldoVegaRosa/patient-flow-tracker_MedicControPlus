"""Storage rehearsal only; no LAB routes, clinical permissions or live database."""
import sqlite3

import pytest

from app.database import get_connection, initialize_database
from app.laboratory_schema import SCHEMA_VERSION, migrate_laboratory_schema


STAMP = "2026-10-27T16:00:00+00:00"


@pytest.fixture
def legacy(tmp_path):
    path = tmp_path / "isolated.sqlite3"
    initialize_database(get_connection(path), {}, lambda value: ("unused", "unused"), lambda: STAMP)
    connection = get_connection(path)
    for identifier, role in enumerate(("DOCTOR", "NURSE", "LAB"), 1):
        connection.execute("""INSERT INTO users(id,username,password_hash,password_salt,role,created_at)
            VALUES (?,?, 'synthetic-not-a-password','synthetic',?,?)""", (identifier, f"schema.demo{identifier}", role, STAMP))
    for identifier, status in ((1, "ACTIVE"), (2, "CLOSED")):
        connection.execute("INSERT INTO patients(id,name,birth_date,document) VALUES (?,?,?,?)",
                           (identifier, f"Paciente ficticio {identifier}", "1990-01-15", f"SCHEMA-{identifier}"))
        connection.execute("""INSERT INTO episodes(id,patient_id,qr_token,status,priority,location,started_at,closed_at)
            VALUES (?,?,?,?,3,'Lugar ficticio',?,?)""", (identifier, identifier, f"synthetic-qr-{identifier}", status,
                                                       STAMP, STAMP if status == "CLOSED" else None))
    for identifier, episode, service, status, result in (
        (1, 1, "LAB", "PENDING", None), (2, 2, "LAB", "COMPLETED", "Resultado historico ficticio"),
        (3, 1, "NURSING", "PENDING", None), (4, 2, "LAB", "PENDING", None),
    ):
        connection.execute("""INSERT INTO tasks(id,episode_id,title,service,status,result,created_at)
            VALUES (?,?,'Orden ficticia',?,?,?,?)""", (identifier, episode, service, status, result, STAMP))
    connection.execute("""INSERT INTO record_changes(episode_id,target_type,target_id,action,old_value,new_value,reason,username,created_at)
        VALUES (2,'TASK',2,'CORRECT','Original ficticio','Resultado historico ficticio','Motivo ficticio','schema.demo3',?)""", (STAMP,))
    connection.execute("""INSERT INTO events(id,episode_id,type,username,created_at,note)
        VALUES (1,2,'DISCHARGE','schema.demo1',?,'Alta ficticia')""", (STAMP,))
    connection.commit()
    yield connection
    connection.close()


def snapshot(connection):
    return {row[0]: (row[1], [tuple(item) for item in connection.execute(f'SELECT * FROM "{row[0]}" ORDER BY rowid')])
            for row in connection.execute("SELECT name,sql FROM sqlite_master WHERE type='table'")}


def schema(connection):
    return [tuple(row) for row in connection.execute("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY name")]


def add_order(connection, task=1, episode=1):
    connection.execute("INSERT INTO lab_orders(task_id,episode_id,created_by,created_at) VALUES (?,?,1,?)", (task, episode, STAMP))


def add_analysis(connection, task=1, title="Analitica ficticia"):
    return connection.execute("INSERT INTO lab_analyses(order_task_id,title) VALUES (?,?)", (task, title)).lastrowid


def add_specimen(connection, task=1, kind="BLOOD", **values):
    values = {"order_task_id": task, "kind": kind, **values}
    columns = ",".join(values)
    return connection.execute(f"INSERT INTO lab_specimens({columns}) VALUES ({','.join('?' for _ in values)})", tuple(values.values())).lastrowid


def link(connection, analysis, specimen, task=1):
    connection.execute("INSERT INTO lab_analysis_specimens(order_task_id,analysis_id,specimen_id) VALUES (?,?,?)", (task, analysis, specimen))


def publish(connection, analysis, sequence=1, previous=None, action="PUBLISH", task=1):
    return connection.execute("""INSERT INTO lab_result_versions(order_task_id,analysis_id,sequence,action,
        previous_version_id,result,reason,published_by,published_at) VALUES (?,?,?,?,?,?,'Motivo ficticio',3,?)""",
        (task, analysis, sequence, action, previous, None if action == "ANNUL" else f"Resultado ficticio {sequence}", STAMP)).lastrowid


def review(connection, version):
    connection.execute("""INSERT INTO lab_result_reviews(result_version_id,reviewed_by,reviewed_at,responsibility_context,owner_revision)
        VALUES (?,1,?,'ACTIVE_EPISODE',0)""", (version, STAMP))


def repeat(connection, analysis, previous, new):
    connection.execute("""INSERT INTO lab_specimen_repeats(order_task_id,analysis_id,previous_specimen_id,new_specimen_id,
        requested_by,requested_at,reason) VALUES (1,?,?,?,3,?,'Muestra no apta ficticia')""", (analysis, previous, new, STAMP))


def followup(connection, event=1):
    return connection.execute("""INSERT INTO lab_followups(episode_id,discharge_event_id,owner_user_id,review_due_at,
        communication_plan,reason,created_by,created_at) VALUES (2,?,1,?,'Comunicacion ficticia','Motivo ficticio',1,?)""",
        (event, STAMP, STAMP)).lastrowid


@pytest.fixture
def model(legacy):
    migrate_laboratory_schema(legacy)
    add_order(legacy)
    add_order(legacy, 2, 2)
    yield legacy


def test_additive_repeatable_migration_preserves_all_legacy_rows_and_no_inferred_facts(legacy):
    before = snapshot(legacy)
    assert not any(name.startswith("lab_") for name in before)
    migrate_laboratory_schema(legacy)
    first_schema = schema(legacy)
    migrate_laboratory_schema(legacy)
    assert schema(legacy) == first_schema
    after = snapshot(legacy)
    assert {name: after[name] for name in before} == before
    new_tables = {name for name in after if name not in before}
    assert len(new_tables) == 12
    assert all(after[name][1] == ([] if name != "lab_schema" else [(SCHEMA_VERSION,)]) for name in new_tables)
    assert legacy.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    assert not legacy.execute("PRAGMA foreign_key_check").fetchall()


def test_failure_late_in_ddl_rolls_back_tables_triggers_indexes_and_keeps_old_data(legacy):
    before, old_schema = snapshot(legacy), schema(legacy)
    legacy.set_authorizer(lambda action, name, *args:
        sqlite3.SQLITE_DENY if action == sqlite3.SQLITE_CREATE_INDEX and name == "idx_lab_changes_episode" else sqlite3.SQLITE_OK)
    with pytest.raises(sqlite3.DatabaseError, match="authorized"):
        migrate_laboratory_schema(legacy)
    legacy.set_authorizer(None)
    assert not legacy.in_transaction
    assert schema(legacy) == old_schema and snapshot(legacy) == before
    migrate_laboratory_schema(legacy)  # Same input succeeds once the injected failure is removed.


def test_migration_does_not_commit_callers_transaction_or_enable_foreign_keys_silently(legacy):
    legacy.execute("UPDATE tasks SET title='Borrador ficticio' WHERE id=1")
    with pytest.raises(ValueError, match="transaccion activa"):
        migrate_laboratory_schema(legacy)
    assert legacy.in_transaction
    legacy.rollback()
    assert legacy.execute("SELECT title FROM tasks WHERE id=1").fetchone()[0] == "Orden ficticia"
    legacy.execute("PRAGMA foreign_keys=OFF")
    with pytest.raises(ValueError, match="referencias externas"):
        migrate_laboratory_schema(legacy)
    assert not any(name.startswith("lab_") for name in snapshot(legacy))


@pytest.mark.parametrize('unsupported', [1, 999])
def test_unknown_schema_version_is_rejected_without_modification(legacy, unsupported):
    legacy.execute("CREATE TABLE lab_schema(version INTEGER PRIMARY KEY)")
    legacy.execute("INSERT INTO lab_schema VALUES(?)", (unsupported,))
    legacy.commit()
    before = schema(legacy)
    with pytest.raises(ValueError, match="no compatible"):
        migrate_laboratory_schema(legacy)
    assert schema(legacy) == before
    assert legacy.execute("SELECT version FROM lab_schema").fetchone()[0] == unsupported


def test_orders_require_lab_task_and_correct_episode_and_cannot_be_reassigned(model):
    for sql in (
        "INSERT INTO lab_orders VALUES (3,1,1,'fecha',0)",
        "INSERT INTO lab_orders VALUES (4,1,1,'fecha',0)",
        "UPDATE lab_orders SET episode_id=2 WHERE task_id=1",
        "UPDATE tasks SET service='NURSING' WHERE id=1",
        "UPDATE tasks SET episode_id=2 WHERE id=1",
    ):
        with pytest.raises(sqlite3.IntegrityError):
            model.execute(sql)


def test_many_analyses_and_specimens_with_independent_receipt_and_cross_order_guards(model):
    first, second, foreign = add_analysis(model), add_analysis(model), add_analysis(model, 2)
    blood, urine, foreign_specimen = add_specimen(model), add_specimen(model, kind="URINE"), add_specimen(model, 2)
    link(model, first, blood)
    link(model, second, blood)
    link(model, second, urine)
    for analysis, specimen, task in ((first, foreign_specimen, 1), (foreign, blood, 2), (first, blood, 2)):
        with pytest.raises(sqlite3.IntegrityError):
            link(model, analysis, specimen, task)
    model.execute("UPDATE lab_specimens SET received_at=?,received_by=3 WHERE id=?", (STAMP, blood))
    untouched = model.execute("SELECT received_at,suitability FROM lab_specimens WHERE id=?", (urine,)).fetchone()
    assert tuple(untouched) == (None, "UNKNOWN")
    assert model.execute("SELECT status FROM tasks WHERE id=1").fetchone()[0] == "PENDING"
    assert model.execute("SELECT COUNT(*) FROM lab_result_versions").fetchone()[0] == 0


@pytest.mark.parametrize("values", [
    {"kind": "OTHER"}, {"kind": "FECAL_URINE"}, {"received_by": 3},
    {"collected_at": STAMP, "collection_location": "Cama", "collector_kind": "USER"},
    {"collector_user_id": 2}, {"collected_at": STAMP, "collection_location": " ", "collector_kind": "PATIENT"},
    {"delivered_at": STAMP, "deliverer_kind": "USER"},
    {"delivered_at": STAMP, "deliverer_kind": "PATIENT", "deliverer_user_id": 2},
    {"suitability": "ACCEPTED", "assessed_at": STAMP, "assessed_by": 3},
    {"received_at": STAMP, "received_by": 3, "suitability": "REJECTED", "assessed_at": STAMP, "assessed_by": 3},
    {"received_at": STAMP, "received_by": 3, "suitability": "REJECTED", "assessed_at": STAMP, "assessed_by": 3, "suitability_reason": " "},
    {"revision": -1},
])
def test_incomplete_sample_facts_and_missing_rejection_reason_are_rejected(model, values):
    with pytest.raises(sqlite3.IntegrityError):
        add_specimen(model, **values)


def test_patient_collection_does_not_require_patient_account_or_infer_receipt(model):
    specimen = add_specimen(model, kind="STOOL", collected_at=STAMP, collection_location="Lugar ficticio",
                            collector_kind="PATIENT", delivered_at=STAMP, deliverer_kind="PATIENT")
    row = model.execute("SELECT collector_user_id,deliverer_user_id,received_at,suitability FROM lab_specimens WHERE id=?", (specimen,)).fetchone()
    assert tuple(row) == (None, None, None, "UNKNOWN")


def test_repeat_is_per_analysis_keeps_old_sample_and_rejects_cycles_and_unrelated_samples(model):
    first, second = add_analysis(model), add_analysis(model)
    old, new, third, unrelated = [add_specimen(model) for _ in range(4)]
    for specimen in (old, new, third):
        link(model, first, specimen)
    link(model, second, old)
    repeat(model, first, old, new)
    repeat(model, first, new, third)
    for parent, child in ((third, old), (new, new), (old, unrelated), (old, new)):
        with pytest.raises(sqlite3.IntegrityError):
            repeat(model, first, parent, child)
    assert model.execute("SELECT COUNT(*) FROM lab_specimen_repeats WHERE analysis_id=?", (second,)).fetchone()[0] == 0
    assert model.execute("SELECT COUNT(*) FROM lab_specimens").fetchone()[0] == 4


def test_results_are_per_analysis_versions_and_corrections_do_not_inherit_review(model):
    analysis, pending = add_analysis(model), add_analysis(model)
    sample = add_specimen(model)
    link(model, analysis, sample)
    first = publish(model, analysis)
    model.execute("INSERT INTO lab_result_specimens VALUES (?,?,?,?)", (first, 1, analysis, sample))
    review(model, first)
    correction = publish(model, analysis, 2, first, "CORRECT")
    assert model.execute("SELECT result FROM lab_result_versions WHERE id=?", (first,)).fetchone()[0] == "Resultado ficticio 1"
    assert model.execute("SELECT result_version_id FROM lab_result_reviews").fetchone()[0] == first
    assert model.execute("SELECT COUNT(*) FROM lab_result_reviews WHERE result_version_id=?", (correction,)).fetchone()[0] == 0
    assert model.execute("SELECT COUNT(*) FROM lab_result_versions WHERE analysis_id=?", (pending,)).fetchone()[0] == 0
    with pytest.raises(sqlite3.IntegrityError):
        review(model, first)
    review(model, correction)
    annulment = publish(model, analysis, 3, correction, "ANNUL")
    with pytest.raises(sqlite3.IntegrityError):
        review(model, annulment)
    with pytest.raises(sqlite3.IntegrityError):
        publish(model, analysis, 4, first, "CORRECT")


def test_result_predecessor_and_source_cannot_belong_to_other_analysis_or_patient(model):
    first, second, foreign = add_analysis(model), add_analysis(model), add_analysis(model, 2)
    source, foreign_source = add_specimen(model), add_specimen(model, 2)
    link(model, first, source)
    link(model, foreign, foreign_source, 2)
    version = publish(model, first)
    with pytest.raises(sqlite3.IntegrityError):
        publish(model, second, 2, version, "CORRECT")
    with pytest.raises(sqlite3.IntegrityError):
        publish(model, foreign, 2, version, "CORRECT", task=2)
    with pytest.raises(sqlite3.IntegrityError):
        model.execute("INSERT INTO lab_result_specimens VALUES (?,?,?,?)", (version, 1, first, foreign_source))


def test_followup_scope_stays_with_same_episode_and_preserves_repeated_discharges(model):
    local, foreign = add_analysis(model, 2), add_analysis(model)
    plan = followup(model)
    model.execute("INSERT INTO lab_followup_scope(followup_id,episode_id,order_task_id,analysis_id,version_at_discharge) VALUES (?,?,?,?,NULL)", (plan, 2, 2, local))
    with pytest.raises(sqlite3.IntegrityError):
        model.execute("INSERT INTO lab_followup_scope(followup_id,episode_id,order_task_id,analysis_id,version_at_discharge) VALUES (?,?,?,?,NULL)", (plan, 2, 1, foreign))
    with pytest.raises(sqlite3.IntegrityError):
        model.execute("INSERT INTO lab_followup_scope(followup_id,episode_id,order_task_id,analysis_id,version_at_discharge) VALUES (?,?,?,?,NULL)", (plan, 1, 1, foreign))
    model.execute("INSERT INTO events(id,episode_id,type,username,created_at) VALUES (2,1,'DISCHARGE','schema.demo1',?)", (STAMP,))
    with pytest.raises(sqlite3.IntegrityError):
        followup(model, 2)
    model.execute("INSERT INTO events(id,episode_id,type,username,created_at) VALUES (3,2,'DISCHARGE','schema.demo1',?)", (STAMP,))
    later_plan = followup(model, 3)
    model.execute("INSERT INTO lab_followup_scope(followup_id,episode_id,order_task_id,analysis_id,version_at_discharge) VALUES (?,?,?,?,NULL)", (later_plan, 2, 2, local))
    assert model.execute("SELECT COUNT(*) FROM lab_followup_scope").fetchone()[0] == 2
    assert not model.execute("PRAGMA foreign_key_check").fetchall()


@pytest.mark.parametrize("table", ["lab_result_versions", "lab_result_reviews", "lab_result_specimens", "lab_specimen_repeats", "lab_followup_scope", "lab_changes"])
@pytest.mark.parametrize("operation", ["UPDATE", "DELETE"])
def test_published_history_cannot_be_overwritten_or_deleted(model, table, operation):
    analysis = add_analysis(model)
    old, new = add_specimen(model), add_specimen(model)
    link(model, analysis, old)
    link(model, analysis, new)
    repeat(model, analysis, old, new)
    version = publish(model, analysis)
    model.execute("INSERT INTO lab_result_specimens VALUES (?,?,?,?)", (version, 1, analysis, old))
    review(model, version)
    plan = followup(model)
    other = add_analysis(model, 2)
    model.execute("INSERT INTO lab_followup_scope(followup_id,episode_id,order_task_id,analysis_id,version_at_discharge) VALUES (?,?,?,?,NULL)", (plan, 2, 2, other))
    model.execute("""INSERT INTO lab_changes(episode_id,order_task_id,resource_type,resource_id,action,actor_user_id,
        created_at,reason,old_value,new_value) VALUES (1,1,'SPECIMEN',1,'CREATE',3,?,'Motivo ficticio','null','{}')""", (STAMP,))
    column = {"lab_followup_scope": "followup_id", "lab_result_specimens": "result_version_id"}.get(table, "id")
    sql = f"UPDATE {table} SET {column}={column}" if operation == "UPDATE" else f"DELETE FROM {table}"
    with pytest.raises(sqlite3.IntegrityError, match="inmutabl"):
        model.execute(sql)


def test_superseded_unreviewed_version_and_frozen_sources_cannot_be_acknowledged_or_extended(model):
    analysis = add_analysis(model)
    old, new = add_specimen(model), add_specimen(model)
    link(model, analysis, old)
    link(model, analysis, new)
    version = publish(model, analysis)
    model.execute("INSERT INTO lab_result_specimens VALUES (?,?,?,?)", (version, 1, analysis, old))
    correction = publish(model, analysis, 2, version, "CORRECT")
    with pytest.raises(sqlite3.IntegrityError, match="vigente"):
        review(model, version)
    with pytest.raises(sqlite3.IntegrityError, match="sustituida"):
        model.execute("INSERT INTO lab_result_specimens VALUES (?,?,?,?)", (version, 1, analysis, new))
    model.execute("INSERT INTO lab_result_specimens VALUES (?,?,?,?)", (correction, 1, analysis, new))
    review(model, correction)
    with pytest.raises(sqlite3.IntegrityError, match="revisada"):
        model.execute("INSERT INTO lab_result_specimens VALUES (?,?,?,?)", (correction, 1, analysis, old))


def test_schema_does_not_claim_to_enforce_clinical_roles_or_enable_routes(model):
    # Storage accepts closed-episode data; future API must authorize each action
    # and require an accepted followup. No storage test claims those permissions.
    analysis = add_analysis(model, 2)
    publish(model, analysis, task=2)
    row = model.execute("SELECT status,result FROM tasks WHERE id=2").fetchone()
    assert tuple(row) == ("COMPLETED", "Resultado historico ficticio")


def test_migrated_snapshot_restores_with_version_history_reviews_and_pending_samples(model, tmp_path):
    analysis = add_analysis(model)
    specimen = add_specimen(model)
    link(model, analysis, specimen)
    original = publish(model, analysis)
    review(model, original)
    correction = publish(model, analysis, 2, original, "CORRECT")
    model.commit()
    before, definitions = snapshot(model), schema(model)
    destination = get_connection(tmp_path / "restored.sqlite3")
    try:
        model.backup(destination)
        assert snapshot(destination) == before and schema(destination) == definitions
        assert destination.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        assert not destination.execute("PRAGMA foreign_key_check").fetchall()
        assert destination.execute("SELECT COUNT(*) FROM lab_result_reviews WHERE result_version_id=?", (correction,)).fetchone()[0] == 0
        assert destination.execute("SELECT received_at FROM lab_specimens WHERE id=?", (specimen,)).fetchone()[0] is None
        migrate_laboratory_schema(destination)
        assert snapshot(destination) == before
    finally:
        destination.close()


def test_custody_without_pending_has_no_invented_deadline_but_partial_plan_is_rejected(model):
    model.execute('''INSERT INTO lab_followups(episode_id,discharge_event_id,owner_user_id,reason,created_by,created_at)
        VALUES (2,1,1,'Custodia ficticia',1,?)''', (STAMP,))
    row = model.execute('SELECT review_due_at,communication_plan FROM lab_followups').fetchone()
    assert tuple(row) == (None, None)
    for due, communication in ((STAMP, None), (None, 'Plan ficticio'), ('', 'Plan ficticio'), (STAMP, ' ')):
        with pytest.raises(sqlite3.IntegrityError):
            model.execute('UPDATE lab_followups SET review_due_at=?,communication_plan=?', (due, communication))


def test_discharge_snapshot_is_valid_json_and_remains_immutable(model):
    case_id = followup(model)
    analysis = add_analysis(model, 2)
    with pytest.raises(sqlite3.IntegrityError):
        model.execute('''INSERT INTO lab_followup_scope(followup_id,episode_id,order_task_id,analysis_id,discharge_snapshot)
            VALUES (?,2,2,?,'not json')''', (case_id, analysis))
    model.execute('''INSERT INTO lab_followup_scope(followup_id,episode_id,order_task_id,analysis_id,discharge_snapshot)
        VALUES (?,2,2,?,'{"pending_result":true}')''', (case_id, analysis))
    with pytest.raises(sqlite3.IntegrityError):
        model.execute("UPDATE lab_followup_scope SET discharge_snapshot='{}'")
