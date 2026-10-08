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
- Los criterios de cierre siguientes son requisitos futuros. Este documento
  no afirma que se hayan ejecutado nuevas pruebas ni cerrado estas etapas.

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

- Alcance autorizado e implementado localmente: extracción de la cabecera
  a `frontend/src/components/AppHeader.tsx`, sin estado propio.
- Recibe `user` y callbacks `onDashboard`, `onSupervisor`, `onScan`,
  `onHistory`, `onLaboratory`, `onNewEpisode` y `onLogout`.
- Conserva botones, identidad, visibilidad por rol, textos y CSS.
  Navegación, sesión y API permanecen en `App.tsx`.
- Cinco casos nuevos cubren botones visibles y acciones de los cinco roles.
- Validación local: 46 pruebas frontend, lint y build aprobados.
- Entrega local sin publicar; commit y push pendientes de autorización.
  La Etapa 30 continúa abierta; revisar sus criterios de cierre tras publicar.

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

Revisar la entrega local 30I antes de autorizar su commit y publicación.
Después, revisar los criterios de cierre de la Etapa 30 antes de proponer otra extracción.

## Fuentes

- Plan de etapas 30–37 aportado por el usuario en esta conversación.
- [Estado del proyecto](PROJECT_STATUS.md): cierre confirmado, capacidades y
  limitación aceptada de borradores.
- [Registro de evolución](CHANGELOG.md): antecedentes de las etapas 28 y 29.
- Las entregas pequeñas de este documento desarrollan el plan aportado como
  propuesta; no se presentan como contenido recuperado del chat original.
