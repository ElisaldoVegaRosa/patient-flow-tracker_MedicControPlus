# Plan de MedicControl+

Plan reconstruido propuesto; no recuperado del chat original

## Estado y autorización

- Etapa 28 cerrada: validación funcional completada y episodios CLOSED de
  solo lectura.
- Etapa 29 cerrada y publicada: nota de alta editable para DOCTOR en ACTIVE.
  Commit `f35770638a7482a363c38e253ba33c86e5abb28c`; CI aprobada,
  ejecución `37244485263`. Resultados confirmados del cierre: backend,
  14 pruebas; frontend, 18 pruebas; lint y build aprobados.
- Este documento registra una propuesta. La implementación de cada tarea
  queda pendiente de aprobación explícita; documentar el plan no la autoriza.
- Las etapas 30–33 son refactorizaciones que deben conservar el comportamiento.
  Las nuevas funcionalidades y los cambios de comportamiento se tratarán en
  tareas separadas, con alcance y aprobación propios.
- Etapa 30 cerrada tras 30A–30I; cierre documental publicado en `9ed4dbf`,
  CI `37726240159` aprobada. Validación vigente: 46 pruebas frontend,
  lint y build aprobados; CI `37725349264` y `37725456535` aprobadas.
- Etapa 31 cerrada tras 31A–31C: 19 pruebas backend aprobadas;
  CI `37857021915` y `37857173485` aprobadas.
- Los criterios de las etapas 32–37 son requisitos futuros; esta revisión
  no ejecuta pruebas nuevas ni autoriza su implementación.

## Entrega 30A

- Cerrada y publicada: extracción de `EpisodeHistoryPage`
  con `historyData`, `onRefresh` y `onOpenEpisode` como props.
- Conserva `HistoryData`, CSS y presentación; la lógica y las llamadas API
  permanecen en `App.tsx`.
- Cobertura añadida para historial vacío y actualización del historial;
  se conserva la prueba de consulta posterior al alta.
- Validaciones locales: 20 pruebas frontend, lint y build aprobados;
  `git diff --check` sin errores. Commit
  `a77970cfa653af7b72254573063f2d5445ed9ee3`; CI `37716248936` aprobada.
- Esta entrega no completa la Etapa 30. La siguiente entrega requiere definir
  su alcance y aprobar la tarea antes de implementarla.

## Entrega 30B

- Alcance aprobado: extraer la pantalla «Escanear pulsera» a `ScanPage`, sin
  estado propio; conservar formulario, textos, estilos y campo obligatorio.
- Cerrada y publicada. Consulta API, errores, permisos y navegación
  permanecen en `App.tsx`; sin cambios de comportamiento.
- Prueba añadida para el rechazo de la consulta, manteniendo el formulario;
  se conservan los casos existentes de apertura de episodios por token.
- Validaciones locales: 21 pruebas frontend, lint y build aprobados;
  `git diff --check` sin errores.
- Commit `37864c1a4dfd027c0796bb7aaaee846451c70b40`; CI `37717881092`
  aprobada. No completa la Etapa 30 ni autoriza la implementación de las
  siguientes entregas.

## Entrega 30C

- Entrega cerrada y publicada: extracción de «Registrar llegada»
  a `NewEpisodePage`, sin estado propio y con callback `onSubmit`.
- Campos, textos, valores iniciales y estilos conservados. Creación del episodio,
  API, errores, permisos y navegación permanecen en `App.tsx`.
- Pruebas añadidas de ingreso correcto y rechazo de la API.
- Validaciones: 23 pruebas frontend, lint y build aprobados; diff revisado y
  `git diff --check` sin errores.
- Commit `466cc5efc592106e576db305747593a3ec726df5`; CI `37718612913`
  aprobada. No completa la Etapa 30; las siguientes entregas requieren aprobación.

## Entrega 30D

- Entrega cerrada y publicada: extracción del centro de control
  general a `DashboardPage`, con datos y callbacks; sin estado propio.
- Indicadores, cálculos, tabla, estado vacío y acciones conservados. Carga, API,
  errores, permisos y navegación permanecen en `App.tsx`.
