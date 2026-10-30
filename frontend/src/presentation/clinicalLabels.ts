// Presentation only: API values, clinical notes and audit originals stay unchanged.
const labels = {
  episodeStatus: { ACTIVE: "Activo", CLOSED: "Cerrado", ANNULLED: "Anulado" },
  taskStatus: { PENDING: "Pendiente", COMPLETED: "Completada", ANNULLED: "Anulada", CANCELLED: "Cancelada" },
  laboratoryStatus: {
    PENDING: "Pendiente", PARTIAL: "Resultados parciales", COMPLETED: "Completada",
    COMPLETED_WITH_CANCELLATIONS: "Finalizada con cancelaciones", CANCELLED: "Cancelada",
  },
  specimenKind: { BLOOD: "Sangre", SALIVA: "Saliva", STOOL: "Heces", URINE: "Orina", OTHER: "Otra" },
  specimenSuitability: { UNKNOWN: "Pendiente de valoración", ACCEPTED: "Apta", REJECTED: "No apta" },
  specimenAction: { collection: "Obtención", delivery: "Entrega", receipt: "Recepción", suitability: "Aptitud", repeat: "Nueva muestra" },
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
    LAB_ORDER_CREATED: "Orden de laboratorio creada", LAB_SAMPLE_COLLECT: "Obtención de muestra registrada",
    LAB_SAMPLE_DELIVER: "Entrega de muestra registrada", LAB_SAMPLE_RECEIVE: "Recepción de muestra confirmada",
    LAB_SAMPLE_ASSESS: "Aptitud de muestra registrada", LAB_SAMPLE_REPEAT: "Nueva muestra solicitada",
    LAB_LEGACY_RESULT_REVIEWED: "Resultado anterior revisado al alta",
    LAB_RESULT_PUBLISH: "Resultado de analítica publicado", LAB_RESULT_CORRECT: "Resultado de analítica corregido",
    LAB_RESULT_ANNUL: "Vigencia del resultado anulada", LAB_RESULT_REVIEW: "Revisión médica del resultado",
    LAB_ANALYSIS_CANCELLED: "Analítica cancelada", LAB_ANALYSIS_REINSTATED: "Analítica restituida",
    LAB_FOLLOWUP_PLAN: "Plan de seguimiento actualizado", LAB_FOLLOWUP_PROPOSE: "Relevo de seguimiento propuesto",
    LAB_FOLLOWUP_ACCEPT: "Relevo de seguimiento aceptado", LAB_FOLLOWUP_CANCEL_HANDOFF: "Relevo de seguimiento cancelado",
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
