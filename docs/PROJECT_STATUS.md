# Estado del proyecto MedicControl+

## Estado actual (leer primero)

- Historial de planificacion y horarios: nueva mejora local autorizada. Linea
  de tiempo continua dentro de una seccion plegable, con eventos de todas las
  cuentas visibles para coordinacion en los ultimos siete dias (168 horas),
  hasta 50 recientes y enlace a registros completos con filtros y paginacion.
  Acciones comprensibles, tabla de campos modificados y sin JSON en pantalla.
  Fechas y entrada de horarios en 12 horas con AM/PM explicito, zona dominicana.
  Mantiene permisos: coordinacion consulta auditoria general; Mi turno sigue
  privado. No hay migracion ni cambios en registros clinicos o de auditoria.
  Dirigidas: 13 backend y 20 frontend, luego 6 de navegacion/respuestas tardias.
  Validacion actual completa: backend 289/289 (556,36 s), frontend 594/594
  en 61 archivos (283,88 s), lint y build aprobados. Backend usa un temporal
  nuevo dentro del repo para evitar el bloqueo previo de .tmp/pytest.
  Prueba guiada confirmada por el usuario: lectura continua y horas, acceso
  a registros completos, filtro de tipo/limpieza y campos AM/PM de inicio/fin.
  No se crearon turnos para esta comprobacion visual. Limite de siete dias,
  paginacion y permisos cuentan con cobertura automatica.
  Usuario autoriza crear el commit, publicarlo en origin/main y comprobar CI.
  Las validaciones locales y manuales anteriores corresponden a este bloque;
  el resultado remoto debe comprobarse en GitHub Actions tras el push.

- Turno vencido y extension: implementacion local con validacion completa
  aprobada y prueba guiada completada por el usuario (contador negativo,
  extension hasta 25/10/2026 20:00 y auditoria EXTEND revision 2 a 3). Un contador visible en coordinacion y Mi turno
  sigue en negativo al superar la hora programada y avisa sin bloquear tareas
  ni asignaciones. El coordinador confirmado puede ampliar la hora de fin de
  un turno ACTIVE con motivo, version y auditoria; se rechazan solapamientos
  con otras planificaciones del personal. Pruebas dirigidas: 2 backend y 10
  frontend aprobadas. Suite backend 287/287 antes de refinar el control de
  solapamiento de participaciones finalizadas; 2/2 afectadas despues.
  Frontend 585/585, lint y build aprobados. El script validate.ps1 encontro acceso denegado en su
  carpeta temporal anterior; se usó otra dentro del repo para la suite backend.
  Prueba visual posterior completada; publicacion autorizada junto con el
  historial de planificacion y los horarios AM/PM descritos arriba.

- Colas, responsables y relevo aceptado publicados en `2accbe0`; CI
  [39894081075](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39894081075)
  aprobada (backend, frontend, lint y build). `main` y `origin/main`
  sincronizados con arbol limpio al comprobar la publicacion. Prueba guiada de
  EP-22 completada hasta relevo e inicio de enfermeria de Observacion; historial
  e integridad comprobados. La politica de fin de turno se recoge arriba.

