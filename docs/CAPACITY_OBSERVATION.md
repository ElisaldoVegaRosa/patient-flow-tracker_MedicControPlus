# Observacion de capacidad multiusuario en esta PC

## Estado y alcance

Usuario prioriza preparar la primera etapa de cinco sesiones el 31/10/2026.
Herramienta preparada y ejecucion de cinco sesiones autorizada tras explicar
el plan. Etapas cinco y quince completadas; treinta autorizada y detenida en
login por cinco HTTP 500. Resultados debajo. No se repite automaticamente.

Objetivo: observar tiempos HTTP, errores e integridad con concurrencia acotada.
No es una prueba de navegadores, red del centro, tabletas/camaras ni certificacion
de capacidad para operar en campo. No se fijan umbrales clinicos o un SLA nuevo.

## Aislamiento

- scripts/capacity_probe.py crea cada ejecucion en un directorio nuevo bajo
  .tmp/capacity-runs/. No admite URL, origen o base de datos externos.
- No consulta ni copia pacientes del demo ni usa su base para generar la muestra.
  Preparacion sintetica desde cero con esquemas actuales LAB/comunicacion.
- Proceso API propio, un worker, sin reload, en 127.0.0.1 y puerto efimero
  diferente de 8000/5173. No inicia frontend ni cambia demo.ps1.
- Antes de enviar credenciales o escribir, confirma identificador del ensayo y
  ruta privada mediante endpoint exclusivo de ese proceso. Si no coincide, aborta.
- Cierra sus conexiones y detiene exclusivamente su propio proceso al terminar.
  No busca ni termina servidores ajenos. Windows usa CREATE_NO_WINDOW.
- Conserva base sintetica, manifest.json, server.log y report.json del ensayo.
  Passwords aleatorios y tokens solo en memoria; no se incluyen en informes.
- El demo habitual puede permanecer funcionando. Ambos procesos comparten CPU
  y disco de esta PC: el aislamiento es de datos/instancia, no de hardware.

## Datos y perfiles fijos

Siempre 61 episodios activos iniciales: 30 de fondo, 30 reservados para actividad
individual y uno para conflicto compartido. Diez ordenes LAB estructuradas con
dos analiticas y dos muestras por orden, aun pendientes. Todo es ficticio.
No representa expedientes largos, resultados tras alta o todas las acciones LAB.

| Etapa | Recepcion | Enfermeria | Medicina | Laboratorio | Supervision |
| --- | --- | --- | --- | --- | --- |
| Primera | 1 | 1 | 1 | 1 | 1 |
| Quince, completada | 3 | 3 | 3 | 3 | 3 |
| Treinta, detenida en login | 6 | 6 | 6 | 6 | 6 |

Cada sesion usa una cuenta personal y autenticacion real, sin reducir el trabajo
criptografico ni cambiar bloqueos, timeouts o configuracion de la aplicacion.
Las cuentas demo que inicialice normalmente el backend no generan trafico.

## Primera etapa: cinco sesiones

1. Autenticar en paralelo las cinco cuentas sinteticas.
2. Seis rondas separadas 15 segundos: cada sesion consulta dashboard, su bandeja
   por rol y su episodio. Son 90 lecturas; la ventana programada es de 75 segundos.
   Las bandejas son communications, care/queue, lab/orders y operations/delays.
3. Cuatro guardados independientes concurrentes: ingreso por Recepcion, triaje por
   Enfermeria/Supervision y evaluacion por Medicina. Laboratorio solo consulta en
   este primer escenario. Repetir cada envio con la misma clave y cuerpo.
4. Enfermeria/Supervision intentan guardar triaje sobre el mismo episodio con la
   misma version: se exige exactamente un HTTP 200 y un HTTP 409 por conflicto.
5. Verificar SQLite, referencias, autorias, cantidades, valores y registros unicos.
   Detectar duplicados o sobrescritura aunque todas las respuestas fueran HTTP 200.

