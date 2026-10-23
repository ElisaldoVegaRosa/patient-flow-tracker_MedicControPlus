# Registro de evolución de MedicControl+

Este documento registra las funcionalidades incorporadas al sistema,
las verificaciones realizadas y el estado de cada etapa.

---

## Borradores de asignacion obsoletos (publicados en 2accbe0)

- Al actualizar una cola, una asignacion confirmada por otra sesion deshabilita
  el formulario anterior. Si habia campos locales, siguen conservados y ahora
  se identifican por episodio y accion en la parte superior de la cola.
- Cada formulario con campos sin guardar ofrece descartarlos expresamente,
  tambien cuando su accion ya no esta disponible. El descarte solo limpia ese
  formulario; no envia ni revierte la asignacion confirmada. Los otros campos
  pendientes permanecen protegidos.
- Reproduccion de asignacion ajena entre lectura y actualizacion, descarte e
  inicio propio: 18 casos frontend dirigidos aprobados; lint/build aprobados.
  Suite frontend completa 581/581 en 58 archivos aprobada. El borrador de la
  ventana original expiro con su sesion; usuario confirma aviso/descarte de un
  borrador nuevo sin envio. Transicion a formulario deshabilitado cubierta por
  prueba automatizada.
- Prueba guiada posterior de EP-22: dos responsables con inicios propios;
  traslado a Observacion mantiene medico, relevo de enfermeria propuesto y
  aceptado por receptora, nuevo inicio sin borrar el primero. Auditoria e
  integridad SQLite comprobadas. Usuario confirma PROPOSE/ACCEPT/START en UI.

## Paneles operacionales desplegables (publicados en 2accbe0)

- A solicitud del usuario, areas, creacion de turno, turnos, profesionales,
  pacientes y disciplinas de las colas se muestran plegados inicialmente.
  Cada entrada del historial de planificacion tambien es desplegable.
- Encabezados identifican turno/estado, profesional/area/estado y paciente/EP/
  prioridad/area; disciplinas indican responsable, cobertura y relevo pendientes.
- Cerrar paneles conserva los nodos y campos, proteccion de borradores y pausa
  de actualizacion mientras se edita. Abrir/cerrar no envia operaciones.
- Validacion: 16 casos frontend afectados aprobados (6 personal, 9 colas,
  1 navegacion), lint y build aprobados. Una expectativa antigua de ausencia
  de group se ajusto a ausencia de formularios operacionales: details tambien
  tiene rol group. Backend no modificado por este ajuste visual.
- Paneles desplegables confirmados por el usuario durante la prueba guiada.

## Colas, responsables y relevo aceptado (publicados en 2accbe0; CI 39894081075 aprobada)

- Responsables separados por cuenta personal, cola compartida y propia,
  area de seguimiento distinta de ubicacion y texto libre anterior conservado.
- Sugerencia explicable por prioridad/espera del episodio y carga del candidato:
  P1/P2, tareas propias, total y rotacion. LAB visible como dependencia.
- Asignacion, inicio propio y relevo aceptado separados. Cambio a Observacion
  mantiene normalmente medico; enfermeria anterior permanece hasta aceptacion.
  Cancelacion/rechazo y excepcion explicita de coordinacion auditados.
- Reutiliza transaccion, permisos actuales, versiones, recibos, proteccion de
  ediciones y resultados inciertos; cierre retira cola sin borrar responsables.
- Migracion aditiva ensayada dos veces sobre respaldo: 18 tablas previas intactas,
  20 pacientes/21 episodios, integridad y referencias correctas. Quince episodios
  con triaje y treinta espacios sin area ni responsables inferidos. Base original
  intacta durante ensayo. Usuario autoriza prueba guiada: demo iniciado y
  migracion aplicada conservando 18 tablas previas y 20 pacientes/21 episodios,
  con integridad/referencias correctas. Cuentas preparadas y prueba guiada
  completada hasta el relevo; publicacion en `2accbe0`.
- Dirigidas 25 backend, 18 frontend iniciales y 8 posteriores del archivo de colas
  aprobadas. Suite backend 284/284 y frontend 577/577 en 58 archivos aprobadas.
  Refuerzo final: version por secuencia clinica no QR para detectar cierre y
  reapertura/cambios que vuelven al mismo valor; contexto visible de alertas y
  desglose por prioridad. Diez casos de colas revalidados; nuevo caso y rutas
  afectadas 44/44 (cobertura acumulada 285). Frontend afectado 8/8 y lint/build
  finales aprobados, sin repetir suites completas. [Guia](PATIENT_QUEUES_ASSIGNMENT.md).

## Areas, turnos y coordinacion (publicadas en 1dff835; CI 39532858950 aprobada)

- Permiso adicional administrado con version, motivo, auditoria y revocacion de
  sesiones; conserva rol clinico y separacion de ACCOUNT_ADMIN.
- Areas configurables, turnos con fechas UTC/hora dominicana y responsable
  confirmado; personal activo, prevencion atomica de duplicados/solapamientos,
  disponibilidad explicita y consulta propia. Suplencia explicita auditada.
- Formularios operacionales compartidos con cuentas: conflictos, resultados
  inciertos y proteccion de campos sin guardar, incluidos cambios en selectores.
- Auditoria y recibos sin episodio; no modifica ubicacion, asignados ni historial
  clinico. Respaldo exige las tablas nuevas cuando detecta el permiso nuevo.
- Migracion transaccional ensayada dos veces en copia restaurada, preservando
  14 tablas anteriores, 20 pacientes y 21 episodios; base original sin cambios,
  servidores detenidos. Backend 270/270 (541,14 s), frontend 568/568 en 56
  archivos (431,01 s), lint y build aprobados. Usuario autoriza prueba guiada:
  demo iniciado y migracion aplicada conservando filas previas de 14 tablas,
  20 pacientes/21 episodios e integridad/referencias. Usuario confirma concesion
  de coordinacion y ciclo completo del turno #1/participacion #1, con auditoria
  de inicio, disponibilidad, pausa, finalizacion y cierre. Confirma retirada
  auditada, revocacion de sesion y nuevo acceso a consulta propia sin controles.
  Nueve tablas clinicas conservadas e integridad/referencias correctas despues
  de la prueba. Conflicto cubierto automaticamente, sin ensayo manual especifico;
  usuario autoriza commit/push a origin/main y comprobacion CI con "Si, cont".
  [Guia y limites](STAFF_AREAS_SHIFTS.md).

## Cuentas personales y administrador separado (publicadas en b2265c2)

- Perfil ACCOUNT_ADMIN separado de supervisor, sin consulta/acciones clinicas;
  acceso personal y nombre visible conservando autoria por username estable.
- Crear, activar/desactivar y restablecer con motivo, auditoria de metadatos,
  version y recibos compartidos sin episodio. No almacena claves en auditoria
  ni errores de validacion. [Guia](PERSONAL_ACCOUNTS.md).
- Desactivacion/restablecimiento revocan sesiones. Login y escrituras comprueban
  autorizacion bajo transaccion; sin autodesactivacion ni perdida del ultimo
  administrador activo. Alta inicial local interactiva; sin clave sembrada.
- Migracion aislada conserva todas las filas anteriores: 20 pacientes,
  21 episodios y 6 usuarios, con integridad y referencias correctas.
  Base activa intacta; servidores detenidos para impedir migracion por reload.
- Dirigidas 31 backend y 45 frontend aprobadas. Cobertura completa backend:
  252 casos (19 conservados + 233 afectados/pendientes en 384,52 s). Corregida
  compatibilidad de llamada directa a autenticacion detectada por la suite.
  Frontend 560/560 en 54 archivos (361,50 s), lint y build aprobados. Caso
  final confirma errores y representaciones sin claves, sin advertencia nueva
  de Pydantic; permanece deprecacion de dependencia Starlette/AnyIO en tests.
  Usuario autorizo prueba y ejecuto alta local: migracion aplicada, cero
  administradores creados y usuario admin.demo libre; integridad correcta.
  Mensaje generico corregido por causas seguras, validacion antes de migrar
  y usuario ocupado comprobado en transaccion. 21 dirigidas posteriores
  aprobadas, incluidas 5 nuevas de CLI. Usuario confirma reintento correcto;
  admin.demo activo y un BOOTSTRAP auditado, sin duplicados e integridad correcta.
  Usuario confirma prueba completa: acceso administrativo separado, creacion
  auditada de medico.demo1, acceso por perfil, baja con revocacion, reactivacion
  sin recuperar token anterior y restablecimiento con revocacion, rechazo de
  clave antigua y acceso con nueva. Chrome medico / Edge administrador.
  Demo iniciado; publicado en `b2265c2`. CI [39360417857](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39360417857)
  aprobada: backend, frontend, lint y build.

## Vista imprimible de pulsera para PDF (entrega local)

- Enfermeria/supervisor pueden preparar vista de episodios activos con triaje
  persistido. Nombre, nacimiento, documento, EP, QR existente y estado de identidad.
- Consulta vigente antes de abrir/imprimir; cambios requieren revisar otra vez,
  cierre o fallo de consulta impiden impresion. Cancelacion y sesion protegidas.
- Plantilla demo en A4; CSS separa contenido imprimible de controles e historia.
  Sin registro de entrega ni validacion de impresora fisica. [Guia](WRISTBAND_PDF_DEMO.md).
- 37 pruebas dirigidas, suite frontend 553/553 en 53 archivos (287,32 s) y
  18 casos del componente tras ajuste de foco aprobados; lint sin advertencias
  y build aprobados. Usuario confirma vista previa EP-21 y aporta captura
  del PDF guardado/abierto: una pagina, datos/QR sin cortes, sin controles
  ni historia. Encabezados del navegador visibles; se indico desactivarlos.
  Usuario confirma lectura QR desde PDF en Android y consulta del mismo
  paciente/EP-21 tras confirmacion. Reconexion ADB y reverse locales recuperados.
  Impresion fisica pendiente. Publicado en `ce16ed8`; CI [39354682995](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39354682995)
  aprobada: backend, frontend, lint y build. Sin cambios backend.

## Identidad provisional y admision/archivo (19 de octubre de 2026)

- Ingreso provisional con campos desconocidos NULL y etiqueta unica si falta
  nombre; conserva informacion parcial y muestra avisos en las bandejas.
