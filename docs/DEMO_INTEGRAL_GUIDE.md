# Guion integral del demo local

Preparado el 8 de noviembre de 2026 para la entrega `10d006b`.
Circuito principal ejecutado manualmente por el usuario y confirmado completo
durante la sesión del 8 de noviembre de 2026.

## Resultado registrado de EP-25

- Caso creado como Paciente Integral Demo 01, episodio EP-25. Triaje y área
  Consulta confirmados, con medicina y enfermería asignadas e inicio registrado.
- Turno Demo Asignación 02 extendido hasta el 9 de noviembre de 2026 a las
  8 a. m. Las tres cuentas del ensayo aparecieron disponibles al filtrar ese turno.
- Evaluación médica y dos reevaluaciones independientes guardadas. La captura
  del resumen mostró ambas vencidas y pendientes durante la preparación del relevo.
- Orden #23 con hemograma y análisis de orina. Los identificadores asignados
  fueron muestra #4 de sangre y muestra #5 de orina. El hemograma fue publicado
  y revisado primero, mientras orina permanecía pendiente de resultado.
- Área cambiada a Observación. El resumen mostró a Enfermería Demo Consulta
  como responsable y a Enfermería Demo Observación como receptor propuesto.
  Conservó una tarea por disciplina y una analítica pendiente de resultado.
- El usuario confirmó aceptación del relevo por enfermeria.observacion e inicio
  separado. Confirmó nuevamente los dos pendientes de reevaluación y el de LAB
  en el resumen, después de ambos hechos.
- Reevaluación de enfermería realizada por la receptora y reevaluación médica
  realizada por medico.demo1, confirmadas por el usuario.
- Obtención, entrega, recepción y aptitud de ambas muestras confirmadas. Orina
  obtenida y entregada por el paciente según el registro ficticio del ensayo.
- Segundo resultado publicado y revisado. El usuario confirmó cero resultados
  y revisiones pendientes. La captura previa al alta mostró también cero órdenes
  anteriores pendientes.
- Alta guardada con la nota Cierre ficticio tras completar ensayo integral EP-25.
  El usuario confirmó episodio cerrado, evento de alta y consulta posterior del
  triaje, evaluación, resultados y reevaluaciones desde Historial de episodios.

La evidencia combina confirmaciones del usuario y capturas aportadas durante el
recorrido. El agente ejecutó la preparación de servicios y respaldo.

## Resultado registrado de EP-26 tras alta

- Segundo caso ficticio creado como Paciente Integral Tras Alta 01, EP-26.
  El usuario confirmó triaje P3, área Consulta, asignación e inicio de medicina
  con medico.demo1 y evaluación médica ficticia.
- Orden #24 con análisis de orina ficticio y muestra #6. Obtención y entrega
  registradas como realizadas por el paciente. Recepción y aptitud Apta
  confirmadas desde laboratorio. El resultado quedó pendiente al dar el alta.
- Alta con plan confirmada. Revisión prevista para el 9 de noviembre de 2026
  a las 10 a. m., hora dominicana, y plan de llamada ficticia de recepción para
  solicitar contacto con el médico responsable.
- Seguimiento tras alta mostró a Médico Demo Uno como responsable, un resultado
  pendiente y cero revisiones pendientes, con la fecha y el plan confirmados.
- Laboratorio publicó el resultado de orina desde los pendientes de episodios
  cerrados. El usuario confirmó cero resultados pendientes y una revisión pendiente
  tanto en laboratorio como en el seguimiento consultado por medicina.
- Revisión médica registrada por medico.demo1. EP-26 continuó cerrado.
- Al incluir seguimientos sin pendientes clínicos, el usuario confirmó cero
  resultados y cero revisiones pendientes, responsable y plan conservados y el
  mensaje Sin resultados ni revisiones pendientes.

