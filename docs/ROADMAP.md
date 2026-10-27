# Plan de MedicControl+

## Decisiones pendientes (leer primero)

- Historial autorizado: opcion 3, eventos de otras personas y sesiones dentro
  del permiso vigente. Implementacion local de ultimos siete dias (168 horas,
  hasta 50 recientes), linea continua y pagina de registros completos con
  filtros/paginacion; acciones legibles y horarios de 12 horas con AM/PM.
  Alcance: personal, areas y turnos; no amplia permisos de Mi turno ni crea
  una auditoria transversal clinica. Backend 289/289, frontend 594/594, lint y
  build aprobados. Usuario confirma historial reciente/completo, filtro y
  limpieza, y campos AM/PM de inicio/fin. Commit/push a origin/main autorizados;
  comprobar GitHub Actions despues de publicar.

- Politica acordada para el fin programado del turno: contador negativo y
  aviso, sin bloqueo automatico de tareas ni nuevas asignaciones. Coordinacion
  puede registrar extension motivada y auditada; el relevo y el cierre siguen
  explicitos. Implementacion local validada: suite backend 287/287, refuerzo
  posterior 2/2 afectadas, frontend 585/585, lint y build aprobados. Prueba
  guiada del contador, extension e historial completada. Mejora visual del
  historial autorizada: tabla Antes/Despues sin detalles tecnicos visibles. No se ha definido
  tiempo extra individual ni aprobacion administrativa de horas laborales.

- Colas, responsables y relevo publicados en `2accbe0`; CI
  [39894081075](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39894081075)
  aprobada. Prueba guiada EP-22 completada hasta aceptacion e inicio del relevo.
  La decision sobre la hora programada de un turno ACTIVE se recoge arriba.

- Personal/areas/turnos publicados en `1dff835`, CI
  [39532858950](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39532858950)
  aprobada. [Alcance de colas y asignacion](PATIENT_QUEUES_ASSIGNMENT_PLAN.md):
  dos responsables por episodio, colas por area/profesional, recomendacion
  explicable y confirmacion/relevo auditados. Usuario confirma cambio a
  enfermeria de Observacion con relevo aceptado y anterior responsable hasta
  aceptar; medico normalmente se conserva. Criterio acordado:
  ordenar pacientes por prioridad y espera; comparar candidatos disponibles por
  P1/P2 asignados, pendientes de su disciplina, total activo y rotacion en empate.
  Separar dependencias LAB y tiempo desde ingreso de espera desde triaje.
  No hay pesos ni tiempos clinicos nuevos. Usuario confirma el criterio y
  autoriza implementar el bloque con "Si, cont". Desarrollo y validacion
  completados localmente: backend suite 284/284 mas refuerzo final y rutas
  afectadas 44/44 (cobertura acumulada 285); frontend 577/577, 8 afectados y
  lint/build finales aprobados. Migracion ensayada
  dos veces en copia: 18 tablas anteriores preservadas, 20 pacientes y 21
  episodios; sin inferir responsables. [Guia local](PATIENT_QUEUES_ASSIGNMENT.md).
  Respaldo previo verificado. Usuario autoriza prueba guiada con "Si, cont":
  demo iniciado y migracion aplicada conservando 18 tablas previas, 20 pacientes
  y 21 episodios e integridad/referencias correctas. Usuario confirma cuentas
  de enfermeria, tres participaciones y turno #2 iniciado. Ajuste visual pedido:
  planificacion, turnos, profesionales y colas desplegables; 16 pruebas frontend
  afectadas y lint/build aprobados. Tres disponibilidades confirmadas;
  EP-22 ficticio activo, con triaje, Consulta y responsables medico/enfermeria
  confirmados. Antes de confirmar inicio, una lectura anterior de enfermeria
  con campos locales produjo aviso generico al quedar deshabilitada la antigua
  asignacion. Correccion local de identificacion y descarte de ese borrador:
  18 casos afectados y lint/build aprobados, suite frontend completa 581/581 en 58 archivos aprobada.
  Prueba guiada de EP-22 completa hasta relevo: Consulta a Observacion,
  medico conservado, enfermeria de Consulta retenida hasta aceptacion por
  enfermeria de Observacion, e inicios propios separados. Auditoria e integridad
  comprobadas en SQLite y PROPOSE/ACCEPT/START visibles confirmados en UI.
  Aviso y descarte de borrador sin envio confirmados en UI; caso de formulario
  deshabilitado cubierto por prueba automatizada tras expirar ventana original.
  Siguiente decision operativa: turno #2 siguio ACTIVE mas alla de su fin
  programado; hoy el cierre es manual y la disponibilidad depende del estado.
  Definir aviso/bloqueo o cierre supervisado antes de pruebas de campo.
  Bloque publicado en `2accbe0` con CI aprobada. Cambios posteriores requieren
  autorizacion de commit/push.

- Areas, turnos y coordinacion implementados localmente, autorizados con
  "Si, cont"; backend 270/270, frontend 568/568, lint y build aprobados.
  [Guia](STAFF_AREAS_SHIFTS.md).
  Ensayo de migracion en copia conserva todos los datos previos (20 pacientes,
  21 episodios). Usuario autorizo prueba manual: demo iniciado, migracion
  aplicada y filas previas conservadas; integridad/referencias correctas.
  Usuario confirma concesion y acceso; turno #1 cerrado y participacion #1
  finalizada, con recorrido completo auditado. Retirada auditada, sesion
  anterior invalidada y nuevo acceso con Mi turno propio sin controles de
  edicion confirmados. Nueve tablas clinicas conservadas e integridad correcta.
  Conflicto entre sesiones cubierto automaticamente; sin prueba manual
  especifica. Usuario autoriza commit/push a origin/main y comprobacion CI con
  "Si, cont". Publicacion en preparacion al redactar; al retomar consultar Git
  y CI del SHA publicado. Despues se decidira alcance de colas por profesional
  y sugerencias de asignacion; no estan incluidos en este bloque.

- Cuentas personales publicadas en `b2265c2`, CI [39360417857](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39360417857)
  aprobada. [Guia](PERSONAL_ACCOUNTS.md).
  Administrador exclusivo sin consulta clinica, alta inicial local, auditoria,
  revocacion, versiones y recibos compartidos. Turnos/areas/colas excluidos.
  Cobertura backend 252, frontend 560/560, lint/build aprobados; 21 dirigidas
  posteriores por diagnostico del alta inicial, incluidas 5 nuevas de CLI.
  Migracion aplicada y admin.demo creado una sola vez durante prueba autorizada.
  Usuario confirma alta medico.demo1, acceso por perfil, baja con revocacion,
  reactivacion sin recuperar sesion y restablecimiento (revoca, clave antigua
  rechazada, nueva aceptada). Demo iniciado, prueba manual completada.
  Siguiente alcance autorizado: [areas, turnos y coordinacion](STAFF_AREAS_SHIFTS_PLAN.md).
  Usuario eligio coordinacion para asignar area/turno; administrador solo
  concede/retira permiso. Planificacion y disponibilidad explicitas, con
  auditoria; colas y asignacion de pacientes quedan despues. Sin nueva
  prueba directa acordada ni commit/push nuevos; implementacion autorizada.

- Vista imprimible publicada en `ce16ed8`, CI [39354682995](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39354682995)
  aprobada. [Guia](WRISTBAND_PDF_DEMO.md). Solo enfermeria/supervisor despues
  de triaje guardado, con detalle vigente y revision ante cambios. Sin entrega,
  cambio de QR ni estados clinicos. 37 dirigidas, frontend 553/553 en 53
  archivos, 18 casos tras ajuste final, lint y build aprobados. Usuario
  confirmo vista previa EP-21 y aporto PDF abierto en captura, completo
  y legible; encabezado de navegador aun visible. Usuario confirma lectura
  QR desde PDF en Android y apertura de Paciente Identidad Demo 21 / EP-21.
  Impresion fisica pendiente; sin nuevas pruebas automaticas directas.
  Siguiente alcance propuesto: [cuentas personales](PERSONAL_ACCOUNTS_PLAN.md),
  administrador separado con permiso propio elegido por usuario. Crear cuentas,
  activar/desactivar, restablecer y auditar sin privilegios clinicos implicitos.
  Turnos, areas, coordinacion y colas se implementarian despues de esa base.
  Implementacion autorizada posteriormente; estado local y validacion en el
  bloque inicial. Sin autorizacion nueva de commit ni push.

- Identidad provisional publicada en `e04be5f`, CI [39349014853](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39349014853)
  aprobada. [Detalle](PROVISIONAL_IDENTITY.md).
  Confirma solo archivo/ADMISSION; supervisor consulta pendientes. Conserva
  episodio e historial, bloquea coincidencias y no fusiona. Borradores y
  recibos integrados en controles compartidos. Cobertura completa aprobada:
  235 backend entre tramo inicial y pendientes; 535 frontend tras corregir
  el unico fallo y aprobar los 11 casos afectados. Lint/build aprobados.
  Dirigidas 33 backend/67 frontend aprobadas. Migracion comprobada en copia
  aislada de respaldo verificado. Usuario autorizo prueba manual: demo
  iniciado y base migrada conservando 19 pacientes/20 episodios; integridad
  y referencias correctas, perfil archivo disponible. Usuario confirma prueba
  completa en EP-21: ingreso provisional, verificacion, auditoria, mismo
  episodio activo y salida de pendientes. Siguiente decision: alcance inicial
  de vista imprimible de pulsera para demo y vista previa/PDF; impresora,
  consumibles, entrega fisica e invalidacion requieren diseno y equipo.
  No hay autorizacion de nuevos commit/push ni de nuevas pruebas directas.

- Lector publicado en `46a18b8`, CI `39195510597` aprobada;
  [detalle](QR_CAMERA_DEMO.md). Camara solo por solicitud, captura sin consulta
  automatica y confirmacion unica mientras espera API. Entrada manual preservada.
  Frontend 521/521, lint y build aprobados. Prueba guiada confirmada por usuario
  en Android/Chrome con QR en pantalla, camara/cancelacion/captura y consulta
  del episodio correcto. Acceso temporal por ADB reverse; sin exponer el
  servidor a LAN. Retoma del 19 de octubre: demo detenido tras reinicio.
  Siguiente propuesta: identidad provisional y confirmacion auditable por
  admision/archivo; inspeccion confirma identidad obligatoria en API/esquema
  y ausencia de ese perfil. Sin fusion ni nuevas pruebas directas. Tableta,
  pulsera impresa y configuracion de campo siguen pendientes.

- [Plan de urgencias](URGENCIAS_PILOT_PLAN.md): demo ficticio con una tableta,
  piloto local de cinco y ampliacion gradual hasta treinta. Inspeccion tecnica
  separa operacion PC, camara/HTTPS, identidad provisional sin fusion y emision.
  Circuito completo 84-168 h preliminares, sujeto a equipos y diseno detallado;
  sustituye las 36-72 h iniciales.
- Subpaquete A autorizado con cont e implementado localmente: operacion
  del demo en PC mediante [guia y tareas visibles](DEMO_OPERATIONS.md).
  23 pruebas dirigidas aprobadas; suite backend 216/216 aprobada (439,95 s).
  prueba guiada completada por el usuario: arranque, estado, parada, puertos
  libres y nuevo arranque con acceso visible. Cierre y publicacion
  completado en `361d33c`, CI `39164657470` aprobada. Consultar antes de nuevas
  pruebas directas. Usuario sin tableta; siguiente alcance de lector separado
  en preparacion de software y ensayo fisico pendiente de equipo.
  Camara preparada localmente en la entrega posterior; ensayo de tableta,
  identidad provisional e impresion siguen pendientes.
  No hay autorizacion nueva de commit ni push.

- Bloque priorizado y autorizado: buscador comun por nombre o EP para las
  cuatro bandejas. Implementado y validado: combina filtros, mantiene metricas
  generales y conserva campos sin guardar de laboratorio al ocultar ordenes.
  No cambia API, permisos, datos, comparacion de identidad ni busqueda servidor.
  Validacion: 35 pruebas dirigidas y suite frontend 487/487 en 47 archivos
  aprobadas. Ajuste posterior del estado vacio de Supervisor: 15 pruebas
  afectadas (incluido un caso nuevo), lint y build aprobados.
  Usuario confirmo prueba guiada en las cuatro pantallas con EP-20, EP-16 y
  EP-18/orden #15; busquedas, filtros, limpieza y metricas conservadas, sin
  crear registros. [Resultados](LOCAL_DEMO_CHECK.md). Commit/publicacion
  autorizados el 17 de octubre; resultado remoto en la [CI de main](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/workflows/ci.yml?query=branch%3Amain).
  Consultar antes de nuevas pruebas directas. Tras cerrar la entrega, acordar
  la siguiente necesidad concreta del demo.
- Ciclo de alertas comprobado manualmente en EP-20: generacion, reconocimiento
  y escalamiento por Enfermeria, resolucion por Medico, consulta por Supervisor
  y cierre final del caso ficticio. Historial y autores conservados; permisos
  confirmados. [Resultados](LOCAL_DEMO_CHECK.md). Cierre publicado en `ebc433b`;
  CI [39076266889](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39076266889)
  aprobada. Conservar sus validaciones sin repetirlas por documentacion.
- Lenguaje de interfaz publicado en `07050fc`; CI
  [39064241240](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39064241240)
  aprobada: backend, frontend, lint y build. Catalogo compartido de etiquetas sin
  cambios de API, permisos ni notas originales. Consulta manual de EP-18 y orden
  LAB #15 confirmada por el usuario; frontend 471 pruebas en 45 archivos.
- Respaldo/restauracion publicados en `dcf2d7a`; CI
  [39062489007](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39062489007)
  aprobada. Copia y ensayo verificados con 18 pacientes y 19 episodios; copia
  externa y SHA-256 verificados en `D:\MedicControlPlus\backups` sin sustituir la
  base activa. [Procedimiento](DEMO_DATABASE_BACKUP.md) y
  [diagnostico del ejecutor Windows](LOCAL_VALIDATION.md).