- Perfil demo archivo/ADMISSION y bandeja; confirmacion con fuente/motivo,
  auditoria de valores, versiones e idempotencia. Sin fusion ni nuevos episodios
  al verificar; datos previos quedan registrados, no verificados retroactivamente.
- Borradores, conflictos y envios inciertos integrados; admite identidad sin
  documento al reabrir y distingue verificacion de actividad clinica al anular.
- Migracion preserva IDs, secuencia y referencias; respaldo exige auditoria
  en esquema nuevo. Ensayo aislado sobre copia local de 19 pacientes/20 episodios
  aprobado. Posteriormente, con autorizacion de prueba guiada, base activa
  migrada con integridad y referencias correctas. [Detalle](PROVISIONAL_IDENTITY.md).
- Dirigidas 33 backend y 67 frontend aprobadas. Cobertura completa: 235 backend
  (118 iniciales + 117 pendientes aprobadas en 217,63 s); 535 frontend
  (534 aprobadas y un fallo de espacio en tabla, corregido y comprobado
  con 11 casos afectados aprobados). Actualizado test de usuarios a seis
  perfiles, conservando comprobacion de hashes y de inicializacion repetida.
  Lint y build aprobados. Usuario confirma prueba manual en EP-21: ingreso
  provisional, verificacion por archivo, mismo episodio activo, auditoria
  y salida de pendientes tras actualizar. Publicado en `e04be5f`; CI
  [39349014853](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39349014853) aprobada: backend, frontend, lint y build.

## Preparacion del lector QR con camara (18 de octubre de 2026)

- Escanear pulsera permite solicitar camara, cancelar y confirmar un QR antes
  de consultar. Conserva entrada manual, permisos API y contrato QR_SCANNED.
- Decodificador jsQR 1.4.0 local y carga diferida, sin subir ni guardar imagenes;
  bloquea confirmaciones simultaneas y rechaza URL/ruta como token.
- Libera camara ante cancelacion, salida, visibilidad o cambio de sesion;
  gestiona concesion tardia de permisos y errores sin reactivar automaticamente.
- 31 pruebas dirigidas iniciales; suite final 521/521 en 50 archivos (258,94 s),
  lint y build aprobados. Dos casos adicionales de cancelacion incluidos en la
  suite completa. Hook de pruebas y tipos de simulacion corregidos sin ampliar
  tiempos ni modificar el runner. Usuario confirma prueba fisica guiada con
  Redmi Note 11, Android 13 y Chrome: camara, cancelacion, captura unica y
  consulta explicita del paciente/episodio correctos. QR en pantalla de PC;
  tableta e impresion pendientes. [Limites](QR_CAMERA_DEMO.md). Publicado en
  `46a18b8`; [CI 39195510597](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39195510597)
  aprobada: backend, frontend, lint y build.

## Control local del demo en Windows (18 de octubre de 2026)

- Start, Status y Stop desde scripts/demo.ps1 o tareas de VS Code; procesos
  ocultos y salida/logs accesibles, sin cambiar el circuito clinico.
- Gestion por PID, fecha de creacion y ejecutable; no adopta procesos
  externos. Verifica puertos, evita operaciones concurrentes y conserva
  referencias cuando no puede verificar o detener. Fallo parcial revierte
  solo procesos nuevos. Stop fuerza arboles propios, sin drenaje de solicitudes.
- Backend sin reload ni access log; frontend con puerto estricto; solo PC local.
  [Guia](DEMO_OPERATIONS.md) y [plan](URGENCIAS_PILOT_PLAN.md).
- 23 pruebas dirigidas aprobadas. Suite backend 216/216 aprobada (439,95 s). Prueba
  guiada completada por el usuario: rechazo de puerto ocupado, arranque, estado,
  parada, puertos libres y nuevo arranque con pantalla de acceso. Publicado en
  `361d33c`; [CI 39164657470](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39164657470)
  aprobada: backend, frontend, lint y build.

## Busqueda compartida de pacientes y episodios (validada)

- Buscador por palabras del nombre, sin distincion de acentos/mayusculas, o
  numero de EP exacto (20, EP-20, ep20) en Centro de control, Historial,
  Supervisor y Laboratorio. Combina filtros existentes, informa coincidencias
  y permite limpiar sin alterar los indicadores generales.
- La busqueda no desmonta resultados ni correcciones de laboratorio: ocultar
  una orden conserva campos y advertencias de salida. Sin envios al escribir
  o pulsar Enter; sin persistencia de la consulta ni ampliacion de permisos.
  Se limita a los datos ya disponibles en cada pantalla; no cambia la API,
  los registros ni la comparacion de identidad del ingreso.
- Validacion sobre `ebc433b` y cambios locales: 35 pruebas dirigidas, lint y
  build aprobados; suite frontend 487/487 en 47 archivos. Ajuste posterior
  del mensaje de Supervisor vacio, con un caso adicional: 15/15 pruebas de
  las pantallas afectadas, lint y build aprobados. No se repitio la suite
  sin cambios; TEMP/TMP en `.tmp/vitest-search`. Backend sin cambios.
- Prueba manual guiada confirmada por el usuario como Supervisor en las cuatro
  pantallas: EP-20 en Historial, EP-16 en control/supervision y EP-18/orden #15
  en Laboratorio. Busquedas, limpieza, filtros e indicadores comprobados sin
  crear registros. [Detalle](LOCAL_DEMO_CHECK.md).

## Prueba manual del ciclo de alertas (cierre documental)

- Usuario confirmo en EP-20 la alerta critica por saturacion ficticia de 90:
  Activa, Reconocida, Escalada y Resuelta; Enfermeria reconoce/escala sin acceso
  a Resolver; Medico resuelve; Supervisor consulta historial y eventos con
  autores y fechas. Caso ficticio cerrado por Medico al terminar.
- Sin cambios de codigo ni repeticion de suites. Se conserva la CI aprobada
  `39064241240` del commit `07050fc`. [Detalle](LOCAL_DEMO_CHECK.md).
- Cierre publicado en `ebc433b`; CI `39076266889` aprobada.

## Lenguaje de interfaz en espanol (publicado)

- Catalogo comun de etiquetas para episodios, tareas, alertas y transiciones,
  severidad, roles, servicios, decisiones, eventos y correcciones. Se utiliza
  tambien en presencia, revision de conflictos y borradores conservados.
- Historial muestra Ver linea de tiempo. Los estados de reapertura/anulacion
  se presentan en espanol; notas, resultados, motivos y originales conservan
  literalmente su contenido. Los codigos desconocidos se muestran como tales.
- Los valores de formularios, filtros, solicitudes API, permisos y datos no
  cambian. Validacion sobre `dcf2d7a` y cambios locales: 66 pruebas dirigidas,
  lint y build aprobados. Suite frontend de 45 archivos: 469/471 aprobadas;
  las dos restantes buscaban NURSE en lugar de Enfermeria. Ajustada solo esa
  expectativa, ambas aprobaron en ejecucion dirigida: 471 comprobadas, sin
  repetir las 469 sin cambios. TEMP/TMP en `.tmp/vitest-labels`.
- Prueba manual guiada confirmada por el usuario como Supervisor: cabecera,
  historial y estado de EP-18, eventos, correcciones/reapertura y orden LAB #15
  completada con su historial. Resultado, originales y motivos conservados.
- Publicado en `07050fc`; CI `39064241240` aprobada: backend, frontend, lint y build.

## Respaldo y restauracion del demo local (publicado)

- Nueva herramienta para crear una copia consistente de `backend/clinical.db`
  mediante la API de respaldo de SQLite, con SHA-256 e inspeccion de integridad,
  referencias y tablas del demo. Permite verificarla y restaurarla solo en una
  ruta nueva; nunca sobrescribe un archivo existente.
- Copia local y ensayo de restauracion verificados con 18 pacientes y 19
  episodios. Backend completo 196/196 aprobado en 310,14 s sobre `1b70ee0`
  y este bloque local, incluidas las cinco pruebas nuevas. Frontend sin cambios.
- Diagnosticado el bloqueo local de `TestClient`: el aislamiento de ejecucion
  detenia `socketpair` antes de iniciar la app. Reproducido con Python solo y
  resuelto ejecutando con los permisos adecuados y un temporal nuevo, sin
  modificar la app ni dependencias. [Procedimiento](LOCAL_VALIDATION.md).
- Publicado en `dcf2d7a`, CI `39062489007` aprobada. Respaldo y SHA-256 copiados
  y verificados en `D:\MedicControlPlus\backups`, disco extraible distinto del
  principal, con 18 pacientes y 19 episodios. Base activa conservada.

## Consulta y correcciones de registros (publicada)

- Órdenes LAB pendientes, completadas y todas consultables con número, EP,
  resultado vigente y resultados anteriores. El episodio muestra también tareas
  completadas, sin ofrecer completarlas de nuevo.
- En la bandeja, el filtro Completadas muestra inmediatamente el grupo
  «Completadas y anuladas»; los grupos vacíos de pendientes dejan de ocupar la
  pantalla. Comprobado en el demo local con las dos órdenes terminadas de EP-17.
- Historial aditivo `record_changes`: LAB corrige o anula publicaciones; médico
  rectifica o anula evaluaciones y notas de alta; médico/supervisor reabre el
  mismo episodio cerrado; recepción/supervisor anula ingresos sin actividad
  clínica. Cada acción exige motivo, versión e identificador de operación.
- Las correcciones históricas en CLOSED no lo reabren ni reactivan tareas. Los
  originales, eventos y recibos se conservan. Ingresos anulados salen de la
  operación activa y se consultan en historial. Sin borrado físico ni cambios
  intencionales en EP-17.
- Formularios nuevos de corrección/motivo advierten al cambiar de vista o recargar
  con campos sin guardar. Confirmar la salida descarta esos campos; la recuperación
  temporal de la etapa 65 sigue limitada a sus siete formularios.
- Tras el ajuste visual de Completadas: suite frontend 457/457 en 43 archivos,
  lint y build aprobados; la consulta se verificó en la interfaz local.
- Circuito manual de EP-17 completado por los cinco roles: alta CLOSED,
  evento DISCHARGE, presencia en historial y ordenes LAB #13/#14 conservadas.
- Prueba manual guiada del ciclo de vida: EP-18 conserva evaluacion y resultado
  originales tras rectificacion, devuelve LAB #15 a PENDING al anular el
  resultado y permite publicarlo de nuevo; corrige nota de alta en CLOSED,
  reabre con evento auditable y vuelve a cerrar. EP-19, sin actividad clinica,
  pasa a ANNULLED, conserva motivo y evento ARRIVAL ANNULLED, y aparece
  como anulado en Historial de episodios.
