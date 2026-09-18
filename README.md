# patient-flow-tracker_MedicControPlus
Sistema operacional de seguimiento clínico en tiempo real que rastrea episodios activos de pacientes, tareas y alertas para mantener la continuidad del cuidado.

## Flujo por roles

### Recepción

- Registra pacientes.
- Crea episodios activos.
- Genera pulseras QR.
- Consulta el centro de control.

### Enfermería

- Escanea pulseras.
- Registra triaje.
- Actualiza prioridad, ubicación y responsable.
- Registra signos vitales.
- Reconoce y escala alertas.

### Médico

- Registra evaluaciones clínicas.
- Registra diagnóstico y conducta.
- Crea órdenes para laboratorio, enfermería o equipo médico.
- Resuelve alertas.
- Registra el alta.

### Laboratorio

- Consulta órdenes pendientes.
- Visualiza paciente, episodio, prioridad y ubicación.
- Registra resultados simulados.
- Completa órdenes.

### Supervisor

- Consulta todos los episodios activos.
- Consulta alertas y prioridades.
- Accede a la bandeja de laboratorio.
- Supervisa la operación clínica.

## Flujo de laboratorio

```mermaid
flowchart LR
    A[Médico crea orden] --> B[Tarea LAB pendiente]
    B --> C[Bandeja de laboratorio]
    C --> D[Laboratorio registra resultado]
    D --> E[Tarea completada]
    E --> F[Evento auditable]
    F --> G[Timeline del episodio]

    ## Centro de control del supervisor

El supervisor dispone de una vista operacional exclusiva con:

- pacientes activos;
- pacientes de prioridad P1 y P2;
- pacientes clasificados en riesgo;
- alertas abiertas;
- tareas pendientes;
- tiempo transcurrido desde el ingreso;
- ubicación actual;
- acceso directo al episodio.

### Clasificación operacional

```mermaid
flowchart TD
    A[Paciente activo] --> B{Prioridad P1 o P2}
    B -->|Sí| R[Requiere atención]
    B -->|No| C{Tiene alertas abiertas}
    C -->|Sí| R
    C -->|No| E[Estado operacional estable]
    R --> S[Supervisor abre episodio]
    S --> T[Reasignación o seguimiento]

    ## Cargar datos ficticios

Para poblar el sistema con datos de demostración:

1. Inicie sesión como `supervisor`.
2. Abra **Panel de supervisor**.
3. Pulse **Cargar datos de demostración**.
4. Confirme la operación.

La operación:

- agrega doce pacientes;
- conserva los datos existentes;
- puede ejecutarse de forma segura más de una vez;
- no duplica pacientes ficticios.

### Distribución de los datos

| Tipo | Cantidad |
|---|---:|
| Pacientes ficticios | 12 |
| Episodios activos | 10 |
| Episodios cerrados | 2 |
| Prioridades | P1–P5 |
| Servicios | Enfermería y laboratorio |

> Los datos son completamente ficticios y no deben utilizarse para atención clínica real.

## Historial de episodios cerrados

Los usuarios de recepción, médico y supervisor pueden consultar
episodios finalizados desde **Historial de episodios**.

La pantalla muestra:

- paciente;
- documento;
- prioridad final;
- ubicación final;
- responsable;
- fecha de cierre;
- número de eventos;
- número de alertas;
- número de tareas;
- acceso al timeline completo.

Los episodios cerrados se mantienen separados del dashboard de
pacientes activos y no pueden modificarse mediante los formularios
operacionales.