La variante de continuidad de resultados tras alta queda confirmada por el usuario.
La gestión de contacto y la explicación clínica tienen sus registros propios.
Tras la revisión, el usuario confirmó autorización médica del aviso para pedir
contacto o regreso y gestión ficticia de recepción con respuesta e identidad
verificadas y aviso transmitido. El usuario confirmó después la explicación
clínica por medico.demo1 y, al incluir contactos completados, la gestión de
recepción y la explicación médica conservadas en Historial de este aviso.
El usuario detectó desalineación de las casillas de la gestión
y aportó captura. Tras la corrección, confirmó las casillas junto a sus textos
y bien alineadas. La validación automática y visual figura en LOCAL_VALIDATION.

Respaldo previo verificado en
`backups/clinical-20261108T154802Z-198d5a75.sqlite3`, con 23 pacientes y 24 episodios.
Restauración aislada verificada en
`.tmp/integral-demo-20261108-restored-198d5a75.sqlite3`, con SHA-256 coincidente.
El controlador confirmó backend y frontend propios respondiendo y la base
`clinical-communication-working.sqlite3` seleccionada antes de iniciar el circuito.

## Preparación del ensayo

Desde la raíz del proyecto, consultar el controlador del demo.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\demo.ps1 Status
```

La última base de trabajo registrada es
`.tmp/communication-rollout-20261030/clinical-communication-working.sqlite3`.
Confirmar su ruta en el estado del controlador y la existencia del archivo.
Si difiere de la base esperada, resolver la selección antes del circuito.

Si los servicios están detenidos, el comando preparado para esta copia es

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\demo.ps1 Start -Database ".tmp\communication-rollout-20261030\clinical-communication-working.sqlite3"
```

Preparar una copia consistente de la base elegida.

```powershell
.\.venv\Scripts\python.exe .\scripts\demo_db_backup.py backup --source ".tmp\communication-rollout-20261030\clinical-communication-working.sqlite3"
```

Con la ruta que devuelva ese comando, aplicar `verify` y restaurar en un destino
nuevo mediante el procedimiento de [respaldo](DEMO_DATABASE_BACKUP.md).
Anotar las rutas y el resultado de integridad antes de crear el paciente.

## Cuentas y turno

Coordinar previamente quién manejará cada ventana. Para mantener dos identidades
simultáneas, usar perfiles o navegadores separados y comprobar el usuario visible.
Las pestañas del mismo perfil pueden compartir sesión.

| Participante | Preparación |
|---|---|
| Coordinación | Cuenta con permiso vigente, por ejemplo `medico.demo1` si conserva la autorización |
| Medicina | Médico confirmado como responsable del nuevo episodio |
| Enfermería Consulta | `enfermeria.consulta`, cuenta activa y participación disponible |
| Enfermería Observación | `enfermeria.observacion`, cuenta activa y participación disponible |
| Recepción y laboratorio | Cuentas con sus permisos para el demo |

En **Personal y turnos**, preparar un turno ficticio vigente y las participaciones
necesarias en Consulta y Observación. Confirmar disponibilidad desde **Mi turno**
según los controles ofrecidos a cada profesional. Registrar los motivos como
pruebas ficticias. Comprobar participantes elegibles en **Colas y responsables**.

## Circuito y criterios de aceptación

Usar el nombre **Paciente Integral Demo 01**, documento **DEMO-INTEGRAL-001** y
nacimiento **15/01/1990**. Si ya existe, comprobar el registro ofrecido y decidir
la continuidad del caso antes de crear otro. Anotar el EP asignado por la app.

