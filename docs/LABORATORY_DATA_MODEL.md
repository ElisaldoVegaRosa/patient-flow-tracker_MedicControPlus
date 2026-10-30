# Laboratorio: modelo y contratos de la primera etapa

## Estado y alcance

Arranque 28/10: main registra rutas LAB con conexion que requiere esquema
completo y compatible; no se ejecuta migracion desde API/lifespan. El POST
lab-discharge solo se registra en fabricas de ensayo, no en main. Seleccion
explicita MEDICCONTROL_DATABASE_PATH requiere una copia LAB existente, integral
y con referencias validas; demo_control usa esa variable solo para el backend
cuando se proporciona Start -Database y registra su ruta para impedir confusiones.
Preparacion y snapshots descritos en LABORATORY_ACTIVATION.md; original sin LAB.



Seguimiento UI 28/10: GET /lab/followup-doctors publica solo medicos activos
(id,username,display_name,role,active) para medicina/coordinacion. GET history
por seguimiento devuelve pagina de cambios (motivo, actor y plan/personas previo
/nuevo), sin snapshots completos de analiticas. La bandeja conserva propuestas
pendientes incluso con resultados/revisiones resueltos. Dashboard agrega
laboratory_enabled segun esquema completo. No activa migracion ni rutas nuevas.



Alta mixta acordada 28/10: orden anterior pendiente bloquea; resultado anterior
COMPLETED exige texto no vacio y confirmacion del medico responsable con
legacy_reviews=[{task_id,version}]. ANNULLED no tiene resultado vigente que
confirmar. Anular un resultado anterior en episodio activo vuelve a PENDING,
por lo que sigue bloqueado hasta resolverlo; no equivale a cancelar la orden.
La version clinica y cada version anterior se cotejan en la misma transaccion.
Se persiste snapshot en lab_changes, recurso LEGACY_RESULT/REVIEW_AT_DISCHARGE,
con actor, motivo y discharge_event_id; no se crean muestras/analiticas/revisiones
estructuradas para la orden anterior. Fallo revierte cierre y auditoria.
La huella de recibos antiguos omite legacy_reviews cuando es lista vacia.


Actualizacion de repeticiones/cancelaciones 28/10: UI usa version de muestra
para repeat y version de analitica para cancel/reinstate. Linaje incorpora nombre
de usuario solicitante; bandeja proyecta linaje acotado y bandera de plan exigido
para restituir pendientes tras el alta. Las reglas del servidor no cambian.
Sigue sin activar rutas nuevas ni migrar original.


Actualizacion de ordenes 28/10: formulario medico usa POST de lab-orders con
version clinica y clave. Construye analiticas y muestras con claves estables,
relaciones explicitas y motivo; no publica hechos ni infiere tipos de muestra.
Visible solo con proyeccion LAB, rol medico y episodio activo. Rutas nuevas
siguen sin montar en main; sin migrar la base demo.


Actualizacion 28/10: contratos implementados en servidor aislado y formularios
locales de muestras/resultados. La proyeccion por analitica incluye ETag,
medico confirmado, muestras requeridas y versiones con motivo/fecha de revision.
El cliente usa esa version, no la version clinica del episodio, para cada envio.
Publicar confirma IDs exactos de muestras; corregir conserva sus fuentes y
crea otra version que requiere revision propia. No se montan rutas nuevas ni
se migra la base demo durante el arranque. Texto original siguiente es contexto
del diseno inicial; no implica que estos endpoints esten activos en el demo.


27/10/2026. Diseno tecnico basado en los archivos actuales, sin activar tablas,
rutas, migraciones ni cambios del demo. Complementa el
[alcance funcional acordado](LABORATORY_TRACKING_PLAN.md).
Esta entrega cubre modelo logico, contratos propuestos y compatibilidad, con
esquema ejecutable ensayado de forma aislada. Las tablas existen solo en copias
de prueba; las rutas siguientes siguen siendo propuestas, no endpoints disponibles.
El modulo `backend/app/laboratory_schema.py` ejecuta el SQL canonico de
`backend/migrations/011_laboratory.sql` con transaccion propia. No se importa
ni invoca desde el arranque de la aplicacion.

## Base comprobada

- `backend/app/database.py`: `tasks` guarda un solo texto `result` por tarea;
  `record_changes` conserva cambios sobre TASK, EVENT o EPISODE.
- `backend/app/routes/tasks.py`: orden LAB es una tarea; `complete_task` exige
  episodio activo antes de publicar. `laboratory_orders` distingue estados
  generales, sin muestras ni analiticas independientes.
- `backend/app/routes/record_lifecycle.py`: corregir resultado LAB actualiza
  `tasks.result`; anularlo deja PENDING si episodio activo y ANNULLED si cerrado.
  No reutilizar este comportamiento como repeticion de una muestra nueva.
- `backend/app/routes/medical.py`: alta comprueba reevaluaciones pendientes,
  pero no resultados LAB ni su revision. Conservar ese control existente.
- `backend/app/concurrency.py`: version clinica se calcula con tareas, eventos,
  constantes, alertas y cambios; las nuevas tablas no entraran automaticamente.
- `backend/app/write_operations.py`: transaccion `BEGIN IMMEDIATE`, sesion
  revalidada y recibos de idempotencia. Reutilizar estas garantias.
- `frontend/src/pages/LaboratoryPage.tsx`: pendientes de episodios cerrados
  quedan visibles sin formulario de publicacion. Debe cambiar solo para el
  circuito nuevo con seguimiento explicitamente registrado.
- `scripts/demo_db_backup.py`: verifica familias de tablas opcionales completas;
  agregar la familia LAB al integrar, sin exigirla en respaldos anteriores.

## Modelo logico propuesto

Identificadores internos enteros; fechas persistidas UTC con zona explicita y
presentacion dominicana de 12 horas. Sin datos clinicos en claves de operacion.
Campos revision monotona para recursos mutables; auditoria no editable por API.

