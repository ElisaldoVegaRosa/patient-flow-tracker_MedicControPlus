# Colas por profesional y asignacion asistida

Alcance y criterio autorizados por el usuario con "Si, cont" sobre 1dff835,
publicado con CI 39532858950 aprobada. Implementacion local validada;
usuario autoriza prueba guiada con "Si, cont"; sin nuevos commit/push autorizados.
[Guia y validacion](PATIENT_QUEUES_ASSIGNMENT.md).

## Problema y base real

Existen cuentas personales, areas, turnos y disponibilidad confirmada.
Sin embargo, episodes.assigned_to sigue siendo texto libre: routes/nursing.py
lo guarda junto a prioridad y ubicacion, y EpisodePage.tsx lo presenta como
Personal responsable. No identifica dos responsables ni contiene aceptacion,
cola individual o traspaso. No convertir ese texto en una cuenta por coincidencia.

Problema a resolver: que coordinacion y cada profesional identifiquen pacientes
pendientes, responsables confirmados, espera y carga; el paciente no debe tener
que buscar por su cuenta quien lo atiende.

## Decisiones conservadas

- Cola compartida por area y cola individual, con medicina y enfermeria separadas.
- Sugerir despues del triaje; confirmar por coordinacion o por el propio
  profesional al tomar al paciente. Sugerencia no equivale a asignacion.
- Asignacion no equivale a inicio de atencion ni a evaluacion completada.
- Mantener normalmente al medico al pasar de consulta a observacion.
- Usuario confirma que enfermeria cambia al personal de Observacion mediante
  aceptacion del relevo; el anterior conserva la responsabilidad hasta entonces.
  Mover al paciente o proponer receptor no confirma el relevo. Sin receptor
  que acepte, mostrar cobertura pendiente y conservar responsable anterior.
- Considerar prioridad, espera, disponibilidad y pendientes; el numero de
  pacientes por si solo no demuestra una carga clinica equivalente.
- Permiso de coordinacion no amplia facultades clinicas. Administrador solo
  gestiona cuentas/permisos. Laboratorio conserva su cola por orden.
- Cambiar de turno, area o disponibilidad no transfiere ni abandona pacientes.

## Alcance conjunto recomendado

1. Relacionar episodio con medico y enfermeria mediante IDs de cuentas,
   registrando autor, motivo, version e historial de asignaciones.
2. Mantener ubicacion fisica y area de seguimiento como conceptos distintos.
   Sala de espera y Consultorio 1 no son nombres del catalogo de personal.
   Definir el destino operacional explicitamente; no inferirlo del texto.
3. Conservar assigned_to y episodios antiguos como informacion heredada, sin
   crear asignaciones falsas. Mostrar Sin responsable confirmado cuando proceda.
4. Presentar cola del area, pacientes sin asignar y cola propia por disciplina.
   Orden visible por prioridad vigente y antiguedad de espera, con desempate
   estable. La espera se cuenta desde un hito persistido, no al abrir la pagina.
   Cambios de prioridad no reinician artificialmente la espera.
5. Mostrar candidatos de cuenta personal activa, rol adecuado, area compatible,
   turno iniciado y disponibilidad confirmada. Revalidar todo al confirmar,
   incluso si cambio desde que se consulto la sugerencia.
6. Mostrar carga desglosada: episodios activos asignados por prioridad, pendientes
   y antiguedad. Definir antes de codificar el orden de recomendacion y desempates;
   evitar pesos clinicos inventados o una puntuacion opaca. La explicacion de cada
   sugerencia debe indicar los datos usados. Sin reparto clinico automatico.
7. Confirmar asignacion inicial por coordinacion o toma propia por el profesional;
   no permitir que tomar un paciente ya asignado sobrescriba al otro responsable.
   Conservar sugerencias no confirmadas en la cola compartida.
8. Registrar inicio de atencion explicitamente y distinguirlo de lectura de
   pulsera, apertura del episodio, triaje y confirmacion de asignacion.
   No fabricar una evaluacion ni impedir atencion urgente por falta de asignacion.
9. Para sustituir un responsable, proponer relevo y aceptar por receptor; conservar
   anterior hasta aceptacion. Coordinacion resuelve excepciones con motivo e
   historial. Si no hay receptor disponible, mostrar pendiente sin falsa cobertura.
10. Cierre/anulacion del episodio retira trabajo de las colas activas, conservando
    responsables e historial. Fin del turno o baja de cuenta muestra cobertura
    pendiente; nunca reasigna o elimina obligaciones silenciosamente.
11. Reutilizar transacciones, versiones, recibos, permisos actuales, recuperacion
    de resultados inciertos y proteccion de ediciones en todos estos cambios.
    Concurrencia entre coordinadores y profesionales no debe crear dos
    responsables vigentes de la misma disciplina.

## Relevo confirmado y siguiente decision

