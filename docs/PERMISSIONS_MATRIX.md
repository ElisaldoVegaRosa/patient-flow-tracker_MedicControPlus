# Permisos por rol y estado del episodio

Revisión 35A del comportamiento actual. No modifica la política de permisos.
R = recepción, E = enfermería, M = médico, L = laboratorio, S = supervisor.
Todas las acciones protegidas requieren sesión válida; su ausencia produce 401.
Un rol excluido produce 403. Los códigos indicados suponen una petición válida
y recursos existentes; no representan el orden de todos los errores posibles.

| Acción | Roles permitidos | Estado / condición |
|---|---|---|
| Health y login | Público | Login exige credenciales válidas |
| Consultar sesión y logout | R, E, M, L, S | Sesión válida |
| Dashboard general | R, E, M, L, S | Consulta |
| Dashboard supervisor | S | Consulta; no ejecuta reglas temporales |
| Crear episodio | R, S | Nuevo episodio ACTIVE |
| Consultar detalle | R, E, M, L, S | ACTIVE y CLOSED; lectura |
| Consultar historial | R, M, S | Lista CLOSED |
| Escanear pulsera | R, E, M, L, S | ACTIVE; registra QR_SCANNED; CLOSED produce 404 |
| Triaje | E, S | ACTIVE; CLOSED produce 409 |
| Signos vitales | E, M | ACTIVE; CLOSED produce 409 |
| Evaluación médica y alta | M | ACTIVE; CLOSED produce 409 |
| Crear tarea, cualquier servicio | M | ACTIVE; CLOSED produce 409 |
| Completar tarea LAB | L | ACTIVE y tarea pendiente |
| Completar tarea NURSING o MEDICAL | E, M, L | ACTIVE y tarea pendiente |
| Consultar bandeja LAB | L, S | Filtra servicio y estado de tarea; no restringe estado del episodio |
| Reconocer o escalar alerta | E, M, S | ACTIVE y transición válida |
| Resolver alerta | M, S | ACTIVE y transición válida |
| Evaluar reglas temporales | M, S | Motor recorre episodios ACTIVE |
| Cargar demo | S | Aditivo e idempotente; puede crear ejemplos ACTIVE y CLOSED |

La finalización repetida de tareas y las transiciones inválidas de alertas
producen 409. Una tarea LAB solo admite finalización por L. Para tareas de
otros servicios, el código permite E, M y L; no se impone correspondencia
entre rol y servicio. Esta regla se documenta como comportamiento existente,
sin inferir que deba cambiarse.

## Evidencia y alcance

- Fuente: `backend/app/routes/`, `backend/app/main.py` y las pruebas backend.
- Pruebas de routers cubren los cinco roles para registro, triaje, signos,
  evaluación, alta, alertas, dashboards, historial, reglas y demo.
- `backend/tests/test_task_permissions.py` cubre los cinco roles, los tres
  servicios, sesión ausente, creación, finalización, repetición y rechazo
  tras alta; compara las tablas clínicas para detectar mutaciones rechazadas.
- Pruebas existentes de flujo, alertas, consultas y medicina cubren bloqueos
  de episodios CLOSED y conservación del historial.
- Esta revisión verifica la política implementada. No decide una política
  clínica nueva ni audita el despliegue o la confidencialidad por paciente.
- Cualquier defecto o cambio de política requiere una tarea independiente.