- Personal/areas/turnos publicados en `1dff835`; CI
  [39532858950](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39532858950)
  aprobada: backend, frontend, lint y build. Main limpia y sincronizada al
  comprobar publicacion; suites locales 270 backend/568 frontend conservadas.
  Prueba manual completa del recorrido y retirada de permiso confirmada abajo.
  Alcance autorizado con "Si, cont", implementado y validado localmente:
  [colas y asignacion asistida](PATIENT_QUEUES_ASSIGNMENT_PLAN.md).
  assigned_to conserva texto libre previo; nuevas relaciones separan medico y
  enfermeria por cuenta, sugerencia/confirmacion/inicio y relevo trazable.
  Usuario confirma enfermeria
  de Observacion con relevo aceptado, manteniendo al anterior hasta aceptar;
  medico normalmente se conserva. Criterio autorizado: prioridad/espera del
  paciente; candidatos elegibles por area;
  menos P1/P2 asignados, luego pendientes propios, total de episodios y rotacion
  en empates. LAB visible como dependencia, sin contar como tarea propia.
  Implementacion aditiva con cuatro tablas care_*, sin inferir cuentas del texto
  previo. Dirigidas ampliadas: 25 backend (10 colas + 15 respaldo), 18 frontend
  iniciales y 8 del archivo de colas tras caso adicional de respuestas tardias.
  Suite completa backend 284/284 (660,57 s), frontend 577/577 en 58 archivos
  (517,00 s). Refuerzo posterior: version incluye historial clinico no QR para
  impedir confirmar desde pantalla anterior a cierre/reapertura o prioridad
  que cambia y vuelve al valor anterior; alertas abiertas visibles como contexto.
  Diez casos de colas revalidados; nuevo caso y rutas afectadas 44/44 (111,23 s),
  cobertura acumulada backend 285 casos. Frontend afectado 8/8, lint/build
  finales aprobados. Sin repetir suites completas despues del ajuste acotado.
  Ensayo de migracion en copia, dos arranques: 18 tablas previas preservadas,
  20 pacientes/21 episodios, integridad/referencias correctas, 15 episodios con
  triaje y 30 espacios vacios; sin inferir area ni responsables. [Guia](PATIENT_QUEUES_ASSIGNMENT.md).
  Respaldo previo verificado:
  backups/clinical-20261021T231944Z-5c81937e.sqlite3 (20 pacientes/21 episodios).
  Usuario autoriza prueba guiada con "Si, cont": demo iniciado y migracion
  aplicada. Verificacion de solo lectura tras arranque conserva todas las
  filas/columnas de 18 tablas previas, 20 pacientes/21 episodios e integridad y
  referencias correctas. Quince episodios con triaje y 30 espacios vacios,
  ningun responsable/area inferido ni cambios de oficio. Prueba guiada en curso:
  usuario confirma las dos cuentas personales de enfermeria, coordinacion
  concedida y tres participaciones planificadas (medico/Consulta,
  enfermeria/Consulta y enfermeria/Observacion). Turno Demo Asignacion 02
  creado e iniciado, confirmado por historial shift #2 ACTIVE.
  Usuario pide reducir saturacion visual: paneles de areas, creacion de turno,
  turnos, profesionales, pacientes, disciplinas e historial plegados por defecto;
  encabezados conservan identificacion/estado y cerrar conserva formularios.
  Ajuste visual: 16 casos frontend afectados aprobados (6 personal, 9 colas,
  1 navegacion); lint/build aprobados. Sin repetir backend por este ajuste.
  Prueba guiada: tres disponibilidades confirmadas; EP-22 ficticio activo con
  triaje, area Consulta, medico.demo1 y enfermeria.consulta asignados. Aun no
  se ha confirmado el inicio del responsable. Una ventana de enfermeria vio
  datos anteriores, dejo un formulario de asignacion con campos y luego cargo
  la asignacion ya hecha por otra sesion. Ese borrador conservado en formulario
  ahora deshabilitado provocaba aviso generico al salir. Correccion local:
  identificar el formulario en la parte superior y ofrecer descarte explicito
  de solo sus campos fuera del bloque deshabilitado; no altera asignaciones.
  Reproduccion y rutas afectadas 18/18 frontend, lint/build aprobados;
  suite frontend completa 581/581 en 58 archivos aprobada. Backend sin cambios en este ajuste.
  Prueba manual reanudada tras caducar sesiones: servidor propio responde.
  EP-22 paso de Consulta a Observacion; medico.demo1 permanecio responsable;
  enfermeria.consulta siguio responsable hasta la aceptacion expresa del relevo
  por enfermeria.observacion. Ambos profesionales confirmaron su inicio propio.
  Lectura SQLite: responsable enfermeria.observacion sin relevo pendiente,
  inicio actual nuevo y primer inicio de enfermeria anterior conservado;
  cambios AREA/ASSIGN/START/PROPOSE/ACCEPT/START auditados. Integridad ok,
  cero referencias huerfanas. Usuario confirma en UI el historial
  PROPOSE/ACCEPT/START de enfermeria de Observacion. Usuario confirma en UI
  aviso de borrador, descarte solo de sus campos y desaparicion del aviso sin
  enviar operacion. Caso especifico de formulario deshabilitado cubierto por
  prueba automatizada; la ventana original expiro y no se repitio ese envio.
  Limite observado: turno #2 programado hasta 22/10 05:00 sigue ACTIVE
  despues de su horario, ya que el estado se cierra manualmente; las
  disponibilidades continuan figurando vigentes. Revisar politica de fin de
  turno antes de pruebas de campo.
  Bloque publicado en `2accbe0`; CI 39894081075 aprobada. Cambios nuevos
  requieren autorizacion de commit/push.

