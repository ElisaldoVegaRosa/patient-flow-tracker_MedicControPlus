"""LAN configuration and controller tests using fictitious files and processes."""
import json
import os
from pathlib import Path
import shutil
import subprocess
from types import SimpleNamespace

import pytest

from scripts import demo_control as demo
from scripts import demo_lan as lan


@pytest.fixture
def configured(tmp_path):
    root = tmp_path / "Proyecto con espacios"
    source = root / "frontend" / "src"
    source.mkdir(parents=True)
    (source / "App.tsx").write_text("ficticio", encoding="utf-8")
    directory = root / ".tmp" / "lan"
    directory.mkdir(parents=True)
    for name in ("server.pfx", "ca.pem", "server.cer"):
        (directory / name).write_bytes(b"certificado-ficticio")
    (directory / "dist").mkdir()
    (directory / "dist" / "index.html").write_text("demo", encoding="utf-8")
    path = directory / "network.json"
    path.write_text(json.dumps({"schema": 1, "host": "192.168.100.7", "source_signature": lan.source_signature(root)}), encoding="utf-8")
    return root, path


@pytest.mark.parametrize("address", ["127.0.0.1", "0.0.0.0", "8.8.8.8", "::1", "example.com", "172.32.1.1", None])
def test_only_explicit_rfc1918_ipv4_is_accepted(address):
    with pytest.raises(ValueError):
        lan.private_address(address)


def test_configuration_tracks_certificate_changes_and_rejects_stale_build(configured):
    root, path = configured
    first = lan.load_configuration(root, path)
    assert first["url"] == "https://192.168.100.7:5443"
    (path.parent / "server.pfx").write_bytes(b"cambio-ficticio")
    assert lan.load_configuration(root, path)["signature"] != first["signature"]
    (root / "frontend" / "src" / "App.tsx").write_text("cambio", encoding="utf-8")
    with pytest.raises(ValueError, match="frontend cambio"):
        lan.load_configuration(root, path)


@pytest.mark.parametrize("file", ["public/icon.svg", "tsconfig.app.json"])
def test_public_assets_and_compiler_options_invalidate_the_prepared_build(configured, file):
    root, path = configured
    target = root / "frontend" / file
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("cambio-ficticio", encoding="utf-8")
    with pytest.raises(ValueError, match="frontend cambio"):
        lan.load_configuration(root, path)


def test_missing_build_is_rejected_before_start(configured):
    root, path = configured
    (path.parent / "dist" / "index.html").unlink()
    with pytest.raises(ValueError, match="index.html"):
        lan.load_configuration(root, path)


@pytest.mark.parametrize("failed_stage", [None, "certificate", "build", "check"])
def test_prepare_is_explicit_preserves_environment_and_only_publishes_valid_build(tmp_path, monkeypatch, failed_stage):
    root = tmp_path / "Proyecto con espacios"
    root.mkdir()
    calls = []
    monkeypatch.setattr(lan.shutil, "which", lambda name: name)
    monkeypatch.setattr(lan.subprocess, "CREATE_NO_WINDOW", 0, raising=False)
    monkeypatch.setenv("VITE_API_URL", "http://ambiente-ficticio")
    def run(arguments, **kwargs):
        stage = ("certificate", "build", "check")[len(calls)]
        calls.append((arguments, kwargs))
        if stage == "certificate":
            directory = Path(arguments[arguments.index("-OutputDirectory") + 1])
            directory.mkdir(parents=True)
            for name in ("server.pfx", "ca.pem", "server.cer"):
                (directory / name).write_bytes(b"ficticio")
        if stage == "build":
            output = Path(arguments[-1])
            output.mkdir()
            (output / "index.html").write_text("ficticio", encoding="utf-8")
        return SimpleNamespace(returncode=int(stage == failed_stage), stdout=b"CA SHA-256: ficticia")
    monkeypatch.setattr(lan.subprocess, "run", run)
    if failed_stage:
        with pytest.raises(ValueError):
            lan.prepare(root, "192.168.100.7")
        assert list((root / ".tmp").rglob("network.json")) == []
    else:
        path = lan.prepare(root, "192.168.100.7")
        assert lan.load_configuration(root, path)["host"] == "192.168.100.7"
        assert calls[1][1]["env"]["VITE_API_URL"] == "/api"
        assert len(calls) == 3
    assert os.environ["VITE_API_URL"] == "http://ambiente-ficticio"


def test_gateway_state_requires_config_and_signature(tmp_path):
    manager = demo.DemoControl(tmp_path)
    manager.save({"gateway": {"pid": 11, "created": 110, "image": "node.exe"}})
    with pytest.raises(demo.ControlError, match="ilegible"):
        manager.load()


