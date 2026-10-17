# Contrato común de escrituras y recuperación (53–59)

## Evaluacion de retencion: 17 de octubre de 2026

Inspeccion de codigo y lectura agregada de la base local con SQLite mode=ro y
query_only; no se inicio la API ni se modificaron datos. Resultado puntual:
14 recibos, 12 vencidos; 0 caracteres de resumen almacenado. Archivo principal
SQLite completo: 114688 bytes. EXPLAIN QUERY PLAN confirma busqueda mediante el
indice compuesto de write_receipts por username y operation_key. Estas cifras
son del demo local y no estiman volumen, latencia ni carga de produccion.

El plazo de 24 horas limita la repeticion de una escritura con la misma clave.
Despues se rechaza su reutilizacion con 409, mientras GET /write-result sigue
permitiendo consultar el resultado con usuario/rol vigentes. Los recibos vencidos
mantienen la reserva de claves. El codigo y las pruebas existentes
(test_key_conflicts_expiry_and_current_permissions y
test_expired_receipt_can_be_consulted_without_reusing_key) cubren este contrato.
No se repitieron suites aprobadas para esta revision exclusivamente documental.

Recomendacion: conservar el comportamiento actual y posponer archivo/limpieza;
no hay evidencia local de necesidad inmediata. Para retomarlo, medir volumen,
crecimiento, almacenamiento y consultas bajo carga representativa, o establecer
un requisito operacional concreto. Un diseno posterior debe conservar la reserva
de claves y acordar disponibilidad de resultados historicos, migracion y pruebas
de concurrencia antes de ejecutar cualquier limpieza. Sin plazo nuevo impuesto,
script de borrado, migracion ni implementacion autorizada por esta evaluacion.

## Contrato

Las escrituras de ingreso, evaluaciones, órdenes, signos, triaje, alta, tareas,
alertas, demo y reglas usan una infraestructura compartida. El escaneo también
usa la transacción porque registra un evento. Lecturas, acceso y salida mantienen
sus contratos. Toda ruta nueva que escriba datos operacionales debe incorporar
`atomic_write` y su fábrica de conexiones transaccional.

`BEGIN IMMEDIATE` reserva el escritor SQLite antes de comprobar estados. La
mutación, sus eventos y el recibo se confirman juntos. Cualquier excepción provoca
rollback y cierre de conexión; un bloqueo temporal devuelve HTTP 503. No hay
reintentos automáticos. Las rutas existentes pueden seguir usando commit/close:
la conexión de la operación delega su finalización al envoltorio compartido.

## Clave por intención

- Cabecera opcional `Idempotency-Key`: 16–128 caracteres ASCII alfanuméricos,
  guion o guion bajo. Los clientes antiguos conservan las transiciones atómicas,
  pero una inserción sin clave no puede deduplicarse por intención.
- El servidor distingue usuario, rol, método/ruta y huella SHA-256 del payload
  validado, incluidos los parámetros del recurso. No guarda el cuerpo clínico.
- Repetir una clave con la misma operación durante 24 horas no repite sus efectos.
  Para una respuesta clínica devuelve el detalle actual del episodio referenciado,
  que puede incluir cambios posteriores; no es una copia congelada de la respuesta.
  Demo/reglas conservan solamente su resumen operacional. Se mantiene el código
  de respuesta original de la ruta (200/201).
- Cambiar ruta o payload con la misma clave devuelve 409. Cambiar de rol devuelve
  403; cada solicitud comprueba además la sesión y permisos vigentes. Una clave
  vencida devuelve 409 y exige comprobar el resultado antes de otra intención.
- Las claves vencidas permanecen reservadas: no se borran automáticamente para
  evitar que un reintento muy tardío produzca otra inserción. Los recibos no
  contienen tokens, contraseñas ni copias de notas. Su crecimiento debe incluirse
  en una futura política de archivo que preserve la reserva de claves.
- Una nueva evaluación, incluso con contenido idéntico, usa una clave nueva.
  Dos dispositivos con claves distintas representan dos intenciones distintas;
  no se infiere un duplicado comparando contenido clínico.

## Cliente

El cliente HTTP común crea claves UUID para POST/PATCH operacionales y conserva
la misma clave si falla la red, no puede interpretar la respuesta o recibe 5xx.
El reintento requiere una acción del usuario. Una respuesta definitiva consume
la intención; el siguiente envío recibe otra clave. Una respuesta tardía nunca
elimina la clave de una intención posterior. Headers explícitos son admitidos.

