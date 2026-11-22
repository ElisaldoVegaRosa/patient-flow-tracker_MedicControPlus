# Inventario de preparación del demo

Actualizado el **22 de noviembre de 2026**, sobre la entrega publicada `1f65d6d`.
Consolida pruebas anteriores y sus límites; esta revisión no ejecuta otra prueba
clínica. La CI de esa entrega aprobó backend, frontend, análisis y compilación.

## Estado del demo local

Los circuitos principales tienen evidencia funcional en esta PC y con el Redmi.
Las pruebas EP-25 y EP-26 cubren el recorrido integral y el seguimiento tras alta.
EP-24 cubre relevo y recuperación de envíos tras desconexión. La guía breve de
[arranque y contingencia](DEMO_QUICK_START.md) reúne los pasos operativos actuales.

| Capacidad | Evidencia disponible | Pendiente o límite de esa evidencia |
|---|---|---|
| Inicio, parada y diagnóstico | Ciclos Start/Stop/Status y recuperación tras reinicio comprobados; PID reutilizado cubierto por 50 pruebas de controlador/LAN | La corrección de identidad se comprobó con API nativa y simulación, sin forzar otro reinicio de la PC |
| Ingreso, triaje, atención, alta e historial | EP-17 y circuito integral EP-25 confirmados; EP-25 y EP-26 cerrados con historial | Para otro ensayo, preparar caso ficticio y acordar quién opera; no repetir de rutina lo ya aprobado |
| Corrección, anulación y reapertura | EP-18 y EP-19 confirmados con historial auditable | No equivale a fusión de identidades ni borrado de fichas clínicas |
| Identidad provisional y verificación | EP-21 y flujo de admisión/archivo confirmados | Definir autorización, consolidación y rectificación antes de implementar fusión de duplicados |
| Pulsera y QR | PDF y lectura por cámara del Redmi confirmados; acceso HTTPS por HOME-WIFI | Falta pulsera física, impresora, consumibles y prueba en tableta |
| Cuentas y coordinación | Altas, cambios de permiso, revocación y auditoría comprobados | Para el centro, acordar responsables de cuentas, accesos y soporte |
| Áreas, turnos y disponibilidad | Planificación, disponibilidad, pausa, cierre y extensión comprobados | Los turnos ficticios antiguos pueden estar vencidos; preparar los vigentes para cada ensayo |
| Asignación, inicio y relevo | EP-22/EP-24 y EP-25: el anterior conserva responsabilidad hasta aceptar; el inicio se confirma aparte | Validar la operación con el personal y la distribución reales del centro |
| Reevaluaciones | Acciones por disciplina y bloqueo del alta comprobados; EP-25 conserva pendientes durante relevo y completa ambas acciones | Los tiempos los decide el médico; no se han establecido protocolos clínicos institucionales |
| Laboratorio por analítica y muestra | EP-23 y EP-25: muestras, resultados parciales, nueva muestra, revisión e historial; EP-26 publica y revisa después del alta | Programa actual de laboratorio desconocido; integración no definida |
| Contacto tras alta | EP-26: aviso autorizado, contacto ficticio por recepción, explicación médica e historial confirmados | No hubo llamadas ni mensajes reales; teléfonos se consultan fuera de la app |
| Esperas y resumen de relevo | Vistas por rol y permiso comprobadas; continuidad de pendientes en EP-25 | Evaluar utilidad con procesos, usuarios y tiempos reales al preparar el piloto |
| Red y desconexión | Redmi por HTTPS, lectura QR y escritura consultada en PC; EP-24 pruebas 2 a 5: borrador conservado, consulta y reintento sin duplicado | Misma pestaña abierta; no acredita trabajo autónomo sin red ni una pérdida de respuesta en medio del envío |
| Respaldo externo | USB Kingston en disco distinto a Windows; copia y restauración aislada verificadas, mismo hash, 25 pacientes/26 episodios | No se ejecutó la app con la restaurada ni se reconstruyó otra PC; nuevas escrituras requieren otra copia |
| Capacidad local | Ensayo sintético de 30 sesiones, 3.799 operaciones en 625,672 s | No equivale a 30 dispositivos físicos ni a medición en la red del centro |

Validación vigente de software: frontend completo **788/788**, análisis y
compilación aprobados para las correcciones de envíos; controlador/LAN **50/50**
en Windows para la corrección posterior. CI de `1f65d6d` aprobada:
[GitHub Actions 45072785037](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/45072785037).
Las fechas y resultados anteriores se conservan en [LOCAL_VALIDATION](LOCAL_VALIDATION.md).

Fuentes: [guion integral y resultados EP-25/26](DEMO_INTEGRAL_GUIDE.md),
[comprobaciones previas](LOCAL_DEMO_CHECK.md), [ensayo LAN](DEMO_LAN_HTTPS.md),
[pulsera PDF](WRISTBAND_PDF_DEMO.md), [cámara QR](QR_CAMERA_DEMO.md),
[respaldo](DEMO_DATABASE_BACKUP.md) y [capacidad](CAPACITY_OBSERVATION.md).

## Próximas prioridades

1. Revisar con el usuario la guía breve y elegir el objetivo del próximo ensayo
   o presentación. La documentación ya está preparada; otra prueba directa de
   la app requiere acordar caso, base y quién la opera.
2. Aplicar la rutina manual acordada: al terminar cada sesión y antes de cambios
   importantes, el usuario conecta el USB y solicita al asistente crear, verificar
   y restaurar la copia en una ruta aislada. El usuario lo guarda separado y se
   conservan las copias anteriores. No existe una programación automática.
3. Preparar las condiciones de un ensayo de campo cuando haya equipo y aprobación
   institucional. Conservar una lista de pendientes y criterios de aceptación
   antes de estimar fechas o comprar dispositivos.

## Pendientes para un piloto en el centro

| Bloque | Lo que falta concretar |
|---|---|
| Identificación física | Tableta, impresora y material; impresión, comodidad y lectura de la pulsera en condiciones reales |
| Instalación | Equipo servidor, red del centro, dirección y confianza HTTPS, energía y recuperación ante cortes |
| Operación | Responsable de soporte, rutina de copias fuera del equipo, recuperación y contingencia acordada con el centro |
| Laboratorio existente | Nombre del programa y acceso autorizado a estados/resultados para evaluar integración |
| Identidades duplicadas | Procedimiento autorizado de consolidación, auditoría y corrección de errores |
| Organización institucional | Fuente oficial del registro durante el piloto, permisos, formación y aprobación administrativa |

El demo local no acredita todavía estos puntos de campo. El acceso remoto,
telemedicina y la posible adopción como registro oficial siguen siendo fases
posteriores del [plan de urgencias](URGENCIAS_PILOT_PLAN.md). Sus estimaciones
requieren actualizarse al concretar el alcance pendiente.
