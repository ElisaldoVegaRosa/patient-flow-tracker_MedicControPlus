# Estado del proyecto MedicControl+

## Última etapa

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

Revisar y autorizar la propuesta 31A: extraer la configuración existente del
backend. Su implementación permanece pendiente. La Etapa 30 está cerrada
y su cierre documental publicado.

Limitación aceptada de la Etapa 29: el borrador se pierde ante HTTP 401,
navegación o recarga. Solo se mantiene en memoria en el formulario; no se
almacenan notas clínicas en localStorage/sessionStorage.

Recuperar borradores durante reautenticación sigue pendiente para una etapa
independiente y no constituye una tarea autorizada. El contrato backend
existente no cambia: la exigencia de texto
no vacío se aplica en esta UI. Las PRs Dependabot #1 y #2 quedan fuera de este
trabajo.
