"""Local Windows demo control. Never adopt a process found only by port or name."""
import argparse
from contextlib import contextmanager
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import time
from urllib.request import ProxyHandler, build_opener


class ControlError(RuntimeError):
    pass


PORTS = {"backend": 8000, "frontend": 5173}


def process_identity(pid):
    """Creation time + executable prevents stopping a recycled PID. Windows only."""
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.GetProcessTimes.argtypes = [wintypes.HANDLE] + [ctypes.POINTER(wintypes.FILETIME)] * 4
    kernel.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
    handle = kernel.OpenProcess(0x1000, False, pid)
    if not handle:
        if ctypes.get_last_error() == 87:
            return None
        raise ControlError("No se puede verificar un proceso; no se detendra.")
    try:
        times = [wintypes.FILETIME() for _ in range(4)]
        if not kernel.GetProcessTimes(handle, *(ctypes.byref(value) for value in times)):
            raise ControlError("No se puede verificar la fecha del proceso.")
        image = ctypes.create_unicode_buffer(32768)
        size = wintypes.DWORD(len(image))
        if not kernel.QueryFullProcessImageNameW(handle, 0, image, ctypes.byref(size)):
            raise ControlError("No se puede verificar el ejecutable del proceso.")
        return {"created": (times[0].dwHighDateTime << 32) | times[0].dwLowDateTime,
                "image": os.path.normcase(image.value)}
    finally:
        kernel.CloseHandle(handle)


def port_available(port):
    with socket.socket() as probe:
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        try:
            probe.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def responds(service):
    url = f"http://127.0.0.1:{PORTS[service]}" + ("/health" if service == "backend" else "/")
    try:
        # Do not send local diagnostics through a configured external proxy.
        with build_opener(ProxyHandler({})).open(url, timeout=1) as response:
            if service == "backend":
                return response.status == 200 and json.loads(response.read(1024)).get("status") == "ok"
            return response.status == 200
    except (OSError, ValueError):
        return False


