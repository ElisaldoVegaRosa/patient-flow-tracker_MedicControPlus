# Diagnostico de validacion local en Windows

## Casillas de contacto tras alta, 08/11/2026

- Captura del usuario en EP-26 muestra casillas extendidas al ancho del formulario
  y textos debajo. Estilos generales input y label explican la disposición.
- Estilo checkbox-field aplicado a las cuatro etiquetas de esta página, con
  casilla de ancho fijo y fila flexible. El usuario confirmó después que las
  casillas aparecen junto a sus textos y bien alineadas.
- Prueba nueva lee el CSS real y comprueba disposición, ancho, flex-shrink y clic
  en etiqueta. Primer intento con importación CSS recibió estilo simulado por
  Vitest. La lectura por URL de módulo falló al resolverse a URL de servidor.
  Lectura desde src/App.css aprobada en el directorio de ejecución del frontend.
- Dirigidas 11/11 y frontend completo 774/774, 85 archivos, 443,36 s, aprobados
  con --maxWorkers=2. Log .tmp/contact-checkbox-frontend-tests.log.
- Build encontró falta de tipos Node en la prueba. Declaración de tipos añadida
  al archivo de prueba y build posterior aprobado. Lint final aprobado.
- Cambios locales preparados. Usuario confirma contacto y aviso de EP-26,
  explicación clínica por medicina y ambos hechos conservados en el historial
  al incluir contactos completados.

## Confirmacion UI de sincronizacion tras extension

- Comprobacion UI autorizada de la correccion: extension ficticia guardada de
  06/11/2026 08:00 a 09:00 hora dominicana; confirmacion visible del servidor.
  Navegacion a Resumen de relevo completada sin aviso de campos sin guardar;
  getJsDialog confirma ausencia de dialogo. No se modifica EP-24 en esta prueba.
- Captura de evidencia falla por timeout Page.captureScreenshot (dos mecanismos
  con mismo backend); no afirmar captura guardada. Verificacion por arbol UI
  y estado de dialogo, no inferida por simple clic. Sin cambio de codigo posterior.
- Correccion validada localmente (773 frontend, lint/build y prueba directa).
  Pendiente preparar publicacion; sin autorizacion de nuevo commit/push.

Sin nuevas suites por documentacion; diff --check correcto.

## Aviso de cambios tras extension: reproduccion y correccion

- Reproduccion determinista StaffingPage: extender, responder y recargar fechas
  nuevas. Falla antes del cambio: queda sucio /staff/shifts/1, formulario hermano
  de edicion de planificacion (deshabilitado), no el formulario de extension.
- OperationalWriteForm sincroniza DOM nativo al cambio de version si hasDraft=false;
  useLayoutEffect evita ventana de falsa suciedad antes de navegacion. Si hay
  borrador no resetea campos ni baseline; conflicto permanece bloqueado.
- StaffingPage.test.tsx + StaffDateTimeInput.test.tsx: 13/13 (6,73 s).
  OperationalWriteForm.sync.test.tsx: 2/2 (3,83 s). Sin trafico al demo.
- Lint correcto. Build inicialmente detecta exact de Playwright usado en opcion
  Testing Library y literal ACTIVE ensanchado a string en tests: se corrigen solo
  tipos/selector equivalente, build final correcto. Logica de app sin otro cambio.
- Frontend completo --maxWorkers=2: 773/773, 85 archivos, 254.09 s;
  .tmp/operational-form-sync-full.log. Sin fallos. Revision final diff --check correcta.
  Backend sin cambios, no se repite suite backend. Sin carga/prueba directa nueva.


## Relevo completo EP-24 por UI, 05/11/2026 (hora dominicana)

- Prueba UI de relevo EP-24 completada por agente con autorizacion del usuario.
  Consulta retenida durante propuesta a Observacion; tras aceptar con cuenta
  enfermeria.observacion cambia responsable y se conserva tarea #20 pendiente.
  Resumen contrastado en coordinacion (actualizacion manual) y receptora; historial
  PROPOSE por medico.demo1 / ACCEPT por enfermeria.observacion verificados.
- Preparacion: demo iniciado con misma copia, turno ficticio extendido a
  06/11/2026 08:00 hora dominicana, triaje P3/Sala de espera por enfermeria demo,
  area Consulta -> Observacion y asignacion inicial enfermeria.consulta.
  Usuario inicio sesiones personales; agente no obtuvo contrasenas/tokens.
- Estado final EP-24 ACTIVE, responsable enfermeria.observacion, inicio sin
  confirmar, tarea #20 pendiente. No se completan pendientes ni se cierra episodio.
- Incidencia aparte: aviso de campos sin guardar al salir de extension ya
  confirmada; bloqueo del control Chrome resuelto mediante intervencion del usuario.
  No reproducido/diagnosticado como fallo de app; siguiente revision recomendada.
  No cambios de codigo, nuevas suites, commit ni push durante este ensayo.

Evidencia local .tmp/ep24-handover-proposed.png y
.tmp/ep24-handover-accepted.png. Chrome coordinacion y navegador integrado
receptora. El usuario aporta acceso en formularios; no credenciales en archivos.
Limitaciones: se contrasta responsable y una tarea enfermeria, no todas las
combinaciones LAB/reevaluaciones. No se prueba actualizacion automatica entre
pestanas: coordinacion se actualizo con boton. No restablecer la base a snapshots
anteriores: estos cambios ficticios son intencionales y auditados.
Validacion documental: diff --check; sin suites porque no cambia aplicacion.


## Resumen de relevo: comprobacion manual confirmada

- Reinicio gestionado autorizado con misma base de comunicacion. Status posterior:
  backend/frontend propios y responden, ruta exacta conservada. HTTP no comprueba
  integridad clinica de esa copia; no afirmar lo contrario.
- Usuario maneja la app: confirma filtro por area, retorno al conjunto, apertura
  del episodio esperado, busqueda por EP conservada al actualizar, y distincion de
  medicina/enfermeria, pendientes LAB y alertas en tarjetas.
- Consulta manual sin acciones de relevo ni finalizacion; no se verifica mediante
  este ensayo aceptacion real, permisos de cada cuenta o todos los estados LAB.
  Esos controles tienen pruebas automaticas dirigidas registradas abajo.
- Sin nuevas suites por esta actualizacion documental, sin commit/push.


## Resumen de relevo: implementacion local

- Backend dirigido: test_shift_handover.py, test_care.py y test_operational_delays.py:
  35 passed, 1 warning, 73.76 s. PYTHONPATH=backend, Python .venv, pytest -q
  --disable-warnings -x, --basetemp .tmp/pytest-shift-handover-fixed.
  Log .tmp/shift-handover-backend.log. Pruebas de permisos, consulta acotada,
  excluidos cerrados, sin escrituras, LAB contra modelo canonico tras correccion/anulacion.
