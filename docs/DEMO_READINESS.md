# Inventario de preparación del demo

Revisión documental del 8 de noviembre de 2026 sobre la entrega `10d006b`.
Las comprobaciones citadas corresponden a sus fechas originales. Esta revisión
consolida evidencia existente. La próxima ejecución del circuito requiere acordar
la base, el caso ficticio y quién operará la app.

## Capacidades y evidencia disponible

| Capacidad | Evidencia registrada | Pendiente para el próximo ensayo |
|---|---|---|
| Inicio, parada y diagnóstico | Ciclo Start, Stop y Status confirmado en esta PC | Confirmar disponibilidad tras el reinicio cuando se prepare el ensayo |
| Ingreso, triaje, atención, alta e historial | Circuito ficticio EP-17 completado | Actualizar el guion integral con los flujos actuales |
| Corrección, anulación y reapertura | Casos EP-18 y EP-19 confirmados | Incorporar los casos de excepción al guion |
| Identidad provisional y verificación | Flujo de admisión/archivo y EP-21 confirmados | Definir reglas de consolidación de fichas antes de implementar fusión |
| Pulsera y lectura QR | PDF y lectura en Redmi Note 11 confirmados | Impresión física, material de pulsera y tableta |
| Cuentas personales y coordinación | Altas, permisos, revocación y auditoría comprobados | Preparar cuentas y responsables de cada escenario del ensayo |
| Áreas, turnos y disponibilidad | Planificación, inicio, pausa, cierre y extensión comprobados | Preparar un turno ficticio vigente y participantes disponibles |
| Asignación, inicio y relevo | EP-22 y relevo de enfermería EP-24 comprobados | Recorrer un cambio de turno con pendientes de varias clases |
| Reevaluaciones | Acciones independientes, realización y bloqueo del alta confirmados | Incluir realización, cancelación y relevo en el recorrido integral |
| Laboratorio por analítica y muestra | Circuito múltiple EP-23 y seguimiento tras alta confirmados | Integrar sus pasos en el guion actualizado |
| Contacto tras alta | Intentos y comunicación ficticia registrados por recepción | Ensayar la continuidad con responsables del siguiente turno |
| Esperas y resumen de relevo | Vistas implementadas y comprobaciones documentadas | Revisar su utilidad durante el circuito integral |
| Respaldo y restauración | Herramienta de copia consistente, verificación y restauración aislada | Elegir la copia previa del próximo ensayo y comprobar su recuperación |
| Capacidad local | Ensayo aislado de 30 sesiones, 3.799 operaciones en 625,672 s | Medición con dispositivos y red del centro al preparar el piloto |

Fuentes de los recorridos y validaciones en [LOCAL_DEMO_CHECK](LOCAL_DEMO_CHECK.md),
[LOCAL_VALIDATION](LOCAL_VALIDATION.md), [QR_CAMERA_DEMO](QR_CAMERA_DEMO.md),
[WRISTBAND_PDF_DEMO](WRISTBAND_PDF_DEMO.md),
[DEMO_DATABASE_BACKUP](DEMO_DATABASE_BACKUP.md) y
[CAPACITY_OBSERVATION](CAPACITY_OBSERVATION.md).

## Orden inmediato propuesto

1. Preparar un guion integral actualizado con cuentas personales, turno vigente,
   responsabilidades y criterios de aceptación por etapa. Reutilizar las pruebas
   anteriores para concentrar el recorrido en la continuidad entre módulos.
2. Identificar explícitamente la base activa y preparar respaldo verificable
   antes de ejecutar el guion. Registrar por separado la restauración aislada.
3. Acordar con el usuario la ejecución manual, sus participantes y los datos
   ficticios. Registrar resultado y fallos por causa compartida.
4. Resolver los fallos observados y cerrar el inventario del demo local con
   evidencia de la versión ensayada.

## Condiciones que requieren preparación de campo

| Bloque | Información o trabajo pendiente |
|---|---|
| Dispositivos e identificación | Tableta, impresora, consumibles y ensayo de lectura de pulsera física |
| Despliegue en el centro | Servidor, red local, HTTPS, cámaras y prueba de interrupciones y recuperación |
| Operación | Responsables de soporte, copias fuera del equipo, recuperación y procedimiento de contingencia |
| Laboratorio existente | Nombre del programa, estados disponibles, resultados y posibilidades de integración |
| Identidades duplicadas | Reglas autorizadas para consolidación, trazabilidad y rectificación de errores |
| Organización institucional | Fuente oficial del registro, permisos, formación y aprobación del piloto |

El plan de piloto conserva las decisiones institucionales y las fases posteriores
de acceso remoto y expediente oficial. Las estimaciones antiguas de paquetes
necesitan actualizarse sobre el alcance pendiente de cada entrega.
[Plan de urgencias](URGENCIAS_PILOT_PLAN.md).