- Pruebas de migración, permisos, versiones, idempotencia, consulta y flujos de
  interfaz aprobadas. Backend 191/191; frontend 457/457 en 43 archivos;
  lint/build aprobados. Compatibilidad de versiones previas: 14 pruebas
  dirigidas posteriores aprobadas. Aviso de salida/recarga: 53 pruebas dirigidas
  y lint/build aprobados. Suite frontend final 457/457 con TEMP/TMP en
  .tmp/vitest tras ENOENT del temporal del sandbox en el primer intento.
  Pruebas manuales guiadas completadas. Publicado en
  `9a5bc84b3bcb12c6e63de7faeb6202ea255d09d3`; CI
  [39060204711](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39060204711)
  aprobada (backend, frontend, lint y build).

## Correccion: resultado LAB desde el episodio (publicada)

- Detectada en el circuito directo de EP-17: Completar en el detalle enviaba
  Completada sin novedades tambien para tareas LAB, retirandolas de pendientes
  sin introducir resultado. Usuario autorizo corregir ese flujo.
- Para LAB, la tarea pendiente ofrece Registrar resultado en laboratorio y abre
  la bandeja con su formulario existente. Navegar no completa ni envia resultado.
  Supervisor tiene Consultar laboratorio en modo lectura; otros roles reciben
  indicacion del responsable. El handler generico rechaza tareas LAB.
- NURSING/MEDICAL conservan su finalizacion existente. Sin cambios de API, reglas
  de permisos servidor, datos ni orden ya completada de EP-17. No se prohibe un
  texto especifico en API: el resultado lo escribe Laboratorio en el formulario.
- Pruebas de acceso por los cinco roles, episodio cerrado y orden completada,
  publicacion del texto escrito con If-Match y bloqueo compartido al navegar.
  Dirigidas: 55 aprobadas; suite frontend: 454 en 41 archivos, lint/build aprobados.
  Backend conserva validacion publicada (185 pruebas), sin cambios.
- Incluye guia del circuito local y resultados confirmados hasta la orden.
  Prueba directa corregida confirmada por el usuario e integrada en el commit
  publicado arriba. Las observaciones posteriores de historial y correcciones
  se abordan en ese mismo bloque.

## Etapa 65: borradores tras recarga (publicada)

- Politica autorizada por el usuario: guardar temporalmente campos de los siete
  formularios en sessionStorage de la pestana, sin tokens ni seleccion de ficha.
  Separacion por API/usuario/rol y caducidad por formulario de 30 minutos desde
  ultima edicion. Recargar, consultar y restaurar no extienden el plazo.
- Recuperacion explicita tras autenticar y consultar estado vigente de episodio
  y tarea. Se conservan versiones de edicion y se avisa de cambios; un guardado
  posterior sigue enviando If-Match original y exige revision ante conflicto.
  Restaurar no envia ni reintenta operaciones; referencias de recibos separadas.
- Guardado confirmado, descarte, cierre de sesion y cambio de identidad retiran
  borradores. Se detecta cierre de sesion desde otra pestana. Caducidad retira
  contenido temporal aun con la pagina abierta, sin borrar los campos visibles.
- Contenido temporal corrupto/incompatible se descarta sin mostrar sus valores.
  Cuota agotada o almacenamiento bloqueado avisan y mantienen copia en memoria;
  si es posible, retiran copias viejas para no ofrecer contenido desactualizado.
- Pruebas de recarga para los siete flujos, permisos/propietario, caducidad,
  fallos de almacenamiento, cierre remoto y version original tras recarga.
  Validacion: 442 pruebas frontend en 41 archivos, lint/build aprobados.
  Corregida cancelacion de consultas tardias tras desmontar, conservando la copia
  temporal para recarga; sin modificar runner ni tiempos de espera.
  Backend sin cambios: se conserva validacion publicada de 64 (185 pruebas).
- Pruebas directas de ingreso confirmadas por el usuario: recarga ofrece
  recuperar los valores sin crear episodio; descartar elimina la oferta y los
  campos en una recarga posterior. Los otros flujos tienen cobertura automatizada.
- Incluye cierre documental de 64. Publicada en
  `bb0220880f857d79f95e9ee7f5c1ec6e3ece18e0`; CI
  [39000263862](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39000263862)
  aprobada. Etapa 65 cerrada.

## Etapa 64: identidad del paciente e ingreso (publicada)

- Ingreso coteja documento, nombre y nacimiento. Las fichas existentes exigen
  revision explicita: abrir episodio activo coincidente o seleccionar ficha para
  crear un nuevo episodio tras el cierre anterior. Los campos del formulario se
  conservan; editar identidad invalida la seleccion. No hay reenvio automatico.
- Documento sensible a mayusculas y nombre sin distinguirlas; se ignoran espacios
  exteriores sin alterar los datos originales. Las discrepancias bloquean la
  seleccion. Varias fichas se revisan individualmente; no se fusionan historiales.
- POST /episodes admite patient_id opcional y devuelve 409 patient_identity_review
  con candidatos cuando hace falta cotejo. Mantiene permisos RECEPTION/SUPERVISOR.
  La seleccion y la ausencia de episodios activos coincidentes se comprueban
  dentro de la transaccion de escritura, aun con claves de operacion distintas.
- Conserva la huella de recibos anteriores sin patient_id; un reintento confirmado
  devuelve el episodio original. No cambia el esquema ni los datos demo locales.
- Pruebas de discrepancias, seleccion obsoleta, reutilizacion tras cierre,
  duplicados historicos, concurrencia, recibos y permisos; integracion de interfaz
  y cliente HTTP. Frontend: 417 pruebas en 40 archivos; lint/build aprobados.
  Backend: 185 pruebas aprobadas (1 aviso). Ejecucion fuera del sandbox tras
  errores de temporales/arranque del entorno aislado; sin ajustar runner ni tiempos.
- Pruebas directas confirmadas por el usuario: apertura del episodio activo sin
  duplicado, bloqueo ante discrepancia y reingreso con seleccion de ficha, nuevo
  episodio y conservacion del cierre anterior.
- Publicada: `0a85b5c7513b76aac6d2d27c0fb9bdaaec0ea4e7`; CI
  [38998701169](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/38998701169)
  aprobada. Etapa 64 cerrada; Git limpio y sincronizado al comprobar publicacion.

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

## Etapa 59: espera y cancelación comunes

- Publicación inicial `099f4f3df5dd0600c2fd06a821612987a7b872e7`;
  CI `38303379464` falló en siete pruebas que esperaban un único mensaje de
  error. Ajustadas para comprobar mensajes visibles en banner y panel;
  99 pruebas dirigidas, lint/build aprobados. Sin cambio adicional del producto.
  Corrección `15c13d955c7413ba4b5b867dcb8ac34b0760230e` y CI `38303904910`
  aprobada: 143 pruebas backend (1 warning conocido), 363 frontend, lint/build.
  Etapa 59 cerrada y publicada; cierre documental incluido en la autorización.
- Implementación local autorizada: plazo común de 30 segundos para cabeceras
  y cuerpo; VITE_REQUEST_TIMEOUT_MS permite configurarlo. Sin reenvío automático.
- Una escritura vencida conserva clave y referencia; puede consultarse o
  reintentarse explícitamente con el contenido original y una señal nueva.
- Cancela solicitudes antiguas al cambiar sesión y rechaza respuestas tardías.
  Logout conserva la revocación remota tras borrar la sesión local, con plazo.
- Libera bloqueos y permite continuar recibos y sondeo después del vencimiento;
  respeta señales externas y limpia temporizadores/listeners.
- Validación final: 362 pruebas frontend en 35 archivos, incluidos 21 casos
  nuevos; lint/build aprobados. Un trabajador fuera del sandbox, sin ampliar
  tiempos. Las 77 pruebas de las suites afectadas pasaron también por separado.
- Comparaciones de reintento conservan cuerpo/cabeceras/clave y exigen una
  señal de transporte nueva. Backend/base local intactos; conserva validación
  de 58 sin repetirla. El usuario confirmó la consulta del recibo sin crear otro
  registro; en la repetición confirmó el aviso de tiempo agotado. Publicación
  autorizada y completada con CI aprobada.

- Ajuste tras prueba directa: mostrar en Guardados por confirmar la causa
  registrada, incluido el tiempo agotado, que quedaba oculta por texto genérico.
  12 pruebas dirigidas finales aprobadas, incluido un caso nuevo; 363 casos
  distintos verificados (última suite completa: 362 antes de este ajuste).
  Lint/build finales aprobados; aviso del plazo confirmado en la repetición
  directa por el usuario. Después confirmó el recibo del mismo intento sin
  crear otro registro: prueba directa completa aprobada.

## Revisión transversal de las etapas 53–58

- Contrato común actualizado: referencias recuperadas de 58 y sondeo de 57.
- Cobertura y límites contrastados con código y pruebas existentes; prioridad
  identificada: falta de plazo común para solicitudes y lectura de respuestas.
- Propuesta 59 documentada con criterios de aceptación, sin implementación
  autorizada. Detalle: [revisión transversal](WRITE_FLOW_REVIEW.md).
- Solo documentación; no se repiten las pruebas y CI aprobadas de 58.

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

## Etapa 55: protección contra conflictos entre sesiones

- Prueba directa entre dos sesiones confirmada satisfactoria por el usuario:
  conflicto visible, conservación de campos y revisión explícita sin guardar
  automáticamente. Confirmación manual; no es una nueva prueba automatizada.
- Etapa 55 cerrada dentro del alcance acordado.
- Alcance transversal implementado y publicado. Mantiene el acceso
  simultáneo y los registros nuevos independientes (evaluaciones, signos y órdenes).
- Versiones opacas por triaje, tarea y alerta; versión clínica para alta. Se
  calculan desde el estado persistido y su historial, sin migración ni columnas
  nuevas. Escanear/consultar no cambia la versión clínica.
- Nuevas escrituras de triaje, alta, tareas y alertas requieren `If-Match`:
  ausencia devuelve 428; versión desactualizada devuelve 409 estructurado.
  Se comprueba dentro de `BEGIN IMMEDIATE`, con rollback de efectos y recibos.