- Test adicional test_retained_owner_proposal_reevaluation_and_alerts: 1 passed,
  1 warning, 0.62 s, --basetemp .tmp/pytest-shift-owner-final. Verifica responsable
  anterior, receptor propuesto, reevaluacion/tarea y exclusion de alerta resuelta.
- Fallos de preparacion explicados: fixture SQLite compartida con hilo TestClient;
  se prueba endpoint con inyeccion directa, sin compartir conexion entre hilos.
  Fixture adicional omitia care_episodes y despues ready_at obligatorio; completado
  contra esquema real. Nueve casos existentes aprobados en ambas ultimas ejecuciones.
- Frontend dirigido: ShiftHandoverPage.test.tsx, App.care.test.tsx y CareQueuePage.test.tsx:
  18/18 en 13.68 s, --maxWorkers=2. Lint/build aprobados.
- Frontend completo: 770/770, 84 archivos, 266.46 s, --maxWorkers=2,
  .tmp/shift-handover-frontend.log, sin otras suites en paralelo.
- Revision final de diff, UTF-8 y diff --check correctos. No commit/push.
- Backend completo historico no representa esta version; cobertura actual dirigida
  al nuevo endpoint y colas/demoras. No pruebas directas en app ni reinicio del demo.


## Ensayo sostenido completado

- Ensayo sostenido autorizado y completado: 30 sesiones, 41 rondas/600 s,
  3799 operaciones en 625,672 s; cero errores inesperados. 30 logins correctos,
  3690 lecturas; 24 escrituras finales y replay sin duplicados, conflicto protegido.
  Integridad/FK correctas, 67 pacientes/episodios sinteticos finales.
- Panel p95 180,565 ms/max 263,487 ms; colas p95 697,987 ms, episodio 113,543 ms.
  Informe .tmp/capacity-runs/capacity-30-cg_w_clb/report.json. Puerto privado
  cerrado; demo propio responde con misma copia. Sin reinicio del demo.
- Alcance: consultas sostenidas y guardados al final; no memoria/CPU ni escrituras
  distribuidas. Percentiles globales no prueban tendencia temporal ni capacidad
  en campo. Sin nueva carga, commit o push autorizados para esta ampliacion.

Detalles, comando, huellas y limites en CAPACITY_OBSERVATION.md.

## Preparacion de duracion sostenida

- test_capacity_probe.py: 27 passed, 1 warning, 12.73 s, basetemp
  .tmp/pytest-capacity-sustained, Python .venv y PYTHONPATH=backend.
- Plan --sessions 30 --steady-minutes 10 sin --execute: 41 rondas, 600 s,
  3799 operaciones. No servidor/base nueva ni carga real. App sin modificar.
- Revision diff y diff --check; no repetir suites de app por controlador aislado.


## Restauracion: comprobacion completa con concurrencia acotada, 01/11/2026

- Se revisan App.tsx, bindWriteRecovery, writeReferenceOwner, setup y prueba
  App.results. Restauracion espera crypto.subtle.digest antes de mostrar panel;
  DOM del fallo previo aun estaba en Restaurando sesion. Sin traza suficiente
  para localizar exactamente el retraso. No se modifica la aplicacion por conjetura.
- Hipotesis comprobable: sensibilidad a carga al ejecutar varias suites/procesos.
  npm.cmd run test --prefix frontend -- --maxWorkers=2, sin otras suites a la vez:
  83 archivos y 767 pruebas aprobados, 209,27 s.
  Log .tmp/frontend-restoration-resource-check.log; salida 0.
- Mismos tests, codigo y tiempos de espera. maxWorkers es solo argumento de esta
  ejecucion, no cambio del runner del repo/CI. No se ampliaron limites temporales.
- La aprobacion actual corresponde a esta condicion de ejecucion. Fallo anterior
  766/767 bajo paralelismo predeterminado y archivo posterior 2/2 se conservan.
  Evidencia compatible con sensibilidad del entorno; no demuestra causalidad unica
  ni certifica ausencia de intermitencia con otra carga. No nuevas pruebas reales.
- Solo documentacion actualizada; diff --check y revision de diff realizados.
  Sin commit/push, reinicio o cambios de app. Backend anterior no vuelto a ejecutar.


## Confirmacion visual del resumen del panel

- Usuario opera la app y confirma los cuatro indicadores, tabla sin NaN,
  busqueda de episodio activo, limpieza del filtro y apertura del paciente correcto.
- Captura muestra 13 activos, 14 alertas, 4 alta prioridad y 6 tareas pendientes;
  buscar EP-23 devuelve cero porque su episodio esta cerrado. Indicadores generales
  conservados. Se corrige el ejemplo de prueba; no cambia la aplicacion.
- Confirmacion manual no resuelve la intermitencia automatica de restauracion
  registrada previamente. Sin nuevas suites, commit/push ni trafico automatizado.


- Ultima comprobacion 01/11/2026: reinicio autorizado completado con misma base
  .tmp/communication-rollout-20261030/clinical-communication-working.sqlite3.
  Backend/frontend propios y respondiendo; no se sustituyo la base.
- Ensayo aislado autorizado con resumen: 30 sesiones, 649 operaciones/101,235 s,
  cero errores inesperados. Integridad/FK, 24 escrituras y reintentos sin duplicados;
  conflicto compartido 1 HTTP 200 y 11 HTTP 409 esperados. Puerto privado cerrado.
- Panel p95 6180,726 -> 390,208 ms; max 6541,905 -> 514,247 ms. Mismo plan y
  controlador; medicion local sintetica breve, sin certificar capacidad en campo.
  Informe .tmp/capacity-runs/capacity-30-70k9j_lc/report.json.
- Siguiente paso recomendado: comprobacion visual guiada del panel actualizado.
  Sigue registrada intermitencia frontend: suite 766/767, archivo aislado 2/2;
  no afirmar suite completa verde. Sin commit/push ni otra carga autorizados.


## Resumen del panel implementado: 01/11/2026

- Backend: .venv/Scripts/python.exe -m pytest -q --disable-warnings -x
  backend/tests/test_dashboard_summary.py backend/tests/test_dashboard_router.py
  backend/tests/test_laboratory_followup_ui.py backend/tests/test_laboratory_startup.py
  backend/tests/test_accounts.py backend/tests/test_flow.py
  backend/tests/test_record_lifecycle.py --basetemp .tmp/pytest-dashboard-summary,
  PYTHONPATH=backend. 53 passed, 1 warning in 270.62 s.
  Log .tmp/dashboard-summary-tests.log. Bases temporales; sin trafico al demo.
- Frontend dirigidas App.dashboard.test.tsx + pages/PatientSearch.test.tsx: 11/11.
  npm.cmd run build --prefix frontend y npm.cmd run lint --prefix frontend: correctos.