| Entidad propuesta | Contenido y relacion | Invariante principal |
|---|---|---|
| `lab_orders` | Extension 1:1 de tarea LAB; `task_id`, revision y fecha de creacion estructurada | La tarea conserva id, episodio y titulo; no crear otra orden para migrarla |
| `lab_analyses` | Analiticas explicitamente solicitadas dentro de una orden; id, task_id, titulo, revision | No deducir determinaciones separando texto de ordenes antiguas |
| `lab_specimens` | Intento de muestra: orden, tipo, lugar, hechos registrados de toma/entrega/recepcion, aptitud, revision | Heces y orina distintas; no inferir obtencion o recepcion por publicar resultado |
| `lab_analysis_specimens` | Asociacion de analiticas con muestras de la misma orden | Varias analiticas pueden utilizar una muestra; una analitica puede requerir varias |
| `lab_specimen_repeats` | Muestra anterior, nueva muestra, analiticas afectadas, motivo, solicitante y fecha | Repeticion es otro intento, no sobrescritura ni analitica nueva |
| `lab_result_versions` | Analitica, secuencia, texto publicado o anulacion, version anterior, autor, fecha y motivo | Historial inmutable; version vigente se determina explicitamente |
| `lab_result_specimens` | Version publicada y muestras efectivamente utilizadas | Poder reconstruir que muestra sustenta cada version, incluso tras repeticion |
| `lab_result_reviews` | Version exacta, medico, fecha y contexto de responsabilidad al revisar | Abrir pantalla no revisa; corregir/anular no hereda revision anterior |
| `lab_followups` | Plan por evento de alta: episodio, responsable, receptor propuesto, fecha prevista, plan de comunicacion, motivo y revision | Independiente del turno; conserva ciclos de reapertura y alta separados |
| `lab_followup_scope` | Analiticas incluidas en cada plan de alta y versiones conocidas entonces | Instantanea inmutable; no sobrescribirla al reabrir/dar de alta otra vez |
| `lab_changes` | Episodio, orden, recurso, accion, actor, fecha, motivo y antes/despues | Sin QR ni sesiones en snapshots; interfaz muestra campos legibles |

Cada asociacion debe comprobar orden y episodio coincidentes; una FK simple al
id no basta para evitar relaciones entre pacientes. Usar claves compuestas o
guardas transaccionales verificadas, segun el DDL definitivo. Sin cascadas que
borren historia. Publicar resultado no elimina muestras ni revisiones.

El profesional que registra un hecho y quien lo realiza pueden ser distintos.
Para toma o entrega, distinguir usuario del sistema, paciente y tercero; no
crear una cuenta al paciente. Registrar instante del hecho y del registro,
sin atribuir al paciente autenticacion o autoria de una escritura del personal.

La relacion de repeticion debe indicar cuales analiticas necesitan nueva
muestra: rechazar una muestra no invalida otras ni borra resultados publicados.
La repeticion no se cuenta como otro requisito adicional eterno: para pendientes
se usa el intento requerido vigente, conservando intentos anteriores en historia.

## Estados separados y calculados

No condensar todo en `tasks.status` ni convertir revision medica en estado LAB.
Representar por separado:

- Muestra: obtencion pendiente/registrada; recepcion pendiente/registrada;
  aptitud sin evaluar/apta/no apta. Estos nombres son de presentacion propuestos.
- Analitica: sin resultado vigente, resultado vigente publicado o tratamiento
  pendiente de una anulacion, o cancelada con motivo por el medico responsable.
- Orden: pendiente, parcialmente publicada o laboratorio completado, derivado
  de analiticas solicitadas vigentes. No contar muestras recibidas como resultados.
- Revision: por version vigente, pendiente o revisada. Mostrar tambien versiones
  anteriores y quien las reviso. Una version anulada no cuenta como resultado apto.
- Seguimiento tras alta: pendientes de publicacion, pendientes de revision,
  relevo pendiente y necesidad de cobertura. Que no quede trabajo pendiente no
  prueba que el paciente recibio la informacion; no mostrar comunicacion realizada
  a partir del plan. El registro de comunicacion efectiva queda por concretar.

No introducir umbrales de demora clinica ni clasificar resultados criticos
automaticamente. La fecha de seguimiento procede de una decision registrada.

## Contratos de API propuestos

Mantener cliente centralizado y tipos compartidos existentes. Respuestas incluyen
identificadores, revision/version, acciones permitidas y motivos de bloqueo.
Todos los permisos se vuelven a comprobar dentro de la transaccion.

| Operacion propuesta | Permiso/condicion | Precondicion y resultado |
|---|---|---|
| `POST /episodes/{id}/lab-orders` | DOCTOR, episodio activo | Lista explicita de analiticas y requisitos de muestra; crea tarea LAB mas extension atomicamente |
| `GET /lab/orders` | Conservar permisos actuales LAB/SUPERVISOR | Campos nuevos opcionales y modo LEGACY/STRUCTURED; no ampliar esta ruta a otros roles |
| Detalle LAB en episodio/historial | Permiso actual de consulta de episodio | Medicina/enfermeria consultan datos pertinentes sin obtener permiso de publicacion |
| `POST /lab/specimens/{id}/collection` | LAB/NURSE para registro profesional | Hecho de toma, lugar y quien lo realiza; no acredita recepcion |
| `POST /lab/specimens/{id}/receipt` | LAB | Confirma llegada; evaluacion de aptitud explicita, sin valor apta por defecto |
| `POST /lab/specimens/{id}/suitability` | LAB | Registra aptitud o no aptitud con motivo; no borra publicaciones |
| `POST /lab/specimens/{id}/repeat` | LAB | Nueva muestra e ids de analiticas afectadas de la misma orden, con motivo; sin agregar analiticas |
| `POST /lab/analyses/{id}/results` | LAB | Texto, muestras fuente y motivo; publica una version inmutable |
| `POST /lab/results/{id}/corrections` | LAB | Referencia a version vigente y motivo; nueva version, no UPDATE de texto historico |
| `POST /lab/results/{id}/review` | Medico responsable activo del episodio o del seguimiento tras alta | Exige version vigente y responsabilidad confirmada; registro de revision |
| POST /lab/analyses/{id}/cancel y /reinstate | Medico responsable confirmado | Motivo, version e historial; no elude revision de informes disponibles |
| Alta existente | Medico autorizado, controles actuales mas controles nuevos | Version de plan y resumen LAB; verificacion atomica de revisiones y pendientes |
| `GET /lab/followups` | DOCTOR, NURSE, LAB, SUPERVISOR | Paginada y con pendientes de episodios cerrados; no reutilizar filtros solo ACTIVE |
| Proponer/aceptar relevo de seguimiento | Responsable y receptor segun politica a confirmar | Hasta aceptar conserva anterior; no modificar `care_slots` de episodios activos por este relevo |

