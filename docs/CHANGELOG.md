# Registro de evolución de MedicControl+

Este documento registra las funcionalidades incorporadas al sistema,
las verificaciones realizadas y el estado de cada etapa.

---

## Entrega 39A: conservar formularios ante envíos fallidos

- Corrección autorizada e implementada localmente; pendiente de commit, push y CI.
- El helper de envío devuelve fallo tras errores de API o de red, en lugar de
  permitir que evaluación médica y orden clínica se reinicien sin guardarse.
- Ambos formularios conservan sus campos y muestran el error. Solo se vacían
  tras una respuesta exitosa; el reintento requiere una acción explícita.
- Seis casos nuevos cubren errores de API, fallos de red, reintento con los
  mismos datos y conservación durante una respuesta pendiente para ambos formularios.
- Interrupción por HTTP 401 conserva su tratamiento de 37A. No se añade
  persistencia, recuperación de otros borradores ni cambios en API o backend.
- Validación: 94 pruebas frontend, lint y build aprobados. Base local sin cambios.

## Cierre de la Etapa 38

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

## Entrega 38A: aviso de nota de alta sin enviar

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

## Cierre de la Etapa 37

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

## Entrega 37A: recuperación de nota de alta

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

---

## Etapa 36A: diseño de recuperación de nota de alta

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

---

## Revisión de cierre de Etapa 35

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

---

## Entrega 35B: rechazos en episodios cerrados

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

---

## Entrega 35A: matriz de permisos y tareas

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

---

## Entrega 34B: actualización de checkout y cierre

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

---

## Entrega 34A: actualización de setup-python

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

---

## Entrega 33K: composición final y revisión de cierre

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

---

## Entrega 33J: carga de datos demo

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

---

## Entrega 33I: evaluación de reglas temporales

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

---

## Entrega 33H: registro de episodios

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

---

## Entrega 33G: evaluación médica y alta

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

---

## Entrega 33F: triaje y signos vitales

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

---

## Entrega 33E: actualización de alertas

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

---

## Entrega 33D: tareas y laboratorio

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

---

## Entrega 33C: historial, detalle y escaneo

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

---

## Entrega 33B: router de paneles

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

---

## Entrega 33A: router de autenticación

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

---

## Cierre de la Etapa 32

- 32A–32C completan las tres entregas previstas: hashes, validación y
  autorización, y lógica de inicio/cierre de sesión y usuario actual.
- Criterios cumplidos: hashes y formatos conservados, duración de ocho horas,
  persistencia y revocación independientes, permisos y contratos HTTP.
- Evidencia: `security.py`, `auth.py`, wrappers FastAPI en `main.py` y
  pruebas de seguridad, sesiones y roles. Exportaciones compatibles conservadas.
- Revisión del código de `5278fd7`; 37 pruebas backend y CI `37862024711`
  y `37862184127` ya aprobadas. Sin nuevas pruebas ni cambios funcionales.
- Etapa 32 cerrada. Las referencias anteriores a etapa abierta son históricas.
- Próximo paso: definir y aprobar 33A; este cierre no autoriza implementarla.

---

## Etapa 32C - Separación de endpoints de autenticación

- Entrega cerrada y publicada en
  `65e2b3cd21999971f1f96405ff282d085d7177e4`; CI `37862024711` aprobada.
- Lógica en `backend/app/auth.py`; rutas, modelos y dependencias en `main.py`.
- Token aleatorio, hash persistido, duración de ocho horas, respuestas y
  revocación conservados. Exportaciones de compatibilidad mantenidas.
- Cuatro casos nuevos cubren contraseña incorrecta, usuario desconocido,
  usuario inactivo y cierre de una sesión sin afectar otra.
- Validación: 37 pruebas backend aprobadas fuera del sandbox, una advertencia;
  temporal `.tmp/pytest-32c-final`. Diff revisado sin errores de whitespace.
- La Etapa 32 continúa abierta.

---

## Etapa 32B - Separación de sesiones y autorización por rol

- Validación de sesión y autorización movidas a `backend/app/auth.py`.
- Dependencias FastAPI en `main.py` conservadas; conexión y fecha recibidas
  como parámetros. Expiración, revocación, usuario activo y 401/403 conservados.
- Once casos nuevos cubren estados de sesión, ausencia de token y los cinco roles.
- Validación: 33 pruebas backend aprobadas fuera del sandbox, una advertencia;
  temporal `.tmp/pytest-32b-verified` y diagnóstico de bloqueo activado.
- Lógica comparada con el original; diff revisado y `git diff --check`
  sin errores, incluidos los archivos nuevos.
- Sin cambios frontend, endpoints de autenticación, esquema ni datos demo.
- Entrega cerrada y publicada en el commit
  `e754f09f4c6b4e9d7dbab21aedaef9323579f418`; CI `37860358716` aprobada.
  La Etapa 32 continúa abierta.

---

## Etapa 32A - Extracción de hash y verificación

- Tres funciones movidas a `backend/app/security.py`, importadas en `main.py`.
- SHA-256, PBKDF2, sal aleatoria, iteraciones, comparación y formatos conservados.
- Tres pruebas nuevas de formato, verificación, sal, compatibilidad y acceso
  desde `main.py`; las funciones coinciden con las originales.
- Validación: 22 pruebas backend aprobadas fuera del sandbox, una advertencia.
  Temporal `.tmp/pytest-32a-verified`; diagnóstico de bloqueo de socketpair
  de asyncio en la ejecución dentro del sandbox, que fue interrumpida.
