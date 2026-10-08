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

- Implementada localmente, sin publicar: extracción de `EpisodeHistoryPage`
  con `historyData`, `onRefresh` y `onOpenEpisode` como props.
- Conserva `HistoryData`, CSS y presentación; la lógica y las llamadas API
  permanecen en `App.tsx`.
- Cobertura añadida para historial vacío y actualización del historial;
  se conserva la prueba de consulta posterior al alta.
- Validaciones locales: 20 pruebas frontend, lint y build aprobados;
  `git diff --check` sin errores. Pendiente de commit y publicación.
- Esta entrega no completa la Etapa 30. La siguiente entrega requiere definir
  su alcance y aprobar la tarea antes de implementarla.

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

Revisar la entrega 30A y definir el alcance de la siguiente entrega de la
Etapa 30 antes de autorizar su implementación.

## Fuentes

- Plan de etapas 30–37 aportado por el usuario en esta conversación.
- [Estado del proyecto](PROJECT_STATUS.md): cierre confirmado, capacidades y
  limitación aceptada de borradores.
- [Registro de evolución](CHANGELOG.md): antecedentes de las etapas 28 y 29.
- Las entregas pequeñas de este documento desarrollan el plan aportado como
  propuesta; no se presentan como contenido recuperado del chat original.
