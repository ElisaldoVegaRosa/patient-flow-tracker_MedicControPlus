from test_laboratory_samples import accounts, api, query  # noqa: F401


def test_sample_professionals_are_active_nursing_or_lab_only_without_sensitive_fields(api):
    for auth in (api.nurse, api.lab):
        response = api.client.get('/lab/sample-professionals', headers=auth)
        assert response.status_code == 200
        people = response.json()['professionals']
        assert people and all(person['role'] in {'NURSE', 'LAB'} for person in people)
        assert all(set(person) == {'id', 'username', 'display_name', 'role'} for person in people)
    for auth in (api.doctor, api.login('supervisor', 'demo123'), api.login('recepcion', 'demo123')):
        assert api.client.get('/lab/sample-professionals', headers=auth).status_code == 403
    assert api.client.get('/lab/sample-professionals').status_code == 401
    query("UPDATE users SET active=0 WHERE username='enfermeria'")
    response = api.client.get('/lab/sample-professionals', headers=api.lab)
    assert all(person['username'] != 'enfermeria' for person in response.json()['professionals'])
    mounted = api.original.get('/lab/sample-professionals', headers=api.lab)
    assert mounted.status_code == 200
    assert mounted.json() == response.json()