- npm.cmd run test --prefix frontend: 766 aprobadas/1 fallida, 82 archivos aprobados
  y uno fallido, 225,26 s. Log .tmp/dashboard-frontend-full.log. App.results.test.tsx
  agota espera del encabezado Centro de control, DOM aun en Restaurando sesion;
  no alcanza publicacion de laboratorio. Coincide con otras suites ejecutandose.
- Hipotesis: sensibilidad temporal al entorno concurrente. Tras terminar backend
  y frontend completos se ejecuta SOLO App.results.test.tsx, mismo runner/limites:
  2/2 aprobado en 4,34 s, sin cambios de codigo. Compatible con intermitencia por
  carga; no demuestra causa unica ni convierte la suite completa anterior en verde.
  No se repiten suites completas ni se amplian tiempos para conseguir aprobacion.
- Backend completo previo 608/608 corresponde al arreglo auth anterior, no a este
  nuevo contrato; este bloque usa cobertura backend dirigida a las rutas afectadas.
- Lectura offline de base sintetica intacta: 67 episodios, 3 SQL frente a 1630,
  JSON pacientes 11705 frente a 192567 bytes; 0,0068 s aislados, no HTTP concurrente.
  EXPLAIN: agrupacion unica por relacion, sin migracion/indices nuevos.
- diff --check correcto. Sin commit/push, reinicio de demo ni nueva carga real.
  Activacion necesita backend/frontend juntos; comparacion de carga por coordinar.

## Diagnostico offline de panel: 01/11/2026

- Sin cambios de app ni nuevas suites: analisis de codigo y una proyeccion de
  base sintetica mode=ro/query_only, SHA256 conservado. 67 episodios, 1630 SQL,
  136 comprobaciones de esquema, 192567 bytes; 0,3793 s en lectura aislada.
- Fallo inicial de invocacion SQLite por omitir uri=True, corregido; no fallo app.
- Plan, alcance y limitaciones: DASHBOARD_PERFORMANCE_PLAN.md. No nueva carga HTTP.

## Capacidad treinta tras correccion: 01/11/2026

- Ensayo real aislado autorizado: completed=true, 649 operaciones/114,204 s.
  30 logins correctos, cero errores inesperados; integridad y referencias correctas.
  24 escrituras sin duplicados por replay; conflicto 1 exito/11 rechazos esperados.
- Informe .tmp/capacity-runs/capacity-30-y2c1dc65/report.json; fuente local corregida.
  Login p95 2480,300 ms; panel p95 6180,726 ms, max 6541,905 ms.
  Detalles/huellas/alcance en CAPACITY_OBSERVATION.md. Pendiente coste del panel.
- Puerto privado cerrado, demo propio responde con misma copia. Sin reinicio,
  commit/push ni nuevas suites: solo se documenta esta observacion autorizada.

## Correccion del bloqueo de autenticacion, 31/10/2026

- Autorizada por usuario. Cambio acotado a backend/app/auth.py, sin migracion.
- Dirigidas: test_login_concurrency.py, test_auth.py, test_auth_sessions.py,
  test_auth_router.py y test_accounts.py: 40 passed, 1 warning, 58.16 s.
  Python .venv, PYTHONPATH=backend, pytest -q --disable-warnings -x;
  --basetemp .tmp/pytest-auth-lock-directed. Ejecucion fuera del aislamiento
  de sockets Windows por TestClient; datos temporales, sin trafico al demo.
- Nuevas pruebas: verificaciones solapadas, reset/desactivacion/reactivacion y
  permiso durante verificacion, bloqueo controlado 503 y error ajeno no ocultado.
  Pruebas existentes cubren revocacion posterior y sesiones independientes.
- Regresion backend completa: 608 passed, 1 warning in 1283.88 s (21:23).
  Resultado consultado el 01/11/2026; registro .tmp/auth-lock-full-validation.log.
  Comando: .venv/Scripts/python.exe -m pytest -q --disable-warnings -x backend/tests
  --basetemp .tmp/pytest-auth-lock-full, con PYTHONPATH=backend.
  Frontend sin cambios; no se repiten sus suites. diff --check correcto.
  No repetida carga real de 30 ni reiniciado demo. Sin commit/push.

## Observacion HTTP real aislada: treinta sesiones detenida, 31/10/2026

- Usuario autoriza etapa treinta con misma app, herramienta, datos iniciales y
  limites. Comando scripts/capacity_probe.py --sessions 30 --execute.
- completed=false: ensayo 22,953 s, 30 intentos de login; 25 HTTP 200, cinco
  HTTP 500. Las fases de lecturas/escrituras/reintentos/conflicto no se ejecutaron.
  No convertir duracion corta en mejora de rendimiento ni afirmar capacidad 30.
- Informe .tmp/capacity-runs/capacity-30-anjtjkx1/report.json y server.log.
  Fuente original misma revision 729b8b3 y huellas backend/runner de etapas 5/15.
  Login p50 3047,426 ms, p95 5412,577, max 5416,347, incluyendo fallos.
- Las cinco trazas de error son sqlite3.OperationalError database is locked en
  backend/app/auth.py:114, connection.execute(BEGIN IMMEDIATE). Codigo confirma
  PBKDF2 dentro de la transaccion de escritura. get_connection usa sqlite3.connect
  sin timeout explicito; firma instalada confirma timeout=5.0. Limite HTTP=10 s
  no fue el que produjo el fallo. No se atribuye a red ni a contrasenas incorrectas.
- Lectura posterior privada: 61 pacientes/episodios, 25 sesiones, 61 eventos de
  preparacion y cero TRIAGE/MEDICAL_EVALUATION. integrity_check=ok, FK sin errores.
  Puerto privado cerrado; Status posterior del demo confirma ambos propios y
  responden con la misma copia de comunicacion, sin reinicio ni sustitucion.
- Ajuste posterior SOLO en controlador: antes se intentaba decodificar el cuerpo
  de un HTTP inesperado y el 500 de texto producia mensaje generico de transporte/
  formato. Ahora se informa HTTP 500 antes de JSON, sin registrar cuerpo sensible.
  Reporte original no se cambia. Nueva regresion mas herramienta: 26/26 (9,94 s),
  una advertencia, --basetemp .tmp/pytest-capacity-http-error-final; py_compile ok.
- No se ejecuta otro ensayo real ni se modifican autenticacion, hash, timeout,
  bloqueo o configuracion de app. Propuesta siguiente: verificar clave sin bloqueo
  de escritura y revalidar cuenta/credenciales antes de insertar sesion, con pruebas
  de reset/desactivacion concurrentes. Pendiente priorizar/implementar y coordinar
  repeticion; no atribuir validez de 30 a resultados de 5/15.


## Observacion HTTP real aislada: quince sesiones, 31/10/2026

- Usuario indica continuar tras explicar la prueba y proponer etapa quince.
  Comando scripts/capacity_probe.py --sessions 15 --execute, servidor privado
  loopback y base sintetica nueva; ninguna carga enviada al demo habitual.