- Bloque LAB y ciclo de vida publicado en
  `9a5bc84b3bcb12c6e63de7faeb6202ea255d09d3`; CI
  [39060204711](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39060204711)
  aprobada. Cierre documental en `1b70ee0`, CI `39060586831` aprobada.

- Etapas 30-65 publicadas y cerradas. Ultima etapa numerada: 65, commit
  `bb02208`, CI `39000263862`
  aprobada. Estado y validaciones en [PROJECT_STATUS](PROJECT_STATUS.md).
- Identidad del paciente (64) y recuperacion de borradores tras recarga (65)
  resueltas dentro de su alcance acordado. El borrador temporal de la pestana
  caduca tras 30 minutos desde ultima edicion y requiere restauracion explicita;
  se conserva la proteccion por versiones y la separacion de envios por confirmar.
- Recibos: evaluacion del 17 de octubre completada sin modificar la base. Hay 14
  recibos locales, 12 vencidos; consulta por indice compuesto. Recomendacion:
  posponer archivo/limpieza mientras no haya evidencia de crecimiento o impacto
  medido que lo justifique. Mantener reservas de claves y consulta de resultados,
  aun vencidos. Un futuro archivo necesita politica de plazo/volumen, estrategia
  de reserva, compatibilidad de consulta y pruebas de concurrencia; no ejecutar
  borrados de recibos como mantenimiento. Detalle en [WRITE_OPERATIONS](WRITE_OPERATIONS.md).
- Objetivo elegido el 17 de octubre: seguir probando el demo en esta PC.
  Circuito EP-17 y pruebas guiadas EP-18/EP-19 completados; [guia y resultados](LOCAL_DEMO_CHECK.md).
  El procedimiento de respaldo/restauracion se preparo localmente tras acordarlo
  con el usuario; validacion backend completa aprobada y publicacion autorizada.
  Despliegue, TLS y cuentas reales quedan fuera del objetivo inmediato.
- Correccion LAB autorizada y publicada en el bloque conjunto: reemplazar finalizacion
  generica LAB en episodio por acceso a bandeja; Laboratorio escribe/publica,
  Supervisor consulta y otros roles reciben indicacion sin publicar. Conservar
  NURSING/MEDICAL, permisos API, versiones y bloqueo compartido. En esta
  correccion inicial no se modifico la orden ya completada de EP-17. Pruebas
  dirigidas 55/55; suite frontend 454 en
  41 archivos, lint/build y prueba directa aprobados. Integrada en el commit
  publicado del bloque conjunto.
- Bloque conjunto de consulta/correcciones aprobado y publicado;
  [politica y criterios](RECORD_LIFECYCLE_DESIGN.md). Incluye historial visible
  de ordenes completadas, rectificacion/anulacion de resultados y notas, alta
  reabierta e ingreso sin actividad anulado logicamente. Backend 191/191,
  frontend 457/457, lint/build y compatibilidad dirigida 14/14 aprobados.
  Aviso posterior de recarga/salida: 53 pruebas dirigidas y lint/build aprobados.
  Circuito de EP-17 confirmado: consulta LAB y supervision, alta CLOSED, evento
  DISCHARGE, listado historico y ambas ordenes LAB conservadas en el detalle.
  Pruebas manuales guiadas completadas: EP-18 cubrio correccion de evaluacion,
  resultado LAB y alta, anulacion/republicacion LAB, reapertura y cierre final;
  EP-19 cubrio anulacion de ingreso sin actividad y conservacion del motivo en
  la linea de tiempo y su presencia ANNULLED en Historial de episodios.
  EP-17 conserva su circuito cerrado. Consultar al usuario
  antes de abrir la app para nuevas pruebas directas. No hay autorizacion de
  borrado definitivo ni de una nueva entrega.
- Cierre documental de 65 y evaluacion de recibos publicados en `797678e`,
  CI `39035455474` aprobada. Guia y resultados incluidos en el bloque publicado.
  Conservar validaciones aprobadas sin repetir suites por cambios documentales.
- Fuente historica: [revision integral](OPERATIONAL_FLOW_REVIEW.md); sus hallazgos
  de entradas, laboratorio, identidad y borradores ya fueron abordados en 62-65.
  Consultar etapas antiguas por busqueda dirigida, sin tratarlas como pendientes.

## Plan e historial de etapas (consulta por demanda)

Plan reconstruido propuesto; no recuperado del chat original

## Estado y autorización

- Etapa 28 cerrada: validación funcional completada y episodios CLOSED de
  solo lectura.
- Etapa 29 cerrada y publicada: nota de alta editable para DOCTOR en ACTIVE.
  Commit `f35770638a7482a363c38e253ba33c86e5abb28c`; CI aprobada,
  ejecución `37244485263`. Resultados confirmados del cierre: backend,
  14 pruebas; frontend, 18 pruebas; lint y build aprobados.
- Este documento registra una propuesta. La implementación de cada tarea
  queda pendiente de aprobación explícita; documentar el plan no la autoriza.
- Las etapas 30–33 son refactorizaciones que deben conservar el comportamiento.
  Las nuevas funcionalidades y los cambios de comportamiento se tratarán en
  tareas separadas, con alcance y aprobación propios.
- Etapa 30 cerrada tras 30A–30I; cierre documental publicado en `9ed4dbf`,
  CI `37726240159` aprobada. Validación vigente: 46 pruebas frontend,
  lint y build aprobados; CI `37725349264` y `37725456535` aprobadas.
- Etapa 31 cerrada tras 31A–31C: 19 pruebas backend aprobadas;
  CI `37857021915` y `37857173485` aprobadas.
- Los criterios de las etapas 32–37 son requisitos futuros; esta revisión
  no ejecuta pruebas nuevas ni autoriza su implementación.

## Cierre de la Etapa 53

- 53A y 53B publicadas: protección común en el frontend y transacciones/
  idempotencia compartidas en el servidor para las escrituras operacionales.
- Criterios verificados: bloqueo inmediato por recurso, operaciones independientes,
  concurrencia entre conexiones, reintento con la misma clave sin repetir efectos,
  rollback, permisos/sesiones actuales y evaluaciones nuevas intencionales.
- Evidencia vigente: 132 pruebas backend, 230 frontend, lint y build aprobados;
  CI de 53A `38183333079` y de 53B `38184736932` aprobadas.
- Prueba funcional directa de evaluaciones realizada por el usuario y confirmada
  satisfactoria. Confirmación manual; no constituye una nueva prueba automatizada.
- Etapa 53 cerrada dentro del alcance acordado. Límites: recuperar una intención
  ambigua después de recargar/cambiar de sesión y archivar recibos conservando
  la reserva de claves requieren un diseño posterior. Las intenciones distintas
  entre dispositivos no se deduplican por contenido clínico.
- Cierre documental publicado en `94bc0800611cb54cec05f873a06a97d24217a987`;
  CI `38185005967` aprobada. Conserva las validaciones previas.
  Siguiente propuesta: Etapa 54, recuperación común de borradores tras HTTP 401.

## Entrega 53B: escrituras atómicas e idempotencia compartida

- Alcance transversal autorizado, implementado y publicado.
- Validación: 132 pruebas backend (26 nuevas, una advertencia existente),
  230 frontend (ocho nuevas), lint y build aprobados.
  Backend con Python de `.venv` y `--basetemp .tmp/pytest-53b-full`; ejecutado
  fuera del aislamiento que bloquea el socket interno de TestClient en Windows.
  Frontend con `--maxWorkers=1` y temporales locales, como en 53A.
- `atomic_write` reserva la escritura SQLite antes de comprobar estados y confirma
  juntos cambios, eventos y recibo. Aplica a ingreso, evaluaciones, órdenes, signos,
  triaje, tareas, alertas, alta, demo, reglas y escaneo (que registra un evento).
- `Idempotency-Key` distingue intenciones por identidad, rol, ruta y huella del
  payload. Misma clave no repite efectos; otra clave permite otra evaluación.
  Comprueba sesión/permisos actuales, conflictos y vigencia de 24 horas.
- Recibos con referencias al episodio; no guarda copias de notas clínicas.
  Las claves vencidas siguen reservadas. Detalle clínico reconstruido al reintentar.
- El cliente HTTP reutiliza la clave ante red/5xx, sin reenvío automático; un éxito
  consume la intención. Metadatos/payload permanecen solo en memoria de la sesión,
  con límite de 256 intenciones ambiguas. Recargar o cambiar de sesión pierde esa
  asociación y exige revisar un resultado incierto antes de una nueva intención.
- Pruebas incluyen concurrencia entre conexiones, respuesta perdida, rollback,
  bloqueo SQL, claves distintas/conflictivas/vencidas, permisos y sesiones.
- Migración aditiva documentada en `backend/migrations/003_write_receipts.sql`;
  datos clínicos existentes preservados. Política completa: [escrituras](WRITE_OPERATIONS.md).
- Publicada en `3037eb4a35475138f0a4c1925db33409f7f04f6e`;
  CI `38184736932` aprobada: backend, frontend, lint y build.

## Entrega 53A: protección común de envíos pendientes

- Alcance transversal autorizado: mecanismo único `usePendingOperations`,
  compartido por App y EpisodePage, para acceso, salida, ingreso, laboratorio,
  demo, reglas, alta, evaluaciones, órdenes, signos, triaje, tareas y alertas.
- Adquiere el bloqueo antes del siguiente render; identifica la operación y
  el recurso, y permite operaciones independientes. Laboratorio y episodio
  comparten el bloqueo de una misma tarea incluso al cambiar de pantalla.
- Sustituye los bloqueos anteriores; conserva permisos, estados, mensajes,
  campos ante errores y tratamiento de HTTP 401. Libera al finalizar o cancelar
  y exige una nueva acción explícita para reintentar; no reenvía automáticamente.
- Protege solicitudes simultáneas desde esta instancia del frontend. La
  idempotencia del servidor entre pestañas, dispositivos o reintentos tras una
  respuesta perdida queda fuera del alcance y requiere una decisión específica.
- Validación: 222 pruebas frontend (24 nuevas), lint y build aprobados.
  Ejecución local con `npm.cmd run test --prefix frontend -- --maxWorkers=1`;
  `TEMP` y `TMP` apuntaron a `.tmp\vitest` para evitar temporales ausentes
  del entorno aislado. La ejecución paralela tuvo cinco tiempos de espera;
  la suite completa con un trabajador pasa sin ampliar los tiempos.
- Publicada en `c5c32e28e93965db28fcdb3cb36f6a715e984f24`;
  CI `38183333079` aprobada: backend, frontend, lint y build.
  Backend, contratos de API y base local sin cambios.

## Entrega 30A

- Cerrada y publicada: extracción de `EpisodeHistoryPage`
  con `historyData`, `onRefresh` y `onOpenEpisode` como props.
- Conserva `HistoryData`, CSS y presentación; la lógica y las llamadas API
  permanecen en `App.tsx`.
- Cobertura añadida para historial vacío y actualización del historial;
  se conserva la prueba de consulta posterior al alta.
- Validaciones locales: 20 pruebas frontend, lint y build aprobados;
  `git diff --check` sin errores. Commit
  `a77970cfa653af7b72254573063f2d5445ed9ee3`; CI `37716248936` aprobada.
- Esta entrega no completa la Etapa 30. La siguiente entrega requiere definir
  su alcance y aprobar la tarea antes de implementarla.

## Entrega 30B

- Alcance aprobado: extraer la pantalla «Escanear pulsera» a `ScanPage`, sin
  estado propio; conservar formulario, textos, estilos y campo obligatorio.
- Cerrada y publicada. Consulta API, errores, permisos y navegación
  permanecen en `App.tsx`; sin cambios de comportamiento.
- Prueba añadida para el rechazo de la consulta, manteniendo el formulario;
  se conservan los casos existentes de apertura de episodios por token.
- Validaciones locales: 21 pruebas frontend, lint y build aprobados;
  `git diff --check` sin errores.
- Commit `37864c1a4dfd027c0796bb7aaaee846451c70b40`; CI `37717881092`
  aprobada. No completa la Etapa 30 ni autoriza la implementación de las
  siguientes entregas.

## Entrega 30C

- Entrega cerrada y publicada: extracción de «Registrar llegada»
  a `NewEpisodePage`, sin estado propio y con callback `onSubmit`.
- Campos, textos, valores iniciales y estilos conservados. Creación del episodio,
  API, errores, permisos y navegación permanecen en `App.tsx`.
- Pruebas añadidas de ingreso correcto y rechazo de la API.
- Validaciones: 23 pruebas frontend, lint y build aprobados; diff revisado y
  `git diff --check` sin errores.
- Commit `466cc5efc592106e576db305747593a3ec726df5`; CI `37718612913`
  aprobada. No completa la Etapa 30; las siguientes entregas requieren aprobación.

## Entrega 30D

- Entrega cerrada y publicada: extracción del centro de control
  general a `DashboardPage`, con datos y callbacks; sin estado propio.
- Indicadores, cálculos, tabla, estado vacío y acciones conservados. Carga, API,
  errores, permisos y navegación permanecen en `App.tsx`.
- Pruebas de integración para indicadores, apertura del paciente y actualización.
- Validaciones locales: 25 pruebas frontend, lint y build aprobados;
  `git diff --check` sin errores.
- Commit `3a4616125d3733168b60a8bafc1aacaf41b8b41d`; CI `37719496231`
  aprobada, según el resumen de continuidad.
- No completa la Etapa 30; las siguientes entregas requieren aprobación.

## Entrega 30E: LaboratoryPage

- Entrega cerrada y publicada: bandeja «Órdenes pendientes» extraída a
  `frontend/src/pages/LaboratoryPage.tsx`, sin estado propio.
