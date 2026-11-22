# Guía breve de arranque y contingencia del demo

Configuración comprobada hasta el 22 de noviembre de 2026, versión `1f65d6d`.
Esta guía corresponde al demo con datos ficticios de esta PC. Las rutas y la
dirección de red deben revisarse si se mueve a otro equipo o cambia la red.

## 1. Abrir la terminal correcta

En VS Code, abre **Terminal > Nueva terminal** y selecciona **PowerShell**.
Sitúate en la carpeta del proyecto:

```powershell
Set-Location -LiteralPath "C:\Users\Admin\Desktop\patient-flow-tracker_MedicControPlus"
```

La base usada en los ensayos está en
`.tmp\communication-rollout-20261030\clinical-communication-working.sqlite3`.
Los siguientes arranques la seleccionan expresamente. La orden `Start` sin
`-Database` selecciona otra base predeterminada; no equivale a retomar esta copia.

## 2. Consultar antes de iniciar

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\demo.ps1 Status
```

Si los servicios aparecen como **propio; responde** y la base coincide con la
ruta anterior, puedes abrir el demo. Si están detenidos, elige un arranque:

**Para usar el demo en esta PC:**

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\demo.ps1 Start -Database ".tmp\communication-rollout-20261030\clinical-communication-working.sqlite3"
```

**Para usar también el teléfono:** activa la Wi-Fi de la PC y conecta PC y
teléfono a **HOME-WIFI**. Comprueba que la IPv4 de Wi-Fi de la PC siga siendo
`192.168.100.40` con esta consulta en PowerShell:

```powershell
Get-NetIPAddress -InterfaceAlias "Wi-Fi" -AddressFamily IPv4 | Select-Object IPAddress
```

Si coincide, inicia el modo LAN:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\demo.ps1 Start -Database ".tmp\communication-rollout-20261030\clinical-communication-working.sqlite3" -LanConfig ".tmp\demo-lan\consult-result-20261122\network.json"
```

El certificado actual vence el **8 de diciembre de 2026**. Si vence, cambia la
IP o el controlador indica compilación desactualizada, preparar de nuevo el modo
LAN siguiendo [DEMO_LAN_HTTPS](DEMO_LAN_HTTPS.md). No ignorar avisos de certificado.
Si ya hay servicios con otra base o configuración, revisar los guardados antes
de acordar una parada y un nuevo arranque.

Vuelve a ejecutar `Status`. En modo LAN deben responder backend, frontend y
gateway. La respuesta HTTP confirma disponibilidad, no el circuito clínico.

## 3. Abrir y comprobar el contexto

- En la PC: <http://localhost:5173/>.
- En el teléfono con HOME-WIFI: <https://192.168.100.40:5443/>.
- Entra con la cuenta personal del rol que vas a utilizar. No copies contraseñas
  ni tokens en capturas, documentación o mensajes.
- Comprueba el nombre del paciente y el número de episodio antes de registrar.
  EP-24 conserva las pruebas de desconexión; EP-25 y EP-26 son casos integrales
  cerrados. Un nuevo ensayo debe acordar su caso ficticio y quién lo operará.

## 4. Si algo falla

| Lo que ves | Qué hacer |
|---|---|
| La página no abre en la PC | Ejecuta `Status`. Si están detenidos, usa el arranque con la misma base. Si un proceso propio no responde, revisa sus logs antes de reiniciar. |
| La página abre en la PC pero no en el teléfono | Revisa HOME-WIFI en ambos equipos, IP `.40` y certificado. Los dos routers del domicilio pueden usar el mismo rango IP y seguir siendo redes distintas. |
| Necesitas comprobar la conexión del teléfono | En otra pestaña abre <https://192.168.100.40:5443/api/health>. `"status":"ok"` confirma acceso a la API, no que se haya guardado una operación. Conserva abierta la pestaña con el borrador. |
| Aparece «Resultado por confirmar» | Conserva la pestaña y los textos. Tras reconectar, busca arriba **Guardados por confirmar → Evaluación · EP-… → Consultar resultado**. Consultar no reenvía. |
| El panel dice «Todavía no hay confirmación…» | No demuestra que el envío fallara. Si decides completar la misma operación, usa una vez **Reintentar operación original**, que conserva su clave. No uses el botón normal de Guardar para recrearla. |
| Sigue visible el antiguo «Failed to fetch» junto al formulario | Distingue ese error original del resultado más reciente en **Guardados por confirmar**. Tras un reintento confirmado, comprueba una entrada en el historial, campos limpios si no los editaste y retirada del panel. Las ediciones posteriores se conservan. |
| La sesión expiró | Sigue la recuperación de acceso y revisa los envíos anteriores que muestre la app antes de registrar otra operación. |
| Puerto ocupado, acceso denegado o estado ilegible | Conserva la salida de `Status` para revisarla. No mates procesos por nombre o puerto ni borres el archivo de estado para forzar el arranque. |

Los logs locales están en `.tmp\demo-control`. Antes de compartirlos, revisa su
contenido; no son parte del historial clínico del paciente.

## 5. Detener el demo

Primero termina las operaciones y revisa los guardados pendientes con las otras
sesiones abiertas. Al cerrar una sesión de trabajo, solicita el respaldo según
la rutina de la sección 6 antes de apagar la PC. Después:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\demo.ps1 Stop
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\demo.ps1 Status
```

`Stop` fuerza la parada de los árboles de procesos propios; no espera a que
terminen las solicitudes. No guarda formularios ni crea respaldos por sí mismo.

## 6. Localizar y comprobar el respaldo USB

Carpeta verificada en la Kingston USB:
`D:\MedicControlPlus-demo-20261122-574f8a1e`.
Contiene la base, su `.sqlite3.sha256` y `LEEME.txt` con instrucciones.
La letra puede cambiar al reconectar: comprueba el dispositivo antes de usarla.

Ese respaldo contiene **25 pacientes y 26 episodios**, con verificación desde
USB y restauración aislada aprobadas. Representa el estado al crearlo; los
cambios posteriores requieren otra copia.

La restauración de ensayo quedó en
`.tmp\usb-restore-20261122-574f8a1e.sqlite3`. No se activó como base del demo.
No sustituir una base en uso. Para recuperar tras un incidente, conservar primero
el estado actual y seguir [DEMO_DATABASE_BACKUP](DEMO_DATABASE_BACKUP.md).
El respaldo es de datos: la recuperación en otra PC necesita también el código,
las dependencias y una configuración LAN válida si se usará el teléfono.

Expulsa la memoria de forma segura al terminar y guárdala separada de la PC.
La rutina acordada es **al terminar cada sesión y antes de cambios importantes**.
Tú conectas y guardas el USB; solicita **«Haz el respaldo de cierre en el USB»**
para que el asistente prepare y verifique la copia y su restauración aislada.
Se conservan las copias anteriores. La rutina es manual: las copias no se
actualizan automáticamente ni se crean al cerrar la app o apagar Windows.

Más detalle: [operación](DEMO_OPERATIONS.md), [inventario](DEMO_READINESS.md) y
[resultados de validación](LOCAL_VALIDATION.md).
