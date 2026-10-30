"""Selective replacement of rejected samples, using the isolated laboratory API."""
from concurrent.futures import ThreadPoolExecutor
import json
from threading import Barrier
from uuid import uuid4

import pytest

from app import main, laboratory_samples
from test_laboratory_samples import accounts, api, create, post, specimen, state, write_sample, BODY, query  # noqa: F401


def find(api, specimen_id):
    return next(item for order in state(api)['orders'] for item in order['specimens'] if item['id'] == specimen_id)


def rejected(api):
    assert create(api).status_code == 201
    assert write_sample(api, 'receipt').status_code == 200
    assert write_sample(api, 'suitability', {'suitability': 'REJECTED', 'reason': 'Muestra ficticia no apta'}).status_code == 200
    return specimen(api)


def repeat(api, source, analysis_ids, auth=None, key=None, version=None, **changes):
    return post(api, f"/lab/specimens/{source}/repeat", {'analysis_ids': analysis_ids, **changes}, auth,
                version if version is not None else find(api, source)['version'], key)


def test_selective_repeat_keeps_original_facts_and_other_analyses_and_is_visible_to_care_staff(api):
    old = rejected(api)
    before = state(api)['orders'][0]
    urine = specimen(api, 'URINE')
    tasks = [tuple(row) for row in query('SELECT * FROM tasks')]
    selected, remaining = old['analysis_ids']
    result = repeat(api, old['id'], [selected], reason='Repetir solo la analitica ficticia seleccionada')
    assert result.status_code == 200, result.text
    order = result.json()['laboratory']['orders'][0]
    assert len(order['specimens']) == 3 and order['analyses'] == before['analyses']
    assert len(order['repeats']) == 1
    lineage = order['repeats'][0]
    new_id = lineage['new_specimen_id']
    new, original = find(api, new_id), find(api, old['id'])
    assert lineage['previous_specimen_id'] == old['id'] and lineage['analysis_id'] == selected
    assert lineage['reason'] == 'Repetir solo la analitica ficticia seleccionada'
    assert lineage['requested_by'] == query("SELECT id FROM users WHERE username='laboratorio'")[0][0]
    assert new['kind'] == old['kind'] and new['analysis_ids'] == [selected]
    assert new['collected_at'] is None and new['delivered_at'] is None and new['received_at'] is None
    assert new['suitability'] == 'UNKNOWN' and new['collector_user_id'] is None
    assert original['analysis_ids'] == [remaining] and original['historical_analysis_ids'] == [selected]
    for field in ('kind', 'collected_at', 'received_at', 'received_by', 'suitability', 'assessed_at', 'suitability_reason'):
        assert original[field] == old[field]
    assert {key: value for key, value in specimen(api, 'URINE').items() if key != 'version'} == {key: value for key, value in urine.items() if key != 'version'}
    assert [tuple(row) for row in query('SELECT * FROM tasks')] == tasks
    audit = query("SELECT * FROM lab_changes WHERE action='REPEAT'")[0]
    assert json.loads(audit['old_value'])['replacement'] is None
    assert json.loads(audit['new_value'])['replacement']['id'] == new_id
    assert len(query("SELECT id FROM events WHERE type='LAB_SAMPLE_REPEAT'")) == 1
    writes = len(query('SELECT id FROM lab_changes'))
    for auth in (api.doctor, api.nurse):
        response = api.client.get(f"/episodes/{api.episode['id']}/laboratory", headers=auth)
        assert response.status_code == 200 and response.json()['orders'][0]['repeats'] == order['repeats']
    assert len(query('SELECT id FROM lab_changes')) == writes


def test_one_new_sample_can_replace_multiple_analyses_and_replay_never_duplicates_it(api):
    old, key = rejected(api), str(uuid4())
    result = repeat(api, old['id'], list(reversed(old['analysis_ids'])), key=key, version=old['version'])
    assert result.status_code == 200, result.text
    replay = repeat(api, old['id'], old['analysis_ids'], key=key, version=old['version'])
    assert replay.status_code == 200 and replay.json() == result.json()
    rows = state(api)['orders'][0]['repeats']
    assert len(rows) == 2 and len({row['new_specimen_id'] for row in rows}) == 1
    assert len(query('SELECT id FROM lab_specimens')) == 3
    assert len(query("SELECT id FROM lab_changes WHERE action='REPEAT'")) == 1
    assert repeat(api, old['id'], old['analysis_ids']).status_code == 409
    assert repeat(api, old['id'], old['analysis_ids'], version=old['version']).status_code == 409
    assert not find(api, old['id'])['analysis_ids']
    assert find(api, old['id'])['historical_analysis_ids'] == old['analysis_ids']
    assert all(row[0] is None for row in query("SELECT summary FROM write_receipts WHERE scope LIKE '%/repeat'"))


