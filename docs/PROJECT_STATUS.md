# Estado del proyecto MedicControl+

## Última etapa

Etapa 20 — Pruebas automatizadas del frontend.



## Estado de validación

- Backend: 12 pruebas aprobadas.
- Frontend: 2 pruebas aprobadas.
- Frontend: compilación aprobada.
- ESLint: 17 observaciones pendientes en `App.tsx`.
- GitHub Actions: prueba backend, frontend y build.

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

Etapa 21 — Tipado y saneamiento de ESLint.

Objetivos:

- reemplazar tipos `any` por modelos explícitos;
- corregir los efectos señalados por React Hooks;
- conservar pruebas y compilación;
- incorporar ESLint a GitHub Actions al llegar a cero errores.
