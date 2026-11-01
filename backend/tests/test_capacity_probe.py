"""Runner tests never start a server or send traffic to the application."""
import json
from pathlib import Path
import sqlite3
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from scripts import capacity_probe as probe


@pytest.fixture
def private(tmp_path, monkeypatch):
    monkeypatch.setattr(probe, 'ROOT', tmp_path)
    monkeypatch.setattr(probe, 'RUNS_ROOT', tmp_path / '.tmp' / 'capacity-runs')
    return probe.new_run(5)


@pytest.fixture
def seeded(private):
    directory, manifest = private
    path, actors, shared = probe.prepare(directory, manifest)
    return directory, manifest, path, actors, shared


@pytest.mark.parametrize('sessions,reads,writers,conflicts', [(5, 90, 4, 2), (15, 270, 12, 6), (30, 540, 24, 12)])
def test_explicit_bounded_stages(sessions, reads, writers, conflicts):
    value = probe.plan(sessions)
    assert value['read_requests'] == reads
    assert value['independent_writers'] == writers and value['conflict_writers'] == conflicts
    assert value['rounds'] == 6 and value['interval_seconds'] == 15
    assert value['active_episodes_at_start'] == 61 and value['latency_sla'] is None
    assert value['automatic_stage_escalation'] is False
    assert value['measured_requests_on_success'] == {5: 109, 15: 325, 30: 649}[sessions]


def test_describe_does_not_prepare_or_execute(monkeypatch, capsys):
    monkeypatch.setattr(probe, 'execute', lambda _: pytest.fail('Execution not authorized'))
    monkeypatch.setattr(probe, 'new_run', lambda _: pytest.fail('No database needed'))
    assert probe.main(['--sessions', '5']) == 0
    assert json.loads(capsys.readouterr().out)['sessions'] == 5
    with pytest.raises(probe.ProbeError):
        probe.plan(6)


def test_rejects_external_database_and_wrong_run_identity(private, tmp_path):
    directory, manifest = private
    external = tmp_path / 'active-demo'
    external.mkdir()
    with pytest.raises(probe.ProbeError):
        probe.private_database(external, manifest['run_id'])
    with pytest.raises(probe.ProbeError, match='identificador'):
        probe.private_database(directory, 'wrong', exists=False)


def test_preparation_never_overwrites_file(private):
    directory, manifest = private
    path = directory / 'capacity.sqlite3'
    path.write_bytes(b'preserve-existing-file')
    with pytest.raises(probe.ProbeError, match='sobrescribe'):
        probe.prepare(directory, manifest)
    assert path.read_bytes() == b'preserve-existing-file'


def test_seed_has_private_roles_and_representative_fixed_dataset(seeded):
    directory, manifest, path, actors, shared = seeded
    assert path.parent == directory and len(actors) == 5
    assert [actor.role for actor in actors] == list(probe.ROLES)
    assert len({actor.username for actor in actors}) == len(actors)
    assert all(actor.password not in repr(actor) for actor in actors)
    with sqlite3.connect(path) as c:
        assert c.execute('SELECT COUNT(*) FROM episodes').fetchone()[0] == 61
        assert c.execute('SELECT COUNT(*) FROM tasks').fetchone()[0] == 10
        assert c.execute('SELECT COUNT(*) FROM lab_analyses').fetchone()[0] == 20
        assert c.execute('SELECT COUNT(*) FROM lab_specimens').fetchone()[0] == 20
        assert c.execute('SELECT COUNT(*) FROM sessions').fetchone()[0] == 0
        assert c.execute("SELECT COUNT(*) FROM patients WHERE name NOT LIKE 'Capacidad ficticia %'").fetchone()[0] == 0
        assert c.execute('PRAGMA foreign_key_check').fetchone() is None
    assert probe.private_database(directory, manifest['run_id']) == path
    assert shared not in {actor.episode_id for actor in actors}


def response(status=200, payload=None):
    return SimpleNamespace(status_code=status, json=lambda: {} if payload is None else payload)


def test_wrong_server_identity_sends_no_credentials_or_writes(seeded):
    directory, manifest, _, _, _ = seeded
    client = SimpleNamespace(get=Mock(return_value=response(200, {'run_id': 'foreign'})))
    process = SimpleNamespace(poll=lambda: None)
    with pytest.raises(probe.ProbeError, match='no coincide'):
        probe.verify_server(client, process, directory, manifest)
    client.get.assert_called_once_with('/__capacity_probe')


