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