- Areas, turnos y coordinacion autorizados e implementados localmente sobre
  b2265c2; validacion completa aprobada. [Guia](STAFF_AREAS_SHIFTS.md).
  Administrador concede/retira permiso sin acceso a planificacion; coordinacion
  prepara areas/turnos, responsable explicito confirma disponibilidad y cierre,
  consulta propia para otros perfiles. Versiones, recibos y auditoria separados
  de episodios; sin colas ni reparto automatico de pacientes.
  Dirigidas: 25 backend de personal/cuentas (7 + 18 tras corregir expectativa
  nueva), 11 respaldo, 15 frontend de personal/cuentas/navegacion aprobadas.
  Suite completa backend 270/270 (541,14 s; una advertencia de dependencia
  ya conocida); frontend 568/568 en 56 archivos (431,01 s), lint y build
  aprobados. Un ajuste de tipo en el fixture nuevo resolvio el error inicial
  de build; el build posterior paso sin cambios de comportamiento.
  Migracion ensayada dos veces sobre respaldo restaurado: 14 tablas anteriores
  intactas, 20 pacientes/21 episodios, integridad y referencias correctas.
  Cuatro areas nuevas, cero turnos/participaciones/permisos automaticos.
  Usuario autorizo prueba manual con "Si, cont": demo iniciado y migracion
  aplicada. Comprobacion posterior conserva todas las filas/columnas previas
  de 14 tablas, 20 pacientes/21 episodios; integridad y referencias correctas.
  Al arrancar: cuatro areas, cero turnos/participaciones/cambios y ningun permiso concedido.
  Respaldo previo verificado:
  backups/clinical-20261020T030721Z-a0a848c2.sqlite3.
  Usuario confirma GRANT_COORDINATION de cuenta #8 por admin.demo (revision
  3 a 4), acceso a Personal y turnos y cuatro areas. Turno #1, Turno Demo
  Coordinacion 01, cerrado; participacion #1 de medico.demo1 en Consulta
  finalizada. Recorrido confirmado: PLAN, ACTIVE, AVAILABLE, UNAVAILABLE,
  FINISHED, CLOSED, con autor, motivo y valores anteriores/nuevos en auditoria.
  Usuario confirma REVOKE_COORDINATION, invalidacion de sesion anterior,
  nuevo acceso con Mi turno y consulta propia finalizada sin controles de
  planificacion. Verificacion posterior de solo lectura: cuenta activa sin
  permiso, turno #1 CLOSED, participacion #1 FINISHED; nueve tablas clinicas
  identicas al respaldo previo, 20 pacientes/21 episodios e integridad y
  referencias correctas. Prueba guiada del recorrido completada. Conflicto
  entre sesiones cubierto automaticamente, aun sin prueba manual especifica.
  Usuario autoriza crear commit, publicar en origin/main y comprobar CI con
  "Si, cont". Publicacion en preparacion al redactar este registro; consultar
  Git y la CI del SHA publicado al retomar, sin repetir validaciones locales.
  Siguiente decision funcional: alcance de colas por profesional y sugerencias
  de asignacion. Demo sigue iniciado.

- Cuentas personales publicadas en `b2265c2`; CI [39360417857](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39360417857)
  aprobada: backend, frontend, lint y build. Implementadas sobre ce16ed8: administrador
  separado ACCOUNT_ADMIN sin acceso clinico, alta local interactiva,
  crear/activar/desactivar/restablecer con auditoria, versiones, recibos y
  revocacion de sesiones. [Guia y limites](PERSONAL_ACCOUNTS.md).
  Cobertura backend 252 casos (19 conservados + 233 afectados/pendientes,
  384,52 s); frontend 560/560 en 54 archivos (361,50 s), lint y build aprobados.
  Dirigidas iniciales 31 backend/45 frontend; 21 dirigidas posteriores
  (5 nuevas de CLI + 16 cuentas) tras mejorar mensajes del alta inicial.
  Migracion ensayada en copia, preservando todas las filas; base activa
  migrada durante prueba autorizada. admin.demo activo, una sola alta
  BOOTSTRAP auditada; integridad/referencias correctas y 20 pacientes/21
  episodios conservados al comprobar alta. Respaldo previo:
  backups/clinical-20261020T021408Z-afc4d296.sqlite3.
  Usuario confirma prueba manual: interfaz administrativa separada, alta de
  medico.demo1 con auditoria, acceso medico sin gestion de cuentas;
  desactivacion revoca su sesion, reactivacion no revive tokens anteriores y
  permite nuevo acceso; restablecimiento revoca sesion, rechaza clave anterior
  y acepta la nueva. Chrome medico / Edge administrador. Demo iniciado.
  Main limpia y sincronizada al verificar publicacion. Siguiente alcance:
  [areas, turnos y coordinacion](STAFF_AREAS_SHIFTS_PLAN.md). Usuario eligio
  coordinacion para organizar personal; administrador solo concede/retira
  ese permiso. Implementacion local en validacion descrita arriba; sin reparto
  automatico de pacientes.

- Vista imprimible de pulsera publicada en `ce16ed8`; CI [39354682995](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39354682995)
  aprobada: backend, frontend, lint y build. Implementada sobre e04be5f, autorizada
  con prueba PDF sin impresora. Enfermeria/supervisor, episodio activo y triaje
  persistido; consulta identidad vigente al preparar e imprimir, mismo QR y
  aviso provisional. Sin registrar entrega ni mutar datos. [Guia y limites](WRISTBAND_PDF_DEMO.md).
  37 pruebas dirigidas aprobadas; suite frontend 553/553 en 53 archivos
  aprobada (287,32 s). 18 casos del componente tras ajuste final, lint sin
  advertencias y build aprobados.
  Usuario confirma vista previa correcta de EP-21 y aporta captura del PDF
  guardado y abierto: una pagina, datos legibles, QR completo y sin botones
  ni historia. Quedo encabezado del navegador (fecha/frontend); se indico
  desactivarlo. Usuario confirma lectura del QR desde ese PDF en Android:
  tras Identificar paciente abre Paciente Identidad Demo 21 / EP-21.
  ADB reconnect y reverse de 5173/8000 restablecidos; sin exponer a LAN.
  Impresion fisica pendiente por falta de equipo.
  Agente no opero la app. Publicacion comprobada con main limpia y sincronizada.
  Siguiente bloque propuesto: [cuentas personales](PERSONAL_ACCOUNTS_PLAN.md).
  Usuario eligio administrador separado con permiso propio, sin facultades
  clinicas por inferencia. Implementacion local y validacion en el bloque inicial.