- Props: `laboratoryQueue`, `onRefresh` y `onCompleteOrder`
  (evento del formulario e identificador de orden). Reutiliza `LaboratoryQueue`
  existente en `frontend/src/types/clinical.ts`.
- Conserva contador, estado vacío, tarjetas, textos, CSS y validación
  del resultado (`required` y `minLength`).
- Mantiene carga, API, errores, permisos, navegación y publicación en
  `App.tsx`, mediante los callbacks existentes.
- Siete casos nuevos de integración: bandeja vacía y actualización, presentación de órdenes,
  envío correcto, rechazo de publicación y acceso por los roles permitidos.
- Validación local: 32 pruebas frontend, lint y build aprobados.
- Commit `e0cc198ff117d118aee39bc2a9afe46b658412cb`; CI `37721355298`
  aprobada con pruebas backend, frontend, lint y build.
  La Etapa 30 permanece abierta; las siguientes entregas requieren aprobación.

## Entrega 30F: SupervisorPage

- Entrega cerrada y publicada: extracción del centro de
  control del supervisor a `frontend/src/pages/SupervisorPage.tsx`.
- Sin estado propio. Recibe `supervisorData`, `supervisorFilter`,
  `rulesMessage`, `evaluatingRules` y callbacks `onLoadDemo`,
  `onEvaluateRules`, `onRefresh`, `onFilterChange` y `onOpenEpisode`.
- Conserva indicadores, tabla, filtros, textos, acciones y CSS. Reutiliza
  `SupervisorData`; estado, API, errores, permisos y navegación siguen en `App.tsx`.
- Seis casos nuevos cubren filtros, indicadores, apertura, actualización
  y acceso por rol; conservadas las pruebas de reglas temporales.
- Validación local: 38 pruebas frontend, lint y build aprobados.
- Commit `d700a5aa0e7acb0a398eadc11b7a9efc54086ebf`; CI `37723480808` aprobada.
  La Etapa 30 continúa abierta.

## Entrega 30G: EpisodePage

- Entrega cerrada y publicada: traslado del componente
  existente a `frontend/src/pages/EpisodePage.tsx`.
- Conserva sus props `episode`, `user`, `updateEpisode` y `showError`,
  estado local, llamadas API, permisos, formularios y presentación.
- A diferencia de las pantallas anteriores, este componente ya contenía
  lógica propia: se conserva dentro de `EpisodePage` sin redistribuirla.
- `App.tsx` mantiene sesión, navegación y episodio seleccionado; importa la página.
- Validación local: 38 pruebas frontend, lint y build aprobados.
  Conservadas las pruebas ACTIVE/CLOSED por rol y de alta médica.
- Commit `7cf60c706131da9f9f0e9207639e609989010ec7`; CI `37724043270` aprobada.
  La Etapa 30 continúa abierta.

## Entrega 30H: LoginPage

- Entrega cerrada y publicada: extracción del formulario
  de acceso y de la vista «Restaurando sesión» a `frontend/src/pages/LoginPage.tsx`.
- Props `restoringSession`, `error` y `onSubmit`; sin estado propio.
- Conserva formulario, cinco usuarios demo, valores iniciales, textos y CSS.
- Autenticación, restauración, token y errores permanecen en `App.tsx`.
- Tres casos nuevos de integración: ingreso correcto, restauración correcta
  y fallo de restauración; se conserva la cobertura de credenciales rechazadas.
- Validación local: 41 pruebas frontend, lint y build aprobados.
- Commit `18841e97464e3aa38ab91a0b98d88a6661abb93f`; CI `37724737074` aprobada.
  La Etapa 30 continúa abierta.

## Entrega 30I: AppHeader

- Entrega cerrada y publicada: extracción de la cabecera
  a `frontend/src/components/AppHeader.tsx`, sin estado propio.
- Recibe `user` y callbacks `onDashboard`, `onSupervisor`, `onScan`,
  `onHistory`, `onLaboratory`, `onNewEpisode` y `onLogout`.
- Conserva botones, identidad, visibilidad por rol, textos y CSS.
  Navegación, sesión y API permanecen en `App.tsx`.
- Cinco casos nuevos cubren botones visibles y acciones de los cinco roles.
- Validación local: 46 pruebas frontend, lint y build aprobados.
- Commit `a80d42c5394930579f43491ff47bfd57b11cc2f9`; CI `37725349264` aprobada.
  La Etapa 30 continúa abierta; revisar sus criterios de cierre.

## Revisión de cierre de Etapa 30

- Ocho páginas extraídas y cabecera compartida separada.
- `App.tsx` conserva la composición general, sesión, navegación y datos.
- Comportamiento, permisos y pruebas conservados según las entregas aprobadas.
- Cliente HTTP en `frontend/src/api/client.ts` y tipos en
  `frontend/src/types/clinical.ts`. `EpisodePage` conserva su lógica existente.
- No se requiere otra extracción para cumplir este alcance. Cierre documental
  publicado en `9ed4dbf`, CI `37726240159` aprobada; las referencias anteriores a Etapa 30
  abierta describen el estado histórico de cada entrega.

## Entrega 31A: configuración del backend

- Entrega cerrada y publicada: `backend/app/config.py` con
  `DATABASE_PATH`, `DEMO_USERS`, `PASSWORD_HASH_ITERATIONS` y
  `SESSION_DURATION_HOURS`, conservando valores y ruta efectiva de SQLite.
- Importadas en `main.py`; se conserva `main.DATABASE_PATH` como punto
  de sustitución usado por las pruebas con SQLite temporal.
- Conexiones, inicialización, autenticación, CORS y rutas permanecen en
  `main.py`; sin cambios de endpoints, esquema ni datos.
- Validación: 16 pruebas backend aprobadas, con tres advertencias conocidas,
  usando Python local y SQLite temporal. Dos pruebas nuevas de ruta y sustitución.
- Constantes y funciones conservadas; sin acceso a la base demo durante la validación.
- Commit `26a6567758c4ad324d642307e86524e6f760b5e9`; CI `37727047490` aprobada.
  La Etapa 31 continúa abierta.

## Entrega 31B: conexiones SQLite

- Entrega cerrada y publicada: creación de conexiones en
  `backend/app/database.py`, mediante `get_connection(database_path)`.
- Conserva `sqlite3.Row` y `PRAGMA foreign_keys = ON`.
- Wrapper `main.get_connection()` pasa `main.DATABASE_PATH`, conservando
  la sustitución existente en pruebas; inicialización, consultas y rutas intactas.
- Dos pruebas nuevas de filas por nombre, integridad referencial y aislamiento
  entre bases. Conservada la cobertura del wrapper con ruta temporal.
- Validación: 18 pruebas backend aprobadas, tres advertencias conocidas.
- Commit `376d59d85143371af407139f8ec459ced3e6dec5`; CI `37727737285` aprobada.
  La Etapa 31 continúa abierta.

## Entrega 31C: inicialización SQLite

- Entrega cerrada y publicada: inicialización del esquema
  y usuarios demo en `database.initialize_database`.
- Recibe conexión, usuarios demo, función de hash y función de fecha;
  sin dependencias circulares. SQL, commit y cierre de conexión conservados.
- Wrapper `main.initialize_database()` y arranque FastAPI conservados.
- Prueba nueva de reinicialización sin duplicados ni pérdida de esquema,
  usuarios, sesiones o episodios.
- Validación: 19 pruebas backend aprobadas fuera del sandbox, una advertencia
  observada; temporal `.tmp/pytest-31c-verified` por problemas del temporal habitual.
- Commit `1838e5716892106d30ea6b40000c9e8c5a551b24`; CI `37857021915` aprobada.
  La Etapa 31 continúa abierta; revisar sus criterios de cierre.

## Revisión de cierre de Etapa 31

- Configuración en `config.py`; conexiones e inicialización en `database.py`.
- Wrappers y arranque en `main.py` conservados; ruta SQLite, esquema,
  datos y endpoints preservados según los alcances aprobados.
- Criterios cumplidos con las validaciones de 31C; sin nueva ejecución de pruebas.
- Referencias anteriores a Etapa 31 abierta conservadas como estado histórico.

## Entrega 32A: hash y verificación

- Entrega cerrada y publicada: `hash_session_token`, `hash_password` y `verify_password`
  a `backend/app/security.py`, conservando SHA-256, PBKDF2, sal aleatoria,
  iteraciones, comparación y formatos de retorno actuales.
- Usa la constante existente de `config.py`; mantiene las funciones
  accesibles desde `main.py` para consumidores y pruebas actuales.
- Validación de sesiones, dependencias de roles y endpoints permanecen en `main.py`.
- Tres pruebas nuevas de formatos, verificación correcta/incorrecta, sal aleatoria,
  compatibilidad con hashes existentes y acceso desde `main.py`.
- Validación: 22 pruebas backend aprobadas fuera del sandbox, una advertencia;
  SQLite temporal en `.tmp/pytest-32a-verified`.
- Commit `4c85e9c8e2abefdbc3b9e3adef9d98e8e22f8af9`; CI `37858667828` aprobada.
  La Etapa 32 continúa abierta.

## Entrega 32B: sesiones y autorización por rol

- Entrega cerrada y publicada: `auth.validate_session`
  y `auth.authorize_role` en `backend/app/auth.py`.
- Validación recibe cabecera, fábrica de conexiones y función de fecha.
  Conserva consulta, expiración, revocación, usuario activo y respuestas 401.
- Dependencias `authenticated_user` y `require_roles` en `main.py`
  conservan su interfaz FastAPI; autorización mantiene respuesta 403.
- Login, logout y `/auth/me` permanecen en `main.py`.
- Once casos nuevos cubren estados de sesión y autorización por rol.
- Validación: 33 pruebas backend aprobadas fuera del sandbox, una advertencia.
- Commit `e754f09f4c6b4e9d7dbab21aedaef9323579f418`; CI `37860358716` aprobada.
  La Etapa 32 continúa abierta.

## Entrega 32C: login, logout y consulta de usuario

- Entrega cerrada y publicada en
  `65e2b3cd21999971f1f96405ff282d085d7177e4`; CI `37862024711` aprobada.
- Lógica en `backend/app/auth.py`; rutas, modelos y dependencias en `main.py`.
- Token aleatorio, hash persistido, duración de ocho horas, respuestas y
  revocación conservados. Exportaciones de compatibilidad mantenidas.
- Cuatro casos nuevos cubren contraseña incorrecta, usuario desconocido,
  usuario inactivo y cierre de una sesión sin afectar otra.
- Validación: 37 pruebas backend aprobadas fuera del sandbox, una advertencia;
  temporal `.tmp/pytest-32c-final`. Diff revisado sin errores de whitespace.
- La Etapa 32 continúa abierta.

## Cierre de la Etapa 32

- 32A–32C completan las tres entregas previstas: hashes, validación y
  autorización, y lógica de inicio/cierre de sesión y usuario actual.
- Criterios cumplidos: hashes y formatos conservados, duración de ocho horas,
  persistencia y revocación independientes, permisos y contratos HTTP.
- Evidencia: `security.py`, `auth.py`, wrappers FastAPI en `main.py` y
  pruebas de seguridad, sesiones y roles. Exportaciones compatibles conservadas.
- Revisión del código de `5278fd7`; 37 pruebas backend y CI `37862024711`
  y `37862184127` ya aprobadas. Sin nuevas pruebas ni cambios funcionales.
- Etapa 32 cerrada. Las referencias anteriores a etapa abierta son históricas.
- Próximo paso: definir y aprobar 33A; este cierre no autoriza implementarla.

## Entrega 33A: router de autenticación

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

## Entrega 33B: router de paneles

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

## Entrega 33C: historial, detalle y escaneo

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

## Entrega 33D: tareas y laboratorio

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

## Entrega 33E: actualización de alertas

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

## Entrega 33F: triaje y signos vitales

- Entrega cerrada y publicada en
  `3ad17074b1d8cfeb3021c7293f88609ea6fd4dc7`; CI `37872644967` aprobada.
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

## Entrega 33G: evaluación médica y alta

- Entrega cerrada y publicada en
  `ef92feff8054feab540cf9803776136eb19c0931`; CI `37873651116` aprobada.
- Rutas de evaluación médica y alta, junto a sus modelos, extraídas a
  `backend/app/routes/medical.py`, mediante APIRouter.
- Dependencias de conexión, fecha, detalle, eventos, episodio activo y permisos
  recibidas explícitamente; composición en `main.py`.
- Cuerpos comparados con el original y OpenAPI completo idéntico.
- Siete casos nuevos verifican registro, métodos, acceso exclusivo de médico,
  notas y eventos, cierre, rechazo posterior al cierre y validaciones de petición.
- Se conservan pruebas existentes de flujo clínico, historial y nota de alta.
- Validación: 77 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33g-final` por el bloqueo previo de socketpair.
- Diff revisado sin errores de whitespace. Frontend sin cambios.
- La Etapa 33 continúa abierta.

## Entrega 33H: registro de episodios

- Entrega cerrada y publicada en
  `be42aed69e4229a1962aaf49dda26deaecccedde`; CI `37874720158` aprobada.
- `POST /episodes` y `EpisodeCreate` extraídos a
  `backend/app/routes/episode_registration.py`, mediante APIRouter.
- Conexión, fecha, detalle, eventos y permisos recibidos explícitamente;
  composición en `main.py`. Creación de paciente, episodio activo y QR conservada.
- Cuerpo comparado con el original y OpenAPI completo idéntico.
- Siete casos nuevos verifican registro único, código 201, cinco roles, valores
  iniciales, persistencia y vínculo paciente/episodio, evento, QR distintos y
  prioridades inválidas sin registros. Se conserva el flujo clínico existente.
- Validación: 84 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33h-final` por el bloqueo previo de socketpair.
- Diff revisado sin errores de whitespace. Frontend sin cambios.
- La Etapa 33 continúa abierta.

## Entrega 33I: evaluación de reglas temporales

