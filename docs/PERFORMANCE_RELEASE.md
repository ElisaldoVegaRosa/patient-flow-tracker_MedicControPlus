# Entrega preparada: acceso concurrente y resumen del panel

Estado: revisada localmente; usuario autoriza commit/push y comprobacion CI.
Base publicada: 729b8b3. Titulo propuesto:
`perf: reduce login contention and dashboard query overhead`.

## Comportamiento

Los accesos simultaneos verifican contrasenas fuera del bloqueo SQLite y
revalidan atomicamente cuenta, credenciales, permisos y revision antes de crear
sesion. Contencion devuelve 503 controlado; politica criptografica conservada.
El panel obtiene resumen y contadores agregados, con detalle al abrir episodio.
Se agrega controlador de capacidad con base sintetica y servidor privados;
por defecto solo describe el plan, ejecutar carga requiere --execute.

Incluye cambios de aplicacion, tres archivos nuevos de pruebas backend,
ajustes de dos pruebas frontend, controlador y documentacion. No incluye bases,
respaldos, informes locales, logs, dist ni credenciales.

## Activacion

/dashboard ahora devuelve DashboardPatient con contadores en lugar de Episode
completo. Actualizar backend/frontend juntos. /episodes y supervisor conservan
sus contratos. Sin migraciones nuevas, cambios de dependencias o de CI.
Demo local ya reiniciado con misma base y validacion visual confirmada por usuario.

## Evidencia y limites

- Auth: 40 dirigidas y backend completo 608/608 antes del cambio del panel.
- Panel posterior: 53 backend relacionadas, 11 frontend dirigidas, lint/build.
  No atribuir el backend completo anterior al contrato final del panel.
- Frontend final: 83 archivos, 767/767 con --maxWorkers=2, 209,27 s.
  Ejecucion anterior por defecto con otras suites: 766/767, un timeout al
  restaurar sesion; archivo aislado 2/2. Compatible con sensibilidad a carga,
  sin prueba causal definitiva. Runner/esperas/CI no modificados.
- Ensayo aislado final de 30 sesiones: 649 operaciones, 101,235 s, sin errores
  inesperados, duplicados ni sobrescritura; integridad/FK correctas.
- Panel p95 6180,726 -> 390,208 ms, max 6541,905 -> 514,247 ms, mismo plan
  y controlador. No certifica capacidad sostenida o uso en campo.
- Informes y huellas: CAPACITY_OBSERVATION.md; comandos: LOCAL_VALIDATION.md.
- Revision de diff y diff --check correctos. Documentacion nueva UTF-8 y enlaces
  locales revisados. No nuevas suites por esta preparacion documental.

## Publicacion propuesta

Un commit enfocado con el titulo indicado, push normal a origin/main y comprobar
GitHub Actions para el SHA exacto. CI remota de esta entrega pendiente hasta
publicacion; la CI aprobada de 729b8b3 corresponde a la entrega anterior.
Usuario autoriza expresamente commit/push y comprobar CI. Resultado remoto
pendiente al crear este commit; registrar SHA y CI verificados en continuidad.
