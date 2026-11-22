# Respaldo y restauracion de la base del demo local

La base predeterminada es `backend/clinical.db`. El comando usa la API de respaldo de
SQLite para obtener una copia consistente aunque la API este encendida. Guarda
la copia y su SHA-256 en `backups/`, directorio ignorado por Git. No imprime
datos clinicos ni tokens.

Si se inicia una copia mediante `demo.ps1 Start -Database`, el respaldo sin
`--source` sigue apuntando a la base predeterminada. Indicar la copia activa
explicitamente; ver [el ensayo LAB y su respaldo](LABORATORY_ACTIVATION.md).

Desde la raiz del repositorio, en PowerShell:

```powershell
.\.venv\Scripts\python.exe scripts\demo_db_backup.py backup
```

El comando muestra la ruta exacta del archivo creado. Conservala junto al
archivo `.sha256` del mismo nombre. Para comprobar una copia existente:

```powershell
.\.venv\Scripts\python.exe scripts\demo_db_backup.py verify backups\NOMBRE.sqlite3
```

La verificacion comprueba el SHA-256, `PRAGMA integrity_check`, las referencias
foraneas y las tablas necesarias para este demo. Una copia creada antes de
nuevas escrituras representa el estado anterior; no incluye cambios posteriores.

Cuando la base contiene tablas del nuevo laboratorio, exige sus 12 tablas y
el marcador unico de esquema v2. Rechaza una familia incompleta o una version
incompatible tanto al respaldar como al verificar/restaurar, incluso si el
SHA-256 coincide. No ejecuta migraciones ni agrega datos. Las bases anteriores
sin tablas LAB siguen siendo compatibles. Esta validacion no acredita que una
orden este clinicamente completa ni que sus resultados esten revisados.

## Ensayo de restauracion sin tocar la base activa

```powershell
.\.venv\Scripts\python.exe scripts\demo_db_backup.py restore backups\NOMBRE.sqlite3 --target .tmp\clinical-restored.sqlite3
```

El destino no debe existir. El comando verifica primero la copia, restaura el
archivo en otra ruta, comprueba su igualdad binaria e integridad y deja intacta
`backend/clinical.db`. Si ya existe `.tmp\clinical-restored.sqlite3`, usa otro
nombre. No hay sobrescritura automatica.

Para recuperar realmente la base activa tras un incidente, detener primero el
backend y conservar el archivo actual aparte antes de restaurar a la ruta
`backend/clinical.db`, que debe estar libre. Hacer esa sustitucion es una accion
separada: no se ejecuta durante el ensayo ni sin autorizacion explicita.

Las copias se crean por defecto en esta PC y pueden contener datos de pruebas
y sesiones. No subirlas a Git ni compartirlas. Para protegerlas frente a perdida
del disco, conservar una copia en otro dispositivo acordado con el usuario.

## Procedimiento manual de cada respaldo

Rutina acordada con el usuario el **22 de noviembre de 2026**:

- **Cuándo:** al terminar cada sesión de trabajo y antes de cambios importantes,
  como actualizar el demo o cambiar la base de datos.
- **Responsable del USB:** el usuario de esta PC lo conecta y después lo expulsa
  de forma segura y lo guarda separado del equipo.
- **Preparación y comprobación:** el asistente crea y verifica la copia cuando
  el usuario se lo pide. Puede solicitarse: **«Haz el respaldo de cierre en el USB»**.
- **Conservación:** se mantienen las copias anteriores; no se elimina ninguna
  como parte de esta rutina.

Es una rutina manual. No se ha programado una tarea ni se crea una copia al
cerrar Windows o la app. Cada copia requiere conectar el USB y solicitarla;
la solicitud sigue el procedimiento existente descrito a continuación.

1. Terminar los registros que deban entrar en la copia. Confirmar con `Status`
   la ruta de la base usada por el backend; un formulario aún sin enviar no está
   incluido en un respaldo de SQLite. La copia consistente puede hacerse con
   el backend encendido.
2. Crear el respaldo indicando esa ruta con `backup --source`. Para la copia
   de trabajo actual, desde la raíz del proyecto:

   ```powershell
   .\.venv\Scripts\python.exe .\scripts\demo_db_backup.py backup --source ".tmp\communication-rollout-20261030\clinical-communication-working.sqlite3"
   ```

3. Conectar el USB e identificar el dispositivo y su letra actual. Crear una
   carpeta nueva con fecha e identificador, conservando las copias anteriores.
   Copiar la base recién creada y su `.sqlite3.sha256` juntos; agregar una nota
   con fecha, versión del proyecto y la base de origen.
4. Ejecutar `verify` sobre la copia situada en el USB. La copia externa queda
   comprobada cuando verifica su SHA-256, integridad, referencias y esquema,
   no solamente cuando Windows termina de copiar archivos.
5. Comprobar la restauración desde ese USB con `restore --target` hacia un
   archivo nuevo en `.tmp`, sin reemplazar la base activa. Confirmar el mismo
   hash y los recuentos; esto no requiere abrir ni probar la app restaurada.
6. Registrar ruta de la copia externa, hash, fecha y resultado de verificación
   y restauración. Si un paso falla, conservar la última copia verificada y
   registrar el error; la nueva no se considera verificada.
7. Expulsar el USB de forma segura y guardarlo separado de la PC.

Por ahora se conservan las copias anteriores. Cualquier rotación que elimine
archivos requiere acordar antes cuáles se retienen y cuáles se retiran.
Revisar también la rutina si cambia la base activa o el equipo del demo.

## Ultimo respaldo de cierre: 22/11/2026

Carpeta `D:/MedicControlPlus-demo-20261122-574f8a1e` con
`clinical-20261122T225307Z-574f8a1e.sqlite3`, su `.sqlite3.sha256` y `LEEME.txt`.
Creado a las 6:53 p. m., hora dominicana. Verificacion desde USB y restauracion
hacia `.tmp/usb-restore-20261122-574f8a1e.sqlite3` aprobadas: 25 pacientes y
26 episodios, SHA-256 `7b1306185ad107dc837ca6103524f18fb84cb69ff3618acbee08fffe88db3a0f`.
El hash coincide con el respaldo inicial descrito abajo. Se conserva aquel y
la base activa; este respaldo es otra copia puntual, no una actualizacion automatica.

## Copia USB inicial verificada el 22/11/2026

La memoria Kingston DataTraveler 2.0, unidad D: en este ensayo, corresponde
a un disco USB distinto al NVMe de Windows. Carpeta nueva:
`D:/MedicControlPlus-demo-20261122-2311eb7d`.

Contiene `clinical-20261122T222347Z-2311eb7d.sqlite3`, su archivo `.sqlite3.sha256`
y `LEEME.txt` con instrucciones y la version del proyecto. El respaldo se
verifico desde el USB y se restauro a un archivo nuevo en
`.tmp/usb-restore-20261122-2311eb7d.sqlite3`, con igualdad de SHA-256,
integridad y 25 pacientes/26 episodios. La base activa no fue sustituida.

La letra del USB puede cambiar al reconectarlo: comprobar el dispositivo antes
de usar la ruta. Expulsar con seguridad al terminar y conservar separado de
la PC. La copia representa ese momento; guardar otra despues de nuevos cambios.
Es un respaldo de la base del demo, no de programas ni certificados HTTPS.
Evidencia detallada en [LOCAL_VALIDATION](LOCAL_VALIDATION.md).

Para resolver bloqueos del ejecutor de pruebas en Windows, consultar
[el diagnostico de validacion local](LOCAL_VALIDATION.md).