La asociación de payload y clave permanece solo en memoria (máximo 256 operaciones
ambiguas), durante la sesión actual. No se escribe en localStorage/sessionStorage;
recargar o cambiar de sesión pierde esa asociación. Ante un resultado incierto tras
esos cambios, hay que revisar los registros antes de crear una nueva intención.
La garantía entre conexiones o dispositivos exige compartir la misma clave;
las transiciones de estado también se protegen cuando las claves son diferentes.

## Esquema y pruebas

`backend/migrations/003_write_receipts.sql` documenta la tabla creada de forma
aditiva e idempotente al iniciar la API. No modifica registros clínicos existentes.
Las pruebas usan bases temporales, concurrencia real con conexiones separadas,
respuesta perdida simulada, claves conflictivas/vencidas, identidad, permisos,
sesión revocada, episodios cerrados, fallo posterior a la escritura y bloqueo SQL.

## Versiones y conflictos entre sesiones (55)

Las nuevas escrituras de triaje, alta, completar tareas y modificar alertas
requieren `If-Match`. Copiar el valor opaco, incluidas sus comillas, desde la
lectura del recurso: `triage_version`, `clinical_version` o `version` de la
tarea/alerta. La bandeja LAB incluye la misma versión de tarea que el episodio.
Clientes anteriores deben actualizarse: sin precondición se responde 428;
no se conserva un modo de escritura ciega para estas rutas. Permisos y estados
terminales conservan sus rechazos; una versión desactualizada de un recurso
activo devuelve 409 con `detail.code = "version_conflict"` y mensaje de revisión.

Las versiones son SHA-256 del estado persistido relevante y su historial. No
requieren migración ni escriben revisiones adicionales. Triaje usa sus campos y
sus eventos (también distingue escrituras consecutivas con valores idénticos);
tareas y alertas usan su propio estado. Alta considera la información clínica
actual, incluidas evaluaciones, signos, tareas y alertas. `QR_SCANNED` queda fuera.
Añadir registros nuevos no exige una versión global ni reserva el episodio.

La comparación ocurre dentro de la transacción compartida antes de mutar.
Una escritura conflictiva no produce eventos, cambios ni recibo. Reintentar un
recibo confirmado se resuelve antes de comprobar la versión: la misma intención
no repite efectos aunque operaciones posteriores hayan cambiado los datos.

El frontend captura la versión al editar y la conserva ante errores y HTTP 401.
Un conflicto exige consultar y revisar datos actuales; aceptar la revisión no
escribe. Conserva los campos locales y actualiza la información consultada.
Guardar de nuevo usa la versión revisada y una nueva intención. Una respuesta
perdida mantiene clave y versión anteriores, sin reenvío automático. Restaurar
un borrador sin versión anterior obliga a revisar mediante el mismo conflicto.
Salir, logout y cambio de sesión limpian conflictos; respuestas tardías no los
reviven. No ofrece continuar sobre un episodio cerrado, tarea completada o
alerta resuelta. No implementa presencia en tiempo real ni bloqueo exclusivo.

Las pruebas anteriores de flujos adquieren la versión mediante una lectura API
antes de cada intención nueva (`backend/tests/conftest.py`). Las pruebas de
concurrencia envían versiones explícitas congeladas o vacías: cubren dos sesiones,
428, conflicto, rollback, revisión, permisos e idempotencia. No omiten el control
de producción ni actualizan automáticamente versiones en los casos de conflicto.

## Resultados por confirmar (56)

El cliente distingue fallos de red, HTTP 5xx y respuestas ilegibles de rechazos
definitivos. Conserva en memoria la solicitud original y muestra un panel común.
Una intención distinta para esa ruta no puede enviarse mientras la anterior siga
incierta. El reintento requiere otra acción explícita y conserva cuerpo, clave y
versión; comparte el bloqueo por recurso de los formularios. El vencimiento de
24 horas impide el reintento desde el panel, pero no la consulta.

`GET /write-result`, con `Idempotency-Key`, consulta exclusivamente un recibo
del usuario autenticado y exige el mismo rol. No crea ni reproduce operaciones,
eventos o recibos. Devuelve `unknown` si no encuentra un recibo: una escritura
en curso todavía podría confirmar después. Un recibo existente devuelve
`confirmed` y el detalle actual del episodio o resumen operacional, incluso si
el plazo para reintentar expiró. Ese detalle puede incluir cambios posteriores.

Confirmar limpia la intención y actualiza la vista correspondiente sin otro POST.
Conserva formularios ajenos y ediciones posteriores; solo limpia el borrador
original cuando sus campos aún coinciden con el contenido confirmado. No adopta
silenciosamente una versión de triaje modificada por otra sesión debajo de nuevas
ediciones locales. Un rechazo por versión al reintentar utiliza la revisión de 55;
otros rechazos definitivos permanecen visibles.

