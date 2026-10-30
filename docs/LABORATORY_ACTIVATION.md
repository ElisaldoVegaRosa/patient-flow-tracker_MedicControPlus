# Ensayo controlado del laboratorio por muestras

Las rutas LAB estan integradas en la API principal, pero requieren el esquema
completo v2. El arranque normal no crea ese esquema. Sin el, las operaciones
nuevas autorizadas responden 409 con `laboratory_not_enabled`. El alta publica
sigue siendo `POST /episodes/{id}/discharge`; el POST experimental `lab-discharge`
no se registra en la aplicacion principal.

## Copias preparadas el 28/10/2026

- Original: `backend/clinical.db`, sin tablas LAB y sin sustituir.
- Respaldo anterior: `backups/laboratory-before-20261028.sqlite3` y su `.sha256`.
- Snapshot preparado: `.tmp/laboratory-rollout-20261028/clinical-lab.sqlite3` y su
  `.sha256`. Se preservaron estructura y contenido de las 26 tablas anteriores:
  21 pacientes, 22 episodios. No se convirtieron ordenes antiguas.
- Restauracion de comprobacion: `.tmp/laboratory-rollout-20261028/restored-check.sqlite3`,
  identica al snapshot preparado por SHA-256.

Las copias contienen datos y sesiones del demo; no deben compartirse ni subirse
a Git. Este respaldo local no reemplaza la copia en otro disco acordada para D:.
Si hubo nuevas escrituras en el demo despues del snapshot, preparar otro snapshot
en rutas nuevas antes de hacer el ensayo. No existe fusion automatica entre bases.

## Preparar otra copia sin modificar el origen

Desde la raiz del proyecto, elegir rutas que todavia no existan:

```powershell
.\.venv\Scripts\python.exe .\scripts\prepare_laboratory_demo.py --source .\backend\clinical.db --destination .\.tmp\otro-ensayo-lab\snapshot.sqlite3 --backup .\backups\otro-ensayo-lab.sqlite3
```

El comando usa respaldo SQLite consistente, verifica integridad y referencias,
migra solamente un temporal privado y coteja cada tabla anterior antes de
publicar el resultado y su SHA-256. El respaldo anterior se conserva aunque
falle la migracion. Rechaza destinos existentes, archivos auxiliares previos,
alias del origen y la ruta predeterminada `backend/clinical.db`.

## Inicio del ensayo: requiere coordinacion previa

El 28/10 el usuario autorizo el ensayo y se inicio la copia con ambos puertos libres.
Status confirmo servicios propios y la ruta de trabajo; no hubo parada previa.
Para repetir el cambio, primero terminar o conservar
los formularios abiertos y cerrar las sesiones del navegador. El usuario debe
confirmar el inicio de la prueba manual antes de detener los servicios.

Usar una restauracion de trabajo, conservando el snapshot y su checksum intactos.
La siguiente ruta de trabajo ya esta preparada; no repetir restore sobre ella:
`.tmp/laboratory-rollout-20261028/clinical-lab-working.sqlite3`.

Para una preparacion nueva, restaurar a otra ruta libre, por ejemplo:

```powershell
.\.venv\Scripts\python.exe .\scripts\demo_db_backup.py restore .\.tmp\otro-ensayo-lab\snapshot.sqlite3 --target .\.tmp\otro-ensayo-lab\working.sqlite3
```

Una vez coordinado el ensayo de la copia actual:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\demo.ps1 Stop
$labWorkingCopy = (Resolve-Path .\.tmp\laboratory-rollout-20261028\clinical-lab-working.sqlite3).Path
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\demo.ps1 Start -Database $labWorkingCopy
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\demo.ps1 Status
```

`Status` muestra la base del backend propio. El controlador verifica la copia
antes de lanzar procesos y conserva el entorno de la terminal. Si un backend
propio usa otra base, `Start` exige detenerlo; no lo adopta, sustituye ni reinicia.
Los puertos ajenos siguen bloqueando el inicio. `Stop` solo detiene procesos
propios comprobados por PID, ejecutable y fecha de creacion.

Abrir manualmente `http://localhost:5173/` e ingresar nuevamente con las cuentas
del demo. La copia de trabajo recibira los cambios de la prueba; el original y
los snapshots permanecen separados. La eleccion de base no configura red local
externa, HTTPS ni despliegue clinico.

Para volver al demo anterior, detener la copia y ejecutar `Start` sin `-Database`.
Los registros escritos durante el ensayo permanecen en la copia de trabajo;
no aparecen automaticamente en la base anterior.

## Respaldar la base que realmente se esta usando

El comando de respaldo sin `--source` siempre usa `backend/clinical.db`.
Durante el ensayo debe indicarse la copia de trabajo explicitamente:

```powershell
.\.venv\Scripts\python.exe .\scripts\demo_db_backup.py backup --source .\.tmp\laboratory-rollout-20261028\clinical-lab-working.sqlite3
```

Los checksums corresponden a snapshots, no a un archivo operativo que sigue
recibiendo escrituras. Conservar juntos cada respaldo y su `.sha256` y verificar
el respaldo generado. La restauracion siempre requiere un destino libre.