- Diff revisado y `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin cambios frontend, endpoints, validación de sesiones, roles ni datos demo.
- Entrega cerrada y publicada en el commit
  `4c85e9c8e2abefdbc3b9e3adef9d98e8e22f8af9`; CI `37858667828` aprobada.
  La Etapa 32 continúa abierta.

---

## Cierre documental de Etapa 31

- Criterios cumplidos tras 31A–31C: configuración, conexiones e inicialización
  separadas, manteniendo ruta SQLite, esquema, datos, endpoints y arranque.
- Evidencia vigente: 19 pruebas backend aprobadas; CI `37857021915`
  y CI documental `37857173485` aprobadas.
- Revisión documental sin cambios de código ni nuevas pruebas.
  Las referencias anteriores a Etapa 31 abierta son históricas.
- Propuesta 32A documentada, pendiente de autorización.

---

## Etapa 31C - Extracción de inicialización SQLite

- Esquema y carga inicial de usuarios demo movidos a `database.py`;
  wrapper y arranque en `main.py` conservados.
- Conexión, usuarios y funciones de hash y fecha recibidos como parámetros.
  SQL, commit y cierre conservados; solo se elimina espacio final en una línea SQL vacía.
- Prueba nueva de reinicialización que conserva esquema, usuarios, sesiones
  y episodios y verifica contraseñas demo.
- Validación: 19 pruebas backend aprobadas fuera del sandbox, una advertencia.
  Temporal `.tmp/pytest-31c-verified`, con diagnóstico de bloqueo activado;
  temporal habitual rechazado por permisos y ejecución anterior interrumpida.
- Diff revisado y `git diff --check` sin errores, incluido el archivo nuevo.
- Sin cambios frontend, endpoints, esquema ni datos demo locales.
- Entrega cerrada y publicada en el commit
  `1838e5716892106d30ea6b40000c9e8c5a551b24`; CI `37857021915` aprobada.
  La Etapa 31 continúa abierta.

---

## Etapa 31B - Extracción de conexiones SQLite

- Creación de conexiones movida a `backend/app/database.py`, con ruta explícita.
- `sqlite3.Row` y claves foráneas conservados. Wrapper en `main.py` mantiene
  la sustitución de `main.DATABASE_PATH` usada por las pruebas.
- Dos pruebas nuevas de filas por nombre, integridad referencial y separación
  de bases; conservada la cobertura del wrapper con ruta temporal.
- Validación: 18 pruebas backend aprobadas, tres advertencias conocidas;
  diff revisado y `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin cambios frontend, inicialización, consultas, endpoints, esquema ni datos demo.
- Entrega cerrada y publicada en el commit
  `376d59d85143371af407139f8ec459ced3e6dec5`; CI `37727737285` aprobada.
  La Etapa 31 continúa abierta.

---

## Etapa 31A - Extracción de configuración backend

- Constantes `DATABASE_PATH`, `DEMO_USERS`, `PASSWORD_HASH_ITERATIONS` y
  `SESSION_DURATION_HOURS` movidas a `backend/app/config.py`.
- Valores y ruta SQLite conservados; `main.DATABASE_PATH` mantiene la sustitución
  utilizada por las pruebas. Funciones y clases de `main.py` conservadas.
- Dos pruebas nuevas de ruta por defecto y conexión con sustitución temporal.
- Validación: 16 pruebas backend aprobadas, tres advertencias conocidas;
  diff revisado y `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin cambios frontend, endpoints, esquema ni datos demo.
- Entrega cerrada y publicada en el commit
  `26a6567758c4ad324d642307e86524e6f760b5e9`; CI `37727047490` aprobada.
  La Etapa 31 continúa abierta.

---

## Cierre documental de Etapa 30

- Revisión de criterios tras 30A–30I: ocho páginas y `AppHeader` separados;
  `App.tsx` mantiene composición, sesión, navegación y datos.
- Cliente HTTP y tipos compartidos conservados; `EpisodePage` mantiene
  su lógica propia según el alcance aprobado.
- Evidencia vigente: 46 pruebas frontend, lint y build aprobados;
  CI `37725349264` y CI documental `37725456535` aprobadas.
- Etapa 30 cerrada; cierre documental publicado en
  `9ed4dbfa4b23b2351f6eaa4958b0ca7eefca7f7d`, CI `37726240159` aprobada.
  Las entregas anteriores conservan su estado histórico.
- Sin cambios de código ni nuevas ejecuciones de pruebas.
  Propuesta 31A documentada, pendiente de autorización.

---

## Etapa 30I - Extracción de AppHeader

- Cabecera extraída a `frontend/src/components/AppHeader.tsx`, con usuario
  y callbacks de navegación y logout; sin estado propio.
- Botones, identidad, visibilidad por rol, textos y CSS conservados.
  Navegación, sesión y API permanecen en `App.tsx`.
- Cinco casos nuevos cubren botones visibles y callbacks por rol.
- Validación: 46 pruebas frontend, lint y build aprobados; diff revisado y
  `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin cambios de backend, cliente API, tipos compartidos, CSS ni dependencias.
- Entrega cerrada y publicada en el commit
  `a80d42c5394930579f43491ff47bfd57b11cc2f9`; CI `37725349264` aprobada.
  La Etapa 30 continúa abierta.

---

## Etapa 30H - Extracción de LoginPage

- Formulario de acceso y vista de restauración extraídos a
  `frontend/src/pages/LoginPage.tsx`, sin estado propio.
- Formulario, cinco usuarios demo, valores iniciales, textos y CSS conservados.
  Autenticación, restauración, token y errores permanecen en `App.tsx`.
- Tres casos nuevos cubren ingreso correcto y restauración correcta o fallida;
  se conservan las pruebas de formulario y credenciales rechazadas.
- Validación: 41 pruebas frontend, lint y build aprobados; diff revisado y
  `git diff --check` sin errores, incluidos los archivos nuevos.
- Sin cambios de backend, cliente API, tipos compartidos, CSS ni dependencias.
- Entrega cerrada y publicada en el commit
  `18841e97464e3aa38ab91a0b98d88a6661abb93f`; CI `37724737074` aprobada.
  La Etapa 30 continúa abierta.

---

## Etapa 30G - Traslado de EpisodePage

- Componente existente movido de `App.tsx` a `frontend/src/pages/EpisodePage.tsx`.
- Props, estado local, llamadas API, permisos, formularios y presentación
  conservados. Sesión, navegación y episodio seleccionado siguen en `App.tsx`.
- Imports ajustados; cuerpo y props comparados con el original.
- Validación: 38 pruebas frontend, lint y build aprobados; diff revisado y
  `git diff --check` sin errores, incluido el archivo nuevo.
- Conservadas las pruebas ACTIVE/CLOSED por rol y de alta médica;
  sin comportamiento nuevo ni pruebas nuevas para este traslado.
- Sin cambios de backend, cliente API, tipos compartidos, CSS ni dependencias.
- Entrega cerrada y publicada en el commit
  `7cf60c706131da9f9f0e9207639e609989010ec7`; CI `37724043270` aprobada.
  La Etapa 30 continúa abierta.

---

## Etapa 30F - Extracción de SupervisorPage

- Centro de control del supervisor extraído a `frontend/src/pages/SupervisorPage.tsx`,
  con datos, filtro, mensaje, estado de evaluación y callbacks; sin estado propio.
- Indicadores, tabla, filtros, textos, acciones y CSS conservados.
  Estado, API, carga, errores, permisos y navegación permanecen en `App.tsx`.