- Entrega cerrada y publicada en
  `e31529084eee07f7a819772621be0d65a18f659a`; CI `37876308581` aprobada.
- `POST /rules/evaluate` extraído a `backend/app/routes/rules.py`, mediante
  APIRouter; motor compartido `evaluate_time_rules` conservado en `main.py`.
- Conexión, fecha, motor y permisos recibidos explícitamente.
- Cuerpo comparado con el original y OpenAPI completo idéntico.
- Seis casos nuevos verifican registro único, método POST, cinco roles,
  evaluación vacía, identidad solicitante y fecha UTC.
- Se conservan pruebas existentes de generación temporal y ausencia de duplicados.
- Validación: 90 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33i-final` por el bloqueo previo de socketpair.
- Diff revisado sin errores de whitespace. Frontend y datos locales conservados.
- La Etapa 33 continúa abierta.

## Entrega 33J: carga de datos demo

- Entrega cerrada y publicada en
  `f1ce279a9192de290ca48095532475d7ad624268`; CI `38012709436` aprobada.
- `POST /demo/seed` extraído a `backend/app/routes/demo.py`, mediante APIRouter.
- Conexión, fecha, eventos y permisos recibidos explícitamente; composición
  conservada en `main.py`. Acceso exclusivo de supervisor conservado.
- Cuerpo comparado con el original y OpenAPI completo idéntico.
- Seis casos nuevos verifican registro, método, cinco roles y conservación de
  pacientes, episodios, tareas, alertas y eventos ante una segunda carga.
- Se conserva la prueba de doce pacientes demo y protección de pacientes manuales.
- Validación: 96 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33j-final` por el bloqueo previo de socketpair.
- Diff revisado sin errores de whitespace. Frontend y base local conservados.
- La Etapa 33 continúa abierta; resta revisar composición y criterios de cierre.

## Entrega 33K: composición final y revisión de cierre

- Entrega cerrada y publicada en
  `c7ddff2736eb25257f855a14cf81749dccc09b9d`; CI `38013558171` aprobada.
- Composición de los diez routers reunida en `backend/app/main.py`;
  retirados comentarios desubicados y espacios entre bloques.
- AST completo y OpenAPI idénticos: código ejecutable, orden de registro,
  dependencias, métodos, respuestas y permisos conservados.