- Un recibo confirmado de 53 se reconoce antes de comprobar la versión; no
  repite efectos aunque el episodio haya cambiado después. Permisos actuales
  continúan siendo obligatorios.
- Interfaz común: conserva campos, bloquea el reenvío del recurso en conflicto,
  consulta datos actuales y exige revisión explícita. Revisar no escribe;
  guardar requiere otra acción. Episodio cerrado/tarea completada/alerta resuelta
  no admiten continuar por este flujo.
- Recuperación de 54 conserva la versión original del borrador; no la renueva
  automáticamente al reautenticar. El cliente distingue intención y versión,
  reutiliza ambas ante respuesta perdida y protege respuestas tardías.
- Validación: 140 pruebas backend (ocho nuevas, una advertencia existente),
  271 frontend (12 nuevas), lint y build aprobados. Backend con Python de
  `.venv` y `--basetemp .tmp/pytest-55-full`; frontend con `--maxWorkers=1`
  y temporales locales.
- Publicada en `bfa171b1a21f121fbd11cf322b7f767e991667b0`; CI `38268979298` aprobada. Política: [escrituras](WRITE_OPERATIONS.md).

## Etapa 54: recuperación común de formularios tras HTTP 401

- Prueba funcional directa de recuperación confirmada satisfactoria por el
  usuario. Se registra la observación de acceso simultáneo desde dos sesiones;
  no se ha implementado una protección nueva contra conflictos.
- Implementación transversal publicada para ingreso, triaje, signos,
  evaluación, órdenes, resultado LAB y nota de alta. Integra la recuperación
  anterior de alta en el mismo almacén/hook, con captura común de campos.
- Restauración explícita de varios formularios, únicamente para la misma
  identidad y rol; episodio activo y tarea/bandeja LAB reconsultados antes
  de ofrecer y confirmar. No emite escrituras al restaurar.
- Borradores solo en RAM, ocultos durante el login, hasta treinta minutos desde
  la primera interrupción pendiente. Descarte, salida, logout, vencimiento y
  guardado confirmado los eliminan; una consulta posterior fallida no revive
  un ingreso o resultado ya aceptado. Guardar uno conserva los otros editados.
- Pruebas nuevas cubren formularios por rol, valores restaurados, varios
  borradores, estados clínicos, reintentos, vigencia y respuestas tardías.
- Validación: 259 pruebas frontend (29 nuevas), lint y build aprobados, con
  `--maxWorkers=1` y temporales locales. Backend sin cambios, conserva las 132
  pruebas previas; CI `38257535035` aprobada para esta entrega.
- Publicada en `7e6c559b19043546a2e47269783d1f967e058b92`.
  Recarga y reinicio no conservan estos borradores.

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

## Etapa 32C - Separación de endpoints de autenticación

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

---

## Etapa 32B - Separación de sesiones y autorización por rol

- Validación de sesión y autorización movidas a `backend/app/auth.py`.
- Dependencias FastAPI en `main.py` conservadas; conexión y fecha recibidas
  como parámetros. Expiración, revocación, usuario activo y 401/403 conservados.
- Once casos nuevos cubren estados de sesión, ausencia de token y los cinco roles.
- Validación: 33 pruebas backend aprobadas fuera del sandbox, una advertencia;
  temporal `.tmp/pytest-32b-verified` y diagnóstico de bloqueo activado.
- Lógica comparada con el original; diff revisado y `git diff --check`
  sin errores, incluidos los archivos nuevos.
- Sin cambios frontend, endpoints de autenticación, esquema ni datos demo.
- Entrega cerrada y publicada en el commit
  `e754f09f4c6b4e9d7dbab21aedaef9323579f418`; CI `37860358716` aprobada.
  La Etapa 32 continúa abierta.

---

## Etapa 32A - Extracción de hash y verificación

- Tres funciones movidas a `backend/app/security.py`, importadas en `main.py`.
- SHA-256, PBKDF2, sal aleatoria, iteraciones, comparación y formatos conservados.
- Tres pruebas nuevas de formato, verificación, sal, compatibilidad y acceso
  desde `main.py`; las funciones coinciden con las originales.
- Validación: 22 pruebas backend aprobadas fuera del sandbox, una advertencia.
  Temporal `.tmp/pytest-32a-verified`; diagnóstico de bloqueo de socketpair
  de asyncio en la ejecución dentro del sandbox, que fue interrumpida.
- Diff revisado y `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin cambios frontend, endpoints, validación de sesiones, roles ni datos demo.
- Entrega cerrada y publicada en el commit
  `4c85e9c8e2abefdbc3b9e3adef9d98e8e22f8af9`; CI `37858667828` aprobada.
  La Etapa 32 continúa abierta.

---

## Cierre documental de Etapa 31

- Criterios cumplidos tras 31A–31C: configuración, conexiones e inicialización
  separadas, manteniendo ruta SQLite, esquema, datos, endpoints y arranque.
- Evidencia vigente: 19 pruebas backend aprobadas; CI `37857021915`
  y CI documental `37857173485` aprobadas.
- Revisión documental sin cambios de código ni nuevas pruebas.
  Las referencias anteriores a Etapa 31 abierta son históricas.
- Propuesta 32A documentada, pendiente de autorización.

---

## Etapa 31C - Extracción de inicialización SQLite

- Esquema y carga inicial de usuarios demo movidos a `database.py`;
  wrapper y arranque en `main.py` conservados.
- Conexión, usuarios y funciones de hash y fecha recibidos como parámetros.
  SQL, commit y cierre conservados; solo se elimina espacio final en una línea SQL vacía.
- Prueba nueva de reinicialización que conserva esquema, usuarios, sesiones
  y episodios y verifica contraseñas demo.
- Validación: 19 pruebas backend aprobadas fuera del sandbox, una advertencia.
  Temporal `.tmp/pytest-31c-verified`, con diagnóstico de bloqueo activado;
  temporal habitual rechazado por permisos y ejecución anterior interrumpida.
- Diff revisado y `git diff --check` sin errores, incluido el archivo nuevo.
- Sin cambios frontend, endpoints, esquema ni datos demo locales.
- Entrega cerrada y publicada en el commit
  `1838e5716892106d30ea6b40000c9e8c5a551b24`; CI `37857021915` aprobada.
  La Etapa 31 continúa abierta.

---

## Etapa 31B - Extracción de conexiones SQLite

- Creación de conexiones movida a `backend/app/database.py`, con ruta explícita.
- `sqlite3.Row` y claves foráneas conservados. Wrapper en `main.py` mantiene
  la sustitución de `main.DATABASE_PATH` usada por las pruebas.
- Dos pruebas nuevas de filas por nombre, integridad referencial y separación
  de bases; conservada la cobertura del wrapper con ruta temporal.
- Validación: 18 pruebas backend aprobadas, tres advertencias conocidas;
  diff revisado y `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin cambios frontend, inicialización, consultas, endpoints, esquema ni datos demo.
- Entrega cerrada y publicada en el commit
  `376d59d85143371af407139f8ec459ced3e6dec5`; CI `37727737285` aprobada.
  La Etapa 31 continúa abierta.

---

## Etapa 31A - Extracción de configuración backend

- Constantes `DATABASE_PATH`, `DEMO_USERS`, `PASSWORD_HASH_ITERATIONS` y
  `SESSION_DURATION_HOURS` movidas a `backend/app/config.py`.
- Valores y ruta SQLite conservados; `main.DATABASE_PATH` mantiene la sustitución
  utilizada por las pruebas. Funciones y clases de `main.py` conservadas.
- Dos pruebas nuevas de ruta por defecto y conexión con sustitución temporal.
- Validación: 16 pruebas backend aprobadas, tres advertencias conocidas;
  diff revisado y `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin cambios frontend, endpoints, esquema ni datos demo.
- Entrega cerrada y publicada en el commit
  `26a6567758c4ad324d642307e86524e6f760b5e9`; CI `37727047490` aprobada.
  La Etapa 31 continúa abierta.

---

## Cierre documental de Etapa 30

- Revisión de criterios tras 30A–30I: ocho páginas y `AppHeader` separados;
  `App.tsx` mantiene composición, sesión, navegación y datos.
- Cliente HTTP y tipos compartidos conservados; `EpisodePage` mantiene
  su lógica propia según el alcance aprobado.
- Evidencia vigente: 46 pruebas frontend, lint y build aprobados;
  CI `37725349264` y CI documental `37725456535` aprobadas.
- Etapa 30 cerrada; cierre documental publicado en
  `9ed4dbfa4b23b2351f6eaa4958b0ca7eefca7f7d`, CI `37726240159` aprobada.
  Las entregas anteriores conservan su estado histórico.
- Sin cambios de código ni nuevas ejecuciones de pruebas.
  Propuesta 31A documentada, pendiente de autorización.

---

## Etapa 30I - Extracción de AppHeader

- Cabecera extraída a `frontend/src/components/AppHeader.tsx`, con usuario
  y callbacks de navegación y logout; sin estado propio.
- Botones, identidad, visibilidad por rol, textos y CSS conservados.
  Navegación, sesión y API permanecen en `App.tsx`.
- Cinco casos nuevos cubren botones visibles y callbacks por rol.
- Validación: 46 pruebas frontend, lint y build aprobados; diff revisado y
  `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin cambios de backend, cliente API, tipos compartidos, CSS ni dependencias.
- Entrega cerrada y publicada en el commit
  `a80d42c5394930579f43491ff47bfd57b11cc2f9`; CI `37725349264` aprobada.
  La Etapa 30 continúa abierta.

---

## Etapa 30H - Extracción de LoginPage

- Formulario de acceso y vista de restauración extraídos a
  `frontend/src/pages/LoginPage.tsx`, sin estado propio.
- Formulario, cinco usuarios demo, valores iniciales, textos y CSS conservados.
  Autenticación, restauración, token y errores permanecen en `App.tsx`.
- Tres casos nuevos cubren ingreso correcto y restauración correcta o fallida;
  se conservan las pruebas de formulario y credenciales rechazadas.
