import type { FollowupPerson, LaboratoryFollowup } from "../types/clinical";
export const doctor: FollowupPerson = { id: 3, username: "medico.demo", display_name: "Médico Demo", role: "DOCTOR", active: 1 };
export const receiver: FollowupPerson = { ...doctor, id: 4, username: "medico.relevo", display_name: "Médico Relevo" };
export const followup: LaboratoryFollowup = { id: 1, episode_id: 22, patient_name: "Paciente ficticio", episode_status: "CLOSED", current_cycle: true,
  version: '"f1"', owner_user_id: 3, pending_user_id: null, owner: doctor, proposed: null, review_due_at: "2099-10-29T13:00:00Z",
  communication_plan: "Comunicación ficticia", reason: "Seguimiento ficticio", pending_results: 2, pending_reviews: 0,
  clinical_work_pending: true, requires_plan: false, coverage_pending: false, overdue: false, scope: [{ analysis_id: 5 }] };
