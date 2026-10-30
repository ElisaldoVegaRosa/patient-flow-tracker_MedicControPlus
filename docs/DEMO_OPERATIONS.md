# Operar el demo local en Windows

Este controlador es para la PC de desarrollo y datos ficticios. No configura
acceso de tabletas, HTTPS ni instalacion de campo. Usa los puertos 8000 y 5173
en loopback, sin recarga automatica del backend. Tras editar backend, detener
y volver a iniciar cuando no haya operaciones pendientes.

## Desde VS Code

Para ensayar el laboratorio nuevo con una copia verificada, consultar
[la activacion controlada](LABORATORY_ACTIVATION.md). `Start -Database` elige
una copia LAB existente; `Status` identifica la base del backend propio. Cambiar
de base requiere detener los servicios. `Start` sin esa opcion conserva la
base predeterminada y no migra LAB durante el arranque.

Abrir la carpeta del proyecto. En Terminal > Ejecutar tarea, elegir:

- **MedicControl+: Demo status**: comprueba procesos y respuesta HTTP.
- **MedicControl+: Demo start**: inicia backend y frontend si puede gestionar ambos.
- **MedicControl+: Demo stop**: detiene solo los procesos iniciados por este controlador.

La salida se ve en la terminal de la tarea. No se abre otra ventana ni un navegador
automaticamente. Una vez iniciado, abrir <http://localhost:5173/>.

Las tareas anteriores Start backend y Start frontend siguen disponibles para
desarrollo, pero son independientes: sus servidores no se adoptan ni se detienen.
Si ya estan funcionando, usar esa sesion o detenerlos desde su terminal cuando
sea oportuno; no iniciar una segunda copia en los mismos puertos.

## Desde PowerShell

Abrir Terminal > Nueva terminal en VS Code, con esta carpeta como raiz. Ejecutar
uno de estos comandos, segun la accion deseada:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\demo.ps1 Status
```

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\demo.ps1 Start
```

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\demo.ps1 Stop
```

Bypass solo afecta a este proceso de PowerShell, no cambia la politica global.
Sin argumento, se ejecuta Status. No hace falta ejecutar como administrador.

## Dependencias y diagnostico

Start necesita `.venv/Scripts/python.exe`, dependencias backend instaladas,
Node.js en PATH y `frontend/node_modules/vite/bin/vite.js`. Los comandos de
instalacion estan en [AGENTS](../AGENTS.md); no se instalan automaticamente.

Status distingue proceso propio, puerto libre y servicio no gestionado; consulta
GET /health en backend y la pagina inicial de frontend con limites de espera.
Una respuesta HTTP no prueba integridad de base, sesion ni circuito clinico.
Si responde un servicio no gestionado, no demuestra que corresponda a este repo.

El controlador guarda estado, bloqueo y logs locales en `.tmp/demo-control/`,
ignorado por Git. Los logs backend.log y frontend.log se pueden abrir en VS Code.
Revisarlos antes de compartirlos: no son un archivo publico ni una auditoria
clinica. Backend se inicia sin registro de accesos HTTP para evitar registrar
tokens QR en las rutas de escaneo.

- **Puerto ocupado**: no se inicia nada nuevo ni se cierra el servicio externo.
- **Proceso propio sin respuesta**: revisar logs; no se reinicia silenciosamente.
- **Dependencias ausentes**: instalar las indicadas en la guia antes de reintentar.
- **Fallo parcial de Start**: se intenta detener solo lo creado en ese intento;
  se conservan servicios propios que ya funcionaban y referencias de parada fallida.
- **Estado ilegible o acceso denegado**: detenerse y revisar. No borrar el archivo
  para forzar otra ejecucion ni matar procesos por nombre o numero de puerto.
- **Tras reiniciar Windows**: PID, fecha de creacion y ejecutable deben coincidir
  antes de detener un proceso. Una referencia caducada no autoriza cerrar otro.

## Antes de detener o reiniciar

Terminar las operaciones y revisar guardados pendientes con los usuarios del demo.
Stop fuerza la terminacion del arbol de cada proceso propio mediante taskkill:
no ofrece drenaje de solicitudes ni sustituye confirmar guardados. Si se interrumpe
un envio, consultar su resultado al volver a iniciar antes de crear otro.

Se compara PID, fecha de creacion y ejecutable antes de parar; nunca se adopta un
proceso por coincidir solo el puerto o su nombre. El archivo de estado es local:
no editar sus identificadores ni utilizarlo desde una carpeta compartida con
personas no autorizadas. El bloqueo de operacion se libera al salir el proceso.

## Respaldo y restauracion

Usar [la guia de respaldo](DEMO_DATABASE_BACKUP.md), que ya incluye verificacion
y restauracion aislada. Start, Stop y Status no copian, reemplazan ni restauran
la base de datos; iniciar backend ejecuta su inicializacion normal.
Una copia previa no se actualiza sola: considerar las modificaciones posteriores
al snapshot al preparar una demostracion.

## Validacion de esta entrega

Pruebas automatizadas de controlador con procesos y HTTP simulados; verifican
puertos ocupados, PID reutilizado, fallos, recuperacion parcial y referencias.
Prueba guiada ejecutada por el usuario: Start rechazo un backend externo sin
adoptarlo; tras identificarlo y detenerlo manualmente, Start inicio ambos
servicios. Status confirmo propio/responde; Stop detuvo ambos y Status confirmo
puertos libres. Nuevo Start/Status y captura del acceso confirmaron recuperacion.
No se crearon registros clinicos en este recorrido; no se probaron tabletas ni
impresion. No repetir pruebas directas sin consultar al usuario.

Resultado del 18 de octubre: suite backend 216/216 en 439,95 s sobre la primera
version del controlador. Despues de ajustar bloqueo Windows, parada oculta y
conservacion ante errores del sistema: 23/23 pruebas dirigidas de la version
final (0,70 s). Sintaxis PowerShell, JSON de tareas, diff, UTF-8 y enlaces locales
revisados. Frontend sin cambios; no se repitieron sus suites. Prueba guiada
de servidores completada posteriormente por el usuario, como se describe arriba.
Publicado en `361d33c`; [CI 39164657470](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39164657470)
aprobada: backend, frontend, lint y build.