- Validación: 41 pruebas frontend, lint y build aprobados; diff revisado y
  `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin cambios de backend, cliente API, tipos compartidos, CSS ni dependencias.
- Entrega cerrada y publicada en el commit
  `18841e97464e3aa38ab91a0b98d88a6661abb93f`; CI `37724737074` aprobada.
  La Etapa 30 continúa abierta.

---

## Etapa 30G - Traslado de EpisodePage

- Componente existente movido de `App.tsx` a `frontend/src/pages/EpisodePage.tsx`.
- Props, estado local, llamadas API, permisos, formularios y presentación
  conservados. Sesión, navegación y episodio seleccionado siguen en `App.tsx`.
- Imports ajustados; cuerpo y props comparados con el original.
- Validación: 38 pruebas frontend, lint y build aprobados; diff revisado y
  `git diff --check` sin errores, incluido el archivo nuevo.
- Conservadas las pruebas ACTIVE/CLOSED por rol y de alta médica;
  sin comportamiento nuevo ni pruebas nuevas para este traslado.
- Sin cambios de backend, cliente API, tipos compartidos, CSS ni dependencias.
- Entrega cerrada y publicada en el commit
  `7cf60c706131da9f9f0e9207639e609989010ec7`; CI `37724043270` aprobada.
  La Etapa 30 continúa abierta.

---

## Etapa 30F - Extracción de SupervisorPage

- Centro de control del supervisor extraído a `frontend/src/pages/SupervisorPage.tsx`,
  con datos, filtro, mensaje, estado de evaluación y callbacks; sin estado propio.
- Indicadores, tabla, filtros, textos, acciones y CSS conservados.
  Estado, API, carga, errores, permisos y navegación permanecen en `App.tsx`.
- Seis casos nuevos cubren filtros, indicadores, apertura del episodio,
  actualización que restablece Todos y ausencia de acceso para otros roles.
- Conservadas las pruebas de evaluación explícita de reglas y errores.
- Validación: 38 pruebas frontend, lint y build aprobados.
- Sin cambios de backend, cliente API, tipos compartidos ni dependencias.
- Entrega cerrada y publicada en el commit
  `d700a5aa0e7acb0a398eadc11b7a9efc54086ebf`; CI `37723480808` aprobada.
  La Etapa 30 continúa abierta.

---

## Etapa 30E - Extracción de LaboratoryPage

- Bandeja «Órdenes pendientes» extraída a `frontend/src/pages/LaboratoryPage.tsx`,
  con `laboratoryQueue`, `onRefresh` y `onCompleteOrder`; sin estado propio.
- Contador, estado vacío, tarjetas, textos, CSS y validación conservados.
  API, carga, errores, permisos y navegación permanecen en `App.tsx`.
- Siete casos nuevos de integración cubren actualización, acceso por rol,
  publicación correcta y rechazo conservando formulario y resultado.
- Validación: 32 pruebas frontend, lint y build aprobados.
- Sin cambios de backend, cliente API, tipos compartidos ni dependencias.
- Entrega cerrada y publicada en el commit
  `e0cc198ff117d118aee39bc2a9afe46b658412cb`; CI `37721355298` aprobada
  con pruebas backend, frontend, lint y build.
  La Etapa 30 continúa abierta.

---

## Etapa 30D - Extracción de DashboardPage

- Centro de control general extraído a `frontend/src/pages/DashboardPage.tsx`.
  Recibe `dashboard`, `onRefresh` y `onOpenEpisode`, sin estado propio.
- Indicadores, cálculos, tabla, estado vacío, textos y CSS conservados.
  API, carga, errores, permisos y navegación permanecen en `App.tsx`.
- Dos pruebas de integración en `App.dashboard.test.tsx` cubren indicadores,
  exclusión de alertas resueltas y tareas completadas de sus conteos, apertura
  del episodio seleccionado y actualización desde el estado vacío.
- Sin cambios de backend, cliente API, tipos compartidos ni dependencias.
- Validación: 25 pruebas frontend, lint y build aprobados; diff revisado y
  `git diff --check` sin errores. Pruebas fuera del sandbox tras un fallo de
  acceso a un temporal; corregida una opción no admitida en la prueba nueva.
- Sin pruebas backend locales nuevas: extracción limitada al frontend.
- Entrega cerrada y publicada en el commit
  `3a4616125d3733168b60a8bafc1aacaf41b8b41d`; CI `37719496231` aprobada,
  según el resumen de continuidad. La Etapa 30 continúa abierta.

---

## Etapa 30C - Extracción de NewEpisodePage

- Pantalla «Registrar llegada» extraída a `frontend/src/pages/NewEpisodePage.tsx`,
  sin estado propio y con un callback `onSubmit` tipado para el formulario.
- Campos, textos, valores iniciales y estilos conservados. Creación del episodio,
  consulta API, errores, permisos y navegación permanecen en `App.tsx`.
- Dos pruebas de integración añadidas: ingreso correcto con apertura del episodio
  y actualización del dashboard; rechazo de la API conservando el formulario.
- Sin cambios de backend, cliente API, tipos compartidos ni dependencias.
- Validación: 23 pruebas frontend, lint y build aprobados; diff revisado y
  `git diff --check` sin errores. Sin pruebas backend nuevas: cambio de frontend.
- Entrega cerrada y publicada en el commit
  `466cc5efc592106e576db305747593a3ec726df5`; CI `37718612913` aprobada.
  La Etapa 30 continúa abierta.

---

## Etapa 30B - Extracción de ScanPage

- Pantalla «Escanear pulsera» extraída a `frontend/src/pages/ScanPage.tsx`,
  sin estado propio y con un callback `onSubmit` tipado para el formulario.
- Textos, campo obligatorio y clases CSS conservados. Consulta API, errores,
  permisos y navegación permanecen en `App.tsx`; sin cambios funcionales.
- Se conservan los casos existentes de apertura por token para los cinco roles
  y se añade una prueba del rechazo de la consulta que conserva el formulario.
- Validación final: 21 pruebas frontend, lint y build aprobados; diff revisado
  y `git diff --check` sin errores. La prueba nueva se corrigió para comprobar
  el mensaje visible del aviso existente, sin modificar la UI ni sus tiempos.
- Sin pruebas backend nuevas: extracción limitada al frontend.
- Entrega cerrada y publicada en el commit
  `37864c1a4dfd027c0796bb7aaaee846451c70b40`; CI `37717881092` aprobada.
  La Etapa 30 continúa abierta.

---

## Etapa 30A - Extracción de EpisodeHistoryPage

- Pantalla de historial extraída a `frontend/src/pages/EpisodeHistoryPage.tsx`.
  Recibe `historyData`, `onRefresh` y `onOpenEpisode`; reutiliza `HistoryData`
  y las clases CSS existentes.
- Estado, carga, errores, permisos, navegación y llamadas API permanecen en
  `App.tsx`. Se conservan textos, tabla, fechas, valores alternativos y acciones.
- Se conserva la prueba de consulta del historial después del alta y se añaden
  dos casos: historial vacío y actualización mediante una nueva consulta.
- Validación: 20 pruebas frontend, lint y build aprobados; diff revisado y
  `git diff --check` sin errores. Se conserva el build anterior al reinicio del
  equipo, sin cambios posteriores de código; pruebas y lint completados al
  retomar. No se ejecutaron pruebas backend para esta extracción de frontend.
- Entrega cerrada y publicada en el commit
  `a77970cfa653af7b72254573063f2d5445ed9ee3`; CI `37716248936` aprobada.
  La Etapa 30 continúa abierta.

---

## Etapa 29 - Nota de alta editable

- El médico dispone de un campo accesible «Nota de alta» únicamente en
  episodios ACTIVE. Empieza vacío y sustituye la afirmación fija de estabilidad.
- La UI exige contenido después de `trim` y envía la nota sin espacios en
  los extremos mediante el contrato existente `POST /episodes/{id}/discharge`.
- Durante la solicitud se bloquean campo y envío; una guarda evita solicitudes
  duplicadas. Ante errores de red y rechazos de la API se muestra el mensaje
  y se conserva el borrador para corregirlo o reintentar, mientras la sesión
  siga vigente y la pantalla permanezca abierta.
- Limitación aceptada de Etapa 29: HTTP 401 activa el flujo existente de
  expiración de sesión y recarga; el borrador se pierde. Tampoco persiste al
  navegar o recargar. El hallazgo se cierra como limitación aceptada, sin
  modificar la autenticación ni almacenar notas en localStorage/sessionStorage.
  Recuperar borradores durante reautenticación queda pendiente para una etapa
  independiente.
- La nota continúa almacenada en el evento DISCHARGE y puede consultarse en
  el timeline después del cierre y desde el historial. CLOSED sigue siendo
  de solo lectura; no cambian permisos, reglas clínicas ni contratos backend.
- Pruebas frontend de permisos/estado, nota vacía o con espacios, envío,
  auditoría posterior, error HTTP/de red, reintento y prevención de duplicados.
- Prueba backend existente ampliada para verificar que una nota personalizada
  con salto de línea se conserva exactamente en DISCHARGE y al consultar el
  episodio cerrado. Usa SQLite temporal; no se usa la DB clínica original.
- Validación: `scripts/validate.ps1` aprobado; backend 14 pruebas (tres
  advertencias conocidas), frontend 18 pruebas, lint y build aprobados.
  `git diff --check` sin errores y hash original de `clinical.db` conservado.
- Estas validaciones permanecen vigentes: el cierre del hallazgo HTTP 401
  modifica exclusivamente documentación, sin cambios de código ni pruebas.

---

## Etapa 28 - Validación funcional completada y episodios de solo lectura

### Corrección mediante TDD

- `EpisodePage` deriva `isClosed` y muestra el aviso accesible «Episodio
  cerrado — solo lectura» para episodios CLOSED.
- Oculta triaje, registro de vitales, transiciones de alertas y completar
  tareas cuando el episodio está cerrado. Evaluación médica, creación de
  órdenes y alta ya exigían ACTIVE; conservan sus permisos actuales.
- Mantiene identidad, vitales históricos, alertas e historial de transiciones,
  tareas pendientes y timeline, incluidos tareas completadas y resultados.
- No agrega llamadas HTTP ni modifica backend, endpoints, reglas clínicas,
  dependencias o workflows. El backend continúa bloqueando las mutaciones.
- Cinco casos parametrizados CLOSED fallaron primero por controles de escritura
  presentes y aviso ausente. Los mismos casos pasan tras la corrección; otros
  cinco verifican que ACTIVE conserva los controles existentes por rol.

### Protocolo y resultados

- Evidencias previas 28A–28E: smoke, autenticación y restauración de sesión,
  recepción, QR, triaje, vitales y alertas; evaluación médica, orden y resultado
  de laboratorio; supervisor de consulta y evaluación temporal explícita;
  resolución de alertas, alta, historial y rechazos posteriores al cierre.
- QA final EP-15: CLOSED, P2, tres alertas RESOLVED, una evaluación médica,
  una tarea LAB completada con resultado simulado y 17 eventos auditables.
- Los seis intentos de modificación posteriores al cierre de 28E devolvieron
  HTTP 409 sin cambios clínicos. Esa evidencia previa se conserva; no se
  repitieron mutaciones para esta corrección visual.
- Frontend: 14 pruebas aprobadas (antes 4). Backend: 14 aprobadas, con tres
  advertencias conocidas. Suite frontend, lint y build aprobados; una ejecución
  de `scripts/validate.ps1` aprobada.
- Captura desde historial con Chrome temporal y el snapshot QA cerrado:
  `.tmp/stage28-evidence/e28-closed-readonly-fixed.png`. Aviso visible,
  cero formularios/campos/botones de escritura en el detalle, datos históricos
  visibles. El verificador de red confundió OPTIONS con escritura después de
  guardar la captura; revisión del log confirmó solo GET, OPTIONS y login/logout.
- Perfil y servidores cerrados por PIDs exactos. DB original restaurada desde
  `clinical.before-stage28.db`, SHA-256
  `4EE9CF8ADE09D813715B750444DA8870E6E2CDB6FF6935FEC428C0A1F0756049`.
  Puertos 8000, 5173 y 9444 libres.
- Etapa 28 funcional completada. Limitación aceptada pendiente: la nota de alta
  sigue fija en UI («Alta médica; paciente estable»).

---

## Etapa 28B - Integridad al completar tareas

### Implementado

- `complete_task` ahora valida que el episodio asociado siga activo antes de
  modificar la tarea o registrar auditoria de finalizacion.
- Las tareas pendientes de episodios cerrados devuelven el rechazo de
  integridad existente: `409 El episodio está cerrado`.
- Al rechazar por episodio cerrado no se modifica la tarea, no se registra
  `TASK_COMPLETED` y no cambian los datos de cierre del episodio.
- Completar tareas de episodios activos conserva el comportamiento existente.
- Se mantiene separado del cambio del dashboard supervisor y de las reglas
  temporales explicitas.

### Verificacion

- Prueba backend de regresion para una tarea pendiente creada en un episodio
  activo y rechazada despues del alta.
- Se conservan contratos de `complete_task` para tarea inexistente, tarea ya
  completada y rol no autorizado.

### Proxima accion

- Reanudar las pruebas funcionales de Etapa 28.

---

## Etapa 28 - Reglas temporales explicitas

### Implementado

- El dashboard de supervisor queda como consulta de solo lectura.
- La evaluacion temporal se mantiene en `POST /rules/evaluate` como
  accion explicita para los roles medico y supervisor.
- El panel de supervisor incorpora el boton **Evaluar reglas temporales**.
- El boton **Actualizar indicadores** conserva solamente la consulta del
  dashboard.
- La idempotencia de alertas temporales se preserva: una segunda evaluacion
  no duplica alertas abiertas ni eventos `ALERT_CREATED`.
- No se modificaron reglas clinicas, umbrales, razones ni severidades.
- El defecto detectado en `complete_task` queda pendiente como correccion
  separada.

### Verificacion

- Prueba backend de regresion para confirmar que `GET /supervisor/dashboard`
  no modifica `alerts` ni `events`.
- Prueba backend para confirmar que `POST /rules/evaluate` conserva la
  evaluacion explicita y no duplica alertas.
- Pruebas frontend para los botones de supervisor, la llamada explicita a
  `POST /rules/evaluate`, la consulta posterior del dashboard y el manejo de
  errores visible.

---

## Etapa 1 — Base funcional

### Implementado

- Backend con FastAPI.
- Base de datos SQLite.
- Autenticación simple mediante token.
- Roles:
  - recepción;
  - enfermería;
  - médico;
  - laboratorio;
  - supervisor.
- Creación de pacientes.
- Creación de episodios clínicos activos.
- Generación de token aleatorio para pulsera QR.
- Dashboard de pacientes activos.
- Registro de eventos auditables.
- Cierre de episodio mediante alta médica.

### Verificación

- API disponible en `/docs`.
- Health check disponible en `/health`.
- Frontend compilado mediante Vite.
- Flujo manual verificado desde recepción hasta alta.

---

## Etapa 2 — Signos vitales y alertas

### Implementado

- Registro de:
  - temperatura;
  - frecuencia cardíaca;
  - presión arterial;
  - saturación de oxígeno;
  - frecuencia respiratoria.
- Motor de reglas clínicas inicial.
- Alerta por saturación baja.
- Alerta por frecuencia cardíaca alta.
- Alerta por fiebre alta.
- Estados de alerta:
  - ACTIVE;
  - ACKNOWLEDGED;
  - ESCALATED;
  - RESOLVED.
- Auditoría de acciones sobre alertas.

### Verificación

- Registro manual de signos anormales.
- Generación automática de tres alertas.
- Reconocimiento y escalamiento por enfermería.
- Resolución por médico.
- Eventos visibles en el timeline.

---

## Etapa 3 — Pruebas automáticas

### Implementado

- Prueba integral del flujo clínico.
- Prueba de permisos por rol.
- GitHub Actions.
- Compilación automática del frontend.
- Ejecución automática de pruebas del backend.

### Verificación

- Dos pruebas locales aprobadas.
- Workflow de GitHub Actions aprobado.
- Estado verde en la rama `main`.

---

## Etapa 4 — Triaje y asignación

### Implementado

- Formulario de triaje para enfermería y supervisor.
- Cambio de prioridad.
- Cambio de área o ubicación.
- Asignación de personal responsable.
- Evento `TRIAGE` en el timeline.

### Verificación

- Paciente movido a Área de choque.
- Prioridad actualizada a P1.
- Personal asignado a Enfermería A.
- GitHub Actions aprobado.

---

## Etapa 5 — Evaluación médica

### En desarrollo

- Registro de nota clínica.
- Registro de diagnóstico.
- Decisión médica:
  - continuar observación;
  - ordenar pruebas;
  - preparar alta.
- Evento `MEDICAL_EVALUATION` en el timeline.
- Restricción exclusiva para el rol médico.

### Verificación pendiente

- Prueba automática del endpoint.
- Formulario de evaluación médica en React.
- Compilación del frontend.
- GitHub Actions.

---

## Etapa 6 — Órdenes clínicas

### Implementado

- Formulario de órdenes exclusivo para el rol médico.
- Creación de órdenes para:
  - laboratorio;
  - enfermería;
  - equipo médico.
- Estado inicial `PENDING`.
- Visualización de la orden en tareas pendientes.
- Registro automático del evento `TASK_CREATED`.
- Asociación de cada orden con un episodio clínico activo.

### Flujo implementado

1. El médico abre un episodio activo.
2. Registra una evaluación médica.
3. Crea una orden clínica.
4. Selecciona el servicio responsable.
5. La orden aparece como tarea pendiente.
6. El evento queda registrado en el timeline.

### Verificación manual

- Se creó la orden `Hemograma completo`.
- La orden fue asignada al servicio `LAB`.
- La orden apareció en tareas pendientes.
- El evento `TASK_CREATED` apareció en el timeline.
- El frontend compiló correctamente.

### Próxima etapa

- Crear una bandeja exclusiva para laboratorio.
- Permitir registrar un resultado simulado.
- Completar la orden como usuario de laboratorio.
- Mostrar el resultado en el timeline.

---

## Etapa 7 — Bandeja de laboratorio

### Implementado

- Endpoint exclusivo para laboratorio y supervisor.
- Consulta de órdenes pendientes.
- Consulta de órdenes completadas.
- Filtro por estado:
  - `PENDING`;
  - `COMPLETED`;
  - `ALL`.
- Información operativa incluida:
  - paciente;
  - episodio;
  - prioridad;
  - ubicación;
  - orden;
  - resultado;
  - estado.
- Restricción de acceso para recepción, enfermería y médico.

### Decisión de seguridad

La bandeja no devuelve el token QR ni información clínica que no sea
necesaria para ejecutar la orden. El acceso se controla mediante roles.

### Verificación

- Endpoint `/lab/orders` visible en Swagger.
- Tres pruebas automáticas aprobadas.
- Acceso permitido para laboratorio y supervisor.
- Acceso rechazado para recepción.
- Bandeja React compilada correctamente.
- Orden pendiente visible para laboratorio.
- Resultado simulado publicado desde la interfaz.
- Orden retirada de pendientes después de completarse.
- Evento `TASK_COMPLETED` registrado en el timeline.

### Flujo validado

1. El médico crea una orden de laboratorio.
2. La orden queda con estado `PENDING`.
3. Laboratorio abre su bandeja.
4. Laboratorio registra un resultado.
5. La orden cambia a `COMPLETED`.
6. El resultado se conserva en la tarea.
7. La acción genera un evento auditable.

---

## Etapa 8 — Centro de control del supervisor

### Implementado
- Endpoint exclusivo para supervisor.
- Indicadores operacionales:
  - pacientes activos;
  - pacientes de prioridad alta;
  - pacientes en riesgo;
  - alertas abiertas;
  - tareas pendientes.
- Tiempo transcurrido desde el ingreso.
- Conteo de alertas por paciente.
- Conteo de tareas pendientes por paciente.
- Clasificación operacional de riesgo.
- Restricción de acceso por rol.

### Regla de riesgo inicial

Un paciente se considera en riesgo cuando:

- tiene prioridad P1 o P2; o
- tiene al menos una alerta sin resolver.

### Verificación

- Endpoint `/supervisor/dashboard` visible en Swagger.
- Acceso restringido al rol supervisor.
- Cuatro pruebas automáticas aprobadas.
- Indicadores operacionales visibles.
- Tiempo de espera calculado por paciente.
- Pacientes P1 y P2 identificados.
- Pacientes con alertas identificados.
- Conteo de tareas pendientes visible.
- Filtros operacionales funcionales.
- Acceso rápido al episodio desde la tabla.
- Frontend compilado correctamente.

### Filtros disponibles

- Todos los pacientes activos.
- Pacientes en riesgo.
- Pacientes con prioridad P1 o P2.
- Pacientes con alertas abiertas.

### Criterio inicial de riesgo

El indicador `REQUIERE ATENCIÓN` se muestra cuando:

- la prioridad es P1 o P2; o
- existe al menos una alerta sin resolver.

---

## Etapa 9 — Motor de reglas temporales

### Implementado

El motor evalúa todos los episodios activos y crea alertas
automáticas cuando detecta demoras operacionales.

### Reglas implementadas

#### Triaje demorado

- Condición: episodio activo sin evento `TRIAGE`.
- Umbral: más de 30 minutos desde el ingreso.
- Severidad: `HIGH`.
- Motivo: `Tiempo de espera de triaje excedido`.

#### Tarea pendiente excedida

- Condición: tarea con estado `PENDING`.
- Umbral: más de 60 minutos desde su creación.
- Severidad: `HIGH`.
- Motivo: `Tarea pendiente con tiempo excedido`.

#### Paciente prioritario sin actualización

- Condición: paciente con prioridad P1 o P2.
- Umbral: más de 15 minutos sin eventos clínicos u operacionales.
- Severidad: `CRITICAL`.
- Motivo: `Paciente prioritario sin actualización reciente`.

### Prevención de duplicados

Antes de crear una alerta, el motor comprueba que no exista otra
alerta abierta con el mismo motivo para el mismo episodio.

Una segunda ejecución no duplica alertas que continúan en estado
`ACTIVE`, `ACKNOWLEDGED` o `ESCALATED`.

### Eventos que no cuentan como seguimiento

Los eventos `ALERT_CREATED` generados por el propio motor no se
consideran una actualización clínica del paciente.

Esto evita que la generación automática de una alerta reinicie
incorrectamente el tiempo de seguimiento de un paciente prioritario.

### Auditoría

Cada alerta temporal genera el evento:

```text
ALERT_CREATED
```

El usuario técnico registrado es:

```text
time-rules-engine
```

### Formas de ejecución

- Ejecución manual mediante `POST /rules/evaluate`.
- Ejecución automática al abrir el panel del supervisor.

### Verificación

- Endpoint `/rules/evaluate` visible en Swagger.
- Regla de triaje demorado verificada.
- Regla de tarea pendiente excedida verificada.
- Regla de paciente prioritario sin actualización verificada.
- Prevención de duplicados verificada.
- Cinco pruebas automáticas aprobadas durante esta etapa.
- Resultado del motor visible en el panel del supervisor.

---

## Etapa 10 — Datos de demostración

### Implementado

- Generador de doce pacientes ficticios.
- Diez episodios activos.
- Dos episodios cerrados.
- Prioridades P1 a P5.
- Diferentes áreas y ubicaciones.
- Personal responsable asignado.
- Signos vitales ficticios.
- Alertas activas para pacientes prioritarios.
- Tareas de enfermería.
- Órdenes de laboratorio.
- Resultados simulados.
- Eventos auditables.
- Botón exclusivo para supervisor.

### Comportamiento aditivo

La carga de demostración conserva los pacientes creados manualmente.

No se eliminan:

- pacientes;
- episodios;
- alertas;
- tareas;
- eventos;
- resultados.

### Prevención de duplicados

Los pacientes ficticios utilizan documentos con el prefijo:

```text
DEMO-SEED-
```

Antes de crear datos, el servidor comprueba si ese prefijo ya existe.

Una segunda ejecución informa:

```text
Los datos de demostración ya existen
```

y no crea pacientes adicionales.

### Seguridad

- Solo el supervisor puede ejecutar `/demo/seed`.
- Recepción recibe una respuesta `403`.
- El endpoint no está disponible para enfermería, médico o laboratorio.

### Verificación

- Endpoint `/demo/seed` visible en Swagger.
- Se crean exactamente doce pacientes ficticios.
- Se conservan los pacientes creados manualmente.
- Se crean diez episodios activos.
- Se crean dos episodios cerrados.
- Una segunda ejecución no duplica datos.
- Seis pruebas automáticas aprobadas.
- El frontend compila correctamente.
- Los pacientes activos aparecen en el panel del supervisor.

---

## Etapa 11 — Manejo de sesión expirada

### Implementado

- Detección de respuestas HTTP `401`.
- Eliminación automática del token inválido.
- Aviso claro al usuario.
- Recarga automática de la aplicación.
- Retorno a la pantalla de inicio de sesión.
- Posibilidad de iniciar una sesión nueva.

### Motivo

Los tokens del demo se almacenan temporalmente en la memoria del
backend.

Cuando FastAPI se reinicia, los tokens emitidos anteriormente dejan
de existir. El navegador, sin embargo, puede conservar el token
anterior en `localStorage`.

Esto provocaba el mensaje:

```text
Sesión requerida
```

sin regresar automáticamente al login.

### Solución implementada

Cuando el cliente recibe una respuesta HTTP `401` y existe un token:

1. elimina el token de `localStorage`;
2. muestra el mensaje de sesión expirada;
3. recarga la aplicación;
4. presenta nuevamente la pantalla de login.

Las credenciales incorrectas durante el login continúan mostrando el
error normal de autenticación.

### Verificación

- Frontend compilado correctamente.
- Backend reiniciado manualmente.
- Respuesta `401` detectada por el cliente API.
- Token inválido eliminado de `localStorage`.
- Mensaje de sesión expirada mostrado.
- Retorno automático al login.
- Nuevo inicio de sesión realizado correctamente.

---

## Etapa 12 — Historial de episodios cerrados

### Implementado

- Endpoint `/episodes/history`.
- Consulta separada de la operación activa.
- Orden por fecha de cierre.
- Información incluida:
  - paciente;
  - documento;
  - prioridad;
  - ubicación final;
  - responsable;
  - fecha de ingreso;
  - fecha de cierre;
  - cantidad de eventos;
  - cantidad de alertas;
  - cantidad de tareas.
- Acceso para:
  - recepción;
  - médico;
  - supervisor.
- Acceso rechazado para enfermería y laboratorio.

### Objetivo

Permitir la consulta de episodios finalizados sin volver a activarlos
ni mezclarlos con el dashboard operacional.

### Verificación

- Endpoint `/episodes/history` visible en Swagger.
- Siete pruebas automáticas aprobadas.
- Acceso permitido para recepción, médico y supervisor.
- Acceso rechazado para enfermería.
- Pantalla de historial compilada correctamente.
- Nora Paz visible como episodio cerrado.
- Iván Soto visible como episodio cerrado.
- Timeline histórico disponible.
- Los episodios cerrados no aparecen en el dashboard activo.
- Los formularios clínicos quedan deshabilitados al estar cerrado.


---

## Etapa 13 — Historial visual de alertas

### Implementado

- Historial de cambios incluido dentro de cada alerta.
- Visualización separada de alertas activas y resueltas.
- Contador de alertas activas.
- Contador de alertas resueltas.
- Sección plegable para consultar las alertas resueltas.
- Sección plegable para consultar el historial de cada alerta.
- Visualización del estado anterior y el estado nuevo.
- Visualización del usuario responsable de cada transición.
- Visualización de la fecha y hora de cada transición.
- Las alertas resueltas permanecen disponibles para consulta.
- Las alertas resueltas no muestran botones de acción.

### Flujo validado

```text
ACTIVE → ACKNOWLEDGED → RESOLVED
```

El reconocimiento y la resolución quedan registrados como transiciones
independientes dentro del historial de la alerta.

Ejemplo:

```text
ACTIVE → ACKNOWLEDGED
medico · fecha y hora

