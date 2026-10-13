# Revisión transversal de escrituras 53–58

Revisión del 12 de octubre de 2026, basada en el código y las pruebas existentes.
No modifica comportamiento, base de datos ni contratos HTTP. No autoriza una
nueva implementación por sí sola. Se conservan las validaciones y CI aprobadas
de 58. Posteriormente el usuario autorizó la propuesta 59 con un plazo común
configurable de 30 segundos. Implementación local validada: 362 pruebas
frontend, lint y build aprobados. El ajuste posterior del panel agrega un caso
verificado (363 distintos). Aviso de plazo y consulta posterior del mismo
intento confirmados directamente por el usuario. Etapa 59 cerrada y publicada:
implementación `099f4f3`, corrección de pruebas `15c13d9`; CI `38303904910`
aprobada con 143 pruebas backend, 363 frontend, lint y build.

## Cobertura común comprobada

| Situación | Mecanismo compartido | Evidencia |
|---|---|---|
| Doble acción mientras se envía | Bloqueo síncrono por recurso, 53A | usePendingOperations y pruebas de formularios |
| Reintento con la misma intención | Clave, transacción y recibo atómicos, 53B | test_write_operations.py, incluido concurrencia y rollback |
| Dos sesiones modifican un estado | If-Match en triaje, alta, tareas y alertas, 55 | test_concurrency.py y useVersionedWrites.test.ts |
| Respuesta perdida o ilegible | Solicitud en memoria y consulta/reintento explícitos, 56 | client.uncertain.test.ts, UncertainWrites.test.tsx |
| Datos remotos cambian mientras se edita | Sondeo de vista visible, campos y versiones conservados, 57 | useLiveRefresh.test.ts y App.liveRefresh.test.tsx |
| Recarga con resultado incierto | Referencia mínima aislada por identidad y consulta del recibo, 58 | writeRecovery.test.ts, RecoveredWrites.test.tsx y prueba directa |

Las diez rutas operacionales POST/PATCH (ingreso, triaje, signos, evaluación,
orden, alta, completar tarea, alerta, demo y reglas) utilizan atomic_write.
El cliente central les aplica claves y, tras vincular identidad, referencias.
Añadir registros independientes permite claves distintas; no necesita congelar
todo el episodio. Las versiones protegen los cambios de estado correspondientes.

## Vacío prioritario: espera sin plazo común

Los siguientes hallazgos describen la implementación publicada hasta 58;
la corrección común está implementada y validada localmente como 59.

api/client.ts espera fetch y response.json sin un límite propio. Los finally que
liberan bloqueos dependen de que termine la promesa. useLiveRefresh impide una
segunda consulta mientras running sea verdadero; un GET pendiente puede detener
el sondeo. La consulta de referencias recuperadas es secuencial: una consulta
colgada puede demorar las siguientes. El cambio de sesión rechaza respuestas
tardías, pero no aborta todas las peticiones activas mediante un mecanismo común.

Se trata de un riesgo identificado por inspección, no de un fallo observado
en producción ni de una prueba de corrupción de datos. Las pruebas actuales
cubren solicitudes diferidas que finalmente se resuelven; no establecen un plazo
de aplicación ni el comportamiento del vencimiento de ese plazo.

## Propuesta 59: espera y cancelación comunes

Una entrega para todas las solicitudes del cliente, incluidos acceso, consultas,
escrituras, recibos y actualización automática:

- Definir plazos configurados y mensajes consistentes; cubrir también la lectura
  del cuerpo, respetar señales externas y limpiar temporizadores/listeners.
- Liberar bloqueos al vencer la espera. En una escritura enviada, conservar
  clave, cuerpo en memoria y referencia; mostrar resultado por confirmar.
- Permitir consultar el recibo y reintentar explícitamente con la misma clave.
  Nunca interpretar la cancelación local como rollback del servidor.
- Interrumpir peticiones de una sesión anterior y descartar sus respuestas,
  sin afectar solicitudes de la nueva sesión ni borrar sus referencias.
