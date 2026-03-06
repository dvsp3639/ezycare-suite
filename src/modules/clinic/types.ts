// Clinic Management Module Types

export interface DoctorSchedule {
  id: string;
  hospitalId: string;
  doctorName: string;
  specialization: string;
  availableFrom: string;
  availableTo: string;
  consultationDuration: number;
  scheduleDate: string;
  createdAt: string;
  updatedAt: string;
  timeSlots?: TimeSlot[];
}

export interface TimeSlot {
  id: string;
  hospitalId: string;
  scheduleId: string;
  time: string;
  maxPatients: number;
  bookedPatients: number;
  isActive: boolean;
}

export interface Appointment {
  id: string;
  hospitalId: string;
  tokenNo: number;
  patientId: string | null;
  patientName: string;
  registrationNumber: string;
  doctorName: string;
  timeSlot: string;
  opdType: "Normal" | "Emergency" | "Follow Up";
  status: "Waiting" | "In Consultation" | "Completed" | "No Show";
  checkInTime: string;
  diagnosis: string;
  doctorNotes: string;
  followUpDate: string | null;
  appointmentDate: string;
  createdAt: string;
  updatedAt: string;
  vitals?: Vitals[];
  prescriptions?: Prescription[];
  labOrders?: LabOrderRef[];
}

export interface Vitals {
  id: string;
  appointmentId: string;
  bp: string;
  temperature: string;
  weight: string;
  height: string;
  spo2: string;
  pulse: string;
  recordedAt: string;
}

export interface Prescription {
  id: string;
  appointmentId: string;
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  createdAt: string;
}

export interface LabOrderRef {
  id: string;
  testName: string;
  category: string;
  status: string;
}

export type AppointmentInsert = Omit<Appointment, "id" | "createdAt" | "updatedAt" | "hospitalId" | "vitals" | "prescriptions" | "labOrders"> & {
  hospitalId?: string;
};
