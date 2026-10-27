# Areas, turnos y coordinacion del demo

Publicado en 1dff835 sobre b2265c2. Recorrido manual guiado confirmado;
CI [39532858950](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39532858950)
aprobada: backend, frontend, lint y build. Main limpia/sincronizada al verificar.
No representa distribucion de pacientes.

## Accesos

- El administrador de cuentas concede o retira el permiso de coordinacion en
  una cuenta personal activa. Exige motivo y version; queda auditado y revoca
  todas sus sesiones. La persona debe iniciar sesion nuevamente.
- El permiso no cambia el perfil clinico. El administrador no accede a la
  planificacion; el supervisor tampoco coordina sin permiso explicito.
- Coordinacion accede a **Personal y turnos**. Los demas perfiles consultan
  **Mi turno**, exclusivamente su planificacion, sin auditoria ni edicion ajena.
- Las cuentas compartidas del demo no se planifican como profesionales ni
  reciben este permiso. Se planifican cuentas personales activas de medicina,
  enfermeria y laboratorio; el permiso puede recaer en otra cuenta personal
  del equipo, como recepcion, admision o supervision.

## Procedimiento

1. Revisar las cuatro areas iniciales: Triaje, Consulta, Observacion y
   Laboratorio. Pueden renombrarse, crearse o desactivarse con motivo. Un area
   con participaciones pendientes no puede desactivarse.
2. Crear un turno con nombre, inicio, fin y responsable de coordinacion activo.
   La pantalla usa hora dominicana, UTC-04:00, con fecha y hora de 12 horas.
   Selecciona AM o PM explicitamente: 12 AM es medianoche y 12 PM mediodia. Para cruzar medianoche se elige
   la fecha siguiente en el fin. Se persiste UTC.
3. Planificar profesionales y area. No duplica ni permite horarios solapados
   para una persona, incluso con solicitudes simultaneas. Turnos contiguos se
   permiten. La participacion cancelada libera ese horario; una terminada
   conserva su ocupacion historica. Cambiar el horario vuelve a comprobarlo.
4. El responsable inicia explicitamente el turno. Solo existe un turno activo
   de urgencias a la vez. El reloj y el inicio de sesion no lo activan.
5. El responsable confirma disponibilidad por persona: planificado pasa a
   disponible o cancelado; disponible pasa a no disponible o finalizado;
   no disponible pasa a disponible o finalizado. La disponibilidad requiere
   turno iniciado, cuenta y area activas. No se calcula presencia fisica.
6. Para cerrar, finalizar o cancelar explicitamente todas las participaciones
   pendientes. Cancelar un turno aun planificado cancela sus participaciones
   planificadas y audita cada una. Los estados terminales no se reabren.

Si un turno ACTIVE supera su fin programado, Personal y turnos y Mi turno
muestran un contador negativo y aviso. Es una advertencia, no un cierre ni
un bloqueo de las tareas o asignaciones. El coordinador confirmado puede
usar **Extender horario del turno** para registrar una hora posterior y el
motivo, con control de version y auditoria. La extension se rechaza si solapa
otra planificacion no cancelada de los profesionales del turno. Si el turno ha
terminado, se finalizan sus participaciones, se cierra y se inicia el relevo.
La extension del turno no acredita horas extra laborales individuales.

Cualquier cuenta con permiso puede preparar turnos futuros. Solo el responsable
confirmado cambia estados o incorpora profesionales al turno activo. Otra
cuenta autorizada puede **Asumir coordinacion de este turno**, con motivo,
version y auditoria del responsable anterior. Permite suplencia si se retira
el permiso o se desactiva al responsable anterior; no es una transferencia de
pacientes ni acredita entrega clinica.

## Conflictos, auditoria y recuperacion

Todas las escrituras reutilizan transaccion, identificador de operacion y
comprobacion de sesion del sistema. Las actualizaciones exigen version actual.
Ante conflicto se conservan los campos y se exige revisar la nueva version.
La consulta automatica se pausa mientras se edita; cambiar filtros conserva
los formularios. Navegar o recargar con cambios solicita confirmacion.

Un resultado incierto se consulta o reintenta desde el panel compartido.
Consultar no reenvia; un recibo tardio solo limpia campos que aun coinciden
con el envio original. Tras recargar solo se conserva la referencia, no el
contenido del formulario. No se guardan borradores operacionales en disco.
Retirar coordinacion impide consultar recibos anteriores de planificacion.

El historial operacional conserva antes/despues, autor y motivo, separado de
la linea de tiempo clinica. No se modifican ubicacion, assigned_to, pacientes,
evaluaciones, resultados ni alertas al planificar o finalizar turnos.

## Migracion y prueba pendiente

La migracion transaccional e idempotente de app/staffing.py agrega
users.can_coordinate=0 y cuatro tablas: staff_areas, staff_shifts,
staff_assignments y staff_changes. No concede permisos ni crea turnos de oficio.
Solo si el catalogo no existia agrega las cuatro areas; renombrarlas no las
recrea en el siguiente arranque. SQL documentado en migracion 008.

