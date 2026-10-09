# Estado del proyecto MedicControl+

## Última etapa

### Entrega 33F: triaje y signos vitales

- Implementada y validada localmente; pendiente de commit, push y CI.
- Rutas de triaje y signos vitales, junto a sus modelos, extraídas a
  `backend/app/routes/nursing.py`, mediante APIRouter.
- Dependencias de conexión, fecha, detalle, eventos, episodio activo y permisos
  recibidas explícitamente; composición en `main.py`.
- Cuerpos comparados con el original y OpenAPI completo idéntico.
- Siete casos nuevos verifican registro, métodos, código 201, permisos distintos
  para los cinco roles, umbrales de alertas y ausencia de duplicados.
- Se conservan pruebas existentes de rangos inválidos y episodios cerrados.
- Validación: 70 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33f-final` por el bloqueo previo de socketpair.
- Diff revisado sin errores de whitespace. Frontend sin cambios.
- La Etapa 33 continúa abierta.

### Entrega 33E: actualización de alertas

- Entrega cerrada y publicada en
  `6af0bacfbc94a4f8e4c37e5a40416b719ad29f7c`; CI `37868893764` aprobada.
- `PATCH /alerts/{alert_id}`, modelo y matriz de transiciones en
  `backend/app/routes/alerts.py`; matriz importada en `main.py` por compatibilidad.
- Router recibe conexión, fecha, detalle, eventos, protección de episodio activo
  y permisos; composición conservada en `main.py`.
- Lógica comparada con el original y OpenAPI completo idéntico.
- Siete casos nuevos cubren registro único, compatibilidad de matriz, cinco roles,
  historial y eventos, y rechazo en episodio cerrado sin mutación.
  Se conservan pruebas existentes de transiciones y flujo clínico.
- Validación: 63 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33e-final` por el bloqueo previo de socketpair.
- Diff revisado sin errores de whitespace. Frontend sin cambios.
- La Etapa 33 continúa abierta.

### Entrega 33D: tareas y laboratorio

- Entrega cerrada y publicada en
  `4d485ebd9d6790e5ebd447b888a05c62c6cec0c0`; CI `37867451079` aprobada.
- Creación de tareas, bandeja de laboratorio y finalización de tareas en
  `backend/app/routes/tasks.py`, junto a sus dos modelos de petición.
- Router con conexión, fecha, detalle, eventos, protección de episodio activo
  y permisos recibidos explícitamente; composición en `main.py`.
- Cuerpos comparados con el original y OpenAPI completo idéntico.
- Cuatro casos nuevos verifican registro y métodos, código 201, filtros
  PENDING/COMPLETED/ALL, servicio LAB, orden y ausencia de datos QR;
  filtro inválido devuelve 422. Pruebas existentes cubren permisos, resultados,
  duplicados y finalización rechazada en episodio cerrado sin mutación.
- Validación: 56 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33d-final` por el bloqueo previo de socketpair.
- Diff revisado sin errores de whitespace. Frontend sin cambios.
- La Etapa 33 continúa abierta.

### Entrega 33C: historial, detalle y escaneo

- Entrega cerrada y publicada en
  `ca41eb80512763b421d9e29b526b6439c3109440`; CI `37866233307` aprobada.
- `GET /episodes/history`, `GET /episodes/{episode_id}` y `GET /scan/{qr_token}`
  en `backend/app/routes/episode_queries.py`, mediante APIRouter.
- Conexión, detalle, registro de eventos y dependencias de autenticación y rol
  recibidos explícitamente; el router no importa `main.py`.
- Consultas, respuestas, permisos, orden de rutas y evento `QR_SCANNED`
  conservados. Cuerpos comparados y OpenAPI completo idéntico antes y después.
- Siete casos nuevos cubren registro y orden, cinco roles, episodios inexistentes,
  evento único del escaneo y rechazo de pulsera desconocida o episodio cerrado
  sin nuevos eventos. Se conserva la prueba existente de historial cerrado.
- Validación: 52 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33c-final` por el bloqueo previo de socketpair.
- Diff revisado sin errores de whitespace. Frontend sin cambios.
- La Etapa 33 continúa abierta.

### Entrega 33B: router de paneles

