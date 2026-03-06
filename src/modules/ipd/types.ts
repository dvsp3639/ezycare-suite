// IPD Module Types

export type WardType = "General" | "Semi-Private" | "Private" | "ICU" | "NICU" | "Isolation" | "Maternity" | "Pediatric";
export type BedStatus = "Available" | "Occupied" | "Under Maintenance";
export type AdmissionStatus = "Active" | "Discharged" | "LAMA" | "Expired";

export interface Ward {
  id: string;
  hospital_id: string;
  name: string;
  type: WardType;
  floor: string;
  total_beds: number;
  charge_per_day: number;
  created_at: string;
  beds?: Bed[];
}

export interface Bed {
  id: string;
  hospital_id: string;
  ward_id: string;
  bed_number: string;
  status: BedStatus;
  patient_id: string | null;
  admission_id: string | null;
  created_at: string;
}

export interface IPDAdmission {
  id: string;
  hospital_id: string;
  patient_id: string | null;
  patient_name: string;
  registration_number: string;
  age: number | null;
  gender: string;
  contact_number: string;
  referred_by: string;
  admitting_doctor: string;
  department: string;
  diagnosis: string;
  ward_id: string | null;
  ward_name: string;
  bed_id: string | null;
  bed_number: string;
  admission_date: string;
  discharge_date: string | null;
  status: AdmissionStatus;
  emergency_contact: string;
  insurance_info: string;
  created_at: string;
  updated_at: string;
}

export interface DoctorVisitNote {
  id: string;
  hospital_id: string;
  admission_id: string;
  visit_date: string;
  visit_time: string;
  doctor: string;
  notes: string;
  instructions: string;
  created_at: string;
}

export interface NurseNote {
  id: string;
  hospital_id: string;
  admission_id: string;
  note_date: string;
  note_time: string;
  nurse: string;
  bp: string;
  temp: string;
  pulse: string;
  spo2: string;
  notes: string;
  created_at: string;
}

export interface MedicineEntry {
  id: string;
  hospital_id: string;
  admission_id: string;
  entry_date: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
}

export interface SurgicalEntry {
  id: string;
  hospital_id: string;
  admission_id: string;
  entry_date: string;
  procedure_name: string;
  surgeon: string;
  notes: string;
  cost: number;
  created_at: string;
}

export interface DiagnosticEntry {
  id: string;
  hospital_id: string;
  admission_id: string;
  entry_date: string;
  test_name: string;
  result: string;
  cost: number;
  created_at: string;
}

export interface DischargeSummary {
  id: string;
  hospital_id: string;
  admission_id: string;
  discharge_date: string;
  condition_at_discharge: string;
  final_diagnosis: string;
  treatment_summary: string;
  follow_up_date: string | null;
  follow_up_instructions: string;
  medications_on_discharge: string;
  total_bill: number;
  paid_amount: number;
  payment_status: "Paid" | "Partial" | "Pending";
  created_at: string;
}

export interface BedTransfer {
  id: string;
  hospital_id: string;
  admission_id: string;
  patient_name: string;
  from_ward: string;
  from_bed: string;
  to_ward: string;
  to_bed: string;
  reason: string;
  transfer_date: string;
  transferred_by: string;
  created_at: string;
}
