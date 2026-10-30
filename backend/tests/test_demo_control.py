"""Controller safety tests: no app server is started, stopped or contacted."""
from contextlib import nullcontext
import os
from pathlib import Path
from types import SimpleNamespace

import pytest

from scripts import demo_control as demo


@pytest.fixture
def control(tmp_path, monkeypatch):
    manager = demo.DemoControl(tmp_path / "Proyecto con espacios")
    manager.directory.mkdir(parents=True)
    monkeypatch.setattr(demo, "process_identity", lambda pid: {"created": pid * 10, "image": "python.exe"})
    monkeypatch.setattr(demo, "port_available", lambda port: True)
    monkeypatch.setattr(demo, "responds", lambda service: True)
    monkeypatch.setattr(demo.subprocess, "CREATE_NO_WINDOW", 0, raising=False)
    monkeypatch.setattr(manager, "commands", lambda: {key: ([key], manager.root) for key in demo.PORTS})
    return manager


def record(pid):
    return {"pid": pid, "created": pid * 10, "image": "python.exe"}


def test_occupied_port_never_starts_or_adopts_a_server(control, monkeypatch):
    monkeypatch.setattr(demo, "port_available", lambda port: port != 5173)
    monkeypatch.setattr(demo.subprocess, "Popen", lambda *a, **kw: pytest.fail("No start allowed"))
    with pytest.raises(demo.ControlError, match="5173 ocupado"):
        control.start()
    assert not control.state_file.exists()


def test_reused_pid_is_never_killed(control, monkeypatch):
    control.save({"backend": {**record(11), "created": 1}})
    monkeypatch.setattr(demo.subprocess, "run", lambda *a, **kw: pytest.fail("Foreign PID"))
    control.stop()
    assert control.load() == {}


def test_image_mismatch_is_never_killed(control, monkeypatch):
    control.save({"backend": {**record(11), "image": "other.exe"}})
    monkeypatch.setattr(demo.subprocess, "run", lambda *a, **kw: pytest.fail("Foreign image"))
    control.stop()
    assert control.load() == {}


def test_missing_process_is_not_killed(control, monkeypatch):
    control.save({"backend": record(11)})
    monkeypatch.setattr(demo, "process_identity", lambda pid: None)
    monkeypatch.setattr(demo.subprocess, "run", lambda *a, **kw: pytest.fail("Stale PID"))
    control.stop()
    assert control.load() == {}


def test_stop_only_kills_verified_tree(control, monkeypatch):
    control.save({"backend": record(11)})
    calls = []
    monkeypatch.setattr(demo.subprocess, "run", lambda args, **kw: calls.append(args) or SimpleNamespace(returncode=0))
    control.stop()
    assert calls == [["taskkill.exe", "/PID", "11", "/T", "/F"]]
    assert control.load() == {}


def test_unverifiable_process_keeps_reference(control, monkeypatch):
    control.save({"backend": record(11)})
    def denied(pid):
        raise demo.ControlError("Denied")
    monkeypatch.setattr(demo, "process_identity", denied)
    with pytest.raises(demo.ControlError, match="Referencias conservadas"):
        control.stop()
    assert control.load() == {"backend": record(11)}


@pytest.mark.parametrize("state", ["{broken", "[]", '{"foreign": {}}', '{"backend": {"pid": -1}}'])
def test_corrupt_state_blocks_start_and_stop(control, state, monkeypatch):
    control.state_file.write_text(state, encoding="utf-8")
    monkeypatch.setattr(demo.subprocess, "run", lambda *a, **kw: pytest.fail("No kill allowed"))
    monkeypatch.setattr(demo.subprocess, "Popen", lambda *a, **kw: pytest.fail("No start allowed"))
    for action in (control.start, control.stop):
        with pytest.raises(demo.ControlError, match="Estado local ilegible"):
            action()


def test_start_is_idempotent_for_healthy_owned_services(control, monkeypatch):
    state = {"backend": record(11), "frontend": record(12)}
    control.save(state)
    monkeypatch.setattr(demo.subprocess, "Popen", lambda *a, **kw: pytest.fail("Already running"))
    control.start()
    assert control.load() == state


