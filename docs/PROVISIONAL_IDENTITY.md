# Identidad provisional y verificacion por admision/archivo

Entrega local del 19 de octubre de 2026, sobre 46a18b8. No publicada.
Problema: recepcion exigia documento y nacimiento incluso si se desconocian;
faltaba un permiso separado para verificar y un historial especifico.

## Alcance

Recepcion puede elegir identidad provisional y registrar solo datos conocidos.
Los datos ausentes son NULL, no fechas/documentos ficticios. Sin nombre se
genera una etiqueta Paciente desconocido seguida del ID de ficha; es una etiqueta
operativa, no una identidad verificada. El ingreso y el QR pertenecen al mismo
episodio durante toda la verificacion.

Estados de ficha:

- REGISTERED: datos registrados mediante el flujo habitual o anteriores a esta
  entrega; no implica verificacion retrospectiva por archivo.
- PROVISIONAL: datos pendientes de verificar, completos o parciales.
- VERIFIED: admision/archivo cotejo datos y registro motivo y fuente.

Las bandejas y el detalle avisan de identidad provisional; datos desconocidos
se muestran como no registrados. Signos, tareas y atencion pueden continuar.

Usuario exclusivamente demo: archivo, clave demo123, rol ADMISSION; aparece
como Admision/archivo. No utilizar estas credenciales en campo. El perfil puede
consultar pendientes y verificar; no crea ingresos ni ejecuta acciones clinicas.
Supervisor puede consultar la bandeja, pero no confirmar identidades.

API:

- POST /episodes conserva el contrato habitual; provisional=true permite NULL
  en name, birth_date y document. No permite seleccionar otra ficha a la vez.
  Con datos parciales coincidentes se exige revision; no se reutiliza una ficha
  provisional por similitud.
- GET /identity/pending: disponible para ADMISSION y SUPERVISOR, con episodio
  activo preferente o el ultimo episodio de la ficha si ya esta cerrado/anulado.
- PATCH /episodes/{id}/identity: solo ADMISSION, con Idempotency-Key e If-Match
  de identity_version. Requiere nombre, nacimiento y documento cotejados,
  reason y verification_source. Si faltan datos, mantener la ficha provisional;
  no inventarlos para completar el formulario.

La confirmacion conserva paciente, episodio, estado, QR y registros anteriores.
El historial patient_identity_changes guarda valores anteriores/nuevos, motivo,
fuente, autor y fecha; el episodio registra IDENTITY_VERIFIED. No cuenta como
actividad clinica a efectos de anular un ingreso sin atencion, pero se conserva
su auditoria. La identidad puede completarse aunque el episodio este cerrado
o anulado; esa accion no lo reabre ni cambia su estado.

Documento coincidente o nombre/nacimiento coincidentes con otra ficha bloquean
la confirmacion para revision. No se fusionan fichas ni se cambia patient_id.
No existe en esta entrega un flujo para resolver esa coincidencia, corregir una
identidad ya VERIFIED o deshacer una verificacion incorrecta: requiere alcance
posterior. El filtro de coincidencias es conservador y no prueba identidad.

## Protecciones compartidas

- Confirmaciones serializadas, con recibo atomico e idempotencia obligatoria.
- Version de identidad por ficha; dos sesiones no pueden confirmar el mismo
  borrador. Si cambia la identidad, tambien cambian versiones de los guardados
  clinicos ya protegidos (triaje/cierre/reapertura/anulacion).
- Se conserva la huella de recibos anteriores del ingreso habitual; provisional
  falso no agrega otro campo a su serializacion.
- La verificacion participa en envios inciertos/recuperados, bloqueo de doble
  envio, consulta del resultado y conflictos existentes.
- Borrador de archivo aislado por API/usuario/rol en sessionStorage, con plazo
  existente de 30 minutos y restauracion explicita. Conserva fuente, motivo y
  version original. El modo provisional del ingreso se conserva tras recarga.
- Los campos de archivo con cambios avisan al salir y pausan actualizacion del
  detalle; una identidad ya verificada no vuelve a ofrecer un borrador para enviar.