- Identidad provisional publicada en `e04be5f`; CI [39349014853](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39349014853)
  aprobada: backend, frontend, lint y build. Implementada sobre 46a18b8:
  ingreso con datos desconocidos NULL, perfil archivo/ADMISSION, bandeja y
  confirmacion auditable conservando paciente/episodio/QR. Estados REGISTERED,
  PROVISIONAL y VERIFIED; no atribuye verificacion a datos anteriores.
  Reutiliza versiones, idempotencia, envios inciertos y borradores; sin fusion.
  [Alcance y limites](PROVISIONAL_IDENTITY.md). 33 pruebas backend y 67 frontend
  dirigidas aprobadas. Cobertura completa: 235 backend (118 + 117 pendientes),
  535 frontend (534 aprobadas en suite y fallo corregido, 11 casos afectados
  aprobados despues); lint y build aprobados. Respaldo local verificado
  y migracion aislada con 19 pacientes/20 episodios conservados. Usuario
  autorizo prueba manual guiada: demo iniciado, base activa migrada; integridad
  SQLite y referencias correctas, 19 pacientes/20 episodios conservados y
  archivo/ADMISSION disponible. Backend/frontend propios responden. Respaldo
  previo actualizado: backups/clinical-20261020T001127Z-b802453d.sqlite3,
  mismo SHA-256 que el ensayo. Usuario confirma prueba manual completa en
  EP-21: ingreso provisional sin datos inventados, identidad verificada por
  archivo, mismo episodio activo, auditoria con anterior/nuevo/fuente/motivo
  y autor; ya no aparece al actualizar pendientes. Main limpia y sincronizada
  al comprobar la publicacion. Siguiente propuesta: vista imprimible de pulsera
  para demo, sin afirmar entrega fisica ni compatibilidad con equipo pendiente.

- Lector QR publicado en `46a18b8`; CI [39195510597](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39195510597)
  aprobada en la publicacion: backend, frontend, lint y build. Activacion voluntaria,
  captura unica, confirmacion antes de consultar y entrada manual conservada.
  jsQR 1.4.0 decodifica localmente; cancela permisos tardios y libera recursos
  al salir/ocultar/cambiar sesion. Sin cambios backend ni red de campo.
  [Alcance y limites](QR_CAMERA_DEMO.md). 31 pruebas dirigidas iniciales y
  suite frontend final 521/521 en 50 archivos aprobadas (258,94 s), incluidos
  dos casos adicionales de cancelacion; lint, comprobacion dirigida tras
  ajuste de tipos en test y build aprobados. Usuario completo prueba fisica
  guiada en Redmi Note 11 / Android 13 / Chrome mediante ADB Wi-Fi y reverse
  de puertos: permiso, vista previa, cancelacion, captura unica con camara
  apagada y confirmacion explicita del mismo paciente/episodio activo.
  QR mostrado en pantalla de PC; tableta y pulsera impresa pendientes.
  Agente no opero la app. Retoma del 19 de octubre tras reinicio: Git limpio
  sobre 46a18b8 antes de actualizar estos documentos, sin diferencia con la
  referencia local origin/main; Status informa puertos 8000 y 5173 libres,
  sin respuesta HTTP. No se iniciaron servicios ni repitieron pruebas.
  Siguiente propuesta: identidad provisional y confirmacion auditable por
  admision/archivo, sin fusion; alcance en el plan del piloto.

- Demo de urgencias planificado para una tableta y piloto local de cinco hasta
  treinta: [alcance y decisiones](URGENCIAS_PILOT_PLAN.md). Complemento del
  expediente existente; laboratorio externo, fusion y expediente oficial
  requieren evaluacion separada.
- Subpaquete A publicado en `361d33c`; CI [39164657470](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39164657470)
  aprobada: backend, frontend, lint y build. Scripts/demo.ps1,
  demo_control.py, tareas VS Code Demo start/status/stop y [guia](DEMO_OPERATIONS.md).
  Solo loopback; identifica procesos por PID/creacion/ejecutable, no adopta
  servidores externos y conserva referencias ante errores. Start comprueba
  ambos puertos y revierte solo procesos creados en su intento. Stop fuerza
  terminacion del arbol propio: terminar/revisar guardados antes de usarlo.
  23 pruebas dirigidas aprobadas, con HTTP/procesos simulados y comprobaciones
  nativas de identidad/bloqueo Windows; suite backend 216/216 aprobada (439,95 s).
  Usuario completo prueba guiada: puerto ocupado rechazado sin adopcion,
  Start/Status propios y con respuesta, Stop, puertos libres, nuevo Start/Status
  y pantalla de acceso confirmada con captura. Servidores quedan iniciados
  segun ultima salida aportada. Sin pruebas clinicas adicionales.
  Usuario confirma que todavia no tiene tableta. Lector preparado en la
  entrega local posterior descrita arriba; prueba fisica pendiente.
  Identidad provisional e impresion siguen pendientes; no comprar equipos
  por inferencia.
  Inspeccion reviso el circuito completo a 84-168 h preliminares; detalle en
  el plan. Conservadas las modificaciones documentales previas.

