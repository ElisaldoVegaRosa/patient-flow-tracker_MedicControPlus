"""Production queue filters derive analytical work without rewriting carrier tasks."""
import json

from app import main
from app.laboratory_queue import read
from test_laboratory_schema import legacy  # noqa: F401
from test_laboratory_results import (  # noqa: F401
    accounts, api, ready, assigned, staff, team, publish, action, order,
)
from test_laboratory_samples import create, query, specimen
from test_laboratory_cancellations import medical
from test_laboratory_followups import close
from test_laboratory_repeats import repeat


def queue(api, status='ALL', auth=None):
    response = api.original.get('/lab/orders', headers=auth or api.lab, params={'status': status})
    assert response.status_code == 200, response.text
    return response.json()


def test_queue_distinguishes_legacy_and_structured_preserves_roles_and_minimal_fields(api):
    assert create(api).status_code == 201
    for service in ('LAB', 'NURSING'):
        assert api.original.post(f"/episodes/{api.episode['id']}/tasks", headers=api.doctor,
            json={'title': 'Orden ficticia anterior', 'service': service}).status_code == 201
    result = queue(api)
    assert result['total'] == 2
    assert [item['workflow'] for item in result['orders']] == ['LEGACY', 'STRUCTURED']
    for item in result['orders']:
        assert item['service'] == 'LAB'
    assert queue(api, auth=api.login('supervisor', 'demo123'))['orders'] == result['orders']
    for auth in [api.doctor, api.nurse, api.login('recepcion', 'demo123')]:
        assert api.original.get('/lab/orders', headers=auth).status_code == 403
    assert api.original.get('/lab/orders').status_code == 401
    for field in ('qr_token', 'birth_date', 'document', 'communication_plan', 'password_hash', 'collector_user_id', 'medical_owner'):
        assert f'"{field}"' not in json.dumps(result)
    assert api.original.get('/lab/orders?status=INVALID', headers=api.lab).status_code == 422


def test_partial_complete_and_review_filters_follow_analyses_not_task_status(assigned):
    api = assigned
    first = queue(api, 'PENDING')['orders'][0]
    assert publish(api).status_code == 201
    partial = queue(api, 'PENDING')['orders'][0]
    assert partial['laboratory']['status'] == 'PARTIAL'
    assert (partial['laboratory']['pending_results'], partial['laboratory']['pending_reviews']) == (2, 1)
    assert partial['version'] != first['version']
    assert queue(api, 'COMPLETED')['total'] == 0
    for index in (1, 2):
        assert publish(api, index).status_code == 201
    complete = queue(api, 'COMPLETED')['orders'][0]
    assert complete['status'] == 'PENDING' and complete['result'] is None
    assert complete['laboratory']['status'] == 'COMPLETED'
    assert complete['laboratory']['pending_reviews'] == 3
    assert queue(api, 'PENDING')['total'] == 0
    assert action(api, 'review', auth=api.doctor).status_code == 200
    assert queue(api, 'COMPLETED')['orders'][0]['laboratory']['pending_reviews'] == 2
    before = [tuple(row) for row in query('SELECT * FROM lab_changes')]
    assert queue(api) == queue(api)
    assert [tuple(row) for row in query('SELECT * FROM lab_changes')] == before


def test_cancelled_and_finalized_with_cancellations_are_terminal_but_reports_remain_visible(assigned):
    api = assigned
    assert medical(api, 'cancel', 2, reason='Analitica ficticia cancelada').status_code == 200
    for index in (0, 1):
        assert publish(api, index).status_code == 201
    item = queue(api, 'COMPLETED')['orders'][0]
    assert item['laboratory']['status'] == 'COMPLETED_WITH_CANCELLATIONS'
    assert item['laboratory']['pending_reviews'] == 2
    assert item['laboratory']['analyses'][2]['cancellation_reason'] == 'Analitica ficticia cancelada'
    assert queue(api, 'PENDING')['total'] == 0


def test_all_cancelled_is_terminal_without_inventing_a_result(assigned):
    api = assigned
    for index in range(3):
        assert medical(api, 'cancel', index).status_code == 200
    result = queue(api, 'COMPLETED')['orders'][0]['laboratory']
    assert result['status'] == 'CANCELLED' and result['published_results'] == 0
    assert all(not item['has_result'] and item['current_result'] is None for item in result['analyses'])
    assert queue(api, 'PENDING')['total'] == 0


def test_annulled_report_returns_order_to_pending_and_preserves_explicit_annulment(ready):
    api = ready
    for index in range(3):
        assert publish(api, index).status_code == 201
    assert action(api, 'annul').status_code == 200
    result = queue(api, 'PENDING')['orders'][0]['laboratory']
    assert result['status'] == 'PARTIAL' and result['pending_results'] == 1
    assert result['analyses'][0]['result_annulled'] and result['analyses'][0]['current_result'] is None
    assert queue(api, 'COMPLETED')['total'] == 0


def test_replacement_requires_new_work_even_with_a_preserved_report(ready):
    api = ready
    for index in range(3):
        assert publish(api, index).status_code == 201
    source = specimen(api)
    # Reproduce a recorded rejection; classification must not trust the old report.
    query("UPDATE lab_specimens SET suitability='REJECTED',suitability_reason='Incidencia ficticia' WHERE id=?", (source['id'],))
    assert repeat(api, source['id'], [source['analysis_ids'][0]]).status_code == 200
    result = queue(api, 'PENDING')['orders'][0]['laboratory']
    assert result['published_results'] == 3 and result['pending_results'] > 0
    assert result['analyses'][0]['has_result'] and not result['analyses'][0]['satisfies_current_samples']
    assert len(result['specimens']) == 3


def test_closed_pending_uses_current_followup_scope_and_annulled_episode_is_excluded(assigned):
    api = assigned
    assert close(api).status_code == 200
    item = queue(api, 'PENDING')['orders'][0]
    assert item['episode_status'] == 'CLOSED'
    assert item['laboratory']['processing_context'] == 'FOLLOWUP'
    assert publish(api).status_code == 201
    assert queue(api, 'PENDING')['orders'][0]['laboratory']['published_results'] == 1
    query("UPDATE episodes SET status='ANNULLED' WHERE id=?", (api.episode['id'],))
    assert queue(api)['total'] == 0


def test_closed_without_custody_is_consultation_only_and_incomplete_schema_rejects(api):
    assert create(api).status_code == 201
    query("UPDATE episodes SET status='CLOSED' WHERE id=?", (api.episode['id'],))
    assert queue(api)['orders'][0]['laboratory']['processing_context'] == 'UNAVAILABLE'
    connection = main.get_connection()
    try:
        connection.execute('DROP TABLE lab_changes')
        connection.commit()
    finally:
        connection.close()
    assert api.original.get('/lab/orders', headers=api.lab).status_code == 409


def test_legacy_annulled_results_are_in_the_terminal_filter_without_adoption(legacy):
    legacy.execute("UPDATE tasks SET status='ANNULLED',result=NULL WHERE id=2")
    completed = read(legacy, 'COMPLETED', 'laboratorio')
    assert [item['id'] for item in completed['orders']] == [2]
    assert completed['orders'][0]['workflow'] == 'LEGACY'
    assert 'laboratory' not in completed['orders'][0]
    assert 2 not in [item['id'] for item in read(legacy, 'PENDING', 'laboratorio')['orders']]
