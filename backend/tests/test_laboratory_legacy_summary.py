"""Read-only summary for old orders; discharge policy is unchanged here."""
from uuid import uuid4

from test_laboratory_followups import baseline
from test_laboratory_unified_discharge import (  # noqa: F401
    accounts, api, ready, assigned, staff, team, query, close,
)


def test_legacy_discharge_summary_tracks_actual_order_versions_without_adopting_them(assigned):
    api = assigned
    path = f"/episodes/{api.episode['id']}/tasks"
    assert api.original.post(path, headers=api.doctor, json={'title': 'Tarea ficticia de enfermeria', 'service': 'NURSING'}).status_code == 201
    created = api.original.post(path, headers=api.doctor, json={'title': 'Orden antigua ficticia', 'service': 'LAB'})
    assert created.status_code == 201
    task = next(item for item in created.json()['tasks'] if item['title'] == 'Orden antigua ficticia')
    summary = baseline(api)
    assert summary['pending_legacy_orders'] == 1
    assert summary['legacy_orders'] == [{key: task.get(key) for key in ('id', 'title', 'status', 'result', 'version')}]
    before = [tuple(row) for row in query('SELECT * FROM tasks')]
    assert baseline(api) == summary
    assert [tuple(row) for row in query('SELECT * FROM tasks')] == before
    completed = api.original.patch(f"/tasks/{task['id']}/complete", headers={**api.lab, 'If-Match': task['version']},
        json={'result': 'Resultado ficticio anterior'})
    assert completed.status_code == 200
    reviewed = baseline(api)
    assert reviewed['pending_legacy_orders'] == 0
    assert reviewed['legacy_orders'][0]['result'] == 'Resultado ficticio anterior'
    assert reviewed['legacy_orders'][0]['version'] != task['version']
    # Reading a finished old order does not invent a medical review or release discharge.
    assert query('SELECT id FROM lab_result_reviews') == []
    assert close(api).status_code == 409
    old = reviewed['legacy_orders'][0]
    annulled = api.original.patch(f"/tasks/{task['id']}/result", headers={**api.lab, 'If-Match': old['version'], 'Idempotency-Key': str(uuid4())},
        json={'action': 'ANNUL', 'reason': 'Anulacion ficticia de resultado anterior'})
    assert annulled.status_code == 200
    terminal = baseline(api)
    assert terminal['pending_legacy_orders'] == 1 and terminal['legacy_orders'][0]['status'] == 'PENDING'
    assert terminal['legacy_orders'][0]['version'] != old['version']
    assert len(query('SELECT task_id FROM lab_orders')) == 1
    assert query('SELECT id FROM lab_followups') == []
