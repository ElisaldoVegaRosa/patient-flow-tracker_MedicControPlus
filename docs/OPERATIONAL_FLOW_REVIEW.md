# Revisión integral del flujo operacional tras la Etapa 61

Revisión del 12 de octubre de 2026 autorizada por el usuario. Inspección del
código y pruebas; no modifica contratos, comportamiento ni datos clínicos.
Baseline publicado: implementación 45013fc, cierre 715c917; ambas CI aprobadas
(38325483200 y 38325778646). Validaciones existentes: 160 backend, 386 frontend,
lint/build. No se repitieron suites aprobadas para esta revisión documental.

## Cobertura por flujo

| Flujo | Cobertura existente | Observación integral |
|---|---|---|
| Ingreso | Roles recepción/supervisor, transacción y recibo | Crea paciente nuevo en cada intención; identidad y fecha no tienen validación semántica común |
| Triaje | Roles, episodio activo, If-Match y campos conservados | Prioridad acotada; ubicación y responsable admiten espacios |
| Signos | Rangos numéricos, episodio activo y alertas en la misma transacción | Nuevos registros independientes; no requiere versionar cada inserción |
| Evaluación | Médico, episodio activo, historial y recibo | Múltiples evaluaciones son legítimas; longitudes admiten texto compuesto solo por espacios |
| Órdenes y resultados | Médico crea; LAB completa LAB; versión y episodio activo | Título/resultado no tienen límites de texto en API; la bandeja incluye pendientes de episodios cerrados |
| Alertas | Transiciones, permisos de resolución, versión e historial | La protección común ya cubre sustituciones y repetición de intención |
| Alta e historial | Médico, versión clínica, cierre único, consulta histórica | Se permite cerrar con pendientes; después no se pueden completar |
| Sesión y red | Cancelación, plazo, recibos, consulta sin reenviar y presencia | Presencia orientativa; no sustituye permisos, versiones ni recibos |

Evidencia: backend/app/routes/{episode_registration,nursing,medical,tasks,alerts,
episode_queries}.py; backend/app/{write_operations,concurrency}.py;
backend/tests/{test_flow,test_task_permissions,test_concurrency,test_write_operations,
test_presence}.py; frontend/src/pages/{NewEpisodePage,EpisodePage,LaboratoryPage}.tsx;
frontend/src/api/client.ts; frontend/src/hooks/useLiveRefresh.ts;
frontend/src/session/formDrafts.ts; pruebas App de recuperación y actualización.

## Hallazgos comprobados

### 1. Validación desigual de entradas en toda la API

Los modelos de ingreso, triaje, órdenes, resultados y alta aceptan cadenas vacías
o espacios según el campo. Evaluación tiene longitudes pero acepta solo espacios.
La fecha de nacimiento es str, admite una fecha inválida. Algunas restricciones
están únicamente en HTML (required/minLength/maxLength) y no protegen clientes API.

Comprobación ejecutada en memoria mediante model_validate, sin iniciar la API
ni escribir bases: EpisodeCreate con fecha inválida y espacios; TriageRequest
con ubicación/responsable de espacios; TaskCreateRequest con título vacío;
TaskResultRequest con resultado vacío; MedicalEvaluationRequest solo espacios;
DischargeRequest con nota vacía. Los seis modelos aceptaron esos casos.
Esto demuestra aceptación por el esquema; no se enviaron registros inválidos
a la API local ni se afirma que existan datos corruptos en la base del usuario.

### 2. Pendientes después del cierre sin resolución operacional explícita

medical.py cierra el episodio sin exigir completar tareas ni resolver alertas.
tasks.py filtra la bandeja por servicio/estado de tarea, sin excluir CLOSED;
LaboratoryPage muestra formulario sin condicionar episode_status. Completar se
rechaza correctamente en API si el episodio está cerrado. test_flow.py y
test_task_permissions.py cubren tareas que permanecen PENDING tras el alta.

