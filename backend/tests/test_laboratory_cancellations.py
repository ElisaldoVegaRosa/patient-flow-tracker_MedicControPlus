"""Medical cancellation stops pending work without suppressing report review."""
from concurrent.futures import ThreadPoolExecutor
import json
from threading import Barrier
from uuid import uuid4

import pytest

from app import laboratory_samples
from test_laboratory_results import accounts, api, ready, assigned, staff, team, analysis, order, publish, action  # noqa: F401
from test_laboratory_samples import post, query, specimen, state
from test_laboratory_repeats import repeat
from test_laboratory_followups import close, case, plan, follow_action, queue


def medical(api, name, index=0, auth=None, key=None, version=None, **body):
    current = analysis(api, index)
    return post(api, f"/lab/analyses/{current['id']}/{name}", body, auth or api.doctor,
                version if version is not None else current['version'], key)


def test_mixed_order_finalizes_only_when_remaining_analyses_have_results_and_keeps_reasons(assigned):
    api = assigned
    physical = [tuple(row) for row in query('SELECT * FROM lab_specimens')]
    assert medical(api, 'cancel', 2, reason='Analitica ficticia ya no requerida').status_code == 200
    cancelled = analysis(api, 2)
    assert cancelled['cancelled_by'] == api.team[3]['id'] and cancelled['cancelled_at']
    assert order(api)['laboratory_status'] == 'PENDING' and order(api)['pending_results'] == 2
    assert publish(api).status_code == 201
    assert order(api)['laboratory_status'] == 'PARTIAL'
    assert publish(api, 1).status_code == 201
    assert order(api)['laboratory_status'] == 'COMPLETED_WITH_CANCELLATIONS'
    assert order(api)['pending_results'] == 0 and order(api)['pending_reviews'] == 2
    assert close(api, followup=None).status_code == 409
    for index in (0, 1):
        assert action(api, 'review', index, auth=api.doctor).status_code == 200
    assert close(api, followup=None).status_code == 200
    snapshot = next(item['discharge_snapshot'] for item in case(api)['scope'] if item['analysis_id'] == cancelled['id'])
    assert snapshot['cancellation_reason'] == 'Analitica ficticia ya no requerida' and not snapshot['pending_result']
    assert analysis(api, 2)['versions'] == []
    assert [tuple(row) for row in query('SELECT * FROM lab_specimens')] == physical


def test_all_cancelled_order_has_no_fictitious_result_or_plan_and_can_be_closed(assigned):
    api = assigned
    for index in range(3):
        assert medical(api, 'cancel', index).status_code == 200
    assert order(api)['laboratory_status'] == 'CANCELLED'
    assert order(api)['cancelled_analyses'] == 3 and order(api)['pending_results'] == order(api)['pending_reviews'] == 0
    assert publish(api).status_code == 409
    assert close(api, followup=None).status_code == 200
    assert case(api)['review_due_at'] is None and case(api)['communication_plan'] is None
    assert not case(api)['clinical_work_pending'] and queue(api)['total'] == 0
    assert all(not item['discharge_snapshot']['pending_result'] for item in case(api)['scope'])
    assert not query('SELECT id FROM lab_result_versions')


def test_only_confirmed_doctor_can_cancel_and_shared_clinical_roles_do_not_inherit_permission(assigned):
    api = assigned
    for username in ('recepcion', 'archivo', 'enfermeria', 'medico', 'laboratorio', 'supervisor', 'admin.demo'):
        auth = api.login() if username == 'admin.demo' else api.login(username, 'demo123')
        assert medical(api, 'cancel', auth=auth).status_code == 403
    assert medical(api, 'cancel', auth=api.alternate).status_code == 403
    assert analysis(api)['cancelled_at'] is None
    assert medical(api, 'cancel').status_code == 200


def test_unassigned_doctor_cannot_cancel_by_role_alone(ready):
    api = ready
    assert medical(api, 'cancel').status_code == 403
    assert analysis(api)['cancelled_at'] is None