- Buscador compartido validado sobre `ebc433b` y esta entrega en Centro de
  control, Historial, Supervisor y Laboratorio: palabras del nombre sin acentos
  ni distincion de mayusculas y EP exacto con o sin prefijo (20 o EP-20).
  Combina filtros, muestra coincidencias, limpia la consulta y conserva las
  metricas generales. Laboratorio oculta sin desmontar campos sin guardar;
  conserva resultados, correcciones y advertencias. Consulta local por pantalla,
  sin nuevas peticiones, persistencia de busqueda ni cambios de API o identidad.
  Validacion: 35 pruebas dirigidas y suite frontend 487/487 en 47 archivos
  aprobadas. Ajuste posterior del mensaje de Supervisor sin pacientes y un
  caso nuevo: 15/15 pruebas afectadas, lint y build aprobados; no se repitio
  la suite sin cambios. TEMP/TMP en `.tmp/vitest-search`.
  Backend sin cambios; conserva CI previa aprobada.
  Usuario confirmo prueba manual guiada como Supervisor: Historial con EP-20,
  Centro de control y filtros del Supervisor con EP-16, Laboratorio con EP-18
  y orden #15. Busquedas, ausencia de coincidencias, limpieza, metricas y
  conservacion de filtros comprobadas sin crear registros. Detalle en
  [LOCAL_DEMO_CHECK](LOCAL_DEMO_CHECK.md). Commit/publicacion autorizados el
  17 de octubre; resultado remoto en la [CI de main](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/workflows/ci.yml?query=branch%3Amain).
  Consultar antes de nuevas pruebas directas. Tras cerrar esta entrega,
  acordar otra necesidad concreta del demo.
- Prueba manual guiada de alertas completada por el usuario en EP-20:
  Enfermeria genero alerta critica por SpO2 ficticia de 90, reconocio y escalo;
  Medico resolvio; Supervisor confirmo tres transiciones y eventos con autores
  y fechas. Medico cerro EP-20 con nota de prueba. Resultado: Cerrado.
  Detalle en [LOCAL_DEMO_CHECK](LOCAL_DEMO_CHECK.md). Cierre publicado en
  `ebc433b`; CI [39076266889](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39076266889)
  aprobada: backend, frontend, lint y build.
- Lenguaje de interfaz en espanol publicado en `07050fc`; CI
  [39064241240](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39064241240)
  aprobada: backend, frontend, lint y build. Catalogo compartido para estados,
  roles, servicios, decisiones, severidad, eventos y correcciones, incluidos
  conflictos y borradores. Conserva API y notas originales. Validaciones previas:
  196 backend y 471 frontend en 45 archivos. Usuario confirmo consulta como
  Supervisor de cabecera, historial, eventos/correcciones de EP-18 y LAB #15.
- Respaldo publicado en `dcf2d7a`; CI
  [39062489007](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39062489007)
  aprobada: backend, frontend, lint y build. Copia consistente y restauracion
  aislada verificadas con 18 pacientes y 19 episodios. Copia adicional y SHA-256
  verificados en `D:\MedicControlPlus\backups`, unidad extraible en disco distinto
  del principal. La base activa no se sustituyo. Guias:
  [DEMO_DATABASE_BACKUP](DEMO_DATABASE_BACKUP.md) y
  [LOCAL_VALIDATION](LOCAL_VALIDATION.md).
- Bloque LAB y ciclo de vida publicado en
  `9a5bc84b3bcb12c6e63de7faeb6202ea255d09d3`; CI
  [39060204711](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39060204711)
  aprobada (backend, frontend, lint y build). Cierre documental posterior en
  `1b70ee0`, CI `39060586831` aprobada. Ambos en origin/main.

- Etapa 65 publicada y cerrada: recuperacion explicita de borradores tras recarga
  para los siete formularios, con aislamiento por API/usuario/rol, 30 minutos
  desde ultima edicion y descarte al guardar, descartar o cerrar sesion.
- Commit: `bb0220880f857d79f95e9ee7f5c1ec6e3ece18e0`.
  CI [39000263862](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39000263862)
  aprobada: backend, frontend, lint y build. Validacion local: 442 frontend en 41
  archivos, lint/build; backend sin cambios, 185 pruebas previas confirmadas en CI.
  Usuario confirmo recuperacion y descarte tras recarga del ingreso sin crearlo.
- Recibos revisados el 17 de octubre en modo solo lectura: 14 en base local,
  12 vencidos; busqueda indexada por usuario/clave. Archivo SQLite principal:
  114688 bytes en total. No hay evidencia local para priorizar un archivo ahora.
  Recomendacion: conservar recibos y reserva de claves; revisar retencion cuando
  volumen/mediciones o requisitos de operacion lo justifiquen. Detalle en
  [WRITE_OPERATIONS](WRITE_OPERATIONS.md). Sin cambios de API, datos ni esquema.