- Pruebas de integración para indicadores, apertura del paciente y actualización.
- Validaciones locales: 25 pruebas frontend, lint y build aprobados;
  `git diff --check` sin errores.
- Commit `3a4616125d3733168b60a8bafc1aacaf41b8b41d`; CI `37719496231`
  aprobada, según el resumen de continuidad.
- No completa la Etapa 30; las siguientes entregas requieren aprobación.

## Entrega 30E: LaboratoryPage

- Entrega cerrada y publicada: bandeja «Órdenes pendientes» extraída a
  `frontend/src/pages/LaboratoryPage.tsx`, sin estado propio.
- Props: `laboratoryQueue`, `onRefresh` y `onCompleteOrder`
  (evento del formulario e identificador de orden). Reutiliza `LaboratoryQueue`
  existente en `frontend/src/types/clinical.ts`.
- Conserva contador, estado vacío, tarjetas, textos, CSS y validación
  del resultado (`required` y `minLength`).
- Mantiene carga, API, errores, permisos, navegación y publicación en
  `App.tsx`, mediante los callbacks existentes.
- Siete casos nuevos de integración: bandeja vacía y actualización, presentación de órdenes,
  envío correcto, rechazo de publicación y acceso por los roles permitidos.
- Validación local: 32 pruebas frontend, lint y build aprobados.
- Commit `e0cc198ff117d118aee39bc2a9afe46b658412cb`; CI `37721355298`
  aprobada con pruebas backend, frontend, lint y build.
  La Etapa 30 permanece abierta; las siguientes entregas requieren aprobación.

## Entrega 30F: SupervisorPage

- Entrega cerrada y publicada: extracción del centro de
  control del supervisor a `frontend/src/pages/SupervisorPage.tsx`.
- Sin estado propio. Recibe `supervisorData`, `supervisorFilter`,
  `rulesMessage`, `evaluatingRules` y callbacks `onLoadDemo`,
  `onEvaluateRules`, `onRefresh`, `onFilterChange` y `onOpenEpisode`.
- Conserva indicadores, tabla, filtros, textos, acciones y CSS. Reutiliza
  `SupervisorData`; estado, API, errores, permisos y navegación siguen en `App.tsx`.
- Seis casos nuevos cubren filtros, indicadores, apertura, actualización
  y acceso por rol; conservadas las pruebas de reglas temporales.
- Validación local: 38 pruebas frontend, lint y build aprobados.
- Commit `d700a5aa0e7acb0a398eadc11b7a9efc54086ebf`; CI `37723480808` aprobada.
  La Etapa 30 continúa abierta.

## Entrega 30G: EpisodePage

- Entrega cerrada y publicada: traslado del componente
  existente a `frontend/src/pages/EpisodePage.tsx`.
- Conserva sus props `episode`, `user`, `updateEpisode` y `showError`,
  estado local, llamadas API, permisos, formularios y presentación.
- A diferencia de las pantallas anteriores, este componente ya contenía
  lógica propia: se conserva dentro de `EpisodePage` sin redistribuirla.
- `App.tsx` mantiene sesión, navegación y episodio seleccionado; importa la página.
- Validación local: 38 pruebas frontend, lint y build aprobados.
  Conservadas las pruebas ACTIVE/CLOSED por rol y de alta médica.
- Commit `7cf60c706131da9f9f0e9207639e609989010ec7`; CI `37724043270` aprobada.
  La Etapa 30 continúa abierta.

## Entrega 30H: LoginPage

- Entrega cerrada y publicada: extracción del formulario
  de acceso y de la vista «Restaurando sesión» a `frontend/src/pages/LoginPage.tsx`.
- Props `restoringSession`, `error` y `onSubmit`; sin estado propio.
- Conserva formulario, cinco usuarios demo, valores iniciales, textos y CSS.
- Autenticación, restauración, token y errores permanecen en `App.tsx`.
- Tres casos nuevos de integración: ingreso correcto, restauración correcta
  y fallo de restauración; se conserva la cobertura de credenciales rechazadas.