def test_unhealthy_owned_service_is_not_restarted(control, monkeypatch):
    control.save({"backend": record(11)})
    monkeypatch.setattr(demo, "responds", lambda service: False)
    monkeypatch.setattr(demo.subprocess, "Popen", lambda *a, **kw: pytest.fail("No restart"))
    with pytest.raises(demo.ControlError, match="proceso propio sin respuesta"):
        control.start()


def test_partial_start_rolls_back_new_services_only(control, monkeypatch):
    control.save({"backend": record(11)})
    monkeypatch.setattr(demo.subprocess, "Popen", lambda *a, **kw: SimpleNamespace(pid=12, poll=lambda: 1))
    stopped = []
    monkeypatch.setattr(control, "stop_record", lambda value: stopped.append(value) or True)
    with pytest.raises(demo.ControlError, match="frontend termino"):
        control.start()
    assert stopped == [record(12)]
    assert control.load() == {"backend": record(11)}


def test_rollback_failure_keeps_reference(control, monkeypatch):
    monkeypatch.setattr(demo.subprocess, "Popen", lambda *a, **kw: SimpleNamespace(pid=12, poll=lambda: 1))
    def failed(value):
        raise demo.ControlError("Cannot stop")
    monkeypatch.setattr(control, "stop_record", failed)
    with pytest.raises(demo.ControlError):
        control.start()
    assert control.load() == {"backend": record(12)}


def test_start_timeout_rolls_back(control, monkeypatch):
    monkeypatch.setattr(demo.subprocess, "Popen", lambda *a, **kw: SimpleNamespace(pid=12, poll=lambda: None))
    monkeypatch.setattr(demo, "responds", lambda service: False)
    times = iter([0, 21])
    monkeypatch.setattr(demo.time, "monotonic", lambda: next(times))
    stopped = []
    monkeypatch.setattr(control, "stop_record", lambda value: stopped.append(value))
    with pytest.raises(demo.ControlError, match="no respondio"):
        control.start()
    assert stopped == [record(12)]
    assert control.load() == {}


def test_launch_preserves_environment_and_handles_paths_with_spaces(control, monkeypatch):
    calls = []
    monkeypatch.setenv("PYTHONPATH", "original")
    def launch(args, **kwargs):
        calls.append((args, kwargs))
        return SimpleNamespace(pid=10 + len(calls), poll=lambda: None)
    monkeypatch.setattr(demo.subprocess, "Popen", launch)
    control.start()
    assert set(control.load()) == {"backend", "frontend"}
    assert calls[0][1]["env"]["PYTHONPATH"] == str(control.root / "backend")
    assert calls[1][1]["env"]["PYTHONPATH"] == "original"
    assert os.environ["PYTHONPATH"] == "original"
    assert all(call[1]["stdin"] == demo.subprocess.DEVNULL for call in calls)


def test_explicit_database_is_passed_only_to_backend_and_recorded(control, monkeypatch, tmp_path):
    from app import database_selection
    target = tmp_path / 'Copia LAB con espacios.sqlite3'
    control.database = target
    monkeypatch.setattr(database_selection, 'select_database', lambda default, override: target)
    calls = []
    monkeypatch.setenv('MEDICCONTROL_DATABASE_PATH', 'ambient-must-not-win')
    monkeypatch.setattr(demo.subprocess, 'Popen', lambda args, **kw: calls.append(kw) or SimpleNamespace(pid=10+len(calls), poll=lambda: None))
    control.start()
    assert calls[0]['env']['MEDICCONTROL_DATABASE_PATH'] == str(target)
    assert control.load()['backend']['database'] == str(target)
    assert os.environ['MEDICCONTROL_DATABASE_PATH'] == 'ambient-must-not-win'


def test_owned_backend_from_another_database_is_not_reused_or_stopped(control, monkeypatch, tmp_path):
    control.save({'backend': {**record(11), 'database': str(tmp_path / 'other.sqlite3')}})
    monkeypatch.setattr(demo.subprocess, 'Popen', lambda *a, **kw: pytest.fail('Must not launch'))
    monkeypatch.setattr(demo.subprocess, 'run', lambda *a, **kw: pytest.fail('Must not stop'))
    with pytest.raises(demo.ControlError, match='otra base'):
        control.start()
    assert control.load()['backend']['pid'] == 11