Se esperan 109 solicitudes medidas si se completa todo, ademas de comprobaciones
de arranque no cronometradas. En etapas 15/30 serian 325/649 solicitudes medidas.
Preparacion y arranque quedan fuera de las latencias HTTP; se informa duracion total.
Duracion estimada de la primera etapa: unos 2-3 minutos; depende de las respuestas.

## Medicion y detencion

- p50, p95 y maximo por fase/operacion y por rol, con percentil de rango mas cercano.
- Cantidades por HTTP, conflictos esperados separados de errores inesperados.
- Corte de transporte a los 10 segundos por solicitud. Error inesperado cancela
  fases restantes y produce informe incompleto; no se repite para ocultarlo.
- El 409 solo es esperado en el conflicto deliberado. No se considera saludable
  un 409 en escrituras independientes ni 401/403/5xx inesperados.
- Reintentos deben conservar identificador y existir una sola vez en base de datos.
- El informe completed=true exige terminar el plan y sus invariantes; no acredita
  que se cumpla un tiempo de respuesta objetivo. latency_sla_evaluated permanece false.
- Registrar SO, Python, CPU logicas, revision Git y huellas de backend/herramienta.
  No recopila nombres del equipo, credenciales ni contenido de pacientes reales.

## Comandos

Mostrar el plan, sin servidor ni base nuevos:

```powershell
.\.venv\Scripts\python.exe .\scripts\capacity_probe.py --sessions 5
```

Ejecucion separada (primera etapa ya autorizada y realizada):

```powershell
.\.venv\Scripts\python.exe .\scripts\capacity_probe.py --sessions 5 --execute
```

No ejecutar etapas 15/30 como continuacion automatica. Revisar primero el informe
inicial, su integridad y condiciones del equipo; acordar la siguiente etapa.

## Validacion de la herramienta

Pruebas unitarias con bases temporales y HTTP/procesos simulados. No sustituyen
una medicion de capacidad y no envian carga a la app. Validacion relacionada: 81/81; tras el
ajuste final de cancelacion, 25/25 de herramienta y py_compile aprobados.
Tras la observacion treinta, clasificacion de errores HTTP ajustada: 26/26. Resultados
precisos y comandos aplicables en LOCAL_VALIDATION.md. No cambia codigo de
backend/frontend, contratos, dependencias ni configuracion del demo.

## Primera observacion: cinco sesiones

Informe local: .tmp/capacity-runs/capacity-5-ph3ac9jv/report.json.
Ejecucion completada en 85,813 s con las 109 solicitudes previstas. Cero errores
inesperados. Guardados/reintentos sin duplicados; version compartida produjo un
200 y un 409 esperado. Integridad/referencias/autorias/valores correctos.

| Lecturas (30 por grupo) | p50 ms | p95 ms | Max ms |
| --- | --- | --- | --- |
| Panel general | 396,551 | 604,897 | 644,743 |
| Episodio | 17,268 | 50,819 | 54,438 |
| Bandejas por rol | 27,344 | 119,827 | 156,770 |

Guardado independiente mas lento: 158,191 ms. Login mas lento: 1448,117 ms.
Los percentiles por rol tambien estan en el informe. Se verificaron 62 pacientes
sinteticos finales: 61 iniciales y un ingreso, sin duplicacion por reintento.

Servidor propio detenido y puerto cerrado comprobados. El demo habitual sigue
respondiendo con su copia de comunicacion, sin reiniciarse ni cambiar de base.
Son observaciones de este conjunto de datos en esta PC, sin evaluar SLA.
Etapa quince autorizada y completada posteriormente; comparacion debajo.

## Segunda observacion: quince sesiones

Informe .tmp/capacity-runs/capacity-15-tc8fxrzm/report.json. Mismos datos iniciales,
version de aplicacion/herramienta y entorno registrados. 325 solicitudes en
95,156 s, cero errores inesperados. Doce guardados y sus reintentos sin duplicar;
conflicto de seis escritores produjo un guardado y cinco rechazos 409 esperados.
Integridad/referencias/autorias/valores/cantidades verificados: 64 pacientes y
64 episodios ficticios finales, 61 iniciales mas tres ingresos.