- Recuperar el sondeo y continuar las consultas de referencias después del
  vencimiento de un GET, conservando datos y avisos anteriores.
- Evitar repetir automáticamente cualquier envío, incluido el escaneo GET
  que registra un evento. Autenticación conserva su tratamiento propio.

Criterios de aceptación: pruebas con reloj controlado para fetch pendiente,
cuerpo pendiente, respuesta tardía, señal externa, cambio de sesión, liberación
del bloqueo, recuperación del sondeo y consulta de recibos. Una escritura cuyo
servidor confirmó después del plazo se consulta sin insertar otra vez. Validación
frontend completa, lint/build y prueba directa con una demora controlada.
Plazo aprobado: 30000 ms, configurable con VITE_REQUEST_TIMEOUT_MS.

## Límites que no son defectos de duplicación

- Dos sesiones pueden abrir un episodio. El control es por versión al guardar;
  no existe reserva exclusiva ni indicador de presencia.
- Una clave nueva, incluso con texto idéntico, es una nueva intención. Comparar
  textos o bloquear todo el episodio podría impedir registros legítimos.
- Tras recargar no se conserva texto clínico para reconstruir un reintento.
  Cambiar eso requiere un diseño de almacenamiento aprobado por separado.
- Revisar manualmente un resultado desconocido permite nuevas acciones pero
  no acredita el fallo anterior; la interfaz advierte esa limitación.
- Almacén local dañado y límite de 256 detienen nuevos envíos. Existe reintento
  de carga, pero no una reparación guiada del registro desde la interfaz.
- La retención indefinida de recibos evita reutilizar claves vencidas. Una futura
  política de archivo debe preservar esa reserva; no basta con borrar recibos.

El alcance recomendado se aborda en 59. Reparación guiada, archivo de recibos,
presencia y persistencia de borradores quedan como decisiones independientes,
sin prioridad de implementación asignada en esta revisión.

## Prueba directa de 59

En Chrome/Edge, cargar primero un episodio ficticio y completar una evaluación
sin guardar. Abrir DevTools > Network y crear un perfil personalizado con
latencia de 40000 ms y velocidades distintas de cero; seleccionarlo y guardar
una sola vez. Mantener la pestaña visible y esperar unos 30 segundos: debe
terminar la espera, liberar el bloqueo y mostrar resultado por confirmar con
el aviso de tiempo agotado. Offline provoca un fallo inmediato y no verifica
este plazo. Restaurar No throttling antes de cualquier consulta posterior.

Consultar el resultado desde el panel, sin volver a guardar. Un recibo confirmado
retira el aviso sin otro POST; unknown lo conserva, porque la demora/cancelación
local no permite inferir si el servidor recibió o confirmó la escritura.
Revisar los registros del episodio. No marcar una revisión manual sin hacerlo.
La configuración del perfil depende del navegador; no modifica el backend ni
la base de datos por sí misma. El usuario informó «Operación confirmada por el
servidor. No se ha creado otro registro» y mostró la actualización automática.
Queda confirmada la consulta del recibo de ese intento. En una repetición nueva,
el usuario mostró «Se agotó el tiempo de espera de la solicitud» en el panel:
queda confirmado el aviso explícito del plazo, sin atribuir a esta nueva
operación la confirmación del recibo anterior. No se registró una medición
manual exacta de duración; el plazo se verifica con reloj controlado en pruebas.
El texto genérico del panel ocultaba la causa registrada; se corrigió para
mostrarla. El ajuste pasa 12 pruebas dirigidas, incluida una nueva sobre el
mensaje de plazo agotado; lint/build aprobados. Total de casos distintos
verificados: 363 (última suite completa: 362 antes del ajuste). El usuario
confirmó el mensaje visible y después la consulta del mismo intento:
«Operación confirmada por el servidor. No se ha creado otro registro».
Prueba directa completa aprobada; publicación autorizada y CI aprobada.

## Recuperación de daño local: Etapa 60