- Entrega cerrada y publicada en
  `0247346057a9b9e1dcda95ddf26515c4ccc1aaf6`; CI `37865415981` aprobada.
- `GET /dashboard` y `GET /supervisor/dashboard` en
  `backend/app/routes/dashboard.py`, mediante APIRouter.
- Conexión, detalle de episodio, fecha, autenticación y permisos recibidos
  explícitamente; composición conservada en `main.py`.
- Consultas, métricas, respuestas y permisos conservados; cuerpos comparados
  con el original y OpenAPI completo idéntico antes y después.
- Seis casos nuevos cubren registro único, métodos, acceso de los cinco roles
  y paneles vacíos. Pruebas existentes conservan métricas y consulta supervisor
  sin generación de alertas ni eventos.
- Validación: 45 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33b-final` por el bloqueo previo de socketpair.
- Diff revisado sin errores de whitespace. Frontend sin cambios.
- La Etapa 33 continúa abierta.

### Entrega 33A: router de autenticación

- Entrega cerrada y publicada en
  `f73e2c2261112464d7a77918f537c328bc756dbd`; CI `37864729924` aprobada.
- `/auth/login`, `/auth/me`, `/auth/logout` y `LoginRequest` en
  `backend/app/routes/auth.py`, con APIRouter y dependencias explícitas.
- Composición, conexión, fecha y autenticación conservadas en `main.py`.
  El router no importa `main.py`.
- Métodos, respuestas, permisos y sesiones conservados; OpenAPI completo
  idéntico antes y después.
- Dos pruebas nuevas verifican registro único, métodos y uso de la
  dependencia de autenticación suministrada.
- Validación: 39 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33a-final` por el bloqueo previo de socketpair.
- Diff revisado sin errores de whitespace. Frontend sin cambios.
- La Etapa 33 continúa abierta.

Etapa 32 - Cerrada tras 32A–32C: hashes, validación de sesiones,
autorización por rol y lógica de login, logout y usuario actual separados.
Revisión basada en el código de `5278fd7`, 37 pruebas backend y CI
`37862024711` y `37862184127` aprobadas. No se repiten validaciones.
Rutas y dependencias FastAPI permanecen en `main.py` según el alcance.
Las referencias a Etapa 32 abierta en entregas anteriores son históricas.

Etapa 32C - Login, logout y consulta de usuario separados en `auth.py`.
Cerrada y publicada en `65e2b3cd21999971f1f96405ff282d085d7177e4`;
CI `37862024711` aprobada.
Rutas, modelos y dependencias FastAPI conservados en `main.py`.
La Etapa 32 continúa abierta.

Etapa 32B - Validación de sesiones y autorización por rol separadas en
`auth.py`; cerrada y publicada en `e754f09f4c6b4e9d7dbab21aedaef9323579f418`.
Dependencias FastAPI, conexión y fecha conservadas en `main.py`.
La Etapa 32 continúa abierta.

Etapa 32A - Hash y verificación extraídos a `security.py`; cerrada y publicada
en el commit `4c85e9c8e2abefdbc3b9e3adef9d98e8e22f8af9`.
Algoritmos, sal, iteraciones, comparación y formatos conservados; funciones
accesibles desde `main.py`. La Etapa 32 continúa abierta.

Etapa 31 - Cerrada tras 31A–31C: configuración, conexiones e inicialización
separadas, conservando endpoints, esquema, datos y arranque.
Revisión basada en el código de `138eb02` y validaciones aprobadas de 31C.
Las referencias a Etapa 31 abierta en entregas anteriores son históricas.

Etapa 31C - Inicialización SQLite extraída; cerrada y publicada en el commit
`1838e5716892106d30ea6b40000c9e8c5a551b24`.
SQL y carga inicial de usuarios en `database.py`; wrapper en `main.py`
conserva conexión, usuarios demo y funciones de hash y fecha. Arranque intacto.
La Etapa 31 continúa abierta.

Etapa 31B - Creación de conexiones SQLite extraída; cerrada y publicada
en el commit `376d59d85143371af407139f8ec459ced3e6dec5`.
`backend/app/database.py` recibe la ruta explícita y conserva `sqlite3.Row`
y claves foráneas. Wrapper en `main.py` mantiene `main.DATABASE_PATH`.
Inicialización, consultas y rutas conservadas; la Etapa 31 continúa abierta.

