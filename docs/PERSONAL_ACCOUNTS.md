# Cuentas personales y administrador separado

Entrega sobre ce16ed8, publicada en `b2265c2`; CI [39360417857](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39360417857)
aprobada: backend, frontend, lint y build. Prueba manual completada.

## Alcance y permisos

ACCOUNT_ADMIN es un perfil exclusivo de administracion de cuentas: no es el
supervisor clinico y no concede consultar episodios, QR, presencia, bandejas,
identidades o registrar actividad clinica. El servidor restringe tambien las
consultas, no solo los botones. No se han agregado turnos, areas, coordinacion,
asignacion asistida ni colas. [Diseno autorizado](PERSONAL_ACCOUNTS_PLAN.md).

El administrador puede crear usuarios personales con nombre visible y un perfil
de los seis existentes o ACCOUNT_ADMIN; activar/desactivar y restablecer claves
con motivo. Username (3-40 caracteres: letra minuscula inicial, digitos, punto,
guion y guion bajo), perfil e ID quedan estables; no se ofrecen edicion de rol,
renombrado ni borrado. El nombre visible no cambia la autoria historica.

Desactivar y restablecer revocan todas las sesiones de la cuenta; reactivar no
recupera tokens anteriores. Login y escrituras se serializan con esos cambios;
una escritura comprueba nuevamente la sesion dentro de su transaccion. No se
puede desactivar la cuenta propia ni dejar el demo sin administrador activo.
El restablecimiento propio requiere otro administrador para evitar revocar
la sesion antes de poder consultar su recibo. Crear un segundo administrador
es una accion explicita de un administrador ya autorizado.

## Primer administrador: procedimiento local

No hay cuenta administradora ni contrasena sembrada al arrancar, ni registro
publico. El procedimiento siguiente se hara solo al acordar la prueba guiada.

1. Terminar/revisar guardados y detener el demo mediante scripts/demo.ps1 Stop.
2. Crear respaldo verificado mediante scripts/demo_db_backup.py backup.
3. En la terminal visible de VS Code, desde la raiz del repositorio, ejecutar:

```powershell
.\.venv\Scripts\python.exe .\scripts\bootstrap_account_admin.py
```

4. Introducir usuario, nombre visible y motivo. Elegir una contrasena ficticia
   de 12-128 caracteres; introducirla dos veces cuando lo solicite. Los datos
   se validan antes de inicializar/migrar. El mensaje distingue longitud,
   coincidencia, formato, usuario ocupado y administrador ya existente sin
   revelar valores ni contrasenas. No se muestra
   al teclear. No pasarla como argumento ni pegarla en este chat/documentacion.
5. Solo permite la primera cuenta administradora, en una transaccion. Si ya
   existe un administrador, usar la gestion de cuentas; no repetir el alta
   para eludir una baja o cambiar credenciales.
6. Iniciar demo y seleccionar Cuenta personal / administrador de cuentas en
   Acceso. Introducir usuario y contrasena elegidos. No usar demo123 en cuentas
   personales ni reutilizar contrasenas reales en el demo.

El script requiere base existente y admite --database para ensayos aislados.
Inicializa/migra ese destino antes del alta; no sustituye ni restaura bases.
No configura una recuperacion de desastre del administrador: si no hay acceso
administrativo valido, revisar respaldo y procedimiento local, sin editar SQL
para saltarse las protecciones. Sigue siendo un demo local, no alta de campo.

## Guardados, versiones y auditoria

API exclusiva de ACCOUNT_ADMIN:

- GET /accounts: metadatos de cuentas y auditoria, sin credenciales.
- POST /accounts: crear cuenta con nombre visible, username, perfil, clave y motivo.
- PATCH /accounts/{id}/status: active booleano estricto y motivo.
- POST /accounts/{id}/password: nueva clave y motivo.

Todas las escrituras requieren Idempotency-Key; cambios de cuenta requieren
If-Match con su version consultada. Reutilizan atomic_write y /write-result
sin inventar un episodio; los recibos administrativos guardan solo metadatos.
La huella de intencion endurece el campo clave con PBKDF2 y sal por operacion,
evitando guardar una huella rapida del payload que facilite adivinar claves.
Auditoria account_changes: actor, cuenta, accion, motivo, fecha y metadatos
anteriores/nuevos. No almacena claves, hashes, sales ni tokens. Los errores de
validacion de cuentas/login omiten valores de entrada para no exponer claves.

