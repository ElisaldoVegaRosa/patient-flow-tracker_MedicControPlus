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

---

## Etapa 7 — Bandeja de laboratorio

### Implementado

- Endpoint exclusivo para laboratorio y supervisor.
- Consulta de órdenes pendientes.
- Consulta de órdenes completadas.
- Filtro por estado:
  - `PENDING`;
  - `COMPLETED`;
  - `ALL`.
- Información operativa incluida:
  - paciente;
  - episodio;
  - prioridad;
  - ubicación;
  - orden;
  - resultado;
  - estado.
- Restricción de acceso para recepción, enfermería y médico.

### Decisión de seguridad

La bandeja no devuelve el token QR ni información clínica que no sea
necesaria para ejecutar la orden. El acceso se controla mediante roles.

### Verificación

- Endpoint `/lab/orders` visible en Swagger.
- Tres pruebas automáticas aprobadas.
- Acceso permitido para laboratorio y supervisor.
- Acceso rechazado para recepción.
- Bandeja React compilada correctamente.
- Orden pendiente visible para laboratorio.
- Resultado simulado publicado desde la interfaz.
- Orden retirada de pendientes después de completarse.
- Evento `TASK_COMPLETED` registrado en el timeline.

### Flujo validado

1. El médico crea una orden de laboratorio.
2. La orden queda con estado `PENDING`.
3. Laboratorio abre su bandeja.
4. Laboratorio registra un resultado.
5. La orden cambia a `COMPLETED`.
6. El resultado se conserva en la tarea.
7. La acción genera un evento auditable.

---

## Etapa 8 — Centro de control del supervisor

### Implementado
- Endpoint exclusivo para supervisor.
- Indicadores operacionales:
  - pacientes activos;
  - pacientes de prioridad alta;
  - pacientes en riesgo;
  - alertas abiertas;
  - tareas pendientes.
- Tiempo transcurrido desde el ingreso.
- Conteo de alertas por paciente.
- Conteo de tareas pendientes por paciente.
- Clasificación operacional de riesgo.
- Restricción de acceso por rol.

### Regla de riesgo inicial

Un paciente se considera en riesgo cuando:

- tiene prioridad P1 o P2; o
- tiene al menos una alerta sin resolver.

### Verificación

- Endpoint `/supervisor/dashboard` visible en Swagger.
- Acceso restringido al rol supervisor.
- Cuatro pruebas automáticas aprobadas.
- Indicadores operacionales visibles.
- Tiempo de espera calculado por paciente.
- Pacientes P1 y P2 identificados.
- Pacientes con alertas identificados.
- Conteo de tareas pendientes visible.
- Filtros operacionales funcionales.
- Acceso rápido al episodio desde la tabla.
- Frontend compilado correctamente.

### Filtros disponibles

- Todos los pacientes activos.
- Pacientes en riesgo.
- Pacientes con prioridad P1 o P2.
- Pacientes con alertas abiertas.

### Criterio inicial de riesgo

El indicador `REQUIERE ATENCIÓN` se muestra cuando:

- la prioridad es P1 o P2; o
- existe al menos una alerta sin resolver.

---

## Etapa 9 — Motor de reglas temporales

### Implementado

El motor evalúa todos los episodios activos y crea alertas
automáticas cuando detecta demoras operacionales.

### Reglas implementadas

#### Triaje demorado

- Condición: episodio activo sin evento `TRIAGE`.
- Umbral: más de 30 minutos desde el ingreso.
- Severidad: `HIGH`.
- Motivo: `Tiempo de espera de triaje excedido`.

#### Tarea pendiente excedida

- Condición: tarea con estado `PENDING`.
- Umbral: más de 60 minutos desde su creación.
- Severidad: `HIGH`.
- Motivo: `Tarea pendiente con tiempo excedido`.

#### Paciente prioritario sin actualización

- Condición: paciente con prioridad P1 o P2.
- Umbral: más de 15 minutos sin eventos clínicos u operacionales.
- Severidad: `CRITICAL`.
- Motivo: `Paciente prioritario sin actualización reciente`.

### Prevención de duplicados

Antes de crear una alerta, el motor comprueba que no exista otra
alerta abierta con el mismo motivo para el mismo episodio.