ACKNOWLEDGED → RESOLVED
medico · fecha y hora
```

### Comportamiento de las acciones

- El botón `Reconocer` solamente aparece cuando la alerta está en estado
  `ACTIVE`.
- El botón `Escalar` aparece cuando la alerta está en estado `ACTIVE` o
  `ACKNOWLEDGED`.
- El botón `Resolver` solamente está disponible para médico o supervisor.
- Las alertas con estado `RESOLVED` se muestran en una sección separada y no
  permiten nuevas acciones desde la interfaz.

### Compatibilidad de fechas

La interfaz acepta las propiedades temporales:

```text
created_at
at
```

Esto permite mostrar el historial aunque el nombre de la columna temporal
difiera entre versiones de la base de datos.

### Diseño responsive

- Las transiciones se muestran como elementos separados.
- El usuario y la fecha aparecen debajo de cada cambio de estado.
- En pantallas pequeñas, los botones ocupan todo el ancho disponible.
- Los historiales pueden abrirse y cerrarse mediante elementos `details`.

### Verificación manual

Se confirmó que:

1. una alerta activa puede ser reconocida;
2. el historial muestra `ACTIVE → ACKNOWLEDGED`;
3. médico puede resolver la alerta;
4. el historial muestra `ACKNOWLEDGED → RESOLVED`;
5. la alerta resuelta se mueve a la sección `Alertas resueltas`;
6. el historial conserva el usuario y la fecha;
7. las secciones plegables pueden abrirse y cerrarse;
8. el frontend compila correctamente.

---

## Etapa 14 — Máquina de estados de alertas

### Implementado

Se agregó una máquina de estados para controlar las transiciones permitidas
de las alertas clínicas y operacionales.

### Transiciones permitidas

```text
ACTIVE → ACKNOWLEDGED
ACTIVE → ESCALATED
ACKNOWLEDGED → ESCALATED
ACKNOWLEDGED → RESOLVED
ESCALATED → RESOLVED