| Indicador HTTP | 5 sesiones | 15 sesiones |
| --- | --- | --- |
| Panel p95 | 604,897 ms | 2668,450 ms |
| Panel maximo | 644,743 ms | 2734,464 ms |
| Episodio p95 | 50,819 ms | 91,751 ms |
| Bandejas p95 (consultas diferentes por rol) | 119,827 ms | 583,758 ms |
| Guardado independiente maximo | 158,191 ms | 719,164 ms |
| Login maximo | 1448,117 ms | 4779,974 ms |

El resultado de integridad fue correcto, pero existe ralentizacion observada.
No se atribuye causa sin perfilado ni se declara aprobado un SLA inexistente.
El panel fue la lectura mas lenta y el login simultaneo supero los otros tiempos.
Es una observacion por nivel; no incluye repeticiones estadisticas ni dispositivos.

Puerto privado cerrado comprobado; el demo habitual sigue respondiendo con la
misma copia de comunicacion. No se cambiaron limites, hashes, bloqueos ni datos
iniciales para obtener el resultado. Propuesta siguiente: medir treinta con
la misma version para completar linea base; etapa ya ejecutada, resultado debajo.

## Tercera observacion: treinta, detenida en autenticacion

Informe .tmp/capacity-runs/capacity-30-anjtjkx1/report.json. Misma app, herramienta,
datos iniciales y limites de las etapas anteriores en el momento de ejecutar.
El ensayo duro 22,953 s y se detuvo tras 30 solicitudes de acceso: 25 HTTP 200 y
cinco HTTP 500. No se ejecutaron las 540 lecturas ni las escrituras posteriores.
completed=false; no es una validacion de treinta usuarios trabajando autenticados.

Cinco trazas del servidor identifican database is locked al adquirir BEGIN
IMMEDIATE en auth.login. En la version ensayada se verificaba la contrasena mientras se
mantiene el bloqueo de escritura. La conexion tiene espera predeterminada SQLite
de cinco segundos; las peticiones fallidas no agotaron el timeout HTTP de diez.
Esto identifica contencion al iniciar sesion, sin demostrar un limite de uso
sostenido ni atribuir causa al hardware/red sin medidas adicionales.

Revision posterior de la base privada: integridad correcta, sin errores FK,
61 pacientes y episodios sinteticos, 25 sesiones y ningun evento clinico posterior
a la preparacion. El proceso/puerto privados quedaron cerrados y el demo habitual
sigue respondiendo con su misma copia.

### Diagnostico de herramienta mejorado despues del ensayo

El reporte original conserva mensaje generico de transporte/formato: un cuerpo
500 no JSON fallo al decodificarse. Se ajusta el controlador para clasificar un
HTTP inesperado antes de decodificarlo. La metrica original ya registraba los cinco
500; no se cambia el resultado. Regresion mas herramienta 26/26 y py_compile ok.
Es un cambio posterior de diagnostico, no de parametros ni de seguridad de app;
la huella del controlador para un futuro ensayo sera diferente y se registrara.

### Correccion posterior autorizada

- Verificar la contrasena fuera del bloqueo de escritura.
- Antes de crear el token, adquirir transaccion corta y revalidar identidad de
  cuenta, estado, credenciales y revision; rechazar cambios concurrentes.
- Mantener revocacion ante reset/desactivacion y politica criptografica actual.
- Cubrir carreras de seguridad y sesiones concurrentes con pruebas dirigidas.
- Validar cambios antes de coordinar otro ensayo real con los mismos limites.

auth.login corregido localmente: revalidacion atomica y 503 controlado ante
contencion. Dirigidas autenticacion/cuentas 40/40 aprobadas; backend completo
608/608 aprobado (1283,88 s), resultado consultado el 01/11/2026. No se ha repetido la etapa treinta; no atribuirle aun mejora medida.

## Repeticion aislada de treinta sesiones: 01/11/2026