- Implementación local autorizada: lectura separada de referencias válidas y
  dañadas, común a todos los envíos operacionales. Una entrada dañada deja de
  ocultar las referencias sanas y sus consultas de recibo.
- Consulta explícita por GET de daño con clave válida y propietario de la sesión
  verificado. Solo una confirmación del servidor retira esa entrada, comprobando
  antes que no cambió desde el comienzo de la consulta. Nunca reenvía el contenido.
- Sin confirmación, error, cambio de sesión o modificación en otra pestaña:
  conserva la referencia. Daño sin clave/propietario verificable conserva el
  bloqueo y ofrece orientación; no se atribuye al usuario ni se elimina.
- Revisar una referencia sana no habilita envíos mientras exista daño. No hay
  borrado masivo, migración de almacenamiento, persistencia clínica adicional,
  cambios backend ni modificación de datos locales.
- Validación final: 375 pruebas frontend (35 archivos, 12 casos nuevos), lint
  y build aprobados. Suite con un trabajador fuera del sandbox por un fallo de
  lectura de temporales. Una ejecución intermedia mezcló el panel cargado antes
  del ajuste de texto y su prueba posterior (374/375); la ejecución final pasó
  completa sin ampliar tiempos. Backend conserva la validación aprobada de 59.
- Prueba directa aprobada por el usuario: tras alterar solo createdAt de una
  referencia ficticia, la consulta confirmó el envío anterior; desapareció la
  referencia dañada y el historial mostró una sola evaluación de ese intento.
  La interfaz informó que conservó los campos actuales, sin reenviar.
- Entrega publicada: `fe7f802aa1888af67435f997d49f2a2259520386`.
  CI `38310344158` aprobada: 143 pruebas backend (1 warning conocido),
  375 frontend, lint y build. Etapa 60 cerrada dentro del alcance;
  cierre documental incluido en la publicación autorizada.

### Prueba directa propuesta para 60

Usar únicamente un envío ficticio por confirmar, como en la prueba de 59.
No alterar referencias de operaciones reales ni borrar almacenamiento.

1. Restaurar No throttling y no consultar todavía ese envío. En DevTools >
   Application > Local Storage > http://localhost:5173, localizar su entrada
   con prefijo mediccontrol:write-reference:v1:. Conservar su valor original
   completo para poder restaurarlo; no modificar la clave ni el campo owner.
2. Cambiar solo createdAt a 0 y recargar. Debe aparecer Referencia dañada y
   Consultar referencia dañada; las nuevas operaciones permanecen bloqueadas.
3. Consultar una vez. Un recibo confirmado retira esa referencia; comprobar el
   registro ficticio del episodio y que la consulta fue GET, sin otro POST.
4. Si el resultado es desconocido o falla la red, la entrada debe conservarse.
   Restaurar exactamente el valor original guardado y recargar; vuelve a ser
   una referencia válida por revisar, sin que la restauración acredite un fallo.
   Consultar o revisar los registros antes de habilitar nuevos envíos.

Las pruebas automatizadas cubren además coexistencia de referencias sanas,
propietario no verificable, doble clic, cambio de sesión y modificación de la
entrada por otra pestaña mientras la consulta está pendiente. No se introduce
una reparación manual automática para claves o propietarios perdidos.

Resultado confirmado por el usuario: mensaje de confirmación del envío anterior,
referencia dañada retirada y una sola evaluación correspondiente al intento.
Prueba directa del caso confirmado aprobada; no se atribuye a esta prueba manual
la cobertura de los casos desconocidos o de concurrencia, verificados en pruebas.

## Etapa 61: presencia compartida por episodio

- Implementación local autorizada: indicador de otras sesiones/pestañas en el
  episodio activo, agrupado por usuario y rol, con número de pestañas y sesiones.
  Distingue consulta y formularios con cambios sin guardar, sin transmitir campos.
- Renovación cada 15 segundos mientras la pestaña está visible; caducidad de
  45 segundos sin renovar. La pérdida de actualización muestra aviso de información
  posiblemente desactualizada, sin afirmar que el usuario trabaja a solas.
