export type User = {
  username: string;
  role: string;
  access_token: string;
};

export type SessionUser = {
  username: string;
  role: string;
};

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
  id: number;
  episode_id: number;
  type: string;
  username: string;
  note: string | null;
  created_at: string;
  at?: string;
};

export type Episode = {
  id: number;
  name: string;
  birth_date: string;
  document: string;
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
  id: number;
  name: string;
  document: string;
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

export type LaboratoryOrder = {
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