- Validación local: 41 pruebas frontend, lint y build aprobados.
- Commit `18841e97464e3aa38ab91a0b98d88a6661abb93f`; CI `37724737074` aprobada.
  La Etapa 30 continúa abierta.

## Entrega 30I: AppHeader

- Entrega cerrada y publicada: extracción de la cabecera
  a `frontend/src/components/AppHeader.tsx`, sin estado propio.
- Recibe `user` y callbacks `onDashboard`, `onSupervisor`, `onScan`,
  `onHistory`, `onLaboratory`, `onNewEpisode` y `onLogout`.
- Conserva botones, identidad, visibilidad por rol, textos y CSS.
  Navegación, sesión y API permanecen en `App.tsx`.
- Cinco casos nuevos cubren botones visibles y acciones de los cinco roles.
- Validación local: 46 pruebas frontend, lint y build aprobados.
- Commit `a80d42c5394930579f43491ff47bfd57b11cc2f9`; CI `37725349264` aprobada.
  La Etapa 30 continúa abierta; revisar sus criterios de cierre.

## Revisión de cierre de Etapa 30

- Ocho páginas extraídas y cabecera compartida separada.
- `App.tsx` conserva la composición general, sesión, navegación y datos.
- Comportamiento, permisos y pruebas conservados según las entregas aprobadas.
- Cliente HTTP en `frontend/src/api/client.ts` y tipos en
  `frontend/src/types/clinical.ts`. `EpisodePage` conserva su lógica existente.
- No se requiere otra extracción para cumplir este alcance. Cierre documental
  publicado en `9ed4dbf`, CI `37726240159` aprobada; las referencias anteriores a Etapa 30
  abierta describen el estado histórico de cada entrega.

## Entrega 31A: configuración del backend

- Entrega cerrada y publicada: `backend/app/config.py` con
  `DATABASE_PATH`, `DEMO_USERS`, `PASSWORD_HASH_ITERATIONS` y
  `SESSION_DURATION_HOURS`, conservando valores y ruta efectiva de SQLite.
- Importadas en `main.py`; se conserva `main.DATABASE_PATH` como punto
  de sustitución usado por las pruebas con SQLite temporal.
- Conexiones, inicialización, autenticación, CORS y rutas permanecen en
  `main.py`; sin cambios de endpoints, esquema ni datos.
- Validación: 16 pruebas backend aprobadas, con tres advertencias conocidas,
  usando Python local y SQLite temporal. Dos pruebas nuevas de ruta y sustitución.
- Constantes y funciones conservadas; sin acceso a la base demo durante la validación.
- Commit `26a6567758c4ad324d642307e86524e6f760b5e9`; CI `37727047490` aprobada.
  La Etapa 31 continúa abierta.

## Entrega 31B: conexiones SQLite

- Entrega cerrada y publicada: creación de conexiones en
  `backend/app/database.py`, mediante `get_connection(database_path)`.
- Conserva `sqlite3.Row` y `PRAGMA foreign_keys = ON`.
- Wrapper `main.get_connection()` pasa `main.DATABASE_PATH`, conservando
  la sustitución existente en pruebas; inicialización, consultas y rutas intactas.
- Dos pruebas nuevas de filas por nombre, integridad referencial y aislamiento
  entre bases. Conservada la cobertura del wrapper con ruta temporal.
- Validación: 18 pruebas backend aprobadas, tres advertencias conocidas.
- Commit `376d59d85143371af407139f8ec459ced3e6dec5`; CI `37727737285` aprobada.
  La Etapa 31 continúa abierta.

## Entrega 31C: inicialización SQLite

- Entrega cerrada y publicada: inicialización del esquema
  y usuarios demo en `database.initialize_database`.
- Recibe conexión, usuarios demo, función de hash y función de fecha;
  sin dependencias circulares. SQL, commit y cierre de conexión conservados.
- Wrapper `main.initialize_database()` y arranque FastAPI conservados.
- Prueba nueva de reinicialización sin duplicados ni pérdida de esquema,
  usuarios, sesiones o episodios.
