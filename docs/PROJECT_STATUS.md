# Estado del proyecto MedicControl+

## Última etapa

### Etapa 54: recuperación común de formularios tras HTTP 401

- Alcance transversal autorizado e implementado localmente: ingreso, triaje,
  signos, evaluación, órdenes, resultado LAB y nota de alta.
- Un almacén de borradores y un hook compartidos reemplazan el flujo exclusivo
  de alta; captura común de campos, sin reenvío ni guardado automático.
- Memoria únicamente, oculta durante el login. Treinta minutos desde el primer
  401 pendiente; nuevas interrupciones antes de restaurar no renuevan el plazo.
- Misma identidad y rol. Consulta episodio ACTIVE antes de ofrecer y confirmar;
  laboratorio exige tarea LAB/PENDING y presencia actual en la bandeja.
- Limpieza por éxito confirmado, descarte, logout, salida del contexto y vencimiento.
  Conserva varios formularios; guardar uno no sobrescribe los demás. Respuestas
  tardías no reviven borradores descartados ni atraviesan un cambio de sesión.
- Recarga, cierre de pestaña y reinicio siguen fuera del alcance. No almacena
  campos clínicos en localStorage/sessionStorage ni en el servidor.
- Validación: 259 pruebas frontend (29 nuevas), lint y build aprobados. Pruebas
  con `--maxWorkers=1` y temporales locales. Backend sin cambios: se conserva la
  evidencia de 132 pruebas y CI aprobada de 53B, sin repetir esa validación.
- Commit/push autorizados por el usuario; publicación y CI pendientes.

### Cierre de la Etapa 53

- 53A y 53B publicadas: protección común en el frontend y transacciones/
  idempotencia compartidas en el servidor para las escrituras operacionales.
- Criterios verificados: bloqueo inmediato por recurso, operaciones independientes,
  concurrencia entre conexiones, reintento con la misma clave sin repetir efectos,
  rollback, permisos/sesiones actuales y evaluaciones nuevas intencionales.
- Evidencia vigente: 132 pruebas backend, 230 frontend, lint y build aprobados;
  CI de 53A `38183333079` y de 53B `38184736932` aprobadas.
- Prueba funcional directa de evaluaciones realizada por el usuario y confirmada
  satisfactoria. Confirmación manual; no constituye una nueva prueba automatizada.
- Etapa 53 cerrada dentro del alcance acordado. Límites: recuperar una intención
  ambigua después de recargar/cambiar de sesión y archivar recibos conservando
  la reserva de claves requieren un diseño posterior. Las intenciones distintas
  entre dispositivos no se deduplican por contenido clínico.
- Cierre documental publicado en `94bc0800611cb54cec05f873a06a97d24217a987`;
  CI `38185005967` aprobada. Conserva las validaciones previas.
  Siguiente propuesta: Etapa 54, recuperación común de borradores tras HTTP 401.

### Entrega 53B: escrituras atómicas e idempotencia compartida

- Alcance transversal autorizado, implementado y publicado.
- Validación: 132 pruebas backend (26 nuevas, una advertencia existente),
  230 frontend (ocho nuevas), lint y build aprobados.
  Backend con Python de `.venv` y `--basetemp .tmp/pytest-53b-full`; ejecutado
  fuera del aislamiento que bloquea el socket interno de TestClient en Windows.
  Frontend con `--maxWorkers=1` y temporales locales, como en 53A.
- `atomic_write` reserva la escritura SQLite antes de comprobar estados y confirma
  juntos cambios, eventos y recibo. Aplica a ingreso, evaluaciones, órdenes, signos,
  triaje, tareas, alertas, alta, demo, reglas y escaneo (que registra un evento).
- `Idempotency-Key` distingue intenciones por identidad, rol, ruta y huella del
  payload. Misma clave no repite efectos; otra clave permite otra evaluación.
  Comprueba sesión/permisos actuales, conflictos y vigencia de 24 horas.
- Recibos con referencias al episodio; no guarda copias de notas clínicas.
  Las claves vencidas siguen reservadas. Detalle clínico reconstruido al reintentar.
- El cliente HTTP reutiliza la clave ante red/5xx, sin reenvío automático; un éxito
  consume la intención. Metadatos/payload permanecen solo en memoria de la sesión,
  con límite de 256 intenciones ambiguas. Recargar o cambiar de sesión pierde esa
  asociación y exige revisar un resultado incierto antes de una nueva intención.
- Pruebas incluyen concurrencia entre conexiones, respuesta perdida, rollback,
  bloqueo SQL, claves distintas/conflictivas/vencidas, permisos y sesiones.
- Migración aditiva documentada en `backend/migrations/003_write_receipts.sql`;
  datos clínicos existentes preservados. Política completa: [escrituras](WRITE_OPERATIONS.md).
- Publicada en `3037eb4a35475138f0a4c1925db33409f7f04f6e`;
  CI `38184736932` aprobada: backend, frontend, lint y build.

### Entrega 53A: protección común de envíos pendientes

- Alcance transversal autorizado: mecanismo único `usePendingOperations`,
  compartido por App y EpisodePage, para acceso, salida, ingreso, laboratorio,
  demo, reglas, alta, evaluaciones, órdenes, signos, triaje, tareas y alertas.
- Adquiere el bloqueo antes del siguiente render; identifica la operación y
  el recurso, y permite operaciones independientes. Laboratorio y episodio
  comparten el bloqueo de una misma tarea incluso al cambiar de pantalla.
- Sustituye los bloqueos anteriores; conserva permisos, estados, mensajes,
  campos ante errores y tratamiento de HTTP 401. Libera al finalizar o cancelar
  y exige una nueva acción explícita para reintentar; no reenvía automáticamente.
- Protege solicitudes simultáneas desde esta instancia del frontend. La
  idempotencia del servidor entre pestañas, dispositivos o reintentos tras una
  respuesta perdida queda fuera del alcance y requiere una decisión específica.
- Validación: 222 pruebas frontend (24 nuevas), lint y build aprobados.
  Ejecución local con `npm.cmd run test --prefix frontend -- --maxWorkers=1`;
  `TEMP` y `TMP` apuntaron a `.tmp\vitest` para evitar temporales ausentes
  del entorno aislado. La ejecución paralela tuvo cinco tiempos de espera;
  la suite completa con un trabajador pasa sin ampliar los tiempos.
- Publicada en `c5c32e28e93965db28fcdb3cb36f6a715e984f24`;
  CI `38183333079` aprobada: backend, frontend, lint y build.
  Backend, contratos de API y base local sin cambios.

### Cierre de la Etapa 52

- Alcance acordado entregado en 52A: errores accesibles junto a la alerta
  cuya acción falló, con limpieza al reintentar una acción sobre esa alerta.
- Criterios contrastados con ocho casos nuevos y pruebas ampliadas: Reconocer,
  Escalar y Resolver ante errores de API/red, reintento, fallos simultáneos
  independientes y conservación del error de otra alerta tras resolver una.
- Se conservan estados ante fallos, permisos, transiciones y bloqueo de 49A.
  HTTP 401 durante un reintento no revive el error anterior ni genera uno ordinario.
- Evidencia: 198 pruebas frontend, lint y build aprobados; CI de implementación
  `38181398952` y documental `38181529431` aprobadas.
- Etapa 52 cerrada dentro del alcance. Cierre documental; aplicación, reglas
  clínicas, contratos de API y base local sin cambios adicionales.
  Validaciones aprobadas conservadas.

### Entrega 52A: errores junto a la alerta

- Entrega publicada en `e21c40752dbf7d6b6e4ae16c7ec07bc17368ce69`;
  CI `38181398952` aprobada.
- Los errores de Reconocer, Escalar y Resolver aparecen junto a la alerta
  correspondiente mediante un mensaje accesible de alerta.
- Reintentar una acción sobre esa alerta limpia únicamente su error.
  Los errores y bloqueos de las demás permanecen independientes.
- Conserva estados ante fallos, permisos, transiciones y bloqueo de 49A.
  HTTP 401 mantiene el manejo de sesión sin error ordinario.
- Ocho casos nuevos y pruebas ampliadas cubren las tres acciones ante errores
  de API/red, reintento, fallos simultáneos, independencia y HTTP 401.
- Validación: 198 pruebas frontend, lint y build aprobados.
- Backend, reglas clínicas, contratos de API y base local sin cambios.

### Cierre de la Etapa 51

- Alcance acordado entregado en 51A: errores accesibles junto a la tarea
  que falló al completarse, con limpieza únicamente al reintentar esa tarea.
- Criterios contrastados con cuatro casos nuevos y pruebas ampliadas: errores
  de API/red, fallos simultáneos independientes, reintento y conservación del
  error de otra tarea tras completar una con éxito.
- Se conserva la tarea pendiente ante fallos y el bloqueo de 50A.
  HTTP 401 durante un reintento no revive el error anterior ni genera uno ordinario.
- Evidencia: 190 pruebas frontend, lint y build aprobados; CI de implementación
  `38180567100` y documental `38180677073` aprobadas.
- Etapa 51 cerrada dentro del alcance. Cierre documental; aplicación, permisos,
  reglas clínicas, contratos de API y base local sin cambios adicionales.
  Validaciones aprobadas conservadas.

### Entrega 51A: errores junto a la tarea

- Entrega publicada en `a94a93ac3ffdb8a130eb03140609faf254474075`;
  CI `38180567100` aprobada.
- Los errores al completar tareas aparecen junto a la tarea correspondiente
  mediante un mensaje accesible de alerta, en lugar del error global.
- Reintentar limpia únicamente su error. Los errores y bloqueos de las demás
  tareas permanecen independientes, incluso ante fallos simultáneos.
- Conserva la tarea pendiente ante fallos y el bloqueo de 50A.
  HTTP 401 mantiene el manejo de sesión sin error ordinario.
