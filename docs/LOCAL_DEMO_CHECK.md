# Prueba integral del demo en esta PC

## Objetivo y alcance acordado

El 17 de octubre de 2026 el usuario eligio seguir probando el demo en esta PC.
Comprobar un unico circuito por los cinco roles: ingreso, triaje/signos,
evaluacion/orden LAB, resultado, supervision, alta e historial. Esta guia no
acredita uso productivo; la correccion LAB detectada se documenta mas abajo. Las acciones las ejecuta el
usuario sobre un paciente ficticio; no borrar registros ni cargar otro lote demo.

Estado inicial: base publicada `797678e`, CI `39035455474` aprobada; etapa 65
cerrada. Se conservan 442 pruebas frontend, 185 backend, lint y build aprobados.
No se repiten suites para preparar esta guia. Frontend y GET /health comprobados
por HTTP 200 al preparar la prueba. Esto verifica disponibilidad, no restauracion.

## Revision y prioridad para el objetivo local

- La configuracion corresponde al demo: API con origen CORS localhost:5173,
  SQLite local y cuentas demo inicializadas al arrancar. La pantalla de acceso
  ofrece los cinco roles. No se cambia esa configuracion para esta prueba.
- Hay sesiones revocables, permisos por rol, transacciones, recibos, versiones,
  recuperacion de borradores y CI. Sus pruebas existentes son evidencia previa;
  la confirmacion manual del circuito y del ciclo de vida figura mas abajo.
- No se encontro procedimiento versionado de respaldo/restauracion en los
  archivos inspeccionados (scripts, CI, configuracion, migraciones y documentos).
  Si se desea conservar una base de pruebas como referencia, acordar despues
  un bloque de copia consistente y restauracion verificada en un destino aparte.
- Despliegue en red, TLS y cuentas reales quedan fuera del objetivo elegido.
  No se convierten en etapas inmediatas. Retencion de recibos sigue pospuesta
  segun la evidencia registrada en [WRITE_OPERATIONS](WRITE_OPERATIONS.md).

## Circuito con un paciente ficticio

Usar una sola ventana y cambiar de rol mediante Salir despues de cada guardado.
En cada fase verificar el mismo numero EP y esperar confirmacion de la accion.
Si aparece resultado por confirmar, consultar ese resultado antes de continuar.

1. Recepcion: Nuevo ingreso. Nombre Paciente Circuito Local 01, nacimiento
   1990-01-01 y documento DEMO-CIRCUITO-1710-01. Conservar prioridad P3 y ubicacion
   Recepcion. Crear episodio y pulsera. Anotar EP y verificar estado ACTIVE.
   Si ya existe esa identidad, revisar el episodio ofrecido antes de continuar;
   esta guia no autoriza abrir un segundo episodio activo para la misma identidad.
2. Enfermeria: abrir ese EP desde Centro de control. En triaje seleccionar P3,
   area Observacion y responsable Enfermeria de prueba. Guardar triaje y asignacion.
   Abrir Registrar nuevos signos. Usar temperatura 37, frecuencia cardiaca 80, sistolica
   120, diastolica 80, SpO2 98 y frecuencia respiratoria 16. Pulsar Guardar y evaluar
   reglas. Verificar ubicacion, responsable y un registro nuevo de signos.
3. Medico: abrir el mismo EP. Diagnostico Caso ficticio de prueba; nota Evaluacion
   ficticia para comprobar el demo. Sin uso clinico. Decision Continuar en
   observacion. Guardar evaluacion medica. Crear una orden titulada Prueba LAB
   ficticia con servicio Laboratorio, mediante Crear y asignar orden. Verificar
   una evaluacion nueva y una tarea LAB pendiente.
4. Laboratorio: abrir el EP y, en la orden LAB pendiente, pulsar Registrar
   resultado en laboratorio. Debe abrir Bandeja de laboratorio sin completar la
   orden. Localizar paciente y EP de la prueba. En Resultado de laboratorio escribir Resultado ficticio del circuito local.
   Pulsar Publicar resultado y completar. Verificar tarea completada y que ya no
   se ofrece publicar ese resultado como pendiente; la bandeja puede conservar
   otras tareas de pacientes anteriores.
5. Supervisor: Panel de supervisor. Localizar el EP activo, abrirlo y comprobar
   triaje, signos, evaluacion y orden completada. No cargar datos de demostracion.
6. Medico: abrir ese EP. Nota de alta Cierre ficticio del circuito local.
   Pulsar Cerrar episodio · Alta medica. Verificar CLOSED. Esta accion cierra
   exclusivamente el episodio de prueba; no realizar cambios en otros pacientes.