Etapa 31A - Configuración backend extraída; cerrada y publicada en el commit
`26a6567758c4ad324d642307e86524e6f760b5e9`.
`DATABASE_PATH`, `DEMO_USERS`, `PASSWORD_HASH_ITERATIONS` y
`SESSION_DURATION_HOURS` en `backend/app/config.py`, con valores conservados.
`main.DATABASE_PATH` sigue permitiendo SQLite temporal en pruebas.
La Etapa 31 continúa abierta.

Etapa 30 - Cerrada tras las entregas 30A–30I.
Cierre documental publicado en `9ed4dbfa4b23b2351f6eaa4958b0ca7eefca7f7d`;
CI `37726240159` aprobada.
Ocho páginas y `AppHeader` separados; `App.tsx` conserva composición,
sesión, navegación y datos. Cliente HTTP y tipos compartidos centralizados.
`EpisodePage` conserva su lógica propia según el alcance aprobado de 30G.

Etapa 30I - AppHeader extraído; cerrada y publicada en el commit
`a80d42c5394930579f43491ff47bfd57b11cc2f9`.
Botones, identidad, visibilidad por rol, textos y CSS conservados.
Navegación, sesión y API permanecen en `App.tsx`.
La Etapa 30 continúa abierta.

Etapa 30H - LoginPage extraído, incluida la vista de restauración;
cerrada y publicada en el commit `18841e97464e3aa38ab91a0b98d88a6661abb93f`.
Formulario, textos y CSS conservados.
Autenticación, restauración, token y errores permanecen en `App.tsx`.
La Etapa 30 continúa abierta.

Etapa 30G - EpisodePage movido a su propio archivo; cerrada y publicada
en el commit `7cf60c706131da9f9f0e9207639e609989010ec7`.
Props, estado local, API, permisos y formularios conservados dentro de
`EpisodePage`; sesión, navegación y episodio seleccionado siguen en `App.tsx`.
La Etapa 30 continúa abierta.

Etapa 30F - SupervisorPage extraído; cerrada y publicada en el commit
`d700a5aa0e7acb0a398eadc11b7a9efc54086ebf`.
Indicadores, filtros y acciones conservados; estado, API, permisos, errores
y navegación permanecen en `App.tsx`. La Etapa 30 continúa abierta.

Etapa 30E - LaboratoryPage extraído; cerrada y publicada en el commit
`e0cc198ff117d118aee39bc2a9afe46b658412cb`.
Bandeja, formulario y validación conservados; API, carga, errores, permisos
y navegación permanecen en `App.tsx`. La Etapa 30 continúa abierta.

Etapa 30D - DashboardPage extraído; cerrada y publicada en el commit
`3a4616125d3733168b60a8bafc1aacaf41b8b41d`.
Centro de control general conservado; API, carga, errores, permisos y navegación
permanecen en `App.tsx`. La Etapa 30 continúa abierta.

Etapa 30C - NewEpisodePage extraído; cerrada y publicada en el commit
`466cc5efc592106e576db305747593a3ec726df5`.
Formulario de llegada conservado; creación, errores, permisos y navegación
permanecen en `App.tsx`. La Etapa 30 continúa abierta.

Etapa 30B - ScanPage extraído; cerrada y publicada en el commit
`37864c1a4dfd027c0796bb7aaaee846451c70b40`.
El formulario conserva textos, campo obligatorio y estilos. La consulta API,
el estado, los errores y la navegación permanecen en `App.tsx`.

Etapa 30A - EpisodeHistoryPage extraído; cerrada y publicada en el commit
`a77970cfa653af7b72254573063f2d5445ed9ee3`.
La Etapa 30 continúa abierta. Estado, carga, errores, permisos, navegación y
llamadas API permanecen en `App.tsx`; el componente reutiliza `HistoryData`
y las clases CSS existentes sin cambios funcionales.

Etapa 29 - Nota de alta editable para médicos en episodios ACTIVE.
Cerrada y publicada en el commit
`f35770638a7482a363c38e253ba33c86e5abb28c`.



## Estado de validación

