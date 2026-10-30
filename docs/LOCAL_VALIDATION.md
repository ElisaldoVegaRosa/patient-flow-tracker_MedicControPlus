# Diagnostico de validacion local en Windows

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