Una segunda ejecución no duplica alertas que continúan en estado
`ACTIVE`, `ACKNOWLEDGED` o `ESCALATED`.

### Eventos que no cuentan como seguimiento

Los eventos `ALERT_CREATED` generados por el propio motor no se
consideran una actualización clínica del paciente.

Esto evita que la generación automática de una alerta reinicie
incorrectamente el tiempo de seguimiento de un paciente prioritario.

### Auditoría

Cada alerta temporal genera el evento:

```text
ALERT_CREATED
```

El usuario técnico registrado es:

```text
time-rules-engine
```

### Formas de ejecución

- Ejecución manual mediante `POST /rules/evaluate`.
- Ejecución automática al abrir el panel del supervisor.

### Verificación

- Endpoint `/rules/evaluate` visible en Swagger.
- Regla de triaje demorado verificada.
- Regla de tarea pendiente excedida verificada.
- Regla de paciente prioritario sin actualización verificada.
- Prevención de duplicados verificada.
- Cinco pruebas automáticas aprobadas durante esta etapa.
- Resultado del motor visible en el panel del supervisor.

---

## Etapa 10 — Datos de demostración

### Implementado

- Generador de doce pacientes ficticios.
- Diez episodios activos.
- Dos episodios cerrados.
- Prioridades P1 a P5.
- Diferentes áreas y ubicaciones.
- Personal responsable asignado.
- Signos vitales ficticios.
- Alertas activas para pacientes prioritarios.
- Tareas de enfermería.
- Órdenes de laboratorio.
- Resultados simulados.
- Eventos auditables.
- Botón exclusivo para supervisor.

### Comportamiento aditivo

La carga de demostración conserva los pacientes creados manualmente.

No se eliminan:

- pacientes;
- episodios;
- alertas;
- tareas;
- eventos;
- resultados.

### Prevención de duplicados

Los pacientes ficticios utilizan documentos con el prefijo:

```text
DEMO-SEED-
```

Antes de crear datos, el servidor comprueba si ese prefijo ya existe.

Una segunda ejecución informa:

```text
Los datos de demostración ya existen
```

y no crea pacientes adicionales.

### Seguridad

- Solo el supervisor puede ejecutar `/demo/seed`.
- Recepción recibe una respuesta `403`.
- El endpoint no está disponible para enfermería, médico o laboratorio.

### Verificación

- Endpoint `/demo/seed` visible en Swagger.
- Se crean exactamente doce pacientes ficticios.
- Se conservan los pacientes creados manualmente.
- Se crean diez episodios activos.
- Se crean dos episodios cerrados.
- Una segunda ejecución no duplica datos.
- Seis pruebas automáticas aprobadas.
- El frontend compila correctamente.
- Los pacientes activos aparecen en el panel del supervisor.

---

## Etapa 11 — Manejo de sesión expirada

### Implementado

- Detección de respuestas HTTP `401`.
- Eliminación automática del token inválido.
- Aviso claro al usuario.
- Recarga automática de la aplicación.
- Retorno a la pantalla de inicio de sesión.
- Posibilidad de iniciar una sesión nueva.

### Motivo

Los tokens del demo se almacenan temporalmente en la memoria del
backend.

Cuando FastAPI se reinicia, los tokens emitidos anteriormente dejan
de existir. El navegador, sin embargo, puede conservar el token
anterior en `localStorage`.

Esto provocaba el mensaje:

```text
Sesión requerida
```

sin regresar automáticamente al login.

### Solución implementada

Cuando el cliente recibe una respuesta HTTP `401` y existe un token:

1. elimina el token de `localStorage`;
2. muestra el mensaje de sesión expirada;
3. recarga la aplicación;
4. presenta nuevamente la pantalla de login.

Las credenciales incorrectas durante el login continúan mostrando el
error normal de autenticación.

### Verificación

- Frontend compilado correctamente.
- Backend reiniciado manualmente.
- Respuesta `401` detectada por el cliente API.
- Token inválido eliminado de `localStorage`.
- Mensaje de sesión expirada mostrado.
- Retorno automático al login.
- Nuevo inicio de sesión realizado correctamente.