- Cuatro casos nuevos y pruebas ampliadas cubren errores de API/red,
  reintento, independencia, éxito de otra tarea y HTTP 401 tras un fallo previo.
- Validación: 190 pruebas frontend, lint y build aprobados.
- Backend, permisos, reglas clínicas, contratos de API y base local sin cambios.

### Cierre de la Etapa 50

- Alcance acordado entregado en 50A: bloqueo del botón Completar por
  identificador de tarea mientras espera respuesta, con «Completando…».
- Criterios contrastados con nueve casos nuevos: una solicitud por tarea,
  desbloqueo tras éxito, error de API/red o HTTP 401, reintento explícito,
  solicitudes independientes y retirada de la tarea completada de pendientes.
- Se conserva el manejo actual de permisos, errores y estados;
  los episodios CLOSED mantienen las tareas de solo lectura.
- Evidencia: 186 pruebas frontend, lint y build aprobados; CI de implementación
  `38179803505` y documental `38179908014` aprobadas.
- Etapa 50 cerrada dentro del alcance. El bloqueo cubre solicitudes en curso
  en esta vista; no incorpora coordinación entre usuarios o navegadores.
- Cierre documental; aplicación, reglas clínicas, contratos de API y base local
  sin cambios adicionales. Validaciones aprobadas conservadas.

### Entrega 50A: bloqueo al completar tareas

- Entrega publicada en `37fcba446544aee5b842d5439fc2b7fa03baa089`;
  CI `38179803505` aprobada.
- Completar bloquea el botón por identificador de tarea mientras espera
  respuesta y muestra «Completando…»; las demás tareas permanecen disponibles.
- Impide envíos repetidos de la misma tarea y libera el bloqueo tras éxito,
  error de API/red o interrupción de sesión HTTP 401.
- Conserva manejo de permisos y errores, estados y reintento explícito.
  Los episodios CLOSED mantienen las tareas de solo lectura.
- Nueve casos nuevos cubren roles admitidos por API, payload, errores,
  sesión, solicitudes independientes y retirada de la tarea completada.
- Validación: 186 pruebas frontend, lint y build aprobados.
- Backend, reglas clínicas, contratos de API y base local sin cambios.

### Cierre de la Etapa 49

- Alcance acordado entregado en 49A: bloqueo de Reconocer, Escalar y Resolver
  por identificador de alerta mientras espera respuesta.
- Criterios contrastados con ocho casos nuevos: una solicitud por alerta,
  «Actualizando alerta…», desbloqueo tras éxito, error de API/red o HTTP 401,
  reintento explícito y solicitudes independientes sobre distintas alertas.
- Se conservan permisos y transiciones; la respuesta exitosa actualiza el
  episodio y permite presentar las acciones del nuevo estado.
- Evidencia: 177 pruebas frontend, lint y build aprobados; CI de implementación
  `38178969360` y documental `38179130975` aprobadas.
- Etapa 49 cerrada dentro del alcance. El bloqueo cubre solicitudes en curso
  en esta vista; no incorpora coordinación entre usuarios o navegadores.
- Cierre documental; aplicación, reglas clínicas, contratos de API y base local
  sin cambios adicionales. Validaciones aprobadas conservadas.

### Entrega 49A: bloqueo de acciones por alerta

- Entrega publicada en `2e2a21fdc9c56879db19bcbd6fe174b9aaa7a631`;
  CI `38178969360` aprobada.
- Reconocer, Escalar y Resolver comparten un bloqueo por identificador de alerta
  mientras esperan respuesta; muestra «Actualizando alerta…».
- Impide envíos repetidos o acciones simultáneas sobre esa alerta y mantiene
  disponibles las demás. Libera el bloqueo tras éxito, error de API/red o HTTP 401.
- Conserva permisos, transiciones, estado ante fallos y reintento explícito.
- Ocho casos nuevos cubren las tres acciones, payload, errores, sesión,
  solicitudes independientes y presentación de la transición exitosa.
- Validación: 177 pruebas frontend, lint y build aprobados.
- Backend, reglas clínicas, contratos de API y base local sin cambios.

### Cierre de la Etapa 48

- Alcance acordado entregado en 48A: confirmación accesible de triaje y
  asignación guardados solo tras éxito, y errores de API/red junto al formulario.
- Criterios contrastados con siete casos nuevos y pruebas ampliadas: espera
  sin confirmación, limpieza al editar o reenviar, ausencia de éxito ante fallos
  y mensajes independientes del registro de signos vitales.
- Se conservan valores, bloqueo de solicitudes y permisos de 47A.
  HTTP 401 mantiene el manejo de sesión sin éxito ni error ordinario.
- Evidencia: 169 pruebas frontend, lint y build aprobados; CI de implementación
  `38178157097` y documental `38178269547` aprobadas.
- Etapa 48 cerrada dentro del alcance. Cierre documental; aplicación, reglas
  clínicas, contratos de API y base local sin cambios adicionales.
  Validaciones aprobadas conservadas.

### Entrega 48A: mensajes de resultado en triaje y asignación

- Entrega publicada en `d5f3b06161138f71e8f5b9ed64d5232b6e30fcf3`;
  CI `38178157097` aprobada.
- Triaje muestra «Triaje y asignación guardados» mediante un estado accesible
  solo tras éxito; los errores de API/red aparecen junto al formulario.
- Editar o reenviar retira sus mensajes, independientes de signos vitales.
  HTTP 401 conserva el manejo de sesión sin éxito ni error ordinario.
- Conserva valores, bloqueo de solicitudes y permisos de 47A.
- Siete casos nuevos y pruebas ampliadas cubren espera, éxito, edición,
  reintento, errores de API/red, HTTP 401 e independencia.
- Validación: 169 pruebas frontend, lint y build aprobados.
- Backend, reglas clínicas, contratos de API y base local sin cambios.

### Cierre de la Etapa 47

- Alcance acordado entregado en 47A: bloqueo de prioridad, ubicación,
  responsable y envíos repetidos de triaje mientras espera respuesta.
- Criterios contrastados con diez casos nuevos: captura de los tres valores
  antes del bloqueo, «Guardando triaje…», desbloqueo tras éxito, error de
  API/red o HTTP 401, conservación de valores y reintento explícito.
- Se mantienen roles NURSE/SUPERVISOR, restricción de episodios CLOSED
  y bloqueo independiente del formulario de signos vitales.
- Evidencia: 162 pruebas frontend, lint y build aprobados; CI de implementación
  `38177407788` y documental `38177523136` aprobadas.
- Etapa 47 cerrada dentro del alcance. Un nuevo envío intencional tras
  terminar el anterior sigue permitido; el bloqueo cubre solicitudes en curso.
- Cierre documental; aplicación, reglas clínicas, contratos de API y base local
  sin cambios adicionales. Validaciones aprobadas conservadas.

### Entrega 47A: bloqueo de envío de triaje y asignación

- Entrega publicada en `da05f9878154018c76997594325d28e80623fff6`;
  CI `38177407788` aprobada.
- Triaje y asignación bloquea prioridad, ubicación, responsable y envíos
  repetidos mientras espera respuesta; muestra «Guardando triaje…».
- Captura los tres valores antes del bloqueo y habilita los campos tras éxito,
  error de API/red o interrupción de sesión HTTP 401.
- Conserva valores y permite un nuevo envío explícito. Mantiene roles
  NURSE/SUPERVISOR y la restricción de episodios CLOSED.
- Diez casos nuevos cubren duplicados, payload, desbloqueo, reintento,
  permisos y bloqueo independiente del formulario de signos vitales.
- Validación: 162 pruebas frontend, lint y build aprobados.
- Backend, reglas clínicas, contratos de API y base local sin cambios.

### Cierre de la Etapa 46

- Alcance acordado entregado en 46A: confirmación accesible de signos vitales
  guardados solo tras éxito y errores de API/red junto al formulario.
- Criterios contrastados con siete casos nuevos y pruebas ampliadas: espera
  sin confirmación, limpieza al editar o reenviar, ausencia de éxito ante fallos
  y mensajes independientes de los formularios médicos.
- Se conservan valores, bloqueo de solicitudes y permisos de 45A.
  HTTP 401 mantiene el manejo de sesión sin éxito ni error ordinario.
- Evidencia: 152 pruebas frontend, lint y build aprobados; CI de implementación
  `38175744173` y documental `38175895543` aprobadas.
- Los dos fallos iniciales del supervisor no se reprodujeron en la revisión
  dirigida ni en la repetición completa; antecedente conservado en 46A.
- Etapa 46 cerrada dentro del alcance. Cierre documental; aplicación, reglas
  clínicas, contratos de API y base local sin cambios adicionales.
  Validaciones aprobadas conservadas.

### Entrega 46A: mensajes de resultado en signos vitales

- Entrega publicada en `8772a8aadbf44106e3866b8596e62898f0543be4`;
  CI `38175744173` aprobada.
- Signos vitales muestra «Signos vitales guardados» mediante un estado accesible
  solo tras una respuesta exitosa; los errores de API/red aparecen en el formulario.
- Editar o reenviar retira los mensajes de signos, independientes de los
  formularios médicos. HTTP 401 no muestra éxito ni un error ordinario.
- Conserva valores, bloqueo de solicitudes en curso y permisos de 45A.
- Siete casos nuevos y pruebas ampliadas cubren espera, éxito, edición,
  reintento, errores de API/red, HTTP 401 e independencia.
- Validación: 152 pruebas frontend, lint y build aprobados.
- La primera ejecución tuvo dos fallos en pruebas del supervisor durante la
  carga/sesión; la revisión dirigida (21 pruebas) y la repetición completa
  aprobaron sin cambios adicionales de código.