def test_remaining_analyses_can_be_repeated_later_without_repeating_already_replaced_ones(api):
    old = rejected(api)
    first, second = old['analysis_ids']
    assert repeat(api, old['id'], [first]).status_code == 200
    assert repeat(api, old['id'], [first, second]).status_code == 409
    assert len(query('SELECT id FROM lab_specimens')) == 3
    assert repeat(api, old['id'], [second]).status_code == 200
    rows = state(api)['orders'][0]['repeats']
    assert len({row['new_specimen_id'] for row in rows}) == 2
    assert not find(api, old['id'])['analysis_ids']


def test_rejected_replacement_can_be_repeated_again_and_lineage_keeps_every_attempt(api):
    old = rejected(api)
    chosen = old['analysis_ids'][:1]
    assert repeat(api, old['id'], chosen).status_code == 200
    second = state(api)['orders'][0]['repeats'][0]['new_specimen_id']
    assert repeat(api, second, chosen).status_code == 409
    assert post(api, f'/lab/specimens/{second}/receipt', version=find(api, second)['version']).status_code == 200
    assert post(api, f'/lab/specimens/{second}/suitability', {'suitability': 'REJECTED'}, version=find(api, second)['version']).status_code == 200
    assert repeat(api, second, chosen).status_code == 200
    rows = state(api)['orders'][0]['repeats']
    assert [(row['previous_specimen_id'], row['new_specimen_id']) for row in rows] == [(old['id'], second), (second, rows[1]['new_specimen_id'])]
    assert find(api, old['id'])['suitability'] == find(api, second)['suitability'] == 'REJECTED'
    assert find(api, rows[1]['new_specimen_id'])['suitability'] == 'UNKNOWN'


def test_only_laboratory_can_request_replacement_and_preconditions_are_required(api):
    old = rejected(api)
    for username in ('recepcion', 'archivo', 'enfermeria', 'medico', 'supervisor', 'admin.demo'):
        auth = api.login() if username == 'admin.demo' else api.login(username, 'demo123')
        assert repeat(api, old['id'], old['analysis_ids'], auth).status_code == 403
    path, body = f"/lab/specimens/{old['id']}/repeat", {'analysis_ids': old['analysis_ids'], 'reason': 'Motivo ficticio'}
    assert api.client.post(path, headers=api.lab, json=body).status_code == 428
    assert post(api, path, body).status_code == 428
    assert api.client.post(path, json=body).status_code == 401
    assert not query('SELECT id FROM lab_specimen_repeats')


@pytest.mark.parametrize('changes', [
    {'analysis_ids': []}, {'analysis_ids': [True]}, {'analysis_ids': [-1]},
    {'analysis_ids': ['1']}, {'reason': ' '}, {'kind': 'URINE'}, {'new_specimen_id': 999},
])
def test_invalid_repeat_cannot_change_type_add_samples_or_lose_old_links(api, changes):
    old = rejected(api)
    before = state(api)
    result = repeat(api, old['id'], changes.get('analysis_ids', old['analysis_ids']),
                    **{key: value for key, value in changes.items() if key != 'analysis_ids'})
    assert result.status_code == 422, result.text
    assert state(api) == before


def test_duplicate_analysis_and_foreign_or_unlinked_ids_are_rejected_without_partial_writes(api):
    old = rejected(api)
    assert repeat(api, old['id'], [old['analysis_ids'][0]] * 2).status_code == 422
    urine_analysis = specimen(api, 'URINE')['analysis_ids'][0]
    for ids in ([urine_analysis], [999999], [old['analysis_ids'][0], urine_analysis]):
        assert repeat(api, old['id'], ids).status_code == 422
    other = api.original.post('/episodes', headers=api.login('recepcion', 'demo123'), json={'provisional': True}).json()
    other_order = post(api, f"/episodes/{other['id']}/lab-orders", BODY, api.doctor, other['clinical_version'])
    assert other_order.status_code == 201
    foreign = other_order.json()['laboratory']['orders'][0]['analyses'][0]['id']
    before = state(api)
    assert repeat(api, old['id'], [foreign]).status_code == 422
    assert state(api) == before and not query('SELECT id FROM lab_specimen_repeats')


def test_cancelled_analyses_block_the_whole_repeat_without_creating_for_other_selected_analyses(api):
    old = rejected(api)
    doctor = query("SELECT id FROM users WHERE username='medico'")[0][0]
    query("UPDATE lab_analyses SET cancelled_at=?,cancelled_by=?,cancellation_reason='Cancelacion ficticia' WHERE id=?",
          (main.utc_now(), doctor, old['analysis_ids'][1]))
    before = state(api)
    assert repeat(api, old['id'], old['analysis_ids']).status_code == 409
    assert state(api) == before


