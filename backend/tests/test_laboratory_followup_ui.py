"""Safe UI projections, recipients and pending handoff visibility."""
from test_laboratory_followups import (  # noqa: F401
    accounts, api, ready, assigned, staff, team, close, case, plan, follow_action, queue, publish, action, query,
)


def test_recipient_catalog_only_exposes_active_doctors_to_doctors_or_coordination(assigned):
    api = assigned
    response = api.client.get('/lab/followup-doctors', headers=api.doctor)
    assert response.status_code == 200
    doctors = response.json()['doctors']
    assert doctors and all(row['role'] == 'DOCTOR' and row['active'] == 1 for row in doctors)
    assert all(set(row) == {'id', 'username', 'display_name', 'role', 'active'} for row in doctors)
    for auth in [api.nurse, api.lab, api.login('supervisor', 'demo123'), api.login('recepcion', 'demo123')]:
        assert api.client.get('/lab/followup-doctors', headers=auth).status_code == 403
    query('UPDATE users SET active=0 WHERE id=?', (api.team[4]['id'],))
    assert all(row['id'] != api.team[4]['id'] for row in api.client.get('/lab/followup-doctors', headers=api.doctor).json()['doctors'])


def test_pending_handoff_remains_visible_when_reports_and_reviews_are_resolved(assigned):
    api = assigned
    assert close(api).status_code == 200
    for index in range(3):
        assert publish(api, index).status_code == 201
        assert action(api, 'review', index, auth=api.doctor).status_code == 200
    assert queue(api)['total'] == 0
    assert follow_action(api, 'propose', {'user_id': api.team[4]['id']}).status_code == 200
    listed = api.client.get('/lab/followups?mine=true', headers=api.doctor).json()
    assert listed['total'] == 1 and not listed['items'][0]['clinical_work_pending']
    target = api.client.get('/lab/followups?mine=true', headers=api.alternate).json()
    assert target['total'] == 1 and target['items'][0]['pending_user_id'] == api.team[4]['id']
    assert follow_action(api, 'accept', auth=api.alternate).status_code == 200
    assert queue(api)['total'] == 0


def test_history_is_paged_read_only_and_contains_only_plan_and_people_projections(assigned):
    api = assigned
    assert close(api).status_code == 200
    assert follow_action(api, 'plan', plan()).status_code == 200
    assert follow_action(api, 'propose', {'user_id': api.team[4]['id']}).status_code == 200
    path = f'/lab/followups/{api.followup_id}/history'
    before = len(query('SELECT id FROM lab_changes'))
    first = api.client.get(path + '?limit=1', headers=api.nurse)
    assert first.status_code == 200 and first.json()['has_more']
    event = first.json()['items'][0]
    assert event['action'] == 'PROPOSE' and event['username'] == api.team[3]['username']
    assert set(event) == {'id', 'action', 'created_at', 'reason', 'username', 'previous', 'next'}
    assert set(event['next']) == {'owner', 'proposed', 'review_due_at', 'communication_plan'}
    assert event['next']['proposed']['id'] == api.team[4]['id']
    page = api.client.get(path + '?limit=1&offset=1', headers=api.lab).json()
    assert page['items'][0]['action'] == 'PLAN'
    assert api.client.get(path + '?offset=-1', headers=api.lab).status_code == 422
    assert api.client.get(path, headers=api.login('recepcion', 'demo123')).status_code == 403
    assert len(query('SELECT id FROM lab_changes')) == before
    assert 'qr_token' not in first.text and 'password' not in first.text


def test_dashboard_advertises_laboratory_only_when_complete_schema_is_present(api):
    response = api.original.get('/dashboard', headers=api.lab)
    assert response.status_code == 200 and response.json()['laboratory_enabled'] is True