- Backend, reglas clínicas, contratos de API y base local sin cambios.

### Cierre de la Etapa 45

- Alcance acordado entregado en 45A: bloqueo de campos y envíos repetidos
  de signos vitales mientras espera respuesta, con «Guardando signos…».
- Criterios contrastados con ocho casos nuevos: captura de los seis valores
  antes del bloqueo, desbloqueo tras éxito, error de API/red o HTTP 401,
  conservación de valores y nuevo envío explícito.
- Se mantienen los roles DOCTOR/NURSE, la restricción de episodios CLOSED
  y el bloqueo independiente de los formularios médicos.
- Evidencia: 145 pruebas frontend, lint y build aprobados; CI de implementación
  `38164479323` y documental `38164600153` aprobadas.
- Etapa 45 cerrada dentro del alcance. Un nuevo registro intencional tras
  terminar el anterior sigue permitido; el bloqueo cubre solicitudes en curso.
- Cierre documental; aplicación, reglas clínicas y base local sin cambios
  adicionales. Validaciones aprobadas conservadas.

### Entrega 45A: bloqueo de envío de signos vitales

- Entrega publicada en `b1df24ea00204164c9cb0b6adbcaaa418216a425`;
  CI `38164479323` aprobada.
- El registro de signos vitales bloquea campos, botón y envíos repetidos
  mientras espera respuesta; muestra «Guardando signos…».
- Captura los seis valores antes de deshabilitar los campos y libera el bloqueo
  tras éxito, error de API/red o interrupción de sesión HTTP 401.
- Conserva los valores y permite un nuevo envío explícito. Mantiene los roles
  DOCTOR/NURSE y la restricción de episodios CLOSED.
- Ocho casos nuevos cubren duplicados, payload, desbloqueo, reintento,
  permisos y bloqueo independiente de los formularios médicos.
- Validación: 145 pruebas frontend, lint y build aprobados.
- Backend, reglas clínicas, contratos de API y base local sin cambios.

### Cierre de la Etapa 44

- Alcance acordado entregado en 44A: errores accesibles junto al formulario
  de evaluación u orden que falló.
- Criterios contrastados con cinco casos nuevos y pruebas ampliadas: editar o
  reintentar retira el error correspondiente; ambos formularios conservan
  mensajes independientes y datos ante errores de API o red.
- Se conservan confirmaciones de éxito, bloqueos de envío y avisos de salida.
  HTTP 401 mantiene el manejo de interrupción de sesión.
- Evidencia: 137 pruebas frontend, lint y build aprobados; CI de implementación
  `38160358496` y documental `38160482207` aprobadas.
- Etapa 44 cerrada dentro del alcance. Sin cambios en permisos, persistencia,
  recuperación de borradores ni contratos de la API.
- Cierre documental; aplicación y base local sin cambios adicionales.
  Validaciones aprobadas conservadas.

### Entrega 44A: errores junto al formulario

- Entrega publicada en `4e0ecc322e891da9a7b8eb94c3ff67dd0a9f19ac`;
  CI `38160358496` aprobada.
- Los errores de API o red aparecen junto al formulario de evaluación u orden
  que falló, mediante un mensaje accesible de alerta.
- Editar o reintentar limpia el error correspondiente. Los errores y las
  confirmaciones de ambos formularios permanecen independientes.
- Se conservan datos ante fallos, bloqueos de envío y avisos de salida.
  HTTP 401 mantiene el manejo de interrupción de sesión sin error ordinario.
- Cinco casos nuevos y pruebas ampliadas: 137 pruebas frontend, lint y build aprobados.
- Backend, contratos de API y base local sin cambios.

### Cierre de la Etapa 43

- Alcance acordado entregado en 43A: confirmaciones accesibles de evaluación
  guardada y orden creada, únicamente tras una respuesta exitosa.
- Criterios contrastados con siete casos nuevos y pruebas ampliadas: nueva
  edición o envío retira el mensaje correspondiente; errores de API/red y
  HTTP 401 no muestran éxito. Las confirmaciones son independientes.
- Se conservan bloqueos de envío, datos ante errores y avisos de salida de 39A–42A.
- Evidencia: 132 pruebas frontend, lint y build aprobados; CI de implementación
  `38158257237` y documental `38158414456` aprobadas.
- Etapa 43 cerrada dentro del alcance. Las confirmaciones no cambian permisos,
  persistencia, recuperación de borradores ni contratos de la API.
- Cierre documental; aplicación y base local sin cambios adicionales.
  Validaciones aprobadas conservadas.

### Entrega 43A: confirmaciones de guardado médico

- Entrega publicada en `e908b785a63ca798c545981d9124fee713cccd50`;
  CI `38158257237` aprobada.
- Evaluación médica muestra «Evaluación guardada» y orden muestra «Orden creada»
  solo después de una respuesta exitosa, mediante un mensaje accesible de estado.
- Nueva edición o envío retira la confirmación del formulario correspondiente.
  Los mensajes son independientes y no confirman resultados pendientes o fallidos.
- Se conservan bloqueos de envío, datos tras errores y avisos de salida de 39A–42A.
  HTTP 401 no produce confirmación de éxito.
- Siete casos nuevos y ampliaciones de pruebas existentes cubren éxito, nueva
  edición/envío, errores de API/red, independencia y ausencia de éxito ante HTTP 401.
- Validación: 132 pruebas frontend, lint y build aprobados. Backend, API y base local sin cambios.

### Cierre de la Etapa 42

- Alcance acordado entregado en 42A: aviso ante cambios sin enviar en el
  procedimiento y servicio de una orden, al navegar, cerrar sesión o recargar.
- Criterios contrastados con catorce casos nuevos: cancelar conserva campos y
  sesión, descartar permite salir sin crear la orden, éxito retira su indicador
  y errores conservan la protección. Restaurar valores iniciales elimina el aviso.
- Los indicadores de orden, evaluación y nota de alta son independientes;
  guardar un formulario no retira la protección de otro pendiente.
- Evidencia: 125 pruebas frontend, lint y build aprobados; CI de implementación
  `38154061106` y documental `38154208473` aprobadas.
- Etapa 42 cerrada dentro del alcance. HTTP 401 conserva 37A sin recuperar ni
  reenviar órdenes; persistencia y recuperación adicional requieren otro alcance.
- Cierre documental; aplicación y base local sin cambios adicionales.
  Validaciones aprobadas conservadas.

### Entrega 42A: aviso de orden clínica sin enviar

- Entrega publicada en `54e7da4cd5681398994c1ab19d1dc730ccb9119b`;
  CI `38154061106` aprobada.
- Procedimiento solicitado y servicio responsable se comparan con sus valores
  iniciales. Cambios requieren confirmar navegación o logout mediante
  «Seguir editando» o «Descartar y salir»; cancelar conserva campos y sesión.
- Recarga y cierre de pestaña solicitan el aviso estándar del navegador.
  Restaurar valores iniciales o crear con éxito retira solo el indicador de orden.
- Errores conservan campos y protección. Los indicadores de evaluación y nota
  de alta siguen siendo independientes y no se borran al crear una orden.
- Solo indicadores en el guard; sin persistencia de texto ni cambios en API,
  backend o base local. HTTP 401 no recupera ni reenvía la orden y conserva 37A.
- Catorce casos nuevos cubren cambios, cancelación, descarte, éxito, errores,
  aviso de recarga, independencia de las tres protecciones y HTTP 401.
- Validación: 125 pruebas frontend, lint y build aprobados.
- Primera corrida local con dos workers: 124 aprobadas y timeout de 5 segundos
  en el primer caso existente de recuperación. Suite completa aprobada al repetir
  con `npm.cmd run test --prefix frontend -- --maxWorkers=1`, sin cambiar pruebas.
  CI mantiene su comando habitual.

### Cierre de la Etapa 41

- Alcance acordado entregado en 41A: aviso por cambios sin guardar en diagnóstico,
  nota de evaluación y decisión médica, al navegar, cerrar sesión o recargar.
- Criterios contrastados con doce casos nuevos: cancelar conserva los campos,
  descartar permite salir, éxito retira el aviso y errores conservan la protección.
  Volver a los valores iniciales elimina el indicador de evaluación.
- La protección de la nota de alta es independiente; guardar la evaluación no
  elimina su aviso. HTTP 401 mantiene 37A sin recuperar ni reenviar la evaluación.
- Evidencia: 111 pruebas frontend, lint y build aprobados; CI de implementación
  `38152974236` y documental `38153115671` aprobadas.
- Etapa 41 cerrada dentro del alcance. Recuperación de evaluación tras HTTP 401,
  persistencia y protección de órdenes sin enviar requieren un alcance propio.
- Cierre documental; aplicación y base local sin cambios adicionales.
  No se repiten las validaciones aprobadas.

### Entrega 41A: aviso de evaluación médica sin guardar

- Entrega publicada en `3c9220146b989e8ff4648b61cd7d300353eb01c9`;
  CI `38152974236` aprobada.
- Diagnóstico, nota de evaluación y decisión médica se comparan con los valores
  iniciales. Sus cambios requieren confirmar navegación o logout con
  «Seguir editando» o «Descartar y salir», sin ejecutar la salida al cancelar.
- Recarga y cierre de pestaña solicitan el aviso estándar del navegador.
  Volver a los valores iniciales o guardar con éxito retira el aviso de evaluación.
- Un error mantiene campos y protección. La nota de alta conserva un indicador
  independiente: guardar evaluación no elimina su aviso si sigue pendiente.
- Solo indicadores en el guard; texto en el formulario, sin persistencia clínica.
  HTTP 401 conserva 37A y no recupera la evaluación ni repite su envío.
- Doce casos nuevos cubren los tres campos, cancelación, descarte, éxito,
  errores de API/red, aviso de recarga, coexistencia con nota de alta y HTTP 401.
