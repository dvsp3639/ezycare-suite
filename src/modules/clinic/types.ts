// Clinic Management Module Types

export interface DoctorSchedule {
  id: string;
  hospital_id: string;
  doctor_name: string;
  specialization: string;
  available_from: string;
  available_to: string;
  consultation_duration: number;
  schedule_date: string;
  created_at: string;
  updated_at: string;
  time_slots?: TimeSlot[];
}

export interface TimeSlot {
  id: string;
  hospital_id: string;
  schedule_id: string;
  time: string;
  max_patients: number;
  booked_patients: number;
  is_active: boolean;
}

export interface Appointment {
  id: string;
  hospital_id: string;
  token_no: number;
  patient_id: string | null;
  patient_name: string;
  registration_number: string;
  doctor_name: string;
  time_slot: string;
  opd_type: "Normal" | "Emergency" | "Follow Up";
  status: "Waiting" | "In Consultation" | "Completed" | "No Show";
  check_in_time: string;
  diagnosis: string;
  doctor_notes: string;
  follow_up_date: string | null;
  appointment_date: string;
  created_at: string;
  updated_at: string;
  vitals?: Vitals[];
  prescriptions?: Prescription[];
  lab_orders?: LabOrderRef[];
}

export interface Vitals {
  id: string;
  appointment_id: string;
  bp: string;
  temperature: string;
  weight: string;
  height: string;
  spo2: string;
  pulse: string;
  recorded_at: string;
}

export interface Prescription {
  id: string;
  appointment_id: string;
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  created_at: string;
}

export interface LabOrderRef {
  id: string;
  test_name: string;
  category: string;
  status: string;
}

export type AppointmentInsert = Omit<Appointment, "id" | "created_at" | "updated_at" | "hospital_id" | "vitals" | "prescriptions" | "lab_orders"> & {
  hospital_id?: string;
};