Respaldo previo verificado:
backups/clinical-20261020T030721Z-a0a848c2.sqlite3,
SHA-256 0a0b0f27095ecde8cc7e8569ffb140136ff04da50a779731e92da9630f45bcac.
Ensayo restaurado en .tmp/staff-migration-rehearsal-20261020.sqlite3:
dos arranques conservan todas las filas/columnas anteriores de 14 tablas,
20 pacientes y 21 episodios; integridad y referencias correctas, cuatro areas,
cero turnos/participaciones/cambios y cero permisos concedidos.
Base original conservada durante el ensayo. Posteriormente el usuario autorizo
la prueba manual con "Si, cont": demo iniciado y migracion aplicada, conservando
todas las filas/columnas anteriores de las 14 tablas. Integridad/referencias
correctas, 20 pacientes/21 episodios, cuatro areas y ningun permiso concedido.

Prueba manual guiada: usuario confirma concesion a medico.demo1 por admin.demo
(GRANT_COORDINATION, cuenta #8, revision 3 a 4), nuevo acceso y cuatro areas.
Turno #1, Turno Demo Coordinacion 01: planificado, iniciado y cerrado.
Participacion #1 del medico en Consulta: planificada, disponible, no disponible
y finalizada. Usuario aporta auditoria completa con autor, motivo y valores
anteriores/nuevos; cierre registrado en 2026-10-21T02:14:48.300526+00:00.
Usuario confirma REVOKE_COORDINATION, sesion anterior invalidada y nuevo
acceso con Mi turno: participacion finalizada, disponibilidad No y ausencia
de controles para crear o modificar planificacion. Recorrido guiado completado.
Comprobacion posterior de solo lectura: cuenta activa sin permiso, turno #1
CLOSED y participacion #1 FINISHED; nueve tablas clinicas identicas al respaldo,
20 pacientes/21 episodios e integridad/referencias correctas. Conflicto entre
sesiones cubierto por pruebas automaticas; no se realizo ensayo manual especifico.

## Limites

Sin recurrencias, nomina, asignacion por especialidad, colas individuales,
calculo de carga, asignacion automatica ni entrega de pacientes entre turnos.
Las horas previstas no desactivan disponibilidad automaticamente: el demo
depende de confirmaciones operacionales. La validacion real del centro y la
capacidad de treinta usuarios siguen pendientes.

## Validacion local

Sobre b2265c2 mas este diff: backend 270/270, 541,14 s, con una advertencia
de dependencia ya conocida; frontend 568/568 en 56 archivos, 431,01 s.
Lint y build aprobados. Comandos desde la raiz en PowerShell:

```powershell
$env:PYTHONPATH = 'backend'
.\.venv\Scripts\python.exe -m pytest -q --disable-warnings -x backend/tests --basetemp .tmp/pytest-staff-full
$env:TEMP = (Join-Path (Get-Location) '.tmp/vitest-identity')
$env:TMP = $env:TEMP
npm.cmd run test --prefix frontend -- --maxWorkers=1
npm.cmd run lint --prefix frontend
npm.cmd run build --prefix frontend
```

No se repiten pruebas directas de QR, identidad o impresion previamente
confirmadas. Publicacion y CI completadas en 1dff835; siguiente propuesta:
[colas y asignacion asistida](PATIENT_QUEUES_ASSIGNMENT_PLAN.md).

Referencias: [alcance acordado](STAFF_AREAS_SHIFTS_PLAN.md),
[cuentas personales](PERSONAL_ACCOUNTS.md), [estado](PROJECT_STATUS.md).

## Historial de planificacion (mejora local)

La seccion reciente permanece plegable; al abrirla los eventos se leen en una
linea de tiempo continua, con cambios y motivo visibles sin abrir cada evento.
Se consultan los ultimos siete dias (168 horas respecto al reloj del servidor),
de todas las cuentas incluidas en el permiso de coordinacion. La pantalla
muestra hasta 50 eventos recientes y avisa si hay mas.

**Ver todos los registros** abre una pagina independiente. Admite fechas
inicial/final inclusivas en hora dominicana, turno, participaciones de un
profesional y tipo de cambio. Cada pagina contiene 20 eventos, ordenados por
fecha descendente e identificador para desempatar. Incluye profesionales
inactivos en los filtros si tienen participaciones historicas. Las lecturas
no alteran la auditoria y no exponen JSON en la interfaz. La API permite
hasta 50 eventos por solicitud. Ambos accesos requieren coordinacion;
Mi turno conserva exclusivamente la planificacion propia.

El paso a la pagina completa respeta el aviso de campos sin guardar. El
historial se actualiza cada 15 segundos con la pestana visible; los resultados
anteriores a un cambio de filtros o sesion no sustituyen la consulta actual.