- completed=true: 325 solicitudes medidas en 95,156 s. Quince logins, 270 lecturas,
  nueve lecturas de preparacion, doce escrituras y doce reintentos, una lectura
  de conflicto y seis intentos compartidos. Un 200 y cinco 409 esperados, cero
  respuestas inesperadas. Doce guardados independientes y reintentos sin duplicar.
- Panel (90): p50 1853,454 ms, p95 2668,450, max 2734,464.
  Episodio (90): p50 45,152, p95 91,751, max 113,098.
  Bandejas (90): p50 361,849, p95 583,758, max 767,560.
  Guardado independiente max 719,164 ms, login max 4779,974 ms.
- Integridad/referencias/autorias/valores/cantidades correctas: 64 pacientes y
  episodios sinteticos finales, 61 iniciales mas tres ingresos de Recepcion.
- Informe .tmp/capacity-runs/capacity-15-tc8fxrzm/report.json. Mismo Windows,
  Python 3.12.10, ocho CPU logicas, revision 729b8b3 y huellas de backend/runner
  de la etapa cinco; no cambios de codigo ni configuracion entre observaciones.
- Puerto privado sin escucha comprobado. demo.ps1 Status posterior confirma ambos
  servicios propios/respondiendo y misma copia de comunicacion.
- Resultado funcional correcto con ralentizacion observada del panel y login;
  no acredita SLA ni capacidad de campo. Etapa treinta pendiente de autorizar.
  Actualizacion solo documental; no repetir carga ni pruebas de aplicacion.


## Observacion HTTP real aislada: cinco sesiones, 31/10/2026

- Usuario autoriza ejecucion tras explicar alcance. Comando .venv Python
  scripts/capacity_probe.py --sessions 5 --execute, fuera de aislamiento para
  permitir servidor loopback propio. Ninguna carga enviada al demo habitual.
- Resultado completed=true: 109 solicitudes medidas, 85,813 s; cero respuestas
  inesperadas. 90 lecturas, cinco logins, cuatro escrituras y cuatro reintentos,
  tres lecturas de preparacion de escritura, una preparacion de conflicto y
  dos intentos sobre version compartida: exactamente un 200 y un 409 esperado.
- Panel: p50 396,551 ms, p95 604,897, max 644,743 (30 lecturas).
  Episodio: p50 17,268, p95 50,819, max 54,438 (30).
  Bandejas: p50 27,344, p95 119,827, max 156,770 (30).
  Guardado independiente mas lento 158,191 ms; login max 1448,117 ms.
- SQLite/referencias/autor/valores/cantidades exactas: 62 pacientes y 62 episodios
  sinteticos finales. Un ingreso nuevo de Recepcion, reintentos sin duplicar,
  conflicto sin sobrescribir. No se copio ni modifico la base del demo.
- Proceso propio cerrado por controlador, comprobacion posterior de puerto
  privado sin escucha. demo.ps1 Status posterior: backend/frontend propios y
  responden, copia .tmp/communication-rollout-20261030/clinical-communication-working.sqlite3.
- Informe .tmp/capacity-runs/capacity-5-ph3ac9jv/report.json, junto a base/manifest/log.
  Windows, Python 3.12.10, ocho CPU logicas. Backend revision 729b8b3, 62 archivos,
  SHA256 91277be59993da3e079a291adfbedcea6baafc0a92e34d9a77deb2a74af76575.
  Herramienta SHA256 1910dbeaeb13c4986ee91bc1aa11c099056d2c8daf22468a898d8111d8fc70ce.
- Sin SLA evaluado ni extrapolacion a usuarios reales, UI, LAN o dispositivos.
  Etapas 15/30 pendientes de autorizar. Sin cambios de codigo tras ejecucion;
  solo documentacion, sin repetir pruebas ni nuevo commit/push.


## Preparacion de observacion multiusuario: 31/10/2026

- Cambios limitados a scripts/capacity_probe.py, sus pruebas y documentacion.
  Aplicacion, API publica, UI, dependencias y configuracion del demo sin cambios.
- Primera validacion dirigida de herramienta: 19/19 (8,74 s). Se amplian controles
  de identidad de instancia, entorno, arranque simulado, reporte e identidad de
  codigo. Validacion relacionada: 80/80 (27,98 s), despues 81/81 (26,55 s),
  incluyendo test_demo_control, test_demo_db_backup y test_laboratory_preparation.
- Ajuste final de cancelacion: errores/interrupcion senalan cancelacion antes de
  esperar trabajadores; conexiones y proceso privado se cierran sin buscar PIDs.
  Solo se repite lo afectado: test_capacity_probe.py 25/25 (11,99 s), una advertencia.
- Comandos: PYTHONPATH=backend y .venv Python -m pytest -q --disable-warnings -x
  backend/tests/test_capacity_probe.py backend/tests/test_demo_control.py
  backend/tests/test_demo_db_backup.py backend/tests/test_laboratory_preparation.py
  --basetemp .tmp/pytest-capacity-tool-stable. Final especifico:
  backend/tests/test_capacity_probe.py --basetemp .tmp/pytest-capacity-tool-cancellation-final.
  py_compile de scripts/capacity_probe.py y su test aprobado.
- Invocacion real del modo descriptivo --sessions 5 verificada: 5 perfiles,
  61 episodios sinteticos previstos, 10 ordenes LAB, 90 lecturas y 109 operaciones
  medidas previstas. No crea servidor ni base; no se uso --execute.
- Todas las pruebas usaron bases temporales y HTTP/procesos simulados. No son
  medicion de capacidad ni ensayo directo de la app. No se inician servidores,
  trafico real de carga ni etapas 15/30. No se repiten suites backend/frontend
  de aplicacion porque no cambian sus fuentes/contratos; baseline publicada
  729b8b3 con CI 41161791602 aprobada.
- Pendiente explicar escenario concreto al usuario y coordinar ejecucion inicial.
  Sin nuevo commit/push. Aislamiento, limites e interpretacion en CAPACITY_OBSERVATION.md.


## Comunicacion tras alta: 30/10/2026

- Base publicada 589f93d, CI 41146977296 aprobada. Bloque nuevo local, sin commit/push.
- Suites completas: backend 573/573 (2409,73 s, 40:09), una advertencia
  anyio/Starlette ya existente; frontend estable 766/766, 83 archivos (1138,87 s).
  Codigo/pruebas sin cambios durante esa suite frontend, verificado con SHA256.
- Ajuste posterior limitado al historial: texto y motivo de autorizacion
  historicos solo para DOCTOR/SUPERVISOR; Recepcion conserva proyeccion restringida.
  Cambian solo ruta/test backend y tipos/pagina frontend. Pruebas afectadas
  posteriores: backend 17/17 (106,42 s), frontend 13/13 (33,78 s).
  Lint/build posteriores aprobados sin advertencias. No se repiten suites enteras
  tras ese ajuste; se conserva la validacion completa anterior y la dirigida final.