def test_unreviewed_or_already_completed_report_cannot_be_cancelled_as_pending_work(assigned):
    api = assigned
    assert publish(api).status_code == 201
    original = analysis(api)['current_version']
    assert medical(api, 'cancel').status_code == 409
    assert analysis(api)['needs_medical_review'] and analysis(api)['cancelled_at'] is None
    assert action(api, 'review', auth=api.doctor).status_code == 200
    assert medical(api, 'cancel').status_code == 409
    assert analysis(api)['current_version']['result'] == original['result']
    assert analysis(api)['cancelled_at'] is None


def test_old_reviewed_report_survives_cancelled_repeat_and_late_correction_still_blocks_discharge(assigned):
    api = assigned
    assert publish(api).status_code == 201
    assert action(api, 'review', auth=api.doctor).status_code == 200
    source = specimen(api)
    query("UPDATE lab_specimens SET suitability='REJECTED',suitability_reason='Incidencia ficticia posterior' WHERE id=?", (source['id'],))
    assert repeat(api, source['id'], [analysis(api)['id']]).status_code == 200
    old_report = analysis(api)['current_version']
    assert medical(api, 'cancel').status_code == 200
    assert analysis(api)['current_version'] == old_report and order(api)['published_results'] == 1
    for index in (1, 2):
        assert medical(api, 'cancel', index).status_code == 200
    assert order(api)['laboratory_status'] == 'CANCELLED'
    assert action(api, 'corrections', result='Rectificacion ficticia con analitica cancelada').status_code == 200
    assert order(api)['pending_reviews'] == 1 and order(api)['pending_results'] == 0
    assert close(api, followup=None).status_code == 409
    assert action(api, 'review', auth=api.doctor).status_code == 200
    assert close(api, followup=None).status_code == 200
    assert action(api, 'corrections', result='Otra rectificacion ficticia posterior al alta').status_code == 200
    assert case(api)['pending_reviews'] == 1 and queue(api)['total'] == 1
    assert order(api)['laboratory_status'] == 'CANCELLED'  # State of work, not proof of clinical review.
    assert action(api, 'review', auth=api.doctor).status_code == 200
    assert queue(api)['total'] == 0


def test_reinstate_restores_original_requirements_and_keeps_cancellation_history_and_aba_guard(assigned):
    api, key = assigned, str(uuid4())
    original = analysis(api)
    requirements = original['required_specimens']
    assert medical(api, 'cancel', key=key, version=original['version'], reason='Cancelacion ficticia por error').status_code == 200
    assert medical(api, 'reinstate', reason='Restitucion ficticia para corregir el error').status_code == 200
    restored = analysis(api)
    assert restored['cancelled_at'] is None and restored['cancelled_by'] is None and restored['cancellation_reason'] is None
    assert restored['required_specimens'] == requirements and restored['version'] != original['version']
    assert medical(api, 'cancel', version=original['version']).status_code == 409
    replay = medical(api, 'cancel', key=key, version=original['version'], reason='Cancelacion ficticia por error')
    assert replay.status_code == 200 and analysis(api)['cancelled_at'] is None
    cancelled = query("SELECT * FROM lab_changes WHERE action='CANCEL_ANALYSIS'")[0]
    reinstated = query("SELECT * FROM lab_changes WHERE action='REINSTATE_ANALYSIS'")[0]
    assert json.loads(cancelled['new_value'])['cancellation_reason'] == 'Cancelacion ficticia por error'
    assert json.loads(reinstated['old_value'])['cancelled_at'] is not None
    assert json.loads(reinstated['new_value'])['cancelled_at'] is None
    assert len(query("SELECT id FROM events WHERE type='LAB_ANALYSIS_CANCELLED'")) == 1
    assert publish(api).status_code == 201


