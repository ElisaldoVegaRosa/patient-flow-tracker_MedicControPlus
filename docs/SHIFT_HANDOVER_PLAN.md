# Propuesta: resumen para cambio de turno

## Problema y evidencia

CareQueuePage ya muestra responsables, cobertura, propuestas, reevaluaciones,
numero de alertas y ordenes LAB pendientes, con formularios de asignacion/relevo.
OperationalDelaysPage agrega tiempos y resultados/revisiones LAB, pero su acceso
es de supervision/coordinacion. Seguimiento tras alta y comunicaciones tienen
bandejas propias. Falta una vista compacta orientada a entregar pendientes.

## Alcance inicial recomendado

Vista de consulta para medicina, enfermeria y coordinacion. Por defecto pacientes
propios y relevos entrantes; coordinacion puede ver el conjunto, con filtros de
area/profesional y busqueda. Mantener controles de acceso existentes y acordar
cualquier ampliacion antes de implementarla. No crear permiso implicito por turno.

Por episodio activo: identidad visible y EP, prioridad, ubicacion fisica y area,
responsables confirmados por disciplina, cobertura/relevo pendiente, reevaluaciones
pendientes/vencidas, tareas pendientes propias, resultados LAB pendientes y
resultados vigentes pendientes de revision medica, alertas abiertas. Distinguir
ordenes antiguas de analiticas estructuradas; no sumar unidades distintas como si
fueran el mismo contador. Fechas en hora dominicana/12 h y estado de actualizacion.

Acciones: abrir episodio o cola existente para actuar. Leer no transfiere
responsabilidad, no registra atencion ni completa pendientes. Responsable anterior
se conserva hasta aceptacion existente. No agregar notas libres, boton de entrega
masiva ni cambio automatico de turno en esta primera version.

Seguimientos de episodios cerrados: mantener enlace a bandejas especificas;
no mezclarlos con activos. Coordinacion transversal no concede acceso a contenido
clinico adicional por esta pantalla. Definir campos exactos segun rol al disenar API.

## Implementacion y aceptacion propuestas

Endpoint de resumen dedicado, consultas agregadas por lotes y sin episode_detail
por cada fila. Tipos en clinical.ts, cliente HTTP centralizado, actualizacion
visible cada 15 s con mecanismo existente. Filtros conservados al actualizar;
error/fecha de actualizacion visibles, sin presentar datos anteriores como frescos.

Pruebas: permisos y filtros, responsable/receptor propuesto, separacion medicina
y enfermeria, vencimientos, LAB antiguo/estructurado sin duplicar, episodios
cerrados excluidos, cero escrituras al consultar, consultas acotadas y navegacion.
Usar fixtures y pruebas dirigidas antes de validacion aplicable. Prueba directa
solo coordinada con usuario; sin cambios en datos del demo durante analisis.

## Decision inicial pendiente

Comenzar con pendientes calculados automaticamente y enlaces de accion. Una nota
manual de entrega seria otro cambio: exige autor, version, rectificacion, permisos
y aclarar si es registro clinico u operacional. No incluirla sin acordar necesidad.

Primera version implementada localmente: /care/handover y Resumen de relevo.
Consultas por lotes, permisos de medicina/enfermeria o coordinacion, sin escritura.
Contadores separados: tareas de cada disciplina incluyen reevaluaciones; LAB
antiguo por orden y estructurado por analitica/resultado vigente. Cobertura efectiva
se consulta en cola existente; el resumen no infiere disponibilidad. Sin notas manuales.
Pruebas y activacion pendientes/registradas en LOCAL_VALIDATION.md.
Actualizacion de frontend/backend conjunta; reinicio autorizado completado con
misma base y comprobacion manual de filtros, apertura y actualizacion confirmada.

## Entrega preparada para publicacion

Titulo de commit propuesto: feat: add read-only shift handover summary.
Incluye 13 archivos: modelo/ruta backend y prueba, vista/tipos/navegacion frontend
con prueba, y documentacion. No migraciones, dependencias, bases ni temporales.
Base publicada 9b3a7ef. Actualizar frontend/backend juntos para nueva ruta.

Validacion local: 35 pruebas backend relacionadas y un caso adicional de
responsables; 18 frontend dirigidas y 770 frontend completas (84 archivos,
dos trabajadores), lint/build aprobados. Prueba manual guiada confirmada.
Backend completo no repetido para esta entrega: CI remota pendiente tras push.
Datos sensibles e historiales clinicos completos no se agregan al resumen;
contadores y titulos operacionales siguen sujetos al acceso clinico existente.

Limites: disponibilidad efectiva se consulta en Colas y responsables; episodios
cerrados usan bandejas especificas. No carga nueva ni certificacion de campo.
Diff/enlaces/UTF-8 revisados; diff --check correcto. Nuevo commit/push pendiente
de autorizacion explicita; no se crean durante la preparacion.