def test_received_or_accepted_samples_and_closed_episodes_do_not_admit_repeat(api):
    assert create(api).status_code == 201
    old = specimen(api)
    assert repeat(api, old['id'], old['analysis_ids']).status_code == 409
    assert write_sample(api, 'receipt').status_code == 200
    assert repeat(api, old['id'], old['analysis_ids']).status_code == 409
    assert write_sample(api, 'suitability', {'suitability': 'ACCEPTED'}).status_code == 200
    assert repeat(api, old['id'], old['analysis_ids']).status_code == 409
    # Separate sample is rejected so the episode/order guards are exercised too.
    assert write_sample(api, 'receipt', kind='URINE').status_code == 200
    assert write_sample(api, 'suitability', {'suitability': 'REJECTED'}, kind='URINE').status_code == 200
    urine = specimen(api, 'URINE')
    for status in ('CLOSED', 'ANNULLED'):
        query('UPDATE episodes SET status=? WHERE id=?', (status, api.episode['id']))
        assert repeat(api, urine['id'], urine['analysis_ids']).status_code == 409
    query("UPDATE episodes SET status='ACTIVE' WHERE id=?", (api.episode['id'],))
    query("UPDATE tasks SET status='COMPLETED' WHERE id=(SELECT order_task_id FROM lab_specimens WHERE id=?)", (urine['id'],))
    assert repeat(api, urine['id'], urine['analysis_ids']).status_code == 409
    assert not query('SELECT id FROM lab_specimen_repeats')


def test_published_results_and_reviews_are_not_removed_or_reinterpreted_by_repetition(api):
    old = rejected(api)
    order = state(api)['orders'][0]
    lab = query("SELECT id FROM users WHERE username='laboratorio'")[0][0]
    doctor = query("SELECT id FROM users WHERE username='medico'")[0][0]
    # A previous stored result may have another source sample; repetition must not mutate it.
    stamp = main.utc_now()
    query("INSERT INTO lab_specimens(order_task_id,kind,received_at,received_by,suitability,assessed_at,assessed_by) VALUES (?,'BLOOD',?,?,'ACCEPTED',?,?)",
          (order['task_id'], stamp, lab, stamp, lab))
    older_source = query('SELECT MAX(id) FROM lab_specimens')[0][0]
    analysis = old['analysis_ids'][0]
    query('INSERT INTO lab_analysis_specimens VALUES (?,?,?,0)', (order['task_id'], analysis, older_source))
    query("""INSERT INTO lab_result_versions(order_task_id,analysis_id,sequence,action,result,reason,published_by,published_at)
        VALUES (?,?,1,'PUBLISH','Resultado ficticio previo','Motivo ficticio',?,?)""", (order['task_id'], analysis, lab, stamp))
    version = query('SELECT MAX(id) FROM lab_result_versions')[0][0]
    query('INSERT INTO lab_result_specimens VALUES (?,?,?,?)', (version, order['task_id'], analysis, older_source))
    query("INSERT INTO lab_result_reviews(result_version_id,reviewed_by,reviewed_at,responsibility_context,owner_revision) VALUES (?,?,?,'ACTIVE_EPISODE',0)",
          (version, doctor, stamp))
    tables = ('lab_result_versions', 'lab_result_specimens', 'lab_result_reviews')
    before = {name: [tuple(row) for row in query(f'SELECT * FROM {name}')] for name in tables}
    assert repeat(api, old['id'], old['analysis_ids']).status_code == 200
    assert {name: [tuple(row) for row in query(f'SELECT * FROM {name}')] for name in tables} == before


@pytest.mark.parametrize('same_key', [False, True])
def test_concurrent_repeats_cannot_duplicate_a_pending_replacement(api, same_key):
    old, barrier, key = rejected(api), Barrier(2), str(uuid4())
    def request():
        barrier.wait()
        return repeat(api, old['id'], old['analysis_ids'], key=key if same_key else str(uuid4()), version=old['version']).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(lambda _: request(), range(2)))
    assert sorted(outcomes) == ([200, 200] if same_key else [200, 409])
    assert len(query('SELECT id FROM lab_specimens')) == 3
    assert len(query('SELECT id FROM lab_specimen_repeats')) == 2
    assert len(query("SELECT id FROM lab_changes WHERE action='REPEAT'")) == 1


def test_repeat_audit_failure_rolls_back_sample_links_lineage_and_revisions(api, monkeypatch):
    old, key = rejected(api), str(uuid4())
    before = state(api)
    def fail(*args, **kwargs):
        raise RuntimeError('Fallo aislado de auditoria de repeticion')
    with monkeypatch.context() as patch:
        patch.setattr(laboratory_samples, 'audit', fail)
        assert repeat(api, old['id'], old['analysis_ids'], key=key).status_code == 500
    assert state(api) == before
    assert not query('SELECT id FROM lab_specimen_repeats')
    assert not query("SELECT operation_key FROM write_receipts WHERE scope LIKE '%/repeat'")
    assert repeat(api, old['id'], old['analysis_ids'], key=key).status_code == 200