def test_lan_commands_keep_api_and_development_frontend_on_loopback(configured, monkeypatch):
    root, path = configured
    for file in (root / ".venv" / "Scripts" / "python.exe", root / "frontend" / "node_modules" / "vite" / "bin" / "vite.js"):
        file.parent.mkdir(parents=True, exist_ok=True)
        file.touch()
    monkeypatch.setattr(demo.shutil, "which", lambda name: "node.exe")
    commands = demo.DemoControl(root, lan_config=path).commands()
    for name in ("backend", "frontend"):
        arguments = commands[name][0]
        assert arguments[arguments.index("--host") + 1] == "127.0.0.1"
    assert commands["gateway"][0][-2:] == [str(root / "scripts" / "demo_lan_gateway.mjs"), str(path)]


def test_network_change_does_not_adopt_or_stop_running_gateway(configured, monkeypatch):
    root, path = configured
    manager = demo.DemoControl(root, lan_config=path)
    configuration = lan.load_configuration(root, path)
    record = {"pid": 11, "created": 110, "image": "node.exe", "lan_config": str(path), "network_signature": configuration["signature"]}
    manager.save({"gateway": record})
    (path.parent / "server.pfx").write_bytes(b"nuevo-ficticio")
    monkeypatch.setattr(manager, "owns", lambda value: True)
    monkeypatch.setattr(manager, "commands", lambda: {key: ([key], root) for key in ("backend", "frontend", "gateway")})
    monkeypatch.setattr(demo, "port_available", lambda *args: True)
    monkeypatch.setattr(demo.subprocess, "Popen", lambda *args, **kwargs: pytest.fail("No launch"))
    monkeypatch.setattr(manager, "stop_record", lambda value: pytest.fail("No stop"))
    with pytest.raises(demo.ControlError, match="cambiaron"):
        manager.start()
    assert manager.load()["gateway"] == record


def test_occupied_lan_port_aborts_before_launching_anything(configured, monkeypatch):
    root, path = configured
    manager = demo.DemoControl(root, lan_config=path)
    monkeypatch.setattr(manager, "commands", lambda: {key: ([key], root) for key in ("backend", "frontend", "gateway")})
    monkeypatch.setattr(demo, "port_available", lambda port, *args: port != 5443)
    monkeypatch.setattr(demo.subprocess, "Popen", lambda *args, **kwargs: pytest.fail("No launch"))
    with pytest.raises(demo.ControlError, match="5443 ocupado"):
        manager.start()
    assert manager.load() == {}


def test_failed_gateway_start_preserves_existing_backend_and_frontend(configured, monkeypatch):
    root, path = configured
    manager = demo.DemoControl(root, lan_config=path)
    existing = {name: {"pid": pid, "created": pid * 10, "image": "node.exe"} for name, pid in (("backend", 11), ("frontend", 12))}
    manager.save(existing)
    monkeypatch.setattr(manager, "owns", lambda value: True)
    monkeypatch.setattr(manager, "commands", lambda: {key: ([key], root) for key in ("backend", "frontend", "gateway")})
    monkeypatch.setattr(demo, "responds", lambda service: True)
    monkeypatch.setattr(demo, "port_available", lambda *args: True)
    monkeypatch.setattr(demo, "process_identity", lambda pid: {"created": 130, "image": "node.exe"})
    monkeypatch.setattr(demo.subprocess, "CREATE_NO_WINDOW", 0, raising=False)
    monkeypatch.setattr(demo.subprocess, "Popen", lambda *args, **kwargs: SimpleNamespace(pid=13, poll=lambda: 1))
    stopped = []
    monkeypatch.setattr(manager, "stop_record", lambda record: stopped.append(record))
    with pytest.raises(demo.ControlError, match="gateway termino"):
        manager.start()
    assert manager.load() == existing
    assert [record["pid"] for record in stopped] == [13]


@pytest.mark.skipif(os.name != "nt" or not shutil.which("node.exe"), reason="Windows certificate preparation")
def test_windows_certificate_files_validate_in_node_without_installation():
    root = Path(__file__).resolve().parents[2]
    # The certificate helper requires a fresh directory inside this repository.
    from uuid import uuid4
    directory = root / ".tmp" / "certificate-tests" / uuid4().hex
    result = subprocess.run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(root / "scripts" / "create_demo_certificate.ps1"), "-Address", "192.168.100.7", "-OutputDirectory", str(directory)], capture_output=True)
    assert result.returncode == 0, result.stderr.decode(errors="replace")
    (directory / "dist").mkdir()
    (directory / "dist" / "index.html").write_text("demo", encoding="utf-8")
    config = directory / "network.json"
    config.write_text(json.dumps({"schema": 1, "host": "192.168.100.7"}), encoding="utf-8")
    checked = subprocess.run([shutil.which("node.exe"), str(root / "scripts" / "demo_lan_gateway.mjs"), "--check", str(config)], capture_output=True)
    assert checked.returncode == 0, checked.stderr.decode(errors="replace")
    assert b"CA SHA-256" in checked.stdout
    assert not (directory / "root.pfx").exists()
    config.write_text(json.dumps({"schema": 1, "host": "192.168.100.8"}), encoding="utf-8")
    mismatched = subprocess.run([shutil.which("node.exe"), str(root / "scripts" / "demo_lan_gateway.mjs"), "--check", str(config)], capture_output=True)
    assert mismatched.returncode != 0