- Borradores/recuperacion previamente validados con 38/38, cinco archivos (88,42 s):
  PatientCommunicationsPage, App.communications, specimenDrafts, UncertainWrites,
  RecoveredWrites. Backend cubre ademas permisos, idempotencia, concurrencia,
  revocacion, ciclo, redaccion de historial y preparacion de copia sin cambiar origen.
- Comandos completos: .venv Python -u, PYTHONPATH=backend, pytest -q
  --disable-warnings -x backend/tests --basetemp .tmp/pytest-communication-final;
  npm.cmd run test --prefix frontend -- --maxWorkers=1; npm.cmd run lint
  --prefix frontend; npm.cmd run build --prefix frontend.
  Dirigidas finales: mismo pytest para backend/tests/test_patient_communications.py
  con --basetemp .tmp/pytest-communication-history-final; Vitest --run
  src/pages/PatientCommunicationsPage.test.tsx src/App.communications.test.tsx.
- Logs ignorados: .tmp/communication-backend-final.log,
  .tmp/communication-frontend-stable-final.log y
  .tmp/communication-frontend-affected-final.log. Huellas iniciales de codigo:
  .tmp/communication-source-fingerprint.json; cuatro archivos cambiados despues
  para el ajuste historico previsto, comprobados explicitamente.
- Diagnostico resuelto: primer fixture backend uso created_by en events; columna
  real username. Corregido solo fixture. Primer test de refresco frontend activo
  reloj simulado despues del temporizador real; corregido antes del montaje.
  Lint inicial detecto incremento redundante de ref en limpieza; retirado sin
  eliminar guardas de montaje/sesion/escritura. No se alteran runners ni timeouts.
- Primera suite frontend completa comenzo antes de ultimos ajustes y detecto un
  fallo de recuperacion de borrador; se detuvo. Se sustituyo por la suite estable
  completa aprobada, sin ediciones durante la ejecucion, no por un resultado antiguo.
- TestClient fuera del aislamiento por bloqueo previamente diagnosticado. Todas
  las bases de ensayo son temporales. Sin migracion de original/copia LAB,
  navegador operado ni servicios reiniciados. Proximo paso: coordinar ensayo
  manual en una copia nueva, con respaldo y activacion explicita.

### Correccion durante ensayo: etiqueta del responsable

- Usuario confirma autorizacion del aviso de EP-23 y acceso como Recepcion;
  reporta Medico responsable: Sin responsable activo. Lectura de la copia muestra
  seguimiento #1, usuario medico, display_name vacio, rol DOCTOR y active=1.
- Causa: proyeccion solo usaba display_name; UI interpretaba etiqueta vacia como
  cuenta inactiva. Se agrega fallback a username, y etiqueta ausente se describe
  como Sin responsable identificado. No se editan cuenta, asignacion o aviso.
- Backend dirigido ampliado: 19/19 (77,28 s), una advertencia ya existente;
  frontend afectado 14/14, dos archivos (26,53 s). Lint/build posteriores correctos.
  No se repite suite completa por este ajuste de proyeccion/presentacion; ultimas
  suites completas 573/766 anteriores, mas validaciones dirigidas posteriores.
- Stop/Start gestionados con la misma copia de comunicacion, Status correcto:
  ambos propios/respondiendo y ruta exacta. No se cambian cuenta, asignacion o
  autorizacion. Etiqueta corregida confirmada por usuario; agente no opera app.

### Activacion autorizada para ensayo manual

- Usuario confirma cierre de formularios/sesiones. Preparador ejecutado con origen
  .tmp/laboratory-rollout-20261028/clinical-lab-working.sqlite3 y destino nuevo
  .tmp/communication-rollout-20261030/clinical-communication-working.sqlite3,
  --communications. Conservo las 38 tablas anteriores, 22 pacientes/23 episodios.
- Respaldo verificado backups/clinical-20261031T022302Z-bc86f065.sqlite3,
  SHA256 b8417f6e4923a83aa8292ff4a7135fa100cd9cf7aa33d34ef0bc96f52a01b5a3.
  Preparacion inicial SHA256 1a9a63ad3c7c8f4a82dff71dd89c414e1d203967ea7e6edf83ac34ae0af4eb7f.
  El checksum de preparacion no acredita el archivo activo despues de escrituras.
- Stop/Start de servicios propios completados; Status confirma backend/frontend
  propios respondiendo y ruta exacta nueva. No sustituye original ni copia LAB.
- Lectura de la copia: EP-23 CLOSED, seguimiento #1, responsable medico. Interfaz
  no operada por agente. Pendiente login manual del usuario y validacion guiada.

### Cierre del circuito manual de comunicacion

- Confirmaciones aportadas por usuario: medico autoriza aviso de EP-23; Recepcion
  ve texto y registra llamada sin respuesta (30/10/2026 10:34 p. m.) y WhatsApp
  leido sin respuesta (10:36 p. m.). Ambos mantienen pendiente y proximo intento
  31/10/2026 10:15 a. m. Posterior respuesta/identidad y aviso transmitido confirman
  contacto, conservando explicacion pendiente. No se enviaron comunicaciones reales.
- Medico registra explicacion: caso desaparece del filtro habitual y aparece con
  completados. Rectificacion conserva original y reabre explicacion; contacto sigue
  confirmado. Nueva explicacion registrada y tres hechos conservados en historial,
  confirmado por usuario. Estado final: contacto/aviso confirmados y explicacion
  registrada. Agente no opero app; no se afirma ensayo manual de todas las ramas.
- Respaldo posterior de la copia activa, no de clinical.db:
  backups/clinical-20261031T024815Z-603b0fd9.sqlite3 y .sha256.
  SHA256 6a246a97acf43d8f871b2347bbe6827b0ae9aa7e7c4ff237e0ce811ee9dde509.
  Restauracion .tmp/clinical-20261031T024815Z-603b0fd9-communication-restore-check.sqlite3.
  Hash, integridad y referencias verificados: 22 pacientes/23 episodios. No se
  reemplaza la copia activa, original ni copia LAB; no se detienen servicios.
- Cambios posteriores solo documentales: diff/codificacion/enlaces revisados;
  no se repiten suites. Usuario autoriza despues commit/push y comprobar CI;
  publicacion/resultado remoto pendientes en el momento de preparar la entrega.

## Tablero de esperas y demoras: 29/10/2026

- Base publicada 82810c6, CI 40983611174 aprobada. Nuevo bloque local elegido por
  usuario; acceso confirmado para Supervisor y cuentas con permiso de coordinacion.
  GET /operations/delays es consulta sin migracion ni efectos sobre episodios.
- Primer intento de pruebas nuevas fallo en fixture: sqlite3.connect no usaba
  sqlite3.Row, requerido por migrate_patients. Se uso database.get_connection
  en el fixture, sin cambiar produccion para acomodarlo. Dirigidas 14/14 (6,13 s).
  Despues se amplian a esquema LAB parcial y coordinacion en medicina/enfermeria/
  laboratorio; esa version esta incluida en la suite completa aprobada.