- Cierre documental y evaluacion de recibos publicados: `797678e375ad2d274cc031448bfa279d52b7d8d9`,
  CI `39035455474` aprobada. Git limpio al retomar sobre ese commit.
- Objetivo confirmado: demo en esta PC. Circuito directo en EP-17: ingreso,
  enfermeria/signos y evaluacion/orden confirmados. Laboratorio encontro un acceso
  que completaba LAB con texto generico desde el detalle; usuario lo pulso y la
  orden dejo de figurar pendiente. El usuario ya confirmo la prueba corregida de
  resultado escrito; Supervisor, alta e historial comprobados. Circuito manual
  de EP-17 completo dentro del alcance del demo local.
- Correccion LAB publicada en el bloque conjunto: Laboratorio abre la bandeja
  desde la tarea con Registrar resultado en laboratorio; Supervisor consulta;
  recepcion/enfermeria/medico reciben indicacion sin acceso de publicacion LAB.
  Handler generico excluye LAB. NURSING/MEDICAL conservan su comportamiento.
  Sin cambios de API, permisos servidor, datos ni orden ya completada.
- Validacion de la correccion sobre `797678e` y cambios locales: 55 casos
  dirigidos y 454 frontend en 41 archivos aprobados; lint y build aprobados.
  Comando de suite: npm.cmd run test --prefix frontend -- --maxWorkers=1.
  Backend sin cambios: conserva 185 pruebas y CI publicada.
  Integrada en el commit publicado del bloque conjunto.
- Prueba directa de la correccion LAB confirmada por el usuario.
- Bloque conjunto de ciclo de vida autorizado y publicado:
  consulta de ordenes LAB pendientes/completadas/todas y todas las tareas en
  episodio; historial de correcciones con original/motivo/autor/fecha; LAB
  corrige o anula resultados, medico rectifica/anula evaluaciones y notas de
  alta; medico o supervisor reabre altas; recepcion o supervisor anula ingresos
  sin actividad clinica. Anulacion logica, sin borrado fisico. CLOSED admite
  rectificaciones historicas sin reapertura implicita. Contratos nuevos exigen
  identificador de operacion e If-Match. Validacion final: backend 191/191;
  frontend 457/457 en 43 archivos; lint/build aprobados. Ajuste posterior de
  compatibilidad de versiones antiguas: 14 pruebas dirigidas aprobadas.
  Aviso de salida/recarga para correcciones sin guardar: 53 pruebas dirigidas,
  lint/build aprobados tras ese ajuste. Antes de publicar, suite frontend
  completa 457/457 en 43 archivos sobre el arbol actual: el primer intento
  fallo al cargar suites por ENOENT en temporales del sandbox; con TEMP/TMP
  en .tmp/vitest, una prueba dirigida y la suite completa aprobaron.
  Politica en
  [RECORD_LIFECYCLE_DESIGN](RECORD_LIFECYCLE_DESIGN.md).
  EP-17 no se altero desde herramientas; el usuario lo cerro manualmente.
  Consulta LAB y supervision comprobadas directamente. Las pruebas manuales
  guiadas del bloque se completaron en EP-18 y EP-19; detalle en
  [LOCAL_DEMO_CHECK](LOCAL_DEMO_CHECK.md). Publicado con CI aprobada.
  Despliegue productivo fuera del objetivo actual.
- Bandeja LAB comprobada directamente con el rol Laboratorio: el filtro
  Completadas devuelve las órdenes #13 y #14 de EP-17 y conserva ambos
  resultados. Se corrigió la presentación local para mostrar «Completadas y
  anuladas» justo bajo el filtro, sin bloques vacíos de pendientes delante.
  Suite frontend 457/457 en 43 archivos, lint y build aprobados después del
  ajuste. La consulta fue de solo lectura.
- Supervisor comprobado directamente en EP-17: ve triaje, signos, evaluación,
  las dos órdenes LAB completadas y sus eventos. En la bandeja Completadas
  consulta resultados sin controles de escritura. En esa inspección inicial,
  Médico tenía visible la nota y el botón de alta, y EP-17 seguía ACTIVE. El
  historial de otro episodio CLOSED se consultó sin cambios.
- El usuario repitió manualmente el alta de EP-17 y confirmó el encabezado
  CLOSED y el evento DISCHARGE con «Cierre ficticio del circuito local» en la
  línea de tiempo. La inspección anterior en modo lectura había encontrado
  ACTIVE, sin fecha, evento ni recibo de alta; no se reenviaron operaciones desde
  herramientas. El usuario confirmó después EP-17 en el listado histórico y
  ambas órdenes LAB visibles en su detalle cerrado.
- Prueba manual guiada de EP-18: evaluacion #117 corregida; orden LAB #15
  publicada, corregida, anulada, devuelta a PENDING y publicada de nuevo.
  Alta CLOSED, nota DISCHARGE #121 corregida en CLOSED, reapertura ACTIVE con
  evento auditable y cierre final CLOSED confirmados por el usuario.
