# AGENTS.md

## Alcance

Estas instrucciones aplican a todo el repositorio MedicControl+.

MedicControl+ es un sistema operacional de seguimiento clinico en tiempo real
para episodios activos de pacientes, tareas, alertas, historial, laboratorio y
supervision.

## Arquitectura

El repositorio esta dividido en dos aplicaciones principales:

- `backend/`: API FastAPI con persistencia SQLite, autenticacion por sesiones,
  control de roles, reglas clinicas y operacionales, alertas, tareas,
  laboratorio, historial de episodios cerrados y datos de demostracion.
- `frontend/`: aplicacion React con Vite y TypeScript que consume la API,
  gestiona sesion en navegador, muestra flujos por rol y contiene el cliente
  HTTP y tipos clinicos separados.

La API se define principalmente en `backend/app/main.py`.
Las pruebas backend viven en `backend/tests/`.
Las migraciones SQL documentadas viven en `backend/migrations/`.

El frontend se organiza bajo `frontend/src/`.
El cliente HTTP vive en `frontend/src/api/client.ts`.
Los tipos de dominio, API y datos clinicos viven en
`frontend/src/types/clinical.ts`.
La aplicacion principal vive en `frontend/src/App.tsx`.

## Comandos De Instalacion

Backend:

```powershell
python -m pip install -r backend/requirements.txt
```

Frontend:

```powershell
npm.cmd ci --prefix frontend
```

## Comandos De Ejecucion Local

Backend desde la raiz del repositorio en Windows PowerShell:

```powershell
$env:PYTHONPATH = "backend"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Frontend:

```powershell
npm.cmd run dev --prefix frontend
```

La API permite CORS desde `http://localhost:5173`.
El cliente frontend usa `VITE_API_URL` si esta definido; si no, usa
`http://localhost:8000`.

## Validacion Obligatoria

Antes de entregar cambios, ejecutar los comandos aplicables y reportar el
resultado.

Validacion local preferida en Windows PowerShell:

```powershell
.\scripts\validate.ps1
```

