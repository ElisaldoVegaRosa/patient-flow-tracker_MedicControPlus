# Diagnostico y propuesta para el panel

## Estado: resumen implementado y pruebas registradas, 01/11/2026

Sin cambios de aplicacion en este bloque; sin servidores ni nueva carga HTTP.
Ultimo ensayo autorizado: 30 sesiones, panel p95 6180,726 ms y max 6541,905 ms.

## Evidencia

`backend/app/routes/dashboard.py` llama a `detail` para cada episodio activo.
`backend/app/main.py:episode_detail` carga identidad e historial, signos, alertas
con transiciones, tareas, eventos, correcciones, reevaluaciones, responsables,
laboratorio, seguimientos y versiones. El numero de consultas crece por episodio
(y por alertas/ordenes), aunque el panel no consume esos detalles.

`frontend/src/pages/DashboardPage.tsx` necesita id, nombre, estado de identidad,
prioridad, ubicacion, cantidades de alertas abiertas y tareas pendientes.
`App.tsx` tambien usa laboratory_enabled para navegacion. Abrir un episodio
obtiene su detalle por separado. DashboardData usa actualmente Episode[], por
lo que una respuesta resumida debe tener tipo propio y pruebas del contrato.

Lectura unica, offline y solo lectura de la base sintetica final del ensayo
`.tmp/capacity-runs/capacity-30-y2c1dc65/capacity.sqlite3`:

- 67 episodios activos: 1630 sentencias SQL.
- 136 consultas de esquema: 68 a sqlite_master y 68 a lab_schema.
- JSON de pacientes completos: 192567 bytes.
- Proyeccion aislada: 0,3793 s; NO comparable como benchmark con HTTP concurrente.
- Base abierta mode=ro, query_only=ON y SHA256 igual antes/despues.
- Resumen local: .tmp/dashboard-read-diagnostic.json.

El primer comando diagnostico fallo al abrir SQLite: faltaba uri=True al usar
mode=ro. Se corrigio esa invocacion, sin cambiar la app ni permisos. No hubo
consultas de proyeccion en ese intento. La lectura posterior fue correcta.

Esto demuestra trabajo repetido y datos no utilizados; no atribuye un porcentaje
exacto de los 6,54 s a cada causa ni descarta CPU, serializacion o concurrencia.

## Cambio recomendado

Problema: cada actualizacion del listado reconstruye todos los episodios completos.
Alcance: /dashboard, tipo especifico de resumen y consumidor DashboardPage.
Consultar episodios activos y contadores agregados sin unir varias relaciones
uno-a-muchos que multipliquen conteos. Comprobar laboratorio una vez por peticion.
Preservar filtros, prioridad/antiguedad, estado de identidad, navegacion y roles.
Cerrar la conexion incluso ante errores. Revisar indices mediante EXPLAIN antes
de proponer migraciones; no agregar indices ni cache por intuicion.

Exclusiones: detalle del episodio, reglas clinicas, /supervisor/dashboard (otra
vista y contrato), cambios de permisos, escritura, tiempos de espera, cache
persistente, hardware y nuevos ensayos reales sin coordinar.

Aceptacion propuesta:

- Igual listado, orden y contadores con alertas resueltas/abiertas, tareas
  pendientes/completadas/anuladas, episodios cerrados y pacientes sin actividad.
- Identidad, busqueda, abrir episodio y disponibilidad LAB conservadas.
- Numero acotado de consultas independiente del numero de pacientes; no llamar
  episode_detail desde /dashboard ni cargar historiales innecesarios.
- Pruebas de contrato/roles, frontend y regresiones aplicables aprobadas.
- Comparacion real posterior solo autorizada, con mismos datos iniciales y limites;
  no prometer latencia objetivo antes de medir. La evidencia actual no certifica
  uso en campo ni capacidad sostenida.

## Implementacion posterior

/dashboard ahora devuelve solo id, nombre, identidad, prioridad, ubicacion y
contadores por episodio; conserva active, open_alerts, requested_by y LAB.
Frontend usa DashboardPatient y suma contadores, sin inferirlos de historiales.
Detalle y supervisor siguen su contrato previo. Conexion cerrada tambien en error.

Lectura unica offline posterior de la misma base sintetica: 67 episodios,
3 sentencias, 11705 bytes de pacientes y 0,0068 s aislados. SHA256 conservado.
EXPLAIN confirma una agrupacion por tabla, con barridos de alertas/tareas y
arboles temporales; no se agregan indices sin evidencia de necesidad. El coste
puede crecer con historico grande: este ensayo no acredita tal escala.
Registro .tmp/dashboard-summary-diagnostic.json. Falta medicion concurrente.

Validacion: 53 backend relacionadas, 11 frontend dirigidas, build/lint correctos.
Frontend completo: 766/767, un timeout de restauracion; archivo aislado posterior
2/2 sin cambios. Suite completa no declarada verde; detalle en LOCAL_VALIDATION.md. Cambio del contrato requiere desplegar
backend y frontend juntos; el demo no se ha reiniciado durante este bloque.

## Activacion y comparacion completadas

Reinicio autorizado con misma base y ensayo aislado 01/11/2026: 649 operaciones
sin errores inesperados; panel p95 390,208 ms frente a 6180,726 ms previos.
Puerto privado cerrado y demo actualizado propio/respondiendo. Detalles y limites
en CAPACITY_OBSERVATION.md. Comprobacion visual guiada confirmada por usuario;
intermitencia de la suite frontend conservada como tal, sin declararla verde.

## Revision posterior de la intermitencia

Frontend completo pasa 767/767 (83 archivos, 209,27 s) con --maxWorkers=2 y sin
otras suites concurrentes. No cambios de codigo/esperas/runner. El fallo previo
se conserva; evidencia compatible con sensibilidad a carga, no causa definitiva.
Ver LOCAL_VALIDATION.md para condiciones exactas y limitaciones.