- Validación: 19 pruebas backend aprobadas fuera del sandbox, una advertencia
  observada; temporal `.tmp/pytest-31c-verified` por problemas del temporal habitual.
- Commit `1838e5716892106d30ea6b40000c9e8c5a551b24`; CI `37857021915` aprobada.
  La Etapa 31 continúa abierta; revisar sus criterios de cierre.

## Revisión de cierre de Etapa 31

- Configuración en `config.py`; conexiones e inicialización en `database.py`.
- Wrappers y arranque en `main.py` conservados; ruta SQLite, esquema,
  datos y endpoints preservados según los alcances aprobados.
- Criterios cumplidos con las validaciones de 31C; sin nueva ejecución de pruebas.
- Referencias anteriores a Etapa 31 abierta conservadas como estado histórico.

## Entrega 32A: hash y verificación

- Entrega cerrada y publicada: `hash_session_token`, `hash_password` y `verify_password`
  a `backend/app/security.py`, conservando SHA-256, PBKDF2, sal aleatoria,
  iteraciones, comparación y formatos de retorno actuales.
- Usa la constante existente de `config.py`; mantiene las funciones
  accesibles desde `main.py` para consumidores y pruebas actuales.
- Validación de sesiones, dependencias de roles y endpoints permanecen en `main.py`.
- Tres pruebas nuevas de formatos, verificación correcta/incorrecta, sal aleatoria,
  compatibilidad con hashes existentes y acceso desde `main.py`.
- Validación: 22 pruebas backend aprobadas fuera del sandbox, una advertencia;
  SQLite temporal en `.tmp/pytest-32a-verified`.
- Commit `4c85e9c8e2abefdbc3b9e3adef9d98e8e22f8af9`; CI `37858667828` aprobada.
  La Etapa 32 continúa abierta.

## Entrega 32B: sesiones y autorización por rol

- Alcance autorizado e implementado localmente: `auth.validate_session`
  y `auth.authorize_role` en `backend/app/auth.py`.
- Validación recibe cabecera, fábrica de conexiones y función de fecha.
  Conserva consulta, expiración, revocación, usuario activo y respuestas 401.
- Dependencias `authenticated_user` y `require_roles` en `main.py`
  conservan su interfaz FastAPI; autorización mantiene respuesta 403.
- Login, logout y `/auth/me` permanecen en `main.py`.
- Once casos nuevos cubren estados de sesión y autorización por rol.
- Validación: 33 pruebas backend aprobadas fuera del sandbox, una advertencia.
- Entrega local sin publicar; commit y push pendientes de autorización.
  La Etapa 32 continúa abierta.

## Etapas propuestas

| Etapa | Objetivo | Criterio de cierre |
|---|---|---|
| 30 | Separar páginas y componentes del frontend, por partes. | `App.tsx` conserva la composición general; las pantallas extraídas mantienen comportamiento, permisos y pruebas. |
| 31 | Extraer configuración y acceso a SQLite del backend. | Módulos separados, sin cambios en endpoints, esquema ni datos; pruebas aprobadas. |
| 32 | Extraer autenticación y sesiones del backend. | Conservación de hashes, expiración, revocación y permisos; pruebas aprobadas. |
| 33 | Separar rutas del backend por área funcional. | Endpoints y respuestas compatibles; extracción gradual con validación por bloque. |
| 34 | Revisar las PRs Dependabot pendientes. | Cada actualización evaluada por separado y publicada únicamente si sus verificaciones pasan. |
| 35 | Revisar permisos y protección de episodios cerrados. | Matriz de acciones por rol, pruebas de rechazos relevantes y corrección de defectos encontrados. |
| 36 | Evaluar recuperación de borradores durante reautenticación. | Diseño acordado sobre identidad, vigencia del episodio, almacenamiento y eliminación antes de implementar. |
| 37 | Elegir la siguiente mejora funcional o de interfaz. | Necesidad concreta, alcance y criterio de aceptación definidos con el usuario. |

## Entregas pequeñas propuestas para las etapas 30–33

