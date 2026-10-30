from test_laboratory_results import (  # noqa: F401
    accounts, api, assigned, ready, staff, team, publish, action, analysis,
)
from test_laboratory_queue import queue
from test_laboratory_followups import close, follow_action
from test_laboratory_followups import plan
from test_laboratory_repeats import rejected, repeat
from test_laboratory_cancellations import medical


def test_projection_matches_analysis_version_sources_and_confirmed_reviewer(assigned):
    api = assigned
    item = queue(api)['orders'][0]['laboratory']['analyses'][0]
    source = analysis(api)
    assert item['version'] == source['version']
    assert item['reviewer_username'] == api.team[3]['username']
    assert item['required_specimens'] == [{key: row[key] for key in ('id', 'received_at', 'suitability')} for row in source['required_specimens']]
    assert item['versions'] == []


def test_projection_preserves_result_text_reason_review_and_new_pending_version(assigned):
    api = assigned
    assert publish(api).status_code == 201
    assert action(api, 'review', auth=api.doctor).status_code == 200
    before = queue(api)['orders'][0]['laboratory']['analyses'][0]['versions'][0]
    assert before['reviewed_at'] is not None
    assert set(before) == {'id', 'sequence', 'action', 'result', 'reason', 'published_at', 'reviewed_at'}
    assert action(api, 'corrections', result='Texto ficticio corregido', reason='Motivo de corrección ficticia').status_code == 200
    current = queue(api)['orders'][0]['laboratory']['analyses'][0]
    assert current['versions'][0] == before
    assert current['versions'][1]['result'] == 'Texto ficticio corregido'
    assert current['versions'][1]['reason'] == 'Motivo de corrección ficticia'
    assert current['versions'][1]['reviewed_at'] is None and current['needs_medical_review']


def test_projection_without_owner_does_not_offer_review_and_closed_uses_followup_owner(assigned):
    api = assigned
    assert close(api).status_code == 200
    assert follow_action(api, 'propose', {'user_id': api.team[4]['id']}).status_code == 200
    assert follow_action(api, 'accept', auth=api.alternate).status_code == 200
    item = queue(api)['orders'][0]['laboratory']['analyses'][0]
    assert item['reviewer_username'] == api.team[4]['username']


def test_projection_no_confirmed_owner_is_explicit(ready):
    assert all(row['reviewer_username'] is None for row in queue(ready)['orders'][0]['laboratory']['analyses'])


def test_repeat_projection_keeps_lineage_reason_and_named_actor(api):
    old = rejected(api)
    selected = old['analysis_ids'][0]
    assert repeat(api, old['id'], [selected], reason='Repeticion ficticia selectiva').status_code == 200
    entry = queue(api)['orders'][0]['laboratory']['repeats'][0]
    assert entry['previous_specimen_id'] == old['id'] and entry['new_specimen_id'] != old['id']
    assert entry['analysis_id'] == selected and entry['requested_by_username'] == 'laboratorio'
    assert entry['reason'] == 'Repeticion ficticia selectiva' and entry['requested_at']
    assert set(entry) == {'id', 'analysis_id', 'previous_specimen_id', 'new_specimen_id', 'requested_by_username', 'requested_at', 'reason'}


def test_reinstatement_projection_requires_plan_only_for_closed_unfinished_work(assigned):
    api = assigned
    assert not any(item['reinstatement_requires_plan'] for item in queue(api)['orders'][0]['laboratory']['analyses'])
    for index in range(3):
        assert medical(api, 'cancel', index).status_code == 200
    assert close(api, followup=None).status_code == 200
    assert all(item['reinstatement_requires_plan'] for item in queue(api)['orders'][0]['laboratory']['analyses'])
    assert follow_action(api, 'plan', plan()).status_code == 200
    assert not any(item['reinstatement_requires_plan'] for item in queue(api)['orders'][0]['laboratory']['analyses'])