No exponer operaciones cuyo permiso siga pendiente. La entrega/transporte de
muestras debe quedar documentada; su formulario y permiso se resolveran junto
con la toma, sin crear escrituras autenticadas para pacientes.

Escrituras nuevas exigen `Idempotency-Key` e `If-Match`. Falta de precondicion:
428; version/cambio de estado: 409; rol o responsabilidad no permitidos: 403;
entrada invalida: 422; referencia inexistente: 404 conforme a acceso existente.
Reintentar misma operacion no duplica version ni revision. Revalidar permiso
actual antes de devolver un recibo si cambio el responsable o se desactivo cuenta.

Las versiones de orden/alta deben incluir revisiones de todas las entidades LAB
relevantes y responsabilidad; el paso del reloj no cambia version. No confiar
solo en `task_version`, pues un cambio de muestra/revision puede no tocar tareas.
Publicar, corregir, revisar y dar alta comparten transaccion serializada; un
resultado que llegue primero invalida la pantalla de alta. Si alta se confirma
primero, la publicacion posterior conserva el pendiente en seguimiento cerrado.

## API de muestras implementada en entorno aislado

`backend/app/routes/laboratory_samples.py` y `backend/app/laboratory_samples.py`
implementan las operaciones siguientes, sin registro en `main.app` y sin cambiar
la inicializacion del demo. Solo el servidor de pruebas temporal monta el router.
No son rutas disponibles para pruebas manuales en localhost todavia.

| Operacion | Permiso implementado | Comportamiento |
|---|---|---|
| GET episodio/laboratory | DOCTOR, NURSE, LAB, SUPERVISOR | Ordenes estructuradas, ids heredados e historial; lectura sin escrituras |
| POST episodio/lab-orders | DOCTOR | Lista explicita de analiticas y muestras, relacion muchas a muchas, sin adoptar ordenes antiguas |
| POST muestra/collection | NURSE, LAB | Lugar y quien obtuvo; USER o PATIENT; profesional distinto del registrador si se indica |
| POST muestra/delivery | NURSE, LAB | Quien entrega; no acredita recepcion ni procesamiento |
| POST muestra/receipt | LAB | Confirma llegada; aptitud sigue sin evaluar |
| POST muestra/suitability | LAB | Apta o no apta con motivo, despues de recepcion |

Creacion exige version clinica del episodio. Acciones sobre muestras exigen su
version devuelta por el lector; incluyen revision de orden, estado del episodio
e identidad. Una escritura invalida borradores antiguos de la misma orden.
Todas exigen clave de idempotencia y motivo; el recibo referencia episodio,
sin guardar texto clinico ni QR en su resumen. La sesion se revalida dentro
de la transaccion, tambien antes de devolver un recibo repetido.

Toma y entrega distinguen actor autenticado de quien realiza el hecho. USER sin
id explicito significa el propio registrador; si se indica otra cuenta debe ser
activa de NURSE/LAB. PATIENT no lleva cuenta profesional. El personal registra
la entrega; no se crean sesiones de pacientes. Los snapshots conservan cada hecho.

Puede recibirse una muestra cuya toma no se habia registrado; eso no inventa
una toma. `occurred_at` opcional guarda el instante real con zona explicita;
si se omite usa el instante de registro. Puede preceder a la carga de la orden,
sin inventar una prohibicion clinica. No admite futuro ni contradice otros hechos
ya registrados (toma, entrega, recepcion). Auditoria mantiene ademas su fecha de
registro independiente. La aptitud usa fecha del servidor al registrar.

En esta etapa un hecho ya registrado no se sobrescribe: conflicto explicativo.
La rectificacion operacional y los estados de procesamiento
requieren los flujos posteriores, con conservacion de historia. Limite tecnico
de 30 analiticas y 30 muestras por peticion, no un limite clinico de atencion.

Condiciones antes de montar en la aplicacion principal:

- Completar flujo de resultados y bloquear sus atajos de completar/corregir tarea
  generica para ordenes estructuradas.
- Aplicar controles transaccionales de alta/seguimiento acordados y versiones
  clinicas que incluyan todas las entidades pertinentes.
- Integrar familia LAB en respaldos, inicializacion y ensayo de restauracion.
- Incorporar cliente/tipos, formularios, nombres comprensibles de eventos y
  pruebas de interfaz; solicitar autorizacion antes de operar la app del usuario.

La API de muestras exige orden PENDING. En ACTIVE conserva el circuito previo;
en CLOSED requiere custodia vigente y analiticas incluidas explicitamente en el
ambito del alta. ANNULLED nunca habilita esta excepcion. Nuevas ordenes siguen
requiriendo ACTIVE.

## Repeticion de muestras implementada (API aislada)

`POST /lab/specimens/{id}/repeat` requiere LAB, episodio ACTIVE, orden PENDING,
muestra REJECTED, version actual, clave de idempotencia y motivo. Peticion:
`analysis_ids`, lista no vacia de ids enteros positivos distintos (maximo tecnico
30). Normaliza el orden de ids para que reintentos equivalentes sean iguales.

Todas las analiticas deben estar vinculadas a esa muestra y orden, no canceladas
y seguir requiriendo ese intento. Rechaza mezclas invalidas antes de escribir:
no crea parcialmente una muestra para las analiticas que si eran validas.
No habilita analiticas nuevas ni permite cambiar tipo de muestra en la peticion.