class DemoControl:
    def __init__(self, root, database=None):
        self.root = Path(root).resolve()
        self.directory = self.root / ".tmp" / "demo-control"
        self.state_file = self.directory / "processes.json"
        self.database = Path(database).resolve() if database is not None else None

    @contextmanager
    def locked(self):
        import msvcrt
        self.directory.mkdir(parents=True, exist_ok=True)
        with (self.directory / "control.lock").open("a+b") as lock:
            if os.fstat(lock.fileno()).st_size == 0:
                lock.write(b"0")
                lock.flush()
            lock.seek(0)
            try:
                msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError:
                raise ControlError("Hay otra operacion del controlador en curso.") from None
            try:
                yield
            finally:
                lock.seek(0)
                msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)

    def load(self):
        if not self.state_file.exists():
            return {}
        try:
            state = json.loads(self.state_file.read_text(encoding="utf-8"))
            if not isinstance(state, dict) or any(key not in PORTS for key in state):
                raise ValueError()
            for record in state.values():
                if (not isinstance(record, dict) or type(record.get("pid")) is not int
                        or record["pid"] <= 0 or type(record.get("created")) is not int
                        or record["created"] <= 0 or not isinstance(record.get("image"), str)
                        or not record["image"]):
                    raise ValueError()
                if 'database' in record and (not isinstance(record['database'], str) or not Path(record['database']).is_absolute()):
                    raise ValueError()
            return state
        except (ValueError, OSError):
            raise ControlError("Estado local ilegible. No se iniciaran ni detendran procesos; revisa processes.json.") from None

    def save(self, state):
        self.directory.mkdir(parents=True, exist_ok=True)
        temporary = self.state_file.with_suffix(".new")
        temporary.write_text(json.dumps(state, indent=2), encoding="utf-8")
        temporary.replace(self.state_file)

    def owns(self, record):
        identity = process_identity(record["pid"])
        return identity == {key: record[key] for key in ("created", "image")}

    def commands(self):
        python = self.root / ".venv" / "Scripts" / "python.exe"
        vite = self.root / "frontend" / "node_modules" / "vite" / "bin" / "vite.js"
        node = shutil.which("node.exe")
        if not python.is_file() or not vite.is_file() or not node:
            raise ControlError("Faltan dependencias: .venv, Node.js o frontend/node_modules. Consulta DEMO_OPERATIONS.md.")
        return {
            "backend": ([str(python), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1",
                         "--port", "8000", "--no-access-log"], self.root),
            "frontend": ([node, str(vite), "--host", "127.0.0.1", "--port", "5173", "--strictPort"], self.root / "frontend"),
        }

    def stop_record(self, record):
        if not self.owns(record):
            return False
        result = subprocess.run(["taskkill.exe", "/PID", str(record["pid"]), "/T", "/F"],
                                capture_output=True, check=False,
                                creationflags=subprocess.CREATE_NO_WINDOW)
        if result.returncode and self.owns(record):
            raise ControlError("No se pudo detener el proceso propio; se conserva su referencia.")
        return True

    def start(self):
        if self.database is not None:
            import sys
            sys.path.insert(0, str(self.root / 'backend'))
            from app.database_selection import select_database
            try:
                select_database(self.root / 'backend' / 'clinical.db', str(self.database))
            except ValueError as error:
                raise ControlError(str(error)) from error
        commands = self.commands()
        state = self.load()
        pending = []
        for service, port in PORTS.items():
            if service in state and self.owns(state[service]):
                if service == 'backend':
                    default = self.root / 'backend' / 'clinical.db'
                    current = Path(state[service].get('database', str(default))).resolve()
                    if current != (self.database or default).resolve():
                        raise ControlError('El backend propio usa otra base. Deten el demo antes de cambiar de base.')
                if not responds(service):
                    raise ControlError(f"{service}: proceso propio sin respuesta; revisa los logs antes de reiniciar.")
                continue
            if not port_available(port):
                raise ControlError(f"Puerto {port} ocupado por un servicio no gestionado. No se modifico; usa Status.")
            pending.append(service)
        created = []
        try:
            for service in pending:
                arguments, cwd = commands[service]
                env = os.environ.copy()
                if service == "backend":
                    env["PYTHONPATH"] = str(self.root / "backend")
                    env.pop('MEDICCONTROL_DATABASE_PATH', None)
                    if self.database is not None:
                        env['MEDICCONTROL_DATABASE_PATH'] = str(self.database)
                with (self.directory / f"{service}.log").open("ab") as output:
                    process = subprocess.Popen(arguments, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                               stdout=output, stderr=output,
                                               creationflags=subprocess.CREATE_NO_WINDOW)
                identity = process_identity(process.pid)
                if identity is None:
                    raise ControlError(f"{service} termino al iniciar. Consulta su log.")
                record = {"pid": process.pid, **identity}
                if service == 'backend' and self.database is not None:
                    record['database'] = str(self.database)
                created.append((service, record))
                state[service] = record
                self.save(state)
                deadline = time.monotonic() + 20
                while True:
                    if process.poll() is not None:
                        raise ControlError(f"{service} termino al iniciar. Consulta su log.")
                    if responds(service):
                        break
                    if time.monotonic() >= deadline:
                        raise ControlError(f"{service} no respondio en 20 s. Consulta su log.")
                    time.sleep(0.3)
        except BaseException:
            # Roll back this invocation only; preserve services that were already running.
            for service, record in reversed(created):
                try:
                    self.stop_record(record)
                    state.pop(service, None)
                except (ControlError, OSError):
                    pass  # Keep the reference so Stop can be retried.
            self.save(state)
            raise
        print("Demo disponible en http://localhost:5173/ (solo esta PC).")

    def stop(self):
        state = self.load()
        failures = []
        for service in reversed(list(state)):
            try:
                stopped = self.stop_record(state[service])
                print(f"{service}: " + ("detenido" if stopped else "referencia caducada; no se detuvo ningun proceso"))
                del state[service]
                self.save(state)
            except (ControlError, OSError):
                failures.append(service)
        if failures:
            raise ControlError("No se pudo verificar/detener: " + ", ".join(failures) + ". Referencias conservadas.")
        print("No se detienen servidores abiertos desde otras terminales.")

    def status(self):
        state = self.load()
        for service, port in PORTS.items():
            owned = service in state and self.owns(state[service])
            available = port_available(port)
            responsive = responds(service)
            label = "propio" if owned else ("puerto libre" if available else "no gestionado")
            print(f"{service}: {label}; " + ("responde" if responsive else "sin respuesta HTTP") + f"; puerto {port}")
            if service == 'backend' and owned:
                print(f"Base del backend propio: {state[service].get('database', self.root / 'backend' / 'clinical.db')}")
        print("Estado HTTP no verifica integridad de base ni circuito clinico.")
        print(f"Logs locales: {self.directory}")


def main():
    parser = argparse.ArgumentParser(description="Control local del demo MedicControl+ en Windows")
    parser.add_argument("action", choices=("start", "stop", "status"))
    parser.add_argument('--database', type=Path, help='Copia LAB preparada que usara el backend; solo para start')
    args = parser.parse_args()
    if os.name != "nt":
        parser.exit(1, "Este controlador requiere Windows.\n")
    if args.database is not None and args.action != 'start':
        parser.error('--database solo se usa con start')
    control = DemoControl(Path(__file__).resolve().parents[1], database=args.database)
    try:
        with control.locked():
            getattr(control, args.action)()
    except (ControlError, OSError) as exc:
        # Never dump environment, command output or credentials.
        message = str(exc) if isinstance(exc, ControlError) else "Error del sistema de archivos o procesos; revisa permisos y logs locales."
        parser.exit(1, message + "\n")


if __name__ == "__main__":
    main()
