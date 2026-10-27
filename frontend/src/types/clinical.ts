export type User = {
  can_coordinate?: boolean;
  display_name?: string;
  username: string;
  role: string;
  access_token: string;
};

export type SessionUser = {
  can_coordinate?: boolean;
  display_name?: string;
  username: string;
  role: string;
};

export type Account = {
  can_coordinate?: number;
  id: number; username: string; display_name: string; role: string; active: number;
  created_at: string; account_revision: number; version: string;
};
export type AccountChange = {
  id: number; user_id: number; actor: string; action: string; old_value: string;
  new_value: string; reason: string; created_at: string;
};
export type AccountsData = { accounts: Account[]; changes: AccountChange[]; requested_by: string };

export type StaffArea = { id: number; name: string; active: number; revision: number; version: string };
export type StaffShift = { id: number; name: string; starts_at: string; ends_at: string;
  coordinator_id: number; coordinator_username: string; coordinator_name: string;
  coordinator_active: number; coordinator_permission: number;
  status: "PLANNED" | "ACTIVE" | "CLOSED" | "CANCELLED"; version: string };
export type StaffAssignment = { id: number; shift_id: number; user_id: number; area_id: number;
  username: string; display_name: string; role: string; area_name: string; account_active: number;
  shift_name: string; starts_at: string; ends_at: string; shift_status: StaffShift["status"];
  status: "PLANNED" | "AVAILABLE" | "UNAVAILABLE" | "FINISHED" | "CANCELLED";
  effective_available: boolean; version: string };
export type StaffPerson = { id: number; username: string; display_name: string; role: string };
export type StaffChange = { id: number; resource: string; target_id: number; actor: string;
  action: string; reason: string; old_value: string; new_value: string; created_at: string };
export type StaffingData = { areas: StaffArea[]; shifts: StaffShift[]; assignments: StaffAssignment[];
  professionals: StaffPerson[]; coordinators: StaffPerson[]; changes: StaffChange[]; changes_has_more?: boolean; requested_by: string };

export type CarePerson = { id: number; username: string; display_name: string; role: string; active: number };
export type CareCandidate = { id: number; username: string; display_name: string; high_priority: number;
  pending_tasks: number; total: number; by_priority: Record<string, number>; incoming: number;
  last_assignment_at: string | null; last_assignment_order: number };
export type CareSlot = { discipline: "DOCTOR" | "NURSE"; user_id: number | null; pending_user_id: number | null;
  owner: CarePerson | null; proposed: CarePerson | null; started_at: string | null; first_started_at: string | null;
  covered: boolean; needs_coverage: boolean; candidates: CareCandidate[]; waiting_minutes?: number | null };
export type CareEpisode = { episode_id: number; name: string; status: string; priority: number; location: string;
  legacy_assigned_to: string | null; area_id: number | null; area_name: string | null; ready_at: string | null;
  arrival_at: string; historical: number | null; version: string; slots: CareSlot[];
  since_arrival_minutes?: number | null; since_ready_minutes?: number | null; lab_pending?: number; open_alert_count?: number;
  changes?: { id: number; action: string; discipline: string | null; actor: string; reason: string;
    created_at: string; old_value: string; new_value: string }[] };
export type CareQueue = { episodes: CareEpisode[]; areas: { id: number; name: string; active: number }[]; requested_by: string };

export type VitalSigns = {
  id: number;
  episode_id: number;
  temperature: number;
  heart_rate: number;
  systolic: number;
  diastolic: number;
  spo2: number;
  respiratory_rate: number;
  created_at?: string;
  at?: string;
};

export type AlertHistoryEntry = {
  id: number;
  alert_id: number;
  old_status: string | null;
  new_status: string;
  username: string;
  created_at?: string;
  at?: string;
};

export type ClinicalAlert = {
  version?: string;
  id: number;
  episode_id: number;
  reason: string;
  severity: string;
  status: string;
  responsible: string | null;
  created_at: string;
  updated_at: string;
  history?: AlertHistoryEntry[];
};

export type ClinicalTask = {
  version?: string;
  last_change_id?: number | null;
  id: number;
  episode_id: number;
  title: string;
  service: string;
  status: string;
  result: string | null;
  created_at?: string;
  due_at?: string | null;
};

