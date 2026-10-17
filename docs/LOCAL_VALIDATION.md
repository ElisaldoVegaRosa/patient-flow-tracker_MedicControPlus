# Diagnostico de validacion local en Windows

Usar el Python de `.venv` y los comandos de `AGENTS.md`. Si pytest queda
detenido antes del primer resultado, localizar la espera antes de repetir la
suite o modificar dependencias.

## Bloqueo de TestClient observado el 17 de octubre de 2026

Con `-o faulthandler_timeout=15`, la primera prueba de identidad mostro una
espera en `socket.accept`, llamada por `socket._fallback_socketpair` al crear
el bucle de asyncio. La aplicacion todavia no habia iniciado su lifespan.
Este parametro imprime las pilas para diagnostico; no amplia el tiempo de la
prueba ni convierte el bloqueo en un resultado aprobado.

Se reprodujo sin FastAPI con una prueba acotada desde la raiz del repositorio:

```powershell
.\.venv\Scripts\python.exe -c "import socket, faulthandler; faulthandler.dump_traceback_later(8, exit=True); a,b=socket.socketpair(); a.send(b'x'); assert b.recv(1)==b'x'; a.close(); b.close(); faulthandler.cancel_dump_traceback_later(); print('socketpair OK')"
```

Dentro del aislamiento de ejecucion se detuvo en `accept`; fuera de ese
aislamiento termino con `socketpair OK`. La misma prueba de identidad paso
fuera del aislamiento en 1,66 s. Esto identifica una restriccion del contexto
de ejecucion, sin evidencia de que la causa sea lentitud de la PC o SQLite.

Si se reproduce esta misma evidencia al trabajar desde un agente, solicitar
la ejecucion con los permisos necesarios mediante su mecanismo de aprobacion.
No cambiar asyncio, FastAPI, dependencias, firewall ni las pruebas para ocultar
el bloqueo. Desde una terminal normal del usuario, comprobar primero el
diagnostico antes de asumir que existe la misma restriccion.

## Acceso denegado al temporal de pytest

El primer intento fallo al preparar `.tmp/pytest`. Para validar sin borrar
carpetas anteriores, se utilizo un destino nuevo dentro del repositorio:

```powershell
$env:PYTHONPATH = 'backend'
$pytestRunPath = Join-Path '.tmp' ('pytest-' + [guid]::NewGuid().ToString('N'))
.\.venv\Scripts\python.exe -m pytest -q --disable-warnings -x backend\tests --basetemp $pytestRunPath
```

Conservar el comando y el resultado junto a la base Git validada. No repetir
frontend, lint o build por cambios que solo afectan a esta documentacion.

## Resultado verificado

Sobre `1b70ee0` y el bloque local de respaldo/restauracion, el 17 de octubre:
196 pruebas backend aprobadas en 310,14 s, con un aviso de deprecacion de AnyIO.
Se ejecuto la suite completa fuera del aislamiento, usando
`--basetemp .tmp\pytest-backup-verified-20261017-a`. No se cambiaron dependencias,
pruebas ni logica de la aplicacion para obtener este resultado. Frontend sin
cambios; sus validaciones anteriores no se repitieron.
