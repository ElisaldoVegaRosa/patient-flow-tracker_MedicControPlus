# Ensayo HTTPS del demo en red local

## Alcance y aceptación

Ensayo manual confirmado por el usuario el 8 de noviembre de 2026 en Redmi Note 11
y Chrome, usando `https://192.168.100.40:5443/`. Instaló el certificado de CA,
inició sesión como medico.demo1, leyó el QR de EP-24 y comprobó identidad.
Guardó una evaluación ficticia desde el móvil y confirmó su aparición en la PC
con el autor esperado. Registro completo en [LOCAL_VALIDATION](LOCAL_VALIDATION.md).

El 11 de noviembre el usuario autorizó la prueba de recuperación. La PC se
reconectó a HOME-WIFI y se comprobó una parada y arranque de los tres servicios
propios. El usuario confirmó después EP-24 y la evaluación guardada desde la PC
y el Redmi. Antes de retomar el ensayo, comprobar SSID HOME-WIFI, IPv4 .40 y
vigencia del certificado preparado.

Configuración vigente en `.tmp/demo-lan/bd69559ecb924653985286bf85f48fd6/network.json`.
Certificado público del ensayo `mediccontrol-demo-ca-wifi.cer` en ese directorio.
Perfil Wi-Fi Private. Regla MedicControlDemoLanHttps para Node, TCP 5443,
dirección local 192.168.100.40 y origen 192.168.100.0/24, perfil Private.
El usuario confirmó dos routers distintos en la situación inicial, con cable de
la PC hacia HOME WIFI2 y Wi-Fi de PC y móvil hacia HOME-WIFI. Ambas conexiones
de la PC usaban el rango 192.168.100.0/24. El ensayo corresponde a HOME-WIFI.

Modo optativo para datos ficticios en una PC Windows y un móvil de la misma red.
La entrada HTTPS usa una IPv4 privada elegida y el puerto 5443. Sirve una
compilación del frontend y dirige `/api` hacia `127.0.0.1:8000`. El controlador
conserva identidad y fecha de creación de cada proceso gestionado.

El ensayo debe confirmar acceso HTTPS reconocido por Android, inicio de sesión,
consulta del episodio correcto, cámara QR y persistencia de una operación ficticia
acordada. Su ejecución se coordina previamente con el usuario.

## Preparación

Identificar la IPv4 de la PC en la red del móvil. El usuario confirmó su red
doméstica de confianza y autorizó usar Wi-Fi, `192.168.100.40`, después de comprobar
alcance del móvil por esa interfaz. Una dirección nueva requiere otro certificado.

Desde la raíz del proyecto, en PowerShell, preparar los archivos.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare_demo_lan.ps1 -Address 192.168.100.40
```

El comando genera un directorio único en `.tmp/demo-lan`, con permisos para el
usuario actual y SYSTEM. Genera un certificado de servidor y una CA de ensayo
con vigencia de 30 días mediante .NET de Windows. Exporta el certificado público
de la CA y el PFX privado del servidor. La clave de firma de la CA vive durante
la generación en memoria. La preparación compila el frontend con `/api` como
destino y verifica el certificado antes de publicar `network.json`.

La salida muestra la ruta de configuración, el archivo público
`mediccontrol-demo-ca.cer`, la huella SHA-256 de la CA y la dirección del ensayo.
Conservar esas rutas. Repetir la preparación genera otra CA y requiere instalar
su certificado público en el móvil. Cambios del frontend o del gateway requieren
una compilación preparada vigente, comprobada por huella de fuentes al iniciar.

## Certificado en Android

Transferir únicamente `mediccontrol-demo-ca.cer` al móvil, por ejemplo mediante
el cable USB disponible. En los ajustes de Android, buscar la instalación de
un certificado de CA desde almacenamiento. Comparar su huella con la salida de
preparación y confirmar la instalación en el propio dispositivo.

Para distinguirlo del primer certificado de Ethernet, el archivo público del
ensayo Wi-Fi se copió con el nombre `mediccontrol-demo-ca-wifi.cer`.

Los nombres de los menús dependen del fabricante y la versión de Android. El
paso se guía según la pantalla del Redmi disponible. Android permite instalar
y retirar certificados desde sus ajustes de seguridad.
[Ayuda oficial de Android](https://support.google.com/pixelphone/answer/2844832?hl=en-in).

El archivo `server.pfx` contiene la clave privada del servidor y permanece en
la PC. La preparación y el controlador usan los archivos de certificado
directamente. La instalación de confianza en el móvil corresponde al usuario.
La retirada de esa CA de ensayo se realiza desde los mismos ajustes al finalizar.

## Activación acordada

Antes de activar, confirmar la base, el respaldo reciente y los formularios
guardados. Usar las rutas exactas devueltas por la preparación. Ejemplo de la
configuración Wi-Fi comprobada, sujeto a confirmación de dirección y vigencia.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\demo.ps1 Start -Database ".tmp\communication-rollout-20261030\clinical-communication-working.sqlite3" -LanConfig ".tmp\demo-lan\bd69559ecb924653985286bf85f48fd6\network.json"
```