- Prueba manual guiada de EP-19: ingreso sin actividad clinica anulado por
  recepcion; estado ANNULLED y evento ARRIVAL ANNULLED con motivo original
  y su presencia en Historial de episodios confirmados por el usuario.
  EP-17 permanece CLOSED, sin cambios de prueba.
- Preferencia del usuario: consultar antes de iniciar pruebas directas en la app.
  El usuario opero EP-18 y EP-19; el agente no ejecuto esas acciones.
  El bloque se publico con autorizacion expresa del usuario y CI aprobada.
- Forma de trabajo: un solo agente; no crear un revisor adicional.
- Servidores comprobados para esta prueba: frontend 5173 y API /health 8000,
  HTTP 200. Verificar al retomar; no asumir continuidad tras reinicio ni modificar datos demo.

Este bloque es la entrada al proyecto; el resto conserva antecedentes. Consultar
secciones concretas por necesidad y CHANGELOG solo para antecedentes relevantes.

## Historial y antecedentes (consulta por demanda)

Etapa 63 publicada y cerrada: separación de pendientes de laboratorio.
Validación frontend aprobada: 413/413 en 39 archivos, lint/build. Prueba directa aprobada. Commit `6c73956`; CI `38993035968` aprobada.

Etapa 62 publicada y cerrada: validación transversal de entradas; commit `99dac23`, CI `38328571734` aprobada.
Validación aprobada: 173 backend, 409 frontend, lint/build; prueba directa de ingreso aprobada.

### Etapa 61: presencia compartida por episodio

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

### Etapa 60: recuperación del registro local dañado

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

### Etapa 59: espera y cancelación comunes

- Implementación publicada: `099f4f3df5dd0600c2fd06a821612987a7b872e7`.
  CI inicial `38303379464` falló en siete pruebas por mensajes presentes tanto
  en el banner como en el panel. Consultas de pruebas ajustadas sin cambiar el
  producto: 99 pruebas dirigidas, lint/build aprobados. Corrección y cierre
  documental incluidos en la publicación autorizada. Corrección publicada:
  `15c13d955c7413ba4b5b867dcb8ac34b0760230e`; CI `38303904910` aprobada,
  con 143 pruebas backend (1 warning conocido), 363 frontend, lint y build.
  Etapa 59 cerrada dentro del alcance; cierre documental incluido.
- Alcance transversal autorizado e implementado localmente: un plazo de 30
  segundos cubre cabeceras y cuerpo de todas las solicitudes del cliente.
  Configurable con VITE_REQUEST_TIMEOUT_MS; valores inválidos usan 30000 ms.
- Vencimiento o cancelación durante una escritura mantiene clave, contenido en
  memoria y referencia; muestra resultado por confirmar, sin reenvío automático.
  Una señal ya cancelada no envía ni adquiere intención. El reintento explícito
  conserva contenido/clave/versiones y usa una señal de transporte nueva.
- Cambio de sesión interrumpe peticiones anteriores; respuestas tardías no
  consumen referencias ni afectan la sesión nueva. Cambios de token notificados
  por otra pestaña interrumpen la espera sin borrar el token nuevo.
- Logout conserva su petición de revocación al borrar la sesión local, con el
  mismo plazo y rechazo de respuestas antiguas; evita abortar su propio cierre.
- Libera bloqueos, permite continuar consultas de recibos y reanuda el sondeo
  después del plazo. Limpia temporizadores y listeners al terminar.
- Validación final: 362 pruebas frontend aprobadas en 35 archivos, incluidos
  21 casos nuevos; lint y build aprobados. Ejecución con un trabajador fuera del
  sandbox, sin ampliar tiempos: allí también pasaron las 77 pruebas de las suites
  afectadas por esperas locales. Comparaciones de reintento conservan cuerpo,
  cabeceras y clave, y ahora exigen una señal de transporte diferente.
- Backend, esquema y datos locales sin cambios: conserva las 143 pruebas y CI
  aprobadas de 58, sin repetirlas localmente. El usuario confirmó la consulta
  del recibo: operación confirmada sin otro registro, con actualización automática
  visible. En la repetición confirmó el aviso explícito de tiempo agotado y la
  consulta posterior del mismo intento sin crear otro registro;
  publicación autorizada y completada, con CI aprobada.
- Revisión de origen: [cobertura transversal 53–58](WRITE_FLOW_REVIEW.md).
- Ajuste posterior a la prueba directa: el panel mostraba texto genérico y
  ocultaba la causa registrada del fallo. Ahora muestra el mensaje del envío,
  incluido el tiempo agotado. Validación dirigida final: 12 pruebas aprobadas,
  con un caso nuevo de visibilidad; 363 casos distintos verificados (última
  suite completa: 362 antes de este ajuste). Lint/build finales aprobados.
  Prueba directa del aviso de plazo confirmada por el usuario tras el ajuste.

### Etapa 58: revisión de envíos tras recarga o reinicio

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

### Etapa 57: actualización común entre sesiones

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

### Etapa 56: revisión común de resultados inciertos

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

