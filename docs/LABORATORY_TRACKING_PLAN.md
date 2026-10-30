# Seguimiento manual de laboratorio: alcance propuesto

## Estado

29/10: bloque publicado en origin/main, commit 82810c6. CI del mismo SHA
aprobada: [ejecucion 40983611174](https://github.com/ElisaldoVegaRosa/patient-flow-tracker_MedicControPlus/actions/runs/40983611174).
Validacion local: backend 541/541 en tramos y frontend completo 742/742,
79 archivos, lint/build correctos. Ensayo manual por usuario en copia concluido:
EP-23, orden #19, muestras/reemplazo, parciales, correcciones y revision,
alta con plan, publicacion posterior, relevo aceptado y retorno rechazado.
Copia con respaldo posterior y restauracion verificados; original sin migrar.
Los apartados de avances aislados documentan etapas anteriores, no pendientes
actuales. Ver PROJECT_STATUS.md para estado y siguiente decision.

## Problema y alcance

La orden actual es una tarea LAB con un solo resultado y estado general.
La publicacion exige episodio activo; la pantalla conserva pendientes de
episodios cerrados solo para consulta. Se requiere distinguir muestras,
analiticas, resultados parciales y revision medica, incluyendo seguimiento
posterior al alta. La obtencion, traslado, recepcion y publicacion son hechos
separados; registrar autor, fecha y persona que realiza la accion cuando difiera.

## Decisiones confirmadas

- 28/10, usuario eligio alta mixta con ordenes anteriores resueltas y revision
  expresa de resultados vigentes por medico confirmado. Confirmacion por version
  exacta y snapshot al alta; pendientes antiguos bloquean. Solo resultados nuevos
  pueden quedar pendientes con plan. Sin conversion de datos antiguos.
- Alta mixta y plan inicial UI validados: 42 backend y 164 UI afectadas. Falta
  gestion de seguimiento tras alta y activacion coordinada, sin migrar original.



- Sangre y saliva se obtienen en laboratorio si el paciente puede desplazarse.
  Si no puede por condicion o indicacion medica, laboratorio o enfermeria
  obtiene la muestra donde este. Heces y orina se registran como tipos distintos;
  el paciente recoge y entrega las suyas cuando puede, con asistencia si precisa.
- El traslado puede hacerlo paciente, enfermeria o laboratorio segun el caso.
  Solo laboratorio confirma recepcion y aptitud de la muestra.
- Una orden admite varias analiticas y muestras con llegadas independientes.
  No confundir una muestra con una analitica: una muestra puede servir para
  varias determinaciones; el modelo concreto de relaciones se define al disenar.
- Laboratorio publica resultados parciales, mostrando lo disponible y lo que
  falta; publicar una parte no completa toda la orden.
- Solo el medico responsable confirmado registra revision por resultado/version,
  con autor y fecha. Sustituto acepta relevo primero. Corregir un resultado
  requiere nueva revision conservando la anterior. Consultar no acredita revisar.
- Laboratorio puede solicitar otra muestra para la misma analitica con motivo,
  sin autorizacion medica previa; no permite agregar analiticas nuevas. Conservar
  muestra anterior y vincular repeticion. Medicina y enfermeria ven el pendiente.
  Laboratorio coordina si el paciente puede desplazarse; si no, laboratorio y
  enfermeria confirman quien la obtiene.
- Solo el medico responsable confirmado cancela una analitica, con motivo e
  historial. Laboratorio puede registrar incidencias y pedir repeticion.
- Separar laboratorio completado de revision medica pendiente.
- Al alta, resultados publicados requieren revision. Resultados aun pendientes
  permiten continuar solo por decision medica explicita, con motivo, responsable,
  fecha prevista de revision y como se informara al paciente. Sin responsable o
  plan, bloquear el alta. No modificar la regla vigente para reevaluaciones.
- Cerrar episodio no cancela pendientes: permitir publicacion posterior y
  mantener bandeja de seguimiento hasta revision. Relevo de seguimiento requiere
  aceptacion y auditoria; no reabrir episodio automaticamente para publicar.

## Avance de la primera etapa

Modelo logico, contratos propuestos y estrategia de compatibilidad preparados
sobre el codigo actual en [modelo de laboratorio](LABORATORY_DATA_MODEL.md).
Esquema ejecutable en migracion 011, sin registro en el arranque. Ensayo doble
en copia de la base: 26 tablas previas identicas, integridad/FKs y restauracion
SQLite comprobadas. Pruebas dirigidas: 37 de esquema y 1 adicional de restauracion
aprobadas. No equivalen a pruebas del flujo clinico. Faltan decisiones de cierre
con cancelaciones, responsable
posterior al alta y tratamiento de ordenes antiguas antes de activar reglas.

## Etapas y estimacion preliminar

Horas de trabajo tecnico, pruebas y documentacion incluidas. No son mediciones,
promesas de calendario ni estimacion de tokens. Revisar tras la primera etapa.

| Etapa | Entrega verificable | Horas |
|---|---|---:|
| 1 | Modelo, contratos, compatibilidad de ordenes antiguas y ensayo de migracion | 12-20 |
| 2 | Muestras, recepcion, aptitud y repeticion con permisos y auditoria | 24-40 |
| 3 | Resultados parciales, versiones, correcciones y revision medica | 18-30 |
| 4 | Alta con seguimiento, publicacion posterior y relevo de responsable | 24-40 |
| 5 | Verificacion integral, respaldo/restauracion y prueba manual guiada | 12-20 |
| Total | Demo local del alcance acordado | 90-150 |

Invasividad alta: esquema SQLite aditivo, rutas LAB/alta/responsables, tipos y
cliente HTTP, pantallas de laboratorio/episodio/seguimiento, respaldos y pruebas.
El rango anterior de 40-80 horas del plan piloto era previo al detalle de varias
muestras, resultados versionados y seguimiento posterior al alta; no sumarlo.
Sin adquisiciones obligatorias para programar y probar con datos ficticios.

## Avance de muestras (API aislada)

Creacion estructurada explicita, consulta, toma, entrega, recepcion y aptitud.
Enfermeria/laboratorio registran toma/entrega; solo laboratorio registra recepcion
y aptitud. Identifica profesional que registra y persona que realiza el hecho.
Version e idempotencia protegen reintentos; auditoria y evento se confirman en la
misma transaccion. No sobrescribe hechos ya registrados. Contratos y restricciones
en [modelo LAB](LABORATORY_DATA_MODEL.md). Validacion completa backend:
362/362 aprobadas (614,62 s), incluidas 38 de esquema y 26 de API de muestras.
Frontend sin cambios, no se repiten sus suites.
No activar en main antes de cerrar circuito de resultados/alta y respaldos.

## Avance de repeticion (API aislada)

Laboratorio solicita una muestra nueva para analiticas seleccionadas de una
muestra no apta, conservando el resto y todo el historial. Una muestra por
solicitud, enlaces por analitica, version/idempotencia, motivo y auditoria atomica.
Linaje y asociaciones historicas consultables por medicina/enfermeria; no acredita
obtencion ni asignacion de profesional. Validacion ampliada: 83/83 aprobadas
(123,92 s), incluidas 26 de muestras, 19 de repeticion y 38 de esquema.
La validacion completa previa de 362 es la base anterior al cambio, no una
suite completa nueva. Sin activacion en el demo.

## Avance de resultados y revision (API aislada)

Publica por analitica con muestras actuales recibidas/aptas. Correccion y anulacion
crean versiones, con fuentes e historia; revision por medico responsable confirmado,
con permiso revalidado incluso para recibos. Un relevo exige aceptacion y cambiar
versiones invalida borradores. Resumen de laboratorio separado de revisiones;
repeticion pendiente no se satisface con resultado de muestra anterior.
Marcador de ciclo compartido para detectar cierre/reapertura. Regresion final
116/116 aprobada (237,82 s): 33 resultados, 26 muestras, 19 repeticion, 38 esquema.
Las 362 completas anteriores siguen como base previa, no nueva ejecucion.
En esa etapa aun faltaban tarea generica, alta/seguimiento, detalle/recibos,
respaldos e interfaz. Avances posteriores se registran mas abajo; no montar en
main las nuevas rutas hasta completar la integracion.

## Avance de alta y seguimiento (API aislada)

Medico responsable confirma alta con pendientes y plan explicito. Resultados
publicados requieren revision; reevaluaciones pendientes conservan su bloqueo.
Custodia y snapshot por ciclo permiten trabajar tras el cierre solo sobre
analiticas incluidas; con todo revisado no inventa fechas, pero una correccion
tardia vuelve a la bandeja. Relevo requiere aceptacion, con cobertura propuesta
por coordinacion clinica si el titular queda inactivo. No modifica responsables
de episodios activos ni envia mensajes externos.

Esquema experimental v2: plan opcional si no hay pendientes y snapshot JSON
inmutable. Rechaza copias experimentales v1 sin tocarlas. Ensayo sobre copia del
original verifica doble aplicacion, 26 tablas conservadas e integridad/restauracion.
Regresion final 144/144 aprobada (384,21 s): 25 seguimiento, 33 resultados,
26 muestras, 19 repeticion y 41 esquema. Las 116 anteriores son la base previa;
no hay nueva suite completa de backend o validacion frontend. Activacion en rutas productivas,
respaldos, circuito legado y UI siguen pendientes. Cierre con cancelaciones
confirmado e implementado en la API aislada.

## Avance de cancelaciones (API aislada, 28/10/2026)

Usuario confirma Finalizada con cancelaciones y Cancelada segun se resuelva parte
o toda la orden. Responsable medico puede cancelar trabajo pendiente y restituir
por error con motivo e historial, sin borrar muestras o informes. No elude revision
de resultados disponibles; correcciones de informes cancelados siguen revisables
tras el alta. Restituir pendientes cerrados exige plan explicito. Sin cambios de
esquema v2, activacion o pantallas. Regresion final de seis suites: 159/159
aprobadas (1105,19 s): 15 cancelaciones, 25 seguimiento, 33 resultados,
26 muestras, 19 repeticion y 41 esquema. Las 144 previas son base anterior;
backend ajeno y frontend sin cambios, no se repiten.

## Criterios de aceptacion

- Una muestra recibida no modifica las otras ni acredita resultados publicados.
- Muestra no apta y repeticion conservan historial, analitica y autoria.
- Resultado parcial no completa la orden; revision identifica version exacta.
- Permisos se aplican en backend; formularios explican bloqueos y conservan borrador.
- Escrituras concurrentes y reintentos no duplican tomas, resultados ni revisiones.
- Alta comprueba pendientes y plan en la misma transaccion; un resultado nuevo o
  corregido durante el alta no elude las reglas. Tras el alta el pendiente sigue
  visible, con responsable y relevo auditado.
- Datos antiguos conservan texto e historial sin inventar muestras, recepciones
  o revisiones. Migracion aditiva y restauracion verificadas en copia.
- Pruebas dirigidas, validacion completa aplicable al estabilizar y prueba manual
  guiada con autorizacion antes de operar interfaz. Sin commits/push nuevos sin
  solicitud expresa.

## Limites y diseno pendiente

No incluye integracion con programa externo, interpretacion automatica,
clasificacion automatica de resultados criticos, notificaciones fuera de app,
impresoras, inventario, facturacion ni validacion para uso asistencial real.
La bandeja local requiere que el personal consulte la app; no promete entrega
de avisos si esta cerrada. Registrar comunicacion prevista no acredita realizada.

Antes de programar transiciones, definir estados y cierre cuando se cancelan
analiticas, anulaciones/correcciones tras alta, agrupacion muestra/analitica,
aceptacion de responsable de seguimiento y cobertura si su cuenta se desactiva.
Resolver tecnicamente lo rutinario; consultar al usuario las nuevas decisiones
de operacion o permisos. No suponer que cerrar un turno elimina responsabilidad.

Referencia de seguridad para seguimiento al alta, no norma local:
[AHRQ, RED Toolkit](https://www.ahrq.gov/patient-safety/settings/hospital/red/toolkit/redtool3a.html).

## Avance de integracion: respaldos (28/10/2026)

El respaldo standalone reconoce las 12 tablas y el marcador unico de esquema v2.
Rechaza familias incompletas o versiones incompatibles, conserva compatibilidad
con bases anteriores sin LAB y no ejecuta migraciones. Restauracion ensayada
con datos ficticios no vacios en todas las tablas, igualdad de filas/esquema,
referencias y guardas de inmutabilidad. Validacion afectada: 36/36 aprobadas
(18 nuevas y 18 existentes), 14,92 s. La API y el esquema no cambiaron;
las 159 pruebas anteriores se conservan como base sin repetirlas.
Faltan rutas/alta, guardas, bandejas e interfaz antes de activar en el demo.

## Avance de integracion: guardas y detalle global (28/10/2026)

Implementado puente sin migracion: esquema completo/version reconocida, detalle
clinico y recibos globales con LAB/custodia, version por datos persistidos sin
reloj, guardas compartidas contra completar/corregir tarea o alta por via antigua
si existe orden estructurada. Ordenes anteriores conservan circuito sin inferir
muestras/revisiones. Nuevas rutas aun sin montar en main; falta unificar el alta,
bandejas, inicializacion y UI. 11 pruebas dirigidas aprobadas (17,89 s) y caso de
cierre/reapertura adaptado al circuito con plan aprobado (7,33 s). Regresion final
backend completa: 486/486 aprobadas en 2187,98 s (36:27); primera ejecucion
interrumpida para adaptar ese caso. Frontend sin cambios, no se repiten suites.

## Avance de integracion: alta unificada (28/10/2026)

Motor compartido de cierre/custodia en ruta habitual cuando hay ordenes nuevas;
conserva clinical_version, exige clave/motivo y plan si faltan resultados. Legacy
conserva contrato y recibos; mixtas bloqueadas sin adopcion implicita. Endpoint
alternativo sigue solo en pruebas, delegando en motor comun. Sin nuevas rutas
montadas ni migracion demo. Validacion afectada final 109/109 aprobadas en
938,76 s (15:38), incluidas 11 nuevas. Las 486 anteriores son base previa;
no se repiten esquema, respaldos ni frontend sin cambios. Faltan bandejas,
cliente/tipos, inicializacion y pantallas.

## Avance de integracion: bandeja y consulta (28/10/2026)

Filtros por trabajo analitico, revision medica separada, workflow y contexto de
seguimiento, sin reescribir tarea portadora ni adoptar legado. Resumen acotado
sin QR, documento, nacimiento ni plan. Interfaz de consulta con detalles cerrados,
labels en espanol y fechas RD 12h. Nuevas sin formularios genericos; originales
conservan formularios/borradores. Iniciales 12 backend y 26 frontend aprobadas;
final afectada 21 backend y 55 frontend, lint/build aprobados. Completa frontend
inicial 605/609 (cuatro fallos); tres pasan acotadas y un timeout medido de nota
ajustado a pegado, con mismas aserciones/tiempos. Cuatro aprobados en final
afectada; completa no repetida ni declarada aprobada. No migra demo ni opera UI.
Faltan escrituras por muestra/analitica, cliente, arranque y mixtas.

## Avance: formularios de hechos de muestras (28/10/2026)

Obtencion/entrega por NURSE/LAB, recepcion/aptitud LAB, mismo componente en
bandeja y episodio. Contexto, version, motivo, performer y fecha declarada;
ninguna inferencia de procesamiento. Catalogo acotado de cuentas activas.
Borradores de pestana por API/cuenta/rol, 30 min, baseline conservada, sin
autorreenvio; mismo cliente de incertidumbre/idempotencia y confirmacion
coincidente para limpiar. Backend final 36/36; frontend 154/155 con timeout de
segunda prueba antigua de nota larga, ajustada por misma causa/pegado y mismas
aserciones, archivo 25/25. Proteccion final de respuestas tardias: 60/60 en siete
archivos. Lint/build aprobados, sin cambiar runner/tiempos ni repetir intactas.
Iniciales 17/22 UI y 10 backend; asercion de fieldset corregida.
Sin migrar demo ni interfaz operada. Faltan resultados/ordenes/arranque/mixtas.
