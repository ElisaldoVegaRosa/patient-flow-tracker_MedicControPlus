# Areas, turnos y permiso de coordinacion

Alcance autorizado con "Si, cont" sobre b2265c2; implementacion local
validada: backend 270/270, frontend 568/568, lint y build aprobados.
Usuario autoriza commit/push a origin/main y comprobacion CI con "Si, cont".
[Guia](STAFF_AREAS_SHIFTS.md).
Usuario eligio que coordinacion de urgencias asigne area/turno; el administrador
de cuentas solo concede o retira el permiso de coordinar.

## Problema confirmado

Ya existen cuentas personales y administrador separado. No hay catalogos de
areas/turnos ni planificacion del personal. La ubicacion del paciente y su
assigned_to son textos; no representan area/turno de cada profesional ni una
cola con responsables confirmados. Conservar esos datos e historial.

## Decisiones existentes

- Areas iniciales: triaje, consulta, observacion y laboratorio, con personal propio.
- Profesionales con areas y turnos fijos.
- Una persona coordina urgencias; el permiso es adicional al cargo y no amplia
  sus facultades clinicas.
- Medico normalmente se conserva al pasar consulta a observacion.
- Sugerencia, asignacion e inicio de atencion son hitos distintos.

## Primer alcance propuesto

1. Permiso explicito de coordinacion en una cuenta personal, concedido/retirado
   solo por administrador con motivo, version, auditoria y revocacion de sesiones
   afectadas. No convertir ACCOUNT_ADMIN en coordinador ni dar permisos medicos
   a quien coordine desde enfermeria. Revisar autorizacion tambien en servidor.
2. Catalogo de las cuatro areas iniciales y definicion de turnos con nombre,
   inicio y fin. Horarios configurables; no inventar jornadas del centro. Permitir
   turnos que cruzan medianoche mediante fechas/horas explicitas y zona local
   America/Santo_Domingo; conservar referencia UTC en persistencia/auditoria.
3. Coordinacion planifica area y turno por profesional activo. Impedir duplicados,
   solapamientos incompatibles y asignaciones a cuentas inactivas o de gestion
   administrativa. Mantener historial de cambios con autor y motivo.
4. Distinguir planificacion, inicio confirmado, indisponibilidad y cierre del
   turno. Estar autenticado, tener permiso o alcanzar una hora del reloj no
   demuestra disponibilidad. Coordinacion registra cambios explicitamente;
   no iniciar/cerrar turnos automaticamente por hora en esta primera version.
5. Vista de personal por area, turno y disponibilidad. Consultar el turno propio
   sin poder editar la planificacion ajena. El administrador conserva su interfaz
   de cuentas y permisos; coordinacion dispone de una vista operacional propia.
6. Reutilizar versiones, recibos, sesion y proteccion de cambios sin guardar por
   causa compartida. Separar auditoria/recibos operacionales de los episodios.

La concesion de permiso no equivale a estar trabajando ni determina por si sola
quien coordina un turno concreto. La identificacion del responsable de ese turno
debe quedar explicita; no imponer un unico poseedor del permiso para siempre.

## Exclusiones

Colas por profesional, calculo de carga, sugerencias y reasignacion de pacientes,
completar atencion por asignacion, reevaluaciones automaticas, entrega clinica
de turno, nomina/control laboral, turnos recurrentes complejos y notificaciones
externas. Finalizar un turno no transfiere ni borra responsabilidades clinicas.
El traspaso de pacientes requerira el bloque posterior con aceptacion explicita.

## Criterios de aceptacion

- Administrador concede/retira permiso; un usuario sin permiso, incluido el
  supervisor, no lo obtiene editando solicitudes. Cuenta desactivada no organiza
  personal.
- Coordinador conserva su rol clinico original: organizar no autoriza acciones
  medicas ajenas. Administrador de cuentas no accede a planificacion clinica.
- Crear y modificar planificacion con motivo e historial; errores de rango,
  medianoche, solapamiento y concurrencia no generan filas duplicadas.
- Inicio/indisponibilidad/cierre son explicitamente trazables; el calendario no
  altera por si solo disponibilidad ni episodios.
- Retirar permiso revoca acceso/sesiones pertinentes sin cambiar autoria previa.
- Ubicacion, asignado e historial del paciente permanecen como estaban.
- Pruebas dirigidas y validacion completa aplicable, ensayo de migracion en copia,
  respaldo y prueba manual acordada antes de actuar en la base demo.

El usuario autorizo implementar este alcance; la prueba directa se acordara
antes de operar la app y crear/publicar commits sigue requiriendo autorizacion.
Las reglas clinicas de
compatibilidad de personal y las suplencias deben concretarse al desarrollar,
sin deducirlas del nombre de un area ni sustituir la decision del centro.

Referencias: [plan del piloto](URGENCIAS_PILOT_PLAN.md),
[cuentas personales](PERSONAL_ACCOUNTS.md).