- Validación: 111 pruebas frontend, lint y build aprobados. Backend y base local sin cambios.

### Cierre de la Etapa 40

- Alcance 40A revisado: bloqueo independiente de evaluación y orden durante
  el envío, campos deshabilitados, indicador visible y rechazo de submits repetidos.
- Éxito, errores y HTTP 401 liberan los bloqueos según las pruebas; los errores
  conservan los campos y admiten reintento explícito conforme a 39A.
- Evidencia: 99 pruebas frontend, lint y build aprobados; CI de implementación
  `38151760565` y documental `38151913835` aprobadas.
- Prueba manual: el usuario creó dos evaluaciones, enviando la segunda tras
  finalizar la primera. Es un comportamiento válido; no es un envío concurrente.
  El bloqueo durante una petición pendiente se verifica mediante pruebas automatizadas.
- Etapa 40 cerrada dentro de su alcance. Envíos sucesivos intencionales siguen
  permitidos; la idempotencia entre pestañas o en backend requiere otro alcance.
- Cierre documental; sin cambios adicionales en la aplicación ni en los datos
  de demostración. Validaciones aprobadas conservadas.

### Entrega 40A: bloqueo de envíos médicos en curso

- Entrega publicada en `13c160c35dc5c4992ae0803fa4cc25acf405bf71`;
  CI `38151760565` aprobada.
- Evaluación médica y orden clínica tienen bloqueos independientes durante
  su petición: campos y botón deshabilitados, con «Guardando…» o «Creando orden…».
- Guards inmediatos impiden clics y submits repetidos en cada formulario.
  Se capturan los datos antes de deshabilitar sus campos.
- Al terminar se libera el bloqueo. Errores conservan los datos y permiten
  reintento explícito; éxito conserva el reinicio de formulario de 39A.
- Cinco casos nuevos verifican repeticiones, desbloqueo tras éxito o HTTP 401
  e independencia entre formularios; las pruebas 39A comprueban reintentos tras error.
- Protección limitada a esta instancia de la pantalla; no aporta idempotencia
  entre pestañas ni cambios en backend, API, esquema o base local.
- Validación: 99 pruebas frontend, lint y build aprobados.

### Cierre de la Etapa 39

- Alcance acordado entregado en 39A: conservar evaluación médica y orden
  clínica cuando falla su envío y vaciarlas solo tras una respuesta exitosa.
- Criterios contrastados con seis casos nuevos: error de API, fallo de red,
  campos conservados durante la espera y reintento explícito con los mismos datos.
- Evidencia: 94 pruebas frontend, lint y build aprobados; CI de implementación
  `38105192156` y documental `38105293438` aprobadas.
- Etapa 39 cerrada dentro del alcance acordado. Persistencia, recuperación de
  otros borradores y protección contra envíos duplicados no forman parte de 39A.
- Cierre documental; aplicación y base local sin cambios adicionales.
  Se conservan las validaciones aprobadas.

### Entrega 39A: conservar formularios ante envíos fallidos

- Entrega publicada en `e5840ad8404257d6e475c168155a7d73a3a57937`;
  CI `38105192156` aprobada.
- El helper de envío devuelve fallo tras errores de API o de red, en lugar de
  permitir que evaluación médica y orden clínica se reinicien sin guardarse.
- Ambos formularios conservan sus campos y muestran el error. Solo se vacían
  tras una respuesta exitosa; el reintento requiere una acción explícita.
- Seis casos nuevos cubren errores de API, fallos de red, reintento con los
  mismos datos y conservación durante una respuesta pendiente para ambos formularios.
- Interrupción por HTTP 401 conserva su tratamiento de 37A. No se añade
  persistencia, recuperación de otros borradores ni cambios en API o backend.
- Validación: 94 pruebas frontend, lint y build aprobados. Base local sin cambios.

### Cierre de la Etapa 38

- Alcance acordado entregado en 38A: aviso ante navegación o logout con nota
  de alta no vacía y solicitud de aviso estándar ante recarga o cierre de pestaña.
- Criterios revisados: cancelar conserva nota y sesión, descartar permite salir,
  alta exitosa elimina el aviso y restauración tras 401 reactiva la protección.
- Evidencia: diez casos nuevos, 88 pruebas frontend, lint y build aprobados;
  prueba manual satisfactoria confirmada por el usuario.
- CI de implementación `38099843479` y documental `38100001704` aprobadas.
- Etapa 38 cerrada dentro del alcance acordado. El aviso del navegador no
  garantiza recuperación tras salir; otros formularios siguen fuera de alcance.
- Cierre documental; sin cambios en aplicación ni base local y sin repetir
  validaciones aprobadas.

### Entrega 38A: aviso de nota de alta sin enviar

- Entrega publicada en `8fdedd90f55469af841c7601874930004822f075`;
  CI `38099843479` aprobada.
- Una nota no vacía en el formulario de alta requiere confirmar las salidas
  por navegación o logout: «Seguir editando» conserva texto y sesión;
  «Descartar y salir» ejecuta la salida elegida sin enviar el alta.
- Recarga y cierre de pestaña solicitan el aviso estándar mediante beforeunload.
  Su presentación depende del navegador; no garantiza recuperación tras salir.
- El guard de salida solo conserva un indicador y la acción pendiente en memoria.
  No persiste texto clínico ni modifica API, backend, esquema o base local.
- Alta exitosa y descarte retiran el aviso. Un HTTP 401 cancela la salida
  pendiente y mantiene la recuperación 37A; restaurar reactiva la protección.
  El borrador suspendido durante reautenticación conserva el alcance de 37A.
- Diez casos nuevos cubren cancelación, descarte, logout, aviso de recarga,
  limpieza del listener, alta exitosa y nota restaurada.
- Validación: 88 pruebas frontend, lint y build aprobados.
- Prueba manual realizada por el usuario y confirmada satisfactoria antes
  de publicar: conservación al cancelar, descarte y aviso de recarga.

### Cierre de la Etapa 37

- Mejora elegida: recuperación de nota de alta tras HTTP 401, entregada en 37A.
- Criterios del diseño 36A contrastados con la implementación y sus 32 casos
  nuevos: identidad, rol, episodio ACTIVE, plazo, eliminación, restauración
  explícita y ausencia de reenvío automático o persistencia del texto.
- Evidencia conservada: 78 pruebas frontend, lint y build aprobados; CI de
  implementación `38055045590` y documental `38055175333` aprobadas.
- Etapa 37 cerrada dentro del alcance acordado. Recuperación tras navegación,
  recarga o reinicio y otros formularios requieren una mejora independiente.
- Revisión documental; no se repiten validaciones aprobadas ni se modifica la
  aplicación, el backend o la base local.

### Entrega 37A: recuperación de nota de alta

- Entrega cerrada y publicada en
  `323094dc53d0d5f398b025ae5bbefbf0d291787c`; CI `38055045590` aprobada.
- Mejora elegida y autorizada para la Etapa 37: recuperación de nota de alta
  tras HTTP 401 según el diseño de 36A.
- Login sin recarga; borrador solo en memoria durante 30 minutos desde el
  primer 401, con eliminación automática y sin renovar el plazo.
- Misma identidad y rol DOCTOR; episodio ACTIVE consultado antes de ofertar
  y al confirmar. Restauración explícita o descarte, sin reenviar el alta.
- Consulta fallida admite reintento dentro del plazo. Logout, otra identidad,
  rol distinto, CLOSED, inexistencia, vencimiento y navegación eliminan la nota.
- Respuestas de sesiones anteriores rechazadas; 401 concurrentes agrupados.
  No se exponen texto ni datos del episodio durante el login.
- Estado local separado en `frontend/src/session/`; cliente HTTP centralizado.
  Formularios médicos detienen su continuación al interrumpirse la sesión.
- 32 casos nuevos cubren recuperación, controles de identidad y vigencia,
  eliminación, respuestas tardías y ausencia de persistencia del texto.
- Validación: 78 pruebas frontend, lint y build aprobados. Pruebas locales con
  `npm.cmd run test --prefix frontend -- --maxWorkers=2`, fuera del sandbox
  por timeout de inicio de workers; dos workers evitan los timeouts locales
  observados en la ejecución paralela inicial. CI conserva su comando habitual.
- Backend, esquema y base local sin cambios; se conservan sus 106 pruebas
  aprobadas, sin repetirlas para este cambio frontend.
- Navegación, recarga, cierre de pestaña y otros formularios siguen fuera del
  alcance de recuperación. Diff revisado sin errores de whitespace.

### Etapa 36A: diseño de recuperación de nota de alta

- Diseño acordado y documentado en `docs/DRAFT_RECOVERY_DESIGN.md`.
- Alcance: recuperar solo nota de alta tras HTTP 401, en memoria durante
  un máximo de 30 minutos, sin persistencia del texto clínico.
- Restauración explícita para la misma identidad, rol DOCTOR y mismo episodio
  ACTIVE consultado nuevamente; sin reenvío automático del alta.
- Eliminación y casos de prueba definidos. Navegación, recarga y otros
  formularios fuera del primer alcance.
- Etapa 36 cerrada como evaluación de diseño. La recuperación continúa
  sin implementar y requiere autorización independiente. Se conserva la
  limitación actual de pérdida de borrador.
- Solo documentación; sin nuevas validaciones de aplicación ni cambios
  en frontend, backend o base local. Diff revisado sin errores de whitespace.

### Revisión de cierre de Etapa 35

- Criterios revisados: matriz de acciones por rol y estado documentada,
  rechazos relevantes cubiertos y ausencia de discrepancias en el alcance probado.
- 35A cubre tareas por rol y servicio; 35B refuerza conservación de siete tablas
  clínicas tras rechazos en CLOSED. Las consultas permitidas conservan lectura.
