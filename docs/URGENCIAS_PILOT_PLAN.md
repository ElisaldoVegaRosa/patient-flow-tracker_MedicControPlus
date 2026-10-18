# Plan de demo y piloto de urgencias

Fecha de consolidacion: 18 de octubre de 2026.
Estado: decisiones funcionales acordadas; subpaquete A implementado localmente.
Las demas capacidades propuestas siguen pendientes de implementacion. Este documento no autoriza compras, implementacion, commit ni
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

## Pendientes y siguiente decision

- Inventario de tableta, sistema operativo, navegador, red y equipos de impresion.
- Presupuesto y seleccion compatibles de impresora, pulseras y consumibles.
- Administrador de cuentas y limites del permiso de coordinacion.
- Fuente oficial por dato y traslado al expediente existente.
- Circuito/programa LAB y posibilidades reales de integracion.
- Reglas de fusion, rectificacion y paciente con varios episodios activos.
- Protocolo ante urgencia evidente desde llegada y fallos de red, energia o equipos.
- Objetivos medibles de carga, tiempos de respuesta y recuperacion.

Subpaquete A autorizado con cont e implementado localmente. Siguiente paso:
cerrar la entrega validada tras ensayo guiado completado por el usuario.
Commit y push siguen requiriendo autorizacion explicita.
Identidad provisional, camara y emision requieren los subpaquetes adicionales;
no se implementan ni se compran equipos por inferencia de este plan.
