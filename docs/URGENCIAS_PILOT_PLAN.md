# Plan de demo y piloto de urgencias

Fecha de consolidacion: 18 de octubre de 2026.
Estado: subpaquete A publicado; lector con camara preparado localmente y
validado por software. Ensayo fisico y demas capacidades siguen pendientes. Este documento no autoriza compras, implementacion, commit ni
push. Las decisiones describen el sistema deseado, no capacidades ya disponibles.

## Objetivo y limites

Mejorar el seguimiento de urgencias en Republica Dominicana: identificacion,
esperas, responsables, reevaluaciones, laboratorio y continuidad entre turnos.
Inicialmente sera complemento del expediente existente, en papel y otro programa.
La institucion debe definir que informacion es oficial en cada sistema y como se
resuelven discrepancias antes de usar datos reales.

- Objetivo inmediato: demo ficticio en esta PC con una tableta.
- Piloto posterior: red local, cinco tabletas, ampliacion gradual hasta treinta.
- Hasta treinta usuarios simultaneos es una meta a comprobar, no capacidad medida.
  El numero de dispositivos no equivale al numero de sesiones ni de escrituras.
- Un unico puesto de triaje emite pulseras; impresora por adquirir.
- Acceso remoto, telemedicina y expediente clinico oficial son fases separadas.
- No se incluyen integraciones externas ni distribucion clinica autonoma.

## Base existente

Base de referencia: commit `b9edf34`, buscador compartido publicado. El proyecto
ya dispone de flujos por rol, tareas, laboratorio simulado, alertas, historial,
correcciones, sesiones, protecciones contra duplicados y conflictos, borradores
y respaldo con restauracion aislada. Estas capacidades se aprovecharan; su
existencia no demuestra preparacion para campo ni aprobacion institucional.

Validaciones previas en [PROJECT_STATUS](PROJECT_STATUS.md). Este plan documental
no introduce comportamiento y no requiere repetir suites aprobadas.

## Decisiones acordadas

| Tema | Decision |
|---|---|
| Areas | Triaje, consulta, observacion y laboratorio, con personal propio |
| Turnos | Personal con turnos y areas fijos |
| Coordinacion | Una persona designada para toda urgencias |
| Permiso de coordinacion | Adicional al cargo; no concede facultades clinicas de otros roles |
| Responsabilidad | Medico y profesional de enfermeria identificados por episodio |
| Continuidad | Normalmente se conserva el medico al pasar a observacion |
| Asignacion | Sugerencia tras triaje; coordinacion o medico confirman |
| Atencion | Confirmar asignacion no marca inicio de atencion |
| Carga | Considerar prioridad, espera, disponibilidad y pendientes; no solo cantidad |
| Reevaluacion | Medico decide momento y contenido por paciente |
| Acciones | Enfermeria, medico o ambas; dos pendientes vinculados si son ambas |
| Vencimiento | Visible para responsables y coordinacion; sin cierre ni reasignacion automatica |
| Entrega de turno | Transferencia con aceptacion explicita; anterior responsable hasta aceptar |
| Excepciones | Coordinacion resuelve transferencias pendientes con motivo e historial |
| Identidad | Admision/archivo verifica las 24 horas, todos los dias |
| Pulsera | Se coloca despues del triaje; lectura inicial con camara de tableta |

### Identificacion y continuidad

Recepcion abre ficha provisional y episodio, incluso si la identidad es
desconocida. La etiqueta, por ejemplo Paciente desconocido 1, no sustituye un
identificador interno unico. Admision/archivo verifica y completa los datos.
La atencion y el historial permanecen vinculados al mismo episodio.

Si existe ficha previa, la consolidacion necesita revision autorizada, motivo,
trazabilidad de procedencia y tratamiento de errores. No fusionar por coincidencia
de nombre o documento automaticamente. La fusion es un bloque separado de mayor
riesgo: faltan reglas sobre episodios activos, referencias previas y rectificacion
de una fusion incorrecta; no esta incluida en la primera version de pulseras.

La lectura de pulsera debe abrir el episodio correcto, exigir sesion y permisos,
y permitir confirmar identidad. No completa acciones automaticamente. Se propone
QR con referencia opaca y sin datos personales legibles; verificar el mecanismo
actual antes de decidir cambios. Reimpresion, invalidacion, pulsera danada y
alternativa a camara requieren diseno explicito.