Esta subdivisión es una propuesta de trabajo por revisar. Cada entrega requiere
alcance concreto y aprobación antes de implementarse; el orden de las pantallas
y áreas por extraer se definirá al revisar la tarea correspondiente.

### Etapa 30: frontend

1. Extraer una primera pantalla y sus componentes propios; delimitar sus
   propiedades y conservar la composición general en `App.tsx`.
2. Extraer las demás pantallas, una por entrega, manteniendo los flujos de
   sesión, navegación y permisos existentes.
3. Extraer componentes compartidos identificados durante las entregas previas,
   en cambios pequeños e independientes.

Cada entrega conserva comportamiento y contratos TypeScript, mantiene el
cliente HTTP en `frontend/src/api/client.ts` y los tipos compartidos en
`frontend/src/types/clinical.ts`, y debe superar las validaciones aplicables.

### Etapa 31: configuración y SQLite

1. Extraer la configuración existente a un módulo, conservando sus valores y
   la ubicación efectiva de la base de datos.
2. Extraer la creación de conexiones SQLite, manteniendo las opciones actuales.
3. Extraer la inicialización de la base de datos y conectar el arranque existente
   con el módulo correspondiente.

Cada entrega mantiene endpoints, esquema y datos sin cambios y requiere las
pruebas aplicables aprobadas antes de su cierre.

### Etapa 32: autenticación y sesiones

1. Extraer las funciones de hash y verificación sin cambiar algoritmos ni formatos.
2. Extraer la validación de sesiones y las dependencias de permisos por rol.
3. Extraer la lógica de inicio y cierre de sesión y consulta del usuario actual,
   conservando los contratos HTTP existentes.

Cada entrega conserva persistencia, hashes, expiración, revocación y permisos.
Su cierre requiere las pruebas aplicables aprobadas.

### Etapa 33: rutas por área funcional

1. Extraer un primer bloque de rutas de un área acordada y conectarlo a la
   aplicación existente.
2. Repetir la extracción por área funcional, una por entrega, aprovechando los
   módulos ya separados de configuración, SQLite y autenticación.
3. Revisar la composición final de la aplicación y las dependencias entre los
   bloques extraídos.

Cada bloque conserva métodos, rutas, permisos, códigos de estado y respuestas;
debe validarse antes de continuar con la siguiente entrega.

## Condiciones de las etapas posteriores

- Etapa 34: revisar cada PR de Dependabot individualmente, incluidas las #1 y
  #2 si continúan pendientes. Comprobar su estado y diff al iniciar la revisión;
  no agrupar aprobaciones ni publicaciones. Publicar cada actualización solo
  tras sus verificaciones y la autorización correspondiente.
- Etapa 35: documentar la matriz de acciones por rol y estado del episodio.
  Cualquier defecto encontrado debe tener una tarea de corrección delimitada
  y aprobada; no se mezclará con las refactorizaciones.
- Etapa 36: la pérdida del borrador ante HTTP 401, navegación o recarga sigue
  siendo una limitación aceptada. Es obligatorio acordar primero el diseño
  sobre identidad, vigencia del episodio, almacenamiento y eliminación.
  Cerrar la evaluación de diseño no autoriza su implementación: recuperar
  borradores continúa pendiente de aprobación como tarea independiente.
- Etapa 37: seleccionar la necesidad concreta con el usuario y acordar alcance
  y criterio de aceptación antes de proponer una tarea de implementación.

## Próximo paso

Revisar la entrega local 32B antes de autorizar su commit y publicación.
La Etapa 32 continúa abierta; 32C (login, logout y consulta de usuario)
requiere alcance y autorización.

## Fuentes

- Plan de etapas 30–37 aportado por el usuario en esta conversación.
- [Estado del proyecto](PROJECT_STATUS.md): cierre confirmado, capacidades y
  limitación aceptada de borradores.
- [Registro de evolución](CHANGELOG.md): antecedentes de las etapas 28 y 29.
- Las entregas pequeñas de este documento desarrollan el plan aportado como
  propuesta; no se presentan como contenido recuperado del chat original.
