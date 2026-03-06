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
