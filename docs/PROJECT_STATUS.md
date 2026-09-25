# Estado del proyecto MedicControl+

## Última etapa

Etapa 21 — Tipado y saneamiento de ESLint.



## Estado de validación

- Backend: 12 pruebas aprobadas.
- Frontend: 2 pruebas aprobadas.
- ESLint: cero errores.
- Frontend: compilación aprobada.
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

Etapa 22 — Separación del cliente API y tipos frontend.

Objetivos:

- mover los tipos fuera de `App.tsx`;
- mover el cliente HTTP a un módulo independiente;
- reducir el tamaño del componente principal;
- conservar pruebas, lint y build;
- preparar la separación posterior de páginas y componentes.