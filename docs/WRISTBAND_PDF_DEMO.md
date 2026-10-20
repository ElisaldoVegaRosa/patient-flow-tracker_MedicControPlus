# Vista imprimible de pulsera para el demo

Entrega local sobre e04be5f. Usuario autorizo implementar y probar mediante PDF;
no dispone de impresora fisica. Prueba PDF y lectura QR de EP-21 confirmadas;
commit autorizado, publicacion pendiente de autorizacion explicita.

## Problema y alcance

El detalle ya mostraba un QR, pero faltaba una vista preparada para imprimir.
El nuevo boton Preparar pulsera / PDF se ofrece a enfermeria y supervisor
solo en episodios activos con evento TRIAGE guardado. La prioridad inicial o
asignacion por si solas no habilitan la vista. No se cambia el QR existente ni
el acceso previo a Mostrar pulsera QR.

La vista consulta el detalle vigente mediante el cliente HTTP compartido.
Muestra nombre, nacimiento, documento, EP y QR existente, con margen blanco.
Los datos ausentes dicen No registrado. La identidad provisional tiene aviso
textual destacado; REGISTERED no se presenta como identidad verificada.

Antes de imprimir vuelve a consultar. Si cambia un dato imprimible o el QR,
actualiza la vista y requiere otra confirmacion despues de revisarla. Si se
cierra/anula el episodio, desaparece el triaje o falla la consulta, no imprime.
Cerrar, Escape, salir del episodio y cambiar de sesion cancelan respuestas
pendientes. Se bloquean solicitudes simultaneas. La ventana mantiene el foco
en sus controles y el resto de la app queda inactivo mientras esta abierta.

## PDF y limites

Imprimir / guardar PDF abre el dialogo nativo; elegir Guardar como PDF, A4 y
escala 100 %. Desactivar encabezados y pies del navegador para una hoja limpia.
El CSS imprime solo la plantilla: no incluye formularios, bandejas, botones
ni el resto de la historia. El QR mantiene margen blanco y no incluye el token
como texto adicional. Los nombres largos pueden aumentar la altura.

Plantilla demo de 180 mm de ancho, altura minima de 45 mm y QR de 32 mm.
Estas medidas sirven para una hoja PDF; no son un formato validado de pulsera.
Impresora, consumible y medidas finales siguen pendientes. El PDF contiene
datos de identidad y el QR de acceso del episodio: usar solo datos ficticios
en esta prueba y conservarlo en un destino local controlado.

No se registra impresion, descarga, entrega ni reimpresion: el navegador no
demuestra que esas acciones se completaron. Tampoco acredita atencion ni
verificacion de identidad. No hay endpoints, migraciones, dependencias o
mutaciones de datos nuevos. Fusion, revocacion/rotacion del QR, gestion de
impresoras, registro de entrega y dispositivos fisicos quedan excluidos.

## Validacion

37 pruebas dirigidas aprobadas: componente, triaje y ciclo del episodio.
Cubren roles, triaje persistido, estados cerrado/anulado, identidad provisional,
datos actuales, revision al cambiar identidad, errores de red, solicitudes
simultaneas, cancelacion y cambio de sesion. Suite frontend completa aprobada:
553/553 en 53 archivos (287,32 s). Lint sin advertencias y build aprobados;
18 casos del componente comprobados tras ajuste final de foco. Backend sin
cambios; se conserva la CI aprobada de e04be5f y no se repite su suite.
Diff, UTF-8 y enlaces locales comprobados.

Usuario completo prueba guiada en EP-21: confirmo vista previa con identidad
verificada y aporto captura de PDF guardado y abierto. Una pagina, nombre,
EP-21, documento, nacimiento y verificacion legibles; QR completo visualmente,
sin botones ni historia clinica. La captura conserva fecha y frontend del
encabezado nativo; se explico desactivar encabezados/pies. No se ha confirmado
una segunda exportacion sin ellos. Usuario confirma lectura QR desde ese
PDF en Redmi/Chrome y apertura de Paciente Identidad Demo 21 / EP-21 tras
Identificar paciente. Se recupero conexion ADB existente y reverse de 5173
y 8000 solo para el movil seleccionado; no se abrio el demo a LAN/internet.
No conservar direccion, identificador ni codigos del dispositivo en Git.
Cancelacion manual y equipo fisico pendientes; el agente no opero la app.

## Procedimiento de prueba manual y pendientes

1. Entrar como Enfermeria o Supervisor y abrir un episodio ficticio activo.
2. Si no tiene triaje, guardarlo antes de preparar la pulsera.
3. Pulsar Preparar pulsera / PDF y revisar identidad, EP, QR y aviso de estado.
4. Pulsar Imprimir / guardar PDF; seleccionar Guardar como PDF, A4, escala 100 %,
   sin encabezados/pies. Revisar que solo aparezca la plantilla y no haya cortes.
5. Guardar en un destino local y abrir el PDF. Confirmar legibilidad del QR y
   datos; una lectura QR posterior requiere coordinar el ensayo por separado.
6. Cancelar/cerrar no debe mostrar mensajes de entrega ni cambiar el episodio.

No iniciar una prueba automatica directa en la app por inferencia. El usuario
opera la prueba guiada; registrar sus resultados sin atribuir pruebas fisicas.

Referencias: [plan del piloto](URGENCIAS_PILOT_PLAN.md),
[identidad provisional](PROVISIONAL_IDENTITY.md).