- Rutas GET/PUT/DELETE de presencia autenticadas y tabla aditiva episode_presence,
  documentada en backend/migrations/004_episode_presence.sql. PUT es renovación
  idempotente de metadatos; no entra en el diario de envíos clínicos.
- Solo NURSE/DOCTOR/SUPERVISOR pueden declarar EDIT; todos los roles autenticados
  pueden consultar. Sesiones revocadas, vencidas o usuarios inactivos se excluyen.
  No se exponen tokens, IDs de sesión ni identificadores de otras pestañas.
- Secuencia por pestaña evita que una renovación anterior sustituya un modo nuevo.
  Liberación al salir y pagehide, con marca temporal de cierre que impide renovar
  esa misma presencia durante 45 segundos. Restaurar desde bfcache usa otra clave.
  La salida es de mejor esfuerzo: una red fallida depende de la caducidad; esta
  presencia aproximada no reserva el episodio ni sustituye If-Match al guardar.
- Al cerrar el episodio se deja de renovar y se retira el panel. Se conserva el
  mecanismo existente para texto pendiente y conflictos. No se añade evento clínico
  ni recibo; las versiones clínicas y de triaje permanecen iguales.
- Validación final: 160 pruebas backend (17 nuevas, 1 warning conocido),
  386 frontend en 37 archivos (11 nuevas), lint y build aprobados. Suite frontend
  con un trabajador, sin ampliar tiempos; validación fuera del sandbox. Primer
  intento backend sin salida interrumpido. Pruebas dirigidas corrigieron el montaje
  del listener de edición y una comparación dependiente del orden de usuarios.
- Tras la suite completa se afinó solo la prueba de integración para comprobar
  If-Match del triaje: 2 pruebas de esa suite, lint del archivo y TypeScript pasan.
  Los flujos App anteriores aíslan el panel; App.presence.test.tsx prueba su
  integración real, campos conservados y retirada tras cierre remoto.
- Prueba directa confirmada por el usuario: presencia entre médico y enfermería,
  indicador de cambios sin guardar, retirada al salir del episodio, caducidad
  en Offline y recuperación al restablecer la conexión. El primer intento usaba
  un backend anterior sin las rutas nuevas; se reinició y se verificó su disponibilidad.
- Entrega publicada: `45013fc33a0310e88d07ad7e6c35eb6b0e4bb7ef`.
  CI `38325483200` aprobada. Prueba directa aprobada; Etapa 61 cerrada.
  Cierre documental incluido en la publicación autorizada.
  Datos clínicos locales conservados.

### Prueba directa propuesta para 61

1. En una ventana normal entrar como medico y abrir un episodio ficticio activo.
   En una ventana privada o en otro navegador entrar como enfermeria y abrir el
   mismo episodio. Mantener ambas ventanas visibles, preferiblemente lado a lado.
2. Esperar hasta 15 segundos. Cada ventana debe mostrar el otro usuario con su
   rol y estado Consultando, dentro de Otras sesiones en este episodio.
3. En enfermeria modificar Personal responsable sin guardar. Medico debe mostrar
   una pestaña con cambios sin guardar. Restaurar exactamente el valor inicial:
   después de la siguiente renovación debe volver a Consultando. Los campos de
   medico conservan su contenido; no se transmite el texto escrito.
4. Salir del episodio en enfermeria mediante Dashboard. La otra ventana debe
   retirar su presencia en la siguiente actualización. Si la liberación no llega,
   dejar 45 segundos sin renovar más hasta 15 segundos para la consulta visible.
5. Volver a abrir el episodio en enfermeria. Activar Offline solo en esa ventana:
   debe avisar que no pudo actualizar presencia; medico debe dejar de mostrarla
   tras la caducidad. Restaurar la red y enfocar enfermeria: vuelve a renovar.

Estas comprobaciones solo requieren abrir y editar campos, sin guardar nuevos
registros. El cierre del episodio, varias pestañas del mismo usuario, caducidad
exacta, roles y respuestas tardías están cubiertos por pruebas automatizadas.