- Seis casos nuevos cubren filtros, indicadores, apertura del episodio,
  actualización que restablece Todos y ausencia de acceso para otros roles.
- Conservadas las pruebas de evaluación explícita de reglas y errores.
- Validación: 38 pruebas frontend, lint y build aprobados.
- Sin cambios de backend, cliente API, tipos compartidos ni dependencias.
- Entrega cerrada y publicada en el commit
  `d700a5aa0e7acb0a398eadc11b7a9efc54086ebf`; CI `37723480808` aprobada.
  La Etapa 30 continúa abierta.

---

## Etapa 30E - Extracción de LaboratoryPage

- Bandeja «Órdenes pendientes» extraída a `frontend/src/pages/LaboratoryPage.tsx`,
  con `laboratoryQueue`, `onRefresh` y `onCompleteOrder`; sin estado propio.
- Contador, estado vacío, tarjetas, textos, CSS y validación conservados.
  API, carga, errores, permisos y navegación permanecen en `App.tsx`.
- Siete casos nuevos de integración cubren actualización, acceso por rol,
  publicación correcta y rechazo conservando formulario y resultado.
- Validación: 32 pruebas frontend, lint y build aprobados.
- Sin cambios de backend, cliente API, tipos compartidos ni dependencias.
- Entrega cerrada y publicada en el commit
  `e0cc198ff117d118aee39bc2a9afe46b658412cb`; CI `37721355298` aprobada
  con pruebas backend, frontend, lint y build.
  La Etapa 30 continúa abierta.

---

## Etapa 30D - Extracción de DashboardPage

- Centro de control general extraído a `frontend/src/pages/DashboardPage.tsx`.
  Recibe `dashboard`, `onRefresh` y `onOpenEpisode`, sin estado propio.
- Indicadores, cálculos, tabla, estado vacío, textos y CSS conservados.
  API, carga, errores, permisos y navegación permanecen en `App.tsx`.
- Dos pruebas de integración en `App.dashboard.test.tsx` cubren indicadores,
  exclusión de alertas resueltas y tareas completadas de sus conteos, apertura
  del episodio seleccionado y actualización desde el estado vacío.
- Sin cambios de backend, cliente API, tipos compartidos ni dependencias.
- Validación: 25 pruebas frontend, lint y build aprobados; diff revisado y
  `git diff --check` sin errores. Pruebas fuera del sandbox tras un fallo de
  acceso a un temporal; corregida una opción no admitida en la prueba nueva.
- Sin pruebas backend locales nuevas: extracción limitada al frontend.
- Entrega cerrada y publicada en el commit
  `3a4616125d3733168b60a8bafc1aacaf41b8b41d`; CI `37719496231` aprobada,
  según el resumen de continuidad. La Etapa 30 continúa abierta.

---

## Etapa 30C - Extracción de NewEpisodePage

- Pantalla «Registrar llegada» extraída a `frontend/src/pages/NewEpisodePage.tsx`,
  sin estado propio y con un callback `onSubmit` tipado para el formulario.
- Campos, textos, valores iniciales y estilos conservados. Creación del episodio,
  consulta API, errores, permisos y navegación permanecen en `App.tsx`.
- Dos pruebas de integración añadidas: ingreso correcto con apertura del episodio
  y actualización del dashboard; rechazo de la API conservando el formulario.
- Sin cambios de backend, cliente API, tipos compartidos ni dependencias.
- Validación: 23 pruebas frontend, lint y build aprobados; diff revisado y
  `git diff --check` sin errores. Sin pruebas backend nuevas: cambio de frontend.
- Entrega cerrada y publicada en el commit
  `466cc5efc592106e576db305747593a3ec726df5`; CI `37718612913` aprobada.
  La Etapa 30 continúa abierta.

---

## Etapa 30B - Extracción de ScanPage

- Pantalla «Escanear pulsera» extraída a `frontend/src/pages/ScanPage.tsx`,
  sin estado propio y con un callback `onSubmit` tipado para el formulario.
- Textos, campo obligatorio y clases CSS conservados. Consulta API, errores,
  permisos y navegación permanecen en `App.tsx`; sin cambios funcionales.
- Se conservan los casos existentes de apertura por token para los cinco roles
  y se añade una prueba del rechazo de la consulta que conserva el formulario.
- Validación final: 21 pruebas frontend, lint y build aprobados; diff revisado
  y `git diff --check` sin errores. La prueba nueva se corrigió para comprobar
  el mensaje visible del aviso existente, sin modificar la UI ni sus tiempos.
- Sin pruebas backend nuevas: extracción limitada al frontend.
- Entrega cerrada y publicada en el commit
  `37864c1a4dfd027c0796bb7aaaee846451c70b40`; CI `37717881092` aprobada.
  La Etapa 30 continúa abierta.

---

## Etapa 30A - Extracción de EpisodeHistoryPage

- Pantalla de historial extraída a `frontend/src/pages/EpisodeHistoryPage.tsx`.
  Recibe `historyData`, `onRefresh` y `onOpenEpisode`; reutiliza `HistoryData`
  y las clases CSS existentes.
- Estado, carga, errores, permisos, navegación y llamadas API permanecen en
  `App.tsx`. Se conservan textos, tabla, fechas, valores alternativos y acciones.
- Se conserva la prueba de consulta del historial después del alta y se añaden
  dos casos: historial vacío y actualización mediante una nueva consulta.
- Validación: 20 pruebas frontend, lint y build aprobados; diff revisado y
  `git diff --check` sin errores. Se conserva el build anterior al reinicio del
  equipo, sin cambios posteriores de código; pruebas y lint completados al
  retomar. No se ejecutaron pruebas backend para esta extracción de frontend.
- Entrega cerrada y publicada en el commit
  `a77970cfa653af7b72254573063f2d5445ed9ee3`; CI `37716248936` aprobada.
  La Etapa 30 continúa abierta.

---

## Etapa 29 - Nota de alta editable

- El médico dispone de un campo accesible «Nota de alta» únicamente en
  episodios ACTIVE. Empieza vacío y sustituye la afirmación fija de estabilidad.
- La UI exige contenido después de `trim` y envía la nota sin espacios en
  los extremos mediante el contrato existente `POST /episodes/{id}/discharge`.
- Durante la solicitud se bloquean campo y envío; una guarda evita solicitudes
  duplicadas. Ante errores de red y rechazos de la API se muestra el mensaje
  y se conserva el borrador para corregirlo o reintentar, mientras la sesión
  siga vigente y la pantalla permanezca abierta.