Crea una sola muestra nueva para la seleccion, copiando unicamente tipo y
su descripcion. Toma, entrega, recepcion y aptitud quedan pendientes, sin copiar
profesionales, ubicacion o fechas del intento anterior. Conserva la muestra
original y sus hechos. En las asociaciones seleccionadas marca el intento
anterior como historico y crea la nueva necesidad; las otras siguen intactas.

El lector conserva `analysis_ids` como necesidades actuales y agrega
`historical_analysis_ids` para asociaciones anteriores, mas `repeats` con
linaje, analitica, solicitante, motivo y fecha. Hay una fila de linaje por
analitica afectada y una muestra nueva por solicitud; para presentar solicitudes,
agrupar por `new_specimen_id`, sin contar cada fila como otra toma.

Una muestra compartida puede repetirse por partes: despues de seleccionar unas
analiticas, las restantes pueden solicitarse con la version actual. No vuelve a
repetir desde el intento antiguo una analitica ya trasladada al nuevo intento.
Si la nueva muestra tambien se recibe y declara no apta, puede repetirse desde
ella, conservando la cadena completa. No se borran o reinterpretan resultados
ni revisiones existentes; una correccion de resultado es otra accion explicita.

Solicitud, asociaciones, linaje, revisiones de recursos, auditoria y evento
`LAB_SAMPLE_REPEAT` se confirman atomicamente. Mismo reintento no duplica; una
solicitud concurrente distinta con version vieja se rechaza. Ante fallo de
auditoria se revierten tambien los enlaces y la nueva muestra. Los snapshots
conservan fuente anterior y reemplazo inicial para distinguir solicitud de toma.

Medicina y enfermeria pueden consultar la nueva muestra pendiente por el lector
clinico autorizado. Laboratorio coordina su obtencion segun movilidad; esta API
no asigna automaticamente un profesional ni acredita aceptacion, toma, traslado
u obtencion por registrar una solicitud. No hay avisos fuera de la aplicacion.
Sigue sin montarse en main.app y no hay pantallas nuevas todavia.

Validacion de esta ampliacion: 83/83 aprobadas (123,92 s) en las suites afectadas:
26 de API de muestras, 19 de repeticion y 38 de esquema. Tres pruebas dirigidas
iniciales tambien aprobadas antes de la regresion. La suite completa de 362
corresponde a la base anterior; no presentarla como nueva ejecucion completa.
No se repiten modulos backend ajenos o frontend, cuyos archivos no cambiaron.

Comando ejecutado desde PowerShell, con PYTHONPATH=backend configurado segun
el comando anterior de validacion:

```powershell
$env:PYTHONPATH = 'backend'
.\.venv\Scripts\python.exe -m pytest -q --disable-warnings -x backend/tests/test_laboratory_samples.py backend/tests/test_laboratory_repeats.py backend/tests/test_laboratory_schema.py --basetemp .tmp/pytest-laboratory-repeats-20261027
```

Al integrar resultados, una version antigua conservada no acredita que la nueva
muestra pendiente ya produjo un resultado. Comparar muestras fuente de la version
con los requisitos actuales; mantener el pendiente de repeticion separado del
texto y revision anteriores. No cerrar una orden solo porque tenia un resultado
publicado antes de solicitar la nueva muestra.

## Resultados parciales y revision implementados (API aislada)

El router de muestras incluye el router de resultados en su servidor aislado;
no registrar ambos por separado al integrar para evitar rutas duplicadas.
`backend/app/laboratory_results.py` genera la lectura; el router homonimo bajo
routes aplica permisos y escrituras. Sigue sin haber activacion en main.app.

| Ruta | Permiso y precondicion | Efecto |
|---|---|---|
| POST /lab/analyses/{id}/results | LAB; version de analitica, clave de operacion y motivo | Publica una version para esa analitica y muestras fuente exactas |
| POST /lab/results/{id}/corrections | LAB; version publicada vigente y motivo | Nueva version de texto, conservando las mismas fuentes |
| POST /lab/results/{id}/annul | LAB; version publicada vigente y motivo | Version ANNUL sin texto, conserva historia; no cancela analitica |
| POST /lab/results/{id}/review | DOCTOR responsable confirmado; version actual y motivo | Revision de esa version con medico, fecha y revision de responsabilidad |

Publicacion exige exactamente todas las muestras requeridas actuales, recibidas
y aptas. No publica otras analiticas que compartan la muestra. Una nueva
publicacion no duplica un resultado ya vigente para esas fuentes: usar correccion
con motivo. Tras anulacion o repeticion con fuentes nuevas puede publicar otra
version, conservando predecesora y secuencia. No interpreta valores ni genera
clasificacion automatica de resultados criticos.

Correccion y anulacion son entradas nuevas, sin sobrescribir el resultado ni
su revision previa. Corregir preserva las muestras fuente del texto anterior:
si hay una repeticion pendiente, corregir la redaccion antigua no la resuelve.
La version nueva requiere revision medica independiente; consultar no revisa.

El lector conserva `analyses` sin cambiar sus campos y agrega `results`, un
estado por analitica con versiones, fuentes, revision medica y propietario actual.
`current_version` identifica la ultima, incluida ANNUL cuando corresponda.
Cabecera If-Match de las cuatro acciones: `results[i].version`, no task.version.

Resumen independiente de la responsabilidad medica:

- `laboratory_status`: PENDING, PARTIAL o COMPLETED segun resultados que cubren
  las muestras requeridas actuales. COMPLETED_WITH_CANCELLATIONS si se cancelan
  algunas y las restantes estan completadas; CANCELLED si se cancelan todas.
- `published_results`: textos publicados vigentes disponibles para consulta.
- `pending_results`: analiticas activas aun sin resultado que cubra fuentes
  actuales; puede coexistir con texto anterior disponible tras pedir otra toma.
- `pending_reviews`: versiones publicadas vigentes pendientes de revision medica.
- `cancelled_analyses`: cantidad separada, sin computarlas como resultados.

