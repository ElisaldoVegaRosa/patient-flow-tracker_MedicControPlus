# Registro de comunicacion tras el alta

## Estado y objetivo

Bloque elegido y reglas aceptadas por el usuario el 30/10/2026. Implementacion
local de autorizacion, gestiones e historial. El plan previo communication_plan
se conserva; no acredita comunicacion realizada. Recepcion recibe una proyeccion
propia limitada, sin ampliar su acceso al seguimiento clinico ni a informes.

Problema: un plan escrito o un resultado revisado no demuestran que el paciente
haya sido contactado ni que recibiera una explicacion clinica.

Alcance inicial implementado: comunicacion del seguimiento LAB tras alta. Usar el
responsable medico y el ciclo de alta existentes; no crear otro sistema de relevo.
Los ensayos usan datos ficticios y se coordinan antes de operar la app.

## Reglas aceptadas

- Recepcion realiza las gestiones por telefono, presencial o WhatsApp institucional.
- El medico decide si autoriza solo pedir que el paciente contacte/regrese o un
  mensaje concreto. Recepcion transmite el texto autorizado sin interpretarlo.
- WhatsApp institucional se limita inicialmente a avisos de contacto, sin resultados.
- Guardar un plan, revisar un informe o registrar envio/lectura no acredita contacto.
- Contacto confirmado requiere respuesta y verificacion de identidad. No guardar
  documentos, capturas ni respuestas sensibles como evidencia de verificacion.
- Un intento sin respuesta mantiene el pendiente y permite programar otro intento.
  No hay un numero automatico de intentos que cierre el caso.
- Recepcion puede registrar aviso al medico responsable cuando no logra contacto.
  Registrar ese aviso no confirma que el medico lo haya leido o actuado.
- Explicacion clinica realizada por el medico es un hecho separado de transmitir
  el mensaje autorizado por Recepcion.
- Cada gestion conserva fecha, actor, medio y resultado. No sobrescribir intentos.
- El demo registra actuaciones manuales; no llama ni envia WhatsApp automaticamente.

## Separacion de permisos y datos propuesta

- Medico responsable: autoriza el aviso/texto y registra su explicacion clinica.
- Recepcion: consulta una bandeja limitada de avisos autorizados y registra gestiones.
  No obtiene por ello informes, notas ni acceso al seguimiento clinico completo.
- Coordinacion: consulta el estado operacional y los avisos de dificultad; la
  autoridad clinica y el relevo siguen las reglas existentes.
- La autorizacion debe comprobarse en API al consultar y al guardar, no solo ocultar
  botones. Administrar cuentas no concede permisos clinicos.

## Integracion y criterios de aceptacion propuestos

1. Mantener separados resultado pendiente/revision pendiente, contacto pendiente y
   explicacion clinica pendiente. Completar uno no completa automaticamente otro.
2. Mostrar los contactos pendientes aunque ya no queden resultados o revisiones LAB;
   el filtro actual por trabajo clinico no debe hacerlos desaparecer.
3. Vincular el mensaje autorizado al ciclo actual, al medico y, cuando corresponda,
   a las versiones de resultados revisadas. Una correccion no queda cubierta por
   una comunicacion anterior; conservar el historial y pedir nueva autorizacion.
4. Identificar claramente telefono, presencial y WhatsApp institucional. Envios o
   lecturas sin respuesta no se presentan como contacto confirmado.
5. No permitir que Recepcion registre una explicacion clinica como si fuera medico.
6. Conservar autor, fecha y valores autorizados de cada gestion, y una rectificacion
   auditada en lugar de borrar el hecho original.
7. Usar control de version, operaciones idempotentes y proteccion de formularios
   existentes. Un reintento de red no duplica intentos de contacto.
8. No migrar la base original ni activar cambios al consultar una pagina. Preparar
   cualquier esquema nuevo con el procedimiento explicito de copia y respaldo.
9. Cubrir permisos, ciclo anterior/reapertura, relevo, resultados corregidos,
   pendientes sin respuesta y concurrencia con pruebas dirigidas; validar completo
   al estabilizar. Prueba manual solo tras coordinacion con el usuario.

## Contacto externo: decision resuelta

Usuario eligio registrar gestiones y consultar el numero fuera de la app. No hay
campos de telefono, envio ni conversaciones. El motivo no debe usarse para copiar
numeros, documentos ni conversaciones.

## Implementacion local y limites

- API independiente: GET /communications, GET /communications/{id}, historial
  paginado y POST authorize/attempt/explain/rectify. El identificador es el del
  seguimiento, no el del paciente ni el del episodio.
- Autorizacion solo por medico responsable del ciclo cerrado actual. Un aviso
  nuevo conserva los anteriores y requiere registrar nuevas gestiones. Mensajes
  concretos requieren revision de informes vigentes; WhatsApp solo CONTACT_ONLY.
- Cada aviso conserva la version del seguimiento. Cambiar resultados, plan,
  responsable o ciclo exige nueva autorizacion. La base de version es la del
  seguimiento LAB existente; las comprobaciones se hacen dentro de la transaccion.
- Recepcion registra intentos; sin respuesta/aviso transmitido requiere proxima
  fecha futura. Enviado/leido solo corresponde a WhatsApp y nunca completa contacto.
- Explicacion final solo por medico responsable y tras resolver resultados y
  revisiones. Completar contacto no completa explicacion ni modifica alta o LAB.