| Paso | Cuenta y lugar | Acción del ensayo | Resultado que debe comprobarse |
|---|---|---|---|
| 1 | Recepción, Registrar llegada | Registrar la identidad ficticia | EP activo e identidad coincidente |
| 2 | Enfermería Consulta, detalle del EP | Guardar triaje P3 y ubicación física Sala de espera | Triaje visible en la línea de tiempo |
| 3 | Coordinación, Colas y responsables, tarjeta del EP | Confirmar área Consulta y responsables de medicina y enfermería | Ambos profesionales identificados en ese EP |
| 4 | Cada responsable, misma tarjeta y disciplina | Confirmar su inicio con motivo ficticio | Inicio registrado para cada disciplina |
| 5 | Medicina, detalle del EP | Guardar evaluación ficticia y programar dos reevaluaciones, una por disciplina, a una hora futura revisada en pantalla | Dos acciones pendientes con sus instrucciones y responsables |
| 6 | Medicina, orden de laboratorio del EP | Crear una orden con hemograma vinculado a sangre y análisis de orina vinculado a orina | Dos analíticas y sus dos muestras diferenciadas |
| 7 | Laboratorio, orden del mismo EP | Registrar obtención y entrega según los controles del ensayo, recepción y aptitud de las muestras. Publicar únicamente el hemograma ficticio | Resultado parcial disponible y análisis de orina pendiente |
| 8 | Medicina, detalle del EP | Revisar expresamente el resultado de hemograma | Revisión médica registrada para esa versión |
| 9 | Coordinación, Colas y responsables | Cambiar área a Observación y proponer relevo a Enfermería Observación | Responsable anterior conservado y receptor pendiente de aceptación |
| 10 | Coordinación y receptor, Resumen de relevo | Localizar el EP y comprobar reevaluaciones, analítica y responsables | Pendientes conservados y propuesta visible |
| 11 | Enfermería Observación, Colas y responsables | Aceptar el relevo y confirmar su inicio por separado | Receptor responsable, propuesta resuelta e historial de ambos hechos |
| 12 | Medicina y Enfermería Observación, detalle del EP, Reevaluaciones programadas | Registrar cada realización con texto ficticio y motivo | Cada acción pasa a Realizada bajo su responsable |
| 13 | Laboratorio y medicina | Publicar orina ficticia y registrar su revisión médica | Todas las analíticas publicadas y revisadas |
| 14 | Medicina, detalle del EP | Comprobar los requisitos de alta y cerrar con nota ficticia | EP cerrado y evento de alta visible |
| 15 | Historial de episodios | Consultar el mismo EP | Triaje, atención, laboratorio, revisiones y alta consultables |

Si un formulario queda deshabilitado, leer el motivo mostrado y comprobar cuenta,
responsabilidad, estado y versión antes de continuar. Ante una respuesta ambigua,
consultar el resultado guardado antes de repetir la acción.

## Continuación específica de resultados tras alta

La variante de alta con laboratorio pendiente requiere un segundo caso y un plan
de seguimiento autorizado dentro de la app. Preparar ese caso después del circuito
principal, con responsable, revisión prevista y comunicación ficticia al paciente.
Comprobar su presencia en **Seguimiento tras alta**, la publicación posterior, la
revisión médica y las gestiones de **Contacto tras el alta** por recepción.
La ejecución de EP-26 registrada arriba cubre el resultado posterior al alta,
su revisión, la gestión ficticia de recepción y la explicación clínica registrada
por medicina, con ambos hechos conservados en el historial.

## Registro de resultados

Para cada paso anotar fecha y hora dominicana, EP, cuenta, resultado esperado,
resultado observado y evidencia. Marcar Conforme, Fallo o Pendiente.
Registrar por separado las comprobaciones del resumen antes y después de aceptar
el relevo, con los mismos identificadores de pendientes.

El ensayo se considera completo cuando todos los pasos principales tienen
resultado registrado y las diferencias encontradas quedan resueltas o pendientes
identificadas. La variante tras alta conserva su resultado propio.

Referencias en [inventario](DEMO_READINESS.md),
[reevaluaciones](REEVALUATIONS.md), [activación LAB](LABORATORY_ACTIVATION.md)
y [operación local](DEMO_OPERATIONS.md).
