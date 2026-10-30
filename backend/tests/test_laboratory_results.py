"""Partial LAB results, immutable versions and confirmed medical review in isolation."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from uuid import uuid4

import pytest

from app import laboratory_samples, main
from test_laboratory_samples import accounts, api, create, post, query, specimen, state, write_sample  # noqa: F401
from test_staffing import staff  # noqa: F401
from test_care import team, routed, apply, refresh  # noqa: F401
from test_laboratory_repeats import repeat, find


def prepare(api):
    assert create(api).status_code == 201
    for kind in ('BLOOD', 'URINE'):
        assert write_sample(api, 'receipt', kind=kind).status_code == 200
        assert write_sample(api, 'suitability', {'suitability': 'ACCEPTED'}, kind=kind).status_code == 200
    return api


@pytest.fixture
def ready(api):
    return prepare(api)


@pytest.fixture
def assigned(api, team):
    care = routed(team)
    response = apply(team, care, 'DOCTOR/assign', {'user_id': team[3]['id']})
    assert response.status_code == 200
    api.team, api.care = team, response.json()
    api.episode = api.original.get(f"/episodes/{care['episode_id']}", headers=team[-1]).json()
    api.doctor = team[-1]
    api.alternate = api.login(team[4]['username'])
    return prepare(api)


def order(api):
    return state(api)['orders'][0]


def analysis(api, index=0):
    return order(api)['results'][index]


def publish(api, index=0, key=None, version=None, auth=None, **changes):
    item = analysis(api, index)
    body = {'result': 'Resultado ficticio publicado', 'specimen_ids': [source['id'] for source in item['required_specimens']], **changes}
    return post(api, f"/lab/analyses/{item['id']}/results", body, auth,
                version if version is not None else item['version'], key)


def action(api, name, index=0, auth=None, key=None, version=None, result_id=None, **body):
    item = analysis(api, index)
    target = result_id or item['current_version']['id']
    return post(api, f'/lab/results/{target}/{name}', body, auth,
                version if version is not None else item['version'], key)


def test_partial_publication_does_not_publish_sibling_analyses_or_infer_medical_review(ready):
    api = ready
    response = publish(api)
    assert response.status_code == 201, response.text
    current = order(api)
    assert current['laboratory_status'] == 'PARTIAL'
    assert (current['published_results'], current['pending_results'], current['pending_reviews']) == (1, 2, 1)
    assert analysis(api)['current_version']['specimen_ids'] == [specimen(api)['id']]
    assert analysis(api, 1)['current_version'] is None  # Same blood sample does not publish another test.
    assert query('SELECT status,result FROM tasks WHERE service=\'LAB\'')[0]['result'] is None
    before = len(query('SELECT id FROM lab_changes'))
    assert order(api) == current and len(query('SELECT id FROM lab_changes')) == before


def test_laboratory_completion_and_review_are_separate_and_confirmed_owner_is_recorded(assigned):
    api = assigned
    for index in range(3):
        assert publish(api, index).status_code == 201
    current = order(api)
    assert current['laboratory_status'] == 'COMPLETED' and current['pending_results'] == 0 and current['pending_reviews'] == 3
    response = action(api, 'review', auth=api.doctor)
    assert response.status_code == 200, response.text
    reviewed = analysis(api)['current_version']['review']
    assert reviewed['reviewed_by'] == api.team[3]['id'] and reviewed['responsibility_context'] == 'ACTIVE_EPISODE'
    assert reviewed['owner_revision'] == analysis(api)['medical_owner']['owner_revision']
    assert order(api)['laboratory_status'] == 'COMPLETED' and order(api)['pending_reviews'] == 2
    assert action(api, 'review', auth=api.doctor).status_code == 409


def test_correction_preserves_original_and_its_review_and_requires_new_review(assigned):
    api = assigned
    assert publish(api).status_code == 201
    assert action(api, 'review', auth=api.doctor).status_code == 200
    previous = analysis(api)['current_version']
    correction = action(api, 'corrections', result='Resultado ficticio rectificado')
    assert correction.status_code == 200, correction.text
    updated = analysis(api)
    latest = updated['current_version']
    assert latest['sequence'] == 2 and latest['previous_version_id'] == previous['id']
    assert latest['specimen_ids'] == previous['specimen_ids'] and latest['review'] is None
    assert updated['versions'][0] == previous and updated['needs_medical_review']
    assert action(api, 'review', auth=api.doctor).status_code == 200
    assert len(query('SELECT id FROM lab_result_reviews')) == 2
    assert order(api)['pending_results'] == 2 and order(api)['pending_reviews'] == 0


def test_annulment_is_a_version_not_cancellation_and_republication_keeps_full_history(ready):
    api = ready
    assert publish(api).status_code == 201
    original = analysis(api)['current_version']
    assert action(api, 'annul').status_code == 200
    annulled = analysis(api)['current_version']
    assert annulled['action'] == 'ANNUL' and annulled['result'] is None and not annulled['specimen_ids']
    assert analysis(api)['cancelled_at'] is None and order(api)['pending_results'] == 3
    assert action(api, 'corrections', result='Otro texto ficticio').status_code == 409
    assert publish(api, result='Resultado ficticio republicado').status_code == 201
    updated = analysis(api)
    assert [item['action'] for item in updated['versions']] == ['PUBLISH', 'ANNUL', 'PUBLISH']
    assert updated['versions'][0] == original and updated['current_version']['review'] is None
    assert action(api, 'annul', result_id=original['id']).status_code == 409


def test_publication_requires_current_received_accepted_sources(api):
    assert create(api).status_code == 201
    assert publish(api).status_code == 409
    assert write_sample(api, 'receipt').status_code == 200
    assert publish(api).status_code == 409
    assert write_sample(api, 'suitability', {'suitability': 'REJECTED'}).status_code == 200
    assert publish(api).status_code == 409
    assert publish(api, specimen_ids=[specimen(api, 'URINE')['id']]).status_code == 422
    assert not query('SELECT id FROM lab_result_versions')


@pytest.mark.parametrize('changes', [
    {'result': ' '}, {'reason': ' '}, {'specimen_ids': []}, {'specimen_ids': [True]},
    {'specimen_ids': [999999]}, {'specimen_ids': [1, 1]}, {'reviewed': True},
])
def test_invalid_publication_has_no_versions_sources_reviews_or_audit(ready, changes):
    api = ready
    before = state(api)
    response = publish(api, **changes)
    assert response.status_code == 422, response.text
    assert state(api) == before and not query('SELECT id FROM lab_result_versions')


def test_multiple_required_samples_must_all_be_identified_and_accepted(api):
    body = {'title': 'Analitica ficticia con dos fuentes', 'reason': 'Prueba ficticia',
            'analyses': [{'key': 'one', 'title': 'Analitica ficticia'}],
            'specimens': [{'key': 'blood', 'kind': 'BLOOD', 'analysis_keys': ['one']},
                          {'key': 'saliva', 'kind': 'SALIVA', 'analysis_keys': ['one']}]}
    assert create(api, body).status_code == 201
    for kind in ('BLOOD', 'SALIVA'):
        assert write_sample(api, 'receipt', kind=kind).status_code == 200
        assert write_sample(api, 'suitability', {'suitability': 'ACCEPTED'}, kind=kind).status_code == 200
    assert publish(api, specimen_ids=[specimen(api)['id']]).status_code == 422
    assert publish(api).status_code == 201
    assert len(analysis(api)['current_version']['specimen_ids']) == 2 and order(api)['laboratory_status'] == 'COMPLETED'


@pytest.mark.parametrize('username', ['recepcion', 'archivo', 'enfermeria', 'medico', 'supervisor', 'admin.demo'])
def test_non_lab_roles_cannot_publish_correct_or_annul_and_unassigned_doctor_cannot_review(ready, username):
    api = ready
    assert publish(api).status_code == 201
    auth = api.login() if username == 'admin.demo' else api.login(username, 'demo123')
    before = state(api)
    assert publish(api, auth=auth).status_code == 403
    assert action(api, 'corrections', auth=auth, result='Texto ficticio').status_code == 403
    assert action(api, 'annul', auth=auth).status_code == 403
    assert action(api, 'review', auth=auth).status_code == 403
    assert state(api) == before


def test_publication_preconditions_replay_and_different_intent_are_checked(ready):
    api = ready
    item, key = analysis(api), str(uuid4())
    path = f"/lab/analyses/{item['id']}/results"
    body = {'result': 'Resultado ficticio publicado', 'specimen_ids': [specimen(api)['id']]}
    assert post(api, path, body).status_code == 428
    assert api.client.post(path, headers={**api.lab, 'If-Match': item['version']}, json={**body, 'reason': 'Motivo ficticio'}).status_code == 428
    first = publish(api, key=key, version=item['version'])
    assert first.status_code == 201
    assert publish(api, key=key, version=item['version']).json() == first.json()
    assert publish(api, key=key, version=item['version'], result='Otro resultado ficticio').status_code == 409
    assert publish(api, version=item['version']).status_code == 409
    assert publish(api).status_code == 409
    assert len(query('SELECT id FROM lab_result_versions')) == 1
    assert all(row[0] is None for row in query("SELECT summary FROM write_receipts WHERE scope LIKE '%/results'"))
    assert 'qr_token' not in str([dict(row) for row in query('SELECT * FROM lab_changes')])


def test_pending_handoff_does_not_authorize_reviewer_and_accepted_handoff_revokes_old_receipts(assigned):
    api = assigned
    assert publish(api).status_code == 201
    baseline = analysis(api)['version']
    care = refresh(api.team, api.care)
    proposal = apply(api.team, care, 'DOCTOR/handoff', {'user_id': api.team[4]['id']})
    assert proposal.status_code == 200
    assert action(api, 'review', auth=api.alternate).status_code == 403
    assert action(api, 'review', auth=api.doctor, version=baseline).status_code == 409
    old_id, key = analysis(api)['current_version']['id'], str(uuid4())
    old_version = analysis(api)['version']
    assert action(api, 'review', auth=api.doctor, key=key, version=old_version).status_code == 200
    accepted = apply(api.team, refresh(api.team, api.care), 'DOCTOR/accept', auth=api.alternate)
    assert accepted.status_code == 200
    assert action(api, 'review', auth=api.doctor, key=key, version=old_version, result_id=old_id).status_code == 403
    assert action(api, 'corrections', result='Nuevo texto ficticio tras relevo').status_code == 200
    assert action(api, 'review', auth=api.doctor).status_code == 403
    assert action(api, 'review', auth=api.alternate).status_code == 200
    assert analysis(api)['versions'][0]['review']['reviewed_by'] == api.team[3]['id']
    assert analysis(api)['current_version']['review']['reviewed_by'] == api.team[4]['id']


def test_return_to_same_owner_does_not_accept_old_review_version(assigned):
    api = assigned
    assert publish(api).status_code == 201
    baseline = analysis(api)['version']
    for target, receiver in ((api.team[4]['id'], api.alternate), (api.team[3]['id'], api.doctor)):
        proposal = apply(api.team, refresh(api.team, api.care), 'DOCTOR/handoff', {'user_id': target})
        assert proposal.status_code == 200
        assert apply(api.team, proposal.json(), 'DOCTOR/accept', auth=receiver).status_code == 200
    assert action(api, 'review', auth=api.doctor, version=baseline).status_code == 409
    assert action(api, 'review', auth=api.doctor).status_code == 200


def test_expired_or_deactivated_owner_cannot_replay_review(assigned):
    api = assigned
    assert publish(api).status_code == 201
    item, key = analysis(api), str(uuid4())
    assert action(api, 'review', auth=api.doctor, key=key, version=item['version']).status_code == 200
    query("UPDATE sessions SET expires_at='2000-01-01T00:00:00+00:00' WHERE user_id=?", (api.team[3]['id'],))
    assert action(api, 'review', auth=api.doctor, key=key, version=item['version']).status_code == 401
    api.doctor = api.login(api.team[3]['username'])
    query('UPDATE users SET active=0 WHERE id=?', (api.team[3]['id'],))
    assert action(api, 'review', auth=api.doctor, key=key, version=item['version']).status_code == 401
    assert len(query('SELECT id FROM lab_result_reviews')) == 1


def test_repetition_preserves_old_result_but_requires_a_new_current_source_result(api):
    assert create(api).status_code == 201
    assert write_sample(api, 'receipt').status_code == 200
    assert write_sample(api, 'suitability', {'suitability': 'REJECTED'}).status_code == 200
    old = specimen(api)
    assert repeat(api, old['id'], old['analysis_ids'][:1]).status_code == 200
    replacement = order(api)['repeats'][0]['new_specimen_id']
    for name, body in (('receipt', {}), ('suitability', {'suitability': 'ACCEPTED'})):
        assert post(api, f'/lab/specimens/{replacement}/{name}', body, version=find(api, replacement)['version']).status_code == 200
    assert publish(api).status_code == 201
    # Reject another required attempt after a future operational rectification;
    # seed only this sample fact, not a result or review, to test replacement semantics.
    query("UPDATE lab_specimens SET suitability='REJECTED',suitability_reason='Incidencia ficticia posterior' WHERE id=?", (replacement,))
    previous = analysis(api)['current_version']
    assert repeat(api, replacement, [analysis(api)['id']]).status_code == 200
    assert analysis(api)['current_version'] == previous
    assert not analysis(api)['satisfies_current_samples']
    assert publish(api).status_code == 409
    next_id = order(api)['repeats'][-1]['new_specimen_id']
    for name, body in (('receipt', {}), ('suitability', {'suitability': 'ACCEPTED'})):
        assert post(api, f'/lab/specimens/{next_id}/{name}', body, version=find(api, next_id)['version']).status_code == 200
    assert publish(api).status_code == 201
    assert analysis(api)['current_version']['sequence'] == 2 and analysis(api)['current_version']['specimen_ids'] == [next_id]
    assert analysis(api)['versions'][0] == previous


@pytest.mark.parametrize('same_key', [False, True])
def test_concurrent_publications_are_serialized_without_duplicate_versions(ready, same_key):
    api, barrier, key = ready, Barrier(2), str(uuid4())
    frozen = analysis(api)['version']
    def request():
        barrier.wait()
        return publish(api, key=key if same_key else str(uuid4()), version=frozen).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(lambda _: request(), range(2)))
    assert sorted(outcomes) == ([201, 201] if same_key else [201, 409])
    assert len(query('SELECT id FROM lab_result_versions')) == 1
    assert len(query("SELECT id FROM lab_changes WHERE action='PUBLISH'")) == 1


def test_correction_racing_review_cannot_review_a_different_version(assigned):
    api, barrier = assigned, Barrier(2)
    assert publish(api).status_code == 201
    frozen = analysis(api)['version']
    def request(name):
        barrier.wait()
        return action(api, name, auth=api.doctor if name == 'review' else api.lab, version=frozen,
                      **({} if name == 'review' else {'result': 'Correccion ficticia concurrente'})).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(request, ('review', 'corrections')))
    assert sorted(outcomes) == [200, 409]
    latest = analysis(api)['current_version']
    assert (latest['sequence'] == 1 and latest['review'] is not None) or (latest['sequence'] == 2 and latest['review'] is None)


def test_closed_and_annulled_contexts_block_but_cancelled_reports_remain_correctable(ready):
    api = ready
    assert publish(api).status_code == 201
    for status in ('CLOSED', 'ANNULLED'):
        query('UPDATE episodes SET status=? WHERE id=?', (status, api.episode['id']))
        assert publish(api, 1).status_code == 409
        assert action(api, 'corrections', result='Texto ficticio').status_code == 409
        assert action(api, 'annul').status_code == 409
        assert action(api, 'review', auth=api.doctor).status_code == 409
    query("UPDATE episodes SET status='ACTIVE' WHERE id=?", (api.episode['id'],))
    doctor = query("SELECT id FROM users WHERE username='medico'")[0][0]
    query("UPDATE lab_analyses SET cancelled_at=?,cancelled_by=?,cancellation_reason='Motivo ficticio' WHERE id=?",
          (main.utc_now(), doctor, analysis(api)['id']))
    # Even a cancelled analysis keeps its published report correctable/reviewable.
    assert action(api, 'corrections', result='Texto ficticio').status_code == 200
    assert order(api)['cancelled_analyses'] == 1 and order(api)['pending_reviews'] == 1
    assert len(query('SELECT id FROM lab_result_versions')) == 2


def test_close_reopen_invalidates_old_sample_and_result_drafts_even_when_active_again(api, team):
    care = routed(team)
    assert apply(team, care, 'DOCTOR/assign', {'user_id': team[3]['id']}).status_code == 200
    api.episode = api.original.get(f"/episodes/{care['episode_id']}", headers=team[-1]).json()
    api.doctor = team[-1]
    assert create(api).status_code == 201
    sample_before, result_before = specimen(api), analysis(api)
    baseline = api.client.get(f"/episodes/{api.episode['id']}/lab-discharge", headers=api.doctor).json()
    discharged = post(api, f"/episodes/{api.episode['id']}/lab-discharge", {
        'note': 'Alta ficticia para comprobar versiones',
        'followup': {'reason': 'Pendientes ficticios para probar reapertura',
                     'review_due_at': (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
                     'communication_plan': 'Comunicacion ficticia de resultados pendientes'}},
        api.doctor, baseline['version'])
    assert discharged.status_code == 200, discharged.text
    reopened = api.original.post(f"/episodes/{api.episode['id']}/reopen",
        headers={**api.doctor, 'Idempotency-Key': str(uuid4())}, json={'reason': 'Reapertura ficticia de prueba'})
    assert reopened.status_code == 200
    assert specimen(api)['version'] != sample_before['version']
    assert analysis(api)['version'] != result_before['version']
    received = post(api, f"/lab/specimens/{sample_before['id']}/receipt", version=sample_before['version'])
    stale_result = publish(api, version=result_before['version'])
    assert received.status_code == stale_result.status_code == 409
    assert received.json()['detail']['code'] == stale_result.json()['detail']['code'] == 'version_conflict'
    assert not query('SELECT id FROM lab_result_versions') and specimen(api)['received_at'] is None


def test_publication_audit_failure_rolls_back_version_sources_and_revisions(ready, monkeypatch):
    api, key = ready, str(uuid4())
    before = state(api)
    def fail(*args, **kwargs):
        raise RuntimeError('Fallo aislado de auditoria de publicacion')
    with monkeypatch.context() as patch:
        patch.setattr(laboratory_samples, 'audit', fail)
        assert publish(api, key=key).status_code == 500
    assert state(api) == before and not query('SELECT id FROM lab_result_versions')
    assert not query('SELECT result_version_id FROM lab_result_specimens')
    assert publish(api, key=key).status_code == 201


@pytest.mark.parametrize('name', ['corrections', 'annul'])
def test_correction_and_annulment_failure_cannot_damage_original_version(ready, monkeypatch, name):
    api = ready
    assert publish(api).status_code == 201
    before = state(api)
    def fail(*args, **kwargs):
        raise RuntimeError('Fallo aislado de auditoria de cambio')
    with monkeypatch.context() as patch:
        patch.setattr(laboratory_samples, 'audit', fail)
        assert action(api, name, **({'result': 'Texto ficticio'} if name == 'corrections' else {})).status_code == 500
    assert state(api) == before


def test_review_audit_failure_rolls_back_acknowledgment_and_owner_version(assigned, monkeypatch):
    api = assigned
    assert publish(api).status_code == 201
    before = state(api)
    def fail(*args, **kwargs):
        raise RuntimeError('Fallo aislado de auditoria de revision')
    with monkeypatch.context() as patch:
        patch.setattr(laboratory_samples, 'audit', fail)
        assert action(api, 'review', auth=api.doctor).status_code == 500
    assert state(api) == before and not query('SELECT id FROM lab_result_reviews')
    assert action(api, 'review', auth=api.doctor).status_code == 200