- Etapa 32C: 37 pruebas backend aprobadas, una advertencia.
- Etapa 32C: CI `37862024711` aprobada: backend, frontend, lint y build.
- Cuatro casos nuevos cubren credenciales rechazadas y sesiones independientes.
- Validación fuera del sandbox, temporal `.tmp/pytest-32c-final`.
- Primera ejecución detectó la exportación de `main.SESSION_DURATION_HOURS`
  requerida por una prueba existente; restaurada antes de validar de nuevo.
- Login y logout comparados con el original; lógica conservada.
- Diff revisado y `git diff --check` sin errores. Frontend sin cambios.

- Etapa 32B: 33 pruebas backend aprobadas, una advertencia observada.
- Etapa 32B: CI `37860358716` aprobada.
- Once casos nuevos cubren sesiones válidas, expiradas, revocadas, usuario
  inactivo, token desconocido/ausente y autorización de los cinco roles.
- Validación fuera del sandbox con `--basetemp .tmp/pytest-32b-verified`
  y diagnóstico de bloqueo activado por el antecedente de socketpair en TestClient.
- Lógica de sesión comparada con el original; diff revisado y
  `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin cambios ni nueva validación frontend.

- Etapa 32A: 22 pruebas backend aprobadas, una advertencia observada.
- Etapa 32A: CI `37858667828` aprobada.
- Tres pruebas nuevas cubren SHA-256, formato y sal PBKDF2, verificación
  correcta/incorrecta, compatibilidad existente y acceso desde `main.py`.
- Validación fuera del sandbox con `--basetemp .tmp/pytest-32a-verified`
  y `-o faulthandler_timeout=60`; ejecución dentro del sandbox interrumpida
  tras diagnóstico de bloqueo en socketpair de asyncio al iniciar TestClient.
- Funciones comparadas con el original; diff revisado y
  `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin nuevas validaciones frontend: sin cambios frontend.

- Cierre de Etapa 31: 19 pruebas backend aprobadas en 31C;
  CI `37857021915` y CI documental `37857173485` aprobadas.
- Cinco pruebas añadidas en 31A–31C cubren ruta SQLite, sustitución temporal,
  filas por nombre, claves foráneas, aislamiento y reinicialización persistente.
- Revisión de cierre documental: sin cambios de código ni nuevas pruebas.

- Etapa 31C: 19 pruebas backend aprobadas, una advertencia observada.
- Etapa 31C: CI `37857021915` aprobada.
- Prueba nueva de reinicialización: conserva esquema, usuarios, sesiones
  y episodios; verifica contraseñas demo persistidas.
- Validación fuera del sandbox con `--basetemp .tmp/pytest-31c-verified`
  y `-o faulthandler_timeout=60`. El temporal habitual falló por permisos;
  una ejecución en otro temporal dentro del sandbox dejó de avanzar y se interrumpió.
- El conteo de advertencias difiere de ejecuciones anteriores; no se atribuye
  al refactor. Sin cambios frontend ni nueva validación frontend.
- SQL y lógica comparados con el original; diff revisado y
  `git diff --check` sin errores, incluido el archivo nuevo.

- Etapa 31B: 18 pruebas backend aprobadas, con tres advertencias conocidas.
- Etapa 31B: CI `37727737285` aprobada.
- Dos pruebas nuevas comprueban filas por nombre, rechazo de referencias
  inexistentes y separación entre bases temporales.
- Se conserva la prueba de sustitución de `main.DATABASE_PATH`.
- Diff revisado y `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin nuevas validaciones frontend: sin cambios frontend.

- Etapa 31A: 16 pruebas backend aprobadas, con tres advertencias conocidas.
- Etapa 31A: CI `37727047490` aprobada.
- Dos pruebas nuevas comprueban ruta por defecto y conexión a la ruta temporal
  sustituida en `main.DATABASE_PATH`, con claves foráneas activadas.
- Constantes, funciones y clases comparadas con el original; diff revisado y
  `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin validaciones frontend nuevas: sin cambios frontend; se conserva la
  validación aprobada de 30I.

- Cierre de Etapa 30 basado en inspección estática y validaciones aprobadas
  de 30I: 46 pruebas frontend, lint y build; CI `37725349264` aprobada.
