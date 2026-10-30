# Esperas y demoras por etapa

## Alcance acordado

Vista de consulta para episodios activos, accesible por Supervisor o por cuentas
clinicas con permiso de coordinacion. Administrar cuentas no concede acceso.
No amplia el permiso del panel de supervisor, no guarda datos ni ejecuta reglas.
La comunicacion realizada al paciente y el ensayo en red local quedan fuera.

## Criterios de aceptacion

- Separar estancia total, espera hasta registrar triaje y espera hasta primer
  inicio por disciplina. Asignar un responsable no confirma inicio.
- Detener la espera al primer inicio, conservandola ante relevos. La falta de un
  marcador fiable no se sustituye por cero. Fechas futuras, sin zona o invertidas
  no producen una duracion aparente. Un inicio historico sigue registrado aunque
  su duracion previa no pueda calcularse.
- Mostrar fases LAB segun hechos registrados y requisitos actuales. Una muestra
  compartida cuenta una vez por fase; cada analitica mantiene su propio resultado
  y revision. No mezclar muestras historicas con requisitos actuales.
- Consultar sin migrar bases antiguas; sus ordenes pendientes aparecen sin inferir
  fases de muestras. Un esquema LAB parcial se rechaza, no se repara al leer.
- Actualizacion visible cada 15 segundos con el cliente HTTP central y proteccion
  frente a lecturas tardias, salida de pagina y cambio de sesion. Ante fallo se
  advierte sobre datos anteriores; una denegacion retira esos datos.
- Filtrar por fase y nombre/episodio, con detalles plegados y 20 pacientes por
  pagina. Los indicadores cuentan pacientes; pueden aparecer en varias fases.
  Cada resumen muestra estancia y la mayor antiguedad pendiente conocida del
  filtro, advirtiendo si hay otros tiempos desconocidos; no modifica el orden
  de prioridad ni el reparto de pacientes.

## Origen de cada tiempo

| Dato o fase | Punto de partida | Fin |
| --- | --- | --- |
| Estancia total | Ingreso registrado | Consulta actual |
| Espera de triaje | Ingreso registrado | Primer registro de triaje |
| Primer inicio de medicina/enfermeria | Marcador operacional de triaje | Primer inicio de la disciplina |
| Obtencion de muestra | Solicitud de orden o de muestra de reemplazo | Obtencion registrada u otro hecho posterior registrado |
| Entrega | Obtencion registrada | Entrega registrada |
| Recepcion | Entrega registrada | Recepcion registrada |
| Aptitud | Recepcion registrada | Aptitud registrada |
| Nueva muestra por rechazo | Rechazo registrado | Requisito reemplazado o cancelado |
| Publicacion de resultado | Ultima recepcion/aptitud de las muestras requeridas | Resultado vigente que satisface esas muestras |
| Revision medica | Publicacion de la version vigente | Revision de esa version |
| Orden anterior | Creacion de orden | Resolucion por el circuito anterior |

Recibir una muestra sin registrar obtencion no inventa esa obtencion ni genera
una supuesta espera para obtenerla despues. Los hechos posteriores registrados
permiten mostrar la siguiente fase conocida, sin rellenar campos anteriores.
Las analiticas canceladas no generan trabajo de muestras; un informe vigente sin
revision sigue siendo visible. Corregir un informe inicia la espera de revision
de la nueva version. Los seguimientos de episodios cerrados conservan su bandeja
separada y no entran en este tablero.

## Presentacion y limites

API de lectura: `GET /operations/delays`. Fechas de respuesta con zona horaria;
presentacion dominicana en 12 horas. No se exponen QR, documento, nacimiento,
credenciales, texto de informes ni notas clinicas en esta proyeccion.

No se establecen tiempos maximos por prioridad, alertas nuevas, indicadores de
incumplimiento ni un supuesto inicio de procesamiento en laboratorio. Los tiempos
describen antiguedad desde el hecho indicado, no duracion de procedimientos.
El campo anterior `waiting_minutes` del panel Supervisor mantiene su contrato;
su encabezado se corrige a Estancia desde ingreso.

Las pruebas automaticas usan bases temporales y datos ficticios. La prueba manual
en el demo se coordina previamente con el usuario; no se opera la app ni se
reinician servicios durante la implementacion automatizada.
