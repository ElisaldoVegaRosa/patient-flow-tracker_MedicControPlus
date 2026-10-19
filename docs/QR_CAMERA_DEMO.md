# Lector QR con camara: alcance del demo

Implementacion local del 18 de octubre de 2026. Prueba fisica guiada confirmada
por usuario en Redmi Note 11, Android 13 y Chrome con QR mostrado en pantalla
de PC. Tableta, pulsera impresa y red de campo siguen pendientes.

## Comportamiento

- Abrir Escanear pulsera no activa camara ni solicita permisos.
- Activar camara solicita solo video, con preferencia no obligatoria por camara
  trasera. Cancelar esta disponible incluso mientras el permiso esta pendiente.
- Decodifica en el navegador con jsQR 1.4.0, incluido como dependencia fija y
  cargado al activar el lector. No sube ni guarda fotogramas.
- Procesa imagenes con dimension maxima de 640 pixeles, cada 250 ms; pendiente
  medir enfoque, latencia y consumo en el dispositivo elegido.
- Al capturar un identificador, detiene la camara y rellena la entrada manual.
  No consulta ni registra un escaneo hasta pulsar Identificar paciente.
- Identificar paciente consulta la API centralizada con sesion; despues se debe
  comprobar identidad en la ficha antes de registrar informacion.
- La consulta bloquea otra confirmacion mientras esta en curso; no se reintenta
  automaticamente. Esto no introduce idempotencia nueva en el endpoint existente.
- Se conservan entrada manual y mensajes de API para pulsera invalida o episodio
  cerrado. Se aceptan identificadores de 1-128 caracteres: letras ASCII,
  numeros, guion y guion bajo, incluidos los tokens del demo. Se eliminan solo
  espacios exteriores y se codifica el segmento de ruta. URLs y rutas se rechazan.
- Cancela al salir, ocultar la pestana, cerrar la pagina o cambiar token de sesion
  desde otra pestana. Desmontar por cierre/expiracion de sesion libera recursos.
  Un permiso tardio se libera sin reproducir video ni capturar.
- Errores de permiso, disponibilidad, desconexion y lectura permiten usar la
  alternativa manual. No se reactiva la camara automaticamente.

La ruta GET /scan/{token} del backend ya registra QR_SCANNED y solo resuelve
episodios ACTIVE. Este contrato no se modifica. Una nueva consulta manual puede
registrar otro evento; no confundir el bloqueo de solicitudes simultaneas con
deduplicacion permanente de auditoria.

## Requisitos y limites

La camara necesita contexto seguro, permisos y navegador compatible. Localhost
en la tableta apunta a la tableta, no a la PC. El controlador del demo sigue
limitado a esta PC; no configura red ni certificados. Antes de pruebas en
tableta, preparar HTTPS confiable, direccion alcanzable y API compatible sin
contenido mixto. No desactivar protecciones del navegador como alternativa.

El QR actual contiene una referencia opaca, no una URL; no depende de que la
camara nativa del sistema sepa abrir MedicControl+. Esta entrega no configura
impresion, reposicion de pulseras, identidad provisional ni acceso remoto.

## Verificacion

Pruebas simuladas de permisos, cancelacion y respuestas tardias, desconexion,
liberacion, confirmacion unica, errores, entrada manual y cambios de sesion.
Incluye fixture QR ficticio generado con qrcode del backend y decodificado por
jsQR real, separado de las pruebas que simulan el decodificador.

Prueba guiada acordada y ejecutada por el usuario, con acceso como Supervisor:

- Permiso y vista previa correctos; cancelar apaga camara e indicador.
- Leer QR de episodio activo mostrado en PC captura una sola vez y apaga camara.
- Aparece el identificador sin abrir el episodio ni consultar automaticamente.
- Confirmar Identificar paciente abre el mismo nombre y numero de episodio.
- La consulta utiliza el contrato existente, que registra QR_SCANNED; no se
  crearon nuevas fichas ni episodios como parte de esta prueba.

Esto verifica el movil probado, no otros dispositivos ni pulseras impresas.
No se ensayaron fisicamente denegacion de permisos, cortes ni todas las
variantes cubiertas en simulaciones. Consultar antes de nuevas pruebas directas.

Resultado sobre 361d33c y esta entrega local: 31 pruebas dirigidas aprobadas;
suite frontend final 521/521 en 50 archivos, 258,94 s, incluye dos casos
adicionales de cancelacion. Lint y build aprobados; tras ajustar solo tipos de
simulacion, lint dirigido del archivo y build aprobados de nuevo. Backend sin
cambios; conserva validacion CI previa, no se repitio. Commit autorizado tras
prueba guiada; publicacion pendiente de autorizacion explicita.

## Conexion temporal usada y cierre

USB no completo autenticacion. Se prepararon Platform-Tools oficiales de Google
37.0.1 en `.tmp/android-platform-tools/`, ignorado por Git; sin instalar Android
Studio ni modificar PATH. Usuario emparejo por codigo desde su terminal y ADB
confirmo dispositivo conectado. No guardar codigos, claves ni identificadores
del telefono en documentos o commits.

ADB reverse de tcp:5173 y tcp:8000 permitio abrir http://localhost:5173 en Chrome
del movil y consultar API local. Localhost se uso mediante ese transporte
explicito; no funciona asi en otro movil sin configurar la redireccion.
No se publicaron servicios del demo en internet ni se cambiaron certificados,
reglas de firewall o enlaces del controlador. No es el despliegue de campo.

Al terminar: cerrar sesion del demo en el movil, desactivar depuracion Wi-Fi y
olvidar la PC emparejada desde esa pantalla si no se seguira probando. Si se
mantiene conectado para otras tareas, retirar solo las dos redirecciones de esta
prueba con adb dirigido al dispositivo seleccionado; no retirar globalmente
redirecciones ni terminar servidores ADB de otros usos.

## Referencias tecnicas

- [jsQR: uso y licencia](https://github.com/cozmo/jsQR).
- [MDN: getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
- [Plan del piloto](URGENCIAS_PILOT_PLAN.md).