def test_exited_child_is_not_adopted(seeded):
    directory, manifest, _, _, _ = seeded
    client = SimpleNamespace(get=Mock(side_effect=AssertionError('No HTTP allowed')))
    with pytest.raises(probe.ProbeError, match='no pudo iniciar'):
        probe.verify_server(client, SimpleNamespace(poll=lambda: 1), directory, manifest)


def test_shutdown_only_uses_the_owned_process_handle():
    process = SimpleNamespace(poll=lambda: None, terminate=Mock(), wait=Mock(), kill=Mock())
    probe.stop(process)
    process.terminate.assert_called_once()
    process.wait.assert_called_once_with(timeout=10)
    process.kill.assert_not_called()
    probe.stop(None)


def test_status_percentiles_and_expected_conflicts_are_separate():
    rows = [{'phase': 'conflict', 'operation': 'triage', 'status': status, 'expected': expected, 'milliseconds': value}
            for status, expected, value in [(200, True, 10), (409, True, 20), (409, True, 30), (503, False, 40)]]
    result = probe.summarize(rows)['conflict:triage']
    assert result['p50_ms'] == 20 and result['p95_ms'] == 40 and result['max_ms'] == 40
    assert result['statuses'] == {'200': 1, '409': 2, '503': 1} and result['unexpected'] == 1
    assert probe.summarize([]) == {}


def test_measurements_keep_role_differences_separate():
    rows = [{'phase': 'reads', 'operation': 'role_queue', 'status': 200, 'expected': True,
             'milliseconds': value, 'role': role} for role, value in [('LAB', 100), ('NURSE', 20)]]
    result = probe.summarize(rows, by_role=True)
    assert result['reads:LAB:role_queue']['p95_ms'] == 100
    assert result['reads:NURSE:role_queue']['p95_ms'] == 20


def test_source_identity_detects_backend_changes(tmp_path, monkeypatch):
    monkeypatch.setattr(probe, 'ROOT', tmp_path)
    app = tmp_path / 'backend' / 'app'
    app.mkdir(parents=True)
    code = app / 'example.py'
    code.write_text('version = 1\n', encoding='utf-8')
    monkeypatch.setattr(probe.subprocess, 'run', Mock(return_value=SimpleNamespace(returncode=0, stdout='a' * 40)))
    first = probe.source_identity()
    code.write_text('version = 2\n', encoding='utf-8')
    second = probe.source_identity()
    assert first['backend_files'] == 1 and first['revision'] == 'a' * 40
    assert first['backend_sha256'] != second['backend_sha256']
    assert first['runner_sha256'] == second['runner_sha256']


def test_prepare_does_not_replace_shell_database_selection(private, monkeypatch):
    import os
    directory, manifest = private
    foreign = directory.parent / 'not-the-probe.sqlite3'
    monkeypatch.setenv('MEDICCONTROL_DATABASE_PATH', str(foreign))
    path, _, _ = probe.prepare(directory, manifest)
    assert path.parent == directory and not foreign.exists()
    assert os.environ['MEDICCONTROL_DATABASE_PATH'] == str(foreign)


def test_launcher_has_private_path_hidden_window_and_no_reload(seeded, monkeypatch):
    directory, manifest, path, _, _ = seeded

    class Listener:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def bind(self, address): assert address == ('127.0.0.1', 0)
        def getsockname(self): return ('127.0.0.1', 8123)
    monkeypatch.setattr(probe.socket, 'socket', Listener)
    handle = object()
    popen = Mock(return_value=handle)
    monkeypatch.setattr(probe.subprocess, 'Popen', popen)
    monkeypatch.setenv('MEDICCONTROL_DATABASE_PATH', 'unrelated-database')
    process, base = probe.launch(directory, manifest)
    assert process is handle and base == 'http://127.0.0.1:8123'
    args, options = popen.call_args
    assert '--serve' in args[0] and '--reload' not in args[0]
    assert options['env']['MEDICCONTROL_DATABASE_PATH'] == str(path)
    assert options['creationflags'] == getattr(probe.subprocess, 'CREATE_NO_WINDOW', 0)


