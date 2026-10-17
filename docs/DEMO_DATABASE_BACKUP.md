# Respaldo y restauracion de la base del demo local

La base activa es `backend/clinical.db`. El comando usa la API de respaldo de
SQLite para obtener una copia consistente aunque la API este encendida. Guarda
la copia y su SHA-256 en `backups/`, directorio ignorado por Git. No imprime
datos clinicos ni tokens.

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

Las copias quedan en esta PC y pueden contener datos de las pruebas y sesiones.
No subirlas a Git ni compartirlas. Una copia en el mismo disco ayuda ante errores
de la app, pero no protege frente a perdida del disco; para eso haria falta otro
destino acordado con el usuario.

Para resolver bloqueos del ejecutor de pruebas en Windows, consultar
[el diagnostico de validacion local](LOCAL_VALIDATION.md).