- Cierre documental de 30I publicado en `e5d7ec2`; CI `37725456535` aprobada.
- Esta revisión no ejecuta pruebas nuevas ni cambia código.

- Etapa 30I: 46 pruebas frontend, lint y build aprobados.
- Etapa 30I: CI `37725349264` aprobada.
- Cinco casos nuevos comprueban botones, identidad y callbacks por rol.
- Diff revisado y `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin nuevas pruebas backend locales: extracción limitada al frontend.

- Etapa 30H: 41 pruebas frontend, lint y build aprobados.
- Etapa 30H: CI `37724737074` aprobada.
- Tres casos nuevos cubren ingreso correcto, restauración correcta y fallo
  de restauración; conservadas las pruebas de formulario y credenciales rechazadas.
- Diff revisado y `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin nuevas pruebas backend locales: extracción limitada al frontend.

- Etapa 30G: 38 pruebas frontend, lint y build aprobados.
- Etapa 30G: CI `37724043270` aprobada.
- Conservadas las pruebas ACTIVE/CLOSED por rol, nota de alta, errores,
  doble envío y consulta posterior desde historial.
- Sin comportamiento nuevo ni pruebas nuevas: traslado del componente existente.
- Cuerpo y props comparados con el original; diff revisado y
  `git diff --check` sin errores, incluido el archivo nuevo.
- Sin nuevas pruebas backend locales: extracción limitada al frontend.

- Etapa 30F: 38 pruebas frontend, lint y build aprobados.
- Etapa 30F: CI `37723480808` aprobada. Diff revisado y
  `git diff --check` sin errores, incluidos los archivos nuevos.
- Seis casos nuevos cubren indicadores, filtros, apertura, actualización
  con reinicio del filtro y ausencia de acceso para los otros cuatro roles.
- Conservadas las pruebas de evaluación explícita de reglas y errores.
- Extracción limitada al frontend; sin nuevas pruebas backend locales.

- Etapa 30E: 32 pruebas frontend, lint y build aprobados.
- Etapa 30E: CI `37721355298` aprobada; pruebas backend, frontend, lint
  y build aprobados. Diff revisado y `git diff --check` sin errores,
  incluidos los archivos nuevos.
- Siete casos nuevos cubren actualización y acceso LAB/SUPERVISOR, ausencia
  de acceso para los otros tres roles, publicación y rechazo de la API.
- Sin nuevas pruebas backend: extracción limitada al frontend.

- Etapa 30D: 25 pruebas frontend, lint y build aprobados; diff revisado y
  `git diff --check` sin errores, incluidos los dos archivos nuevos.
- Pruebas ejecutadas fuera del sandbox tras un fallo de acceso a un temporal.
  Se corrigió una opción no admitida en la prueba nueva, sin modificar la UI.
- Etapa 30D: CI `37719496231` aprobada, según el resumen de continuidad.
- Sin pruebas backend locales nuevas: extracción limitada al frontend.

- Etapa 30C: 23 pruebas frontend, lint y build aprobados; diff revisado y
  `git diff --check` sin errores, incluido el componente nuevo.
- Etapa 30C: CI aprobada en la ejecución `37718612913`, con pruebas backend,
  frontend, lint y build aprobados.
- Sin pruebas backend nuevas: extracción limitada al frontend.

- Etapa 30B: 21 pruebas frontend, lint y build aprobados; diff revisado y
  `git diff --check` sin errores, incluido `ScanPage.tsx`.
- La prueba nueva se ajustó para comprobar el mensaje visible del aviso de
  error existente, sin cambiar la UI ni ampliar tiempos de espera.
- Sin pruebas backend locales nuevas: extracción limitada al frontend.
- Etapa 30B: CI aprobada en la ejecución `37717881092`, incluyendo pruebas
  backend, pruebas frontend, lint y build.

- Etapa 30A: 20 pruebas frontend aprobadas; lint y build aprobados.
  Pruebas y lint completados tras el reinicio del equipo; se conserva el build
  aprobado antes del reinicio, sin cambios posteriores de código.
- Etapa 30A: diff revisado y `git diff --check` sin errores, incluidos los
  archivos nuevos. Sin pruebas backend nuevas: entrega limitada al frontend.
- Etapa 30A: CI aprobada en la ejecución `37716248936`.

