# Política implementada localmente: consulta e historial de correcciones

Autorizada por el usuario tras revisar esta propuesta. El código local cubre
los casos y permisos siguientes; backend 191/191, frontend 457/457, lint y
build aprobados. Prueba directa y publicación siguen pendientes.
Los formularios nuevos avisan antes de navegar o recargar con texto sin guardar;
su restauración tras confirmar salida/recarga no forma parte de esta entrega.

## Problema y evidencia inicial

Durante EP-17 el usuario confirmo el flujo LAB corregido y planteo deshacer,
modificar y eliminar resultados/notas, altas erroneas y pacientes creados por
error. Tambien observo que las ordenes completadas dejan de verse.

La informacion permanece almacenada: episode_detail devuelve todas las tareas
con su resultado; completar agrega TASK_COMPLETED con el resultado en events.
GET /lab/orders ya admitía PENDING, COMPLETED y ALL. Antes de este bloque App
pedía siempre PENDING, LaboratoryPage solo presentaba pendientes y EpisodePage
filtraba tareas PENDING.
La linea de tiempo conserva el evento, pero no sustituye una consulta de ordenes
completadas con su identificacion y resultado.

Antes de este bloque no había rutas de rectificación de notas/resultados,
reapertura de alta ni anulación de ingreso. Las evaluaciones existentes son eventos
textuales con diagnostico, nota y decision concatenados; no son fichas editables
independientes. La correccion previa del acceso LAB esta validada localmente
(454 frontend, lint/build y prueba directa del usuario), aun sin commit/push.

## Alcance autorizado

Una entrega funcional conjunta de consulta historica y correcciones, con un
mecanismo compartido de autor, fecha, motivo, referencia al registro original,
version y accion. Mostrar estado vigente y permitir consultar el anterior.
La autorización no incluye modificar ni borrar los datos de EP-17.

| Caso | Comportamiento implementado | Rol |
|---|---|---|
| Orden LAB completada | Consultar Pendientes, Completadas y Todas; mostrar numero de orden, EP, resultado y estado. Tambien ver tareas completadas en el episodio, sin boton de completar otra vez. | Consulta segun permisos actuales: bandeja LAB/SUPERVISOR; detalle de episodio segun acceso existente |
| Resultado publicado por error | Registrar correccion vinculada al original. Si se anula una publicacion con episodio ACTIVE, volver a pendiente solo por accion explicita con motivo; conservar el resultado anulado en historial. | LAB corrige/anula sus resultados; SUPERVISOR consulta |
| Nota/evaluacion equivocada | Anadir rectificacion o anular su vigencia con motivo; conservar texto original y enlace a la rectificacion. Incluye nota de alta. No reconstruir campos estructurados interpretando automaticamente notas historicas. | DOCTOR |
| Alta por error | Reabrir el mismo episodio con motivo, conservando el evento original de alta y registrando la reapertura. Rechazar si ya hay otro episodio activo de la identidad confirmada, incluidas fichas historicas coincidentes. | DOCTOR o SUPERVISOR |
| Paciente/ingreso creado por error | Anular logicamente el ingreso/ficha si no tiene actividad clinica; retirarlo de listados operativos y conservarlo consultable como anulado. Si ya tiene actividad clinica, exigir revision especifica; no borrar en cascada ni reasignar registros automaticamente. | RECEPTION o SUPERVISOR solo para ingreso sin actividad |

Sin actividad clinica significa que solo existan registro de ingreso y
consultas/escaneos, sin triaje, signos,
evaluaciones, ordenes, resultados ni alta. La anulacion no libera claves de
recibos ni autoriza crear identidades duplicadas sin cotejo.
La ficha identificativa permanece para el cotejo de futuros ingresos y el
episodio anulado queda en historial; otros episodios de la persona no cambian.

Para episodios CLOSED, las rectificaciones son entradas historicas nuevas:
no cambian por si solas el estado del episodio ni devuelven tareas a pendientes.
Una reapertura debe ser una accion independiente y autorizada. No revertir en
cadena ordenes, resultados o decisiones posteriores a una nota corregida.

## Criterios de aceptacion

- Toda orden completada sigue consultable con su numero, EP y resultado, incluso
  en episodios cerrados. Los filtros no habilitan formularios de publicacion en
  ordenes completadas ni hacen desaparecer campos locales sin revisar cambios.
- Toda rectificacion/anulacion/reapertura exige motivo, sesion vigente, rol,
  version original e identificador de operacion; transaccion unica para cambio,
  historial y recibo. Repetir una intencion no duplica correcciones.
- Conflictos simultaneos exigen revision y conservan campos locales. Consultar
  historial no escribe ni reintenta operaciones por confirmar.
- Una alta reabierta conserva trazabilidad; no permite dos episodios activos de
  la misma identidad confirmada ni crea otro episodio para simular deshacer.
- Los originales, recibos e identificadores existentes siguen disponibles. No
  eliminar datos fisicamente ni editar registros previos de auditoria.
- Pruebas por rol, ACTIVE/CLOSED, idempotencia, version, concurrencia, migracion
  sobre datos previos y flujo de interfaz completo, con bases ficticias.

## Exclusiones

- Política y roles de la tabla autorizados. Anulación lógica para Eliminar;
  borrado definitivo no incluido.
- Sin fusion de pacientes, traslado masivo de registros ni deshacer automatico
  de acciones clinicas posteriores. No editar el resultado ya confirmado de
  EP-17 para probar la funcionalidad nueva.
- Migración aditiva de `record_changes`; conserva las filas clínicas y recibos
  anteriores. No hay commit ni push autorizados para este bloque.
