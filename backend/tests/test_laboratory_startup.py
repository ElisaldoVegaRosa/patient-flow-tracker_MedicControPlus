from copy import deepcopy
from uuid import uuid4

from app import main
from test_laboratory_followups import accounts, api, ready, assigned, staff, team, plan, query  # noqa: F401
from test_laboratory_samples import BODY


def send(api, path, body, version, auth=None):
    return api.original.post(path, headers={**(auth or api.lab), 'If-Match': version, 'Idempotency-Key': str(uuid4())}, json=body)


def episode(api):
    response = api.original.get(f"/episodes/{api.episode['id']}", headers=api.doctor)
    assert response.status_code == 200
    return response.json()


def test_new_routes_are_registered_once_and_only_the_standard_discharge_is_writable():
    paths = ['/episodes/{episode_id}/lab-orders', '/lab/specimens/{specimen_id}/repeat',
             '/lab/analyses/{analysis_id}/results', '/lab/followups/{followup_id}/accept']
    for path in paths:
        assert len([route for route in main.app.routes if route.path == path and 'POST' in route.methods]) == 1
    assert not any(route.path == '/episodes/{episode_id}/lab-discharge' and 'POST' in route.methods for route in main.app.routes)
    assert len([route for route in main.app.routes if route.path == '/episodes/{episode_id}/discharge' and 'POST' in route.methods]) == 1


def test_startup_and_new_requests_do_not_migrate_a_legacy_database(accounts):
    client, login, _ = accounts
    auth = login('medico', 'demo123')
    created = client.post('/episodes', headers=login('recepcion', 'demo123'), json={'provisional': True})
    assert created.status_code == 201
    item = created.json()
    assert client.get('/dashboard', headers=auth).json()['laboratory_enabled'] is False
    for path in ['/lab/followups', '/lab/followup-doctors', f"/episodes/{item['id']}/laboratory"]:
        result = client.get(path, headers=auth)
        assert result.status_code == 409 and result.json()['detail']['code'] == 'laboratory_not_enabled'
    result = client.post(f"/episodes/{item['id']}/lab-orders", headers={**auth, 'If-Match': item['clinical_version'], 'Idempotency-Key': str(uuid4())}, json=BODY)
    assert result.status_code == 409 and result.json()['detail']['code'] == 'laboratory_not_enabled'
    assert query("SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'lab_*'") == []
    assert client.get('/health').json()['status'] == 'ok'


def test_main_api_runs_order_samples_results_discharge_plan_and_accepted_handoff(assigned):
    api = assigned
    body = {**deepcopy(BODY), 'title': 'Orden ficticia por API principal'}
    created = send(api, f"/episodes/{api.episode['id']}/lab-orders", body, episode(api)['clinical_version'], api.doctor)
    assert created.status_code == 201, created.text
    task_id = max(order['task_id'] for order in created.json()['laboratory']['orders'])
    def order():
        return next(item for item in episode(api)['laboratory']['orders'] if item['task_id'] == task_id)
    source_ids = [item['id'] for item in order()['specimens']]
    for source_id in source_ids:
        for operation, payload in [('receipt', {}), ('suitability', {'suitability': 'ACCEPTED'})]:
            source = next(item for item in order()['specimens'] if item['id'] == source_id)
            result = send(api, f'/lab/specimens/{source_id}/{operation}', {'reason': 'Registro ficticio principal', **payload}, source['version'])
            assert result.status_code == 200, result.text
    analysis_ids = [item['id'] for item in order()['results']]
    for analysis_id in analysis_ids:
        item = next(row for row in order()['results'] if row['id'] == analysis_id)
        published = send(api, f'/lab/analyses/{analysis_id}/results', {'reason': 'Publicacion ficticia principal',
            'result': 'Resultado ficticio principal', 'specimen_ids': [row['id'] for row in item['required_specimens']]}, item['version'])
        assert published.status_code == 201, published.text
        item = next(row for row in order()['results'] if row['id'] == analysis_id)
        reviewed = send(api, f"/lab/results/{item['current_version']['id']}/review", {'reason': 'Revision ficticia principal'}, item['version'], api.doctor)
        assert reviewed.status_code == 200, reviewed.text
    closed = send(api, f"/episodes/{api.episode['id']}/discharge", {'note': 'Alta ficticia principal',
        'reason': 'Alta y custodia ficticia principal', 'followup': plan()}, episode(api)['clinical_version'], api.doctor)
    assert closed.status_code == 200 and closed.json()['status'] == 'CLOSED', closed.text
    followup_id = closed.json()['lab_followups'][0]['id']
    def followup():
        return api.original.get(f'/lab/followups/{followup_id}', headers=api.lab).json()
    updated = send(api, f'/lab/followups/{followup_id}/plan', plan(), followup()['version'], api.doctor)
    assert updated.status_code == 200, updated.text
    proposed = send(api, f'/lab/followups/{followup_id}/propose', {'reason': 'Relevo ficticio principal', 'user_id': api.team[4]['id']}, followup()['version'], api.doctor)
    assert proposed.status_code == 200 and followup()['owner_user_id'] == api.team[3]['id'], proposed.text
    accepted = send(api, f'/lab/followups/{followup_id}/accept', {'reason': 'Aceptacion ficticia principal'}, followup()['version'], api.alternate)
    assert accepted.status_code == 200 and followup()['owner_user_id'] == api.team[4]['id'], accepted.text
    assert api.original.get(f"/episodes/{api.episode['id']}/lab-discharge", headers=api.doctor).status_code == 200