def test_reinstate_after_discharge_requires_explicit_plan_if_it_reopens_pending_work(assigned):
    api = assigned
    for index in range(3):
        assert medical(api, 'cancel', index).status_code == 200
    assert close(api, followup=None).status_code == 200
    blocked = medical(api, 'reinstate')
    assert blocked.status_code == 409 and 'plan de seguimiento' in blocked.text
    assert follow_action(api, 'plan', plan()).status_code == 200
    restored = medical(api, 'reinstate')
    assert restored.status_code == 200, restored.text
    assert case(api)['pending_results'] == 1 and not case(api)['requires_plan']
    assert publish(api).status_code == 201
    assert order(api)['laboratory_status'] == 'COMPLETED_WITH_CANCELLATIONS'
    assert action(api, 'review', auth=api.doctor).status_code == 200
    assert not case(api)['clinical_work_pending']
    assert case(api)['scope'][0]['discharge_snapshot']['cancelled_at'] is not None


def test_followup_handoff_revokes_old_cancel_receipt_and_new_owner_can_reinstate(assigned):
    api = assigned
    assert close(api).status_code == 200
    original, key = analysis(api), str(uuid4())
    assert medical(api, 'cancel', key=key, version=original['version']).status_code == 200
    assert follow_action(api, 'propose', {'user_id': api.team[4]['id']}).status_code == 200
    assert medical(api, 'reinstate', auth=api.alternate).status_code == 403
    assert follow_action(api, 'accept', auth=api.alternate).status_code == 200
    assert medical(api, 'cancel', key=key, version=original['version']).status_code == 403
    assert medical(api, 'reinstate', auth=api.alternate).status_code == 200


def test_missing_version_key_reason_and_attempted_author_spoofing_are_rejected(assigned):
    api = assigned
    current = analysis(api)
    path = f"/lab/analyses/{current['id']}/cancel"
    assert post(api, path, auth=api.doctor).status_code == 428
    assert api.client.post(path, headers={**api.doctor, 'If-Match': current['version']}, json={'reason': 'Motivo ficticio'}).status_code == 428
    before = state(api)
    assert medical(api, 'cancel', reason=' ').status_code == 422
    assert medical(api, 'cancel', cancelled_by=api.team[4]['id']).status_code == 422
    assert state(api) == before


@pytest.mark.parametrize('same_key', [False, True])
def test_concurrent_cancellations_cannot_duplicate_metadata_or_audit(assigned, same_key):
    api, barrier, key = assigned, Barrier(2), str(uuid4())
    frozen = analysis(api)['version']
    def request():
        barrier.wait()
        return medical(api, 'cancel', key=key if same_key else str(uuid4()), version=frozen).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(lambda _: request(), range(2)))
    assert sorted(outcomes) == ([200, 200] if same_key else [200, 409])
    assert len(query("SELECT id FROM lab_changes WHERE action='CANCEL_ANALYSIS'")) == 1


def test_publication_racing_cancellation_cannot_leave_an_unreviewed_result_hidden_by_cancellation(assigned):
    api, barrier = assigned, Barrier(2)
    frozen = analysis(api)['version']
    def request(operation):
        barrier.wait()
        return medical(api, 'cancel', version=frozen).status_code if operation == 'cancel' else publish(api, version=frozen).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(request, ('cancel', 'publish')))
    assert sum(code in (200, 201) for code in outcomes) == 1 and outcomes.count(409) == 1
    current = analysis(api)
    if current['cancelled_at']:
        assert current['current_version'] is None
    else:
        assert current['has_published_result'] and current['needs_medical_review']


@pytest.mark.parametrize('name', ['cancel', 'reinstate'])
def test_audit_failure_rolls_back_cancellation_or_reinstatement_and_retry_uses_same_intent(assigned, monkeypatch, name):
    api = assigned
    if name == 'reinstate':
        assert medical(api, 'cancel').status_code == 200
    before, key = state(api), str(uuid4())
    frozen = analysis(api)['version']
    def fail(*args, **kwargs):
        raise RuntimeError('Fallo aislado de auditoria de cancelacion')
    with monkeypatch.context() as patch:
        patch.setattr(laboratory_samples, 'audit', fail)
        assert medical(api, name, key=key, version=frozen).status_code == 500
    assert state(api) == before
    assert medical(api, name, key=key, version=frozen).status_code == 200