La interfaz mantiene la version con que se inicio cada edicion; ante conflicto
consulta datos vigentes, conserva campos y requiere revisar la nueva version.
Pausa actualizacion automatica mientras se edita y avisa al salir/recargar.
Las contrasenas y formularios administrativos no se guardan como borradores
persistentes: se pierden al recargar o salir. Envios inciertos conservan la
operacion original solo en RAM, como el cliente compartido; localStorage
contiene referencias opacas, nunca la clave o el cuerpo. Tras recarga se puede
consultar el recibo, pero no reenviar un cuerpo que ya no esta disponible.
Las referencias estan aisladas por API, usuario y rol. Una confirmacion tardia
solo limpia campos si coinciden con la operacion original; no borra ediciones
actuales por inferencia.

## Migracion y ensayo

Rutina transaccional e idempotente: app/accounts.py:migrate_accounts. Agrega
users.display_name, users.account_revision y account_changes. SQL 007 documenta
el cambio. Conserva usuarios, hashes, sesiones y toda la autoria anterior.
El verificador de respaldos exige account_changes si ve el esquema nuevo.

Antes de desarrollar se detuvieron ambos servidores propios para evitar que
reload migrara la base activa. Respaldo verificado:
backups/clinical-20261020T014942Z-d914d8cd.sqlite3.
SHA-256: 016670f498eccbcc229b1674b862dbf535f8b3d560d5300a9d2707a33fe1b7fe.

Restauracion y migracion aisladas:
.tmp/accounts-rehearsal-645deb2ece3d4a9d9b06830aec24e75c/clinical.db.
Comparacion de todos los campos/filas anteriores aprobada; 20 pacientes,
21 episodios y 6 usuarios conservados. Integridad SQLite y referencias correctas;
auditoria vacia y sin administradores creados automaticamente. SHA de la base
activa comprobado sin cambios. Estos destinos estan ignorados por Git.

## Validacion y siguiente paso

31 pruebas backend dirigidas y 45 frontend dirigidas aprobadas.

- Cobertura completa backend: 252 casos. La primera ejecucion aprobo 35 y
  detecto incompatibilidad de firma en una llamada directa a autenticacion.
  Se conservo la firma anterior; 16 casos de cuentas afectados y 217 pendientes
  aprobaron (233 en 384,52 s), conservando los otros 19 aprobados.
- Frontend: 560/560 en 54 archivos, 361,50 s. Lint sin advertencias y build
  aprobados. Casos de acceso, conflictos, duplicados, envios inciertos, cierre
  y aislamiento de campos/credenciales incluidos en App.accounts.test.tsx.
- Caso dirigido final aprobado tras ocultar valores en errores de login y
  ajustar representacion del modelo de clave sin metadata repr incompatible.
  Contrasenas ausentes de str/repr y respuestas. Una advertencia restante
  de Starlette/AnyIO es deprecacion de dependencia, no un fallo de aplicacion.
- UTF-8, enlaces locales y diff revisados. El script de alta muestra ayuda
  correctamente. Usuario ejecuto despues el alta contra la base activa,
  segun autorizacion de prueba guiada.

Primer intento manual: esquema migrado, pero alta rechazada con mensaje
generico. Revision de solo lectura confirma cero administradores, admin.demo
libre, integrity_check correcto y cero referencias invalidas. No se leyo
contrasena ni hash. Respaldo anterior al intento renovado en
backups/clinical-20261020T021408Z-afc4d296.sqlite3, mismo SHA indicado arriba.

Correccion posterior: BootstrapError solo transmite mensajes controlados;
validacion antes de migrar y comprobacion de usuario ocupado bajo transaccion.
21 pruebas dirigidas posteriores aprobadas (5 nuevas de CLI y 16 de cuentas),
con bases temporales: longitud/espacios, coincidencia, alta correcta, segundo
intento y nombre ocupado, sin exponer claves ni modificar base con datos invalidos.
No se repiten suites frontend/backend completas porque el ajuste esta acotado
al alta local. Usuario confirmo reintento correcto: comprobado admin.demo
activo, una sola alta BOOTSTRAP auditada, integridad y referencias correctas,
20 pacientes/21 episodios conservados. Demo iniciado para continuar prueba
manual. Usuario confirma acceso separado de admin.demo sin navegacion clinica,
creacion de medico.demo1 (Medico Demo Uno) activa con auditoria CREATE, autor
y motivo; acceso personal medico con Centro de control y sin administracion.
En Edge admin / Chrome medico, confirma baja con revocacion de sesion,
reactivacion que no revive el token anterior pero permite nuevo login, y
restablecimiento que revoca sesion, rechaza clave vieja y acepta nueva.
Prueba manual del bloque completada; claves no compartidas ni registradas.
Publicacion y CI completadas en b2265c2; main limpia y sincronizada al verificarlo.

El PDF y QR de EP-21 siguen publicados en ce16ed8; no se repiten esas pruebas.
Impresion fisica, fusion, cambios de perfil, cambio propio de clave, SSO y correo
de recuperacion no estan implementados en este bloque.