- Limitación aceptada de Etapa 29: HTTP 401 activa el flujo existente de
  expiración de sesión y recarga; el borrador se pierde. Tampoco persiste al
  navegar o recargar. El hallazgo se cierra como limitación aceptada, sin
  modificar la autenticación ni almacenar notas en localStorage/sessionStorage.
  Recuperar borradores durante reautenticación queda pendiente para una etapa
  independiente.
- La nota continúa almacenada en el evento DISCHARGE y puede consultarse en
  el timeline después del cierre y desde el historial. CLOSED sigue siendo
  de solo lectura; no cambian permisos, reglas clínicas ni contratos backend.
- Pruebas frontend de permisos/estado, nota vacía o con espacios, envío,
  auditoría posterior, error HTTP/de red, reintento y prevención de duplicados.
- Prueba backend existente ampliada para verificar que una nota personalizada
  con salto de línea se conserva exactamente en DISCHARGE y al consultar el
  episodio cerrado. Usa SQLite temporal; no se usa la DB clínica original.
- Validación: `scripts/validate.ps1` aprobado; backend 14 pruebas (tres
  advertencias conocidas), frontend 18 pruebas, lint y build aprobados.
  `git diff --check` sin errores y hash original de `clinical.db` conservado.
- Estas validaciones permanecen vigentes: el cierre del hallazgo HTTP 401
  modifica exclusivamente documentación, sin cambios de código ni pruebas.

---

## Etapa 28 - Validación funcional completada y episodios de solo lectura

### Corrección mediante TDD

- `EpisodePage` deriva `isClosed` y muestra el aviso accesible «Episodio
  cerrado — solo lectura» para episodios CLOSED.
- Oculta triaje, registro de vitales, transiciones de alertas y completar
  tareas cuando el episodio está cerrado. Evaluación médica, creación de
  órdenes y alta ya exigían ACTIVE; conservan sus permisos actuales.
- Mantiene identidad, vitales históricos, alertas e historial de transiciones,
  tareas pendientes y timeline, incluidos tareas completadas y resultados.
- No agrega llamadas HTTP ni modifica backend, endpoints, reglas clínicas,
  dependencias o workflows. El backend continúa bloqueando las mutaciones.
- Cinco casos parametrizados CLOSED fallaron primero por controles de escritura
  presentes y aviso ausente. Los mismos casos pasan tras la corrección; otros
  cinco verifican que ACTIVE conserva los controles existentes por rol.

### Protocolo y resultados

- Evidencias previas 28A–28E: smoke, autenticación y restauración de sesión,
  recepción, QR, triaje, vitales y alertas; evaluación médica, orden y resultado
  de laboratorio; supervisor de consulta y evaluación temporal explícita;
  resolución de alertas, alta, historial y rechazos posteriores al cierre.
- QA final EP-15: CLOSED, P2, tres alertas RESOLVED, una evaluación médica,
  una tarea LAB completada con resultado simulado y 17 eventos auditables.
- Los seis intentos de modificación posteriores al cierre de 28E devolvieron
  HTTP 409 sin cambios clínicos. Esa evidencia previa se conserva; no se
  repitieron mutaciones para esta corrección visual.
- Frontend: 14 pruebas aprobadas (antes 4). Backend: 14 aprobadas, con tres
  advertencias conocidas. Suite frontend, lint y build aprobados; una ejecución
  de `scripts/validate.ps1` aprobada.
- Captura desde historial con Chrome temporal y el snapshot QA cerrado:
  `.tmp/stage28-evidence/e28-closed-readonly-fixed.png`. Aviso visible,
  cero formularios/campos/botones de escritura en el detalle, datos históricos
  visibles. El verificador de red confundió OPTIONS con escritura después de
  guardar la captura; revisión del log confirmó solo GET, OPTIONS y login/logout.
- Perfil y servidores cerrados por PIDs exactos. DB original restaurada desde
  `clinical.before-stage28.db`, SHA-256
  `4EE9CF8ADE09D813715B750444DA8870E6E2CDB6FF6935FEC428C0A1F0756049`.
  Puertos 8000, 5173 y 9444 libres.
- Etapa 28 funcional completada. Limitación aceptada pendiente: la nota de alta
  sigue fija en UI («Alta médica; paciente estable»).

---

## Etapa 28B - Integridad al completar tareas

### Implementado

- `complete_task` ahora valida que el episodio asociado siga activo antes de
  modificar la tarea o registrar auditoria de finalizacion.
- Las tareas pendientes de episodios cerrados devuelven el rechazo de
  integridad existente: `409 El episodio está cerrado`.
- Al rechazar por episodio cerrado no se modifica la tarea, no se registra
  `TASK_COMPLETED` y no cambian los datos de cierre del episodio.
- Completar tareas de episodios activos conserva el comportamiento existente.
- Se mantiene separado del cambio del dashboard supervisor y de las reglas
  temporales explicitas.

### Verificacion

- Prueba backend de regresion para una tarea pendiente creada en un episodio
  activo y rechazada despues del alta.
- Se conservan contratos de `complete_task` para tarea inexistente, tarea ya
  completada y rol no autorizado.

### Proxima accion

- Reanudar las pruebas funcionales de Etapa 28.

---

## Etapa 28 - Reglas temporales explicitas

### Implementado

- El dashboard de supervisor queda como consulta de solo lectura.
- La evaluacion temporal se mantiene en `POST /rules/evaluate` como
  accion explicita para los roles medico y supervisor.
- El panel de supervisor incorpora el boton **Evaluar reglas temporales**.
- El boton **Actualizar indicadores** conserva solamente la consulta del
  dashboard.
- La idempotencia de alertas temporales se preserva: una segunda evaluacion
  no duplica alertas abiertas ni eventos `ALERT_CREATED`.
- No se modificaron reglas clinicas, umbrales, razones ni severidades.
- El defecto detectado en `complete_task` queda pendiente como correccion
  separada.

### Verificacion

- Prueba backend de regresion para confirmar que `GET /supervisor/dashboard`
  no modifica `alerts` ni `events`.
- Prueba backend para confirmar que `POST /rules/evaluate` conserva la
  evaluacion explicita y no duplica alertas.
- Pruebas frontend para los botones de supervisor, la llamada explicita a
  `POST /rules/evaluate`, la consulta posterior del dashboard y el manejo de
  errores visible.

---

## Etapa 1 — Base funcional

### Implementado

- Backend con FastAPI.
- Base de datos SQLite.
- Autenticación simple mediante token.
- Roles:
  - recepción;
  - enfermería;
  - médico;
  - laboratorio;
  - supervisor.