### Colas, reevaluaciones y turnos

Mantener cola compartida por area y cola por profesional. Sugerencia, asignacion
confirmada e inicio de atencion son hitos diferentes. Cambiar ubicacion no implica
cambiar medico. Las sugerencias no confirmadas siguen visibles en el area.

Las acciones de enfermeria y medicina tienen responsables y estados independientes.
Consultar o reconocer un aviso no equivale a completar la accion. Reprogramar o
cancelar requiere trazabilidad; no establecer intervalos clinicos automaticos.
Pendientes y vencimientos continúan visibles durante la transferencia de turno.

Laboratorio trabaja por orden vinculada al paciente y episodio. Se desconoce el
programa actual y sus posibilidades de integracion. El demo mantiene datos
ficticios; cualquier seguimiento manual futuro debe indicar su procedencia y
evitar presentarse como sincronizado con el sistema externo.

## Prioridades, dependencias y esfuerzo

Rangos de horas efectivas para primeras versiones acotadas, incluyendo desarrollo,
pruebas y documentacion. Confianza preliminar; no son compromiso ni cotizacion.
Excluyen adquisicion, capacitacion institucional, validacion clinica/legal e
integraciones. No sumar como calendario: hay dependencias y trabajo compartido.

| Orden | Paquete | Invasividad | Dependencia principal | Horas |
|---|---|---|---|---|
| 1 | Demo autonomo: inicio, parada, diagnostico, guia y recuperacion | Baja-media | Aprovechar tareas y respaldo existentes | 12-24 |
| 2 | Identificacion y pulsera, sin fusion de fichas | Media | Tableta, impresora y consumibles; verificar QR actual | 24-48 |
| 3 | Cuentas personales, turnos, areas y coordinacion | Alta | Administracion de cuentas y permisos por concretar | 40-72 |
| 4 | Colas y responsables con asignacion asistida | Alta | Paquete 3 | 48-88 |
| 5 | Esperas y reevaluaciones individuales | Alta | Responsables y criterios aprobados | 32-64 |
| 6 | Seguimiento manual de laboratorio | Alta | Conocer circuito y limites del programa externo | 40-80 |
| 7 | Entrega de turno, historial longitudinal y resumen | Media-alta | Identidad y asignaciones | 40-80 |
| 8 | Preparacion del piloto local y pruebas concurrentes | Alta transversal | Infraestructura y alcance seleccionado | 64-120 |

Fusion auditable y correccion demografica completa necesitan estimacion separada.
Ordenes estructuradas tambien se estimaran al conocer catalogo y necesidades.
Seguridad y concurrencia se consideran desde cada paquete; el ultimo no pospone
esos controles hasta el despliegue.

## Primer paquete recomendado: demo e identificacion

Problema: depender de asistencia tecnica para operar el demo y no haber demostrado
el circuito de pulsera con el equipamiento elegido.

Estimacion inicial sustituida por la inspeccion tecnica posterior: paquetes 1 y 2
se habian estimado en 36-72 horas. No usar esa cifra para todo el circuito. Casos ficticios,
una tableta y puesto de impresion. Separar trabajo posible sin equipos de la
aceptacion fisica, que depende de disponer de ellos.

Exclusiones: fusion, piloto real, cuentas administrativas completas, distribucion
automatica, integracion LAB, telemedicina y compra de equipos.

Criterios de aceptacion:

- Iniciar y detener servicios, comprobar estado y seguir una guia reproducible.
- Restaurar una copia en destino aislado sin sustituir la base activa.
- Recorrer ingreso, triaje, emision y lectura de pulsera sobre el mismo episodio.
- Confirmar identidad antes de registrar; escanear no genera actividad clinica.
- Probar reposicion y alternativa de identificacion sin crear duplicados.
- Denegar consulta sin sesion o permisos; no exponer datos clinicos en el QR.
- Pedir al usuario antes de pruebas directas de app y reservar los ensayos fisicos
  para una comprobacion guiada con equipo disponible.

## Condiciones de avance

