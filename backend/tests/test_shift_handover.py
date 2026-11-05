import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.shift_handover import read
from app.routes.care import create_router
from test_operational_delays import connection, laboratory, accept, NOW  # noqa: F401
from app.laboratory_results import order_results


def test_summary_is_read_only_bounded_and_excludes_closed(connection):
    c = connection
    c.execute("INSERT INTO tasks(episode_id,title,service,status,created_at) VALUES (1,'Demo','LAB','PENDING',?)", (NOW,))
    statements = []
    c.set_trace_callback(statements.append)
    before = c.total_changes
    p = read(c, NOW, 'demo')['patients'][0]
    assert p['legacy_lab_orders'] == 1 and p['owners'] == []
    count = len(statements)
    for i in range(2, 30):
        c.execute("INSERT INTO episodes(patient_id,qr_token,status,priority,location,started_at) VALUES (1,?,'ACTIVE',3,'Espera',?)", (str(i), NOW))
    statements.clear()
    read(c, NOW, 'demo')
    assert len(statements) == count
    assert before == c.total_changes - 28
    c.execute("UPDATE episodes SET status='CLOSED'")
    assert read(c, NOW, 'demo')['patients'] == []


def test_structured_counts_match_canonical_model_after_correction_and_annulment(connection):
    c = connection
    laboratory(c)
    accept(c)
    c.execute("""INSERT INTO lab_result_versions(id,order_task_id,analysis_id,sequence,action,result,reason,published_by,published_at)
        VALUES (1,1,1,1,'PUBLISH','Resultado demo','Publicacion demo',2,?)""", (NOW,))
    c.execute('INSERT INTO lab_result_specimens(result_version_id,order_task_id,analysis_id,specimen_id) VALUES (1,1,1,1)')
    def compare():
        a = order_results(c, 1)
        before = c.total_changes
        p = read(c, NOW, 'demo')['patients'][0]
        assert c.total_changes == before
        assert p['lab_results'] == a['pending_results']
        assert p['lab_reviews'] == a['pending_reviews']
        assert p['legacy_lab_orders'] == 0
    compare()
    c.execute("INSERT INTO lab_result_reviews(result_version_id,reviewed_by,reviewed_at,responsibility_context,owner_revision) VALUES (1,1,?,'ACTIVE_EPISODE',0)", (NOW,))
    compare()
    c.execute("""INSERT INTO lab_result_versions(id,order_task_id,analysis_id,sequence,action,previous_version_id,result,reason,published_by,published_at)
        VALUES (2,1,1,2,'CORRECT',1,'Resultado corregido','Correccion demo',2,?)""", (NOW,))
    c.execute('INSERT INTO lab_result_specimens(result_version_id,order_task_id,analysis_id,specimen_id) VALUES (2,1,1,1)')
    compare()
    c.execute("""INSERT INTO lab_result_versions(id,order_task_id,analysis_id,sequence,action,previous_version_id,result,reason,published_by,published_at)
        VALUES (3,1,1,3,'ANNUL',2,NULL,'Anulacion demo',2,?)""", (NOW,))
    compare()


@pytest.mark.parametrize('role,coordinate,allowed', [('DOCTOR',False,True),('NURSE',False,True),('SUPERVISOR',False,False),('RECEPTION',False,False),('LAB',False,False),('LAB',True,True),('ACCOUNT_ADMIN',False,False)])
def test_endpoint_permissions(connection, role, coordinate, allowed):
    router = create_router(lambda: connection, lambda: NOW, lambda: {})
    endpoint = next(r.endpoint for r in router.routes if r.path == '/care/handover')
    user = {'username': 'demo', 'role': role, 'can_coordinate': coordinate}
    if allowed:
        assert endpoint(user)['requested_by'] == 'demo'
    else:
        with pytest.raises(HTTPException) as error:
            endpoint(user)
        assert error.value.status_code == 403


def test_retained_owner_proposal_reevaluation_and_alerts(connection):
    c = connection
    c.execute("INSERT INTO care_episodes(episode_id,ready_at) VALUES (1,?)", (NOW,))
    c.execute("INSERT INTO care_slots(episode_id,discipline,user_id,pending_user_id) VALUES (1,'DOCTOR',1,2)")
    c.execute("INSERT INTO tasks(id,episode_id,title,service,status,created_at) VALUES (1,1,'Reevaluacion demo','MEDICAL','PENDING',?)", (NOW,))
    c.execute("INSERT INTO reevaluation_groups(id,episode_id,title,created_by,created_at) VALUES (1,1,'Grupo demo','demo',?)", (NOW,))
    c.execute("INSERT INTO reevaluation_actions(task_id,group_id,due_at) VALUES (1,1,?)", (NOW,))
    c.execute("INSERT INTO alerts(episode_id,reason,severity,status,created_at,updated_at) VALUES (1,'Demo','HIGH','ACTIVE',?,?)", (NOW,NOW))
    c.execute("INSERT INTO alerts(episode_id,reason,severity,status,created_at,updated_at) VALUES (1,'Resuelta','HIGH','RESOLVED',?,?)", (NOW,NOW))
    before = c.total_changes
    p = read(c, NOW, 'demo')['patients'][0]
    assert c.total_changes == before
    assert p['owners'][0]['username'] == 'profesional.1'
    assert p['owners'][0]['proposed_username'] == 'profesional.2'
    assert p['tasks'] == {'MEDICAL': 1, 'NURSING': 0}
    assert p['reevaluations'][0]['due_at'] == NOW
    assert p['open_alerts'] == 1
