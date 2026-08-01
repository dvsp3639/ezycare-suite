// Follow-up Care Management module types (DB rows, snake_case)

export interface FollowupPolicy {
  id: string;
  hospital_id: string;
  enabled: boolean;
  window_days: number;
  max_visits: number;
  doctor_wise: boolean;
  department_wise: boolean;
  reminder_enabled: boolean;
  reminder_days: number[];
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  push_enabled: boolean;
  notes: string | null;
  updated_at: string;
}

export interface FollowupDoctorPolicy {
  id: string;
  hospital_id: string;
  doctor_name: string;
  department: string | null;
  enabled: boolean;
  window_days: number | null;
  max_visits: number | null;
  remarks: string | null;
}

export type EntitlementStatus = "active" | "used" | "expired" | "cancelled";

export interface FollowupEntitlement {
  id: string;
  hospital_id: string;
  patient_id: string | null;
  registration_number: string;
  patient_name: string;
  mobile: string;
  doctor_name: string;
  department: string | null;
  source_appointment_id: string | null;
  source_visit_date: string;
  expiry_date: string;
  max_visits: number;
  used_visits: number;
  status: EntitlementStatus;
  consent: boolean;
  created_at: string;
}

export interface FollowupVisit {
  id: string;
  hospital_id: string;
  entitlement_id: string;
  appointment_id: string | null;
  token_no: number | null;
  visit_date: string;
  doctor_name: string;
  status: string;
  channel: string;
  created_at: string;
}

export interface FollowupReminder {
  id: string;
  hospital_id: string;
  entitlement_id: string;
  channel: string;
  scheduled_for: string;
  offset_days: number;
  status: string;
  message: string | null;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
}

export interface FollowupAuditEntry {
  id: string;
  hospital_id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export const WINDOW_PRESETS = [7, 10, 15, 30] as const;

export const daysLeft = (expiry: string) =>
  Math.ceil((new Date(`${expiry}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);

export const formatIndian = (iso?: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
};