Por compatibilidad en este servidor aislado, no sincroniza todavia tasks.status
ni tasks.result con estos resúmenes. Es necesario adaptar bandejas, guardas y
alta antes de activar en el demo. Tampoco integra aun el detalle global de
episodio y la consulta general de recibos; ambos deben devolver la proyeccion LAB
actual al habilitar el circuito, sin aceptar confirmaciones de versiones nuevas
por una respuesta de operacion antigua.

La revision medica comprueba sesion, episodio activo y responsable real dentro
de la transaccion, tambien antes de devolver un recibo repetido. Un propuesto no
es responsable hasta aceptar; el anterior conserva autoridad mientras tanto.
Despues de aceptar, el anterior no puede reutilizar su recibo. No exige que el
turno siga dentro de horario: conserva la responsabilidad hasta el relevo.
Una transferencia de ida y vuelta cambia revision e invalida el formulario viejo.

Muestras y resultados comparten un marcador persistido del ciclo del episodio:
DISCHARGE, EPISODE_REOPENED y ARRIVAL_ANNULLED. Cerrar y reabrir invalida versiones
antiguas aunque el estado vuelva a ACTIVE. No incorpora reloj, presencia o lectura
QR al marcador, evitando conflictos por refresco o consulta.

Todas las escrituras usan transaccion, idempotencia y auditoria con autor/fecha.
Publicar y revisar/corregir simultaneamente no puede confirmar una version que
cambio durante la operacion. Fallos de auditoria revierten tambien versiones,
fuentes y revisiones. CLOSED requiere la excepcion de custodia/scope descrita
abajo; sin ese registro, o en ANNULLED, no se habilitan estas escrituras.

Validacion: tres casos iniciales aprobados; primera regresion con 20 resultados
aprobados antes de detectar una referencia incorrecta en la prueba de relevo
(DOCTOR/propose en vez de la ruta real DOCTOR/handoff). Las dos pruebas de relevo
corregidas y las 93 restantes/de regresion aprobaron, total 115 antes del refuerzo
de ciclo. Un caso adicional de cierre/reapertura aprobado. Regresion final de
las cuatro suites: 116/116 aprobadas (237,82 s): 33 resultados, 26 muestras,
19 repeticion y 38 esquema. No se repiten modulos ajenos ni frontend sin cambios.
La suite completa de backend 362 corresponde a la base previa a repeticion.

Comando final reproducible desde PowerShell:

```powershell
$env:PYTHONPATH = 'backend'
.\.venv\Scripts\python.exe -m pytest -q --disable-warnings -x backend/tests/test_laboratory_results.py backend/tests/test_laboratory_samples.py backend/tests/test_laboratory_repeats.py backend/tests/test_laboratory_schema.py --basetemp .tmp/pytest-laboratory-results-final-20261027
```

## Alta y seguimiento posterior implementados (API aislada)

Regla confirmada por el usuario: el medico responsable confirmado registra el
alta con resultados pendientes y conserva su seguimiento hasta relevo aceptado.
El protocolo aislado usa GET/POST `/episodes/{id}/lab-discharge` para pruebas.
Desde el 28/10, su motor tambien lo usa la ruta habitual `/episodes/{id}/discharge`
para ordenes estructuradas, con version clinica. No montar el endpoint alternativo
como segundo camino en el demo activo.

El GET devuelve una version que combina estado clinico, responsabilidad, ordenes,
resultados y reevaluaciones. POST exige esa version, clave de operacion, motivo y
nota. Bloquea reevaluaciones pendientes y resultados publicados sin revision.
Con resultados aun pendientes exige motivo de seguimiento, fecha futura explicita
y plan de comunicacion; el responsable es el medico confirmado, no un id enviado
por el cliente. Sin pendientes mantiene el permiso actual por rol DOCTOR y conserva
al responsable confirmado de laboratorio, aunque otro medico registre el alta.

Ordenes heredadas sin desglose se rechazan expresamente en este protocolo,
sin inventar muestras o revisiones. Las cancelaciones se cuentan por separado de
resultados y no requieren un resultado inexistente; los informes publicados
conservados siguen exigiendo revision. El circuito legado sigue por concretar
antes de la activacion general.

Por evento DISCHARGE crea custodia y ambito inmutable de todas las analiticas
estructuradas conocidas. `discharge_snapshot` conserva muestras requeridas,
version conocida y pendientes existentes al alta; no se reconstruyen a partir
del estado posterior. Con todo revisado, `review_due_at` y `communication_plan`
quedan NULL: no se inventa un plazo. La custodia conserva a quien responde por
una correccion tardia; si aparece trabajo nuevo, vuelve a la bandeja y senala
que necesita un plan cuando no habia ninguno. El medico puede revisarlo de
inmediato o registrar un plan con fecha futura, motivo y auditoria.

Prototipo de esquema actualizado a version 2, aun sin desplegar: campos de plan
opcionales como pareja y snapshot JSON inmutable por analitica. El ejecutor
rechaza intactas las copias experimentales v1, sin sobrescribir ni descartar
sus datos. No son bases del demo: el original sigue sin tablas LAB. El ensayo
v2 se aplica a copia nueva del original, dos veces, con 26 tablas previas
identicas, integridad/FKs y restauracion SQLite comprobadas.

| Ruta aislada | Permiso | Alcance |
|---|---|---|
| GET /lab/followups | DOCTOR, NURSE, LAB, SUPERVISOR | Bandeja transversal, filtro mine e include_resolved; limit 1-100 y offset |
| GET /lab/followups/{id} | Mismos roles clinicos | Estado actual y scope/snapshot, incluso de ciclos historicos |
| POST /lab/followups/{id}/plan | Medico responsable | Fecha futura y comunicacion con motivo; conserva versiones anteriores en auditoria |
| POST /lab/followups/{id}/propose | Responsable o coordinacion clinica con permiso propio | Propone DOCTOR activo; no transfiere responsabilidad |
| POST /lab/followups/{id}/accept | Medico receptor propuesto | Acepta responsabilidad, sin modificar care_slots del episodio |
| POST /lab/followups/{id}/cancel-handoff | Participantes o coordinacion clinica | Cancelacion/rechazo con motivo, conserva anterior responsable |