## Migracion y respaldo

Inicializar backend agrega el perfil demo y el esquema nuevo. Una base antigua
reconstruye patients transaccionalmente para permitir NULL y agregar estado y
revision. No se renumera ni desvincula informacion. Se preservan secuencia
AUTOINCREMENT, indices y triggers; se comprueban referencias antes de confirmar.
Ante fallo se revierte y se reactiva foreign_keys. Esquemas parciales o distintos
de los reconocidos requieren revision, no una normalizacion automatica.

Rutina ejecutable: backend/app/patient_identity.py. La migracion SQL 006 documenta
la tabla de auditoria y remite a esa rutina para reconstruir patients. No ejecutar
un DROP/CREATE manual para actualizar una base. El verificador de respaldos exige
la auditoria cuando detecta el esquema nuevo; sigue aceptando snapshots antiguos.

Antes de ensayar app en esta PC se preparo:

- Respaldo local verificado: backups/clinical-20261019T235006Z-b947b8a5.sqlite3
  y su SHA-256; 19 pacientes y 20 episodios.
- SHA-256: b2a72e92b8989ec8debbd3e6d970cb3a96a10e0cae500e0d6594917b21271ce7.
- Restauracion y migracion aisladas en .tmp/identity-rehearsal-7bad73e343384d119488bb959f48445f/clinical.db.
- Comparacion de todos los campos anteriores y referencias, integridad SQLite
  y foreign_key_check aprobados; archivo original comprobado sin cambios.

Estos destinos son locales e ignorados por Git. No se actualizo la copia de D:
ni se migro la base activa. Si hay nuevos cambios antes de reiniciar, respaldar
otra vez. No arrancar el backend ni hacer prueba directa sin acordarlo: su
inicializacion aplicara la migracion al destino configurado.

## Validacion y siguiente paso

33 pruebas backend dirigidas y 67 frontend dirigidas aprobadas. Cobertura completa
sobre esta entrega local:

- Backend: 235 casos; 118 aprobados en el tramo inicial. Tras ajustar el test
  que esperaba cinco perfiles (ahora seis), los 117 pendientes aprobaron
  en 217,63 s. Se conservaron las comprobaciones de hashes y no duplicacion
  de usuarios al inicializar otra vez.
- Frontend: 535 casos en 52 archivos; 534 aprobaron en la suite (223,77 s).
  El unico fallo era un espacio introducido en la celda de paciente sin aviso
  provisional; corregido y comprobado con 11 casos afectados aprobados.
- Lint y build aprobados despues del ajuste. Diff sin errores de espacios,
  UTF-8 y enlaces locales comprobados.

Usuario autorizo prueba manual guiada. Respaldo previo renovado en
backups/clinical-20261020T001127Z-b802453d.sqlite3, mismo SHA-256 indicado arriba.
Demo iniciado y base activa migrada; integridad y referencias correctas,
19 pacientes/20 episodios conservados, todos REGISTERED, archivo/ADMISSION
disponible. Ambos servidores propios responden. El agente no opero formularios.
Usuario confirma prueba manual completa en EP-21: ingreso sin nombre, documento
ni nacimiento; asignacion de etiqueta provisional; confirmacion por archivo
con datos ficticios; mismo episodio activo, identidad verificada e historial
con valores anteriores/nuevos, fuente, motivo y autor. Tras actualizar la bandeja,
EP-21 ya no aparece entre pendientes. QR conservado cubierto por prueba
automatizada; no se hizo un nuevo escaneo en esta prueba manual. Commit autorizado;
publicacion pendiente de autorizacion explicita.

Exclusiones: fusion, administracion completa de cuentas, impresion, colas/turnos,
despliegue de campo y cambios de reglas clinicas.

Referencias: [plan del piloto](URGENCIAS_PILOT_PLAN.md),
[respaldo](DEMO_DATABASE_BACKUP.md),
[procedimiento SQLite para cambios de tabla](https://www.sqlite.org/lang_altertable.html).