- Evidencia vigente: 106 pruebas backend aprobadas, una advertencia;
  CI de 35B `38016930642` y documental `38017077021` aprobadas.
- No se repiten validaciones ni se modifica aplicación, frontend o base local.
- Política actual conservada; nuevas restricciones requerirían otro alcance.
- Etapa 35 cerrada tras 35A–35B y revisión final. Las referencias anteriores
  a etapa abierta corresponden al estado histórico de cada entrega.

### Entrega 35B: rechazos en episodios cerrados

- Entrega cerrada y publicada en
  `e08f2a74bdbf7c47c02a04166354dd26126910b9`; CI `38016930642` aprobada.
- Cinco casos nuevos recorren todos los roles en episodios cerrados para triaje,
  signos, evaluación médica, alta repetida, acciones de alerta y escaneo.
- Tras cada rechazo se comparan siete tablas clínicas; se comprueban 401, 403,
  409 y 404 según sesión, rol y acción, y lectura de detalle CLOSED sin mutación.
- Matriz de permisos actualizada con la evidencia de 35B.
- Validación: 106 pruebas backend aprobadas, una advertencia; temporal
  `.tmp/pytest-35b-final`, fuera del sandbox por el bloqueo conocido de socketpair.
- Sin discrepancias en el alcance probado; política y código de aplicación
  conservados. Frontend y base local sin cambios. Diff sin errores de whitespace.
- Etapa 35 abierta: pendiente de revisión final de cierre.

### Entrega 35A: matriz de permisos y tareas

- Entrega cerrada y publicada en
  `919e5f85001cc612b035a1fc9d04d805e5cf88f2`; CI `38016047782` aprobada.
- Matriz de acciones por rol y estado documentada en `docs/PERMISSIONS_MATRIX.md`.
- Cinco casos nuevos recorren los cinco roles y los tres servicios de tareas:
  creación, finalización, sesión ausente, repetición y rechazo tras alta.
- Rechazos comparan pacientes, episodios, tareas, eventos, alertas, historial
  de alertas y signos para comprobar ausencia de mutaciones.
- Política existente conservada: LAB puede completar NURSING y MEDICAL.
  No se propone cambiarla sin un alcance y autorización independientes.
- Validación: 101 pruebas backend aprobadas, una advertencia; cinco casos
  nuevos aprobados tras ajustar el cierre de conexiones del comparador.
  Temporales `.tmp/pytest-35a-final` y `.tmp/pytest-35a-targeted`;
  fuera del sandbox por el bloqueo conocido de socketpair.
- No se encontraron discrepancias en el alcance probado. No cambia código
  de aplicación, frontend ni base local. Diff revisado sin errores de whitespace.
- Etapa 35 abierta: resta revisar cobertura de rechazos y criterios de cierre.

### Entrega 34B: actualización de checkout y cierre

- Cerrada y publicada: PR #2 de Dependabot integrada en
  `39b735496bc7e7a1742b6344172d426993757ad4`.
- `actions/checkout` actualizado de v5 a v7; resto del workflow conservado.
- Diff de una línea revisado y documentación oficial contrastada: la protección
  nueva para pull_request_target y workflow_run no afecta a los eventos usados.
- PR actualizada con main: CI `38014890914` aprobada.
- CI posterior en main `38014992716` aprobada: backend, frontend, lint y build.
- Sin cambios en aplicación, esquema ni base local; no se repiten pruebas locales
  para este cambio exclusivo de GitHub Actions.
- Etapa 34 cerrada tras evaluar y publicar las PRs #1 y #2 por separado.
  No quedan PRs abiertas al comprobar el cierre. Las referencias anteriores
  a etapa abierta corresponden al estado histórico de cada entrega.

### Entrega 34A: actualización de setup-python

- Cerrada y publicada: PR #1 de Dependabot integrada en
  `92c68d7684e95ac7af583bcb6425bcc7dab5da99`.
- `actions/setup-python` actualizado de v6 a v7 en el workflow de CI.
  Python 3.12, caché pip, dependencias y comandos de validación conservados.
- Diff de una línea revisado; parámetros utilizados disponibles en v7.
- PR actualizada con main antes de integrar: CI `38013945187` aprobada.
- CI posterior en main `38014058972` aprobada: backend, frontend, lint y build.
- Sin cambios en aplicación, esquema ni base local; no se repiten pruebas locales
  para este cambio exclusivo de GitHub Actions.
- Etapa 34 abierta: PR #2 de checkout pendiente de evaluación y autorización propias.

### Entrega 33K: composición final y revisión de cierre

- Entrega cerrada y publicada en
  `c7ddff2736eb25257f855a14cf81749dccc09b9d`; CI `38013558171` aprobada.
- Composición de los diez routers reunida en `backend/app/main.py`;
  retirados comentarios desubicados y espacios entre bloques.
- AST completo y OpenAPI idénticos: código ejecutable, orden de registro,
  dependencias, métodos, respuestas y permisos conservados.
- Validación: 96 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33k-final` por el bloqueo conocido de socketpair.
- Sin comportamiento nuevo; no se requieren pruebas adicionales.
- Frontend y base local conservados. Diff revisado sin errores de whitespace.
- Revisión de cierre: rutas por área separadas, sin importaciones de main
  desde los routers. Servicios compartidos conservados en main, fuera del alcance.
- Etapa 33 cerrada tras 33A–33K: rutas separadas por área y composición
  revisada, con contratos y comportamiento conservados. Las referencias
  anteriores a etapa abierta describen el estado histórico de cada entrega.

### Entrega 33J: carga de datos demo

- Entrega cerrada y publicada en
  `f1ce279a9192de290ca48095532475d7ad624268`; CI `38012709436` aprobada.
- `POST /demo/seed` extraído a `backend/app/routes/demo.py`, mediante APIRouter.
- Conexión, fecha, eventos y permisos recibidos explícitamente; composición
  conservada en `main.py`. Acceso exclusivo de supervisor conservado.
- Cuerpo comparado con el original y OpenAPI completo idéntico.
- Seis casos nuevos verifican registro, método, cinco roles y conservación de
  pacientes, episodios, tareas, alertas y eventos ante una segunda carga.
- Se conserva la prueba de doce pacientes demo y protección de pacientes manuales.
- Validación: 96 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33j-final` por el bloqueo previo de socketpair.
- Diff revisado sin errores de whitespace. Frontend y base local conservados.
- La Etapa 33 continúa abierta; resta revisar composición y criterios de cierre.

### Entrega 33I: evaluación de reglas temporales

- Entrega cerrada y publicada en
  `e31529084eee07f7a819772621be0d65a18f659a`; CI `37876308581` aprobada.
- `POST /rules/evaluate` extraído a `backend/app/routes/rules.py`, mediante
  APIRouter; motor compartido `evaluate_time_rules` conservado en `main.py`.
- Conexión, fecha, motor y permisos recibidos explícitamente.
- Cuerpo comparado con el original y OpenAPI completo idéntico.
- Seis casos nuevos verifican registro único, método POST, cinco roles,
  evaluación vacía, identidad solicitante y fecha UTC.
- Se conservan pruebas existentes de generación temporal y ausencia de duplicados.
- Validación: 90 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33i-final` por el bloqueo previo de socketpair.
- Diff revisado sin errores de whitespace. Frontend y datos locales conservados.
- La Etapa 33 continúa abierta.

### Entrega 33H: registro de episodios

- Entrega cerrada y publicada en
  `be42aed69e4229a1962aaf49dda26deaecccedde`; CI `37874720158` aprobada.
- `POST /episodes` y `EpisodeCreate` extraídos a
  `backend/app/routes/episode_registration.py`, mediante APIRouter.
- Conexión, fecha, detalle, eventos y permisos recibidos explícitamente;
  composición en `main.py`. Creación de paciente, episodio activo y QR conservada.
- Cuerpo comparado con el original y OpenAPI completo idéntico.
- Siete casos nuevos verifican registro único, código 201, cinco roles, valores
  iniciales, persistencia y vínculo paciente/episodio, evento, QR distintos y
  prioridades inválidas sin registros. Se conserva el flujo clínico existente.
- Validación: 84 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33h-final` por el bloqueo previo de socketpair.
- Diff revisado sin errores de whitespace. Frontend sin cambios.
- La Etapa 33 continúa abierta.

### Entrega 33G: evaluación médica y alta

- Entrega cerrada y publicada en
  `ef92feff8054feab540cf9803776136eb19c0931`; CI `37873651116` aprobada.
- Rutas de evaluación médica y alta, junto a sus modelos, extraídas a
  `backend/app/routes/medical.py`, mediante APIRouter.
- Dependencias de conexión, fecha, detalle, eventos, episodio activo y permisos
  recibidas explícitamente; composición en `main.py`.
- Cuerpos comparados con el original y OpenAPI completo idéntico.
- Siete casos nuevos verifican registro, métodos, acceso exclusivo de médico,
  notas y eventos, cierre, rechazo posterior al cierre y validaciones de petición.
- Se conservan pruebas existentes de flujo clínico, historial y nota de alta.
- Validación: 77 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33g-final` por el bloqueo previo de socketpair.
- Diff revisado sin errores de whitespace. Frontend sin cambios.
- La Etapa 33 continúa abierta.

### Entrega 33F: triaje y signos vitales

- Entrega cerrada y publicada en
  `3ad17074b1d8cfeb3021c7293f88609ea6fd4dc7`; CI `37872644967` aprobada.
- Rutas de triaje y signos vitales, junto a sus modelos, extraídas a
  `backend/app/routes/nursing.py`, mediante APIRouter.
- Dependencias de conexión, fecha, detalle, eventos, episodio activo y permisos
  recibidas explícitamente; composición en `main.py`.
- Cuerpos comparados con el original y OpenAPI completo idéntico.
- Siete casos nuevos verifican registro, métodos, código 201, permisos distintos
  para los cinco roles, umbrales de alertas y ausencia de duplicados.
- Se conservan pruebas existentes de rangos inválidos y episodios cerrados.
- Validación: 70 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33f-final` por el bloqueo previo de socketpair.
- Diff revisado sin errores de whitespace. Frontend sin cambios.
- La Etapa 33 continúa abierta.

