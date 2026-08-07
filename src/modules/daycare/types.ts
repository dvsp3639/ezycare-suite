// Day Care Module Types

export interface DayCareTreatment {
  id: string;
  hospital_id: string;
  name: string;
  category: string;
  duration: string;
  price: number;
  description: string;
  created_at: string;
}

export interface DayCareSession {
  id: string;
  hospital_id: string;
  patient_id: string | null;
  patient_name: string;
  registration_number: string;
  age: number | null;
  gender: string;
  mobile: string;
  doctor_name: string;
  admission_time: string;
  status: "In Progress" | "Completed" | "Discharged";
  diagnosis: string;
  session_date: string;
  created_at: string;
  updated_at: string;
  treatments?: DayCareSessionTreatment[];
  bill?: DayCareBill;
}

export interface DayCareSessionTreatment {
  id: string;
  hospital_id: string;
  session_id: string;
  treatment_id: string | null;
  treatment_name: string;
  status: "Scheduled" | "In Progress" | "Completed";
  start_time: string | null;
  end_time: string | null;
  notes: string;
}

export interface DayCareBill {
  id: string;
  hospital_id: string;
  session_id: string;
  subtotal: number;
  discount: number;
  tax: number;
  grand_total: number;
  payment_status: "Pending" | "Partial" | "Paid";
  payment_mode: string | null;
  created_at: string;
  items?: DayCareBillItem[];
}

export interface DayCareBillItem {
  id: string;
  hospital_id: string;
  bill_id: string;
  description: string;
  category: "Treatment" | "Medicine" | "Consumable" | "Investigation" | "Other";
  qty: number;
  unit_price: number;
  total: number;
}

/* ── Day Care Case (enterprise workflow) ────────────────────────── */

export type DayCareStatus =
  | "Admitted"
  | "Under Treatment"
  | "Ready for Billing"
  | "Completed"
  | "Discharged"
  | "In Progress"; // legacy

export type DayCareItemType = "procedure" | "medicine" | "consumable" | "investigation";

export interface DayCareCaseItem {
  id: string;
  hospital_id: string;
  session_id: string;
  item_type: DayCareItemType;
  ref_id: string | null;
  name: string;
  qty: number;
  unit_price: number;
  total: number;
  dosage: string;
  frequency: string;
  duration: string;
  doctor_name: string;
  status: string;
  notes: string;
  created_at: string;
}

export interface DayCareTimelineEvent {
  id: string;
  hospital_id: string;
  session_id: string;
  event: string;
  details: string;
  actor: string;
  created_at: string;
}

export interface DayCareVitals {
  bp?: string;
  pulse?: string;
  temp?: string;
  spo2?: string;
  rr?: string;
  weight?: string;
}

export interface DayCareCase extends DayCareSession {
  department?: string;
  chief_complaint?: string;
  remarks?: string;
  notes?: string;
  vitals?: DayCareVitals;
  final_diagnosis?: string;
  doctor_advice?: string;
  discharge_medicines?: string;
  followup_date?: string | null;
  discharge_instructions?: string;
  doctor_charge?: number;
  nursing_charge?: number;
  items?: DayCareCaseItem[];
  timeline?: DayCareTimelineEvent[];
}