Usuario autoriza un ensayo tras la correccion. Comando:
`.venv/Scripts/python.exe scripts/capacity_probe.py --sessions 30 --execute`.
Mismos 61 episodios iniciales, 10 ordenes LAB, seis rondas/15 s, timeout HTTP
10 s, espera SQLite predeterminada y politica PBKDF2. Sin cambios al controlador
respecto de su ajuste diagnostico ya validado. Sin reinicio del demo habitual.

Informe: `.tmp/capacity-runs/capacity-30-y2c1dc65/report.json`.
`completed=true`, 649 operaciones, 114,204 s; cero respuestas inesperadas.
30 logins HTTP 200, 540 consultas HTTP 200. 24 escrituras independientes y sus
reintentos conservan autor/valor y no duplican eventos. Conflicto compartido:
1 HTTP 200 y 11 HTTP 409 esperados. Integridad y claves foraneas correctas;
67 pacientes/episodios finales (61 + seis ingresos ficticios).

| Operacion | p50 ms | p95 ms | Max ms |
| --- | ---: | ---: | ---: |
| Inicio de sesion | 2223,052 | 2480,300 | 2519,993 |
| Panel | 4651,407 | 6180,726 | 6541,905 |
| Episodio | 102,509 | 244,199 | 325,166 |
| Cola por rol | 682,672 | 1251,956 | 1563,573 |

Maximo de escrituras independientes: 2370,463 ms. El fallo anterior de acceso
no se reproduce; no mezclar sus percentiles (incluian cinco errores) con los de
este resultado como comparacion directa de velocidad. Persiste demora en panel.
No hay SLA evaluado ni certificacion para treinta personas reales o red local.

Fuente: HEAD 729b8b322cfe312132bdb5c3f8a299dd5040629b MAS cambio local auth.py.
62 archivos backend; SHA256
`7d635fc7f5d30b0792f7902a2b049d8e5cc34149c4cd726265b3e09eb5c7eaf5`.
Controlador SHA256
`f6665bfd6dce36d22370de25c28574f2194722a6a9236d08ded9452ed6d19f72`.
No nuevo commit/push; informes anteriores intactos.

Cierre confirmado: puerto privado 61484 cerrado. Status del demo: backend y
frontend propios/responden, misma base
`.tmp/communication-rollout-20261030/clinical-communication-working.sqlite3`.
Status HTTP no afirma integridad clinica de esa copia; la integridad medida arriba
corresponde solo a la base sintetica. Proximo diagnostico recomendado: /dashboard.

## Resumen del panel: ensayo autorizado 01/11/2026

Demo Stop/Start gestionados con misma base de comunicacion. Tras ello se ejecuta
`.venv/Scripts/python.exe scripts/capacity_probe.py --sessions 30 --execute`.
Informe `.tmp/capacity-runs/capacity-30-70k9j_lc/report.json`.
Plan y SHA del controlador identicos al ensayo capacity-30-y2c1dc65; backend
incluye ahora auth y resumen locales sobre HEAD 729b8b3, no nuevo commit.

- completed=true; 649 operaciones, 101,235 s; 30 logins HTTP 200.
- Cero respuestas inesperadas; 24 escrituras independientes y replay exacto.
- Conflicto: 1 HTTP 200 y 11 HTTP 409 esperados, sin sobrescritura.
- Integridad/FK correctas, 67 pacientes/episodios finales sinteticos.

| Operacion | p50 ms | p95 ms | Max ms |
| --- | ---: | ---: | ---: |
| Login | 2758,420 | 3132,163 | 3239,256 |
| Panel | 143,649 | 390,208 | 514,247 |
| Episodio | 74,085 | 165,806 | 200,210 |
| Cola por rol | 578,243 | 1018,582 | 1518,890 |

Panel anterior: p95 6180,726 ms/max 6541,905 ms. Diferencia favorable en este
ensayo; dos ejecuciones locales, no estimacion estadistica de produccion.
Login p95 sube de 2480,300 a 3132,163 ms sin errores; no afirmar mejora uniforme.
Maximo de escrituras independientes 1263,532 ms.
Backend SHA256 `238cdc79d59e297470bf66d241124626024fcc7a63b6553cf651fb2839095086`.
Runner SHA256 `f6665bfd6dce36d22370de25c28574f2194722a6a9236d08ded9452ed6d19f72`.