### Entrega 33E: actualización de alertas

- Entrega cerrada y publicada en
  `6af0bacfbc94a4f8e4c37e5a40416b719ad29f7c`; CI `37868893764` aprobada.
- `PATCH /alerts/{alert_id}`, modelo y matriz de transiciones en
  `backend/app/routes/alerts.py`; matriz importada en `main.py` por compatibilidad.
- Router recibe conexión, fecha, detalle, eventos, protección de episodio activo
  y permisos; composición conservada en `main.py`.
- Lógica comparada con el original y OpenAPI completo idéntico.
- Siete casos nuevos cubren registro único, compatibilidad de matriz, cinco roles,
  historial y eventos, y rechazo en episodio cerrado sin mutación.
  Se conservan pruebas existentes de transiciones y flujo clínico.
- Validación: 63 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33e-final` por el bloqueo previo de socketpair.
- Diff revisado sin errores de whitespace. Frontend sin cambios.
- La Etapa 33 continúa abierta.

### Entrega 33D: tareas y laboratorio

- Entrega cerrada y publicada en
  `4d485ebd9d6790e5ebd447b888a05c62c6cec0c0`; CI `37867451079` aprobada.
- Creación de tareas, bandeja de laboratorio y finalización de tareas en
  `backend/app/routes/tasks.py`, junto a sus dos modelos de petición.
- Router con conexión, fecha, detalle, eventos, protección de episodio activo
  y permisos recibidos explícitamente; composición en `main.py`.
- Cuerpos comparados con el original y OpenAPI completo idéntico.
- Cuatro casos nuevos verifican registro y métodos, código 201, filtros
  PENDING/COMPLETED/ALL, servicio LAB, orden y ausencia de datos QR;
  filtro inválido devuelve 422. Pruebas existentes cubren permisos, resultados,
  duplicados y finalización rechazada en episodio cerrado sin mutación.
- Validación: 56 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33d-final` por el bloqueo previo de socketpair.
- Diff revisado sin errores de whitespace. Frontend sin cambios.
- La Etapa 33 continúa abierta.

### Entrega 33C: historial, detalle y escaneo

- Entrega cerrada y publicada en
  `ca41eb80512763b421d9e29b526b6439c3109440`; CI `37866233307` aprobada.
- `GET /episodes/history`, `GET /episodes/{episode_id}` y `GET /scan/{qr_token}`
  en `backend/app/routes/episode_queries.py`, mediante APIRouter.
- Conexión, detalle, registro de eventos y dependencias de autenticación y rol
  recibidos explícitamente; el router no importa `main.py`.
- Consultas, respuestas, permisos, orden de rutas y evento `QR_SCANNED`
  conservados. Cuerpos comparados y OpenAPI completo idéntico antes y después.
- Siete casos nuevos cubren registro y orden, cinco roles, episodios inexistentes,
  evento único del escaneo y rechazo de pulsera desconocida o episodio cerrado
  sin nuevos eventos. Se conserva la prueba existente de historial cerrado.
- Validación: 52 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33c-final` por el bloqueo previo de socketpair.
- Diff revisado sin errores de whitespace. Frontend sin cambios.
- La Etapa 33 continúa abierta.

### Entrega 33B: router de paneles

- Entrega cerrada y publicada en
  `0247346057a9b9e1dcda95ddf26515c4ccc1aaf6`; CI `37865415981` aprobada.
- `GET /dashboard` y `GET /supervisor/dashboard` en
  `backend/app/routes/dashboard.py`, mediante APIRouter.
- Conexión, detalle de episodio, fecha, autenticación y permisos recibidos
  explícitamente; composición conservada en `main.py`.
- Consultas, métricas, respuestas y permisos conservados; cuerpos comparados
  con el original y OpenAPI completo idéntico antes y después.
- Seis casos nuevos cubren registro único, métodos, acceso de los cinco roles
  y paneles vacíos. Pruebas existentes conservan métricas y consulta supervisor
  sin generación de alertas ni eventos.
- Validación: 45 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33b-final` por el bloqueo previo de socketpair.
- Diff revisado sin errores de whitespace. Frontend sin cambios.
- La Etapa 33 continúa abierta.

### Entrega 33A: router de autenticación

- Entrega cerrada y publicada en
  `f73e2c2261112464d7a77918f537c328bc756dbd`; CI `37864729924` aprobada.
- `/auth/login`, `/auth/me`, `/auth/logout` y `LoginRequest` en
  `backend/app/routes/auth.py`, con APIRouter y dependencias explícitas.
- Composición, conexión, fecha y autenticación conservadas en `main.py`.
  El router no importa `main.py`.
- Métodos, respuestas, permisos y sesiones conservados; OpenAPI completo
  idéntico antes y después.
- Dos pruebas nuevas verifican registro único, métodos y uso de la
  dependencia de autenticación suministrada.
- Validación: 39 pruebas backend aprobadas, una advertencia; fuera del sandbox
  con temporal `.tmp/pytest-33a-final` por el bloqueo previo de socketpair.
- Diff revisado sin errores de whitespace. Frontend sin cambios.
- La Etapa 33 continúa abierta.

Etapa 32 - Cerrada tras 32A–32C: hashes, validación de sesiones,
autorización por rol y lógica de login, logout y usuario actual separados.
Revisión basada en el código de `5278fd7`, 37 pruebas backend y CI
`37862024711` y `37862184127` aprobadas. No se repiten validaciones.
Rutas y dependencias FastAPI permanecen en `main.py` según el alcance.
Las referencias a Etapa 32 abierta en entregas anteriores son históricas.

Etapa 32C - Login, logout y consulta de usuario separados en `auth.py`.
Cerrada y publicada en `65e2b3cd21999971f1f96405ff282d085d7177e4`;
CI `37862024711` aprobada.
Rutas, modelos y dependencias FastAPI conservados en `main.py`.
La Etapa 32 continúa abierta.

Etapa 32B - Validación de sesiones y autorización por rol separadas en
`auth.py`; cerrada y publicada en `e754f09f4c6b4e9d7dbab21aedaef9323579f418`.
Dependencias FastAPI, conexión y fecha conservadas en `main.py`.
La Etapa 32 continúa abierta.

Etapa 32A - Hash y verificación extraídos a `security.py`; cerrada y publicada
en el commit `4c85e9c8e2abefdbc3b9e3adef9d98e8e22f8af9`.
Algoritmos, sal, iteraciones, comparación y formatos conservados; funciones
accesibles desde `main.py`. La Etapa 32 continúa abierta.

Etapa 31 - Cerrada tras 31A–31C: configuración, conexiones e inicialización
separadas, conservando endpoints, esquema, datos y arranque.
Revisión basada en el código de `138eb02` y validaciones aprobadas de 31C.
Las referencias a Etapa 31 abierta en entregas anteriores son históricas.

Etapa 31C - Inicialización SQLite extraída; cerrada y publicada en el commit
`1838e5716892106d30ea6b40000c9e8c5a551b24`.
SQL y carga inicial de usuarios en `database.py`; wrapper en `main.py`
conserva conexión, usuarios demo y funciones de hash y fecha. Arranque intacto.
La Etapa 31 continúa abierta.

Etapa 31B - Creación de conexiones SQLite extraída; cerrada y publicada
en el commit `376d59d85143371af407139f8ec459ced3e6dec5`.
`backend/app/database.py` recibe la ruta explícita y conserva `sqlite3.Row`
y claves foráneas. Wrapper en `main.py` mantiene `main.DATABASE_PATH`.
Inicialización, consultas y rutas conservadas; la Etapa 31 continúa abierta.

Etapa 31A - Configuración backend extraída; cerrada y publicada en el commit
`26a6567758c4ad324d642307e86524e6f760b5e9`.
`DATABASE_PATH`, `DEMO_USERS`, `PASSWORD_HASH_ITERATIONS` y
`SESSION_DURATION_HOURS` en `backend/app/config.py`, con valores conservados.
`main.DATABASE_PATH` sigue permitiendo SQLite temporal en pruebas.
La Etapa 31 continúa abierta.

Etapa 30 - Cerrada tras las entregas 30A–30I.
Cierre documental publicado en `9ed4dbfa4b23b2351f6eaa4958b0ca7eefca7f7d`;
CI `37726240159` aprobada.
Ocho páginas y `AppHeader` separados; `App.tsx` conserva composición,
sesión, navegación y datos. Cliente HTTP y tipos compartidos centralizados.
`EpisodePage` conserva su lógica propia según el alcance aprobado de 30G.

Etapa 30I - AppHeader extraído; cerrada y publicada en el commit
`a80d42c5394930579f43491ff47bfd57b11cc2f9`.
Botones, identidad, visibilidad por rol, textos y CSS conservados.
Navegación, sesión y API permanecen en `App.tsx`.
La Etapa 30 continúa abierta.

Etapa 30H - LoginPage extraído, incluida la vista de restauración;
cerrada y publicada en el commit `18841e97464e3aa38ab91a0b98d88a6661abb93f`.
Formulario, textos y CSS conservados.
Autenticación, restauración, token y errores permanecen en `App.tsx`.
La Etapa 30 continúa abierta.