La autoridad se revalida dentro de la transaccion. Propuesta, aceptacion y plan
revalidan tambien antes de devolver recibos; aceptar permite repetir el recibo
mientras ese medico siga responsable. La cancelacion puede confirmar su recibo
historico sin repetir la accion. Coordinacion puede proponer cobertura de una
cuenta desactivada, sin asumir revision medica ni sustituir sin aceptacion.
No requiere que el turno siga en horario: no es una asignacion de jornada.

Las escrituras de muestras/resultados sobre CLOSED requieren custodia del ciclo
vigente y pertenencia explicita de las analiticas al ambito del alta. Esto permite
toma/recepcion, repeticion de muestras de la misma analitica, publicacion y revision
posteriores. No permite crear otra orden clinica despues del alta. El medico de
revision en CLOSED es el responsable del seguimiento; ACTIVE usa care_slots.
Reabrir desactiva autoridad del plan antiguo sin borrar su historia; una nueva
alta crea otra custodia y scope, sin reemplazar la anterior. ANNULLED no admite
esta excepcion.

La bandeja por defecto muestra trabajo clinico pendiente del ciclo cerrado actual.
Al resolver resultados/revisiones conserva registros consultables con
include_resolved; no afirma contacto realizado con el paciente. Guardar plan de
comunicacion no acredita su ejecucion y no envia mensajes externos. `overdue`
es una indicacion del plazo registrado, sin bloquear revision tardia; reloj y
vencimiento quedan fuera de la version para evitar conflictos por refresco.

Pruebas dirigidas: esquema v2 39 aprobadas antes de agregar dos casos de plan/
snapshot; tres casos centrales y cuatro de relevo/reapertura aprobados. Se corrigio
una consulta de prueba que usaba id en lab_followup_scope, cuya clave es compuesta.
Regresion final: 144/144 aprobadas (384,21 s): 25 alta/seguimiento, 33 resultados,
26 muestras, 19 repeticion y 41 esquema. Incluye casos de revision posterior,
correccion tardia sin plazo inventado, cobertura de titular inactivo, concurrencia
alta/publicacion y rollback de alta/relevo. No se repiten modulos backend ajenos
ni frontend sin cambios. Las 116 anteriores siguen como base antes del seguimiento;
las 362 de backend completo corresponden a la etapa previa a repeticion.

Comando final desde PowerShell:

```powershell
$env:PYTHONPATH = 'backend'
.\.venv\Scripts\python.exe -m pytest -q --disable-warnings -x backend/tests/test_laboratory_followups.py backend/tests/test_laboratory_results.py backend/tests/test_laboratory_samples.py backend/tests/test_laboratory_repeats.py backend/tests/test_laboratory_schema.py --basetemp .tmp/pytest-laboratory-followups-final-20261027
```

## Cancelacion y restitucion (API aislada, 28/10/2026)

Estados confirmados por el usuario:

- COMPLETED_WITH_CANCELLATIONS: Finalizada con cancelaciones, cuando se cancelaron
  algunas analiticas y todas las restantes tienen resultados para las muestras
  actuales. No acredita revision medica; se muestra su contador separado.
- CANCELLED: Cancelada, si todas las analiticas se cancelaron. No oculta un informe
  conservado ni una correccion posterior pendiente de revision.
- Con otras analiticas aun pendientes conserva PENDING/PARTIAL y el numero de
  cancelaciones. Cancelar nunca crea un resultado para llenar un pendiente.

POST `/lab/analyses/{id}/cancel` requiere medico responsable confirmado en el
contexto actual (care_slots en ACTIVE o custodia vigente en CLOSED), motivo,
version y clave de operacion. Propuesto y coordinador que no sea responsable
no obtienen ese permiso. Revalida responsabilidad tambien antes de repetir un
recibo. Guarda fecha, autor, motivo y snapshot, sin borrar hechos de muestras.

La analitica debe tener trabajo pendiente: no permite cancelar un resultado ya
completado, ni cancelar para eludir un informe disponible sin revisar. Si existe
un resultado anterior revisado y una repeticion pendiente, puede detener la
repeticion de esa analitica conservando el informe y las asociaciones historicas.

POST `/lab/analyses/{id}/reinstate` permite corregir una cancelacion por error,
con los mismos permisos y auditoria. Recupera requisitos originales, sin inventar
toma, recepcion, fechas o nuevas analiticas. El motivo de cancelacion permanece
en el historial aunque se limpien sus campos actuales. Revierte con revision
monotona, invalidando formularios previos aunque el estado vuelva al anterior.
En CLOSED exige plan existente antes de restituir trabajo pendiente; el medico
lo registra expresamente, sin crear un plazo automatico.

Laboratorio puede corregir o anular un informe publicado conservado y el medico
confirmado revisarlo aunque su analitica este cancelada. Publicar nuevos resultados
sigue bloqueado mientras este cancelada. `pending_reviews` cuenta todas las
versiones publicadas vigentes sin revision, incluidas las de analiticas canceladas,
tanto en el alta como en seguimiento. Una correccion tardia vuelve a la bandeja.
La cancelacion y la anulacion de una version son operaciones distintas.

Snapshot al alta registra cancelacion y motivo, sin tratarla como resultado
faltante. El alta sigue bloqueada por informes sin revisar y reevaluaciones
pendientes. Si todo esta completado/cancelado no inventa plan o fecha; conserva
custodia para posibles correcciones posteriores.

No se modifico el esquema v2 ni se activo la API en main.app. Primeras pruebas:
tres casos aprobados y fallo de restitucion cerrada por comparar id de ruta
como texto con ids persistidos enteros. Se corrigio el control compartido para
usar el id leido de base; la prueba afectada aprobo. Regresion final de las seis
suites: 159/159 aprobadas (1105,19 s): 15 cancelaciones, 25 seguimiento,
33 resultados, 26 muestras, 19 repeticion y 41 esquema. Las 144 previas son
base anterior, no una nueva ejecucion; backend ajeno y frontend sin cambios.