El controlador reutiliza sus procesos saludables si corresponden a la misma
base y agrega el gateway. Si falla el arranque, revierte los procesos creados
por esa invocación. Una configuración o certificado diferente requiere detener
el proceso anterior. `Stop` conserva las comprobaciones de propiedad del PID.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\demo.ps1 Status
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\demo.ps1 Stop
```

`Status` comprueba la entrada HTTPS usando la CA y el endpoint `/api/health`.
La conectividad del móvil se verifica desde el propio dispositivo. Las conexiones
Ethernet 2 y Wi-Fi figuraban como públicas y pasaron a privadas con autorización.
Antes de activar, acordar la clasificación y el permiso acotado del ensayo. Si Windows
Firewall pide una decisión, revisar esa configuración con el usuario.
Una regla explícita debe limitar programa, puerto y red de origen al ensayo.
La preparación deja esa decisión para el momento de activación.

Para esa conexión confirmada, los comandos preparados para una consola de
PowerShell con permisos de administrador son los siguientes. Su ejecución
corresponde a la activación acordada con el usuario.

```powershell
Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
$demoNodePath = (Get-Command node.exe).Source
New-NetFirewallRule -Name "MedicControlDemoLanHttps" -DisplayName "MedicControl+ demo LAN HTTPS" -Direction Inbound -Action Allow -Protocol TCP -LocalAddress 192.168.100.40 -LocalPort 5443 -RemoteAddress 192.168.100.0/24 -Program $demoNodePath -Profile Private
```

Antes de crear la regla, consultar si existe una con ese nombre y revisar sus
propiedades. La retirada del permiso de ensayo se limita a esa regla.

```powershell
Remove-NetFirewallRule -Name "MedicControlDemoLanHttps"
```

El perfil observado inicialmente fue Public. Si se acuerda recuperar esa
clasificación al cerrar el ensayo, usar la misma interfaz con `-NetworkCategory Public`.

## Recorrido manual pendiente

1. Confirmar IP de la PC, red del móvil y certificado instalado.
2. Activar la entrada con la base respaldada y comprobar Status.
3. En Chrome del móvil, abrir `https://192.168.100.40:5443` y verificar conexión
   reconocida. Ante un aviso de certificado, revisar IP, fecha y CA instalada.
4. Iniciar sesión con una cuenta del demo y comprobar el nombre visible.
5. Consultar un episodio ficticio existente y comprobar su identidad.
6. Activar la cámara desde Escanear pulsera, leer el QR de ese episodio y
   comprobar identidad antes de cualquier registro.
7. Acordar una operación ficticia concreta y verificar su resultado e historial
   desde la PC. Registrar el estado antes y después de una interrupción acordada.
8. Al cerrar el ensayo, detener el gateway mediante el controlador y conservar
   el resultado de cada comprobación.

## Validación de software

Pruebas del controlador cubren modo local anterior, puertos ocupados, referencias
caducadas, cambios de certificado, configuración incompleta, compilación
desactualizada y reversión de arranques parciales. La generación real en Windows
se comprueba con Node y rechaza un certificado para otra IP.

Las pruebas del gateway usan servidores ficticios en loopback y archivos
temporales. Cubren métodos, cuerpo, autorización ficticia, versiones,
idempotencia, errores de API, redirecciones al origen HTTPS, host y origen,
recorrido de rutas, enlaces externos al directorio y tipos de archivos.

La implementación usa HTTPS y X.509 de Node y CertificateRequest de .NET.
[Node HTTPS](https://nodejs.org/api/https.html),
[Node X.509](https://nodejs.org/api/crypto.html#class-x509certificate),
[Microsoft CertificateRequest](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.x509certificates.certificaterequest).