- Creación de pacientes.
- Creación de episodios clínicos activos.
- Generación de token aleatorio para pulsera QR.
- Dashboard de pacientes activos.
- Registro de eventos auditables.
- Cierre de episodio mediante alta médica.

### Verificación

- API disponible en `/docs`.
- Health check disponible en `/health`.
- Frontend compilado mediante Vite.
- Flujo manual verificado desde recepción hasta alta.

---

## Etapa 2 — Signos vitales y alertas

### Implementado

- Registro de:
  - temperatura;
  - frecuencia cardíaca;
  - presión arterial;
  - saturación de oxígeno;
  - frecuencia respiratoria.
- Motor de reglas clínicas inicial.
- Alerta por saturación baja.
- Alerta por frecuencia cardíaca alta.
- Alerta por fiebre alta.
- Estados de alerta:
  - ACTIVE;
  - ACKNOWLEDGED;
  - ESCALATED;
  - RESOLVED.
- Auditoría de acciones sobre alertas.

### Verificación

- Registro manual de signos anormales.
- Generación automática de tres alertas.
- Reconocimiento y escalamiento por enfermería.
- Resolución por médico.
- Eventos visibles en el timeline.

---

## Etapa 3 — Pruebas automáticas

### Implementado

- Prueba integral del flujo clínico.
- Prueba de permisos por rol.
- GitHub Actions.
- Compilación automática del frontend.
- Ejecución automática de pruebas del backend.

### Verificación

- Dos pruebas locales aprobadas.
- Workflow de GitHub Actions aprobado.
- Estado verde en la rama `main`.

---

## Etapa 4 — Triaje y asignación

### Implementado

- Formulario de triaje para enfermería y supervisor.
- Cambio de prioridad.
- Cambio de área o ubicación.
- Asignación de personal responsable.
- Evento `TRIAGE` en el timeline.

### Verificación

- Paciente movido a Área de choque.
- Prioridad actualizada a P1.
- Personal asignado a Enfermería A.
- GitHub Actions aprobado.

---

## Etapa 5 — Evaluación médica

### En desarrollo

- Registro de nota clínica.
- Registro de diagnóstico.
- Decisión médica:
  - continuar observación;
  - ordenar pruebas;
  - preparar alta.
- Evento `MEDICAL_EVALUATION` en el timeline.
- Restricción exclusiva para el rol médico.

### Verificación pendiente

- Prueba automática del endpoint.
- Formulario de evaluación médica en React.
- Compilación del frontend.
- GitHub Actions.

---

## Etapa 6 — Órdenes clínicas

### Implementado

- Formulario de órdenes exclusivo para el rol médico.
- Creación de órdenes para:
  - laboratorio;
  - enfermería;
  - equipo médico.
- Estado inicial `PENDING`.
- Visualización de la orden en tareas pendientes.
- Registro automático del evento `TASK_CREATED`.
- Asociación de cada orden con un episodio clínico activo.

### Flujo implementado

1. El médico abre un episodio activo.
2. Registra una evaluación médica.
3. Crea una orden clínica.
4. Selecciona el servicio responsable.
5. La orden aparece como tarea pendiente.
6. El evento queda registrado en el timeline.

### Verificación manual

- Se creó la orden `Hemograma completo`.
- La orden fue asignada al servicio `LAB`.
- La orden apareció en tareas pendientes.
- El evento `TASK_CREATED` apareció en el timeline.
- El frontend compiló correctamente.

### Próxima etapa

- Crear una bandeja exclusiva para laboratorio.
- Permitir registrar un resultado simulado.
- Completar la orden como usuario de laboratorio.
- Mostrar el resultado en el timeline.

---

## Etapa 7 — Bandeja de laboratorio

### Implementado

- Endpoint exclusivo para laboratorio y supervisor.
- Consulta de órdenes pendientes.
- Consulta de órdenes completadas.
- Filtro por estado:
  - `PENDING`;
  - `COMPLETED`;
  - `ALL`.
- Información operativa incluida:
  - paciente;
  - episodio;
  - prioridad;
  - ubicación;
  - orden;
  - resultado;
  - estado.
- Restricción de acceso para recepción, enfermería y médico.

### Decisión de seguridad

La bandeja no devuelve el token QR ni información clínica que no sea
necesaria para ejecutar la orden. El acceso se controla mediante roles.

### Verificación

- Endpoint `/lab/orders` visible en Swagger.
- Tres pruebas automáticas aprobadas.
- Acceso permitido para laboratorio y supervisor.
- Acceso rechazado para recepción.
- Bandeja React compilada correctamente.
- Orden pendiente visible para laboratorio.
- Resultado simulado publicado desde la interfaz.
- Orden retirada de pendientes después de completarse.
- Evento `TASK_COMPLETED` registrado en el timeline.

### Flujo validado

1. El médico crea una orden de laboratorio.
2. La orden queda con estado `PENDING`.
3. Laboratorio abre su bandeja.
4. Laboratorio registra un resultado.
5. La orden cambia a `COMPLETED`.
6. El resultado se conserva en la tarea.
7. La acción genera un evento auditable.

---

## Etapa 8 — Centro de control del supervisor

### Implementado
- Endpoint exclusivo para supervisor.
- Indicadores operacionales:
  - pacientes activos;
  - pacientes de prioridad alta;
  - pacientes en riesgo;
  - alertas abiertas;
  - tareas pendientes.
- Tiempo transcurrido desde el ingreso.
- Conteo de alertas por paciente.
- Conteo de tareas pendientes por paciente.
- Clasificación operacional de riesgo.
- Restricción de acceso por rol.

### Regla de riesgo inicial

Un paciente se considera en riesgo cuando:

- tiene prioridad P1 o P2; o
- tiene al menos una alerta sin resolver.

### Verificación

- Endpoint `/supervisor/dashboard` visible en Swagger.
- Acceso restringido al rol supervisor.
- Cuatro pruebas automáticas aprobadas.
- Indicadores operacionales visibles.
- Tiempo de espera calculado por paciente.
- Pacientes P1 y P2 identificados.
- Pacientes con alertas identificados.
- Conteo de tareas pendientes visible.
- Filtros operacionales funcionales.
- Acceso rápido al episodio desde la tabla.
- Frontend compilado correctamente.

### Filtros disponibles

- Todos los pacientes activos.
- Pacientes en riesgo.
- Pacientes con prioridad P1 o P2.
- Pacientes con alertas abiertas.

### Criterio inicial de riesgo

El indicador `REQUIERE ATENCIÓN` se muestra cuando:

- la prioridad es P1 o P2; o
- existe al menos una alerta sin resolver.

---

## Etapa 9 — Motor de reglas temporales

### Implementado

El motor evalúa todos los episodios activos y crea alertas
automáticas cuando detecta demoras operacionales.

### Reglas implementadas

#### Triaje demorado

- Condición: episodio activo sin evento `TRIAGE`.
- Umbral: más de 30 minutos desde el ingreso.
- Severidad: `HIGH`.
- Motivo: `Tiempo de espera de triaje excedido`.

#### Tarea pendiente excedida

- Condición: tarea con estado `PENDING`.
- Umbral: más de 60 minutos desde su creación.
- Severidad: `HIGH`.
- Motivo: `Tarea pendiente con tiempo excedido`.

#### Paciente prioritario sin actualización

- Condición: paciente con prioridad P1 o P2.
- Umbral: más de 15 minutos sin eventos clínicos u operacionales.
- Severidad: `CRITICAL`.
- Motivo: `Paciente prioritario sin actualización reciente`.

### Prevención de duplicados

Antes de crear una alerta, el motor comprueba que no exista otra
alerta abierta con el mismo motivo para el mismo episodio.

Una segunda ejecución no duplica alertas que continúan en estado
`ACTIVE`, `ACKNOWLEDGED` o `ESCALATED`.

### Eventos que no cuentan como seguimiento

Los eventos `ALERT_CREATED` generados por el propio motor no se
consideran una actualización clínica del paciente.

Esto evita que la generación automática de una alerta reinicie
incorrectamente el tiempo de seguimiento de un paciente prioritario.

### Auditoría

Cada alerta temporal genera el evento:

```text
ALERT_CREATED
```

El usuario técnico registrado es:

```text
time-rules-engine
```

### Formas de ejecución

- Ejecución manual mediante `POST /rules/evaluate`.
- Ejecución automática al abrir el panel del supervisor.

### Verificación

- Endpoint `/rules/evaluate` visible en Swagger.
- Regla de triaje demorado verificada.
- Regla de tarea pendiente excedida verificada.
- Regla de paciente prioritario sin actualización verificada.
- Prevención de duplicados verificada.
- Cinco pruebas automáticas aprobadas durante esta etapa.
- Resultado del motor visible en el panel del supervisor.

---

## Etapa 10 — Datos de demostración

### Implementado

- Generador de doce pacientes ficticios.
- Diez episodios activos.
- Dos episodios cerrados.
- Prioridades P1 a P5.
- Diferentes áreas y ubicaciones.
- Personal responsable asignado.
- Signos vitales ficticios.
- Alertas activas para pacientes prioritarios.
- Tareas de enfermería.
- Órdenes de laboratorio.
- Resultados simulados.
- Eventos auditables.
- Botón exclusivo para supervisor.

### Comportamiento aditivo

La carga de demostración conserva los pacientes creados manualmente.

No se eliminan:

- pacientes;
- episodios;
- alertas;
- tareas;
- eventos;
- resultados.

### Prevención de duplicados

Los pacientes ficticios utilizan documentos con el prefijo:

```text
DEMO-SEED-
```

Antes de crear datos, el servidor comprueba si ese prefijo ya existe.

Una segunda ejecución informa:

```text
Los datos de demostración ya existen
```

y no crea pacientes adicionales.

### Seguridad

- Solo el supervisor puede ejecutar `/demo/seed`.
- Recepción recibe una respuesta `403`.
- El endpoint no está disponible para enfermería, médico o laboratorio.

### Verificación

- Endpoint `/demo/seed` visible en Swagger.
- Se crean exactamente doce pacientes ficticios.
- Se conservan los pacientes creados manualmente.
- Se crean diez episodios activos.
- Se crean dos episodios cerrados.
- Una segunda ejecución no duplica datos.
- Seis pruebas automáticas aprobadas.
- El frontend compila correctamente.
- Los pacientes activos aparecen en el panel del supervisor.

---

## Etapa 11 — Manejo de sesión expirada

### Implementado

- Detección de respuestas HTTP `401`.
- Eliminación automática del token inválido.
- Aviso claro al usuario.
- Recarga automática de la aplicación.
- Retorno a la pantalla de inicio de sesión.
- Posibilidad de iniciar una sesión nueva.

### Motivo

Los tokens del demo se almacenan temporalmente en la memoria del
backend.

Cuando FastAPI se reinicia, los tokens emitidos anteriormente dejan
de existir. El navegador, sin embargo, puede conservar el token
anterior en `localStorage`.

Esto provocaba el mensaje:

```text
Sesión requerida
```

sin regresar automáticamente al login.

### Solución implementada

Cuando el cliente recibe una respuesta HTTP `401` y existe un token:

1. elimina el token de `localStorage`;
2. muestra el mensaje de sesión expirada;
3. recarga la aplicación;
4. presenta nuevamente la pantalla de login.

Las credenciales incorrectas durante el login continúan mostrando el
error normal de autenticación.

### Verificación

- Frontend compilado correctamente.
- Backend reiniciado manualmente.
- Respuesta `401` detectada por el cliente API.
- Token inválido eliminado de `localStorage`.
- Mensaje de sesión expirada mostrado.
- Retorno automático al login.
- Nuevo inicio de sesión realizado correctamente.

---

## Etapa 12 — Historial de episodios cerrados

### Implementado

- Endpoint `/episodes/history`.
- Consulta separada de la operación activa.
- Orden por fecha de cierre.
- Información incluida:
  - paciente;
  - documento;
  - prioridad;
  - ubicación final;
  - responsable;
  - fecha de ingreso;
  - fecha de cierre;
  - cantidad de eventos;
  - cantidad de alertas;
  - cantidad de tareas.
- Acceso para:
  - recepción;
  - médico;
  - supervisor.
- Acceso rechazado para enfermería y laboratorio.

### Objetivo

Permitir la consulta de episodios finalizados sin volver a activarlos
ni mezclarlos con el dashboard operacional.

### Verificación

- Endpoint `/episodes/history` visible en Swagger.
- Siete pruebas automáticas aprobadas.
- Acceso permitido para recepción, médico y supervisor.
- Acceso rechazado para enfermería.
- Pantalla de historial compilada correctamente.
- Nora Paz visible como episodio cerrado.
- Iván Soto visible como episodio cerrado.
- Timeline histórico disponible.
- Los episodios cerrados no aparecen en el dashboard activo.
- Los formularios clínicos quedan deshabilitados al estar cerrado.


---

## Etapa 13 — Historial visual de alertas

### Implementado

