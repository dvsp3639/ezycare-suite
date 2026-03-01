export interface TimeSlot {
  time: string;
  maxPatients: number;
  bookedPatients: number;
  isActive: boolean;
}

export interface DoctorSchedule {
  id: string;
  doctorName: string;
  specialization: string;
  availableFrom: string;
  availableTo: string;
  consultationDuration: number; // minutes
  timeSlots: TimeSlot[];
}

export interface Vitals {
  bp: string;
  temperature: string;
  weight: string;
  height: string;
  spo2: string;
  pulse: string;
}

export interface PrescriptionItem {
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export type LabCategory = "Blood" | "Urine" | "Radiology" | "Serology";

export interface LabResult {
  parameter: string;
  value: string;
  unit: string;
  normalRange: string;
  isAbnormal: boolean;
}

export interface LabOrder {
  id: string;
  testName: string;
  category: LabCategory;
  priority: "Routine" | "Urgent";
  status: "Ordered" | "Sample Collected" | "In Progress" | "Completed";
  clinicalNotes?: string;
  orderedBy: string;
  orderedAt: string;
  patientName: string;
  patientRegNo: string;
  sampleCollectedAt?: string;
  completedAt?: string;
  results?: LabResult[];
  reportNotes?: string;
}

export interface QueueEntry {
  id: string;
  tokenNo: number;
  patientName: string;
  registrationNumber: string;
  doctorName: string;
  timeSlot: string;
  opdType: "Normal" | "Emergency" | "Follow Up";
  status: "Waiting" | "In Consultation" | "Completed" | "No Show";
  checkInTime: string;
  diagnosis?: string;
  prescription?: string[];
  structuredPrescription?: PrescriptionItem[];
  doctorNotes?: string;
  vitals?: Vitals;
  labOrders?: LabOrder[];
  followUpDate?: string;
}

export interface PatientVisit {
  id: string;
  date: string;
  doctor: string;
  diagnosis: string;
  prescription: string[];
  notes: string;
  opdType: "Normal" | "Emergency" | "Follow Up";
}

export interface ClinicPatient {
  id: string;
  registrationNumber: string;
  name: string;
  mobile: string;
  gender: "Male" | "Female" | "Other";
  age: number;
  lastVisit: string;
  totalVisits: number;
  doctor: string;
  diagnosis: string;
  visitHistory: PatientVisit[];
}

export const mockDoctorSchedules: DoctorSchedule[] = [
  {
    id: "d1",
    doctorName: "Dr. Anil Mehta",
    specialization: "General Medicine",
    availableFrom: "9:00 AM",
    availableTo: "4:00 PM",
    consultationDuration: 30,
    timeSlots: [
      { time: "9:00 AM", maxPatients: 5, bookedPatients: 5, isActive: true },
      { time: "9:30 AM", maxPatients: 5, bookedPatients: 3, isActive: true },
      { time: "10:00 AM", maxPatients: 5, bookedPatients: 4, isActive: true },
      { time: "10:30 AM", maxPatients: 5, bookedPatients: 2, isActive: true },
      { time: "11:00 AM", maxPatients: 5, bookedPatients: 0, isActive: true },
      { time: "11:30 AM", maxPatients: 5, bookedPatients: 1, isActive: true },
      { time: "2:00 PM", maxPatients: 5, bookedPatients: 3, isActive: true },
      { time: "2:30 PM", maxPatients: 5, bookedPatients: 0, isActive: true },
      { time: "3:00 PM", maxPatients: 5, bookedPatients: 0, isActive: true },
      { time: "3:30 PM", maxPatients: 5, bookedPatients: 2, isActive: false },
    ],
  },
  {
    id: "d2",
    doctorName: "Dr. Priya Singh",
    specialization: "Cardiology",
    availableFrom: "9:00 AM",
    availableTo: "3:00 PM",
    consultationDuration: 30,
    timeSlots: [
      { time: "9:00 AM", maxPatients: 3, bookedPatients: 3, isActive: true },
      { time: "9:30 AM", maxPatients: 3, bookedPatients: 2, isActive: true },
      { time: "10:00 AM", maxPatients: 3, bookedPatients: 1, isActive: true },
      { time: "10:30 AM", maxPatients: 3, bookedPatients: 0, isActive: true },
      { time: "11:00 AM", maxPatients: 3, bookedPatients: 3, isActive: true },
      { time: "11:30 AM", maxPatients: 3, bookedPatients: 0, isActive: false },
      { time: "2:00 PM", maxPatients: 3, bookedPatients: 1, isActive: true },
      { time: "2:30 PM", maxPatients: 3, bookedPatients: 0, isActive: true },
    ],
  },
  {
    id: "d3",
    doctorName: "Dr. Ravi Patel",
    specialization: "Orthopedics",
    availableFrom: "10:00 AM",
    availableTo: "3:30 PM",
    consultationDuration: 30,
    timeSlots: [
      { time: "10:00 AM", maxPatients: 4, bookedPatients: 4, isActive: true },
      { time: "10:30 AM", maxPatients: 4, bookedPatients: 3, isActive: true },
      { time: "11:00 AM", maxPatients: 4, bookedPatients: 2, isActive: true },
      { time: "11:30 AM", maxPatients: 4, bookedPatients: 1, isActive: true },
      { time: "2:00 PM", maxPatients: 4, bookedPatients: 0, isActive: true },
      { time: "2:30 PM", maxPatients: 4, bookedPatients: 0, isActive: true },
      { time: "3:00 PM", maxPatients: 4, bookedPatients: 2, isActive: true },
    ],
  },
  {
    id: "d4",
    doctorName: "Dr. Sneha Gupta",
    specialization: "Pediatrics",
    availableFrom: "9:00 AM",
    availableTo: "3:30 PM",
    consultationDuration: 30,
    timeSlots: [
      { time: "9:00 AM", maxPatients: 6, bookedPatients: 4, isActive: true },
      { time: "9:30 AM", maxPatients: 6, bookedPatients: 6, isActive: true },
      { time: "10:00 AM", maxPatients: 6, bookedPatients: 2, isActive: true },
      { time: "10:30 AM", maxPatients: 6, bookedPatients: 0, isActive: true },
      { time: "11:00 AM", maxPatients: 6, bookedPatients: 5, isActive: true },
      { time: "2:00 PM", maxPatients: 6, bookedPatients: 3, isActive: true },
      { time: "2:30 PM", maxPatients: 6, bookedPatients: 1, isActive: true },
      { time: "3:00 PM", maxPatients: 6, bookedPatients: 0, isActive: true },
    ],
  },
];

export const mockQueue: QueueEntry[] = [
  { id: "q1", tokenNo: 1, patientName: "Rahul Verma", registrationNumber: "EZY-2026-0001", doctorName: "Dr. Anil Mehta", timeSlot: "9:00 AM", opdType: "Normal", status: "Completed", checkInTime: "08:45 AM" },
  { id: "q2", tokenNo: 2, patientName: "Anita Sharma", registrationNumber: "EZY-2026-0002", doctorName: "Dr. Anil Mehta", timeSlot: "9:00 AM", opdType: "Follow Up", status: "Completed", checkInTime: "08:50 AM" },
  { id: "q3", tokenNo: 3, patientName: "Suresh Kumar", registrationNumber: "EZY-2026-0003", doctorName: "Dr. Priya Singh", timeSlot: "9:00 AM", opdType: "Normal", status: "In Consultation", checkInTime: "08:55 AM" },
  { id: "q4", tokenNo: 4, patientName: "Meena Devi", registrationNumber: "EZY-2026-0004", doctorName: "Dr. Anil Mehta", timeSlot: "9:30 AM", opdType: "Emergency", status: "Waiting", checkInTime: "09:10 AM" },
  { id: "q5", tokenNo: 5, patientName: "Vikram Singh", registrationNumber: "EZY-2026-0005", doctorName: "Dr. Ravi Patel", timeSlot: "10:00 AM", opdType: "Normal", status: "Waiting", checkInTime: "09:30 AM" },
  { id: "q6", tokenNo: 6, patientName: "Pooja Nair", registrationNumber: "EZY-2026-0006", doctorName: "Dr. Sneha Gupta", timeSlot: "9:00 AM", opdType: "Normal", status: "Waiting", checkInTime: "09:35 AM" },
  { id: "q7", tokenNo: 7, patientName: "Arjun Reddy", registrationNumber: "EZY-2026-0007", doctorName: "Dr. Priya Singh", timeSlot: "9:30 AM", opdType: "Follow Up", status: "Waiting", checkInTime: "09:40 AM" },
  { id: "q8", tokenNo: 8, patientName: "Lakshmi Iyer", registrationNumber: "EZY-2026-0008", doctorName: "Dr. Anil Mehta", timeSlot: "10:00 AM", opdType: "Normal", status: "No Show", checkInTime: "" },
];

export const mockClinicPatients: ClinicPatient[] = [
  {
    id: "1", registrationNumber: "EZY-2026-0001", name: "Rahul Verma", mobile: "9876543210", gender: "Male", age: 36, lastVisit: "2026-02-28", totalVisits: 8, doctor: "Dr. Anil Mehta", diagnosis: "Type 2 Diabetes",
    visitHistory: [
      { id: "v1", date: "2026-02-28", doctor: "Dr. Anil Mehta", diagnosis: "Type 2 Diabetes", prescription: ["Metformin 500mg – twice daily", "Glimepiride 1mg – morning"], notes: "HbA1c at 7.2%, advised diet control", opdType: "Follow Up" },
      { id: "v2", date: "2026-02-10", doctor: "Dr. Anil Mehta", diagnosis: "Type 2 Diabetes", prescription: ["Metformin 500mg – twice daily"], notes: "Blood sugar fasting 148mg/dL, added monitoring", opdType: "Follow Up" },
      { id: "v3", date: "2026-01-15", doctor: "Dr. Anil Mehta", diagnosis: "Type 2 Diabetes – Initial", prescription: ["Metformin 500mg – once daily", "Vitamin D3 60k – weekly"], notes: "Newly diagnosed, referred for diabetic eye screening", opdType: "Normal" },
    ],
  },
  {
    id: "2", registrationNumber: "EZY-2026-0002", name: "Anita Sharma", mobile: "9876543211", gender: "Female", age: 41, lastVisit: "2026-02-28", totalVisits: 3, doctor: "Dr. Anil Mehta", diagnosis: "Seasonal Allergy",
    visitHistory: [
      { id: "v4", date: "2026-02-28", doctor: "Dr. Anil Mehta", diagnosis: "Seasonal Allergy", prescription: ["Cetirizine 10mg – at night", "Nasal spray – twice daily"], notes: "Recurring sneezing, itchy eyes", opdType: "Follow Up" },
      { id: "v5", date: "2026-01-20", doctor: "Dr. Anil Mehta", diagnosis: "Seasonal Allergy", prescription: ["Cetirizine 10mg – at night"], notes: "Mild symptoms, monitor", opdType: "Normal" },
    ],
  },
  {
    id: "3", registrationNumber: "EZY-2026-0003", name: "Suresh Kumar", mobile: "9123456789", gender: "Male", age: 48, lastVisit: "2026-02-27", totalVisits: 12, doctor: "Dr. Priya Singh", diagnosis: "Hypertension",
    visitHistory: [
      { id: "v6", date: "2026-02-27", doctor: "Dr. Priya Singh", diagnosis: "Hypertension", prescription: ["Amlodipine 5mg – morning", "Telmisartan 40mg – morning", "Aspirin 75mg – after lunch"], notes: "BP 150/95, dosage adjusted", opdType: "Follow Up" },
      { id: "v7", date: "2026-02-01", doctor: "Dr. Priya Singh", diagnosis: "Hypertension", prescription: ["Amlodipine 5mg – morning", "Telmisartan 40mg – morning"], notes: "BP 140/90, stable", opdType: "Follow Up" },
      { id: "v8", date: "2026-01-05", doctor: "Dr. Priya Singh", diagnosis: "Hypertension", prescription: ["Amlodipine 5mg – morning"], notes: "ECG normal, started on medication", opdType: "Normal" },
    ],
  },
  {
    id: "4", registrationNumber: "EZY-2026-0004", name: "Meena Devi", mobile: "9988776655", gender: "Female", age: 55, lastVisit: "2026-02-28", totalVisits: 5, doctor: "Dr. Anil Mehta", diagnosis: "Chronic Back Pain",
    visitHistory: [
      { id: "v9", date: "2026-02-28", doctor: "Dr. Anil Mehta", diagnosis: "Chronic Back Pain", prescription: ["Diclofenac 50mg – twice daily", "Thiocolchicoside 4mg – twice daily", "Calcium + Vit D3"], notes: "MRI shows L4-L5 disc bulge, referred to ortho", opdType: "Emergency" },
      { id: "v10", date: "2026-02-15", doctor: "Dr. Ravi Patel", diagnosis: "Lower Back Pain", prescription: ["Ibuprofen 400mg – as needed", "Physiotherapy referral"], notes: "X-ray normal, advised MRI", opdType: "Normal" },
    ],
  },
  {
    id: "5", registrationNumber: "EZY-2026-0005", name: "Vikram Singh", mobile: "9112233445", gender: "Male", age: 29, lastVisit: "2026-02-26", totalVisits: 2, doctor: "Dr. Ravi Patel", diagnosis: "Knee Injury",
    visitHistory: [
      { id: "v11", date: "2026-02-26", doctor: "Dr. Ravi Patel", diagnosis: "ACL Tear – Right Knee", prescription: ["Aceclofenac 100mg – twice daily", "Knee brace advised", "Ice pack 3x daily"], notes: "MRI confirms partial ACL tear, surgery discussion pending", opdType: "Normal" },
      { id: "v12", date: "2026-02-20", doctor: "Dr. Ravi Patel", diagnosis: "Knee Injury", prescription: ["Paracetamol 500mg – SOS"], notes: "Sports injury, advised MRI", opdType: "Normal" },
    ],
  },
  {
    id: "6", registrationNumber: "EZY-2026-0006", name: "Pooja Nair", mobile: "9223344556", gender: "Female", age: 7, lastVisit: "2026-02-28", totalVisits: 4, doctor: "Dr. Sneha Gupta", diagnosis: "Viral Fever",
    visitHistory: [
      { id: "v13", date: "2026-02-28", doctor: "Dr. Sneha Gupta", diagnosis: "Viral Fever", prescription: ["Paracetamol syrup – 5ml 3x daily", "ORS – as needed", "Zinc syrup – 5ml daily"], notes: "Temp 101°F, throat congestion, follow up in 3 days", opdType: "Normal" },
      { id: "v14", date: "2026-01-10", doctor: "Dr. Sneha Gupta", diagnosis: "Common Cold", prescription: ["Cetirizine syrup – 2.5ml at night"], notes: "Mild, no fever", opdType: "Normal" },
    ],
  },
  {
    id: "7", registrationNumber: "EZY-2026-0007", name: "Arjun Reddy", mobile: "9334455667", gender: "Male", age: 62, lastVisit: "2026-02-25", totalVisits: 15, doctor: "Dr. Priya Singh", diagnosis: "Coronary Artery Disease",
    visitHistory: [
      { id: "v15", date: "2026-02-25", doctor: "Dr. Priya Singh", diagnosis: "Coronary Artery Disease", prescription: ["Atorvastatin 20mg – night", "Clopidogrel 75mg – morning", "Metoprolol 25mg – twice daily", "Aspirin 75mg – after lunch"], notes: "Stable angina, echo shows EF 50%, continue current regime", opdType: "Follow Up" },
      { id: "v16", date: "2026-01-28", doctor: "Dr. Priya Singh", diagnosis: "CAD – Routine Check", prescription: ["Atorvastatin 20mg – night", "Clopidogrel 75mg – morning", "Metoprolol 25mg – twice daily"], notes: "Lipid profile improved, LDL at 100", opdType: "Follow Up" },
    ],
  },
  {
    id: "8", registrationNumber: "EZY-2026-0008", name: "Lakshmi Iyer", mobile: "9445566778", gender: "Female", age: 33, lastVisit: "2026-02-24", totalVisits: 1, doctor: "Dr. Anil Mehta", diagnosis: "Migraine",
    visitHistory: [
      { id: "v17", date: "2026-02-24", doctor: "Dr. Anil Mehta", diagnosis: "Migraine", prescription: ["Sumatriptan 50mg – SOS", "Propranolol 20mg – twice daily"], notes: "Frequent episodes 3-4/month, started prophylaxis", opdType: "Normal" },
    ],
  },
];
