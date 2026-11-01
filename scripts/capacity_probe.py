"""Bounded HTTP observation on a new synthetic database; never targets the live demo.

Default invocation describes the plan. --execute is an explicit separate step.
This is not a browser/device benchmark or a certification for clinical operation.
"""
from __future__ import annotations

import argparse
import hashlib
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import json
import math
import os
from pathlib import Path
import platform
import secrets
import socket
import sqlite3
import subprocess
import sys
import tempfile
from threading import Barrier, Event, Lock
from time import monotonic, perf_counter
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
RUNS_ROOT = ROOT / '.tmp' / 'capacity-runs'
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'backend'))
ROLES = ('RECEPTION', 'NURSE', 'DOCTOR', 'LAB', 'SUPERVISOR')
ROUNDS = 6
INTERVAL = 15
REQUEST_TIMEOUT = 10
OWN_EPISODES = 30
BACKGROUND_EPISODES = 30
LAB_ORDERS = 10


class ProbeError(RuntimeError):
    """Static operational errors only: never include response bodies or credentials."""


def plan(sessions):
    if sessions not in (5, 15, 30):
        raise ProbeError('Solo se admiten etapas de 5, 15 o 30 sesiones')
    return {'sessions': sessions, 'roles': {role: sessions // 5 for role in ROLES},
            'rounds': ROUNDS, 'interval_seconds': INTERVAL,
            'scheduled_read_window_seconds': (ROUNDS - 1) * INTERVAL,
            'request_timeout_seconds': REQUEST_TIMEOUT, 'active_episodes_at_start': 61,
            'structured_lab_orders': LAB_ORDERS, 'read_requests': sessions * ROUNDS * 3,
            'independent_writers': sessions * 4 // 5, 'conflict_writers': sessions * 2 // 5,
            'measured_requests_on_success': sessions * ROUNDS * 3 + sessions + sessions * 13 // 5 + 1,
            'isolation': 'Nueva base sintetica y proceso propio en loopback; sin URL/base externas',
            'latency_sla': None, 'automatic_stage_escalation': False}


def new_run(sessions):
    plan(sessions)
    if not RUNS_ROOT.resolve().is_relative_to(ROOT.resolve()):
        raise ProbeError('El directorio de resultados debe permanecer en el proyecto')
    RUNS_ROOT.mkdir(parents=True, exist_ok=True)
    directory = Path(tempfile.mkdtemp(prefix=f'capacity-{sessions}-', dir=RUNS_ROOT)).resolve()
    manifest = {'version': 1, 'run_id': uuid4().hex, 'sessions': sessions}
    (directory / 'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
    return directory, manifest


def private_database(directory, run_id, *, exists=True):
    directory = Path(directory)
    if directory.is_symlink() or not directory.resolve().is_relative_to(RUNS_ROOT.resolve()):
        raise ProbeError('El ensayo requiere un directorio privado nuevo')
    manifest = json.loads((directory / 'manifest.json').read_text(encoding='utf-8'))
    if manifest.get('version') != 1 or manifest.get('run_id') != run_id:
        raise ProbeError('El identificador del ensayo no coincide')
    plan(manifest.get('sessions'))
    path = directory.resolve() / 'capacity.sqlite3'
    if path.is_symlink() or (exists and not path.is_file()):
        raise ProbeError('La base privada no esta disponible')
    return path


@dataclass
class Actor:
    index: int
    role: str
    username: str = field(repr=False)
    password: str = field(repr=False)
    episode_id: int = 0
    client: object = field(default=None, repr=False)


def prepare(directory, manifest):
    # Parent-side schema imports must not inspect a database selected by the shell.
    selected = os.environ.pop('MEDICCONTROL_DATABASE_PATH', None)
    try:
        from app.database import get_connection, initialize_database
        from app.security import hash_password
        from app.laboratory_schema import migrate_laboratory_schema
        from app.patient_communications import migrate as migrate_communications
    finally:
        if selected is not None:
            os.environ['MEDICCONTROL_DATABASE_PATH'] = selected

    path = private_database(directory, manifest['run_id'], exists=False)
    if path.exists():
        raise ProbeError('La preparacion no sobrescribe archivos existentes')
    actors = []
    now = datetime.now(timezone.utc).isoformat()
    started = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
    initial = get_connection(path)
    try:
        initialize_database(initial, {}, hash_password, lambda: now)
    finally:
        initial.close()
    c = get_connection(path)
    try:
        migrate_laboratory_schema(c)
        migrate_communications(c)
        for index in range(manifest['sessions']):
            role = ROLES[index % len(ROLES)]
            actor = Actor(index, role, f'capacity.worker{index:02}', secrets.token_urlsafe(24))
            salt, password_hash = hash_password(actor.password)
            c.execute('''INSERT INTO users(username,display_name,password_hash,password_salt,role,active,created_at)
                VALUES (?,?,?,?,?,1,?)''', (actor.username, f'Capacidad ficticia {index}', password_hash, salt, role, now))
            actors.append(actor)
        episode_ids = []
        for index in range(OWN_EPISODES + BACKGROUND_EPISODES + 1):
            patient = c.execute("INSERT INTO patients(name,identity_status) VALUES (?,'PROVISIONAL')",
                                (f'Capacidad ficticia {index}',)).lastrowid
            episode = c.execute('''INSERT INTO episodes(patient_id,qr_token,status,priority,location,started_at)
                VALUES (?,?,'ACTIVE',3,'Espera ficticia',?)''', (patient, secrets.token_urlsafe(24), started)).lastrowid
            c.execute("INSERT INTO events(episode_id,type,username,created_at,note) VALUES (?,'EPISODE_CREATED',?,?,?)",
                      (episode, actors[0].username, started, 'Ingreso sintetico para capacidad, sin valor clinico'))
            episode_ids.append(episode)
        for actor in actors:
            actor.episode_id = episode_ids[actor.index]
        doctor_id = c.execute('SELECT id FROM users WHERE username=?', (actors[2].username,)).fetchone()[0]
        for episode in episode_ids[OWN_EPISODES:OWN_EPISODES + LAB_ORDERS]:
            task = c.execute("INSERT INTO tasks(episode_id,title,service,status,created_at) VALUES (?,'Orden sintetica','LAB','PENDING',?)",
                             (episode, started)).lastrowid
            c.execute('INSERT INTO lab_orders(task_id,episode_id,created_by,created_at) VALUES (?,?,?,?)',
                      (task, episode, doctor_id, started))
            for kind in ('BLOOD', 'URINE'):
                analysis = c.execute('INSERT INTO lab_analyses(order_task_id,title) VALUES (?,?)',
                                     (task, f'Analitica sintetica {kind}')).lastrowid
                specimen = c.execute('INSERT INTO lab_specimens(order_task_id,kind) VALUES (?,?)', (task, kind)).lastrowid
                c.execute('INSERT INTO lab_analysis_specimens(order_task_id,analysis_id,specimen_id) VALUES (?,?,?)',
                          (task, analysis, specimen))
        c.commit()
    finally:
        c.close()
    return path, actors, episode_ids[-1]


def serve(directory, run_id):
    path = private_database(directory, run_id)
    # Force the private path before importing the application. No --reload/workers.
    os.environ['MEDICCONTROL_DATABASE_PATH'] = str(path)
    from app.main import app
    import uvicorn
    manifest = json.loads((Path(directory) / 'manifest.json').read_text(encoding='utf-8'))

    @app.get('/__capacity_probe', include_in_schema=False)
    def identity():
        return {'run_id': run_id, 'database': str(path)}

    uvicorn.run(app, host='127.0.0.1', port=manifest['port'], workers=1, access_log=False, log_level='warning')


def launch(directory, manifest):
    private_database(directory, manifest['run_id'])
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
    if port in (8000, 5173):
        raise ProbeError('El ensayo no puede usar los puertos del demo')
    manifest = {**manifest, 'port': port}
    (directory / 'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
    environment = {**os.environ, 'PYTHONPATH': str(ROOT / 'backend'),
                   'MEDICCONTROL_DATABASE_PATH': str(directory / 'capacity.sqlite3')}
    log = (directory / 'server.log').open('w', encoding='utf-8')
    try:
        process = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), '--serve', str(directory), manifest['run_id']],
                                   cwd=ROOT, env=environment, stdout=log, stderr=subprocess.STDOUT,
                                   creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    finally:
        log.close()
    return process, f'http://127.0.0.1:{port}'


def stop(process):
    if process is None or process.poll() is not None:
        return
    process.terminate()  # Only the handle created by this runner, never a discovered PID.
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=10)