export type TimelineEvent = {
  version?: string;
  current_note?: string | null;
  annulled?: boolean;
  id: number;
  episode_id: number;
  type: string;
  username: string;
  note: string | null;
  created_at: string;
  at?: string;
};

export type Episode = {
  care?: CareEpisode;
  patient_id?: number;
  identity_status?: "REGISTERED" | "PROVISIONAL" | "VERIFIED";
  identity_version?: string;
  identity_changes?: IdentityChange[];
  triage_version?: string;
  clinical_version?: string;
  id: number;
  name: string;
  birth_date: string | null;
  document: string | null;
  qr_token: string;
  status: string;
  priority: number;
  location: string;
  assigned_to?: string | null;
  started_at: string;
  closed_at?: string | null;
  vitals: VitalSigns[];
  alerts: ClinicalAlert[];
  tasks: ClinicalTask[];
  events: TimelineEvent[];
  record_changes?: RecordChange[];
};

export type RecordChange = {
  id: number;
  episode_id: number;
  target_type: "TASK" | "EVENT" | "EPISODE";
  target_id: number;
  action: string;
  old_value: string | null;
  new_value: string | null;
  reason: string;
  username: string;
  created_at: string;
};

export type IdentityChange = {
  id: number; patient_id: number; episode_id: number; old_value: string;
  new_value: string; reason: string; verification_source: string;
  username: string; created_at: string;
};

export type PendingIdentity = {
  patient_id: number; episode_id: number | null; name: string;
  birth_date: string | null; document: string | null;
};

export type DashboardData = {
  active: number;
  open_alerts: number;
  patients: Episode[];
  requested_by: string;
};

export type DemoSeedResponse = {
  created: number;
  existing: number;
  message: string;
  requested_by: string;
};

export type ClosedEpisode = {
  identity_status?: string;
  id: number;
  name: string;
  document: string | null;
  status: string;
  priority: number;
  location: string;
  assigned_to: string | null;
  started_at: string;
  closed_at: string | null;
  event_count: number;
  alert_count: number;
  task_count: number;
};

export type HistoryData = {
  total: number;
  episodes: ClosedEpisode[];
  requested_by: string;
};

export type SupervisorPatient = Episode & {
  waiting_minutes: number;
  open_alert_count: number;
  pending_task_count: number;
  at_risk: boolean;
};

export type SupervisorData = {
  metrics: {
    active_patients: number;
    high_priority_patients: number;
    patients_at_risk: number;
    open_alerts: number;
    pending_tasks: number;
  };
  rules: {
    evaluated_episodes: number;
    generated_alerts: number;
  };
  patients: SupervisorPatient[];
  generated_at: string;
  requested_by: string;
};

export type TimeRulesEvaluationResponse = {
  evaluated_episodes: number;
  generated_alerts: number;
  evaluated_at: string;
  requested_by: string;
};

export type LaboratoryOrder = {
  patient_identity_status?: string;
  version?: string;
  last_change_id?: number | null;
  record_changes?: RecordChange[];
  id: number;
  episode_id: number;
  title: string;
  service: string;
  status: string;
  result: string | null;
  created_at: string;
  patient_name: string;
  priority: number;
  location: string;
  episode_status: string;
};

export type LaboratoryQueue = {
  status_filter: string;
  total: number;
  orders: LaboratoryOrder[];
  requested_by: string;
};

export type LogoutResponse = {
  message: string;
  username: string;
};

export type EpisodePresenceData = {
  active: boolean;
  ttl_seconds: number;
  members: { username: string; role: string; tabs: number; sessions: number; editing_tabs: number }[];
};

export type AdmissionCandidate = {
  id: number;
  name: string;
  birth_date: string | null;
  document: string | null;
  matches: boolean;
  active_episode_ids: number[];
};

export type StaffHistoryData = { changes: StaffChange[]; total: number; page: number; page_size: number; has_more: boolean;
  shifts: { id: number; name: string }[]; professionals: { id: number; username: string; display_name: string }[]; requested_by: string };