Etapa 30G - EpisodePage movido a su propio archivo; cerrada y publicada
en el commit `7cf60c706131da9f9f0e9207639e609989010ec7`.
Props, estado local, API, permisos y formularios conservados dentro de
`EpisodePage`; sesión, navegación y episodio seleccionado siguen en `App.tsx`.
La Etapa 30 continúa abierta.

Etapa 30F - SupervisorPage extraído; cerrada y publicada en el commit
`d700a5aa0e7acb0a398eadc11b7a9efc54086ebf`.
Indicadores, filtros y acciones conservados; estado, API, permisos, errores
y navegación permanecen en `App.tsx`. La Etapa 30 continúa abierta.

Etapa 30E - LaboratoryPage extraído; cerrada y publicada en el commit
`e0cc198ff117d118aee39bc2a9afe46b658412cb`.
Bandeja, formulario y validación conservados; API, carga, errores, permisos
y navegación permanecen en `App.tsx`. La Etapa 30 continúa abierta.

Etapa 30D - DashboardPage extraído; cerrada y publicada en el commit
`3a4616125d3733168b60a8bafc1aacaf41b8b41d`.
Centro de control general conservado; API, carga, errores, permisos y navegación
permanecen en `App.tsx`. La Etapa 30 continúa abierta.

Etapa 30C - NewEpisodePage extraído; cerrada y publicada en el commit
`466cc5efc592106e576db305747593a3ec726df5`.
Formulario de llegada conservado; creación, errores, permisos y navegación
permanecen en `App.tsx`. La Etapa 30 continúa abierta.

Etapa 30B - ScanPage extraído; cerrada y publicada en el commit
`37864c1a4dfd027c0796bb7aaaee846451c70b40`.
El formulario conserva textos, campo obligatorio y estilos. La consulta API,
el estado, los errores y la navegación permanecen en `App.tsx`.

Etapa 30A - EpisodeHistoryPage extraído; cerrada y publicada en el commit
`a77970cfa653af7b72254573063f2d5445ed9ee3`.
La Etapa 30 continúa abierta. Estado, carga, errores, permisos, navegación y
llamadas API permanecen en `App.tsx`; el componente reutiliza `HistoryData`
y las clases CSS existentes sin cambios funcionales.

Etapa 29 - Nota de alta editable para médicos en episodios ACTIVE.
Cerrada y publicada en el commit
`f35770638a7482a363c38e253ba33c86e5abb28c`.



## Estado de validación

- Etapa 32C: 37 pruebas backend aprobadas, una advertencia.
- Etapa 32C: CI `37862024711` aprobada: backend, frontend, lint y build.
- Cuatro casos nuevos cubren credenciales rechazadas y sesiones independientes.
- Validación fuera del sandbox, temporal `.tmp/pytest-32c-final`.
- Primera ejecución detectó la exportación de `main.SESSION_DURATION_HOURS`
  requerida por una prueba existente; restaurada antes de validar de nuevo.
- Login y logout comparados con el original; lógica conservada.
- Diff revisado y `git diff --check` sin errores. Frontend sin cambios.

- Etapa 32B: 33 pruebas backend aprobadas, una advertencia observada.
- Etapa 32B: CI `37860358716` aprobada.
- Once casos nuevos cubren sesiones válidas, expiradas, revocadas, usuario
  inactivo, token desconocido/ausente y autorización de los cinco roles.
- Validación fuera del sandbox con `--basetemp .tmp/pytest-32b-verified`
  y diagnóstico de bloqueo activado por el antecedente de socketpair en TestClient.
- Lógica de sesión comparada con el original; diff revisado y
  `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin cambios ni nueva validación frontend.

- Etapa 32A: 22 pruebas backend aprobadas, una advertencia observada.
- Etapa 32A: CI `37858667828` aprobada.
- Tres pruebas nuevas cubren SHA-256, formato y sal PBKDF2, verificación
  correcta/incorrecta, compatibilidad existente y acceso desde `main.py`.
- Validación fuera del sandbox con `--basetemp .tmp/pytest-32a-verified`
  y `-o faulthandler_timeout=60`; ejecución dentro del sandbox interrumpida
  tras diagnóstico de bloqueo en socketpair de asyncio al iniciar TestClient.
- Funciones comparadas con el original; diff revisado y
  `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin nuevas validaciones frontend: sin cambios frontend.

- Cierre de Etapa 31: 19 pruebas backend aprobadas en 31C;
  CI `37857021915` y CI documental `37857173485` aprobadas.
- Cinco pruebas añadidas en 31A–31C cubren ruta SQLite, sustitución temporal,
  filas por nombre, claves foráneas, aislamiento y reinicialización persistente.
- Revisión de cierre documental: sin cambios de código ni nuevas pruebas.

- Etapa 31C: 19 pruebas backend aprobadas, una advertencia observada.
- Etapa 31C: CI `37857021915` aprobada.
- Prueba nueva de reinicialización: conserva esquema, usuarios, sesiones
  y episodios; verifica contraseñas demo persistidas.
- Validación fuera del sandbox con `--basetemp .tmp/pytest-31c-verified`
  y `-o faulthandler_timeout=60`. El temporal habitual falló por permisos;
  una ejecución en otro temporal dentro del sandbox dejó de avanzar y se interrumpió.
- El conteo de advertencias difiere de ejecuciones anteriores; no se atribuye
  al refactor. Sin cambios frontend ni nueva validación frontend.
- SQL y lógica comparados con el original; diff revisado y
  `git diff --check` sin errores, incluido el archivo nuevo.

- Etapa 31B: 18 pruebas backend aprobadas, con tres advertencias conocidas.
- Etapa 31B: CI `37727737285` aprobada.
- Dos pruebas nuevas comprueban filas por nombre, rechazo de referencias
  inexistentes y separación entre bases temporales.
- Se conserva la prueba de sustitución de `main.DATABASE_PATH`.
- Diff revisado y `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin nuevas validaciones frontend: sin cambios frontend.

- Etapa 31A: 16 pruebas backend aprobadas, con tres advertencias conocidas.
- Etapa 31A: CI `37727047490` aprobada.
- Dos pruebas nuevas comprueban ruta por defecto y conexión a la ruta temporal
  sustituida en `main.DATABASE_PATH`, con claves foráneas activadas.
- Constantes, funciones y clases comparadas con el original; diff revisado y
  `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin validaciones frontend nuevas: sin cambios frontend; se conserva la
  validación aprobada de 30I.

- Cierre de Etapa 30 basado en inspección estática y validaciones aprobadas
  de 30I: 46 pruebas frontend, lint y build; CI `37725349264` aprobada.
- Cierre documental de 30I publicado en `e5d7ec2`; CI `37725456535` aprobada.
- Esta revisión no ejecuta pruebas nuevas ni cambia código.

- Etapa 30I: 46 pruebas frontend, lint y build aprobados.
- Etapa 30I: CI `37725349264` aprobada.
- Cinco casos nuevos comprueban botones, identidad y callbacks por rol.
- Diff revisado y `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin nuevas pruebas backend locales: extracción limitada al frontend.

- Etapa 30H: 41 pruebas frontend, lint y build aprobados.
- Etapa 30H: CI `37724737074` aprobada.
- Tres casos nuevos cubren ingreso correcto, restauración correcta y fallo
  de restauración; conservadas las pruebas de formulario y credenciales rechazadas.
- Diff revisado y `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin nuevas pruebas backend locales: extracción limitada al frontend.

- Etapa 30G: 38 pruebas frontend, lint y build aprobados.
- Etapa 30G: CI `37724043270` aprobada.
- Conservadas las pruebas ACTIVE/CLOSED por rol, nota de alta, errores,
  doble envío y consulta posterior desde historial.
- Sin comportamiento nuevo ni pruebas nuevas: traslado del componente existente.
- Cuerpo y props comparados con el original; diff revisado y
  `git diff --check` sin errores, incluido el archivo nuevo.
- Sin nuevas pruebas backend locales: extracción limitada al frontend.

- Etapa 30F: 38 pruebas frontend, lint y build aprobados.
- Etapa 30F: CI `37723480808` aprobada. Diff revisado y
  `git diff --check` sin errores, incluidos los archivos nuevos.
- Seis casos nuevos cubren indicadores, filtros, apertura, actualización
  con reinicio del filtro y ausencia de acceso para los otros cuatro roles.
- Conservadas las pruebas de evaluación explícita de reglas y errores.
- Extracción limitada al frontend; sin nuevas pruebas backend locales.

- Etapa 30E: 32 pruebas frontend, lint y build aprobados.
- Etapa 30E: CI `37721355298` aprobada; pruebas backend, frontend, lint
  y build aprobados. Diff revisado y `git diff --check` sin errores,
  incluidos los archivos nuevos.
- Siete casos nuevos cubren actualización y acceso LAB/SUPERVISOR, ausencia
  de acceso para los otros tres roles, publicación y rechazo de la API.
- Sin nuevas pruebas backend: extracción limitada al frontend.

- Etapa 30D: 25 pruebas frontend, lint y build aprobados; diff revisado y
  `git diff --check` sin errores, incluidos los dos archivos nuevos.
- Pruebas ejecutadas fuera del sandbox tras un fallo de acceso a un temporal.
  Se corrigió una opción no admitida en la prueba nueva, sin modificar la UI.
- Etapa 30D: CI `37719496231` aprobada, según el resumen de continuidad.
- Sin pruebas backend locales nuevas: extracción limitada al frontend.

- Etapa 30C: 23 pruebas frontend, lint y build aprobados; diff revisado y
  `git diff --check` sin errores, incluido el componente nuevo.
- Etapa 30C: CI aprobada en la ejecución `37718612913`, con pruebas backend,
  frontend, lint y build aprobados.
- Sin pruebas backend nuevas: extracción limitada al frontend.