### Etapa 55: protección contra conflictos entre sesiones

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

### Etapa 54: recuperación común de formularios tras HTTP 401

- Alcance transversal implementado y publicado: ingreso, triaje,
  signos, evaluación, órdenes, resultado LAB y nota de alta.
- Un almacén de borradores y un hook compartidos reemplazan el flujo exclusivo
  de alta; captura común de campos, sin reenvío ni guardado automático.
- Memoria únicamente, oculta durante el login. Treinta minutos desde el primer
  401 pendiente; nuevas interrupciones antes de restaurar no renuevan el plazo.
- Misma identidad y rol. Consulta episodio ACTIVE antes de ofrecer y confirmar;
  laboratorio exige tarea LAB/PENDING y presencia actual en la bandeja.
- Limpieza por éxito confirmado, descarte, logout, salida del contexto y vencimiento.
  Conserva varios formularios; guardar uno no sobrescribe los demás. Respuestas
  tardías no reviven borradores descartados ni atraviesan un cambio de sesión.
- Recarga, cierre de pestaña y reinicio siguen fuera del alcance. No almacena
  campos clínicos en localStorage/sessionStorage ni en el servidor.
- Validación: 259 pruebas frontend (29 nuevas), lint y build aprobados. Pruebas
  con `--maxWorkers=1` y temporales locales. Backend sin cambios: se conserva la
  evidencia de 132 pruebas y CI aprobada de 53B, sin repetir esa validación.
- Publicada en `7e6c559b19043546a2e47269783d1f967e058b92`;
  CI `38257535035` aprobada: backend, frontend, lint y build.
- Prueba funcional directa de recuperación confirmada satisfactoria por el
  usuario. Confirmación manual del flujo solicitado; no sustituye la suite.
- Observación del usuario: dos sesiones pueden abrir y editar un mismo episodio.
  Siguiente propuesta: protección común contra cambios concurrentes (Etapa 55).

### Cierre de la Etapa 53

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

### Entrega 53B: escrituras atómicas e idempotencia compartida

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

### Entrega 53A: protección común de envíos pendientes

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

### Cierre de la Etapa 52

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

### Entrega 52A: errores junto a la alerta

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

### Cierre de la Etapa 51

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

### Entrega 51A: errores junto a la tarea

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

### Cierre de la Etapa 50

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

### Entrega 50A: bloqueo al completar tareas

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

### Cierre de la Etapa 49

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

### Entrega 49A: bloqueo de acciones por alerta

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

### Cierre de la Etapa 48

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

### Entrega 48A: mensajes de resultado en triaje y asignación

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

### Cierre de la Etapa 47

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

### Entrega 47A: bloqueo de envío de triaje y asignación

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

### Cierre de la Etapa 46

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

### Entrega 46A: mensajes de resultado en signos vitales

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

### Cierre de la Etapa 45

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

### Entrega 45A: bloqueo de envío de signos vitales

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

### Cierre de la Etapa 44

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

### Entrega 44A: errores junto al formulario

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

### Cierre de la Etapa 43

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

### Entrega 43A: confirmaciones de guardado médico

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

### Cierre de la Etapa 42

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

### Entrega 42A: aviso de orden clínica sin enviar

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

### Cierre de la Etapa 41

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

### Entrega 41A: aviso de evaluación médica sin guardar

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

### Cierre de la Etapa 40

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

### Entrega 40A: bloqueo de envíos médicos en curso

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

### Cierre de la Etapa 39

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

### Entrega 39A: conservar formularios ante envíos fallidos

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

### Cierre de la Etapa 38

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

### Entrega 38A: aviso de nota de alta sin enviar

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

### Cierre de la Etapa 37

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

### Entrega 37A: recuperación de nota de alta

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

### Etapa 36A: diseño de recuperación de nota de alta

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

### Revisión de cierre de Etapa 35

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

### Entrega 35B: rechazos en episodios cerrados

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

### Entrega 35A: matriz de permisos y tareas

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

### Entrega 34B: actualización de checkout y cierre

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

### Entrega 34A: actualización de setup-python

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

### Entrega 33K: composición final y revisión de cierre

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

### Entrega 33J: carga de datos demo

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

### Entrega 33I: evaluación de reglas temporales

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

### Entrega 33H: registro de episodios

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

### Entrega 33G: evaluación médica y alta

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

### Entrega 33F: triaje y signos vitales

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

37A permite recuperar la nota de alta tras HTTP 401 según identidad, plazo
y estado del episodio. 38A avisa antes de abandonar una nota sin enviar;
confirmar la salida, recargar o cerrar la pestaña siguen perdiendo el texto.
41A y 42A avisan antes de perder una evaluación u orden clínica sin guardar.
Su recuperación tras HTTP 401 y la de otros formularios siguen fuera del alcance.
No se almacenan notas clínicas en localStorage/sessionStorage ni en el backend.

La implementación de 37A está publicada y su CI aprobada.
El contrato backend no cambia: la exigencia de nota no vacía se aplica en
esta UI y el alta requiere una nueva acción explícita del médico.


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