Demo: circuito ficticio reproducible, errores conocidos documentados, respaldo y
lectura fisica comprobados. Probar camara en tableta exige direccion de servidor
accesible y contexto seguro compatible con el navegador; localhost en la tableta
no apunta a la PC. Definir red, HTTPS y permisos de camara antes del ensayo.

Piloto de cinco tabletas: cuentas personales, permisos verificados, responsables,
definicion de fuente oficial, despliegue estable, HTTPS, copias programadas,
restauracion, cobertura y contingencia. Autorizacion institucional y revision de
proteccion de datos antes de informacion real. Una red local no elimina estos
requisitos. Definir carga, latencia y recuperacion aceptables antes de medir.

Ampliaciones hasta treinta: aprobar pruebas de concurrencia representativas,
integridad de asignaciones, ausencia de duplicados, cobertura, equipos y soporte.
No aprobar ampliaciones solo por cantidad de tabletas disponibles.

Operacion profesional y expediente oficial: evaluacion separada del contenido,
custodia, acceso, validacion clinica, normativa, disponibilidad y soporte. Fuentes
de referencia para revisar con la institucion, sin declarar cumplimiento:
[Ley 172-13](https://tribunalconstitucional.gov.do/transparencia/marco-legal/leyes/ley-172-13/)
y [Reglamento del expediente clinico del MSP](https://repositorio.msp.gob.do/handle/123456789/2310?show=full).

## Inspeccion tecnica del primer paquete: 18 de octubre

Inspeccion de codigo y configuracion, sin ejecutar la app ni probar equipos.

| Mecanismo actual | Evidencia | Consecuencia |
|---|---|---|
| Arranque separado desde VS Code | `.vscode/tasks.json`, tareas Start backend y Start frontend | Aprovechar comandos; falta operacion conjunta, diagnostico y parada controlada |
| Salud de API | `backend/app/main.py`, GET /health retorna status ok | Comprueba respuesta del proceso; no demuestra integridad de base ni disponibilidad del circuito |
| Respaldo | `scripts/demo_db_backup.py` | Reutilizar procedimiento existente; no reemplazar base activa para ensayar |
| QR opaco por episodio | `episode_registration.py`, secrets.token_urlsafe(24) | No hace falta inventar otro identificador para la lectura inicial |
| QR mostrado en detalle | `EpisodePage.tsx`, QRCodeSVG con qr_token | Es visualizacion; no implementa impresion ni entrega despues de triaje |
| Lectura manual | `ScanPage.tsx` y App.scanEpisode | Hoy se pega un token; falta camara, decodificacion y gestion de permisos/ciclo de vida |
| Resolucion autenticada | `episode_queries.py`, GET /scan/{qr_token} | Solo encuentra episodios ACTIVE y registra QR_SCANNED; debe preservarse/revisarse explicitamente ese contrato |
| Identidad obligatoria | EpisodeCreate e input_validation.py; patients con NOT NULL | Fecha valida y documento no vacio obligatorios; desconocidos necesitan modelo y migracion, no fechas/documentos inventados |
| Conexion local | CORS solo localhost:5173; Vite sin configuracion LAN | La tableta necesita direccion alcanzable, API correcta y configuracion segura explicita |

El escaneo actual escribe un evento auditable desde GET. La camara no debe
generar consultas repetidas por cada fotograma ni duplicar eventos. Revisar
si se conserva el contrato en esta entrega o se separan consulta y registro;
cualquier cambio necesita pruebas de compatibilidad y concurrencia. El token
en ruta tambien requiere revisar su exposicion en registros de acceso.

Para camara en red local, definir HTTPS confiable en la tableta y evitar llamadas
desde pagina HTTPS a API HTTP. No recurrir a desactivar seguridad del navegador.
Referencia tecnica: [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

### Revision del alcance y estimacion

La cifra previa de 36-72 horas queda como orientacion inicial insuficiente para
todo el circuito de desconocidos e impresion real. Descomposicion revisada:

| Subpaquete | Incluye | Horas preliminares |
|---|---|---|
| A. Operacion del demo en PC | Arranque, parada de procesos propios, diagnostico, guia y ensayo aislado de recuperacion | 12-24 |
| B. Camara y acceso desde tableta | Configuracion LAN/HTTPS, lector, permisos, errores, alternativa manual y pruebas | 24-48 |
| C. Identidad provisional | Modelo/migracion, campos desconocidos, permisos de admision/archivo, confirmacion auditable sin fusion | 32-64 |
| D. Emision fisica | Plantilla, entrega tras triaje, reimpresion y prueba de pulsera sobre equipo elegido | 16-32 |

Orden de magnitud del circuito completo: 84-168 horas, sujeto a equipo, diseno
de permisos y migracion. No es calendario comprometido; excluir fusion e
integracion LAB. Reestimar cada subpaquete antes de implementarlo.

Recomendacion concreta: comenzar con A. No requiere comprar equipos ni cambiar
identidad, QR o contratos clinicos. Criterios: comandos visibles y documentados,
mensajes de dependencias/puertos ocupados, no detener procesos ajenos, diagnostico
sin revelar credenciales y restauracion solo aislada. Las pruebas de app siguen
requiriendo consulta previa al usuario. A implementado localmente tras autorizacion cont; ver [guia](DEMO_OPERATIONS.md).
23 pruebas dirigidas aprobadas; prueba guiada de servidores completada por el
usuario: arranque, estado propio, parada, puertos libres y nuevo arranque con
pantalla de acceso. Sin validacion de tableta ni impresion.

## Preparacion de camara sin tableta disponible

Usuario confirma que todavia no dispone de tableta. El subpaquete A ya esta
publicado en `361d33c`, con CI `39164657470` aprobada. La preparacion del lector
fue autorizada con cont e implementada localmente: [comportamiento y limites](QR_CAMERA_DEMO.md).
No representa validacion de camara fisica ni instalacion en tableta.

Problema: ScanPage solo acepta pegar token. El QR existente es una referencia
opaca, no una URL: abrir la camara nativa de un dispositivo no demuestra que
pueda navegar al episodio. La lectura debe integrarse con la sesion de la app.

Alcance de software implementado localmente:

- Activacion voluntaria de camara; nunca pedir permisos al abrir la pantalla.
- Vista previa, cancelacion y alternativa manual conservada.
- Una lectura captura un token para revisar/confirmar; no consultar por fotograma.
- Una confirmacion en curso bloquea otra; sin repetir automaticamente el GET
  que actualmente registra QR_SCANNED. Validar y codificar el segmento de ruta.
- Liberar camara al cancelar, salir, cerrar sesion o desmontar la pantalla;
  resolver tambien permisos que llegan despues de cancelar.
- Informar permiso denegado, camara ausente, contexto inseguro y lectura fallida.
- Mantener cliente HTTP, permisos y navegacion centralizados; no completar tareas.
- Elegir decodificador compatible sin depender exclusivamente de APIs nativas
  que no esten disponibles en todos los navegadores objetivo.

Pruebas automatizadas: medios y lector simulados, confirmacion unica, rechazos,
respuesta tardia, cambio de sesion, liberacion de recursos y formulario manual.
Estas pruebas no acreditan enfoque, calidad de pulsera ni compatibilidad fisica.

Exclusiones: compra, seleccion de modelo, HTTPS instalado en dispositivos,
red de campo, impresion e identidad provisional. No cambiar el controlador
local para exponer servidores a la red sin un alcance especifico.

Prueba fisica parcial completada por el usuario en Redmi Note 11 / Android 13
con Chrome: camara, cancelacion, captura unica y confirmacion del paciente y
episodio correctos desde QR en pantalla. Conexion temporal por ADB Wi-Fi y
reverse de los puertos locales, sin cambios LAN/HTTPS del servidor. Ver
[resultado y limites](QR_CAMERA_DEMO.md). Quedan tableta, pulsera impresa y
pruebas de campo; no estimar compras ni prometer fechas sin equipamiento.

## Siguiente propuesta tras retoma del 19 de octubre

Lector publicado en 46a18b8 con CI 39195510597 aprobada. Tras reiniciar PC,
Status informa ambos puertos libres; no iniciar demo ni recuperar ADB para
continuar el diseno. Tableta e impresora todavia son dependencias de pruebas
fisicas, no de esta propuesta.

Problema confirmado en codigo: EpisodeCreate y NewEpisodePage exigen documento
y fecha de nacimiento; patients los declara NOT NULL. No existe perfil de
admision/archivo. No simular datos desconocidos con fechas o documentos falsos.

Alcance publicado en e04be5f: [identidad provisional](PROVISIONAL_IDENTITY.md).
CI [39349014853](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/39349014853) aprobada; base migrada con integridad y referencias correctas.
Usuario confirmo prueba guiada completa en EP-21. Alcance:

- Identidad provisional explicita y campos desconocidos representados sin
  confundirlos con datos verificados; conservar informacion parcial real.
- Crear ingreso con etiqueta provisional e identificador interno unico.
- Perfil demo de admision/archivo con permisos propios de verificacion, sin
  conceder por ello acciones clinicas ni fusion automatica.
- Confirmar identidad con motivo, autoria y valores anteriores; conservar
  paciente, episodio, QR y toda su actividad.
- Si hay ficha previa candidata, detener esa confirmacion y derivar a revision;
  no crear otro episodio ni vincular historiales automaticamente.
- Migracion compatible con registros existentes; revisar consultas, tipos,
  busqueda, borradores y comparacion de identidad por causa compartida.

Exclusiones: fusion, administracion completa de cuentas, impresion, turnos y
colas. Criterios: ingresar sin documento/nacimiento inventados, confirmar solo
con perfil autorizado, preservar referencias y auditoria, impedir duplicados y
conflictos y mantener el circuito conocido. Validacion con bases temporales;
consultar antes de pruebas directas o de actuar sobre la base demo.

## Pendientes y siguiente decision

- Tableta todavia no disponible: inventario de sistema, navegador, red e impresion pendiente.
- Presupuesto y seleccion compatibles de impresora, pulseras y consumibles.
- Administrador de cuentas y limites del permiso de coordinacion.
- Fuente oficial por dato y traslado al expediente existente.
- Circuito/programa LAB y posibilidades reales de integracion.
- Reglas de fusion, rectificacion y paciente con varios episodios activos.
- Protocolo ante urgencia evidente desde llegada y fallos de red, energia o equipos.
- Objetivos medibles de carga, tiempos de respuesta y recuperacion.

Subpaquete A publicado en 361d33c con CI aprobada y prueba guiada completada.
Lector publicado en 46a18b8, conservando lectura manual y con prueba Android
confirmada. Identidad provisional y confirmacion auditable publicadas en e04be5f
con CI aprobada y prueba guiada de EP-21 completada. Emision fisica pendiente.
Nuevos commit/push y compras requieren autorizacion; consultar antes de pruebas directas.

### Vista imprimible del demo: implementacion local autorizada

Problema: el detalle muestra QR, pero no ofrece plantilla ni confirma entrega.
Propuesta inicial sin equipos: vista imprimible con datos de identidad vigentes,
EP y QR existente, aviso provisional cuando corresponda y acceso tras triaje.
Vista previa/PDF sirve para revisar contenido; no confirma que una pulsera
se imprimio, entrego ni que el dispositivo fisico sea compatible.

Excluir inicialmente: cambio/revocacion del token, registro de entrega y
reimpresion fisica, drivers e impresora especifica. No cambiar estados clinicos
ni interpretar imprimir como atencion o verificacion de identidad.
Criterios: permisos explicitos, mismo paciente/EP/QR, datos actuales, aviso
provisional visible y estilos de impresion sin controles de pantalla. Probar
comportamiento con tests; acordar antes de vista previa directa o impresion.
Usuario confirmo este alcance y prueba PDF sin impresora fisica. Implementado
localmente con consulta vigente al preparar e imprimir, revision ante cambios
y acceso enfermeria/supervisor tras triaje guardado. [Guia](WRISTBAND_PDF_DEMO.md).
37 dirigidas y frontend 553/553, lint y build aprobados. Medidas
finales y validacion fisica dependen de elegir impresora, pulsera y consumibles.
Usuario confirmo vista previa EP-21 y aporto captura del PDF guardado/abierto
en una pagina, con identidad y QR completos. Encabezados del navegador aun
visibles. Usuario confirma lectura QR desde PDF en Android y consulta del
mismo paciente/EP-21. Impresion fisica pendiente. Commit autorizado para este
bloque; push pendiente de autorizacion explicita.