- Interfaz dirigida inicial: 15/15, tres archivos (10,11 s), un trabajador.
  Se agrega despues caso de inicio historico y resumen visible de mayor antiguedad;
  el resultado anterior no se atribuye a esos ultimos cambios. La suite completa
  final si incluye ambos ajustes.
- Lint detecto advertencia de dependencia del efecto inicial; se uso la funcion
  refresh estable del hook. Lint/build posteriores aprobados antes del ajuste
  del resumen. Lint/build finales del resumen tambien aprobados, sin advertencias.
  Suite frontend completa final iniciada con --maxWorkers=1; log local ignorado
  .tmp/delays-frontend-final-20261029.log. Final: 753/753, 81 archivos,
  323,85 s. Sin cambios de runner, timeouts ni aislamiento entre archivos.
- Backend completo iniciado con Python .venv -u -m pytest -q --disable-warnings
  -x backend/tests, PYTHONPATH=backend y --basetemp
  .tmp/pytest-delays-final-20261029. Fuera del aislamiento que bloquea TestClient,
  diagnosticado en la revision anterior. Log: .tmp/delays-backend-final-20261029.log.
  Final: 556/556 (1687,36 s), una advertencia de deprecacion anyio/Starlette
  ya existente. Version final backend aprobada completa; sin fallos.
- Resultado vigente de este bloque: backend completo 556/556, frontend completo
  753/753 y lint/build finales aprobados. Diff, UTF-8 y enlaces locales revisados.
- Solo datos ficticios/bases temporales, sin navegador operado ni servicios
  reiniciados. Ensayo manual se coordinara con usuario; el backend gestionado no
  usa --reload y requiere reinicio manteniendo la copia LAB. Sin commit/push nuevo.
- Ensayo posterior autorizado, con reinicio gestionado sobre la misma copia LAB.
  Al retomar el 30/10, usuario confirma filtros de primer inicio/revision,
  exclusion del cerrado EP-23, refresco visible automatico, apertura de EP-2 y
  acceso con Supervisor y medico.demo1 coordinador. Agente no opero navegador.
  Recepcion sin opcion en menu tambien confirmado por usuario: ensayo manual
  acordado completado. No se repiten suites por estas anotaciones documentales;
  resultados automaticos del 29/10. Sin commit/push del nuevo bloque.

## Revision integral LAB: 29/10/2026

- Base Git: 69f9d15, cambios locales acumulados del bloque LAB; sin commit/push.
- Ensayo manual por usuario completado en copia: EP-23, orden #19, resultados,
  reemplazo de muestra, correccion/nueva revision, anulacion, alta con plan,
  publicacion/revision posterior y filtros. Relevo a medico aceptado; retorno
  a medico.demo1 rechazado, custodia conservada e historial confirmado.
- Primera ejecucion completa restringida detenida durante TestClient, tras cinco
  casos iniciales. Diagnostico aislado con faulthandler_timeout=20 muestra
  socket.accept en _fallback_socketpair al crear asyncio ProactorEventLoop,
  antes de inicializar la base temporal. Limite diagnostico de 40 s; sin cambiar
  aplicacion, runner ni tiempos de las pruebas del repositorio.
- Mismo caso fuera del aislamiento: 1/1 (2,95 s), una advertencia de deprecacion
  anyio/Starlette. Runner propio bloqueado detenido con PID/comando verificados;
  suite completa iniciada fuera del aislamiento en bases temporales separadas.
- Primera suite fuera del aislamiento: 221 aprobadas y un fallo (382,67 s),
  expectativa obsoleta 404 en followups despues de montar el router en main.
  Busqueda dirigida encontro la misma expectativa en muestras y profesionales.
  Se sustituyen las tres por 200 y paridad de datos main/router aislado;
  no se alteran permisos ni codigo de produccion. Dirigidas: 3/3 (11,21 s).
- Continua el resto de archivos desde test_laboratory_followups.py en orden,
  excluyendo los tres casos ya verificados; no se repiten los 221 aprobados.
  Python .venv -u, PYTHONPATH=backend, pytest -q --disable-warnings -x;
  temporales .tmp/pytest-lab-release-remaining-20261029 y log local ignorado
  .tmp/lab-release-backend-remaining-20261029.log. Final: 317/317 (1361,59 s),
  3 excluidas por haber sido verificadas en el grupo dirigido, una advertencia.
  Coleccion comprobada: 541 casos; 221 + 3 + 317 cubren todos los actuales.
  No se presenta el primer intento completo fallido como una suite aprobada.
- UTF-8 de archivos cambiados, diff --check, sintaxis Python y enlaces locales
  de las guias LAB correctos; sin bases ni logs entre archivos a publicar.
- Lint completo y build aprobados en esta revision. Frontend completo serial:
  npm.cmd run test --prefix frontend -- --maxWorkers=1; 742/742, 79 archivos,
  466,07 s. Log ignorado .tmp/lab-release-frontend-20261029.log. Sin modificar
  configuracion del runner, tiempos de espera ni aislamiento entre archivos.
- Verificacion final solo lectura: original con cero tablas LAB; copia con 12,
  EP-23 CLOSED, cero resultados/revisiones pendientes, propietario medico y
  pending_user_id nulo. No se sustituyo la original ni se opero el navegador.
- Validacion vigente: cobertura backend 541/541 en tramos descritos y frontend
  742/742 completo, lint/build aprobados. Cambios de esta revision: solo tres
  expectativas de pruebas y documentos. Sin commit, push ni CI nueva.

## Presentacion de inicio en colas: 28/10/2026

- Diagnostico de EP-23 en copia, solo lectura: ready_at y primer inicio presentes,
  historical=0. El codigo de care.queue devuelve waiting_minutes=None tras primer
  inicio para detener el contador; la UI confundia este caso con falta de datos.
- Se separa el mensaje terminado del pendiente/desconocido y se usa el formateador
  RD 12h existente en inicio actual/primero, ultima asignacion e historial.
  Sin modificar API, temporales de dominio, datos ni permisos.
- CareQueuePage.test y App.care.test iniciales 15/15 (10,41 s); tras completar
  el formato de historial, CareQueuePage.test, App.care.test y
  StaffingAuditValues.test: 18/18 (11,65 s), --maxWorkers=1. Dos nuevas pruebas
  cubren fecha UTC del dia siguiente, 12h, espera finalizada y ausencia real.
- Lint completo y build finales aprobados; diff, enlaces y UTF-8 verificados.
- Backend sin cambios y sin repetir suites. No se opero navegador por el agente
  ni se reiniciaron servicios. Usuario continua prueba manual de laboratorio.



## Arranque y preparacion LAB: 28/10/2026

