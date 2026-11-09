"""Prepare an opt-in, single-origin HTTPS demo using local certificate files."""
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import shutil
import ssl
import subprocess
from urllib.request import HTTPSHandler, ProxyHandler, build_opener
from uuid import uuid4


GATEWAY_PORT = 5443


def private_address(value):
    address = ipaddress.IPv4Address(value)
    networks = ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")
    if not any(address in ipaddress.IPv4Network(network) for network in networks):
        raise ValueError("Se requiere una IPv4 privada de la PC en la red local.")
    return str(address)


def source_signature(root):
    root = Path(root)
    files = list((root / "frontend" / "src").rglob("*"))
    files += list((root / "frontend" / "public").rglob("*"))
    files += list((root / "frontend").glob("tsconfig*.json"))
    files += [root / "frontend" / name for name in ("package.json", "package-lock.json", "vite.config.ts", "index.html")]
    files += [root / "scripts" / "demo_lan_gateway.mjs"]
    digest = hashlib.sha256()
    for path in sorted(file for file in files if file.is_file()):
        digest.update(path.relative_to(root).as_posix().encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
    return digest.hexdigest()


def load_configuration(root, path):
    path = Path(path).resolve()
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict) or data.get("schema") != 1:
        raise ValueError("Configuracion LAN incompatible.")
    data["host"] = private_address(data.get("host"))
    if data.get("source_signature") != source_signature(root):
        raise ValueError("El frontend cambio. Prepara otra compilacion LAN antes de iniciar.")
    # Restrict files to this prepared directory, including resolved symlinks.
    for key, name in {"pfx": "server.pfx", "ca": "ca.pem", "certificate": "server.cer", "dist": "dist"}.items():
        candidate = (path.parent / name).resolve()
        if not candidate.is_relative_to(path.parent):
            raise ValueError("Ruta LAN fuera de su directorio preparado.")
        if not candidate.exists():
            raise ValueError("Faltan certificados o compilacion LAN. Prepara el modo de red.")
        data[key] = str(candidate)
    if not (Path(data["dist"]) / "index.html").is_file():
        raise ValueError("Falta index.html en la compilacion LAN.")
    digest = hashlib.sha256(path.read_bytes())
    for key in ("pfx", "ca", "certificate"):
        digest.update(Path(data[key]).read_bytes())
    data["signature"] = digest.hexdigest()
    data["path"] = str(path)
    data["url"] = f"https://{data['host']}:{GATEWAY_PORT}"
    return data


def responds(configuration):
    context = ssl.create_default_context(cafile=configuration["ca"])
    opener = build_opener(ProxyHandler({}), HTTPSHandler(context=context))
    try:
        with opener.open(configuration["url"] + "/api/health", timeout=1) as response:
            return response.status == 200 and json.loads(response.read(1024)).get("status") == "ok"
    except (OSError, ValueError):
        return False


def prepare(root, address):
    root = Path(root).resolve()
    address = private_address(address)
    node = shutil.which("node.exe")
    npm = shutil.which("npm.cmd")
    if not node or not npm:
        raise ValueError("Faltan Node.js o npm.cmd.")
    directory = root / ".tmp" / "demo-lan" / uuid4().hex
    environment = os.environ.copy()
    environment["VITE_API_URL"] = "/api"
    source = source_signature(root)
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
         str(root / "scripts" / "create_demo_certificate.ps1"), "-Address", address,
         "-OutputDirectory", str(directory)],
        capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW,
    )
    if result.returncode:
        raise ValueError("No se pudo generar el certificado local. Comprueba permisos y .NET de Windows.")
    with (directory / "build.log").open("wb") as output:
        result = subprocess.run(
            [npm, "run", "build", "--prefix", str(root / "frontend"), "--", "--outDir", str(directory / "dist")],
            cwd=root, env=environment, stdout=output, stderr=output,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
    if result.returncode:
        raise ValueError(f"La compilacion LAN fallo. Consulta {directory / 'build.log'}")
    if source_signature(root) != source:
        raise ValueError("El frontend cambio durante la compilacion. Prepara el modo LAN de nuevo.")
    configuration = directory / "network.pending.json"
    configuration.write_text(json.dumps({"schema": 1, "host": address, "source_signature": source}, indent=2), encoding="utf-8")
    # Validate TLS and the certificate's address before any network listener exists.
    result = subprocess.run([node, str(root / "scripts" / "demo_lan_gateway.mjs"), "--check", str(configuration)], capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode:
        raise ValueError("El certificado o la compilacion LAN no superan la verificacion.")
    ready = directory / "network.json"
    configuration.replace(ready)
    configuration = ready
    print(result.stdout.decode("utf-8", errors="replace").strip())
    print(f"Configuracion preparada: {configuration}")
    print(f"CA publica para instalar en Android: {directory / 'mediccontrol-demo-ca.cer'}")
    print(f"Direccion del ensayo: https://{address}:{GATEWAY_PORT}")
    print("Instala la CA publica y comprueba su huella antes del ensayo con el movil.")
    return configuration
