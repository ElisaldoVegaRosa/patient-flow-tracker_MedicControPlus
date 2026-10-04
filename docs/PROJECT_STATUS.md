# Estado del proyecto MedicControl+

## Última etapa

Etapa 28 funcional completada - Episodios CLOSED en modo solo lectura.



## Estado de validación

- Backend: pruebas ampliadas con regresion de dashboard supervisor sin efectos
  secundarios.
- Backend: prueba de regresion para impedir completar tareas pendientes de
  episodios cerrados sin mutar tarea, episodio ni auditoria.
- Frontend: 14 pruebas aprobadas (antes 4), con cinco casos CLOSED y cinco
  ACTIVE parametrizados por rol, además de las pruebas existentes.
- TDD: primero fallaron los casos CLOSED por controles de escritura presentes
  y aviso ausente; las mismas pruebas pasan con la corrección.
- Backend: 14 pruebas aprobadas, con tres advertencias conocidas.
- Suite frontend, lint y build aprobados; `scripts/validate.ps1` ejecutado una
  sola vez y aprobado para esta corrección.
- ESLint: cero errores.
- Frontend: compilación aprobada.
- Advertencias backend: se mantienen únicamente las ya conocidas.
- Validación local: `scripts/validate.ps1`.
- GitHub Actions: backend, frontend, lint y build.
- CI preparada ante la deprecación de Node 20 en GitHub Actions.
- Runner de CI fijado en `ubuntu-24.04` antes de la migración de
  `ubuntu-latest` a Ubuntu 26.
- Runtime de `actions/setup-node` modernizado mediante `actions/setup-node@v7`.
- Eliminación esperada de las advertencias internas `DEP0040` y `DEP0169` de
  `setup-node@v5`.
- Baseline Codex versionado con aprobacion bajo demanda, escritura limitada al
  workspace y red desactivada dentro del sandbox.
- Dependabot configurado para mantenimiento semanal y revisable de GitHub
  Actions en la rama `main`, con maximo de cinco PRs abiertos.

## Capacidades principales

- Recepción y creación de episodios.
- Pulsera y lectura QR.
- Triaje y signos vitales.
- Evaluación médica.
- Tareas de enfermería.
- Órdenes y resultados de laboratorio.
- Panel de supervisor.
- Finalizacion de tareas protegida por episodio activo.
- Dashboard supervisor de solo lectura.
- Motor de reglas temporales mediante accion explicita
  `POST /rules/evaluate`.
- Boton supervisor **Evaluar reglas temporales**.
- Datos de demostración.
- Historial de episodios cerrados.
- Detalle CLOSED con aviso accesible de solo lectura y sin controles de
  escritura; conserva vitales, alertas, tareas, resultados y auditoría.
- Controles de episodios activos sin cambios; backend como última barrera
  contra mutaciones posteriores al cierre.
- Manejo de sesión expirada.
- Historial visual de alertas.
- Máquina de estados de alertas.
- Restauración y cierre de sesión.
- Cliente HTTP frontend separado.
- Tipos de dominio, API y datos clínicos separados.
- Validación local reproducible en Windows.
- Tareas de VS Code para validación, pruebas, lint, build y ejecución local.
- CI con acciones oficiales compatibles con runtime Node 24.
- CI con `actions/setup-node@v7`, Node.js 22, cache npm y Ubuntu 24.04.
- Baseline de seguridad Codex compartido en `.codex/config.toml`.
- Mantenimiento automatizado y revisable de acciones mediante Dependabot,
  limitado exclusivamente a `github-actions`.

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
```

## Protocolo funcional de Etapa 28

- Evidencias 28A–28E conservadas: smoke; autenticación, sesión y logout;
  recepción y QR; triaje, vitales y alertas; evaluación médica, orden y
  resultado LAB; supervisor de consulta; resolución, alta e historial.
- QA EP-15 cerrado con prioridad P2, tres alertas resueltas, una evaluación,
  una tarea LAB completada y 17 eventos. Seis intentos posteriores al cierre
  rechazados con HTTP 409 sin mutación, según la evidencia previa de 28E.
- Cierre del defecto visual mediante TDD y consulta desde historial usando
  `.tmp/stage28-evidence/clinical.after-phase28E.db` en Chrome temporal.
- Evidencia: `.tmp/stage28-evidence/e28-closed-readonly-fixed.png` muestra
  aviso, vitales históricos, alertas resueltas y timeline con resultado LAB,
  sin formulario de vitales ni acciones de escritura.
- La comprobación DOM pasó; el control de red posterior a la captura dio un
  falso positivo al clasificar OPTIONS como escritura. El log confirmó solo
  consultas y login/logout. No se repitió el flujo clínico.
- Perfil temporal eliminado y servidores cerrados por PIDs exactos. Puertos
  8000, 5173 y 9444 libres. DB restaurada desde `clinical.before-stage28.db`:
  SHA-256 `4EE9CF8ADE09D813715B750444DA8870E6E2CDB6FF6935FEC428C0A1F0756049`.
- Limitación pendiente: nota de alta fija en UI, «Alta médica; paciente estable».

## Experiencia de desarrollo

- `scripts/validate.ps1` refleja la validación de CI desde Windows.
- Pytest usa `.tmp/pytest` como base temporal local controlada.
- Las tareas de VS Code usan rutas relativas al workspace.
- Estas mejoras no cambian el comportamiento clínico de la aplicación.
- El baseline Codex no cambia el comportamiento funcional de la aplicacion; solo
  fija permisos locales esperados para sesiones futuras.
- `GET /supervisor/dashboard` no debe crear alertas ni eventos.
- `POST /rules/evaluate` conserva la idempotencia de alertas temporales.
- `complete_task` rechaza tareas de episodios cerrados con `409 El episodio
  está cerrado`, sin modificar resultado ni registrar `TASK_COMPLETED`.
- La correccion de `complete_task` queda separada del dashboard supervisor y de
  las reglas temporales explicitas.

## Próximo paso recomendado

Revisar la corrección de solo lectura y definir una etapa separada para la
nota de alta editable, con validación y pruebas propias. Las PRs Dependabot
#1 y #2 quedan fuera de este trabajo.