Cambio de sesión, HTTP 401 o salida explícita descartan el contenido original
y su asociación en memoria. Desde 58, las referencias persistidas se conservan
para la misma identidad, rol y API al volver a entrar. Solo cuando no existe
una referencia persistida que cubra el envío interrumpido se utiliza la bandera
de revisión en memoria de 56. Aceptar una revisión no confirma ni reenvía.
Un primer rechazo 401 de la escritura retira su referencia nueva; si hubo un
intento incierto anterior con esa clave, el rechazo no elimina su referencia.

## Actualización entre sesiones (57)

Dashboard, supervisor, bandeja LAB y episodio abierto comparten consultas cada
15 segundos después de terminar la anterior. Solo se consulta la vista activa
y visible; el regreso a la pestaña solicita una actualización. Se pausa durante
operaciones pendientes y se descartan respuestas de otra vista/sesión o previas
a una escritura. Conserva campos editados y sus versiones originales.
No reserva episodios ni impide entrar desde dos sesiones. El servidor comprueba
versiones y estados al guardar; ver datos actualizados no autoriza una escritura.

## Referencias recuperadas (58)

Antes de cada POST/PATCH operacional, el cliente vinculado a una identidad
autenticada persiste una entrada por clave en localStorage. Solo incluye clave
opaca, tipo de acción, fecha, revisión y huella SHA-256 de usuario/rol/API.
No persiste rutas, IDs clínicos, cuerpos, versiones, respuestas ni nuevos tokens.
La asociación necesaria para reintentar el contenido original sigue en memoria.

Al entrar, recupera las referencias existentes de esa identidad y consulta
GET /write-result secuencialmente, una vez por referencia en esa sesión.
Un recibo confirmado retira el aviso y permite refrescar sin borrar formularios
actuales. Un resultado desconocido o error conserva el aviso; exige confirmación
o revisión manual antes de nuevos envíos. La revisión habilita acciones nuevas,
conserva el aviso y no demuestra que el envío anterior haya fallado. La retirada
manual solo está disponible después de revisar. No hay reenvío automático.

Las referencias nuevas de otra pestaña no se incorporan como recuperaciones
a una pantalla ya abierta. Detectar otro token interrumpe la sesión local sin
borrar el token de la otra pestaña. La recuperación exige el mismo navegador,
perfil y almacenamiento; no reconstruye claves anteriores a esta funcionalidad.
No caduca ni desaloja referencias automáticamente. El límite es 256 por identidad;
si el registro no puede leerse o persistirse, bloquea el envío antes de fetch.

## Límites y revisión transversal

Desde 59, un plazo común de 30000 ms cubre fetch y response.json conjuntamente.
VITE_REQUEST_TIMEOUT_MS acepta un entero positivo hasta 2147483647 ms;
configuración ausente o inválida usa 30000 ms. Se lee al iniciar/compilar Vite:
modificarla requiere reiniciar el servidor frontend o generar un nuevo build.
El vencimiento aborta el transporte y termina la espera incluso si la promesa
ignora la señal. Libera bloqueos y permite continuar sondeo/consultas de recibos.
Abortar no garantiza cancelar la escritura en el servidor: conserva clave,
contenido en memoria y referencia, y exige consulta o reintento explícitos.
No repite automáticamente ni POST/PATCH ni el escaneo GET que registra eventos.

Una señal externa ya cancelada impide enviar. Una cancelación durante un envío
se trata como resultado incierto; su reintento no hereda la señal cancelada.
Cambiar sesión interrumpe las solicitudes anteriores, preserva referencias y
rechaza respuestas tardías. Un evento de cambio de token de otra pestaña termina
la espera sin borrar el token nuevo. Logout puede terminar su revocación remota
después de borrar la sesión local, conservando plazo y rechazo de respuesta vieja.
Temporizadores y listeners se limpian al terminar cada solicitud.

GET /scan registra QR_SCANNED dentro de una transacción, pero el cliente no
genera para él la clave ni la referencia de POST/PATCH. Escanear repetidamente
puede registrar varios eventos; no equivale a duplicar una evaluación.
Las claves diferentes entre dispositivos siguen representando intenciones
distintas. Los recibos reservados crecen sin archivo automático. Estas limitaciones
requieren alcance propio; no se corrigen silenciosamente en esta revisión.

Evaluación y propuesta de siguiente entrega: [revisión transversal](WRITE_FLOW_REVIEW.md).