def test_default_start_ignores_database_override_inherited_from_shell(control, monkeypatch):
    calls = []
    monkeypatch.setenv('MEDICCONTROL_DATABASE_PATH', 'ambient-must-not-win')
    monkeypatch.setattr(demo.subprocess, 'Popen', lambda args, **kw: calls.append(kw) or SimpleNamespace(pid=10+len(calls), poll=lambda: None))
    control.start()
    assert 'MEDICCONTROL_DATABASE_PATH' not in calls[0]['env']


def test_invalid_database_reference_in_process_state_is_rejected(control):
    control.save({'backend': {**record(11), 'database': {'invalid': True}}})
    with pytest.raises(demo.ControlError, match='ilegible'):
        control.load()


def test_status_does_not_adopt_or_stop_external_servers(control, monkeypatch, capsys):
    monkeypatch.setattr(demo, "port_available", lambda port: False)
    monkeypatch.setattr(demo.subprocess, "run", lambda *a, **kw: pytest.fail("No stop"))
    control.status()
    assert "no gestionado" in capsys.readouterr().out
    assert not control.state_file.exists()


def test_missing_dependencies_fail_before_start(tmp_path):
    manager = demo.DemoControl(tmp_path)
    with pytest.raises(demo.ControlError, match="Faltan dependencias"):
        manager.commands()


def test_command_configuration_is_local_and_does_not_reload(tmp_path, monkeypatch):
    python = tmp_path / ".venv" / "Scripts" / "python.exe"
    vite = tmp_path / "frontend" / "node_modules" / "vite" / "bin" / "vite.js"
    for path in (python, vite):
        path.parent.mkdir(parents=True)
        path.touch()
    monkeypatch.setattr(demo.shutil, "which", lambda name: "C:/Program Files/nodejs/node.exe")
    commands = demo.DemoControl(tmp_path).commands()
    backend, _ = commands["backend"]
    frontend, cwd = commands["frontend"]
    assert "--reload" not in backend
    assert "--no-access-log" in backend
    assert backend[backend.index("--host") + 1] == "127.0.0.1"
    assert frontend[frontend.index("--host") + 1] == "127.0.0.1"
    assert "--strictPort" in frontend
    assert cwd == tmp_path / "frontend"


@pytest.mark.skipif(os.name != "nt", reason="Windows file lock")
def test_concurrent_control_is_blocked_and_lock_is_released(tmp_path):
    first = demo.DemoControl(tmp_path)
    second = demo.DemoControl(tmp_path)
    with first.locked():
        with pytest.raises(demo.ControlError, match="otra operacion"):
            with second.locked():
                pytest.fail("Concurrent operation")
    with second.locked():
        pass


def test_taskkill_os_failure_keeps_reference(control, monkeypatch):
    control.save({"backend": record(11)})
    def failed(*args, **kwargs):
        raise OSError("Unavailable")
    monkeypatch.setattr(demo.subprocess, "run", failed)
    with pytest.raises(demo.ControlError, match="Referencias conservadas"):
        control.stop()
    assert control.load() == {"backend": record(11)}


@pytest.mark.skipif(os.name != "nt", reason="Windows process API")
def test_windows_identity_is_stable_for_current_test_process():
    identity = demo.process_identity(os.getpid())
    assert identity == demo.process_identity(os.getpid())
    assert identity["created"] > 0
    assert Path(identity["image"]).is_file()


def test_response_probe_ignores_proxies_and_limits_health_payload(monkeypatch):
    requests = []
    class Response:
        status = 200
        def read(self, size):
            assert size == 1024
            return b'{"status":"ok"}'
    class Opener:
        def open(self, url, timeout):
            requests.append((url, timeout))
            return nullcontext(Response())
    def opener(handler):
        assert handler.proxies == {}
        return Opener()
    monkeypatch.setattr(demo, "build_opener", opener)
    assert demo.responds("backend")
    assert requests == [("http://127.0.0.1:8000/health", 1)]