7. Recepcion o medico: Historial de episodios, localizar EP y Ver timeline.
   Verificar ingreso, triaje, signos, evaluacion, orden, resultado y alta en la
   linea de tiempo, con lectura del episodio cerrado. Confirmar que ya no aparece
   entre los episodios activos. El supervisor puede comprobarlo en su panel.

Los textos de ejemplo y valores numericos son exclusivamente datos ficticios de
prueba de interfaz, no indicaciones medicas. Las alertas temporales pueden variar
segun cuanto tarde el recorrido; su presencia no acredita por si sola un fallo.

## Resultado del circuito EP-17

- EP usado: EP-17, confirmado ACTIVE al ingreso.
- Ingreso: confirmado por el usuario.
- Enfermeria y signos: confirmado; se observaron valores predeterminados antes de guardar.
- Evaluacion y orden: confirmado por el usuario.
- Laboratorio: prueba corregida de resultado escrito confirmada por el usuario.
  La primera orden fue completada desde el acceso generico; se conserva. El
  usuario observo falta de consulta visible de completadas y pidio correcciones;
  ambos flujos estan implementados localmente y validados en pruebas automaticas.
  Consulta directa de Completadas confirmada: ordenes #13 y #14 de EP-17 visibles
  con sus resultados originales, sin editarlos.
- Supervisor: comprobado directamente en EP-17. El panel muestra triaje, signos,
  evaluacion, ambas ordenes completadas y la linea de tiempo; la bandeja LAB
  permite consultar resultados sin controles de publicacion o correccion.
- Alta e historial: el usuario confirmó EP-17 · CLOSED, el evento DISCHARGE con
  la nota Cierre ficticio del circuito local, su aparición en el listado
  histórico y las órdenes LAB #13 y #14 visibles en el detalle cerrado.

La pantalla del medico mostró el campo Nota de alta y el boton Cerrar episodio ·
Alta medica. La primera inspeccion posterior no encontró un alta guardada y
EP-17 seguía ACTIVE. El usuario repitió manualmente la acción y confirmó después
el encabezado CLOSED y el evento DISCHARGE con la nota esperada. No se reenviaron
operaciones desde herramientas. El usuario confirmó después el listado histórico
y las dos órdenes LAB en el detalle cerrado. Circuito manual completo.

Si falla una fase, registrar rol, EP, accion y mensaje, conservar campos y
revisar la causa compartida antes de proponer parches individuales por formulario.

## Prueba manual guiada de correcciones y anulaciones

El usuario opero los casos ficticios en la app; el agente solo dio pasos y
recibio las confirmaciones. No se modifico EP-17 para estas pruebas.

- EP-18, Paciente Cambios Demo A: evaluacion medica #117 corregida con valor
  anterior, nuevo y motivo visibles. Orden LAB #15 publicada, corregida y
  anulada: la bandeja la retiro de Completadas y la mostro PENDING; el historial
  conservo resultado original, rectificado y motivo de anulacion. El usuario
  confirmo que una nueva publicacion devolvio #15 a Completadas.
- EP-18: alta CLOSED con evento DISCHARGE #121; nota corregida en CLOSED sin
  borrar el original. Reapertura ACTIVE confirmada con evento EPISODE REOPENED
  y motivo. Cierre final CLOSED con nuevo DISCHARGE confirmado.
- EP-19, Paciente Cambios Demo B: ingreso sin actividad clinica anulado desde
  recepcion. El usuario confirmo ANNULLED y la linea de tiempo con ARRIVAL
  ANNULLED, motivo e ingreso original, y su presencia con estado ANNULLED
  en Historial de episodios.

Validacion automatica previa del bloque: backend 191/191, frontend 457/457
en 43 archivos, lint y build aprobados; las pruebas manuales no cambiaron
codigo. Commit/push del bloque local pendientes de autorizacion.

## Observacion y correccion durante EP-17

Usuario confirmo completar la primera orden LAB desde Tareas pendientes del detalle,
tras encontrar solo Completar y sin cuadro de resultado. Ese handler enviaba
Completada sin novedades; la orden dejo de figurar en pendientes. Se conserva ese
registro. No se completa ni se modifica ninguna orden desde herramientas.

Correccion autorizada e implementada localmente: tarea LAB lleva a la bandeja
para que Laboratorio escriba y publique el resultado; Supervisor consulta sin publicar;
recepcion, enfermeria y medico reciben indicacion. Handler generico excluye LAB.
API y finalizacion de NURSING/MEDICAL conservan sus contratos.

La reanudacion de EP-17 consistio en crear Prueba LAB ficticia - verificacion
sin alterar la primera orden, publicar Resultado ficticio del circuito local desde
Laboratorio y verificar Supervisor, alta e historial. El usuario confirmo ese
resultado; ambas ordenes completadas permanecen consultables.