Usuario eligio cambiar al personal de Observacion con aceptacion del relevo,
manteniendo al anterior hasta entonces. Medico normalmente se conserva.
Registrar propuesta, aceptacion o excepcion autorizada como hechos separados;
los pendientes de enfermeria deben permanecer visibles durante el relevo.

## Criterio de sugerencia autorizado para el demo

Separar elegir paciente y elegir profesional. Es una regla operacional del demo,
no un protocolo clinico ni una garantia de carga equivalente.

1. Paciente: prioridad vigente primero y, dentro de ella, mayor espera desde
   que quedo listo para la disciplina. Para primera consulta, usar fin de triaje
   persistido; no reiniciar por refrescar, reasignar o repetir triaje. El actual
   waiting_minutes del supervisor mide tiempo desde ingreso, no demuestra espera
   sin atencion. Mostrar ambas referencias con sus nombres correctos. Ante datos
   historicos insuficientes, indicar tiempo desconocido en lugar de inventarlo.
2. Candidatos: rol, cuenta y area compatibles, turno iniciado y disponibilidad
   confirmada. No sustituir a un responsable vigente por una sugerencia mejor.
3. Comparacion propuesta: menos episodios activos asignados con prioridad 1/2;
   a igualdad, menos tareas pendientes de su disciplina; despues, menos episodios
   activos asignados en total. Comparacion por ese orden, sin suma ponderada.
   Prioridad 1/2 es la agrupacion ya usada por supervision; no cambiar el triaje.
4. Empate completo: mayor tiempo desde ultima asignacion confirmada en esa
   disciplina. Quien aun no recibio asignaciones va primero; desempate final
   estable por ID. Consultar sugerencias no cuenta como asignacion.
5. Presentar metricas y motivo concreto, permitir a coordinacion otra eleccion
   valida con motivo auditado. Profesional solo confirma toma propia. Si no hay
   candidato elegible, mantener episodio visible sin asignacion confirmada.

Ejemplo: dos profesionales disponibles de Consulta, A con dos episodios P1/P2
y B con cuatro P3. La propuesta recomienda B pese a tener mas pacientes; mostrar
el por que y permitir decision humana. Este ejemplo no establece equivalencia
de esfuerzo ni sustituye el juicio del equipo.

Medicina cuenta tareas PENDING de servicio MEDICAL de sus episodios; enfermeria,
servicio NURSING. LAB se muestra como dependencia pendiente del episodio, sin
atribuir su ejecucion a medicina/enfermeria. No deducir duracion ni vencimiento
de una tarea por su titulo. No hay fecha estructurada de reevaluacion en los
modelos actuales revisados: no inventar vencimientos ni incluirlos en el orden.
Las alertas abiertas se muestran como contexto; no son tareas equivalentes.

Revalidar elegibilidad y version antes de confirmar; si la carga vario, mostrar
comparacion actualizada sin reasignar silenciosamente. Relevo pendiente permanece
a cargo del anterior hasta aceptacion; mostrar tambien compromisos entrantes
para no ocultar carga, sin tratarlos como responsabilidad ya aceptada.

Usuario confirma este orden y autoriza implementar el bloque. No se crean pesos, topes de pacientes
ni tiempos clinicos por prioridad en esta propuesta.

## Exclusiones

Reglas nuevas de reevaluacion clinica, intervalos por prioridad, integracion
con laboratorio externo, nomina, notificaciones externas, agenda recurrente,
fusion de pacientes, despliegue en red y acceso remoto. No sustituye protocolos
de urgencias ni acredita preparacion para operar en campo.

## Aceptacion y validacion

- Permisos servidor: coordinacion, toma propia y aceptacion de relevo; sin
  ampliacion del rol ni acceso del administrador a datos clinicos.
- Dos disciplinas independientes; episodio activo, identidad y datos antiguos
  conservados; movimiento a observacion no cambia medico por efecto secundario.
- Competencia por el mismo paciente, cambio de disponibilidad, cierre, retirada
  de permiso y resultados inciertos no duplican ni pierden responsabilidades.
- Consulta y asignacion no registran atencion realizada; historial explica cada
  transicion, sus actores y cualquier excepcion de coordinacion.
- Pruebas dirigidas y una validacion completa al estabilizar; migracion ensayada
  en copia y respaldo verificado antes de aplicar a demo. Prueba directa solo
  despues de acordarla con usuario. Commit/push nuevos requieren autorizacion.

Impacto alto: modelo de responsabilidades, consultas, triaje, episodios,
interfaces por rol y transiciones de cierre. Se tratara como un bloque funcional
con controles compartidos, evitando una entrega aislada por cada formulario.

Referencias: [plan del piloto](URGENCIAS_PILOT_PLAN.md),
[personal y turnos](STAFF_AREAS_SHIFTS.md), [estado](PROJECT_STATUS.md).