- Nuevas pruebas iniciales: preparador 8/8 (4,11 s), startup+preparador 11/11
  (16,05 s), seleccion de copia/controlador/startup 39/39 (24,72 s).
- Regresion estable: test_laboratory_startup, test_laboratory_preparation,
  test_demo_control, test_laboratory_integration, test_laboratory_unified_discharge,
  test_laboratory_backup, test_demo_db_backup y test_dashboard_router:
  102/102, 181,07 s, una advertencia. Python local, PYTHONPATH=backend,
  basetemp `.tmp/pytest-lab-runtime-final-20261028`.
- Revision final encontro que los destinos tambien debian excluir auxiliares
  SQLite del origen y alias entre checksum/archivo. Se endurecio solo el preparador;
  su archivo final, incluidas tres variantes nuevas, aprobo 12/12 (5,09 s),
  `.tmp/pytest-lab-prepare-path-final-20261028`. No se repitieron modulos intactos.
- Sintaxis de scripts/demo.ps1 verificada con Parser de PowerShell, sin ejecutarlo
  ni iniciar/parar/contactar servidores reales en las pruebas de controlador.
  CLI real de preparacion si ejecutada sobre origen en solo lectura y nuevas
  rutas: 26 tablas previas preservadas, 21 pacientes, 22 episodios, 12 tablas LAB
  solo en snapshot/copia de trabajo. Original: cero tablas LAB.
- Snapshot: `.tmp/laboratory-rollout-20261028/clinical-lab.sqlite3`; rollback:
  `backups/laboratory-before-20261028.sqlite3`, ambos con .sha256. Restauraciones
  `restored-check.sqlite3` y `clinical-lab-working.sqlite3` verificadas iguales al
  snapshot por SHA-256. Datos y sesiones no impresos, copias ignoradas por Git.
- Frontend intacto en este bloque, sin repetir suites/lint/build. Base previa
  afectada 131/131 con un trabajador; ampliada paralela 190/193 no aprobada.
  No afirmar CI nueva. diff --check, UTF-8 y enlaces locales revisados al cerrar.



## Seguimiento tras alta: 28/10/2026

- Backend: test_laboratory_followup_ui, test_laboratory_followups y
  test_dashboard_router, 35/35 (346,75 s), una advertencia. Python .venv,
  PYTHONPATH=backend y basetemp `.tmp/pytest-followup-ui-final-20261028`.
  Tras asegurar cierre de conexion de dashboard se repitio solo su archivo:
  6/6 (34,02 s), `.tmp/pytest-followup-dashboard-final-20261028`.
- Primer intento backend fallo porque la prueba consultaba mine con la cuenta LAB
  en vez del responsable medico; se corrigio el actor de la prueba, no permisos.
- Frontend ampliado: 24 archivos, 190/193 (89,03 s), tres fallos al esperar sesion
  o dashboard inicial en App.results, App.samples y App.followups. Lint/build y
  pytest corrian simultaneamente. Solo esos archivos sin otras validaciones:
  12/12 (12,22 s). Esta evidencia apunta a carga/inicializacion; no prueba una
  causa unica y no convierte la ampliada en aprobada.
- Avisos de borrador corregidos: restaurar avisa al propietario del formulario;
  observar retiro de campos actualiza pausa tras relevo. Dos pruebas nuevas.
  Grupo afectado de 16 archivos: 130/131 (48,18 s), espera inicial App.followups.
  La prueba nueva esperaba capacidad antes de las dos fases reales: restaurar
  usuario y cargar dashboard. Se agregaron esperas por ambas etapas, manteniendo
  tiempos/aserciones de dominio; siguiente grupo 130/131 (42,23 s), ahora espera
  de App.samples en Restaurando sesion, antes de probar el formulario.
- Ante variacion de archivo de arranque y aprobacion acotada, se verifico la
  opcion CLI local --maxWorkers y se limito concurrencia SOLO en el comando final.
  Sin editar runner/configuracion/timeouts ni reglas de la aplicacion. Final:
  131/131, 16 archivos (96,37 s), ambiente jsdom total 50,80 s frente a 136,66 s
  en el grupo paralelo anterior. No se repitieron partes intactas aprobadas.
- Comando final exacto:

```powershell
npm.cmd run test --prefix frontend -- --maxWorkers=1 src/pages/LaboratoryFollowupsPage.test.tsx src/components/LaboratoryFollowupCard.test.tsx src/components/LaboratoryFollowupPanel.test.tsx src/components/LaboratoryDischargeForm.test.tsx src/components/LaboratoryResultForms.test.tsx src/components/LaboratoryOrderForm.test.tsx src/components/SpecimenWorkPanel.test.tsx src/components/SpecimenRepeatForm.test.tsx src/App.followups.test.tsx src/App.results.test.tsx src/App.samples.test.tsx src/session/specimenDrafts.test.ts src/components/UncertainWrites.test.tsx src/App.accounts.test.tsx src/App.staffing.test.tsx src/App.care.test.tsx
```

- Lint completo y build finales aprobados. Sin navegador operado, migracion de
  original, commit/push o CI nueva. diff --check y UTF-8 comprobados al cierre.



## Alta mixta: 28/10/2026

- Backend: test_laboratory_mixed_discharge, test_laboratory_legacy_summary,
  test_laboratory_unified_discharge y test_laboratory_followups: 42/42,
  363,31 s, una advertencia. Python local, PYTHONPATH=backend y basetemp
  `.tmp/pytest-mixed-discharge-20261028`, bases aisladas.
- Frontend: LaboratoryDischargeForm, LegacyLaboratoryOrders, SpecimenRepeatForm,
  LaboratoryResultForms, EpisodePage.results, App.samples, App.results,
  SpecimenWorkPanel, LaboratoryOrderForm, EpisodePage.samples, EpisodePage.orders,
  LaboratoryPage.structured, UncertainWrites, specimenDrafts, clinicalLabels,
  App.accounts, App.staffing, App.care y App.test: 164/164, 19 archivos, 41,12 s.
  Lint completo y build finales aprobados.
- Primera prueba del resumen fallo por suponer que anular resultado activo crea
  ANNULLED; el circuito real vuelve a PENDING. Se corrigio la expectativa y se
  mantuvo el comportamiento de la aplicacion. La politica se implemento despues
  de que el usuario eligiera resueltas + revision expresa. Verificacion final
  incluye recibos, versiones, omisiones/duplicados, permisos y rollback de auditoria.
- No se repitieron suites intactas. Sin UI operada ni base demo migrada; sin
  commit/push o CI nueva. diff --check y UTF-8 comprobados al cerrar.



## Repeticiones y cancelaciones UI: 28/10/2026

- Backend: test_laboratory_repeats, test_laboratory_cancellations,
  test_laboratory_queue y test_laboratory_result_projection: 49/49,
  297,29 s, una advertencia. Python local/PYTHONPATH=backend y basetemp
  `.tmp/pytest-lab-repeat-cancel-ui-20261028`, bases aisladas. Dos pruebas nuevas
  comprueban linaje con autor y necesidad de plan antes/despues del alta.