def test_failed_identity_check_stops_owned_handle_and_saves_incomplete_report(private, monkeypatch):
    directory, manifest = private
    monkeypatch.setattr(probe, 'new_run', lambda _: (directory, manifest))
    monkeypatch.setattr(probe, 'prepare', lambda *_: (directory / 'capacity.sqlite3', [], 61))
    handle = object()
    monkeypatch.setattr(probe, 'launch', lambda *_: (handle, 'http://127.0.0.1:8123'))
    monkeypatch.setattr(probe, 'verify_server', Mock(side_effect=probe.ProbeError('Identidad privada no confirmada')))
    stopper = Mock()
    monkeypatch.setattr(probe, 'stop', stopper)
    output, report = probe.execute(5)
    stopper.assert_called_once_with(handle)
    assert report['completed'] is False and report['requests'] == 0
    assert json.loads(output.read_text(encoding='utf-8'))['completed'] is False


def test_unexpected_status_aborts_and_does_not_record_sensitive_response():
    secret = 'must-not-appear-in-report'
    client = SimpleNamespace(request=Mock(return_value=response(503, {'detail': secret})))
    actor = probe.Actor(0, 'RECEPTION', 'private-user', 'private-password', client=client)
    work = probe.Workload()
    with pytest.raises(probe.ProbeError) as error:
        work.call(actor, 'reads', 'dashboard', 'GET', '/dashboard')
    assert secret not in str(error.value) and secret not in json.dumps(work.samples)
    assert work.aborted.is_set() and work.samples[0]['expected'] is False
    with pytest.raises(probe.ProbeError):
        work.call(actor, 'reads', 'dashboard', 'GET', '/dashboard')
    assert client.request.call_count == 1


def test_transport_error_is_sanitized():
    actor = probe.Actor(0, 'NURSE', 'private', 'secret', client=SimpleNamespace(request=Mock(side_effect=RuntimeError('secret'))))
    work = probe.Workload()
    with pytest.raises(probe.ProbeError) as error:
        work.call(actor, 'reads', 'episode', 'GET', '/episodes/1')
    assert 'secret' not in str(error.value) and 'secret' not in json.dumps(work.samples)
    assert work.samples[0]['status'] is None


def test_plain_http_error_is_not_misreported_as_transport_or_json_failure():
    decode = Mock(side_effect=ValueError('private-error-body'))
    client = SimpleNamespace(request=Mock(return_value=SimpleNamespace(status_code=500, json=decode)))
    actor = probe.Actor(0, 'NURSE', 'private', 'private', client=client)
    work = probe.Workload()
    with pytest.raises(probe.ProbeError, match='HTTP 500') as error:
        work.call(actor, 'login', 'session', 'POST', '/auth/login')
    decode.assert_not_called()
    assert work.samples[0]['status'] == 500 and work.samples[0]['expected'] is False
    assert work.aborted.is_set() and 'private-error-body' not in str(error.value)


def test_parallel_failure_signals_cancellation_before_waiting_for_workers():
    aborted = probe.Event()

    def worker(index):
        if index == 0:
            raise probe.ProbeError('Incidencia sintetica')
        aborted.wait(timeout=1)
    with pytest.raises(probe.ProbeError, match='Incidencia sintetica'):
        probe.parallel([0, 1], worker, aborted)
    assert aborted.is_set()


def test_read_rounds_have_only_authorized_gets(monkeypatch):
    monkeypatch.setattr(probe, 'ROUNDS', 1)
    actors = [probe.Actor(i, role, 'private', 'private', episode_id=i + 1) for i, role in enumerate(probe.ROLES)]
    calls = []
    work = SimpleNamespace(aborted=probe.Event(), call=lambda *args, **kwargs: calls.append(args))
    probe.reads(work, actors)
    assert len(calls) == 15
    assert all(args[3] == 'GET' for args in calls)
    lab = [args[4] for args in calls if args[0].role == 'LAB']
    assert '/lab/orders?status=PENDING' in lab


def test_independent_replays_reuse_intent_and_version():
    actors = [probe.Actor(i, role, 'private', 'private', episode_id=i + 1) for i, role in enumerate(probe.ROLES)]
    calls = []

    def call(actor, phase, operation, method, path, expected=(200,), **kwargs):
        calls.append((actor.index, phase, path, kwargs))
        return expected[0], {'id': actor.episode_id, 'triage_version': '"version"'}
    ledger = probe.independent_writes(SimpleNamespace(call=call), actors)
    assert len(ledger) == 4
    for actor in (a for a in actors if a.role != 'LAB'):
        writes = [value for value in calls if value[0] == actor.index and value[1] in ('writes', 'replay')]
        assert len(writes) == 2 and writes[0][2:] == writes[1][2:]
        assert 'Idempotency-Key' in writes[0][3]['headers']