- Historial de cambios incluido dentro de cada alerta.
- Visualización separada de alertas activas y resueltas.
- Contador de alertas activas.
- Contador de alertas resueltas.
- Sección plegable para consultar las alertas resueltas.
- Sección plegable para consultar el historial de cada alerta.
- Visualización del estado anterior y el estado nuevo.
- Visualización del usuario responsable de cada transición.
- Visualización de la fecha y hora de cada transición.
- Las alertas resueltas permanecen disponibles para consulta.
- Las alertas resueltas no muestran botones de acción.

### Flujo validado

```text
ACTIVE → ACKNOWLEDGED → RESOLVED
```

El reconocimiento y la resolución quedan registrados como transiciones
independientes dentro del historial de la alerta.

Ejemplo:

```text
ACTIVE → ACKNOWLEDGED
medico · fecha y hora

ACKNOWLEDGED → RESOLVED
medico · fecha y hora
```

### Comportamiento de las acciones

- El botón `Reconocer` solamente aparece cuando la alerta está en estado
  `ACTIVE`.
- El botón `Escalar` aparece cuando la alerta está en estado `ACTIVE` o
  `ACKNOWLEDGED`.
- El botón `Resolver` solamente está disponible para médico o supervisor.
- Las alertas con estado `RESOLVED` se muestran en una sección separada y no
  permiten nuevas acciones desde la interfaz.

### Compatibilidad de fechas

La interfaz acepta las propiedades temporales:

```text
created_at
at
```

Esto permite mostrar el historial aunque el nombre de la columna temporal
difiera entre versiones de la base de datos.

### Diseño responsive

- Las transiciones se muestran como elementos separados.
- El usuario y la fecha aparecen debajo de cada cambio de estado.
- En pantallas pequeñas, los botones ocupan todo el ancho disponible.
- Los historiales pueden abrirse y cerrarse mediante elementos `details`.

### Verificación manual

Se confirmó que:

1. una alerta activa puede ser reconocida;
2. el historial muestra `ACTIVE → ACKNOWLEDGED`;
3. médico puede resolver la alerta;
4. el historial muestra `ACKNOWLEDGED → RESOLVED`;
5. la alerta resuelta se mueve a la sección `Alertas resueltas`;
6. el historial conserva el usuario y la fecha;
7. las secciones plegables pueden abrirse y cerrarse;
8. el frontend compila correctamente.

---

## Etapa 14 — Máquina de estados de alertas

### Implementado

Se agregó una máquina de estados para controlar las transiciones permitidas
de las alertas clínicas y operacionales.

### Transiciones permitidas

```text
ACTIVE → ACKNOWLEDGED
ACTIVE → ESCALATED
ACKNOWLEDGED → ESCALATED
ACKNOWLEDGED → RESOLVED
ESCALATED → RESOLVED

---

## Etapa 15 — Restauración y cierre de sesión

### Implementado

- Endpoint `GET /auth/me`.
- Endpoint `POST /auth/logout`.
- Validación del token almacenado al abrir la aplicación.
- Restauración automática del usuario y su rol.
- Pantalla temporal `Restaurando sesión`.
- Cierre de sesión en backend y frontend.
- Eliminación local del token al cerrar sesión.
- Limpieza de datos clínicos cargados al cerrar sesión.
- Retorno automático al login cuando el token deja de ser válido.

### Restauración

Cuando existe un token almacenado, el frontend consulta:

```text
GET /auth/me

---

## Etapa 16 — Usuarios persistentes y contraseñas protegidas

### Implementado

- Tabla `users` almacenada en SQLite.
- Nombre de usuario único.
- Rol persistente por usuario.
- Estado activo o inactivo.
- Contraseñas almacenadas mediante hash PBKDF2-SHA256.
- Sal aleatoria independiente para cada usuario.
- Comparación segura mediante `secrets.compare_digest`.
- Login conectado a la tabla `users`.
- Carga idempotente de los cinco usuarios de demostración.
- Migración SQL documentada en `backend/migrations/001_users.sql`.

### Estructura de usuario

Cada usuario almacena:

- `username`;
- `password_hash`;
- `password_salt`;
- `role`;
- `active`;
- `created_at`.

La contraseña original no se guarda en la tabla.

### Protección de contraseñas

El sistema utiliza:

```text
PBKDF2-HMAC-SHA256

---

## Etapa 17 — Sesiones persistentes con expiración

### Implementado

- Sesiones almacenadas en SQLite.
- Duración predeterminada de ocho horas.
- Token aleatorio entregado al navegador.
- Hash SHA-256 del token almacenado en la base de datos.
- Restauración de sesión después de reiniciar FastAPI.
- Revocación persistente al cerrar sesión.
- Invalidación automática de sesiones vencidas.
- Migración `backend/migrations/002_sessions.sql`.

### Seguridad

El token original no se almacena en SQLite. El servidor conserva:

- usuario asociado;
- hash del token;
- fecha de creación;
- fecha de expiración;
- fecha de revocación.

### Flujo

```text
Login
→ creación del token
→ almacenamiento de su hash
→ validación en cada petición
→ expiración o logout
→ revocación

---

## Etapa 18 — Integridad de episodios clínicos

### Implementado

- Función central para validar episodios activos.
- Rechazo de modificaciones sobre episodios cerrados.
- Prevención de altas repetidas.
- Prevención de tareas completadas más de una vez.
- Validación de rangos plausibles de signos vitales.
- Protección de triaje, signos, alertas, evaluaciones y órdenes.

### Operaciones bloqueadas después del alta

Un episodio con estado `CLOSED` no acepta:

- nuevo triaje;
- nuevos signos vitales;
- nuevas evaluaciones médicas;
- nuevas órdenes o tareas;
- finalización de tareas;
- cambios en alertas;
- una segunda alta.

Estas operaciones responden:

```text
409 El episodio está cerrado

---

## Etapa 19 — Ciclo de vida moderno de FastAPI

### Implementado

- Migración de `@app.on_event("startup")` a `lifespan`.
- Inicialización de SQLite durante el ciclo de vida de FastAPI.
- Compatibilidad con `TestClient`.
- Eliminación de advertencias deprecadas generadas por la aplicación.
- Conservación del comportamiento existente.

### Cambio técnico

El inicio anterior:

```python
@app.on_event("startup")
def startup() -> None:
    initialize_database()

    ---

## Etapa 20 — Pruebas automatizadas del frontend

### Implementado

