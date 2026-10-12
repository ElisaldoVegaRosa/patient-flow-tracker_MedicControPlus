# Escrituras atómicas e idempotencia (53B)

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

Cambio de sesión, HTTP 401 o salida explícita descartan claves y contenido.
Si quedaba incertidumbre o una escritura en curso, una bandera únicamente en
memoria exige revisar los registros antes de otro POST/PATCH operacional.
Autenticación y lecturas siguen disponibles. Aceptar esa revisión no reenvía y
no recupera la clave descartada; no equivale a una confirmación del servidor.
Un 401 definitivo de la propia escritura no se clasifica como guardado incierto,
pero conserva la revisión exigida por otra escritura interrumpida.

Recargar, cerrar la pestaña o reiniciar pierde tanto solicitudes como esa bandera.
Esta entrega no garantiza recuperar ni deduplicar una intención después de esos
eventos. No guarda contenido clínico ni claves nuevas en almacenamiento del
navegador y no modifica el esquema SQLite.
