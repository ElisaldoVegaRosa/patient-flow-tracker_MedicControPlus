# Estado del proyecto MedicControl+

## Última etapa

Etapa 17 — Sesiones persistentes con expiración.



## Estado de validación

- Backend: 11 pruebas aprobadas.
- Frontend: compilación aprobada.
- GitHub Actions: debe verificarse después de cada publicación.

## Capacidades principales

- Recepción y creación de episodios.
- Pulsera y lectura QR.
- Triaje y signos vitales.
- Evaluación médica.
- Tareas de enfermería.
- Órdenes y resultados de laboratorio.
- Panel de supervisor.
- Motor de reglas temporales.
- Datos de demostración.
- Historial de episodios cerrados.
- Manejo de sesión expirada.
- Historial visual de alertas.
- Máquina de estados de alertas.
- Restauración y cierre de sesión.

## Sesiones

- `POST /auth/login`: inicia sesión.
- `GET /auth/me`: valida y restaura sesión.
- `POST /auth/logout`: invalida el token.
- Los tokens de demostración están almacenados en memoria.
- Reiniciar el backend invalida las sesiones existentes.

## Alertas

Transiciones permitidas:

```text
ACTIVE → ACKNOWLEDGED
ACTIVE → ESCALATED
ACKNOWLEDGED → ESCALATED
ACKNOWLEDGED → RESOLVED
ESCALATED → RESOLVED

## Próximo paso recomendado

Etapa 18 — Validaciones de integridad del episodio.

Objetivos:

- rechazar cambios clínicos sobre episodios cerrados;
- impedir altas repetidas;
- validar rangos plausibles de signos vitales;
- impedir completar dos veces una tarea;
- comprobar cada restricción mediante pruebas automáticas.