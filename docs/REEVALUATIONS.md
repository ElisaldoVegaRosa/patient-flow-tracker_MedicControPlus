# Reevaluaciones individuales del demo

Implementacion local autorizada. No autoriza commit, push ni pruebas directas
de la app. Los datos y ejemplos de comprobacion son ficticios.

## Decisiones confirmadas

- El medico decide el momento y el contenido por paciente, sin intervalos
  clinicos automaticos por prioridad.
- Puede elegir fecha/hora exactas en 12 horas con AM/PM o dentro de X minutos.
  La vista previa muestra el instante dominicano que se guardara, incluidos
  segundos. El momento se mantiene fijo al editar otros campos y reintentar;
  cambiar los minutos lo recalcula. Si ya paso, el servidor exige revisarlo.
- Puede indicar una accion MEDICAL, una NURSING o ambas. Si son ambas,
  pertenecen al mismo seguimiento y se resuelven de forma independiente.
- Cada accion tiene fecha, estado, instruccion y responsable actual de su
  disciplina. Solo ese responsable puede registrar su realizacion, con nota
  y motivo. Proponer relevo no transfiere responsabilidad; aceptarlo si.
- El medico puede reprogramar o cancelar una accion pendiente con motivo.
  No se modifica el plazo ni el estado de su accion hermana.
- El alta se rechaza mientras quede alguna reevaluacion pendiente: debe
  realizarse o cancelarse expresamente con motivo. La comprobacion es atomica
  junto con el cierre; una pantalla antigua requiere revision de version.
- Consultar avisos, aceptar una responsabilidad o esperar a la hora prevista
  no completa una accion. Registrar realizacion no crea signos ni evaluacion
  medica automaticamente: se documentan en sus secciones correspondientes.
- Fuera de turno no se bloquea cumplir la responsabilidad que se conserva.
  Una transferencia aceptada invalida el formulario del responsable anterior.

## Presentacion y acceso

Reevaluaciones programadas aparece en el episodio. Programacion, reprogramacion
y cancelacion son acciones medicas; realizacion exige rol y responsabilidad
confirmada. No se conceden facultades clinicas por tener coordinacion.
Sin responsable, el pendiente sigue visible y requiere confirmar cobertura.

Las colas muestran pendientes y vencidas incluso con el paciente plegado;
al abrirlo se consultan instrucciones, fechas y responsables. La vista del
episodio y los historiales conservan autores, motivo, notas y cambios de fecha
o estado. No se muestra JSON. Los controles con campos locales se mantienen
para consulta y descarte si otra sesion invalida la accion.

Los vencimientos se calculan al leer o mostrar la fecha, sin escribir por
consultarlos. La regla generica de tareas pendientes por mas de 60 minutos
excluye las acciones programadas: rige su fecha individual. Las reglas previas
de otros tipos de alertas conservan su comportamiento.

## Contratos y persistencia

- POST /episodes/{episode_id}/reevaluations: titulo, medical_instruction y/o
  nursing_instruction, due_at con zona horaria y motivo. Requiere If-Match de
  clinical_version, episodio activo, medico e Idempotency-Key.
- POST /reevaluations/{task_id}/complete: completion_note y motivo.
- POST /reevaluations/{task_id}/reschedule: due_at futuro y motivo.
- POST /reevaluations/{task_id}/cancel: motivo.
- Las tres acciones exigen version individual e Idempotency-Key. Sus versiones
  incluyen revision, estado del episodio y responsable confirmado; el reloj no
  entra en la version. Un plazo que cambia y vuelve al valor previo sigue
  invalidando pantallas antiguas.
- La finalizacion generica de tareas rechaza estas acciones. No sirve para
  eludir la responsabilidad ni la nota de realizacion.

