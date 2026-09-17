# Registro de evolución de MedicControl+

Este documento registra las funcionalidades incorporadas al sistema,
las verificaciones realizadas y el estado de cada etapa.

---

## Etapa 1 — Base funcional

### Implementado

- Backend con FastAPI.
- Base de datos SQLite.
- Autenticación simple mediante token.
- Roles:
  - recepción;
  - enfermería;
  - médico;
  - laboratorio;
  - supervisor.
- Creación de pacientes.
- Creación de episodios clínicos activos.
- Generación de token aleatorio para pulsera QR.
- Dashboard de pacientes activos.
- Registro de eventos auditables.
- Cierre de episodio mediante alta médica.

### Verificación

- API disponible en `/docs`.
- Health check disponible en `/health`.
- Frontend compilado mediante Vite.
- Flujo manual verificado desde recepción hasta alta.

---

## Etapa 2 — Signos vitales y alertas

### Implementado

- Registro de:
  - temperatura;
  - frecuencia cardíaca;
  - presión arterial;
  - saturación de oxígeno;
  - frecuencia respiratoria.
- Motor de reglas clínicas inicial.
- Alerta por saturación baja.
- Alerta por frecuencia cardíaca alta.
- Alerta por fiebre alta.
- Estados de alerta:
  - ACTIVE;
  - ACKNOWLEDGED;
  - ESCALATED;
  - RESOLVED.
- Auditoría de acciones sobre alertas.

### Verificación

- Registro manual de signos anormales.
- Generación automática de tres alertas.
- Reconocimiento y escalamiento por enfermería.
- Resolución por médico.
- Eventos visibles en el timeline.

---

## Etapa 3 — Pruebas automáticas

### Implementado

- Prueba integral del flujo clínico.
- Prueba de permisos por rol.
- GitHub Actions.
- Compilación automática del frontend.
- Ejecución automática de pruebas del backend.

### Verificación

- Dos pruebas locales aprobadas.
- Workflow de GitHub Actions aprobado.
- Estado verde en la rama `main`.

---

## Etapa 4 — Triaje y asignación

### Implementado

- Formulario de triaje para enfermería y supervisor.
- Cambio de prioridad.
- Cambio de área o ubicación.
- Asignación de personal responsable.
- Evento `TRIAGE` en el timeline.

### Verificación

- Paciente movido a Área de choque.
- Prioridad actualizada a P1.
- Personal asignado a Enfermería A.
- GitHub Actions aprobado.

---

## Etapa 5 — Evaluación médica

### En desarrollo

- Registro de nota clínica.
- Registro de diagnóstico.
- Decisión médica:
  - continuar observación;
  - ordenar pruebas;
  - preparar alta.
- Evento `MEDICAL_EVALUATION` en el timeline.
- Restricción exclusiva para el rol médico.

### Verificación pendiente

- Prueba automática del endpoint.
- Formulario de evaluación médica en React.
- Compilación del frontend.
- GitHub Actions.

---

## Etapa 6 — Órdenes clínicas

### Implementado

- Formulario de órdenes exclusivo para el rol médico.
- Creación de órdenes para:
  - laboratorio;
  - enfermería;
  - equipo médico.
- Estado inicial `PENDING`.
- Visualización de la orden en tareas pendientes.
- Registro automático del evento `TASK_CREATED`.
- Asociación de cada orden con un episodio clínico activo.

### Flujo implementado

1. El médico abre un episodio activo.
2. Registra una evaluación médica.
3. Crea una orden clínica.
4. Selecciona el servicio responsable.
5. La orden aparece como tarea pendiente.
6. El evento queda registrado en el timeline.

### Verificación manual

- Se creó la orden `Hemograma completo`.
- La orden fue asignada al servicio `LAB`.
- La orden apareció en tareas pendientes.
- El evento `TASK_CREATED` apareció en el timeline.
- El frontend compiló correctamente.

### Próxima etapa

- Crear una bandeja exclusiva para laboratorio.
- Permitir registrar un resultado simulado.
- Completar la orden como usuario de laboratorio.
- Mostrar el resultado en el timeline.