- Frontend final: SpecimenRepeatForm, LaboratoryResultForms,
  EpisodePage.results, App.samples, App.results, SpecimenWorkPanel,
  LaboratoryOrderForm, EpisodePage.samples, EpisodePage.orders,
  LaboratoryPage.structured, UncertainWrites, specimenDrafts, clinicalLabels,
  App.accounts, App.staffing y App.care: 127/127, 16 archivos, 26,38 s.
- Lint completo y build finales aprobados. Build inicial detecto review_due_at
  faltante en tipo reducido de seguimiento y prop de conflicto conectada por
  error al dashboard. Se completo el tipo y conecto a LaboratoryPage. La prueba
  de conflicto inicial fallo con esa conexion; corregida, App.samples 6/6.
  Regresion final anterior confirma todo lo afectado, sin ampliar tiempos.
- Consultar version ante conflicto ya no usa la pausa de actualizacion automatica:
  conserva campos, protege contexto/registro de escrituras y no hace otro POST.
  Muestras repetidas mantienen fuentes anteriores y el actor es el solicitante.
- Sin suites completas repetidas, navegador operado, migracion original,
  commit/push o CI nueva. diff --check y UTF-8 comprobados al finalizar.


## Creacion de ordenes LAB: 28/10/2026

- Backend existente: `test_laboratory_samples.py`, seleccion `create_explicit or
  role_matrix or missing_preconditions or invalid_order or audit_failure`:
  17/17, 9 excluidas, 60,12 s. Python local y basetemp
  `.tmp/pytest-lab-order-ui-20261028`. Bases aisladas; sin cambios de contrato.
- Frontend final afectado: LaboratoryOrderForm, EpisodePage.orders,
  LaboratoryResultForms, SpecimenWorkPanel, UncertainWrites, specimenDrafts,
  App.results, App.samples, EpisodePage.results, EpisodePage.samples,
  LaboratoryPage.structured, App.accounts, App.staffing, App.care y App.test:
  123/123, 15 archivos, 28,62 s. Incluye 18 pruebas nuevas de ordenes.
- Lint completo aprobado. Build detecto TS2352 en fixture parcial convertido a
  Episode; se reemplazo por datos ficticios completos tipados. Archivo afectado
  15/15 (4,29 s), build final aprobado. No hubo cambios del runner/timeout.
- No se repitieron suites completas sin cambios. Sin UI operada ni migracion de
  original, commit/push o CI nueva. git diff --check sin errores.


## Resultados por analitica: 28/10/2026

- Backend: `test_laboratory_result_projection.py` y `test_laboratory_queue.py`,
  13/13 (76,56 s), Python local con PYTHONPATH=backend y basetemp aislado
  `.tmp/pytest-result-forms-directed-20261028`.
- Frontend final: LaboratoryResultForms, SpecimenWorkPanel, UncertainWrites,
  specimenDrafts, App.results, App.samples, EpisodePage.results,
  EpisodePage.samples, LaboratoryPage.structured y clinicalLabels:
  75/75 (17,28 s). Consumidores App.accounts/App.staffing/App.care:
  11/11 (11,51 s). Lint completo y build aprobados.
- Pruebas iniciales descubrieron que una opcion reutilizada cambiaba sus fuentes
  seleccionadas implicitamente. Se da identidad a la opcion por IDs de muestras;
  12/12 del componente aprobaron. La integracion detecto luego una bandeja sin
  actualizar: refresh se llamaba con la operacion aun pendiente. Liberacion antes
  de callbacks confirmados corrige el orden; App.results 2/2 y regresion anterior
  aprobadas. Sin ampliar tiempos del runner ni alterar reglas del servidor.
- No se repitieron suites completas intactas; las bases previas siguen siendo
  historicas. Sin navegador operado, migracion de demo, commit/push o CI nueva.


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

## Frontend: tiempos y escritura de nota (28/10/2026)

Durante la integracion local de la bandeja LAB, `npm.cmd run test --prefix
frontend` termino con 605/609 aprobadas (63 archivos, 146,30 s). Fallaron cuatro
casos en App.test.tsx (dos), App.lifecycle.test.tsx y App.presence.test.tsx por
tiempo o pantalla inicial aun incompleta; tras el primer timeout se observo
escritura intercalada en la siguiente prueba. Muestreo del equipo: alrededor de
16 GiB libres; no se atribuyo el problema a falta de memoria.

Reintento de solo esos cuatro, mismos tiempos: tres aprobadas y persistio el
caso de nota/historial. Instrumentacion temporal del caso solo (sin ampliar
limites) midio episodio abierto a 1476 ms, nota escrita a 4352 ms, alta visible
a 4752 ms e historial a 5157 ms, superando los 5000 ms de la prueba. Se retiraron
todas las marcas temporales. Ese caso ahora pega la misma nota multilinea con
espacios y comprueba su valor antes de enviar; conserva las aserciones de trim,
payload, cierre e historial. Otras pruebas conservan la entrada por teclado.
No se modificaron runner, limites ni reglas de la aplicacion.

Regresion final de los seis archivos afectados: 55/55 aprobadas, 26,80 s,
incluidos los cuatro casos iniciales. Lint completo y build aprobados antes
del ajuste exclusivo de prueba; lint de App.test.tsx tambien aprobado despues.
No se repitio la suite completa ni se presenta aquel 605/609 como aprobacion.
Backend afectado: 21/21, 147,92 s. Base backend completa previa: 486/486;
sin nueva ejecucion completa backend ni CI. Demo original sin migrar.

## Formularios de muestras: regresion acotada posterior (28/10/2026)

Backend de muestras/catalogo/cola: 36/36, 142,38 s, sin migrar original.
Frontend de veinte archivos afectados: 154/155 en 33,09 s. Unico fallo: la segunda
prueba antigua de nota larga (`evita envios duplicados...`) agoto 5000 ms, misma
clase de entrada por pulsaciones medida arriba. Se homogeneizo pegado de la
misma nota, agregando comprobacion de valor antes de doble clic, y conservando
bloqueo, contadores de peticiones, errores, reintento y texto. Sin modificar
runner, limites ni regla de app. App.test.tsx completo: 25/25 en 13,77 s.

Despues se agrego guarda ante respuestas tardias al abandonar muestra o cambiar
episodio; solo se repitieron siete archivos afectados: 60/60, 15,27 s. Cubren
formularios, borradores, episodio/bandeja, sesion e incertidumbre. 32 pruebas
nuevas UI, una nueva backend. Lint completo antes de ultimos ajustes y lint
final de archivos afectados aprobados; build final aprobado. No se repitieron
las partes intactas de la regresion ni la suite completa de 609; no se presentan
los resultados parciales anteriores como ejecuciones completas aprobadas.
