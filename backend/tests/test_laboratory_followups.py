"""Discharge/followup protocol on temporary databases and the isolated LAB app."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from uuid import uuid4

import pytest

from app import laboratory_followups, main
from test_laboratory_results import accounts, api, ready, assigned, staff, team, publish, action, analysis, order  # noqa: F401
from test_laboratory_samples import create, post, query, state, specimen
from test_laboratory_repeats import repeat, find
from test_staffing import grant


AUTO = object()


def plan():
    return {'review_due_at': (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
            'communication_plan': 'Contacto ficticio del equipo con el paciente', 'reason': 'Seguimiento ficticio al alta'}


def baseline(api):
    response = api.client.get(f"/episodes/{api.episode['id']}/lab-discharge", headers=api.lab)
    assert response.status_code == 200, response.text
    return response.json()


def close(api, followup=AUTO, auth=None, key=None, version=None, **changes):
    before = baseline(api)
    if followup is AUTO:
        if not hasattr(api, 'closing_plan'):
            api.closing_plan = plan()
        followup = api.closing_plan if before['pending_results'] else None
    response = post(api, f"/episodes/{api.episode['id']}/lab-discharge",
        {'note': 'Alta ficticia para seguimiento de laboratorio', 'followup': followup, **changes}, auth or api.doctor,
        version if version is not None else before['version'], key)
    if response.status_code == 200 and response.json()['lab_followups']:
        api.followup_id = response.json()['lab_followups'][0]['id']
    return response


def case(api, identifier=None):
    response = api.client.get(f"/lab/followups/{identifier or api.followup_id}", headers=api.lab)
    assert response.status_code == 200, response.text
    return response.json()


def follow_action(api, name, body=None, auth=None, key=None, version=None, identifier=None):
    current = case(api, identifier)
    return post(api, f"/lab/followups/{current['id']}/{name}", body or {}, auth or api.doctor,
                version if version is not None else current['version'], key)


def queue(api, **params):
    response = api.client.get('/lab/followups', headers=api.lab, params=params)
    assert response.status_code == 200
    return response.json()


def test_pending_discharge_requires_current_doctor_and_explicit_plan_and_freezes_scope(assigned):
    api = assigned
    assert close(api, auth=api.alternate).status_code == 403
    assert close(api, followup=None).status_code == 422
    assert api.original.get(f"/episodes/{api.episode['id']}", headers=api.lab).json()['status'] == 'ACTIVE'
    before_slots = [tuple(row) for row in query('SELECT * FROM care_slots')]
    closed = close(api)
    assert closed.status_code == 200, closed.text
    current = case(api)
    assert closed.json()['status'] == 'CLOSED' and current['owner_user_id'] == api.team[3]['id']
    assert current['pending_user_id'] is None and len(current['scope']) == 3
    assert current['pending_results'] == 3 and not current['requires_plan']
    assert all(item['discharge_snapshot']['pending_result'] for item in current['scope'])
    assert all(item['version_at_discharge'] is None for item in current['scope'])
    assert before_slots == [tuple(row) for row in query('SELECT * FROM care_slots')]
    assert queue(api)['total'] == 1
    mounted = api.original.get('/lab/followups', headers=api.lab)
    assert mounted.status_code == 200
    assert mounted.json() == queue(api)


def test_published_unreviewed_result_blocks_discharge_even_with_plan(assigned):
    api = assigned
    assert publish(api).status_code == 201
    assert close(api).status_code == 409
    assert not query('SELECT id FROM lab_followups')
    assert action(api, 'review', auth=api.doctor).status_code == 200
    assert close(api).status_code == 200
    reviewed = next(item for item in case(api)['scope'] if item['analysis_id'] == analysis(api)['id'])
    assert reviewed['discharge_snapshot']['pending_result'] is False
    assert reviewed['discharge_snapshot']['pending_medical_review'] is False


@pytest.mark.parametrize('change', [
    {'review_due_at': '2000-01-01T00:00:00+00:00'}, {'review_due_at': '2026-10-27T12:00:00'},
    {'communication_plan': ' '}, {'reason': ' '}, {'owner_user_id': 999},
])
def test_invalid_discharge_plan_does_not_close_episode_or_create_followup(assigned, change):
    api = assigned
    response = close(api, followup={**plan(), **change})
    assert response.status_code == 422, response.text
    assert baseline(api)['episode_status'] == 'ACTIVE' and not query('SELECT id FROM lab_followups')


def test_missing_responsible_or_legacy_orders_do_not_get_silently_adopted(ready):
    api = ready
    assert close(api).status_code == 409
    assert api.original.post(f"/episodes/{api.episode['id']}/tasks", headers=api.doctor,
        json={'title': 'Orden heredada ficticia', 'service': 'LAB'}).status_code == 201
    assert close(api).status_code == 409
    assert not query('SELECT id FROM lab_followups')


def test_pending_reevaluation_is_not_bypassed_by_lab_followup_plan(assigned):
    api = assigned
    clinical = api.original.get(f"/episodes/{api.episode['id']}", headers=api.doctor).json()
    scheduled = api.original.post(f"/episodes/{api.episode['id']}/reevaluations", headers={**api.doctor,
        'Idempotency-Key': str(uuid4()), 'If-Match': clinical['clinical_version']}, json={
        'title': 'Reevaluacion ficticia pendiente', 'medical_instruction': 'Comprobacion ficticia',
        'due_at': (datetime.now(timezone.utc)+timedelta(hours=1)).isoformat(), 'reason': 'Prueba ficticia'})
    assert scheduled.status_code == 201
    assert close(api).status_code == 409 and not query('SELECT id FROM lab_followups')


def test_laboratory_publishes_after_discharge_and_owner_reviews_until_resolved(assigned):
    api = assigned
    assert close(api).status_code == 200
    for index in range(3):
        assert publish(api, index).status_code == 201
        assert analysis(api, index)['medical_owner']['context'] == 'FOLLOWUP'
        assert action(api, 'review', index, auth=api.doctor).status_code == 200
        assert analysis(api, index)['current_version']['review']['responsibility_context'] == 'FOLLOWUP'
    assert case(api)['clinical_work_pending'] is False
    assert queue(api)['total'] == 0 and queue(api, include_resolved=True)['total'] == 1
    assert case(api)['communication_plan'] == api.closing_plan['communication_plan']
    assert query('SELECT COUNT(*) FROM lab_followup_scope')[0][0] == 3


def test_closed_sample_collection_receipt_and_repeat_stay_with_original_analyses(assigned):
    api = assigned
    source = specimen(api)
    query("UPDATE lab_specimens SET suitability='REJECTED',suitability_reason='Incidencia ficticia' WHERE id=?", (source['id'],))
    assert close(api).status_code == 200
    assert repeat(api, source['id'], source['analysis_ids'][:1]).status_code == 200
    new_id = order(api)['repeats'][0]['new_specimen_id']
    assert post(api, f'/lab/specimens/{new_id}/collection', {'collector_kind': 'USER', 'location': 'Lugar ficticio'},
                api.nurse, find(api, new_id)['version']).status_code == 200
    assert post(api, f'/lab/specimens/{new_id}/receipt', version=find(api, new_id)['version']).status_code == 200
    assert post(api, f'/lab/specimens/{new_id}/suitability', {'suitability': 'ACCEPTED'}, version=find(api, new_id)['version']).status_code == 200
    assert publish(api).status_code == 201
    assert api.client.post(f"/episodes/{api.episode['id']}/lab-orders", headers={**api.doctor,
        'Idempotency-Key': str(uuid4()), 'If-Match': baseline(api)['clinical_version']}, json={
        'title': 'Orden nueva fuera de alcance', 'reason': 'Prueba ficticia', 'analyses': [{'key': 'one', 'title': 'Otra analitica'}],
        'specimens': [{'key': 's', 'kind': 'BLOOD', 'analysis_keys': ['one']}]}).status_code == 409
    assert len(query('SELECT id FROM lab_analyses')) == 3


def test_discharge_without_pending_has_custody_and_late_correction_reappears_without_invented_deadline(assigned):
    api = assigned
    for index in range(3):
        assert publish(api, index).status_code == 201
        assert action(api, 'review', index, auth=api.doctor).status_code == 200
    assert close(api, followup=None).status_code == 200
    assert case(api)['review_due_at'] is None and case(api)['communication_plan'] is None
    assert queue(api)['total'] == 0
    assert action(api, 'corrections', result='Rectificacion ficticia posterior al alta').status_code == 200
    assert case(api)['requires_plan'] and case(api)['pending_reviews'] == 1
    assert queue(api)['total'] == 1
    assert action(api, 'review', auth=api.doctor).status_code == 200
    assert not case(api)['clinical_work_pending'] and queue(api)['total'] == 0
    assert case(api)['review_due_at'] is None


def test_another_doctor_can_close_resolved_case_without_taking_ownership(assigned):
    api = assigned
    for index in range(3):
        assert publish(api, index).status_code == 201
        assert action(api, 'review', index, auth=api.doctor).status_code == 200
    assert close(api, followup=None, auth=api.alternate).status_code == 200
    assert case(api)['owner_user_id'] == api.team[3]['id']


def test_cancelled_analysis_does_not_need_a_missing_result_but_scope_preserves_reason(assigned):
    api = assigned
    current = analysis(api)
    response = post(api, f"/lab/analyses/{current['id']}/cancel", {'reason': 'Cancelacion ficticia para prueba'}, api.doctor, current['version'])
    assert response.status_code == 200
    response = close(api)
    assert response.status_code == 200
    saved = next(item['discharge_snapshot'] for item in case(api)['scope'] if item['analysis_id'] == current['id'])
    assert saved['pending_result'] is False and saved['cancellation_reason'] == 'Cancelacion ficticia para prueba'
    assert case(api)['pending_results'] == 2


def test_handoff_keeps_previous_owner_until_acceptance_and_does_not_change_active_care_slots(assigned):
    api = assigned
    assert close(api).status_code == 200
    assert publish(api).status_code == 201
    frozen = analysis(api)['version']
    before = [tuple(row) for row in query('SELECT * FROM care_slots')]
    assert follow_action(api, 'propose', {'user_id': api.team[4]['id']}).status_code == 200
    assert case(api)['owner_user_id'] == api.team[3]['id']
    assert action(api, 'review', auth=api.alternate).status_code == 403
    assert action(api, 'review', auth=api.doctor, version=frozen).status_code == 409
    review_key, review_version = str(uuid4()), analysis(api)['version']
    assert action(api, 'review', auth=api.doctor, key=review_key, version=review_version).status_code == 200
    accept_key, accept_version = str(uuid4()), case(api)['version']
    assert follow_action(api, 'accept', auth=api.alternate, key=accept_key, version=accept_version).status_code == 200
    assert follow_action(api, 'accept', auth=api.alternate, key=accept_key, version=accept_version).status_code == 200
    assert action(api, 'review', auth=api.doctor, key=review_key, version=review_version).status_code == 403
    assert action(api, 'corrections', result='Correccion ficticia tras relevo').status_code == 200
    assert action(api, 'review', auth=api.alternate).status_code == 200
    assert before == [tuple(row) for row in query('SELECT * FROM care_slots')]
    assert follow_action(api, 'propose', {'user_id': api.team[3]['id']}, auth=api.alternate).status_code == 200
    assert follow_action(api, 'accept', auth=api.doctor).status_code == 200
    assert follow_action(api, 'accept', auth=api.alternate, key=accept_key, version=accept_version).status_code == 403


def test_recipient_declines_handoff_with_reason_and_can_replay_own_cancellation(assigned):
    api = assigned
    assert close(api).status_code == 200
    assert follow_action(api, 'propose', {'user_id': api.team[4]['id']}).status_code == 200
    key, version = str(uuid4()), case(api)['version']
    assert follow_action(api, 'cancel-handoff', auth=api.alternate, key=key, version=version).status_code == 200
    assert follow_action(api, 'cancel-handoff', auth=api.alternate, key=key, version=version).status_code == 200
    assert case(api)['owner_user_id'] == api.team[3]['id'] and case(api)['pending_user_id'] is None
    assert follow_action(api, 'accept', auth=api.alternate).status_code == 403


def test_coordinator_proposes_cover_for_inactive_owner_but_cannot_review_as_nurse(assigned):
    api = assigned
    assert close(api).status_code == 200
    query('UPDATE users SET active=0 WHERE id=?', (api.team[3]['id'],))
    assert case(api)['coverage_pending']
    assert follow_action(api, 'propose', {'user_id': api.team[4]['id']}, auth=api.alternate).status_code == 403
    listing = api.original.get('/accounts', headers=api.team[2]).json()
    nurse = next(item for item in listing['accounts'] if item['id'] == api.team[5]['id'])
    assert grant(api.original, api.team[2], nurse).status_code == 200
    coordinator = api.login(nurse['username'])
    assert follow_action(api, 'propose', {'user_id': api.team[4]['id']}, auth=coordinator).status_code == 200
    assert follow_action(api, 'accept', auth=api.alternate).status_code == 200
    assert not case(api)['coverage_pending']
    assert publish(api).status_code == 201
    assert action(api, 'review', auth=coordinator).status_code == 403
    assert action(api, 'review', auth=api.alternate).status_code == 200


def test_reopen_uses_active_care_owner_and_second_discharge_keeps_both_scopes(assigned):
    api = assigned
    assert close(api).status_code == 200
    first = api.followup_id
    assert follow_action(api, 'propose', {'user_id': api.team[4]['id']}).status_code == 200
    assert follow_action(api, 'accept', auth=api.alternate).status_code == 200
    assert publish(api).status_code == 201
    reopened = api.original.post(f"/episodes/{api.episode['id']}/reopen", headers={**api.doctor, 'Idempotency-Key': str(uuid4())},
        json={'reason': 'Reapertura ficticia para probar nuevo ciclo'})
    assert reopened.status_code == 200
    assert not case(api, first)['current_cycle'] and queue(api)['total'] == 0
    assert follow_action(api, 'plan', plan(), identifier=first).status_code == 409
    assert action(api, 'review', auth=api.alternate).status_code == 403
    assert action(api, 'review', auth=api.doctor).status_code == 200
    assert close(api).status_code == 200
    assert api.followup_id != first and case(api)['current_cycle']
    assert len(query('SELECT id FROM lab_followups')) == 2 and len(query('SELECT analysis_id FROM lab_followup_scope')) == 6
    assert queue(api)['total'] == 1


def test_closed_scope_does_not_authorize_a_new_analysis_inserted_outside_the_api(assigned):
    api = assigned
    assert close(api).status_code == 200
    order_id = order(api)['task_id']
    query("INSERT INTO lab_analyses(order_task_id,title) VALUES (?,'Fuera del alcance ficticio')", (order_id,))
    foreign = query('SELECT MAX(id) FROM lab_analyses')[0][0]
    query('INSERT INTO lab_analysis_specimens(order_task_id,analysis_id,specimen_id) VALUES (?,?,?)', (order_id, foreign, specimen(api)['id']))
    assert publish(api, 3).status_code == 409
    assert len(case(api)['scope']) == 3


def test_queue_permissions_pagination_and_clock_do_not_create_writes_or_change_versions(assigned):
    api = assigned
    assert close(api).status_code == 200
    for username, expected in (('medico', 200), ('enfermeria', 200), ('laboratorio', 200), ('supervisor', 200),
                               ('recepcion', 403), ('archivo', 403), ('admin.demo', 403)):
        auth = api.login() if username == 'admin.demo' else api.login(username, 'demo123')
        assert api.client.get('/lab/followups', headers=auth).status_code == expected
    assert queue(api, limit=1, offset=1)['items'] == []
    assert api.client.get('/lab/followups?limit=101', headers=api.lab).status_code == 422
    before_count = len(query('SELECT id FROM lab_changes'))
    connection = main.get_connection()
    try:
        due = datetime.fromisoformat(case(api)['review_due_at'])
        before = laboratory_followups.followup_state(connection, api.followup_id, due-timedelta(seconds=1))
        after = laboratory_followups.followup_state(connection, api.followup_id, due+timedelta(seconds=1))
        assert not before['overdue'] and after['overdue'] and before['version'] == after['version']
    finally:
        connection.close()
    assert len(query('SELECT id FROM lab_changes')) == before_count
    assert 'qr_token' not in str(queue(api))


def test_plan_updates_require_owner_and_keep_history_when_date_returns_to_previous_value(assigned):
    api = assigned
    assert close(api).status_code == 200
    before = case(api)
    assert follow_action(api, 'plan', plan(), auth=api.alternate).status_code == 403
    changed = plan()
    assert follow_action(api, 'plan', changed).status_code == 200
    assert follow_action(api, 'plan', {'review_due_at': before['review_due_at'], 'communication_plan': before['communication_plan'],
                                     'reason': 'Volver a fecha ficticia anterior'}).status_code == 200
    assert case(api)['version'] != before['version']
    assert follow_action(api, 'plan', plan(), version=before['version']).status_code == 409
    assert len(query("SELECT id FROM lab_changes WHERE action='PLAN'")) == 2


def test_discharge_receipt_replays_without_new_case_or_event(assigned):
    api, key = assigned, str(uuid4())
    before, fixed = baseline(api), plan()
    first = close(api, followup=fixed, key=key, version=before['version'])
    assert first.status_code == 200
    again = close(api, followup=fixed, key=key, version=before['version'])
    assert again.status_code == 200 and again.json() == first.json()
    assert len(query('SELECT id FROM lab_followups')) == len(query("SELECT id FROM events WHERE type='DISCHARGE'")) == 1


def test_concurrent_publication_and_discharge_cannot_hide_new_unreviewed_result(assigned):
    api, barrier = assigned, Barrier(2)
    discharge_version, result_version = baseline(api)['version'], analysis(api)['version']
    fixed = plan()
    def request(operation):
        barrier.wait()
        return (close(api, followup=fixed, version=discharge_version).status_code if operation == 'close'
                else publish(api, version=result_version).status_code)
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(request, ('close', 'publish')))
    assert sum(code in (200, 201) for code in outcomes) == 1 and outcomes.count(409) == 1
    if baseline(api)['episode_status'] == 'CLOSED':
        assert not query('SELECT id FROM lab_result_versions') and len(query('SELECT id FROM lab_followups')) == 1
    else:
        assert len(query('SELECT id FROM lab_result_versions')) == 1 and not query('SELECT id FROM lab_followups')


def test_discharge_audit_failure_rolls_back_closure_event_scope_and_plan(assigned, monkeypatch):
    api, key, fixed = assigned, str(uuid4()), plan()
    before = baseline(api)
    def fail(*args, **kwargs):
        raise RuntimeError('Fallo aislado de auditoria del alta')
    with monkeypatch.context() as patch:
        patch.setattr(laboratory_followups, 'audit', fail)
        assert close(api, followup=fixed, key=key, version=before['version']).status_code == 500
    assert baseline(api) == before and not query('SELECT id FROM lab_followups')
    assert not query("SELECT id FROM events WHERE type='DISCHARGE'")
    assert close(api, followup=fixed, key=key, version=before['version']).status_code == 200


def test_accept_failure_rolls_back_owner_and_proposal_and_allows_same_intent_retry(assigned, monkeypatch):
    api = assigned
    assert close(api).status_code == 200
    assert follow_action(api, 'propose', {'user_id': api.team[4]['id']}).status_code == 200
    before, key = case(api), str(uuid4())
    def fail(*args, **kwargs):
        raise RuntimeError('Fallo aislado de auditoria del relevo')
    with monkeypatch.context() as patch:
        patch.setattr(laboratory_followups, 'audit', fail)
        assert follow_action(api, 'accept', auth=api.alternate, key=key, version=before['version']).status_code == 500
    assert case(api) == before
    assert follow_action(api, 'accept', auth=api.alternate, key=key, version=before['version']).status_code == 200