def verify_server(client, process, directory, manifest):
    import httpx
    deadline = monotonic() + 30
    expected = {'run_id': manifest['run_id'], 'database': str(private_database(directory, manifest['run_id']))}
    while monotonic() < deadline:
        if process.poll() is not None:
            raise ProbeError('La instancia privada no pudo iniciar; revisar server.log')
        try:
            response = client.get('/__capacity_probe')
        except httpx.TransportError:
            Event().wait(0.1)
            continue
        if response.status_code != 200 or response.json() != expected:
            raise ProbeError('La instancia no coincide; no se enviaron credenciales ni escrituras')
        return
    raise ProbeError('La instancia privada no estuvo disponible dentro del limite de arranque')


def summarize(samples, *, by_role=False):
    groups = {}
    for row in samples:
        key = f"{row['phase']}:{row['role']}:{row['operation']}" if by_role else f"{row['phase']}:{row['operation']}"
        groups.setdefault(key, []).append(row)
    result = {}
    for key, rows in sorted(groups.items()):
        values = sorted(row['milliseconds'] for row in rows)
        status = {}
        for row in rows:
            label = str(row['status']) if row['status'] is not None else 'transport_error'
            status[label] = status.get(label, 0) + 1
        result[key] = {'count': len(rows), 'p50_ms': values[math.ceil(len(values) * .50) - 1],
                       'p95_ms': values[math.ceil(len(values) * .95) - 1], 'max_ms': values[-1],
                       'statuses': status, 'unexpected': sum(not row['expected'] for row in rows)}
    return result