- Vitest como ejecutor de pruebas.
- Entorno jsdom.
- React Testing Library.
- Extensiones de jest-dom.
- Simulación de interacción mediante user-event.
- Limpieza automática después de cada prueba.
- Comandos `npm run test` y `npm run test:watch`.
- Ejecución de pruebas frontend en GitHub Actions.

### Pruebas iniciales

Se verifica que:

- aparece la pantalla de inicio de sesión;
- aparecen los cinco roles;
- aparece el botón `Entrar`;
- los errores del backend se presentan al usuario;
- el formulario utiliza `/auth/login`.

### Resultado

```text
Test Files: 1 passed
Tests: 2 passed

---

## Etapa 21 — Tipado y saneamiento de ESLint

### Implementado

- Modelos TypeScript explícitos para datos clínicos y operacionales.
- Eliminación de todos los usos explícitos de `any`.
- Cliente API genérico con respuestas tipadas.
- Tipado del dashboard.
- Tipado de episodios, signos vitales, alertas y transiciones.
- Tipado de tareas y eventos.
- Tipado del panel de supervisor.
- Tipado de la bandeja de laboratorio.
- Tipado del historial de episodios.
- Reorganización de efectos de React.
- Integración de ESLint en GitHub Actions.

### Modelos añadidos

- `VitalSigns`;
- `ClinicalAlert`;
- `AlertHistoryEntry`;
- `ClinicalTask`;
- `TimelineEvent`;
- `Episode`;
- `DashboardData`;
- `SupervisorData`;
- `LaboratoryQueue`;
- `HistoryData`.

### Efectos de React

Los efectos de restauración y carga del dashboard ahora:

- realizan actualizaciones dentro de operaciones asíncronas;
- evitan actualizaciones después del desmontaje;
- utilizan una bandera `cancelled`;
- limpian correctamente sus operaciones.

### Resultado

```text
ESLint: 0 errores
Frontend: 2 pruebas aprobadas
Backend: 12 pruebas aprobadas
Build: aprobado

---

## Etapa 22 — Separación del cliente API y tipos frontend

### Implementado

- Cliente HTTP extraído desde `App.tsx` hacia `frontend/src/api/client.ts`.
- Contratos de dominio, API y datos clínicos extraídos hacia
  `frontend/src/types/clinical.ts`.
- Importación de modelos mediante `import type`.
- Conservación de `EpisodePageProps` en `App.tsx` por ser un tipo local de
  presentación del componente `EpisodePage`.
- Confirmación de que `client.ts` está correctamente codificado en UTF-8.
- Reducción de responsabilidades y tamaño de `App.tsx`.
- Conservación del comportamiento funcional existente.

### Resultado

```text
ESLint: 0 errores
Frontend: 2 pruebas aprobadas
Backend: 12 pruebas aprobadas
Build: aprobado
Advertencias backend: se mantienen únicamente las ya conocidas

---

## Etapa 23 - Validación local reproducible y tareas de VS Code

### Implementado

- Script `scripts/validate.ps1` para ejecutar la validación local completa en
  Windows.
- Resolución de la raíz del repositorio desde la ubicación del script.
- Uso del Python local `.\.venv\Scripts\python.exe`.
- Uso de `npm.cmd` para evitar bloqueos de PowerShell con `npm.ps1`.
- `PYTHONPATH` apuntando a `backend`.
- Directorio temporal controlado `.tmp\pytest` mediante `--basetemp`.
- Tareas de VS Code para validación completa, pruebas, lint, build e inicio
  local de backend y frontend.
- Exclusión de `.tmp/` en Git.

### Alcance

La etapa mejora la experiencia de desarrollo y la reproducibilidad local.
No cambia el comportamiento clínico ni operacional de la aplicación.

### Resultado

```text
Backend: 12 pruebas aprobadas
Frontend: 2 pruebas aprobadas
ESLint: 0 errores
Build: aprobado
```

---

## Etapa 24 - Mantenimiento preventivo de GitHub Actions

### Implementado

- Runner de CI fijado en `ubuntu-24.04` para evitar cambios implícitos durante
  la migración de `ubuntu-latest`.
- `actions/checkout` actualizado a `v5`, compatible con runtime Node 24.
- `actions/setup-python` actualizado a `v6`, compatible con runtime Node 24.
- `actions/setup-node` actualizado a `v5`, compatible con runtime Node 24.
- Python 3.12 conservado para backend.
- Node.js 22 conservado para frontend.
- Cachés, rutas de lockfiles y comandos de validación conservados.

### Alcance

Mantenimiento preventivo de CI ante la deprecación de Node 20 en GitHub
Actions. No cambia dependencias de aplicación ni comportamiento funcional.

---

## Etapa 25 - Modernización de setup-node

### Implementado

- `actions/setup-node` actualizado de `v5` a `v7`.
- Eliminación esperada de las advertencias internas `DEP0040` y `DEP0169`
  generadas por dependencias empaquetadas de la acción.
- Node.js 22 conservado para frontend.
- Cache npm conservada con `frontend/package-lock.json` como ruta de
  dependencia.
- Runner de CI conservado en `ubuntu-24.04`.

### Alcance

Mantenimiento de CI sin cambios funcionales en la aplicación. No se modifican
dependencias de frontend, dependencias de backend ni código de aplicación.

---

## Etapa 26 - Baseline seguro minimo de Codex

### Implementado

- Configuracion Codex minima versionada en `.codex/config.toml`.
- Aprobacion bajo demanda mediante `approval_policy = "on-request"`.
- Escritura limitada al workspace mediante `sandbox_mode = "workspace-write"`.
- Red desactivada dentro del sandbox mediante
  `sandbox_workspace_write.network_access = false`.
- Sin fijar opciones adicionales.

### Alcance

Baseline compartido de seguridad para Codex a nivel de proyecto. No cambia el
comportamiento funcional de la aplicacion ni modifica codigo, dependencias,
workflow o tareas de VS Code.

---

## Etapa 27 - Dependabot limitado a GitHub Actions

### Implementado

- Configuracion `.github/dependabot.yml` exclusiva para `github-actions`.
- Revision semanal de actualizaciones de acciones.
- Rama objetivo `main`.
- Limite de cinco pull requests abiertos para actualizaciones de version.
- Sin auto-merge.
- Sin ecosistemas `npm` ni `pip`.
- Sin configuracion de credenciales, registries privados, reviewers,
  assignees, labels o agrupaciones.

### Alcance

Mantenimiento automatizado y revisable de acciones oficiales de GitHub Actions.
No cambia el comportamiento funcional de la aplicacion, no actualiza acciones
existentes y no modifica dependencias de frontend o backend.