---

## Etapa 15 — Restauración y cierre de sesión

### Implementado

- Endpoint `GET /auth/me`.
- Endpoint `POST /auth/logout`.
- Validación del token almacenado al abrir la aplicación.
- Restauración automática del usuario y su rol.
- Pantalla temporal `Restaurando sesión`.
- Cierre de sesión en backend y frontend.
- Eliminación local del token al cerrar sesión.
- Limpieza de datos clínicos cargados al cerrar sesión.
- Retorno automático al login cuando el token deja de ser válido.

### Restauración

Cuando existe un token almacenado, el frontend consulta:

```text
GET /auth/me

---

## Etapa 16 — Usuarios persistentes y contraseñas protegidas

### Implementado

- Tabla `users` almacenada en SQLite.
- Nombre de usuario único.
- Rol persistente por usuario.
- Estado activo o inactivo.
- Contraseñas almacenadas mediante hash PBKDF2-SHA256.
- Sal aleatoria independiente para cada usuario.
- Comparación segura mediante `secrets.compare_digest`.
- Login conectado a la tabla `users`.
- Carga idempotente de los cinco usuarios de demostración.
- Migración SQL documentada en `backend/migrations/001_users.sql`.

### Estructura de usuario

Cada usuario almacena:

- `username`;
- `password_hash`;
- `password_salt`;
- `role`;
- `active`;
- `created_at`.

La contraseña original no se guarda en la tabla.

### Protección de contraseñas

El sistema utiliza:

```text
PBKDF2-HMAC-SHA256