Comando final desde PowerShell:

```powershell
$env:PYTHONPATH = 'backend'
.\.venv\Scripts\python.exe -m pytest -q --disable-warnings -x backend/tests/test_laboratory_cancellations.py backend/tests/test_laboratory_followups.py backend/tests/test_laboratory_results.py backend/tests/test_laboratory_samples.py backend/tests/test_laboratory_repeats.py backend/tests/test_laboratory_schema.py --basetemp .tmp/pytest-laboratory-cancellations-final-20261028
```

## Compatibilidad y migracion propuesta

1. Primera migracion solo crea estructuras vacias, en transaccion repetible.
   No modifica tareas ni rellena muestras, analiticas, autores o revisiones.
2. Orden sin extension se presenta LEGACY con su texto e historial originales;
   orden estructurada conserva el mismo identificador de tarea.
3. Prohibir rutas genericas de completar/corregir una tarea estructurada: devolver
   conflicto explicativo hacia el flujo especifico. Mantener el flujo heredado
   de ordenes antiguas hasta acordar adopcion explicita, sin cambiarlo a escondidas.
4. En el alta, distinguir ordenes antiguas no desglosadas: no marcarlas revisadas
   ni excluirlas silenciosamente de la lista de pendientes. Antes de activar el
   nuevo bloqueo hay que definir su tratamiento con el usuario.
5. `tasks.result` queda como texto heredado para LEGACY. Para STRUCTURED, la API
   obtiene resultados de versiones por analitica; no usar concatenacion como
   fuente de verdad ni resultado parcial como task COMPLETED.
6. Integrar migracion en inicializacion solo cuando pruebas y respaldo acepten la
   familia completa de tablas nuevas. Respaldos antiguos sin esa familia siguen
   siendo validos; esquema parcialmente presente se rechaza y diagnostica.
7. Ensayar en copia: comparar esquema/datos previos, aplicar dos veces, comprobar
   integridad/FKs y restaurar snapshot. Probar fallo intermedio con rollback.
   Ninguna ruta nueva ni migracion se aplica al demo en esta entrega.

## Verificacion necesaria para implementar

Validacion completa antes de repeticion: backend 362/362 aprobadas, 614,62 segundos.
Incluye 38 pruebas de esquema y 26 de API de muestras. Las pruebas HTTP montan
un servidor separado y bases temporales; no se opero la app del usuario.
No se repiten pruebas/lint/build frontend: no hay cambios en su codigo.

Comando de la validacion completa ejecutada desde PowerShell:

```powershell
$env:PYTHONPATH = 'backend'
.\.venv\Scripts\python.exe -m pytest -q --disable-warnings -x backend/tests --basetemp .tmp/pytest-backend-lab-samples-20261027
```

En el ejecutor de Codex, el intento HTTP restringido se detuvo sin resultados;
la ejecucion con acceso del runner avanzo y detecto una consulta incorrecta en
la prueba (`id` en `lab_orders`, clave real `task_id`). Se corrigio la prueba,
se comprobaron rollback/fechas y luego se ejecuto una sola suite completa final.
No se alteraron tiempos ni runner para eludir errores de la aplicacion.


Validacion del esquema realizada: 37 pruebas dirigidas aprobadas y despues
1 prueba adicional de restauracion aprobada (37 no afectadas sin repetir).
Ensayo sobre copia de la base local: 26 tablas anteriores, incluida
`sqlite_sequence`, conservan definiciones y filas; doce tablas nuevas sin
hechos inferidos, migracion doble, integridad/FKs y restauracion SQLite correctas.
La base original se abrio en modo solo lectura y se comparo al terminar.
No se aplico la herramienta de restauracion sobre el demo ni se ensayaron
permisos clinicos, transiciones HTTP o pantallas nuevas.

Comando reproducible de la suite de almacenamiento desde PowerShell, usando
un directorio temporal nuevo en cada ejecucion para evitar bloqueos anteriores:

```powershell
$env:PYTHONPATH = 'backend'
.\.venv\Scripts\python.exe -m pytest -q --disable-warnings -x backend/tests/test_laboratory_schema.py --basetemp .tmp/pytest-lab-schema-next
```

Pendiente antes de activar el circuito:

- Varias muestras y analiticas, asociaciones cruzadas rechazadas, recepcion
  independiente, repeticion selectiva y datos originales conservados.
- Publicacion parcial, correccion/anulacion versionada, revision vinculada al
  responsable y version exacta; viejos formularios rechazados conservando borrador.
- Sesion caducada, cuenta desactivada, relevo pendiente/aceptado, reintentos,
  doble publicacion y carrera entre resultado/revision/alta.
- Episodio cerrado con plan, resultado posterior, correccion de resultado ya
  revisado y seguimiento conservado. ANNULLED no habilita escrituras nuevas.
- Migracion doble, fallo atomico, respaldos antiguos y familia incompleta.
- Controles de reevaluacion y tareas no LAB sin cambios de comportamiento.

## Pendientes antes de activar

Las reglas de cancelacion, cierre con pendientes, responsable y relevo ya estan
confirmadas y descritas arriba. No pedirlas otra vez.

1. Definir si el procesamiento iniciado se registrara como hito manual. Hasta
   entonces no inferir procesamiento a partir de recepcion o aptitud.
2. Concretar el tratamiento de ordenes antiguas sin desglose al integrar las
   reglas nuevas; conservar datos y distinguir lo no registrado, sin inventar
   muestras, revisiones o tiempos historicos.