class Workload:
    def __init__(self):
        self.samples = []
        self.lock = Lock()
        self.aborted = Event()

    def call(self, actor, phase, operation, method, path, expected=(200,), **kwargs):
        if self.aborted.is_set():
            raise ProbeError('Se detuvo el ensayo por una incidencia anterior')
        start, status, valid = perf_counter(), None, False
        try:
            response = actor.client.request(method, path, **kwargs)
            status = response.status_code
            if status not in expected:
                raise ProbeError(f'Respuesta inesperada en {phase}/{operation}: HTTP {status}')
            payload = response.json()
            valid = status in expected and isinstance(payload, dict)
            if not valid:
                raise ProbeError(f'Respuesta inesperada en {phase}/{operation}: HTTP {status}')
            return status, payload
        except Exception as error:
            self.aborted.set()
            if isinstance(error, ProbeError):
                raise
            raise ProbeError(f'Fallo de transporte o formato en {phase}/{operation}') from None
        finally:
            with self.lock:
                self.samples.append({'phase': phase, 'operation': operation, 'worker': actor.index,
                                     'role': actor.role, 'status': status, 'expected': valid,
                                     'milliseconds': round((perf_counter() - start) * 1000, 3)})


def source_identity():
    files = sorted([*(ROOT / 'backend' / 'app').rglob('*.py'), *(ROOT / 'backend' / 'migrations').glob('*.sql')])
    digest = hashlib.sha256()
    for path in files:
        digest.update(path.relative_to(ROOT).as_posix().encode())
        digest.update(b'\0')
        digest.update(path.read_bytes())
    revision = None
    try:
        result = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, capture_output=True, text=True,
                                timeout=5, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        if result.returncode == 0 and len(result.stdout.strip()) == 40:
            revision = result.stdout.strip()
    except (OSError, subprocess.TimeoutExpired):
        pass
    return {'revision': revision, 'backend_files': len(files), 'backend_sha256': digest.hexdigest(),
            'runner_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}


def parallel(actors, function, aborted=None):
    with ThreadPoolExecutor(max_workers=len(actors)) as pool:
        futures = []
        try:
            futures = [pool.submit(function, actor) for actor in actors]
            return [future.result() for future in futures]
        except BaseException:
            if aborted is not None:
                aborted.set()
            for future in futures:
                future.cancel()
            raise


def login(work, actor):
    _, result = work.call(actor, 'login', 'session', 'POST', '/auth/login',
                          json={'username': actor.username, 'password': actor.password})
    token = result.get('access_token')
    if not isinstance(token, str) or not token:
        raise ProbeError('La autenticacion no devolvio una sesion utilizable')
    actor.client.headers['Authorization'] = f'Bearer {token}'


def reads(work, actors):
    barrier = Barrier(len(actors))
    paths = {'RECEPTION': '/communications', 'NURSE': '/care/queue', 'DOCTOR': '/care/queue',
             'LAB': '/lab/orders?status=PENDING', 'SUPERVISOR': '/operations/delays'}

    def worker(actor):
        barrier.wait(timeout=REQUEST_TIMEOUT)
        start = monotonic()
        for index in range(ROUNDS):
            if work.aborted.wait(max(0, start + index * INTERVAL - monotonic())):
                raise ProbeError('Lecturas canceladas tras una incidencia')
            for operation, path in (('dashboard', '/dashboard'), ('role_queue', paths[actor.role]),
                                    ('episode', f'/episodes/{actor.episode_id}')):
                work.call(actor, 'reads', operation, 'GET', path)
    parallel(actors, worker, work.aborted)


def independent_writes(work, actors):
    writers = [actor for actor in actors if actor.role != 'LAB']
    barrier = Barrier(len(writers))

    def worker(actor):
        marker = f'Capacidad independiente {actor.index}'
        headers = {'Idempotency-Key': str(uuid4())}
        if actor.role == 'RECEPTION':
            path, expected = '/episodes', (201,)
            body = {'provisional': True, 'name': marker}
            kind = 'EPISODE_CREATED'
        else:
            _, before = work.call(actor, 'write_setup', 'episode', 'GET', f'/episodes/{actor.episode_id}')
            expected = (200,)
            if actor.role in ('NURSE', 'SUPERVISOR'):
                path = f'/episodes/{actor.episode_id}/triage'
                body = {'priority': 3, 'location': marker, 'assigned_to': 'Referencia ficticia'}
                headers['If-Match'] = before['triage_version']
                kind = 'TRIAGE'
            else:
                path = f'/episodes/{actor.episode_id}/medical-evaluation'
                body = {'diagnosis': 'Caso de capacidad ficticio', 'clinical_note': marker}
                kind = 'MEDICAL_EVALUATION'
        barrier.wait(timeout=REQUEST_TIMEOUT)
        _, saved = work.call(actor, 'writes', kind, 'POST', path, expected, headers=headers, json=body)
        _, replayed = work.call(actor, 'replay', kind, 'POST', path, expected, headers=headers, json=body)
        if saved['id'] != replayed['id']:
            raise ProbeError('Un reintento cambio el identificador del episodio')
        return {'episode_id': saved['id'], 'kind': kind, 'marker': marker, 'username': actor.username}
    return parallel(writers, worker, getattr(work, 'aborted', None))


def conflict_writes(work, actors, episode_id):
    writers = [actor for actor in actors if actor.role in ('NURSE', 'SUPERVISOR')]
    _, before = work.call(writers[0], 'conflict_setup', 'episode', 'GET', f'/episodes/{episode_id}')
    barrier = Barrier(len(writers))

    def worker(actor):
        marker = f'Capacidad conflicto {actor.index}'
        headers = {'If-Match': before['triage_version'], 'Idempotency-Key': str(uuid4())}
        body = {'priority': 3, 'location': marker, 'assigned_to': 'Referencia ficticia'}
        barrier.wait(timeout=REQUEST_TIMEOUT)
        status, _ = work.call(actor, 'conflict', 'triage', 'POST', f'/episodes/{episode_id}/triage',
                               (200, 409), headers=headers, json=body)
        return {'status': status, 'marker': marker, 'username': actor.username}
    outcomes = parallel(writers, worker, getattr(work, 'aborted', None))
    winners = [value for value in outcomes if value['status'] == 200]
    if len(winners) != 1 or sum(value['status'] == 409 for value in outcomes) != len(writers) - 1:
        raise ProbeError('No se protegio la version compartida como se esperaba')
    return winners[0]


def verify_data(path, actors, ledger, shared_id, winner):
    from scripts.demo_db_backup import inspect_database
    counts = inspect_database(path)
    created = sum(actor.role == 'RECEPTION' for actor in actors)
    initial = OWN_EPISODES + BACKGROUND_EPISODES + 1
    if counts != {'patients': initial + created, 'episodes': initial + created}:
        raise ProbeError('El numero de pacientes/episodios no coincide; posible duplicacion')
    with sqlite3.connect(path.as_uri() + '?mode=ro', uri=True) as c:
        for item in ledger:
            events = c.execute('SELECT username,note FROM events WHERE episode_id=? AND type=?',
                               (item['episode_id'], item['kind'])).fetchall()
            if len(events) != 1 or events[0][0] != item['username']:
                raise ProbeError('Una escritura o su autoria no se conservo exactamente una vez')
            if item['kind'] == 'TRIAGE':
                stored = c.execute('SELECT location FROM episodes WHERE id=?', (item['episode_id'],)).fetchone()[0]
                if stored != item['marker']:
                    raise ProbeError('Una ubicacion independiente fue sobrescrita')
            elif item['kind'] == 'MEDICAL_EVALUATION' and item['marker'] not in events[0][1]:
                raise ProbeError('La evaluacion independiente no coincide')
        row = c.execute('SELECT location FROM episodes WHERE id=?', (shared_id,)).fetchone()
        events = c.execute("SELECT username FROM events WHERE episode_id=? AND type='TRIAGE'", (shared_id,)).fetchall()
        if row[0] != winner['marker'] or events != [(winner['username'],)]:
            raise ProbeError('El conflicto compartido perdio o duplico el cambio confirmado')
        if c.execute('SELECT COUNT(*) FROM events').fetchone()[0] != initial + len(ledger) + 1:
            raise ProbeError('El total de eventos no coincide')
        if c.execute('SELECT COUNT(*) FROM tasks').fetchone()[0] != LAB_ORDERS:
            raise ProbeError('Las ordenes sinteticas cambiaron inesperadamente')
        if c.execute('SELECT COUNT(DISTINCT user_id) FROM sessions').fetchone()[0] != len(actors):
            raise ProbeError('No se observaron todas las sesiones personales')
    return {**counts, 'integrity': True, 'foreign_keys': True, 'exactly_once': True,
            'independent_writes': len(ledger), 'shared_conflict_protected': True}


def execute(sessions):
    import httpx
    directory, manifest = new_run(sessions)
    started = monotonic()
    report = {'plan': plan(sessions), 'run_id': manifest['run_id'], 'completed': False,
              'started_at': datetime.now(timezone.utc).isoformat(),
              'source': source_identity(),
              'environment': {'system': platform.system(), 'python': platform.python_version(),
                              'logical_cpus': os.cpu_count()}, 'latency_sla_evaluated': False}
    process, actors, work = None, [], Workload()
    try:
        path, actors, shared_id = prepare(directory, manifest)
        process, base = launch(directory, manifest)
        report['private_address'] = base
        with httpx.Client(base_url=base, timeout=REQUEST_TIMEOUT, trust_env=False, follow_redirects=False) as probe:
            verify_server(probe, process, directory, manifest)
        for actor in actors:
            actor.client = httpx.Client(base_url=base, timeout=REQUEST_TIMEOUT, trust_env=False, follow_redirects=False)
        parallel(actors, lambda actor: login(work, actor), work.aborted)
        reads(work, actors)
        ledger = independent_writes(work, actors)
        winner = conflict_writes(work, actors, shared_id)
        report['checks'] = verify_data(path, actors, ledger, shared_id, winner)
        if len(work.samples) != report['plan']['measured_requests_on_success']:
            raise ProbeError('No se completaron todas las operaciones del plan')
        report['completed'] = True
    except KeyboardInterrupt:
        report['error'] = 'Interrumpido por operador'
    except Exception as error:
        report['error'] = str(error) if isinstance(error, ProbeError) else f'Fallo interno: {type(error).__name__}'
    finally:
        for actor in actors:
            if actor.client:
                try:
                    actor.client.close()
                except Exception:
                    report['completed'] = False
                    report['error'] = 'No se pudo cerrar una conexion del ensayo'
        try:
            stop(process)
        except Exception:
            report['completed'] = False
            report['error'] = 'No se pudo confirmar la detencion del proceso privado'
        report['measurements'] = summarize(work.samples)
        report['by_role'] = summarize(work.samples, by_role=True)
        report['requests'] = len(work.samples)
        report['elapsed_seconds'] = round(monotonic() - started, 3)
        (directory / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return directory / 'report.json', report


def main(argv=None):
    args = list(sys.argv[1:] if argv is None else argv)
    if args[:1] == ['--serve']:
        if len(args) != 3:
            return 2
        serve(Path(args[1]), args[2])
        return 0
    parser = argparse.ArgumentParser(description='Observacion multiusuario aislada; sin --execute solo muestra el plan')
    parser.add_argument('--sessions', type=int, choices=(5, 15, 30), default=5)
    parser.add_argument('--execute', action='store_true')
    values = parser.parse_args(args)
    if not values.execute:
        print(json.dumps(plan(values.sessions), ensure_ascii=False, indent=2))
        return 0
    output, report = execute(values.sessions)
    print(json.dumps({'completed': report['completed'], 'report': str(output), 'error': report.get('error')}, ensure_ascii=False))
    return 0 if report['completed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