---

## Etapa 17 — Sesiones persistentes con expiración

### Implementado

- Sesiones almacenadas en SQLite.
- Duración predeterminada de ocho horas.
- Token aleatorio entregado al navegador.
- Hash SHA-256 del token almacenado en la base de datos.
- Restauración de sesión después de reiniciar FastAPI.
- Revocación persistente al cerrar sesión.
- Invalidación automática de sesiones vencidas.
- Migración `backend/migrations/002_sessions.sql`.

### Seguridad

El token original no se almacena en SQLite. El servidor conserva:

- usuario asociado;
- hash del token;
- fecha de creación;
- fecha de expiración;
- fecha de revocación.

### Flujo

```text
Login
→ creación del token
→ almacenamiento de su hash
→ validación en cada petición
→ expiración o logout
→ revocación

---

## Etapa 18 — Integridad de episodios clínicos

### Implementado

- Función central para validar episodios activos.
- Rechazo de modificaciones sobre episodios cerrados.
- Prevención de altas repetidas.
- Prevención de tareas completadas más de una vez.
- Validación de rangos plausibles de signos vitales.
- Protección de triaje, signos, alertas, evaluaciones y órdenes.

### Operaciones bloqueadas después del alta

Un episodio con estado `CLOSED` no acepta:

- nuevo triaje;
- nuevos signos vitales;
- nuevas evaluaciones médicas;
- nuevas órdenes o tareas;
- finalización de tareas;
- cambios en alertas;
- una segunda alta.

Estas operaciones responden:

```text
409 El episodio está cerrado

---

## Etapa 19 — Ciclo de vida moderno de FastAPI

### Implementado

- Migración de `@app.on_event("startup")` a `lifespan`.
- Inicialización de SQLite durante el ciclo de vida de FastAPI.
- Compatibilidad con `TestClient`.
- Eliminación de advertencias deprecadas generadas por la aplicación.
- Conservación del comportamiento existente.

### Cambio técnico

El inicio anterior:

```python
@app.on_event("startup")
def startup() -> None:
    initialize_database()

    ---

## Etapa 20 — Pruebas automatizadas del frontend

### Implementado

- Vitest como ejecutor de pruebas.
- Entorno jsdom.
- React Testing Library.
- Extensiones de jest-dom.
- Simulación de interacción mediante user-event.
- Limpieza automática después de cada prueba.
- Comandos `npm run test` y `npm run test:watch`.
- Ejecución de pruebas frontend en GitHub Actions.

### Pruebas iniciales

Se verifica que:

- aparece la pantalla de inicio de sesión;
- aparecen los cinco roles;
- aparece el botón `Entrar`;
- los errores del backend se presentan al usuario;
- el formulario utiliza `/auth/login`.

### Resultado

```text
Test Files: 1 passed
Tests: 2 passed

---

## Etapa 21 — Tipado y saneamiento de ESLint

### Implementado

- Modelos TypeScript explícitos para datos clínicos y operacionales.
- Eliminación de todos los usos explícitos de `any`.
- Cliente API genérico con respuestas tipadas.
- Tipado del dashboard.
- Tipado de episodios, signos vitales, alertas y transiciones.
- Tipado de tareas y eventos.
- Tipado del panel de supervisor.
- Tipado de la bandeja de laboratorio.
- Tipado del historial de episodios.
- Reorganización de efectos de React.
- Integración de ESLint en GitHub Actions.

### Modelos añadidos

- `VitalSigns`;
- `ClinicalAlert`;
- `AlertHistoryEntry`;
- `ClinicalTask`;
- `TimelineEvent`;
- `Episode`;
- `DashboardData`;
- `SupervisorData`;
- `LaboratoryQueue`;
- `HistoryData`.

### Efectos de React

Los efectos de restauración y carga del dashboard ahora:

- realizan actualizaciones dentro de operaciones asíncronas;
- evitan actualizaciones después del desmontaje;
- utilizan una bandera `cancelled`;
- limpian correctamente sus operaciones.

### Resultado

```text
ESLint: 0 errores
Frontend: 2 pruebas aprobadas
Backend: 12 pruebas aprobadas
Build: aprobado

---

## Etapa 22 — Separación del cliente API y tipos frontend

### Implementado

- Cliente HTTP extraído desde `App.tsx` hacia `frontend/src/api/client.ts`.
- Contratos de dominio, API y datos clínicos extraídos hacia
  `frontend/src/types/clinical.ts`.
- Importación de modelos mediante `import type`.
- Conservación de `EpisodePageProps` en `App.tsx` por ser un tipo local de
  presentación del componente `EpisodePage`.
- Confirmación de que `client.ts` está correctamente codificado en UTF-8.
- Reducción de responsabilidades y tamaño de `App.tsx`.
- Conservación del comportamiento funcional existente.

### Resultado

```text
ESLint: 0 errores
Frontend: 2 pruebas aprobadas
Backend: 12 pruebas aprobadas
Build: aprobado
Advertencias backend: se mantienen únicamente las ya conocidas

---

## Etapa 23 - Validación local reproducible y tareas de VS Code

### Implementado

- Script `scripts/validate.ps1` para ejecutar la validación local completa en
  Windows.
- Resolución de la raíz del repositorio desde la ubicación del script.
- Uso del Python local `.\.venv\Scripts\python.exe`.
- Uso de `npm.cmd` para evitar bloqueos de PowerShell con `npm.ps1`.
- `PYTHONPATH` apuntando a `backend`.
- Directorio temporal controlado `.tmp\pytest` mediante `--basetemp`.
- Tareas de VS Code para validación completa, pruebas, lint, build e inicio
  local de backend y frontend.
- Exclusión de `.tmp/` en Git.

### Alcance

La etapa mejora la experiencia de desarrollo y la reproducibilidad local.
No cambia el comportamiento clínico ni operacional de la aplicación.

### Resultado

```text
Backend: 12 pruebas aprobadas
Frontend: 2 pruebas aprobadas
ESLint: 0 errores
Build: aprobado
```

---

## Etapa 24 - Mantenimiento preventivo de GitHub Actions

### Implementado

- Runner de CI fijado en `ubuntu-24.04` para evitar cambios implícitos durante
  la migración de `ubuntu-latest`.
- `actions/checkout` actualizado a `v5`, compatible con runtime Node 24.
- `actions/setup-python` actualizado a `v6`, compatible con runtime Node 24.
- `actions/setup-node` actualizado a `v5`, compatible con runtime Node 24.
- Python 3.12 conservado para backend.
- Node.js 22 conservado para frontend.
- Cachés, rutas de lockfiles y comandos de validación conservados.

### Alcance

Mantenimiento preventivo de CI ante la deprecación de Node 20 en GitHub
Actions. No cambia dependencias de aplicación ni comportamiento funcional.

---

## Etapa 25 - Modernización de setup-node

### Implementado

- `actions/setup-node` actualizado de `v5` a `v7`.
- Eliminación esperada de las advertencias internas `DEP0040` y `DEP0169`
  generadas por dependencias empaquetadas de la acción.
- Node.js 22 conservado para frontend.
- Cache npm conservada con `frontend/package-lock.json` como ruta de
  dependencia.
- Runner de CI conservado en `ubuntu-24.04`.

### Alcance

Mantenimiento de CI sin cambios funcionales en la aplicación. No se modifican
dependencias de frontend, dependencias de backend ni código de aplicación.

---

## Etapa 26 - Baseline seguro minimo de Codex

### Implementado

- Configuracion Codex minima versionada en `.codex/config.toml`.
- Aprobacion bajo demanda mediante `approval_policy = "on-request"`.
- Escritura limitada al workspace mediante `sandbox_mode = "workspace-write"`.
- Red desactivada dentro del sandbox mediante
  `sandbox_workspace_write.network_access = false`.
- Sin fijar opciones adicionales.

### Alcance

Baseline compartido de seguridad para Codex a nivel de proyecto. No cambia el
comportamiento funcional de la aplicacion ni modifica codigo, dependencias,
workflow o tareas de VS Code.

---

## Etapa 27 - Dependabot limitado a GitHub Actions

### Implementado

- Configuracion `.github/dependabot.yml` exclusiva para `github-actions`.
- Revision semanal de actualizaciones de acciones.
- Rama objetivo `main`.
- Limite de cinco pull requests abiertos para actualizaciones de version.
- Sin auto-merge.
- Sin ecosistemas `npm` ni `pip`.
- Sin configuracion de credenciales, registries privados, reviewers,
  assignees, labels o agrupaciones.

### Alcance

Mantenimiento automatizado y revisable de acciones oficiales de GitHub Actions.
No cambia el comportamiento funcional de la aplicacion, no actualiza acciones
existentes y no modifica dependencias de frontend o backend.


## Revisión integral posterior a la Etapa 61

- Informe docs/OPERATIONAL_FLOW_REVIEW.md: cobertura común, validaciones desiguales,
  pendientes de laboratorio tras cierre y decisiones de identidad/retención.
- Comprobación en memoria: seis modelos aceptan los casos inválidos descritos;
  sin peticiones clínicas ni modificación de base local. No se repitieron suites.
- Propuesta 62 transversal; sin implementación, commit ni push.


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

## Mantenimiento del flujo de trabajo y contexto

- Reglas en AGENTS.md para lecturas dirigidas, alcance comun entre modulos,
  reutilizacion de validaciones, diagnostico con evidencia y delegacion acotada.
- Bloques iniciales breves en PROJECT_STATUS y ROADMAP: estado, decisiones y
  fuentes. El historial existente se conserva; no se crean agentes ni se cambia
  el modelo, sus parametros, permisos, codigo de aplicacion o datos demo.
- Validacion documental: diff, estructura, enlaces locales y UTF-8. Las suites
  de 63 no se repiten porque no cambia codigo, contratos ni comandos.
- Mantenimiento y publicacion autorizados: commit, push y comprobacion de CI.
