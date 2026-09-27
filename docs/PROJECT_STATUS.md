# Estado del proyecto MedicControl+

## Última etapa

Etapa 22 — Separación del cliente API y tipos frontend.



## Estado de validación

- Backend: 12 pruebas aprobadas.
- Frontend: 2 pruebas aprobadas.
- ESLint: cero errores.
- Frontend: compilación aprobada.
- Advertencias backend: se mantienen únicamente las ya conocidas.
- GitHub Actions: backend, frontend, lint y build.

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
- Cliente HTTP frontend separado.
- Tipos de dominio, API y datos clínicos separados.

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

Etapa 23 — Separación posterior de páginas y componentes.

Objetivos:

- dividir `App.tsx` en páginas y componentes;
- conservar los contratos TypeScript existentes;
- mantener el cliente HTTP centralizado;
- conservar pruebas, lint y build.