Puerto privado 55148 cerrado. Demo Status: propios/responden, misma base
`.tmp/communication-rollout-20261030/clinical-communication-working.sqlite3`.
Status HTTP no comprueba circuito clinico ni integridad de esa copia; verificaciones
anteriores de integridad corresponden a base sintetica. Sin commit/push.
La prueba de carga no sustituye comprobacion visual ni resuelve por si sola
la intermitencia frontend registrada en LOCAL_VALIDATION.md.

## Ensayo sostenido preparado

Usuario prioriza observar diez minutos. Nueva opcion --steady-minutes 10 conserva
el plan breve por defecto. Con 30 sesiones: 41 rondas/15 s entre t=0 y t=600,
3690 lecturas y 3799 operaciones totales previstas. Preparacion y guardados finales
agregan tiempo a los diez minutos. Datos iniciales, roles, aislamiento y limites
iguales. Las escrituras no se distribuyen durante la ventana: se hacen al final.
No mide memoria/CPU ni acredita ausencia de fugas. No nueva carga real ejecutada.

Descripcion (sin servidor):
`.venv/Scripts/python.exe scripts/capacity_probe.py --sessions 30 --steady-minutes 10`

Ejecucion propuesta, pendiente coordinacion:
`.venv/Scripts/python.exe scripts/capacity_probe.py --sessions 30 --steady-minutes 10 --execute`

Criterios: todas las operaciones previstas, cero estados inesperados, replay sin
duplicados, conflicto protegido, integridad/FK correctas y cierre de servidor.
Registrar latencias y compararlas con alcance temporal distinto; sin SLA definido.
27 pruebas del controlador aprobadas en 12,73 s, una advertencia. Default breve
preservado; test nuevo valida plan sostenido y modo descriptivo sin ejecucion.

## Ensayo sostenido autorizado: resultado 01/11/2026

Comando: .venv/Scripts/python.exe scripts/capacity_probe.py --sessions 30
--steady-minutes 10 --execute. Informe
.tmp/capacity-runs/capacity-30-cg_w_clb/report.json.
completed=true, 3799 operaciones/625,672 s (10:26 aprox). Ventana programada:
600 s, 41 rondas, 30 sesiones. 3690 consultas y 30 logins HTTP 200.
Cero estados inesperados. 24 escrituras independientes finales con replay exacto,
conflicto compartido 1 HTTP 200 y 11 HTTP 409 esperados. Integridad/FK correctas,
67 pacientes/episodios finales. Puerto privado 52209 cerrado verificado.
Demo Status: backend/frontend propios/responden con misma copia de comunicacion;
no reinicio ni sustitucion de datos del demo. Integridad medida solo en sintetica.

| Operacion | p50 ms | p95 ms | Max ms |
| --- | ---: | ---: | ---: |
| Login | 1465,148 | 2053,052 | 2136,338 |
| Panel (1230 lecturas) | 120,316 | 180,565 | 263,487 |
| Episodio (1230) | 57,301 | 113,543 | 173,064 |
| Cola por rol (1230) | 483,416 | 697,987 | 1026,838 |

Maximo de escrituras independientes finales: 978,751 ms. Plan de diez minutos,
no comparar como ensayo de identica duracion con el breve previo. Percentiles
agregados no muestran tendencia temporal; no se midieron CPU/memoria ni fugas.
Escrituras solo al final; no acredita carga mixta sostenida ni capacidad en campo.

Fuente app: commit 2a59902fb7a4913cde671da63bb27eb8a65b0b85;
backend SHA256 238cdc79d59e297470bf66d241124626024fcc7a63b6553cf651fb2839095086.
Controlador ampliado localmente, aun no publicado, SHA256
691754e7dc5e036d6245c85fd91b4671eff51c07e82bc3dd7862eb533314c527.
Sin nuevo commit/push. Validacion preparatoria del controlador 27/27 conservada;
no cambios de codigo posteriores al ensayo ni repeticion de suites innecesaria.
