# Colas, responsables y relevo del demo

Implementacion publicada en `2accbe0` sobre `1dff835`; CI
[39894081075](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39894081075)
aprobada. Prueba guiada de EP-22 completada hasta el relevo.
[Alcance acordado](PATIENT_QUEUES_ASSIGNMENT_PLAN.md).

## Prueba guiada actual

Cuentas personales de enfermeria Consulta/Observacion y tres participaciones
confirmadas por usuario. Turno Demo Asignacion 02 iniciado (shift #2 ACTIVE).
Tres disponibilidades confirmadas. EP-22 ficticio: llegada, triaje, Consulta y
responsables medico/enfermeria confirmados por usuario. Ambos inicios propios
confirmados; cambio a Observacion conserva medico. Enfermeria de Consulta
permanece hasta propuesta aceptada por enfermeria de Observacion, cuyo inicio
nuevo queda registrado sin borrar el primer inicio de enfermeria.
Lectura SQLite confirma nueve cambios AREA/ASSIGN/START/PROPOSE/ACCEPT/START
para EP-22, integridad ok y sin referencias huerfanas. Usuario confirma en
UI PROPOSE/ACCEPT/START de Observacion. Paneles desplegables probados.
Al releer una asignacion confirmada por otra sesion, un formulario anterior
con campos queda deshabilitado y conservado. La cola ahora identifica ese
borrador y ofrece descartar solo sus campos. Pruebas dirigidas 18/18 y
lint/build aprobados; frontend completo 581/581 en 58 archivos aprobado.
Usuario confirma en UI aviso y descarte de un borrador sin envio. La ventana
original con el formulario deshabilitado expiro; su transicion esta cubierta
por prueba automatizada. Ninguna operacion clinica fue enviada al descartar.

## Comportamiento

- Colas y responsables ofrece cola compartida y filtro de cola propia/relevos
  entrantes, con filtro de area. La lista activa incluye episodios con triaje
  persistido; los episodios sin triaje siguen en el circuito de ingreso/triaje.
- Area de seguimiento se elige expresamente. No se deduce de Sala de espera,
  Consultorio 1 ni del texto asignado anterior, ni mueve la ubicacion fisica.
- Medico y enfermeria se confirman por separado mediante cuentas personales.
  El campo anterior assigned_to se conserva como referencia libre y no acredita
  responsabilidad confirmada. El detalle de episodio muestra ambas referencias.
- Lectura clinica compartida para perfiles clinicos; ACCOUNT_ADMIN no puede
  acceder. Coordinacion puede confirmar una cuenta valida, proponer relevo y
  resolver una excepcion. Cada profesional solo toma pacientes para su cuenta,
  inicia su propia atencion o acepta el relevo dirigido a esa cuenta.
- Enfermeria puede establecer el primer destino tras triaje sin responsables
  confirmados. Posteriores cambios de area requieren coordinacion o un
  responsable actual del episodio. No cambia prioridades ni responsabilidades.

## Sugerencia y carga

Orden de episodios: prioridad vigente y primer fin de triaje persistido, con ID
como desempate. Cambiar prioridad, actualizar pantalla o repetir triaje no
reinicia esa referencia. Pacientes en seguimiento siguen visibles, con su
inicio expresamente indicado; no se diagnostica abandono por una cifra de tiempo.

Solo son candidatos cuentas personales activas del rol, area activa compatible,
turno iniciado y disponibilidad confirmada. El reloj no inicia turnos. Orden:

1. Menos episodios activos P1/P2 asignados.
2. Menos tareas PENDING de la propia disciplina en esos episodios.
3. Menos episodios activos en total.
4. Asignacion confirmada mas antigua; quien nunca recibio va primero, luego ID.

Se muestran estos valores, desglose por prioridad y compromisos de relevo
entrantes separados. MEDICAL corresponde a medicina y NURSING a enfermeria;
LAB es dependencia visible del episodio, no tarea propia. Relevos propuestos
no cuentan como responsabilidad aceptada. No se inventan fechas de reevaluacion,
duraciones, topes o pesos clinicos. La comparacion es una heuristica del demo,
no demuestra cargas equivalentes. Coordinacion puede elegir otro candidato
valido con motivo auditado; no hay asignacion automatica.

## Asignacion, inicio y relevo

Confirmar responsable no inicia atencion ni publica una evaluacion. Solo la
cuenta responsable puede registrar su inicio, con turno y disponibilidad validos.
La falta de asignacion no bloquea los formularios clinicos de urgencia existentes.

Para sustituir responsable, proponer receptor disponible; el anterior conserva
responsabilidad hasta aceptar el receptor. Proponente, receptor y coordinacion
pueden cancelar/rechazar con motivo, conservando al anterior. La aceptacion se
revalida y el nuevo responsable confirma por separado su inicio. El primer inicio
historico de la disciplina no se borra al aceptar un relevo.

Consulta a Observacion mantiene normalmente al medico: puede conservar cobertura
con su turno/disponibilidad aunque su area profesional siga siendo Consulta.
Enfermeria anterior permanece responsable, con cobertura pendiente si su area
no coincide, hasta relevo aceptado por personal de Observacion. No se infiere
receptor ni se retiran pendientes por cambiar el area.

Coordinacion tiene una accion explicita Resolver excepcion: sustituye sin
aceptacion del receptor, con motivo, historial y comprobacion de elegibilidad.
No permite declarar disponible una cuenta inactiva, sin turno o de otro rol.
Se distingue de ACCEPT en auditoria (OVERRIDE).

Cerrar/anular episodio lo retira de la cola activa, conservando responsables
e historial. Finalizar turno o desactivar cuenta muestra cobertura pendiente;
no borra ni reasigna pacientes. Historial consultable por numero de episodio,
incluidos cerrados. Reabrir conserva responsabilidad y permite revisarla.

## Protecciones compartidas

Todas las escrituras requieren motivo, version e identificador idempotente.
Version incluye estado, responsables, disponibilidad y metricas de candidatos;
una recomendacion puede quedar antigua por cambios en otro episodio. Se exige
consultar y revisar antes de confirmar; nunca se elige otro receptor en silencio.
La autorizacion se revisa nuevamente dentro de la transaccion.

La version incluye la ultima secuencia clinica no QR y alertas abiertas. Cerrar
y reabrir, o cambiar prioridad y volver al valor previo, exige nueva revision
aunque parezca el mismo estado. Leer pulsera QR no invalida esa revision.
Alertas y desglose P1-P5 se presentan como contexto, sin nuevo peso clinico.

Auditoria separada care_changes: antes/despues, actor, motivo y accion. No crea
evaluaciones ni signos ficticios. Recibos resumen sin identificar el resultado
como detalle clinico por su ID. Consulta de recibos no reenvia. Tras recargar
se conserva solo referencia opaca, no contenido del formulario.

La actualizacion automatica se pausa con ediciones. Conflictos conservan campos,
filtros no desmontan formularios y cerrar/asignar desde otra sesion bloquea el
envio sin borrar texto local. Confirmacion tardia limpia solo si coincide con
campos originales. Historial y consultas descartan respuestas anteriores a una
solicitud mas reciente. Navegacion/recarga advierte sobre cambios sin guardar.

## Migracion y respaldo

Migracion 009 documenta care_schema, care_episodes, care_slots y care_changes;
se ejecuta transaccionalmente desde app/care.py. Primer triaje nuevo inserta
referencia y dos espacios vacios bajo la transaccion clinica existente.
No agrega permisos ni modifica columnas/filas anteriores.

Historicos con triaje reciben fecha del primer evento y marca historical=1.
Sin inferir area, responsables o inicio. La espera sin inicio se indica sin dato
fiable para esos historicos: una evaluacion anterior no equivale al nuevo hito
operacional. Tiempo desde ingreso y desde triaje se nombran separadamente.

Respaldo previo verificado: backups/clinical-20261021T231944Z-5c81937e.sqlite3.
SHA-256 c52527e31f8784397d31dee61b06e080cb6ab8b788b5e506dac635466d481baa.
Ensayo aislado en .tmp/care-migration-rehearsal-20261021.sqlite3: dos arranques
conservan todas las filas/columnas de 18 tablas anteriores, 20 pacientes y 21
episodios; integridad y referencias correctas. Se reconocen 15 episodios con
triaje y 30 espacios, cero areas/responsables inferidos y cero cambios de
responsabilidad de oficio. Fuente original intacta durante el ensayo.
Posteriormente usuario autoriza prueba guiada: demo iniciado y migracion aplicada.
Comprobacion posterior conserva todas las filas/columnas de 18 tablas previas,
20 pacientes/21 episodios e integridad/referencias correctas; 15 episodios con
triaje, 30 espacios vacios y cero areas/responsables inferidos al arrancar.

## Validacion y siguientes pasos

Dirigidas: 25 backend (10 colas + 15 respaldo); 18 frontend iniciales (colas,
navegacion, personal y cuentas). Suite completa backend 284/284, 660,57 s;
frontend 577/577 en 58 archivos, 517,00 s, lint/build aprobados.
Refuerzo posterior de versiones y contexto: 10 casos de colas revalidados;
el caso nuevo de cierre/reapertura y rutas afectadas pasan 44/44 en 111,23 s.
El caso nuevo omitio inicialmente el identificador ya obligatorio de reapertura;
se corrige solo la solicitud de prueba, manteniendo esa proteccion existente.
Cobertura acumulada backend: 285 casos. Frontend afectado 8/8, 6,55 s;
lint/build finales aprobados. No se repiten suites completas tras ajustes
acotados ni pruebas directas anteriores.
Prueba guiada completada hasta relevo de enfermeria e inicio propio en
Observacion. Usuario confirma paneles desplegables, disponibilidad y flujo;
no se comparten contrasenas. Turno #2 siguio ACTIVE tras su fin programado:
queda pendiente definir la politica de cierre antes de pruebas de campo.

Comandos de validacion ejecutados desde la raiz en PowerShell:

```powershell
$env:PYTHONPATH = 'backend'
.\.venv\Scripts\python.exe -m pytest -q --disable-warnings -x backend/tests --basetemp .tmp/pytest-care-full
$env:TEMP = (Join-Path (Get-Location) '.tmp/vitest-identity')
$env:TMP = $env:TEMP
npm.cmd run test --prefix frontend -- --maxWorkers=1
npm.cmd run lint --prefix frontend
npm.cmd run build --prefix frontend
```

No incluye protocolos nuevos de reevaluacion, integracion real de laboratorio,
reparto autonomo, red del centro ni validacion de treinta usuarios concurrentes.
