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