- Validación: 96 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33k-final` por el bloqueo conocido de socketpair.
- Sin comportamiento nuevo; no se requieren pruebas adicionales.
- Frontend y base local conservados. Diff revisado sin errores de whitespace.
- Revisión de cierre: rutas por área separadas, sin importaciones de main
  desde los routers. Servicios compartidos conservados en main, fuera del alcance.
- Etapa 33 cerrada tras 33A–33K: rutas separadas por área y composición
  revisada, con contratos y comportamiento conservados. Las referencias
  anteriores a etapa abierta describen el estado histórico de cada entrega.

## Entrega 34A: actualización de setup-python

- Cerrada y publicada: PR #1 de Dependabot integrada en
  `92c68d7684e95ac7af583bcb6425bcc7dab5da99`.
- `actions/setup-python` actualizado de v6 a v7 en el workflow de CI.
  Python 3.12, caché pip, dependencias y comandos de validación conservados.
- Diff de una línea revisado; parámetros utilizados disponibles en v7.
- PR actualizada con main antes de integrar: CI `38013945187` aprobada.
- CI posterior en main `38014058972` aprobada: backend, frontend, lint y build.
- Sin cambios en aplicación, esquema ni base local; no se repiten pruebas locales
  para este cambio exclusivo de GitHub Actions.
- Etapa 34 abierta: PR #2 de checkout pendiente de evaluación y autorización propias.

## Entrega 34B: actualización de checkout y cierre

- Cerrada y publicada: PR #2 de Dependabot integrada en
  `39b735496bc7e7a1742b6344172d426993757ad4`.
- `actions/checkout` actualizado de v5 a v7; resto del workflow conservado.
- Diff de una línea revisado y documentación oficial contrastada: la protección
  nueva para pull_request_target y workflow_run no afecta a los eventos usados.
- PR actualizada con main: CI `38014890914` aprobada.
- CI posterior en main `38014992716` aprobada: backend, frontend, lint y build.
- Sin cambios en aplicación, esquema ni base local; no se repiten pruebas locales
  para este cambio exclusivo de GitHub Actions.
- Etapa 34 cerrada tras evaluar y publicar las PRs #1 y #2 por separado.
  No quedan PRs abiertas al comprobar el cierre. Las referencias anteriores
  a etapa abierta corresponden al estado histórico de cada entrega.

## Entrega 35A: matriz de permisos y tareas

- Entrega cerrada y publicada en
  `919e5f85001cc612b035a1fc9d04d805e5cf88f2`; CI `38016047782` aprobada.
- Matriz de acciones por rol y estado documentada en `docs/PERMISSIONS_MATRIX.md`.
- Cinco casos nuevos recorren los cinco roles y los tres servicios de tareas:
  creación, finalización, sesión ausente, repetición y rechazo tras alta.
- Rechazos comparan pacientes, episodios, tareas, eventos, alertas, historial
  de alertas y signos para comprobar ausencia de mutaciones.
- Política existente conservada: LAB puede completar NURSING y MEDICAL.
  No se propone cambiarla sin un alcance y autorización independientes.
- Validación: 101 pruebas backend aprobadas, una advertencia; cinco casos
  nuevos aprobados tras ajustar el cierre de conexiones del comparador.
  Temporales `.tmp/pytest-35a-final` y `.tmp/pytest-35a-targeted`;
  fuera del sandbox por el bloqueo conocido de socketpair.
- No se encontraron discrepancias en el alcance probado. No cambia código
  de aplicación, frontend ni base local. Diff revisado sin errores de whitespace.
- Etapa 35 abierta: resta revisar cobertura de rechazos y criterios de cierre.

## Entrega 35B: rechazos en episodios cerrados

- Entrega cerrada y publicada en
  `e08f2a74bdbf7c47c02a04166354dd26126910b9`; CI `38016930642` aprobada.
- Cinco casos nuevos recorren todos los roles en episodios cerrados para triaje,
  signos, evaluación médica, alta repetida, acciones de alerta y escaneo.
- Tras cada rechazo se comparan siete tablas clínicas; se comprueban 401, 403,
  409 y 404 según sesión, rol y acción, y lectura de detalle CLOSED sin mutación.
- Matriz de permisos actualizada con la evidencia de 35B.
- Validación: 106 pruebas backend aprobadas, una advertencia; temporal
  `.tmp/pytest-35b-final`, fuera del sandbox por el bloqueo conocido de socketpair.
- Sin discrepancias en el alcance probado; política y código de aplicación
  conservados. Frontend y base local sin cambios. Diff sin errores de whitespace.
- Etapa 35 abierta: pendiente de revisión final de cierre.

## Revisión de cierre de Etapa 35

- Criterios revisados: matriz de acciones por rol y estado documentada,
  rechazos relevantes cubiertos y ausencia de discrepancias en el alcance probado.
- 35A cubre tareas por rol y servicio; 35B refuerza conservación de siete tablas
  clínicas tras rechazos en CLOSED. Las consultas permitidas conservan lectura.
- Evidencia vigente: 106 pruebas backend aprobadas, una advertencia;
  CI de 35B `38016930642` y documental `38017077021` aprobadas.
- No se repiten validaciones ni se modifica aplicación, frontend o base local.
- Política actual conservada; nuevas restricciones requerirían otro alcance.
- Etapa 35 cerrada tras 35A–35B y revisión final. Las referencias anteriores
  a etapa abierta corresponden al estado histórico de cada entrega.

## Etapa 36A: diseño de recuperación de nota de alta

- Diseño acordado y documentado en `docs/DRAFT_RECOVERY_DESIGN.md`.
- Alcance: recuperar solo nota de alta tras HTTP 401, en memoria durante
  un máximo de 30 minutos, sin persistencia del texto clínico.
- Restauración explícita para la misma identidad, rol DOCTOR y mismo episodio
  ACTIVE consultado nuevamente; sin reenvío automático del alta.
- Eliminación y casos de prueba definidos. Navegación, recarga y otros
  formularios fuera del primer alcance.
- Etapa 36 cerrada como evaluación de diseño. La recuperación continúa
  sin implementar y requiere autorización independiente. Se conserva la
  limitación actual de pérdida de borrador.
- Solo documentación; sin nuevas validaciones de aplicación ni cambios
  en frontend, backend o base local. Diff revisado sin errores de whitespace.

## Cierre de la Etapa 52

- Alcance acordado entregado en 52A: errores accesibles junto a la alerta
  cuya acción falló, con limpieza al reintentar una acción sobre esa alerta.
- Criterios contrastados con ocho casos nuevos y pruebas ampliadas: Reconocer,
  Escalar y Resolver ante errores de API/red, reintento, fallos simultáneos
  independientes y conservación del error de otra alerta tras resolver una.
- Se conservan estados ante fallos, permisos, transiciones y bloqueo de 49A.
  HTTP 401 durante un reintento no revive el error anterior ni genera uno ordinario.
- Evidencia: 198 pruebas frontend, lint y build aprobados; CI de implementación
  `38181398952` y documental `38181529431` aprobadas.
- Etapa 52 cerrada dentro del alcance. Cierre documental; aplicación, reglas
  clínicas, contratos de API y base local sin cambios adicionales.
  Validaciones aprobadas conservadas.

## Entrega 52A: errores junto a la alerta

- Entrega publicada en `e21c40752dbf7d6b6e4ae16c7ec07bc17368ce69`;
  CI `38181398952` aprobada.
- Los errores de Reconocer, Escalar y Resolver aparecen junto a la alerta
  correspondiente mediante un mensaje accesible de alerta.
- Reintentar una acción sobre esa alerta limpia únicamente su error.
  Los errores y bloqueos de las demás permanecen independientes.
- Conserva estados ante fallos, permisos, transiciones y bloqueo de 49A.
  HTTP 401 mantiene el manejo de sesión sin error ordinario.
- Ocho casos nuevos y pruebas ampliadas cubren las tres acciones ante errores
  de API/red, reintento, fallos simultáneos, independencia y HTTP 401.
- Validación: 198 pruebas frontend, lint y build aprobados.
- Backend, reglas clínicas, contratos de API y base local sin cambios.

## Cierre de la Etapa 51

- Alcance acordado entregado en 51A: errores accesibles junto a la tarea
  que falló al completarse, con limpieza únicamente al reintentar esa tarea.
- Criterios contrastados con cuatro casos nuevos y pruebas ampliadas: errores
  de API/red, fallos simultáneos independientes, reintento y conservación del
  error de otra tarea tras completar una con éxito.
- Se conserva la tarea pendiente ante fallos y el bloqueo de 50A.
  HTTP 401 durante un reintento no revive el error anterior ni genera uno ordinario.
- Evidencia: 190 pruebas frontend, lint y build aprobados; CI de implementación
  `38180567100` y documental `38180677073` aprobadas.
- Etapa 51 cerrada dentro del alcance. Cierre documental; aplicación, permisos,
  reglas clínicas, contratos de API y base local sin cambios adicionales.
  Validaciones aprobadas conservadas.

## Entrega 51A: errores junto a la tarea

- Entrega publicada en `a94a93ac3ffdb8a130eb03140609faf254474075`;
  CI `38180567100` aprobada.
- Los errores al completar tareas aparecen junto a la tarea correspondiente
  mediante un mensaje accesible de alerta, en lugar del error global.
- Reintentar limpia únicamente su error. Los errores y bloqueos de las demás
  tareas permanecen independientes, incluso ante fallos simultáneos.
- Conserva la tarea pendiente ante fallos y el bloqueo de 50A.
  HTTP 401 mantiene el manejo de sesión sin error ordinario.
- Cuatro casos nuevos y pruebas ampliadas cubren errores de API/red,
  reintento, independencia, éxito de otra tarea y HTTP 401 tras un fallo previo.
- Validación: 190 pruebas frontend, lint y build aprobados.
- Backend, permisos, reglas clínicas, contratos de API y base local sin cambios.

## Cierre de la Etapa 50

- Alcance acordado entregado en 50A: bloqueo del botón Completar por
  identificador de tarea mientras espera respuesta, con «Completando…».
- Criterios contrastados con nueve casos nuevos: una solicitud por tarea,
  desbloqueo tras éxito, error de API/red o HTTP 401, reintento explícito,
  solicitudes independientes y retirada de la tarea completada de pendientes.
- Se conserva el manejo actual de permisos, errores y estados;
  los episodios CLOSED mantienen las tareas de solo lectura.
- Evidencia: 186 pruebas frontend, lint y build aprobados; CI de implementación
  `38179803505` y documental `38179908014` aprobadas.
- Etapa 50 cerrada dentro del alcance. El bloqueo cubre solicitudes en curso
  en esta vista; no incorpora coordinación entre usuarios o navegadores.
- Cierre documental; aplicación, reglas clínicas, contratos de API y base local
  sin cambios adicionales. Validaciones aprobadas conservadas.

## Entrega 50A: bloqueo al completar tareas

- Entrega publicada en `37fcba446544aee5b842d5439fc2b7fa03baa089`;
  CI `38179803505` aprobada.
- Completar bloquea el botón por identificador de tarea mientras espera
  respuesta y muestra «Completando…»; las demás tareas permanecen disponibles.
- Impide envíos repetidos de la misma tarea y libera el bloqueo tras éxito,
  error de API/red o interrupción de sesión HTTP 401.
- Conserva manejo de permisos y errores, estados y reintento explícito.
  Los episodios CLOSED mantienen las tareas de solo lectura.
- Nueve casos nuevos cubren roles admitidos por API, payload, errores,
  sesión, solicitudes independientes y retirada de la tarea completada.
- Validación: 186 pruebas frontend, lint y build aprobados.
- Backend, reglas clínicas, contratos de API y base local sin cambios.

## Cierre de la Etapa 49

- Alcance acordado entregado en 49A: bloqueo de Reconocer, Escalar y Resolver
  por identificador de alerta mientras espera respuesta.
- Criterios contrastados con ocho casos nuevos: una solicitud por alerta,
  «Actualizando alerta…», desbloqueo tras éxito, error de API/red o HTTP 401,
  reintento explícito y solicitudes independientes sobre distintas alertas.
- Se conservan permisos y transiciones; la respuesta exitosa actualiza el
  episodio y permite presentar las acciones del nuevo estado.
- Evidencia: 177 pruebas frontend, lint y build aprobados; CI de implementación
  `38178969360` y documental `38179130975` aprobadas.
- Etapa 49 cerrada dentro del alcance. El bloqueo cubre solicitudes en curso
  en esta vista; no incorpora coordinación entre usuarios o navegadores.
- Cierre documental; aplicación, reglas clínicas, contratos de API y base local
  sin cambios adicionales. Validaciones aprobadas conservadas.

## Entrega 49A: bloqueo de acciones por alerta

- Entrega publicada en `2e2a21fdc9c56879db19bcbd6fe174b9aaa7a631`;
  CI `38178969360` aprobada.
- Reconocer, Escalar y Resolver comparten un bloqueo por identificador de alerta
  mientras esperan respuesta; muestra «Actualizando alerta…».
- Impide envíos repetidos o acciones simultáneas sobre esa alerta y mantiene
  disponibles las demás. Libera el bloqueo tras éxito, error de API/red o HTTP 401.
- Conserva permisos, transiciones, estado ante fallos y reintento explícito.
- Ocho casos nuevos cubren las tres acciones, payload, errores, sesión,
  solicitudes independientes y presentación de la transición exitosa.
- Validación: 177 pruebas frontend, lint y build aprobados.
- Backend, reglas clínicas, contratos de API y base local sin cambios.

## Cierre de la Etapa 48

- Alcance acordado entregado en 48A: confirmación accesible de triaje y
  asignación guardados solo tras éxito, y errores de API/red junto al formulario.
- Criterios contrastados con siete casos nuevos y pruebas ampliadas: espera
  sin confirmación, limpieza al editar o reenviar, ausencia de éxito ante fallos
  y mensajes independientes del registro de signos vitales.
- Se conservan valores, bloqueo de solicitudes y permisos de 47A.
  HTTP 401 mantiene el manejo de sesión sin éxito ni error ordinario.
- Evidencia: 169 pruebas frontend, lint y build aprobados; CI de implementación
  `38178157097` y documental `38178269547` aprobadas.
- Etapa 48 cerrada dentro del alcance. Cierre documental; aplicación, reglas
  clínicas, contratos de API y base local sin cambios adicionales.
  Validaciones aprobadas conservadas.

## Entrega 48A: mensajes de resultado en triaje y asignación

- Entrega publicada en `d5f3b06161138f71e8f5b9ed64d5232b6e30fcf3`;
  CI `38178157097` aprobada.
- Triaje muestra «Triaje y asignación guardados» mediante un estado accesible
  solo tras éxito; los errores de API/red aparecen junto al formulario.
- Editar o reenviar retira sus mensajes, independientes de signos vitales.
  HTTP 401 conserva el manejo de sesión sin éxito ni error ordinario.
- Conserva valores, bloqueo de solicitudes y permisos de 47A.
- Siete casos nuevos y pruebas ampliadas cubren espera, éxito, edición,
  reintento, errores de API/red, HTTP 401 e independencia.
- Validación: 169 pruebas frontend, lint y build aprobados.
- Backend, reglas clínicas, contratos de API y base local sin cambios.

## Cierre de la Etapa 47

- Alcance acordado entregado en 47A: bloqueo de prioridad, ubicación,
  responsable y envíos repetidos de triaje mientras espera respuesta.
- Criterios contrastados con diez casos nuevos: captura de los tres valores
  antes del bloqueo, «Guardando triaje…», desbloqueo tras éxito, error de
  API/red o HTTP 401, conservación de valores y reintento explícito.
- Se mantienen roles NURSE/SUPERVISOR, restricción de episodios CLOSED
  y bloqueo independiente del formulario de signos vitales.
- Evidencia: 162 pruebas frontend, lint y build aprobados; CI de implementación
  `38177407788` y documental `38177523136` aprobadas.
- Etapa 47 cerrada dentro del alcance. Un nuevo envío intencional tras
  terminar el anterior sigue permitido; el bloqueo cubre solicitudes en curso.
- Cierre documental; aplicación, reglas clínicas, contratos de API y base local
  sin cambios adicionales. Validaciones aprobadas conservadas.

## Entrega 47A: bloqueo de envío de triaje y asignación

- Entrega publicada en `da05f9878154018c76997594325d28e80623fff6`;
  CI `38177407788` aprobada.
- Triaje y asignación bloquea prioridad, ubicación, responsable y envíos
  repetidos mientras espera respuesta; muestra «Guardando triaje…».
- Captura los tres valores antes del bloqueo y habilita los campos tras éxito,
  error de API/red o interrupción de sesión HTTP 401.
- Conserva valores y permite un nuevo envío explícito. Mantiene roles
  NURSE/SUPERVISOR y la restricción de episodios CLOSED.
- Diez casos nuevos cubren duplicados, payload, desbloqueo, reintento,
  permisos y bloqueo independiente del formulario de signos vitales.
- Validación: 162 pruebas frontend, lint y build aprobados.
- Backend, reglas clínicas, contratos de API y base local sin cambios.

## Cierre de la Etapa 46

- Alcance acordado entregado en 46A: confirmación accesible de signos vitales
  guardados solo tras éxito y errores de API/red junto al formulario.
- Criterios contrastados con siete casos nuevos y pruebas ampliadas: espera
  sin confirmación, limpieza al editar o reenviar, ausencia de éxito ante fallos
  y mensajes independientes de los formularios médicos.
- Se conservan valores, bloqueo de solicitudes y permisos de 45A.
  HTTP 401 mantiene el manejo de sesión sin éxito ni error ordinario.
- Evidencia: 152 pruebas frontend, lint y build aprobados; CI de implementación
  `38175744173` y documental `38175895543` aprobadas.
- Los dos fallos iniciales del supervisor no se reprodujeron en la revisión
  dirigida ni en la repetición completa; antecedente conservado en 46A.
- Etapa 46 cerrada dentro del alcance. Cierre documental; aplicación, reglas
  clínicas, contratos de API y base local sin cambios adicionales.
  Validaciones aprobadas conservadas.

## Entrega 46A: mensajes de resultado en signos vitales

- Entrega publicada en `8772a8aadbf44106e3866b8596e62898f0543be4`;
  CI `38175744173` aprobada.
- Signos vitales muestra «Signos vitales guardados» mediante un estado accesible
  solo tras una respuesta exitosa; los errores de API/red aparecen en el formulario.
- Editar o reenviar retira los mensajes de signos, independientes de los
  formularios médicos. HTTP 401 no muestra éxito ni un error ordinario.
- Conserva valores, bloqueo de solicitudes en curso y permisos de 45A.
- Siete casos nuevos y pruebas ampliadas cubren espera, éxito, edición,
  reintento, errores de API/red, HTTP 401 e independencia.
- Validación: 152 pruebas frontend, lint y build aprobados.
- La primera ejecución tuvo dos fallos en pruebas del supervisor durante la
  carga/sesión; la revisión dirigida (21 pruebas) y la repetición completa
  aprobaron sin cambios adicionales de código.
- Backend, reglas clínicas, contratos de API y base local sin cambios.

## Cierre de la Etapa 45

- Alcance acordado entregado en 45A: bloqueo de campos y envíos repetidos
  de signos vitales mientras espera respuesta, con «Guardando signos…».
- Criterios contrastados con ocho casos nuevos: captura de los seis valores
  antes del bloqueo, desbloqueo tras éxito, error de API/red o HTTP 401,
  conservación de valores y nuevo envío explícito.
- Se mantienen los roles DOCTOR/NURSE, la restricción de episodios CLOSED
  y el bloqueo independiente de los formularios médicos.
- Evidencia: 145 pruebas frontend, lint y build aprobados; CI de implementación
  `38164479323` y documental `38164600153` aprobadas.
- Etapa 45 cerrada dentro del alcance. Un nuevo registro intencional tras
  terminar el anterior sigue permitido; el bloqueo cubre solicitudes en curso.
- Cierre documental; aplicación, reglas clínicas y base local sin cambios
  adicionales. Validaciones aprobadas conservadas.

## Entrega 45A: bloqueo de envío de signos vitales

- Entrega publicada en `b1df24ea00204164c9cb0b6adbcaaa418216a425`;
  CI `38164479323` aprobada.
- El registro de signos vitales bloquea campos, botón y envíos repetidos
  mientras espera respuesta; muestra «Guardando signos…».
- Captura los seis valores antes de deshabilitar los campos y libera el bloqueo
  tras éxito, error de API/red o interrupción de sesión HTTP 401.
- Conserva los valores y permite un nuevo envío explícito. Mantiene los roles
  DOCTOR/NURSE y la restricción de episodios CLOSED.
- Ocho casos nuevos cubren duplicados, payload, desbloqueo, reintento,
  permisos y bloqueo independiente de los formularios médicos.
- Validación: 145 pruebas frontend, lint y build aprobados.
- Backend, reglas clínicas, contratos de API y base local sin cambios.

## Cierre de la Etapa 44

- Alcance acordado entregado en 44A: errores accesibles junto al formulario
  de evaluación u orden que falló.
- Criterios contrastados con cinco casos nuevos y pruebas ampliadas: editar o
  reintentar retira el error correspondiente; ambos formularios conservan
  mensajes independientes y datos ante errores de API o red.
- Se conservan confirmaciones de éxito, bloqueos de envío y avisos de salida.
  HTTP 401 mantiene el manejo de interrupción de sesión.
- Evidencia: 137 pruebas frontend, lint y build aprobados; CI de implementación
  `38160358496` y documental `38160482207` aprobadas.
- Etapa 44 cerrada dentro del alcance. Sin cambios en permisos, persistencia,
  recuperación de borradores ni contratos de la API.
- Cierre documental; aplicación y base local sin cambios adicionales.
  Validaciones aprobadas conservadas.

## Entrega 44A: errores junto al formulario

- Entrega publicada en `4e0ecc322e891da9a7b8eb94c3ff67dd0a9f19ac`;
  CI `38160358496` aprobada.
- Los errores de API o red aparecen junto al formulario de evaluación u orden
  que falló, mediante un mensaje accesible de alerta.
- Editar o reintentar limpia el error correspondiente. Los errores y las
  confirmaciones de ambos formularios permanecen independientes.
- Se conservan datos ante fallos, bloqueos de envío y avisos de salida.
  HTTP 401 mantiene el manejo de interrupción de sesión sin error ordinario.
- Cinco casos nuevos y pruebas ampliadas: 137 pruebas frontend, lint y build aprobados.
- Backend, contratos de API y base local sin cambios.

## Cierre de la Etapa 43

- Alcance acordado entregado en 43A: confirmaciones accesibles de evaluación
  guardada y orden creada, únicamente tras una respuesta exitosa.
- Criterios contrastados con siete casos nuevos y pruebas ampliadas: nueva
  edición o envío retira el mensaje correspondiente; errores de API/red y
  HTTP 401 no muestran éxito. Las confirmaciones son independientes.
- Se conservan bloqueos de envío, datos ante errores y avisos de salida de 39A–42A.
- Evidencia: 132 pruebas frontend, lint y build aprobados; CI de implementación
  `38158257237` y documental `38158414456` aprobadas.
- Etapa 43 cerrada dentro del alcance. Las confirmaciones no cambian permisos,
  persistencia, recuperación de borradores ni contratos de la API.
- Cierre documental; aplicación y base local sin cambios adicionales.
  Validaciones aprobadas conservadas.

## Entrega 43A: confirmaciones de guardado médico

- Entrega publicada en `e908b785a63ca798c545981d9124fee713cccd50`;
  CI `38158257237` aprobada.
- Evaluación médica muestra «Evaluación guardada» y orden muestra «Orden creada»
  solo después de una respuesta exitosa, mediante un mensaje accesible de estado.
- Nueva edición o envío retira la confirmación del formulario correspondiente.
  Los mensajes son independientes y no confirman resultados pendientes o fallidos.
- Se conservan bloqueos de envío, datos tras errores y avisos de salida de 39A–42A.
  HTTP 401 no produce confirmación de éxito.
- Siete casos nuevos y ampliaciones de pruebas existentes cubren éxito, nueva
  edición/envío, errores de API/red, independencia y ausencia de éxito ante HTTP 401.
- Validación: 132 pruebas frontend, lint y build aprobados. Backend, API y base local sin cambios.

## Cierre de la Etapa 42

- Alcance acordado entregado en 42A: aviso ante cambios sin enviar en el
  procedimiento y servicio de una orden, al navegar, cerrar sesión o recargar.
- Criterios contrastados con catorce casos nuevos: cancelar conserva campos y
  sesión, descartar permite salir sin crear la orden, éxito retira su indicador
  y errores conservan la protección. Restaurar valores iniciales elimina el aviso.
- Los indicadores de orden, evaluación y nota de alta son independientes;
  guardar un formulario no retira la protección de otro pendiente.
- Evidencia: 125 pruebas frontend, lint y build aprobados; CI de implementación
  `38154061106` y documental `38154208473` aprobadas.
- Etapa 42 cerrada dentro del alcance. HTTP 401 conserva 37A sin recuperar ni
  reenviar órdenes; persistencia y recuperación adicional requieren otro alcance.
- Cierre documental; aplicación y base local sin cambios adicionales.
  Validaciones aprobadas conservadas.

## Entrega 42A: aviso de orden clínica sin enviar

- Entrega publicada en `54e7da4cd5681398994c1ab19d1dc730ccb9119b`;
  CI `38154061106` aprobada.
- Procedimiento solicitado y servicio responsable se comparan con sus valores
  iniciales. Cambios requieren confirmar navegación o logout mediante
  «Seguir editando» o «Descartar y salir»; cancelar conserva campos y sesión.
- Recarga y cierre de pestaña solicitan el aviso estándar del navegador.
  Restaurar valores iniciales o crear con éxito retira solo el indicador de orden.
- Errores conservan campos y protección. Los indicadores de evaluación y nota
  de alta siguen siendo independientes y no se borran al crear una orden.
- Solo indicadores en el guard; sin persistencia de texto ni cambios en API,
  backend o base local. HTTP 401 no recupera ni reenvía la orden y conserva 37A.
- Catorce casos nuevos cubren cambios, cancelación, descarte, éxito, errores,
  aviso de recarga, independencia de las tres protecciones y HTTP 401.
- Validación: 125 pruebas frontend, lint y build aprobados.
- Primera corrida local con dos workers: 124 aprobadas y timeout de 5 segundos
  en el primer caso existente de recuperación. Suite completa aprobada al repetir
  con `npm.cmd run test --prefix frontend -- --maxWorkers=1`, sin cambiar pruebas.
  CI mantiene su comando habitual.

## Cierre de la Etapa 41

- Alcance acordado entregado en 41A: aviso por cambios sin guardar en diagnóstico,
  nota de evaluación y decisión médica, al navegar, cerrar sesión o recargar.
- Criterios contrastados con doce casos nuevos: cancelar conserva los campos,
  descartar permite salir, éxito retira el aviso y errores conservan la protección.
  Volver a los valores iniciales elimina el indicador de evaluación.
- La protección de la nota de alta es independiente; guardar la evaluación no
  elimina su aviso. HTTP 401 mantiene 37A sin recuperar ni reenviar la evaluación.
- Evidencia: 111 pruebas frontend, lint y build aprobados; CI de implementación
  `38152974236` y documental `38153115671` aprobadas.
- Etapa 41 cerrada dentro del alcance. Recuperación de evaluación tras HTTP 401,
  persistencia y protección de órdenes sin enviar requieren un alcance propio.
- Cierre documental; aplicación y base local sin cambios adicionales.
  No se repiten las validaciones aprobadas.

## Entrega 41A: aviso de evaluación médica sin guardar

- Entrega publicada en `3c9220146b989e8ff4648b61cd7d300353eb01c9`;
  CI `38152974236` aprobada.
- Diagnóstico, nota de evaluación y decisión médica se comparan con los valores
  iniciales. Sus cambios requieren confirmar navegación o logout con
  «Seguir editando» o «Descartar y salir», sin ejecutar la salida al cancelar.
- Recarga y cierre de pestaña solicitan el aviso estándar del navegador.
  Volver a los valores iniciales o guardar con éxito retira el aviso de evaluación.
- Un error mantiene campos y protección. La nota de alta conserva un indicador
  independiente: guardar evaluación no elimina su aviso si sigue pendiente.
- Solo indicadores en el guard; texto en el formulario, sin persistencia clínica.
  HTTP 401 conserva 37A y no recupera la evaluación ni repite su envío.
- Doce casos nuevos cubren los tres campos, cancelación, descarte, éxito,
  errores de API/red, aviso de recarga, coexistencia con nota de alta y HTTP 401.
- Validación: 111 pruebas frontend, lint y build aprobados. Backend y base local sin cambios.

## Cierre de la Etapa 40

- Alcance 40A revisado: bloqueo independiente de evaluación y orden durante
  el envío, campos deshabilitados, indicador visible y rechazo de submits repetidos.
- Éxito, errores y HTTP 401 liberan los bloqueos según las pruebas; los errores
  conservan los campos y admiten reintento explícito conforme a 39A.
- Evidencia: 99 pruebas frontend, lint y build aprobados; CI de implementación
  `38151760565` y documental `38151913835` aprobadas.
- Prueba manual: el usuario creó dos evaluaciones, enviando la segunda tras
  finalizar la primera. Es un comportamiento válido; no es un envío concurrente.
  El bloqueo durante una petición pendiente se verifica mediante pruebas automatizadas.
- Etapa 40 cerrada dentro de su alcance. Envíos sucesivos intencionales siguen
  permitidos; la idempotencia entre pestañas o en backend requiere otro alcance.
- Cierre documental; sin cambios adicionales en la aplicación ni en los datos
  de demostración. Validaciones aprobadas conservadas.

## Entrega 40A: bloqueo de envíos médicos en curso

- Entrega publicada en `13c160c35dc5c4992ae0803fa4cc25acf405bf71`;
  CI `38151760565` aprobada.
- Evaluación médica y orden clínica tienen bloqueos independientes durante
  su petición: campos y botón deshabilitados, con «Guardando…» o «Creando orden…».
- Guards inmediatos impiden clics y submits repetidos en cada formulario.
  Se capturan los datos antes de deshabilitar sus campos.
- Al terminar se libera el bloqueo. Errores conservan los datos y permiten
  reintento explícito; éxito conserva el reinicio de formulario de 39A.
- Cinco casos nuevos verifican repeticiones, desbloqueo tras éxito o HTTP 401
  e independencia entre formularios; las pruebas 39A comprueban reintentos tras error.
- Protección limitada a esta instancia de la pantalla; no aporta idempotencia
  entre pestañas ni cambios en backend, API, esquema o base local.
- Validación: 99 pruebas frontend, lint y build aprobados.

## Cierre de la Etapa 39

- Alcance acordado entregado en 39A: conservar evaluación médica y orden
  clínica cuando falla su envío y vaciarlas solo tras una respuesta exitosa.
- Criterios contrastados con seis casos nuevos: error de API, fallo de red,
  campos conservados durante la espera y reintento explícito con los mismos datos.
- Evidencia: 94 pruebas frontend, lint y build aprobados; CI de implementación
  `38105192156` y documental `38105293438` aprobadas.
- Etapa 39 cerrada dentro del alcance acordado. Persistencia, recuperación de
  otros borradores y protección contra envíos duplicados no forman parte de 39A.
- Cierre documental; aplicación y base local sin cambios adicionales.
  Se conservan las validaciones aprobadas.

## Entrega 39A: conservar formularios ante envíos fallidos

- Entrega publicada en `e5840ad8404257d6e475c168155a7d73a3a57937`;
  CI `38105192156` aprobada.
- El helper de envío devuelve fallo tras errores de API o de red, en lugar de
  permitir que evaluación médica y orden clínica se reinicien sin guardarse.
- Ambos formularios conservan sus campos y muestran el error. Solo se vacían
  tras una respuesta exitosa; el reintento requiere una acción explícita.
- Seis casos nuevos cubren errores de API, fallos de red, reintento con los
  mismos datos y conservación durante una respuesta pendiente para ambos formularios.
- Interrupción por HTTP 401 conserva su tratamiento de 37A. No se añade
  persistencia, recuperación de otros borradores ni cambios en API o backend.
- Validación: 94 pruebas frontend, lint y build aprobados. Base local sin cambios.

## Cierre de la Etapa 38

- Alcance acordado entregado en 38A: aviso ante navegación o logout con nota
  de alta no vacía y solicitud de aviso estándar ante recarga o cierre de pestaña.
- Criterios revisados: cancelar conserva nota y sesión, descartar permite salir,
  alta exitosa elimina el aviso y restauración tras 401 reactiva la protección.
- Evidencia: diez casos nuevos, 88 pruebas frontend, lint y build aprobados;
  prueba manual satisfactoria confirmada por el usuario.
- CI de implementación `38099843479` y documental `38100001704` aprobadas.
- Etapa 38 cerrada dentro del alcance acordado. El aviso del navegador no
  garantiza recuperación tras salir; otros formularios siguen fuera de alcance.
- Cierre documental; sin cambios en aplicación ni base local y sin repetir
  validaciones aprobadas.

## Entrega 38A: aviso de nota de alta sin enviar

- Entrega publicada en `8fdedd90f55469af841c7601874930004822f075`;
  CI `38099843479` aprobada.
- Una nota no vacía en el formulario de alta requiere confirmar las salidas
  por navegación o logout: «Seguir editando» conserva texto y sesión;
  «Descartar y salir» ejecuta la salida elegida sin enviar el alta.
- Recarga y cierre de pestaña solicitan el aviso estándar mediante beforeunload.
  Su presentación depende del navegador; no garantiza recuperación tras salir.
- El guard de salida solo conserva un indicador y la acción pendiente en memoria.
  No persiste texto clínico ni modifica API, backend, esquema o base local.
- Alta exitosa y descarte retiran el aviso. Un HTTP 401 cancela la salida
  pendiente y mantiene la recuperación 37A; restaurar reactiva la protección.
  El borrador suspendido durante reautenticación conserva el alcance de 37A.
- Diez casos nuevos cubren cancelación, descarte, logout, aviso de recarga,
  limpieza del listener, alta exitosa y nota restaurada.
- Validación: 88 pruebas frontend, lint y build aprobados.
- Prueba manual realizada por el usuario y confirmada satisfactoria antes
  de publicar: conservación al cancelar, descarte y aviso de recarga.

## Cierre de la Etapa 37

- Mejora elegida: recuperación de nota de alta tras HTTP 401, entregada en 37A.
- Criterios del diseño 36A contrastados con la implementación y sus 32 casos
  nuevos: identidad, rol, episodio ACTIVE, plazo, eliminación, restauración
  explícita y ausencia de reenvío automático o persistencia del texto.
- Evidencia conservada: 78 pruebas frontend, lint y build aprobados; CI de
  implementación `38055045590` y documental `38055175333` aprobadas.
- Etapa 37 cerrada dentro del alcance acordado. Recuperación tras navegación,
  recarga o reinicio y otros formularios requieren una mejora independiente.
- Revisión documental; no se repiten validaciones aprobadas ni se modifica la
  aplicación, el backend o la base local.

## Entrega 37A: recuperación de nota de alta

- Entrega cerrada y publicada en
  `323094dc53d0d5f398b025ae5bbefbf0d291787c`; CI `38055045590` aprobada.
- Mejora elegida y autorizada para la Etapa 37: recuperación de nota de alta
  tras HTTP 401 según el diseño de 36A.
- Login sin recarga; borrador solo en memoria durante 30 minutos desde el
  primer 401, con eliminación automática y sin renovar el plazo.
- Misma identidad y rol DOCTOR; episodio ACTIVE consultado antes de ofertar
  y al confirmar. Restauración explícita o descarte, sin reenviar el alta.
- Consulta fallida admite reintento dentro del plazo. Logout, otra identidad,
  rol distinto, CLOSED, inexistencia, vencimiento y navegación eliminan la nota.
- Respuestas de sesiones anteriores rechazadas; 401 concurrentes agrupados.
  No se exponen texto ni datos del episodio durante el login.
- Estado local separado en `frontend/src/session/`; cliente HTTP centralizado.
  Formularios médicos detienen su continuación al interrumpirse la sesión.
- 32 casos nuevos cubren recuperación, controles de identidad y vigencia,
  eliminación, respuestas tardías y ausencia de persistencia del texto.
- Validación: 78 pruebas frontend, lint y build aprobados. Pruebas locales con
  `npm.cmd run test --prefix frontend -- --maxWorkers=2`, fuera del sandbox
  por timeout de inicio de workers; dos workers evitan los timeouts locales
  observados en la ejecución paralela inicial. CI conserva su comando habitual.
- Backend, esquema y base local sin cambios; se conservan sus 106 pruebas
  aprobadas, sin repetirlas para este cambio frontend.
- Navegación, recarga, cierre de pestaña y otros formularios siguen fuera del
  alcance de recuperación. Diff revisado sin errores de whitespace.

## Etapas propuestas

| Etapa | Objetivo | Criterio de cierre |
|---|---|---|
| 30 | Separar páginas y componentes del frontend, por partes. | `App.tsx` conserva la composición general; las pantallas extraídas mantienen comportamiento, permisos y pruebas. |
| 31 | Extraer configuración y acceso a SQLite del backend. | Módulos separados, sin cambios en endpoints, esquema ni datos; pruebas aprobadas. |
| 32 | Extraer autenticación y sesiones del backend. | Conservación de hashes, expiración, revocación y permisos; pruebas aprobadas. |
| 33 | Separar rutas del backend por área funcional. | Endpoints y respuestas compatibles; extracción gradual con validación por bloque. |
| 34 | Revisar las PRs Dependabot pendientes. | Cada actualización evaluada por separado y publicada únicamente si sus verificaciones pasan. |
| 35 | Revisar permisos y protección de episodios cerrados. | Matriz de acciones por rol, pruebas de rechazos relevantes y corrección de defectos encontrados. |
| 36 | Evaluar recuperación de borradores durante reautenticación. | Diseño acordado sobre identidad, vigencia del episodio, almacenamiento y eliminación antes de implementar. |
| 37 | Elegir la siguiente mejora funcional o de interfaz. | Necesidad concreta, alcance y criterio de aceptación definidos con el usuario. |

## Entregas pequeñas propuestas para las etapas 30–33

Esta subdivisión es una propuesta de trabajo por revisar. Cada entrega requiere
alcance concreto y aprobación antes de implementarse; el orden de las pantallas
y áreas por extraer se definirá al revisar la tarea correspondiente.

### Etapa 30: frontend

1. Extraer una primera pantalla y sus componentes propios; delimitar sus
   propiedades y conservar la composición general en `App.tsx`.
2. Extraer las demás pantallas, una por entrega, manteniendo los flujos de
   sesión, navegación y permisos existentes.
3. Extraer componentes compartidos identificados durante las entregas previas,
   en cambios pequeños e independientes.

Cada entrega conserva comportamiento y contratos TypeScript, mantiene el
cliente HTTP en `frontend/src/api/client.ts` y los tipos compartidos en
`frontend/src/types/clinical.ts`, y debe superar las validaciones aplicables.

### Etapa 31: configuración y SQLite

1. Extraer la configuración existente a un módulo, conservando sus valores y
   la ubicación efectiva de la base de datos.
2. Extraer la creación de conexiones SQLite, manteniendo las opciones actuales.
3. Extraer la inicialización de la base de datos y conectar el arranque existente
   con el módulo correspondiente.

Cada entrega mantiene endpoints, esquema y datos sin cambios y requiere las
pruebas aplicables aprobadas antes de su cierre.

### Etapa 32: autenticación y sesiones

1. Extraer las funciones de hash y verificación sin cambiar algoritmos ni formatos.
2. Extraer la validación de sesiones y las dependencias de permisos por rol.
3. Extraer la lógica de inicio y cierre de sesión y consulta del usuario actual,
   conservando los contratos HTTP existentes.

Cada entrega conserva persistencia, hashes, expiración, revocación y permisos.
Su cierre requiere las pruebas aplicables aprobadas.

### Etapa 33: rutas por área funcional

1. Extraer un primer bloque de rutas de un área acordada y conectarlo a la
   aplicación existente.
2. Repetir la extracción por área funcional, una por entrega, aprovechando los
   módulos ya separados de configuración, SQLite y autenticación.
3. Revisar la composición final de la aplicación y las dependencias entre los
   bloques extraídos.

Cada bloque conserva métodos, rutas, permisos, códigos de estado y respuestas;
debe validarse antes de continuar con la siguiente entrega.

## Condiciones de las etapas posteriores

- Etapa 34: revisar cada PR de Dependabot individualmente, incluidas las #1 y
  #2 si continúan pendientes. Comprobar su estado y diff al iniciar la revisión;
  no agrupar aprobaciones ni publicaciones. Publicar cada actualización solo
  tras sus verificaciones y la autorización correspondiente.
- Etapa 35: documentar la matriz de acciones por rol y estado del episodio.
  Cualquier defecto encontrado debe tener una tarea de corrección delimitada
  y aprobada; no se mezclará con las refactorizaciones.
- Etapa 36: la pérdida del borrador ante HTTP 401, navegación o recarga sigue
  siendo una limitación aceptada. Es obligatorio acordar primero el diseño
  sobre identidad, vigencia del episodio, almacenamiento y eliminación.
  Cerrar la evaluación de diseño no autoriza su implementación: recuperar
  borradores continúa pendiente de aprobación como tarea independiente.
- Etapa 37: seleccionar la necesidad concreta con el usuario y acordar alcance
  y criterio de aceptación antes de proponer una tarea de implementación.

## Próximo paso

Etapa 55 cerrada: implementación y cierre documental publicados; CI aprobada.
Etapa 56 implementada y publicada como una entrega transversal
para revisar resultados inciertos. Backend: 143 pruebas aprobadas; frontend:
suite de 290 y comprobaciones finales dirigidas aprobadas (293 casos distintos),
lint y build aprobados; CI `38276196805` aprobada. Prueba directa de
interrupción y reintento confirmada satisfactoria por el usuario. Etapa 56
cerrada dentro del alcance. Cierre documental autorizado para publicación.
Etapa 57 cerrada y publicada: actualización común entre sesiones; frontend
309 pruebas, lint y build aprobados. Prueba directa de conflicto confirmada por
el usuario. Commit `e51acdc3fdff70c07b58de183f0a5b9a78156948` y CI
`38284664050` aprobada. Etapa 58 cerrada y publicada para revisar envíos
tras recarga o reinicio. Frontend: 341 pruebas, lint y build aprobados;
prueba directa completada por el usuario. Commit
`498e5569bd06f0a342bd021a0b4259574eacb1c2` y CI `38292624235` aprobada.
Etapa 59 autorizada e implementada localmente: espera y cancelación comunes,
con plazo configurable de 30 segundos. Frontend: 362 pruebas, lint y build
aprobados, más el caso nuevo del ajuste de mensaje (363 distintos).
Prueba directa completa confirmada y CI `38303904910` aprobada. Etapa 59 cerrada.
Etapa 60 autorizada e implementada localmente: recuperación del registro dañado.
Prueba directa de 60 aprobada por el usuario.
Entrega de 60 publicada: `fe7f802`; CI `38310344158` aprobada. Etapa cerrada.
Etapa 61 autorizada e implementada localmente: presencia por episodio.
Validación de 61 aprobada: 160 backend, 386 frontend, lint/build.
Etapa 61 publicada: `45013fc`; CI `38325483200` aprobada.
Siguiente paso: acordar el alcance de la próxima mejora transversal.

## Etapa 54: recuperación común de borradores tras HTTP 401

- Commit `7e6c559b19043546a2e47269783d1f967e058b92`; CI `38257535035` aprobada.
- Implementada y publicada. Una entrega funcional transversal,
  con mecanismo compartido para ingreso, triaje, signos, evaluación, órdenes, resultado LAB y
  nota de alta; integra la recuperación de 37A conservando sus garantías.
- Conservar campos editados solo en memoria, ocultos durante el login, durante
  30 minutos desde la interrupción inicial. Nunca conservar contraseñas ni
  escribir datos clínicos en localStorage/sessionStorage o en el backend.
- Restauración explícita para la misma identidad y rol, después de consultar
  permisos/estado actual del episodio y de la tarea LAB. Revalidar al confirmar;
  rechazar episodios cerrados, tareas completadas, otra identidad y vencimiento.
- Limpiar al guardar con éxito, descartar, logout explícito o salir del contexto.
  Un guardado confirmado antes de fallar una consulta posterior no es un borrador.
  No reenviar solicitudes automáticamente ni confundir recuperación de campos
  con reintento de una escritura de resultado incierto.
- Criterios comunes: varios formularios editados en un episodio, HTTP 401
  concurrentes, respuestas tardías, reintento de consulta, cambios de identidad/
  rol/estado, vencimiento, limpieza y ausencia de escrituras al restaurar.
- Recarga, cierre de pestaña y reinicio quedan fuera de esta recuperación en
  memoria. Preservar borradores después de esos eventos requiere otro diseño
  sobre almacenamiento y privacidad; no se presenta como capacidad de 54.

## Etapa 55: conflictos entre sesiones

- Prueba directa entre dos sesiones confirmada satisfactoria por el usuario:
  conflicto visible, conservación de campos y revisión explícita sin guardar
  automáticamente. Confirmación manual; no es una nueva prueba automatizada.
- Etapa 55 cerrada dentro del alcance acordado.
- Implementada y publicada: 140 pruebas backend (ocho nuevas),
  271 frontend (12 nuevas), lint y build aprobados.
- Mantener lectura y trabajo simultáneos por los roles autorizados; no reservar
  un episodio completo para una única sesión.
- Mecanismo compartido de versiones y comprobación atómica para modificaciones
  del mismo recurso. Triaje es el caso confirmado de sustitución de datos:
  prioridad, ubicación y responsable pueden quedar sobrescritos por otra sesión.
- Diferenciar registros nuevos (signos, evaluaciones y órdenes) de modificaciones
  de triaje, tareas y alertas. Evitar conflictos por actividades independientes.
- Alta médica requiere revisar cambios clínicos relevantes ocurridos desde la
  versión que el médico consultó; excluir eventos meramente informativos como
  abrir/escanear el episodio de esa versión clínica.
- Conflicto visible: conservar los campos locales, consultar cambios actuales y
  exigir revisión explícita antes de otra acción. Sin sobrescritura forzada,
  fusión ni reenvío automático. Integrar recuperación de 54 con estas versiones.
- Preservar idempotencia de 53: una escritura confirmada con la misma clave debe
  reconocerse aunque una operación posterior haya cambiado la versión.
- Una entrega transversal con pruebas de dos conexiones/sesiones, permisos,
  estados, conflicto, actividades independientes, reintentos y rollback.
- Publicada en `bfa171b1a21f121fbd11cf322b7f767e991667b0`; CI `38268979298` aprobada. Presencia en tiempo real, edición
  colaborativa y bloqueos exclusivos no forman parte de esta propuesta.

## Etapa 56: revisión común de resultados inciertos

- Alcance transversal autorizado e implementado localmente para POST/PATCH
  operacionales. Red, HTTP 5xx o respuesta ilegible distinguen un resultado por
  confirmar de un rechazo definitivo; conservan campos e intención original.
- Panel compartido para ingreso, triaje, signos, evaluación, órdenes, tareas,
  alertas, alta, demo y reglas. Consultar usa un GET autenticado del recibo:
  no reenvía ni escribe. Ausencia significa desconocido, no fallo confirmado.
- Reintento explícito con contenido, clave y versión originales; bloquea una
  intención distinta para el mismo recurso mientras exista incertidumbre.
  Usa los bloqueos de 53A; recursos independientes continúan disponibles.
- Confirmación actualiza el contexto correspondiente, limpia solo el formulario
  original si sigue sin cambios y conserva ediciones posteriores y otros borradores.
  Los conflictos del reintento pasan al mecanismo de revisión de 55.
- Consulta de recibos restringida al usuario y rol actuales, incluso si venció
  el plazo de reintento. Sin esquema nuevo ni cambios en la base de demostración.
- Cambiar/expirar la sesión descarta contenido y claves; si había un envío
  incierto o en curso, bloquea nuevas escrituras hasta la revisión explícita de
  registros. Lecturas y autenticación siguen disponibles; confirmar revisión no
  escribe ni garantiza recuperar la intención anterior.
- Todo permanece en memoria. Recarga, cierre de pestaña y reinicio pierden esta
  información; recuperación durable y archivo de recibos siguen fuera del alcance.
- Validación backend: 143 pruebas aprobadas, una advertencia existente.
  Frontend: suite completa de 290 pruebas aprobada y comprobaciones finales
  dirigidas aprobadas (22 casos nuevos en total; 293 casos distintos cubiertos).
  Lint y build aprobados. No se repite backend tras cambios solo frontend.
- Publicada en `3a5d67c341f9cfebf06ca5d7b3a9e8f32d2231bb`;
  CI `38276196805` aprobada: backend, frontend, lint y build.
- Prueba directa de interrupción y reintento confirmada satisfactoria por el
  usuario: API detenida antes del envío, resultado por confirmar, consulta
  y reintento explícito; guardado confirmado sin otro registro.
  Confirmación manual de este flujo. La respuesta perdida después de guardar
  conserva su cobertura automatizada; no se atribuye a esta prueba manual.
- Etapa 56 cerrada dentro del alcance acordado.

## Etapa 57: actualización común entre sesiones

- Alcance autorizado y publicado: un mecanismo compartido actualiza dashboard,
  supervisor, bandeja LAB y episodio abierto cada 15 segundos tras finalizar la
  consulta anterior; solo consulta la pantalla activa y visible. Al regresar a
  la pestaña vuelve a consultar; no usa WebSocket ni bloquea otras sesiones.
- Consultas manuales y automáticas de la pantalla activa comparten el bloqueo.
  Pausa durante envíos y descarta respuestas tras navegación, cambio de sesión,
  pestaña oculta o una escritura iniciada después de la lectura.
- Conserva campos editados y sus versiones originales; actualiza triaje limpio
  y mantiene el filtro del supervisor. No acepta conflictos ni reenvía operaciones.
- Si otro usuario cierra el episodio o retira una orden pendiente, muestra el
  estado actualizado y conserva el texto local para copiarlo, sin botón de envío.
  El texto solo vive en memoria mientras se permanezca en esa pantalla.
- Un fallo conserva los datos anteriores, avisa que pueden estar desactualizados
  y permite reintentar. Historial, escaneo e ingreso quedan fuera del sondeo.
- Validación final: suite completa frontend de 309 pruebas aprobada (16 casos
  nuevos), comprobación dirigida final de 6 casos aprobada, lint y build aprobados.
  Backend sin cambios: 143 pruebas y CI de 56 aprobadas, sin repetirlas.
  Datos de demostración conservados; API y frontend responden HTTP 200.
- Prueba directa entre sesiones confirmada por el usuario: se mostró el aviso
  de datos modificados durante la edición y se conservaron los campos locales.
  Esta confirmación no acredita todavía aceptar los cambios y volver a guardar.
- Publicada en `e51acdc3fdff70c07b58de183f0a5b9a78156948`;
  CI `38284664050` aprobada: backend, frontend, lint y build.
- Etapa 57 cerrada dentro del alcance acordado. Cierre documental incluido
  en la publicación autorizada; la revisión explícita de conflictos sigue disponible.

## Etapa 58: revisión de envíos tras recarga o reinicio

- Alcance transversal autorizado e implementado localmente para POST/PATCH
  operacionales: registra antes del envío una referencia por clave y recupera
  las referencias anteriores al validar la identidad después de recargar o entrar.
- Solo persiste clave opaca, tipo de acción, fecha, estado de revisión y huella
  de usuario/rol/API. No guarda rutas, IDs de pacientes/episodios, texto clínico,
  contenido original, versiones, respuestas ni credenciales adicionales.
- Consulta los recibos existentes por GET, una vez por referencia y sesión,
  secuencialmente. Confirmación retira la referencia y permite refrescar la vista
  sin borrar formularios actuales ni atribuirles el contenido del envío anterior.
- Resultado desconocido o fallo conserva el aviso y bloquea nuevos envíos hasta
  confirmación o revisión manual explícita. La revisión no demuestra un fallo:
  habilita nuevas acciones, conserva el aviso y permite volver a consultar.
  Solo un aviso revisado puede retirarse manualmente. No hay reenvío automático
  ni reintento del contenido perdido; el reintento de 56 sigue en memoria.
- Una entrada por clave evita sobrescribir listas entre pestañas. Solo recupera
  las referencias existentes al entrar: las nuevas de otra pestaña no bloquean
  por sí solas una pantalla ya abierta. Detecta cambios del token antes de enviar
  y no elimina el token de la otra sesión. Las referencias se aíslan por identidad.
- No caduca ni desaloja referencias pendientes automáticamente. Límite de 256
  por propietario; fallo al persistir detiene el envío antes de fetch. Registro
  dañado o no disponible bloquea escrituras y ofrece reintentar su carga.
- Requiere conservar el almacenamiento del mismo navegador y perfil. Borrarlo,
  usar otro equipo o cerrar un perfil privado puede perder las referencias;
  no reconstruye claves antiguas que nunca fueron registradas. No cambia SQLite.
- Un primer rechazo 401 retira la referencia nueva; si hubo antes un intento
  de resultado incierto, conserva la clave para consultar tras reautenticarse.
- Validación final: suite completa frontend de 341 pruebas aprobada en 33
  archivos, incluidos 32 casos nuevos; lint y build aprobados.
  Backend sin cambios: conserva las 143
  pruebas y CI aprobada de 57, sin repetirlas localmente.
- Prueba directa completada por el usuario: intento sin conexión, recuperación
  del aviso tras recargar, resultado sin confirmación, revisión manual conservada
  tras otra recarga y retirada explícita del aviso revisado.
- Entrega publicada: commit `498e5569bd06f0a342bd021a0b4259574eacb1c2`;
  CI `38292624235` aprobada: backend, frontend, lint y build.
  Etapa 58 cerrada dentro de este alcance. Cierre documental incluido
  en la publicación autorizada; próximas implementaciones requieren autorización.

## Etapa 59: espera y cancelación comunes

- Alcance aprobado e implementado localmente para todas las solicitudes del
  cliente: plazo de 30 segundos configurable con VITE_REQUEST_TIMEOUT_MS.
- Escrituras vencidas mantienen intención y resultado incierto; consultas
  fallidas liberan bloqueos y permiten continuar sondeo/recibos. Sin reenvío.
- Cancelación por sesión y señales externas; respuestas antiguas descartadas.
  La petición de logout conserva su revocación remota y su propio plazo.
- Validación final: 362 pruebas frontend (35 archivos, 21 casos nuevos), lint
  y build aprobados. Un trabajador fuera del sandbox, sin ampliar tiempos;
  suites afectadas también aprobadas por separado (77 pruebas).
- Backend y datos intactos. Consulta de recibo confirmada por el usuario sin
  otro registro; en la repetición confirmó el aviso de tiempo agotado y la
  consulta posterior del mismo intento sin crear otro registro.
  Publicación autorizada y completada: implementación `099f4f3`, corrección
  `15c13d955c7413ba4b5b867dcb8ac34b0760230e`; CI `38303904910` aprobada
  con 143 pruebas backend (1 warning conocido), 363 frontend, lint/build.
  Etapa 59 cerrada dentro del alcance; cierre documental incluido.
- Panel corregido para mostrar la causa registrada del fallo. Validación final
  del ajuste: 12 pruebas dirigidas, incluido un caso nuevo; 363 casos distintos
  verificados (última suite completa: 362), lint/build aprobados.
  Aviso de plazo confirmado por el usuario tras el ajuste del panel.

## Etapa 60: recuperación del registro local dañado

- Implementación local autorizada: lectura separada de referencias válidas y
  dañadas, común a todos los envíos operacionales. Una entrada dañada deja de
  ocultar las referencias sanas y sus consultas de recibo.
- Consulta explícita por GET de daño con clave válida y propietario de la sesión
  verificado. Solo una confirmación del servidor retira esa entrada, comprobando
  antes que no cambió desde el comienzo de la consulta. Nunca reenvía el contenido.
- Sin confirmación, error, cambio de sesión o modificación en otra pestaña:
  conserva la referencia. Daño sin clave/propietario verificable conserva el
  bloqueo y ofrece orientación; no se atribuye al usuario ni se elimina.
- Revisar una referencia sana no habilita envíos mientras exista daño. No hay
  borrado masivo, migración de almacenamiento, persistencia clínica adicional,
  cambios backend ni modificación de datos locales.
- Validación final: 375 pruebas frontend (35 archivos, 12 casos nuevos), lint
  y build aprobados. Suite con un trabajador fuera del sandbox por un fallo de
  lectura de temporales. Una ejecución intermedia mezcló el panel cargado antes
  del ajuste de texto y su prueba posterior (374/375); la ejecución final pasó
  completa sin ampliar tiempos. Backend conserva la validación aprobada de 59.
- Prueba directa aprobada por el usuario: tras alterar solo createdAt de una
  referencia ficticia, la consulta confirmó el envío anterior; desapareció la
  referencia dañada y el historial mostró una sola evaluación de ese intento.
  La interfaz informó que conservó los campos actuales, sin reenviar.
- Entrega publicada: `fe7f802aa1888af67435f997d49f2a2259520386`.
  CI `38310344158` aprobada: 143 pruebas backend (1 warning conocido),
  375 frontend, lint y build. Etapa 60 cerrada dentro del alcance;
  cierre documental incluido en la publicación autorizada.

## Etapa 61: presencia compartida por episodio

- Implementación local autorizada: indicador de otras sesiones/pestañas en el
  episodio activo, agrupado por usuario y rol, con número de pestañas y sesiones.
  Distingue consulta y formularios con cambios sin guardar, sin transmitir campos.
- Renovación cada 15 segundos mientras la pestaña está visible; caducidad de
  45 segundos sin renovar. La pérdida de actualización muestra aviso de información
  posiblemente desactualizada, sin afirmar que el usuario trabaja a solas.
- Rutas GET/PUT/DELETE de presencia autenticadas y tabla aditiva episode_presence,
  documentada en backend/migrations/004_episode_presence.sql. PUT es renovación
  idempotente de metadatos; no entra en el diario de envíos clínicos.
- Solo NURSE/DOCTOR/SUPERVISOR pueden declarar EDIT; todos los roles autenticados
  pueden consultar. Sesiones revocadas, vencidas o usuarios inactivos se excluyen.
  No se exponen tokens, IDs de sesión ni identificadores de otras pestañas.
- Secuencia por pestaña evita que una renovación anterior sustituya un modo nuevo.
  Liberación al salir y pagehide, con marca temporal de cierre que impide renovar
  esa misma presencia durante 45 segundos. Restaurar desde bfcache usa otra clave.
  La salida es de mejor esfuerzo: una red fallida depende de la caducidad; esta
  presencia aproximada no reserva el episodio ni sustituye If-Match al guardar.
- Al cerrar el episodio se deja de renovar y se retira el panel. Se conserva el
  mecanismo existente para texto pendiente y conflictos. No se añade evento clínico
  ni recibo; las versiones clínicas y de triaje permanecen iguales.
- Validación final: 160 pruebas backend (17 nuevas, 1 warning conocido),
  386 frontend en 37 archivos (11 nuevas), lint y build aprobados. Suite frontend
  con un trabajador, sin ampliar tiempos; validación fuera del sandbox. Primer
  intento backend sin salida interrumpido. Pruebas dirigidas corrigieron el montaje
  del listener de edición y una comparación dependiente del orden de usuarios.
- Tras la suite completa se afinó solo la prueba de integración para comprobar
  If-Match del triaje: 2 pruebas de esa suite, lint del archivo y TypeScript pasan.
  Los flujos App anteriores aíslan el panel; App.presence.test.tsx prueba su
  integración real, campos conservados y retirada tras cierre remoto.
- Prueba directa confirmada por el usuario: presencia entre médico y enfermería,
  indicador de cambios sin guardar, retirada al salir del episodio, caducidad
  en Offline y recuperación al restablecer la conexión. El primer intento usaba
  un backend anterior sin las rutas nuevas; se reinició y se verificó su disponibilidad.
- Entrega publicada: `45013fc33a0310e88d07ad7e6c35eb6b0e4bb7ef`.
  CI `38325483200` aprobada. Prueba directa aprobada; Etapa 61 cerrada.
  Cierre documental incluido en la publicación autorizada.
  Datos clínicos locales conservados.

## Fuentes

Revisión transversal 53–58 completada: [cobertura, límites y propuesta 59](WRITE_FLOW_REVIEW.md).
La entrega común de espera y cancelación está autorizada como Etapa 59,
con plazo inicial de 30 segundos, publicada y con CI aprobada.

- Plan de etapas 30–37 aportado por el usuario en esta conversación.
- [Estado del proyecto](PROJECT_STATUS.md): cierre confirmado, capacidades y
  limitación aceptada de borradores.
- [Registro de evolución](CHANGELOG.md): antecedentes de las etapas 28 y 29.
- Las entregas pequeñas de este documento desarrollan el plan aportado como
  propuesta; no se presentan como contenido recuperado del chat original.


## Revisión integral posterior a 61

Revisión autorizada completada: [informe y propuesta transversal 62](OPERATIONAL_FLOW_REVIEW.md).
Prioridad propuesta: validación común de entradas en todos los formularios operacionales.
Segunda prioridad: coherencia de pendientes de laboratorio tras el cierre.
Revisión incluida en la publicación autorizada de la Etapa 62.


## Etapa 62: validación transversal de entradas

- Implementación autorizada: reglas comunes backend para ingreso, triaje,
  evaluación, orden, resultado y alta; rechazo de vacío/solo espacios y límites
  de texto. Fecha de nacimiento estricta AAAA-MM-DD, real y no futura.
- Límites: nombre/ubicación/responsable 1–200; documento 1–100;
  diagnóstico 2–500; evaluación y resultado 3–2000; orden 3–300;
  nota de alta 1–2000. La longitud se comprueba sobre el valor original.
  No se normaliza ni recorta texto en los nuevos validadores. El recorte de
  nota de alta ya existente en la interfaz se conserva.
- Los campos omitidos que tenían un valor predeterminado lo conservan.
  Sin nuevas reglas de identidad/documento nacional ni cambios históricos.
- Validación frontend central por formulario operacional antes del envío;
  conserva campos y bloquea el submit inválido. Mensajes HTTP 422 muestran
  el campo y motivo; un rechazo definitivo no se presenta como resultado incierto.
- Sin cambios en roles, versiones, recibos, reintentos originales o política
  de cierre. La coherencia de pendientes de laboratorio permanece fuera del alcance.
- Pruebas nuevas de modelos, fechas, límites y preservación, API sin efectos ni
  recibos ante rechazo, corrección/replay y formulario con corrección sin perder campos.
- Validación final: 173 pruebas backend (13 nuevas, 1 warning conocido),
  409 frontend (23 nuevas, 38 archivos), lint/build aprobados. Primer intento
  frontend: 405/409; se corrigieron fixtures vacíos y expectativas de recuperación
  múltiple, y una prueba agotó su tiempo bajo carga. Suite final completa aprobada
  sin ampliar tiempos. Recarga del backend local limitada a backend/app para
  reducir carga. Prueba directa de ingreso aprobada por el usuario: rechazo
  de nombre con espacios y nacimiento futuro, con campos conservados y sin crear
  episodio. Los demás flujos y límites cuentan con pruebas automatizadas.
  Entrega publicada: `99dac23ca7373a99fe5513e7bc2414d008baf4a9`;
  CI `38328571734` aprobada. Etapa 62 cerrada dentro del alcance.
  Cierre documental incluido en la publicación autorizada.


## Etapa 63: pendientes de laboratorio tras el cierre

- Implementación local autorizada al retomar el trabajo el 16 de octubre de 2026.
- La bandeja distingue órdenes ejecutables (PENDING + ACTIVE) y pendientes de
  episodios cerrados. Los segundos permanecen visibles para consulta sin ofrecer
  publicación. Supervisor consulta; únicamente LAB puede publicar.
- Se usa episode_status del contrato existente: sin cambios de API, migraciones,
  cancelación automática de tareas ni condiciones nuevas para dar el alta.
- Actualización automática, manual y consulta de conflictos comparten la captura
  del texto local: si deja de ser ejecutable se conserva para copiar en la pantalla.
  Al salir o cambiar de identidad se mantiene el descarte existente. No se persiste
  contenido clínico adicional. Una publicación exitosa no genera un falso borrador
  retenido al refrescar la bandeja.
- Pruebas nuevas de separación, consulta supervisor y cierre remoto con texto en
  actualizaciones manuales/automáticas; estos casos pasan. Lint/build aprobados.
  Suite frontend habitual: 409/413 (39 archivos), con cuatro fallos en arranque
  de sesión/espera de pantalla. Reintento de cuatro archivos: 14/16; persisten
  dos fallos de inicio anteriores a la bandeja. El pool VM produjo fallos
  adicionales y se interrumpió. Preparación experimental de WebCrypto: 15/16,
  sin eliminar el problema; ajuste retirado. No se ampliaron tiempos ni se
  modificaron pruebas de otros módulos. Backend conserva su aprobación previa
  de 173 pruebas, al no modificar código backend.
- Diagnóstico retomado tras reiniciar, actualizar Windows y cerrar programas,
  según confirmó el usuario. Sin cambiar código, configuración ni tiempos:
  cuatro archivos antes fallidos aprobados (16/16, 42 s); suite habitual completa
  aprobada después (413/413, 39 archivos, 153,66 s frente a 955,25 s del intento
  anterior). Esto respalda influencia de la carga local, sin identificar un
  proceso específico como causa. Lint/build previos siguen vigentes.
- Prueba directa aprobada por el usuario: separación de órdenes ejecutables
  y pendientes cerrados; cierre desde otra sesión mientras se escribe, con
  retirada del botón Publicar y resultado preservado en Texto local conservado.
- Entrega publicada: `6c739569e4815d4396dffe936dee727f0cef3aff`;
  CI `38993035968` aprobada. Etapa 63 cerrada dentro del alcance. La detención previa
  por AGENTS.md se levantó con la autorización del usuario para diagnosticar;
  validación completa aprobada tras el reinicio.
  Cierre documental incluido en la publicación autorizada.