Este script usa `.\.venv\Scripts\python.exe`, `npm.cmd`, `PYTHONPATH` apuntando
a `backend` y `--basetemp .tmp\pytest` para que pytest no dependa de temporales
de AppData. Si la politica local de PowerShell bloquea archivos `.ps1`, usar la
tarea de VS Code `MedicControl+: Validate all` o ejecutar el script con
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate.ps1`
sin cambiar la politica global del usuario.

Backend local en Windows CMD, desde la raiz del repositorio:

```cmd
set PYTHONPATH=backend
.venv\Scripts\python.exe -m pytest -q --disable-warnings -x backend\tests
```

Backend local en Windows PowerShell, desde la raiz del repositorio:

```powershell
$env:PYTHONPATH = "backend"
.\.venv\Scripts\python.exe -m pytest -q --disable-warnings -x backend\tests
```

Backend en Linux, como lo ejecuta GitHub Actions:

```bash
PYTHONPATH=backend python -m pytest -q backend/tests
```

Frontend:

```powershell
npm.cmd run test --prefix frontend
npm.cmd run lint --prefix frontend
npm.cmd run build --prefix frontend
```

Estos comandos reflejan la validacion cubierta por GitHub Actions:
pruebas backend, pruebas frontend, lint frontend y build frontend.

## Procedimiento Backend En Windows

Para validar el backend en Windows, usar explicitamente el Python del entorno
virtual local.

CMD desde la raiz del repositorio:

```cmd
set PYTHONPATH=backend
.venv\Scripts\python.exe -m pytest -q --disable-warnings -x backend\tests
```

PowerShell desde la raiz del repositorio:

```powershell
$env:PYTHONPATH = "backend"
.\.venv\Scripts\python.exe -m pytest -q --disable-warnings -x backend\tests --basetemp .tmp\pytest
```

No depender de sintaxis de entorno de Unix como `PYTHONPATH=backend ...` en
PowerShell o CMD. En PowerShell usar `npm.cmd` en lugar de `npm` para evitar
bloqueos por politicas de ejecucion de scripts.

## Git Y Cambios Locales

Antes de editar, revisar siempre:

```powershell
git status --short
```

Para inspecciones Git, preferir comandos sin paginador:

```powershell
git --no-pager diff
git --no-pager log -1 --oneline
```

Si aparecen cambios inesperados, detenerse y pedir confirmacion antes de
continuar.

No descartar, sobrescribir ni revertir cambios locales que no sean propios.
No usar `git reset --hard`, `git checkout --`, limpiezas destructivas ni
acciones equivalentes salvo instruccion explicita del usuario.

Antes de finalizar, revisar el diff:

```powershell
git --no-pager diff
```

Confirmar el arbol limpio al finalizar cuando la tarea incluya commits o cuando
el usuario pida dejar el repositorio sin cambios pendientes.

No conceder permisos persistentes innecesarios para comandos.

## Commits

No crear commits sin solicitud explicita del usuario.
No hacer push sin solicitud explicita del usuario.
No usar force push.

Mantener commits enfocados y descriptivos.
No mezclar refactors ajenos con cambios funcionales.
No incluir archivos generados, temporales, caches o bases de datos locales si
no forman parte intencional del cambio.

Antes de proponer o crear un commit, confirmar que las validaciones relevantes
pasan o documentar claramente cualquier validacion pendiente.

Antes de crear un commit, revisar:

```powershell
git status --short
git --no-pager diff --cached
```

## GitHub Actions

El workflow de CI se encuentra en `.github/workflows/ci.yml`.
Corre en `push` y `pull_request` contra `main`.

La CI instala dependencias backend con:

```bash
python -m pip install -r backend/requirements.txt
```

Y valida:

```bash
PYTHONPATH=backend python -m pytest -q backend/tests
npm ci --prefix frontend
npm run test --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
```

Despues de un push, comprobar GitHub Actions y reportar si el workflow queda
aprobado, pendiente o fallido.

No depender de pasos locales que no esten representados en el repositorio sin
documentarlos.

## Pruebas

Todo comportamiento nuevo debe incluir pruebas nuevas o actualizacion de
pruebas existentes.

Para backend, agregar o ajustar pruebas en `backend/tests/`.
Para frontend, agregar o ajustar pruebas en `frontend/src/` usando Vitest y
React Testing Library, siguiendo la configuracion existente.

Las pruebas deben cubrir permisos por rol, estados clinicos, sesiones,
integridad de episodios y errores relevantes cuando el cambio toque esas areas.

## Documentacion Del Proyecto

Actualizar `docs/CHANGELOG.md` cuando se agreguen funcionalidades, cambios de
comportamiento, validaciones o correcciones relevantes.

Actualizar `docs/PROJECT_STATUS.md` cuando cambien la etapa actual, el estado
de validacion, capacidades principales o proximo paso recomendado.

No actualizar estos documentos para cambios puramente mecanicos si no alteran
estado, comportamiento ni validacion.

## Codificacion Y Saltos De Linea

Mantener los archivos de texto en UTF-8.
No recodificar archivos ni introducir mojibake.

Respetar los finales de linea existentes al editar archivos.
Para archivos nuevos, preferir LF salvo que el archivo vecino o herramienta del
proyecto indique otra convencion.

No hacer normalizaciones masivas de formato, codificacion o finales de linea
sin que sean necesarias para el cambio solicitado.

## Seguridad

No incluir contrasenas reales, tokens, claves API, secretos, credenciales,
cookies ni datos sensibles.

Los usuarios y datos de demostracion documentados en el codigo son solo para el
demo local; no convertirlos en secretos ni reutilizarlos como credenciales
reales.

No registrar tokens de sesion ni valores sensibles en logs, documentacion,
pruebas o mensajes de error.

## Reglas De Trabajo

Basar los cambios en los archivos reales del repositorio.
No inventar comandos, servicios ni estructura que no existan.

Preferir cambios pequenos, revisables y alineados con la estructura actual.
Mantener el cliente HTTP centralizado en `frontend/src/api/client.ts`.
Mantener los tipos clinicos compartidos en `frontend/src/types/clinical.ts`
cuando correspondan al dominio/API.

Si aparecen archivos desconocidos, modificaciones inesperadas, conflictos de
estado o resultados de validacion no explicados, detenerse y pedir instrucciones
antes de continuar.