Tres tablas nuevas: reevaluation_groups, reevaluation_actions y
reevaluation_changes. Las acciones enlazan tareas existentes MEDICAL/NURSING
para que se contabilicen una sola vez en carga y pendientes. No se alteran
columnas de tablas anteriores ni se infieren vencimientos o responsables.
La migracion es transaccional y repetible. Su esquema se documenta en
[010_reevaluations.sql](../backend/migrations/010_reevaluations.sql).

El respaldo captura todas las tablas y exige el conjunto completo si aparece
alguna de las tablas de reevaluacion. Los respaldos anteriores sin este bloque
siguen siendo validos. No se sustituye automaticamente la base activa.

## Validacion y ensayo

Pruebas dirigidas de programacion, acciones independientes, permisos, versiones,
idempotencia, relevo, alta concurrente, migracion y respaldo. Frontend cubre
hora exacta/relativa, vista previa fija, reinicio de campos, conflictos,
vencimiento, bloqueo de alta y resumen visible en colas.

Resultados: backend 298/298 (598,26 s). Frontend: primera suite completa
595/600 (304,48 s), cinco fallos explicados por el aviso vacio de programacion
que se anunciaba como status junto al alta. Se corrigio la causa comun y se
revalidaron las 82 pruebas de los tres archivos afectados, incluidos esos cinco
casos (54,84 s). Las demas pruebas no se repitieron. Lint/build finales aprobados.

Ensayo aislado confirmado: migracion aplicada dos veces preservando 22 tablas
previas y 21 pacientes/22 episodios; integridad y referencias correctas, nuevas
tablas vacias. Respaldo previo verificado:
backups/clinical-20261027T003912Z-4a39cc9d.sqlite3.

Usuario autoriza iniciar la prueba manual guiada. Demo reiniciado y migracion
aplicada: las 22 tablas anteriores conservan filas y columnas; integridad y
referencias correctas, tres tablas nuevas vacias. Respaldo actualizado verificado:
backups/clinical-20261027T005526Z-0a8ddc59.sqlite3. EP-22 ACTIVE conserva medico.demo1
y enfermeria.observacion. No se ha operado automaticamente la interfaz.
Prueba manual guiada completada y confirmada por el usuario en EP-22:

- Programacion relativa a cinco minutos: dos acciones vinculadas con la misma
  hora. Medicina realizada y enfermeria pendiente mantienen el alta bloqueada.
- Medico reprograma exclusivamente enfermeria; se conserva la accion medica
  realizada y su hora. Enfermeria.observacion realiza su propia accion.
- Con ambas realizadas desaparece el mensaje de pendientes y se habilita alta.
- Una segunda programacion solo medica se cancela con motivo. El estado queda
  Cancelada y el alta vuelve a estar disponible, sin cerrar el episodio.
- Historial conserva cancelacion y motivo con medico.demo1, realizacion con
  enfermeria.observacion y reprogramacion con fecha anterior/nueva.
- Usuario confirma que fecha exacta ocupa su fila sin invadir hora/minutos/AM-PM,
  y que el boton deshabilitado queda gris y sin hover. Ajustes CSS comunes;
  17 y 5 pruebas afectadas, lint/build aprobados despues de los ajustes.

Edge mostraba una interfaz anterior (eventos nuevos como codigo no reconocido
sin seccion de reevaluacion). Se comprobo que localhost:5173 servia los modulos
actuales; Ctrl+Shift+R recupero la seccion correcta. No se ampliaron permisos
ni se modificaron registros para resolver esa presentacion.

EP-22 se deja activo; dos acciones realizadas y una cancelada. No se han
operado automaticamente acciones clinicas en la app. El usuario autoriza crear el commit, publicarlo en origin/main y comprobar
GitHub Actions. La validacion remota debe verificarse despues del push.

## Exclusiones

No fija tiempos clinicos, genera tareas recurrentes, envia notificaciones
externas ni integra laboratorio. No cambia prioridades, responsables o turno
automaticamente. La rectificacion de una nota de reevaluacion ya realizada
requiere un alcance posterior; no se reabre ni elimina el hecho completado.