- Etapa 30B: 21 pruebas frontend, lint y build aprobados; diff revisado y
  `git diff --check` sin errores, incluido `ScanPage.tsx`.
- La prueba nueva se ajustó para comprobar el mensaje visible del aviso de
  error existente, sin cambiar la UI ni ampliar tiempos de espera.
- Sin pruebas backend locales nuevas: extracción limitada al frontend.
- Etapa 30B: CI aprobada en la ejecución `37717881092`, incluyendo pruebas
  backend, pruebas frontend, lint y build.

- Etapa 30A: 20 pruebas frontend aprobadas; lint y build aprobados.
  Pruebas y lint completados tras el reinicio del equipo; se conserva el build
  aprobado antes del reinicio, sin cambios posteriores de código.
- Etapa 30A: diff revisado y `git diff --check` sin errores, incluidos los
  archivos nuevos. Sin pruebas backend nuevas: entrega limitada al frontend.
- Etapa 30A: CI aprobada en la ejecución `37716248936`.

### Antecedentes de validación anteriores a 30A

- Backend: pruebas ampliadas con regresion de dashboard supervisor sin efectos
  secundarios.
- Backend: prueba de regresion para impedir completar tareas pendientes de
  episodios cerrados sin mutar tarea, episodio ni auditoria.
- Frontend: 18 pruebas aprobadas; cobertura de CLOSED/ACTIVE para los cinco roles, nota de alta
  obligatoria tras trim, envío, consulta posterior, errores y doble envío.
- Backend: prueba de flujo ampliada para comprobar la persistencia exacta de
  la nota en auditoría y consulta posterior, exclusivamente con SQLite temporal.
- Backend: 14 pruebas aprobadas, con tres advertencias conocidas.
- Suite frontend, lint y build aprobados; `scripts/validate.ps1` ejecutado una
  sola vez y aprobado para esta corrección.
- Validaciones anteriores vigentes: el cierre del hallazgo HTTP 401 como
  limitación aceptada es exclusivamente documental; no cambia código ni pruebas.
- ESLint: cero errores.
- Frontend: compilación aprobada.
- Advertencias backend: se mantienen únicamente las ya conocidas.
- Validación local: `scripts/validate.ps1`.
- GitHub Actions: CI aprobada en la ejecución `37244485263` para el commit
  de cierre de la Etapa 29; backend (14 pruebas), frontend (18 pruebas), lint
  y build aprobados.
- CI preparada ante la deprecación de Node 20 en GitHub Actions.
- Runner de CI fijado en `ubuntu-24.04` antes de la migración de
  `ubuntu-latest` a Ubuntu 26.
- Runtime de `actions/setup-node` modernizado mediante `actions/setup-node@v7`.
- Eliminación esperada de las advertencias internas `DEP0040` y `DEP0169` de
  `setup-node@v5`.
- Baseline Codex versionado con aprobacion bajo demanda, escritura limitada al
  workspace y red desactivada dentro del sandbox.
- Dependabot configurado para mantenimiento semanal y revisable de GitHub
  Actions en la rama `main`, con maximo de cinco PRs abiertos.

## Capacidades principales

- Recepción y creación de episodios.
- Pulsera y lectura QR.
- Triaje y signos vitales.
- Evaluación médica.
- Tareas de enfermería.
- Órdenes y resultados de laboratorio.
- Panel de supervisor.
- Finalizacion de tareas protegida por episodio activo.
- Dashboard supervisor de solo lectura.
- Motor de reglas temporales mediante accion explicita
  `POST /rules/evaluate`.
- Boton supervisor **Evaluar reglas temporales**.
- Datos de demostración.
- Historial de episodios cerrados.
- Detalle CLOSED con aviso accesible de solo lectura y sin controles de
  escritura; conserva vitales, alertas, tareas, resultados y auditoría.
- Permisos de episodios activos conservados; backend como última barrera
  contra mutaciones posteriores al cierre.
- Nota de alta editable, inicialmente vacía, solo para DOCTOR en ACTIVE.
  Envío bloqueado durante la solicitud. El borrador se conserva ante errores
  de red y rechazos de la API mientras la sesión siga vigente y la pantalla
  permanezca abierta.
  Persistencia y consulta por el evento DISCHARGE existente.
- Manejo de sesión expirada.
- Historial visual de alertas.
- Máquina de estados de alertas.
- Restauración y cierre de sesión.
- Cliente HTTP frontend separado.
- Tipos de dominio, API y datos clínicos separados.
- Validación local reproducible en Windows.
- Tareas de VS Code para validación, pruebas, lint, build y ejecución local.
- CI con acciones oficiales compatibles con runtime Node 24.
- CI con `actions/setup-node@v7`, Node.js 22, cache npm y Ubuntu 24.04.
- Baseline de seguridad Codex compartido en `.codex/config.toml`.
- Mantenimiento automatizado y revisable de acciones mediante Dependabot,
  limitado exclusivamente a `github-actions`.

## Sesiones

Descripción basada en inspección estática de `backend/app/main.py`.

- `POST /auth/login`: crea una sesión persistente en la tabla `sessions` de
  SQLite (`backend/clinical.db`) y devuelve el token al cliente. En la base
  de datos se almacena su hash SHA-256, no el token en texto plano.
- Las sesiones expiran a las ocho horas de su creación. La autenticación
  comprueba `expires_at`; si detecta expiración, registra `revoked_at` y
  devuelve HTTP 401.
- `GET /auth/me`: valida la sesión y devuelve el usuario y su rol. La
  autenticación requiere una sesión no revocada, no expirada y un usuario
  activo.
- `POST /auth/logout`: revoca la sesión utilizada por la petición mediante
  `revoked_at`.
- El inicio del backend inicializa las tablas si no existen y no elimina ni
  revoca las sesiones guardadas. Reiniciar conserva las sesiones si se mantiene
  la misma base SQLite; su validez sigue sujeta a expiración, revocación y
  estado activo del usuario.

## Alertas

Transiciones permitidas:

```text
ACTIVE → ACKNOWLEDGED
ACTIVE → ESCALATED
ACKNOWLEDGED → ESCALATED
ACKNOWLEDGED → RESOLVED
ESCALATED → RESOLVED
```

## Protocolo funcional de Etapa 28

- Evidencias 28A–28E conservadas: smoke; autenticación, sesión y logout;
  recepción y QR; triaje, vitales y alertas; evaluación médica, orden y
  resultado LAB; supervisor de consulta; resolución, alta e historial.
- QA EP-15 cerrado con prioridad P2, tres alertas resueltas, una evaluación,
  una tarea LAB completada y 17 eventos. Seis intentos posteriores al cierre
  rechazados con HTTP 409 sin mutación, según la evidencia previa de 28E.
- Cierre del defecto visual mediante TDD y consulta desde historial usando
  `.tmp/stage28-evidence/clinical.after-phase28E.db` en Chrome temporal.
- Evidencia: `.tmp/stage28-evidence/e28-closed-readonly-fixed.png` muestra
  aviso, vitales históricos, alertas resueltas y timeline con resultado LAB,
  sin formulario de vitales ni acciones de escritura.
- La comprobación DOM pasó; el control de red posterior a la captura dio un
  falso positivo al clasificar OPTIONS como escritura. El log confirmó solo
  consultas y login/logout. No se repitió el flujo clínico.
- Perfil temporal eliminado y servidores cerrados por PIDs exactos. Puertos
  8000, 5173 y 9444 libres. DB restaurada desde `clinical.before-stage28.db`:
  SHA-256 `4EE9CF8ADE09D813715B750444DA8870E6E2CDB6FF6935FEC428C0A1F0756049`.
- Limitación detectada en Etapa 28: nota de alta fija en UI. Resuelta en
  Etapa 29 mediante el campo editable; las evidencias 28A–28E se conservan.

## Experiencia de desarrollo

- `scripts/validate.ps1` refleja la validación de CI desde Windows.
- Pytest usa `.tmp/pytest` como base temporal local controlada.
- Las tareas de VS Code usan rutas relativas al workspace.
- Estas mejoras no cambian el comportamiento clínico de la aplicación.
- El baseline Codex no cambia el comportamiento funcional de la aplicacion; solo
  fija permisos locales esperados para sesiones futuras.
- `GET /supervisor/dashboard` no debe crear alertas ni eventos.
- `POST /rules/evaluate` conserva la idempotencia de alertas temporales.
- `complete_task` rechaza tareas de episodios cerrados con `409 El episodio
  está cerrado`, sin modificar resultado ni registrar `TASK_COMPLETED`.
- La correccion de `complete_task` queda separada del dashboard supervisor y de
  las reglas temporales explicitas.

## Próximo paso recomendado

Etapas 30–53 cerradas dentro de los alcances acordados. Etapa 54 autorizada e
implementada localmente en una entrega transversal. Validación: 259 pruebas
frontend, lint y build aprobados; backend sin cambios, conserva sus 132 pruebas
y CI de 53B aprobada. Siguiente paso: publicar y comprobar
CI. Commit/push autorizados por el usuario. La prueba manual de evaluaciones
confirmada corresponde a 53; no se presenta
como prueba manual de recuperación de formularios de 54.

37A permite recuperar la nota de alta tras HTTP 401 según identidad, plazo
y estado del episodio. 38A avisa antes de abandonar una nota sin enviar;
confirmar la salida, recargar o cerrar la pestaña siguen perdiendo el texto.
41A y 42A avisan antes de perder una evaluación u orden clínica sin guardar.
Su recuperación tras HTTP 401 y la de otros formularios siguen fuera del alcance.
No se almacenan notas clínicas en localStorage/sessionStorage ni en el backend.

La implementación de 37A está publicada y su CI aprobada.
El contrato backend no cambia: la exigencia de nota no vacía se aplica en
esta UI y el alta requiere una nueva acción explícita del médico.