### Antecedentes de validación anteriores a 30A

- Backend: pruebas ampliadas con regresion de dashboard supervisor sin efectos
  secundarios.
- Backend: prueba de regresion para impedir completar tareas pendientes de
  episodios cerrados sin mutar tarea, episodio ni auditoria.
- Frontend: 18 pruebas aprobadas; cobertura de CLOSED/ACTIVE para los cinco roles, nota de alta
  obligatoria tras trim, envío, consulta posterior, errores y doble envío.
- Backend: prueba de flujo ampliada para comprobar la persistencia exacta de
  la nota en auditoría y consulta posterior, exclusivamente con SQLite temporal.
- Backend: 14 pruebas aprobadas, con tres advertencias conocidas.
- Suite frontend, lint y build aprobados; `scripts/validate.ps1` ejecutado una
  sola vez y aprobado para esta corrección.
- Validaciones anteriores vigentes: el cierre del hallazgo HTTP 401 como
  limitación aceptada es exclusivamente documental; no cambia código ni pruebas.
- ESLint: cero errores.
- Frontend: compilación aprobada.
- Advertencias backend: se mantienen únicamente las ya conocidas.
- Validación local: `scripts/validate.ps1`.
- GitHub Actions: CI aprobada en la ejecución `37244485263` para el commit
  de cierre de la Etapa 29; backend (14 pruebas), frontend (18 pruebas), lint
  y build aprobados.
- CI preparada ante la deprecación de Node 20 en GitHub Actions.
- Runner de CI fijado en `ubuntu-24.04` antes de la migración de
  `ubuntu-latest` a Ubuntu 26.
- Runtime de `actions/setup-node` modernizado mediante `actions/setup-node@v7`.
- Eliminación esperada de las advertencias internas `DEP0040` y `DEP0169` de
  `setup-node@v5`.
- Baseline Codex versionado con aprobacion bajo demanda, escritura limitada al
  workspace y red desactivada dentro del sandbox.
- Dependabot configurado para mantenimiento semanal y revisable de GitHub
  Actions en la rama `main`, con maximo de cinco PRs abiertos.

## Capacidades principales

- Recepción y creación de episodios.
- Pulsera y lectura QR.
- Triaje y signos vitales.
- Evaluación médica.
- Tareas de enfermería.
- Órdenes y resultados de laboratorio.
- Panel de supervisor.
- Finalizacion de tareas protegida por episodio activo.
- Dashboard supervisor de solo lectura.
- Motor de reglas temporales mediante accion explicita
  `POST /rules/evaluate`.
- Boton supervisor **Evaluar reglas temporales**.
- Datos de demostración.
- Historial de episodios cerrados.
- Detalle CLOSED con aviso accesible de solo lectura y sin controles de
  escritura; conserva vitales, alertas, tareas, resultados y auditoría.
- Permisos de episodios activos conservados; backend como última barrera
  contra mutaciones posteriores al cierre.
- Nota de alta editable, inicialmente vacía, solo para DOCTOR en ACTIVE.
  Envío bloqueado durante la solicitud. El borrador se conserva ante errores
  de red y rechazos de la API mientras la sesión siga vigente y la pantalla
  permanezca abierta.
  Persistencia y consulta por el evento DISCHARGE existente.
- Manejo de sesión expirada.
- Historial visual de alertas.
- Máquina de estados de alertas.
- Restauración y cierre de sesión.
- Cliente HTTP frontend separado.
- Tipos de dominio, API y datos clínicos separados.
- Validación local reproducible en Windows.
- Tareas de VS Code para validación, pruebas, lint, build y ejecución local.
- CI con acciones oficiales compatibles con runtime Node 24.
- CI con `actions/setup-node@v7`, Node.js 22, cache npm y Ubuntu 24.04.
- Baseline de seguridad Codex compartido en `.codex/config.toml`.
- Mantenimiento automatizado y revisable de acciones mediante Dependabot,
  limitado exclusivamente a `github-actions`.

## Sesiones

Descripción basada en inspección estática de `backend/app/main.py`.

- `POST /auth/login`: crea una sesión persistente en la tabla `sessions` de
  SQLite (`backend/clinical.db`) y devuelve el token al cliente. En la base
  de datos se almacena su hash SHA-256, no el token en texto plano.
