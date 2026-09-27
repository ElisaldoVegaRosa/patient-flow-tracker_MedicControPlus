# Estado del proyecto MedicControl+

## Última etapa

Etapa 24 - Mantenimiento preventivo de GitHub Actions.



## Estado de validación

- Backend: 12 pruebas aprobadas.
- Frontend: 2 pruebas aprobadas.
- ESLint: cero errores.
- Frontend: compilación aprobada.
- Advertencias backend: se mantienen únicamente las ya conocidas.
- Validación local: `scripts/validate.ps1`.
- GitHub Actions: backend, frontend, lint y build.
- CI preparada ante la deprecación de Node 20 en GitHub Actions.
- Runner de CI fijado en `ubuntu-24.04` antes de la migración de
  `ubuntu-latest` a Ubuntu 26.

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
- Validación local reproducible en Windows.
- Tareas de VS Code para validación, pruebas, lint, build y ejecución local.
- CI con acciones oficiales compatibles con runtime Node 24.

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

## Experiencia de desarrollo

- `scripts/validate.ps1` refleja la validación de CI desde Windows.
- Pytest usa `.tmp/pytest` como base temporal local controlada.
- Las tareas de VS Code usan rutas relativas al workspace.
- Estas mejoras no cambian el comportamiento clínico de la aplicación.

## Próximo paso recomendado

Etapa 25 - Separación posterior de páginas y componentes.

Objetivos:

- dividir `App.tsx` en páginas y componentes;
- conservar los contratos TypeScript existentes;
- mantener el cliente HTTP centralizado;
- conservar pruebas, lint y build.
