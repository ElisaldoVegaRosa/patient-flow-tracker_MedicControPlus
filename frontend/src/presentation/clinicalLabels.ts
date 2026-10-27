// Presentation only: API values, clinical notes and audit originals stay unchanged.
const labels = {
  episodeStatus: { ACTIVE: "Activo", CLOSED: "Cerrado", ANNULLED: "Anulado" },
  taskStatus: { PENDING: "Pendiente", COMPLETED: "Completada", ANNULLED: "Anulada", CANCELLED: "Cancelada" },
  alertStatus: {
    CREATED: "Creada", ACTIVE: "Activa", ACKNOWLEDGED: "Reconocida",
    ESCALATED: "Escalada", RESOLVED: "Resuelta",
  },
  severity: { HIGH: "Alta", CRITICAL: "Crítica" },
  role: {
    ADMISSION: "Admisión/archivo",
    RECEPTION: "Recepción", NURSE: "Enfermería", DOCTOR: "Médico",
    LAB: "Laboratorio", SUPERVISOR: "Supervisor",
  },
  service: { LAB: "Laboratorio", NURSING: "Enfermería", MEDICAL: "Equipo médico" },
  disposition: {
    CONTINUE_OBSERVATION: "Continuar en observación",
    ORDER_TESTS: "Solicitar pruebas u órdenes", READY_FOR_DISCHARGE: "Preparar para alta",
  },
  eventType: {
    REEVALUATION_CREATED: "Reevaluación programada", REEVALUATION_COMPLETE: "Acción de reevaluación realizada",
    REEVALUATION_RESCHEDULE: "Acción de reevaluación reprogramada", REEVALUATION_CANCEL: "Acción de reevaluación cancelada",
    IDENTITY_VERIFIED: "Identidad verificada",
    EPISODE_CREATED: "Ingreso registrado", TRIAGE: "Triaje",
    VITALS_RECORDED: "Signos vitales registrados", QR_SCANNED: "Pulsera escaneada",
    MEDICAL_EVALUATION: "Evaluación médica", TASK_CREATED: "Orden creada",
    TASK_COMPLETED: "Orden completada", DISCHARGE: "Alta médica",
    ALERT_CREATED: "Alerta generada", ALERT_ACKNOWLEDGED: "Alerta reconocida",
    ALERT_ESCALATED: "Alerta escalada", ALERT_RESOLVED: "Alerta resuelta",
    EPISODE_REOPENED: "Episodio reabierto", ARRIVAL_ANNULLED: "Ingreso anulado",
  },
  changeAction: { CORRECT: "Corrección", ANNUL: "Anulación", REOPEN: "Reapertura" },
  recordTarget: { TASK: "Orden", EVENT: "Evento", EPISODE: "Episodio" },
} satisfies Record<string, Record<string, string>>;

export type ClinicalLabelKind = keyof typeof labels;

export function clinicalLabel(kind: ClinicalLabelKind, code: string): string {
  const choices: Readonly<Record<string, string>> = labels[kind];
  return Object.hasOwn(choices, code) ? choices[code] : `Código no reconocido (${code})`;
}