- Las sesiones expiran a las ocho horas de su creación. La autenticación
  comprueba `expires_at`; si detecta expiración, registra `revoked_at` y
  devuelve HTTP 401.
- `GET /auth/me`: valida la sesión y devuelve el usuario y su rol. La
  autenticación requiere una sesión no revocada, no expirada y un usuario
  activo.
- `POST /auth/logout`: revoca la sesión utilizada por la petición mediante
  `revoked_at`.
- El inicio del backend inicializa las tablas si no existen y no elimina ni
  revoca las sesiones guardadas. Reiniciar conserva las sesiones si se mantiene
  la misma base SQLite; su validez sigue sujeta a expiración, revocación y
  estado activo del usuario.

## Alertas

Transiciones permitidas:

```text
ACTIVE → ACKNOWLEDGED
ACTIVE → ESCALATED
ACKNOWLEDGED → ESCALATED
ACKNOWLEDGED → RESOLVED
ESCALATED → RESOLVED
```

## Protocolo funcional de Etapa 28

- Evidencias 28A–28E conservadas: smoke; autenticación, sesión y logout;
  recepción y QR; triaje, vitales y alertas; evaluación médica, orden y
  resultado LAB; supervisor de consulta; resolución, alta e historial.
- QA EP-15 cerrado con prioridad P2, tres alertas resueltas, una evaluación,
  una tarea LAB completada y 17 eventos. Seis intentos posteriores al cierre
  rechazados con HTTP 409 sin mutación, según la evidencia previa de 28E.
- Cierre del defecto visual mediante TDD y consulta desde historial usando
  `.tmp/stage28-evidence/clinical.after-phase28E.db` en Chrome temporal.
- Evidencia: `.tmp/stage28-evidence/e28-closed-readonly-fixed.png` muestra
  aviso, vitales históricos, alertas resueltas y timeline con resultado LAB,
  sin formulario de vitales ni acciones de escritura.
- La comprobación DOM pasó; el control de red posterior a la captura dio un
  falso positivo al clasificar OPTIONS como escritura. El log confirmó solo
  consultas y login/logout. No se repitió el flujo clínico.
- Perfil temporal eliminado y servidores cerrados por PIDs exactos. Puertos
  8000, 5173 y 9444 libres. DB restaurada desde `clinical.before-stage28.db`:
  SHA-256 `4EE9CF8ADE09D813715B750444DA8870E6E2CDB6FF6935FEC428C0A1F0756049`.
- Limitación detectada en Etapa 28: nota de alta fija en UI. Resuelta en
  Etapa 29 mediante el campo editable; las evidencias 28A–28E se conservan.

## Experiencia de desarrollo

- `scripts/validate.ps1` refleja la validación de CI desde Windows.
- Pytest usa `.tmp/pytest` como base temporal local controlada.
- Las tareas de VS Code usan rutas relativas al workspace.
- Estas mejoras no cambian el comportamiento clínico de la aplicación.
- El baseline Codex no cambia el comportamiento funcional de la aplicacion; solo
  fija permisos locales esperados para sesiones futuras.
- `GET /supervisor/dashboard` no debe crear alertas ni eventos.
- `POST /rules/evaluate` conserva la idempotencia de alertas temporales.
- `complete_task` rechaza tareas de episodios cerrados con `409 El episodio
  está cerrado`, sin modificar resultado ni registrar `TASK_COMPLETED`.
- La correccion de `complete_task` queda separada del dashboard supervisor y de
  las reglas temporales explicitas.

## Próximo paso recomendado

Revisar y autorizar la publicación de 33F y comprobar su CI.
La Etapa 33 continúa abierta; la siguiente extracción requiere alcance aprobado.

Limitación aceptada de la Etapa 29: el borrador se pierde ante HTTP 401,
navegación o recarga. Solo se mantiene en memoria en el formulario; no se
almacenan notas clínicas en localStorage/sessionStorage.

Recuperar borradores durante reautenticación sigue pendiente para una etapa
independiente y no constituye una tarea autorizada. El contrato backend
existente no cambia: la exigencia de texto
no vacío se aplica en esta UI. Las PRs Dependabot #1 y #2 quedan fuera de este
trabajo.