@pytest.mark.parametrize('protected', [True, False])
def test_shared_version_requires_exactly_one_winner(protected):
    actors = [probe.Actor(i, role, 'private', 'private') for i, role in enumerate(probe.ROLES)]
    lock, count, versions = probe.Lock(), [0], []

    def call(actor, phase, operation, method, path, expected=(200,), **kwargs):
        if method == 'GET':
            return 200, {'triage_version': '"same-version"'}
        with lock:
            count[0] += 1
            versions.append(kwargs['headers']['If-Match'])
            return (200 if not protected or count[0] == 1 else 409), {}
    if protected:
        assert probe.conflict_writes(SimpleNamespace(call=call), actors, 61)['status'] == 200
    else:
        with pytest.raises(probe.ProbeError, match='version compartida'):
            probe.conflict_writes(SimpleNamespace(call=call), actors, 61)
    assert versions == ['"same-version"', '"same-version"']


@pytest.fixture
def completed(seeded):
    _, _, path, actors, shared = seeded
    ledger = []
    with sqlite3.connect(path) as c:
        for actor in actors:
            if actor.role == 'LAB':
                continue
            marker = f'Capacidad independiente {actor.index}'
            identifier = actor.episode_id
            if actor.role == 'RECEPTION':
                patient = c.execute("INSERT INTO patients(name,identity_status) VALUES (?,'PROVISIONAL')", (marker,)).lastrowid
                identifier = c.execute("INSERT INTO episodes(patient_id,qr_token,status,priority,location,started_at) VALUES (?,'private-qr-new','ACTIVE',3,'Espera','2026-10-31T12:00:00+00:00')", (patient,)).lastrowid
                kind = 'EPISODE_CREATED'
            elif actor.role == 'DOCTOR':
                kind = 'MEDICAL_EVALUATION'
            else:
                kind = 'TRIAGE'
                c.execute('UPDATE episodes SET location=? WHERE id=?', (marker, identifier))
            c.execute('INSERT INTO events(episode_id,type,username,created_at,note) VALUES (?,?,?,?,?)',
                      (identifier, kind, actor.username, '2026-10-31T12:00:00+00:00', marker))
            ledger.append({'episode_id': identifier, 'kind': kind, 'username': actor.username, 'marker': marker})
        winner = {'username': actors[1].username, 'marker': 'Capacidad conflicto 1'}
        c.execute('UPDATE episodes SET location=? WHERE id=?', (winner['marker'], shared))
        c.execute("INSERT INTO events(episode_id,type,username,created_at,note) VALUES (?,'TRIAGE',?,'2026-10-31T12:00:00+00:00','Conflicto ficticio')", (shared, winner['username']))
        for actor in actors:
            user_id = c.execute('SELECT id FROM users WHERE username=?', (actor.username,)).fetchone()[0]
            c.execute('INSERT INTO sessions(user_id,token_hash,created_at,expires_at) VALUES (?,?,?,?)',
                      (user_id, f'private-hash-{actor.index}', '2026-10-31T12:00:00+00:00', '2026-10-31T20:00:00+00:00'))
    return path, actors, ledger, shared, winner


def test_end_invariants_detect_success_and_silent_duplicate(completed):
    assert probe.verify_data(*completed)['exactly_once'] is True
    path, _, ledger, _, _ = completed
    first = ledger[0]
    with sqlite3.connect(path) as c:
        c.execute('INSERT INTO events(episode_id,type,username,created_at,note) VALUES (?,?,?,?,?)',
                  (first['episode_id'], first['kind'], first['username'], '2026-10-31T12:00:00+00:00', 'Duplicado ficticio'))
    with pytest.raises(probe.ProbeError, match='exactamente una vez'):
        probe.verify_data(*completed)


def test_end_invariants_detect_overwritten_shared_value(completed):
    with sqlite3.connect(completed[0]) as c:
        c.execute("UPDATE episodes SET location='Sobrescritura ficticia' WHERE id=?", (completed[3],))
    with pytest.raises(probe.ProbeError, match='conflicto compartido'):
        probe.verify_data(*completed)