3. Integrar bandejas, cliente/tipos e inicializacion. Alta definitiva ya usa
   motor comun; faltan compatibilidad de episodios mixtos y pantallas.
   Guardas de completar/corregir tarea implementadas para ordenes estructuradas;
   alta habitual ya usa motor comun con custodia. Detalle/recibos globales enriquecidos con LAB/custodia
   y version clinica estable frente al reloj. Ordenes anteriores sin adopcion.
   Validacion dirigida 11/11 y ciclo adaptado 1/1; backend completo final
   486/486 aprobado en 2187,98 s (36:27). Respaldos ya integrados:
   familia de 12 tablas, marcador unico v2 y restauracion con datos/guardas
   conservados; 36/36 pruebas afectadas aprobadas el 28/10/2026. Incorporar
   interfaz con etiquetas comprensibles y verificarla antes de migrar el demo.

No se aplica automaticamente el esquema al demo ni se opera su interfaz para
probarlo sin coordinar la prueba manual con el usuario.

## Alta unificada en la ruta habitual (28/10/2026)

`POST /episodes/{id}/discharge` usa `clinical_version` en `If-Match` para todos
los episodios. Si hay orden estructurada exige `Idempotency-Key`, `reason` y,
cuando faltan resultados, `followup` con `reason`, `review_due_at` consciente
de zona y `communication_plan`. El motor comun comprueba reevaluaciones,
revision, propietario, fecha futura y alcance, y crea cierre, evento, custodia,
scope, auditoria y recibo dentro de la misma transaccion.

Solo ordenes legacy mantienen contrato anterior de nota y huella de recibos;
campos LAB ausentes no cambian esa intencion. No aceptar/ignorar un plan LAB
cuando no hay orden estructurada. Si se mezclan tipos, bloquear explicitamente
hasta resolver la compatibilidad sin inventar muestras o revisiones pasadas.
El protocolo aislado `/lab-discharge` delega en el mismo motor y sigue sin
montarse como segundo endpoint de produccion. La integracion no migra el demo.

Validacion afectada final: 109/109 aprobadas en 938,76 s (15:38), incluidas
11 nuevas del alta unificada. Las 486 completas corresponden a la base previa;
no se repiten esquema, respaldos ni frontend sin cambios.

## Bandeja y contrato de consulta (28/10/2026)

GET `/lab/orders` conserva permisos LAB/SUPERVISOR y filtros PENDING, COMPLETED,
ALL. Una lectura transaccional clasifica LEGACY/STRUCTURED mediante `workflow`.
En nuevas, `status` conserva el valor de la tarea portadora; el trabajo se lee en
`laboratory.status` (PENDING/PARTIAL/COMPLETED/COMPLETED_WITH_CANCELLATIONS/CANCELLED).
`version` es la de la orden estructurada, sin habilitar escrituras genericas.
Legacy mantiene version de tarea y record_changes.

PENDING contiene trabajo no terminal, incluidos parciales; COMPLETED contiene
completadas, finalizadas con cancelaciones y canceladas, ademas de legacy
COMPLETED/ANNULLED. Revision medica pendiente no cambia ese filtro; se muestra
por separado en `pending_reviews`. Cambiar un resultado o requerir una nueva
muestra puede devolver trabajo al filtro pendiente conservando informes previos.

El resumen acota analiticas vigentes, muestras/factos y contadores. No incluye
QR, documento, nacimiento, cuentas de autores ni plan de comunicacion. Contexto
ACTIVE/FOLLOWUP/UNAVAILABLE segun ciclo y alcance de custodia, sin atribuir
permisos de escritura al supervisor ni inferir hechos. Episodios anulados fuera.
Vista de consulta con detalles cerrados; formatos y labels son presentacion.
Formularios de escritura por muestra/analitica siguen pendientes; no se ofrecen
los genericos para ordenes estructuradas, ni si falta su resumen.

Validacion final afectada: 21 backend (147,92 s), 55 frontend (26,80 s),
lint/build aprobados. Completa frontend inicial 605/609, cuatro fallos; tres no
reproducidos al acotar y uno por escritura larga medido y ajustado en prueba
mediante pegado, sin quitar aserciones/cambiar tiempos. Cuatro aprobados en final
afectada; completa no repetida/no declarada aprobada. No activa esquema ni rutas.

## Formularios de muestras y recuperacion (28/10/2026)

GET `/lab/sample-professionals` en router aun aislado: NURSE/LAB, solo cuentas
activas de esos roles, id/username/display_name/role. No usa permiso de coordinacion
ni amplia la bandeja. Version por muestra agregada al resumen de cola.

Obtencion/entrega desde bandeja LAB o episodio NURSE/LAB; recepcion/aptitud solo
LAB. Contexto cerrado exige ciclo y scope actuales. No envia accion sin version,
no sobrescribe hechos ya registrados y exige recepcion antes de aptitud.
SELF omite id para usar actor actual; OTHER envia cuenta elegida por nombre;
PATIENT no envia cuenta, THIRD_PARTY solo entrega. UI autotoma paciente solo
heces/orina; las reglas existentes de API no se cambian por el formulario.
Fecha declarada ahora omite occurred_at, o fecha/hora exacta con offset -04:00.

OperationalWriteForm extiende restauracion opcional, conservando comportamiento
sin draft. Baseline desde primer cambio o recuperado, revision explicita si
cambia. Cliente central mantiene clave/intencion y operaciones pendientes.
sessionStorage acotado a 100 borradores/500k caracteres, campos permitidos,
cuenta/rol/API/accion y 30 min desde ultima edicion (no renueva al leer).
No contiene token; logout o nuevo propietario limpia; fallos se notifican.
No restaura para otra cuenta ni envia automaticamente. Confirmacion coincidente
resetea solo ese formulario, sin borrar ediciones posteriores. RecoveredWrites
mantiene consulta manual y datos actuales si no hay cuerpo original comparable.

Validacion: backend 36/36 (142,38 s). Frontend inicial afectado 154/155;
timeout de segunda prueba de nota larga corregido en entrada por pegado,
con mismas aserciones/tiempos, archivo 25/25. Ultima proteccion contra respuestas
tardias y cambio de episodio: siete archivos 60/60 (15,27 s). Lint/build finales
aprobados. Sin repetir intactas ni declarar completa la inicial parcial.
Sin montar rutas nuevas o migrar demo.