La combinación puede mostrar una orden como pendiente y ofrecer publicar cuando
ya no es ejecutable. Es una incoherencia de presentación inferida del código.
No es autorización para bloquear altas ni cancelar tareas automáticamente:
la política de pendientes al cerrar requiere una decisión del producto.

### 3. Identidad del paciente e ingreso repetido con intención nueva

Cada POST /episodes inserta patients. El recibo evita repetir la misma clave,
pero otra clave crea otro paciente incluso con el mismo documento. No hay aquí
búsqueda/reutilización de identidad ni regla sobre episodios simultáneos.
No se considera defecto de idempotencia: falta una política de identidad,
que debe acordarse antes de introducir unicidad o fusionar registros.

### 4. Límites aceptados de recuperación y retención

Los borradores clínicos se conservan en memoria para interrupciones de sesión;
no sobreviven una recarga. Las referencias de envíos conservan metadatos, no
el cuerpo clínico. Recibos vencidos siguen reservando claves; borrarlos sin
reserva permitiría duplicados. Estos límites requieren diseño independiente,
no nuevos parches por formulario. Presencia y recuperación guiada de referencias
consultables ya están cubiertas por 60–61; no deben presentarse como pendientes.

## Alcance recomendado para la próxima entrega

Propuesta 62: validación transversal de entradas para ingreso, triaje,
evaluación, orden, resultado y alta, en una única entrega revisable.

- Definir campos obligatorios, longitudes y fechas válidas; compartir validadores
  backend y alinear mensajes/restricciones frontend. Evitar transformar texto
  clínico silenciosamente o imponer reglas de documento propias de un país.
- Conservar contratos de permisos, versiones, idempotencia y cuerpos originales
  de reintento. No migrar ni limpiar registros históricos automáticamente.
- Cubrir llamadas directas API, vacío/espacios, límites, fechas y contenido válido;
  rechazos sin cambios en tablas clínicas ni recibos. Verificar conservación del
  formulario y que corregir datos produzca una nueva intención cuando corresponda.
- Ejecutar validación completa y una prueba directa representativa. No dividir
  esta mejora en seis etapas por formulario.

Segunda prioridad: distinguir en laboratorio pendientes ejecutables y pendientes
de episodios cerrados, conservar consulta histórica y definir qué informar al alta.
Separar esa decisión del bloqueo clínico: no imponer cierre de tareas/alertas
como condición de alta sin autorización específica.

Persistencia de borradores, identidad del paciente y archivo de recibos quedan
como decisiones posteriores. Implementación de 62, commit y push requieren
nueva autorización; esta revisión solo entrega el informe y la propuesta.


## Autorización posterior

El usuario autorizó implementar la propuesta 62. Reglas y pruebas añadidas
localmente; validación aprobada: 173 backend, 409 frontend, lint/build.
Prueba directa de ingreso aprobada por el usuario: nombre con espacios y
fecha futura rechazados, conservando campos sin crear un episodio. El caso
médico opcional no se probó manualmente; está cubierto por pruebas automatizadas.
Publicación autorizada junto con implementación, pruebas y documentación.


## Prueba directa propuesta para 62

1. Entrar como recepción y abrir Nuevo ingreso. Usar solo datos ficticios.
   Completar documento y nacimiento válidos; escribir tres espacios en Nombre.
   Pulsar Crear episodio: debe señalar el nombre y conservar los campos, sin crear.
2. Cambiar Nombre a Paciente Demo Validación y nacimiento a una fecha futura.
   Pulsar Crear episodio: debe señalar la fecha, conservar campos y no crear.
3. Restaurar una fecha válida, pero no enviar si no se desea crear un registro.
   Se puede salir descartando el formulario de prueba.
4. Opcional como médico: en un episodio ficticio activo, completar diagnóstico
   y escribir tres espacios en Nota de evaluación. Guardar debe señalar la nota,
   sin añadir evaluación ni borrar el diagnóstico. Descartar al terminar.

Los valores límite, llamadas directas API y corrección seguida de un envío válido
están cubiertos por pruebas automatizadas con bases temporales. No hace falta
probar manualmente cada formulario ni guardar registros nuevos para estos puntos.