- Historial clinico permite a Medicina/Supervision consultar el texto y motivo
  de autorizaciones anteriores. Recepcion nunca recibe ese texto historico como
  aviso reutilizable, ni recibe motivos de explicacion clinica.
- Rectificacion propia auditada del aviso vigente: retira vigencia del hecho sin
  borrarlo. Despues se registra la gestion correcta. Avisos anteriores son consulta.
- Una nueva bandeja mantiene visibles pendientes de comunicacion aunque LAB ya no
  tenga resultados o revisiones pendientes. Los avisos invalidos se retiran de
  Recepcion y quedan para revision medica; no se retransmite su texto.
- Formularios plegados, fechas dominicanas 12h, refresco visible cada 15 segundos,
  pausa con edicion, consulta manual conservando campos, borradores limitados a
  usuario/rol/pestana y comprobacion de version antes de reutilizarlos.
- Idempotencia mediante operaciones existentes. Los recibos nuevos guardan solo
  confirmacion, sin copiar mensajes o motivos. Una confirmacion recuperada no borra
  campos actuales sin disponer del cuerpo original que los identifica.

## Activacion en copia

El esquema 012_patient_communications.sql es aditivo, separado de LAB v2. No se
activa al arrancar ni consultar. Una base sin habilitar devuelve enabled=false;
un esquema parcial se rechaza. El preparador existente admite --communications:

```powershell
.\.venv\Scripts\python.exe .\scripts\prepare_laboratory_demo.py --source ".tmp\laboratory-rollout-20261028\clinical-lab-working.sqlite3" --destination ".tmp\communication-rollout-20261030\clinical-communication-working.sqlite3" --communications
```

Requiere destino nuevo. Hace respaldo/verificacion/restauracion a archivo temporal,
compara tablas anteriores e inspecciona integridad antes de publicar la copia con
checksum. No cambia el origen ni selecciona la copia para el servidor.
Tras autorizacion y cierre de sesiones confirmado por usuario, la copia indicada
se preparo y activo para el ensayo manual. Respaldo, hashes y Status registrados
en LOCAL_VALIDATION.md. Original y copia LAB anteriores permanecen separados.

Antes de ensayo manual: coordinar con usuario, cerrar formularios, preparar la
copia con respaldo, detener solo servicios gestionados e iniciar con -Database
apuntando al destino nuevo. No reutilizar ni sobrescribir la copia LAB actual.

## Validacion

Suites completas aprobadas: backend 573/573; frontend estable 766/766, 83 archivos.
Tras el ajuste final de consulta historica se validan solo los archivos afectados:
17 backend y 13 frontend. Lint/build finales aprobados sin advertencias.
Borradores/recuperacion validados ademas con 38 pruebas dirigidas. Resultados,
comandos y limites de cada ejecucion en LOCAL_VALIDATION.md. Sin prueba directa
de app, migracion de bases demo, reinicio, commit ni push del nuevo bloque.

## Resultado manual confirmado

Usuario confirma en EP-23 autorizacion del aviso, llamada sin respuesta, WhatsApp
leido sin respuesta y proximo intento conservado. Posterior contacto y aviso
confirmados no completan explicacion. Explicacion registrada oculta el caso del
filtro habitual; incluir completados permite verlo. Rectificacion conserva el
original y reabre explicacion; nueva explicacion registrada con historial completo.
Estado final reportado: contacto/aviso confirmados y explicacion registrada.

Se corrigio etiqueta de medico: cuenta medico activa con display_name vacio ahora
se identifica mediante username; no se cambio asignacion ni cuenta. Dirigidas
posteriores 19 backend/14 frontend y lint/build correctos. Usuario confirma pantalla.

La interfaz fue operada por usuario y no se realizaron contactos reales. Estas
confirmaciones corresponden al circuito basico, no a cada rama posible. Respaldo
posterior y restauracion verificados en archivo nuevo; ver LOCAL_VALIDATION.md.

## Guion de referencia para ensayo manual

1. Preparar copia nueva con respaldo, activarla y verificar su ruta con Status.
2. Usar un seguimiento ficticio vigente con resultados y revisiones resueltos
   (por ejemplo EP-23 en la copia); confirmar quien es su medico responsable.
3. Con ese medico, autorizar Solo pedir contacto o regreso al centro.
4. Con Recepcion, registrar intento sin respuesta y proximo intento futuro.
   Comprobar que el pendiente sigue visible aunque laboratorio este resuelto.
5. Registrar WhatsApp enviado/leido sin respuesta: no completa el contacto.
6. Registrar respuesta, identidad verificada y aviso transmitido: contacto y aviso
   confirmados; explicacion clinica aun pendiente.
7. Con medico responsable, registrar explicacion ficticia. El filtro habitual
   oculta el caso resuelto; incluir completados permite consultar el historial.
8. Rectificar un registro propio y comprobar que el original se conserva y el
   estado se recalcula. No pulsar acciones sobre otros pacientes del demo.
9. Comprobar formularios plegados, 12h, pausa al editar y borrador/version tras
   volver a entrar. Un cambio de seguimiento retira el aviso vigente de Recepcion.

No realizar llamadas ni enviar mensajes reales durante el ensayo.

## Exclusiones

Integracion con WhatsApp, mensajes automaticos, llamadas desde la app, acuses de
lectura como prueba de contacto, almacenamiento de conversaciones o adjuntos,
contacto real con pacientes y cambios al criterio de alta. No fija limites clinicos
ni intenta sustituir los procedimientos del centro.
