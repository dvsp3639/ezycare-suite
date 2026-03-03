import type { Department } from "./mockInventoryData";

// ──── Ward & Bed Types ────
export type WardType = "General" | "Semi-Private" | "Private" | "ICU" | "NICU" | "Isolation" | "Maternity" | "Pediatric";
export type BedStatus = "Available" | "Occupied" | "Under Maintenance";

export interface Ward {
  id: string;
  name: string;
  type: WardType;
  floor: string;
  totalBeds: number;
  chargePerDay: number;
}

export interface Bed {
  id: string;
  bedNumber: string;
  wardId: string;
  wardName: string;
  status: BedStatus;
  patientId?: string;
  patientName?: string;
  admissionId?: string;
}

// ──── IPD Admission ────
export type AdmissionStatus = "Active" | "Discharged" | "LAMA" | "Expired";

export interface IPDAdmission {
  id: string;
  patientId: string;
  patientName: string;
  registrationNumber: string;
  age: number;
  gender: string;
  contactNumber: string;
  referredBy: string;
  admittingDoctor: string;
  department: string;
  diagnosis: string;
  wardId: string;
  wardName: string;
  bedId: string;
  bedNumber: string;
  admissionDate: string;
  dischargeDate?: string;
  status: AdmissionStatus;
  emergencyContact: string;
  insuranceInfo?: string;
}

// ──── Daily Entries ────
export interface DoctorVisitNote {
  id: string;
  admissionId: string;
  date: string;
  time: string;
  doctor: string;
  notes: string;
  instructions: string;
}

export interface NurseNote {
  id: string;
  admissionId: string;
  date: string;
  time: string;
  nurse: string;
  vitals: { bp: string; temp: string; pulse: string; spo2: string };
  notes: string;
}

export interface MedicineEntry {
  id: string;
  admissionId: string;
  date: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SurgicalEntry {
  id: string;
  admissionId: string;
  date: string;
  procedureName: string;
  surgeon: string;
  notes: string;
  cost: number;
}

export interface DiagnosticEntry {
  id: string;
  admissionId: string;
  date: string;
  testName: string;
  result?: string;
  cost: number;
}

// ──── Discharge Summary ────
export interface DischargeSummary {
  id: string;
  admissionId: string;
  dischargeDate: string;
  conditionAtDischarge: string;
  finalDiagnosis: string;
  treatmentSummary: string;
  followUpDate?: string;
  followUpInstructions: string;
  medicationsOnDischarge: string;
  totalBill: number;
  paidAmount: number;
  paymentStatus: "Paid" | "Partial" | "Pending";
}

// ──── Bed Transfer ────
export interface BedTransfer {
  id: string;
  admissionId: string;
  patientName: string;
  fromWard: string;
  fromBed: string;
  toWard: string;
  toBed: string;
  reason: string;
  transferDate: string;
  transferredBy: string;
}

// ──── Mock Data ────
export const wardTypes: WardType[] = ["General", "Semi-Private", "Private", "ICU", "NICU", "Isolation", "Maternity", "Pediatric"];

export const mockWards: Ward[] = [
  { id: "w-1", name: "General Ward A", type: "General", floor: "Ground Floor", totalBeds: 20, chargePerDay: 500 },
  { id: "w-2", name: "General Ward B", type: "General", floor: "Ground Floor", totalBeds: 20, chargePerDay: 500 },
  { id: "w-3", name: "Semi-Private Ward", type: "Semi-Private", floor: "1st Floor", totalBeds: 10, chargePerDay: 1500 },
  { id: "w-4", name: "Private Ward", type: "Private", floor: "2nd Floor", totalBeds: 8, chargePerDay: 3000 },
  { id: "w-5", name: "ICU", type: "ICU", floor: "1st Floor", totalBeds: 6, chargePerDay: 8000 },
  { id: "w-6", name: "NICU", type: "NICU", floor: "1st Floor", totalBeds: 4, chargePerDay: 10000 },
  { id: "w-7", name: "Isolation Ward", type: "Isolation", floor: "Ground Floor", totalBeds: 4, chargePerDay: 2000 },
  { id: "w-8", name: "Maternity Ward", type: "Maternity", floor: "2nd Floor", totalBeds: 10, chargePerDay: 2500 },
];

const generateBeds = (): Bed[] => {
  const beds: Bed[] = [];
  const occupiedPatients = [
    { patientId: "1", patientName: "Rahul Verma", admissionId: "adm-1" },
    { patientId: "3", patientName: "Suresh Kumar", admissionId: "adm-2" },
  ];
  let patIdx = 0;

  mockWards.forEach((ward) => {
    for (let i = 1; i <= ward.totalBeds; i++) {
      const bedNum = `${ward.name.split(" ").map(w => w[0]).join("")}-${i.toString().padStart(2, "0")}`;
      let status: BedStatus = "Available";
      let patient: (typeof occupiedPatients)[0] | undefined;

      if (i <= 2 && patIdx < occupiedPatients.length) {
        status = "Occupied";
        patient = occupiedPatients[patIdx++];
      } else if (i === ward.totalBeds && ward.id === "w-5") {
        status = "Under Maintenance";
      }

      beds.push({
        id: `bed-${ward.id}-${i}`,
        bedNumber: bedNum,
        wardId: ward.id,
        wardName: ward.name,
        status,
        patientId: patient?.patientId,
        patientName: patient?.patientName,
        admissionId: patient?.admissionId,
      });
    }
  });
  return beds;
};

export const mockBeds: Bed[] = generateBeds();

export const mockAdmissions: IPDAdmission[] = [
  {
    id: "adm-1", patientId: "1", patientName: "Rahul Verma", registrationNumber: "EZY-2026-0001",
    age: 35, gender: "Male", contactNumber: "9876543210", referredBy: "Dr. Anil Mehta",
    admittingDoctor: "Dr. Anil Mehta", department: "General Medicine", diagnosis: "Acute Gastroenteritis",
    wardId: "w-1", wardName: "General Ward A", bedId: "bed-w-1-1", bedNumber: "GWA-01",
    admissionDate: "2026-03-01 10:30 AM", status: "Active", emergencyContact: "9876543200",
    insuranceInfo: "Star Health - Policy #SH123456",
  },
  {
    id: "adm-2", patientId: "3", patientName: "Suresh Kumar", registrationNumber: "EZY-2026-0003",
    age: 47, gender: "Male", contactNumber: "9123456789", referredBy: "Dr. Priya Singh",
    admittingDoctor: "Dr. Priya Singh", department: "Cardiology", diagnosis: "Unstable Angina",
    wardId: "w-5", wardName: "ICU", bedId: "bed-w-5-1", bedNumber: "I-01",
    admissionDate: "2026-02-28 08:00 AM", status: "Active", emergencyContact: "9123456700",
  },
  {
    id: "adm-3", patientId: "2", patientName: "Anita Sharma", registrationNumber: "EZY-2026-0002",
    age: 40, gender: "Female", contactNumber: "9876543210", referredBy: "Dr. Sneha Gupta",
    admittingDoctor: "Dr. Sneha Gupta", department: "General Medicine", diagnosis: "Pneumonia",
    wardId: "w-1", wardName: "General Ward A", bedId: "bed-w-1-2", bedNumber: "GWA-02",
    admissionDate: "2026-02-25 02:00 PM", dischargeDate: "2026-03-01 11:00 AM", status: "Discharged",
    emergencyContact: "9876543201",
  },
];

export const mockDoctorNotes: DoctorVisitNote[] = [
  { id: "dn-1", admissionId: "adm-1", date: "2026-03-01", time: "11:00 AM", doctor: "Dr. Anil Mehta", notes: "Patient complains of abdominal pain and loose stools. Started on IV fluids and antibiotics.", instructions: "Monitor vitals every 4 hours. NPO for 6 hours." },
  { id: "dn-2", admissionId: "adm-1", date: "2026-03-02", time: "09:00 AM", doctor: "Dr. Anil Mehta", notes: "Patient improving. Tolerating oral fluids. Continue antibiotics.", instructions: "Start soft diet. Continue monitoring." },
  { id: "dn-3", admissionId: "adm-2", date: "2026-02-28", time: "09:00 AM", doctor: "Dr. Priya Singh", notes: "ECG shows ST depression. Troponin elevated. Started on dual antiplatelet therapy.", instructions: "Strict bed rest. Continuous cardiac monitoring. Serial troponins q6h." },
  { id: "dn-4", admissionId: "adm-2", date: "2026-03-01", time: "10:00 AM", doctor: "Dr. Priya Singh", notes: "Troponin trending down. Patient stable. Echo shows EF 45%.", instructions: "Continue medications. Plan for angiography tomorrow." },
];

export const mockNurseNotes: NurseNote[] = [
  { id: "nn-1", admissionId: "adm-1", date: "2026-03-01", time: "12:00 PM", nurse: "Nurse Priya", vitals: { bp: "110/70", temp: "99.2°F", pulse: "88", spo2: "97%" }, notes: "IV fluids running. Patient resting." },
  { id: "nn-2", admissionId: "adm-1", date: "2026-03-01", time: "04:00 PM", nurse: "Nurse Kavita", vitals: { bp: "118/76", temp: "98.8°F", pulse: "82", spo2: "98%" }, notes: "Patient took oral fluids well." },
  { id: "nn-3", admissionId: "adm-2", date: "2026-02-28", time: "10:00 AM", nurse: "Nurse Priya", vitals: { bp: "150/95", temp: "98.4°F", pulse: "92", spo2: "95%" }, notes: "Patient on continuous monitoring. Chest pain reduced after medication." },
];

export const mockMedicineEntries: MedicineEntry[] = [
  { id: "me-1", admissionId: "adm-1", date: "2026-03-01", medicineName: "Ciprofloxacin 500mg", dosage: "500mg", frequency: "BD", quantity: 2, unitPrice: 15, total: 30 },
  { id: "me-2", admissionId: "adm-1", date: "2026-03-01", medicineName: "Ondansetron 4mg", dosage: "4mg", frequency: "TDS", quantity: 3, unitPrice: 12, total: 36 },
  { id: "me-3", admissionId: "adm-1", date: "2026-03-02", medicineName: "Ciprofloxacin 500mg", dosage: "500mg", frequency: "BD", quantity: 2, unitPrice: 15, total: 30 },
  { id: "me-4", admissionId: "adm-2", date: "2026-02-28", medicineName: "Aspirin 150mg", dosage: "150mg", frequency: "OD", quantity: 1, unitPrice: 5, total: 5 },
  { id: "me-5", admissionId: "adm-2", date: "2026-02-28", medicineName: "Clopidogrel 75mg", dosage: "75mg", frequency: "OD", quantity: 1, unitPrice: 18, total: 18 },
  { id: "me-6", admissionId: "adm-2", date: "2026-02-28", medicineName: "Atorvastatin 40mg", dosage: "40mg", frequency: "HS", quantity: 1, unitPrice: 22, total: 22 },
];

export const mockSurgicalEntries: SurgicalEntry[] = [
  { id: "se-1", admissionId: "adm-2", date: "2026-03-02", procedureName: "Coronary Angiography", surgeon: "Dr. Priya Singh", notes: "Diagnostic angiography performed. Single vessel disease identified.", cost: 25000 },
];

export const mockDiagnosticEntries: DiagnosticEntry[] = [
  { id: "de-1", admissionId: "adm-1", date: "2026-03-01", testName: "CBC", cost: 350, result: "WBC elevated" },
  { id: "de-2", admissionId: "adm-1", date: "2026-03-01", testName: "Stool Culture", cost: 500 },
  { id: "de-3", admissionId: "adm-2", date: "2026-02-28", testName: "Troponin I", cost: 800, result: "2.5 ng/mL (High)" },
  { id: "de-4", admissionId: "adm-2", date: "2026-02-28", testName: "ECG", cost: 200, result: "ST depression in V3-V6" },
  { id: "de-5", admissionId: "adm-2", date: "2026-03-01", testName: "2D Echo", cost: 2500, result: "EF 45%, mild MR" },
];

export const mockBedTransfers: BedTransfer[] = [
  { id: "bt-1", admissionId: "adm-2", patientName: "Suresh Kumar", fromWard: "Emergency", fromBed: "ER-01", toWard: "ICU", toBed: "I-01", reason: "Critical condition requiring monitoring", transferDate: "2026-02-28 08:30 AM", transferredBy: "Dr. Priya Singh" },
];

export const mockDischargeSummaries: DischargeSummary[] = [
  {
    id: "ds-1", admissionId: "adm-3", dischargeDate: "2026-03-01 11:00 AM",
    conditionAtDischarge: "Stable, afebrile for 48 hours",
    finalDiagnosis: "Community Acquired Pneumonia",
    treatmentSummary: "IV antibiotics (Ceftriaxone + Azithromycin) for 5 days, then switched to oral. Supportive care with nebulization.",
    followUpDate: "2026-03-08", followUpInstructions: "Follow up with Dr. Sneha Gupta. Continue oral antibiotics for 3 more days. Repeat chest X-ray if symptoms persist.",
    medicationsOnDischarge: "Tab. Amoxicillin-Clavulanate 625mg BD x 3 days, Tab. Paracetamol SOS, Cough syrup 10ml TDS",
    totalBill: 18500, paidAmount: 18500, paymentStatus: "Paid",
  },
];

// ──── Helpers ────
export const bedStatusColors: Record<BedStatus, string> = {
  Available: "bg-success/20 text-success border-success/40",
  Occupied: "bg-destructive/20 text-destructive border-destructive/40",
  "Under Maintenance": "bg-muted text-muted-foreground border-border",
};

export const wardTypeColors: Record<WardType, string> = {
  General: "bg-primary/10 text-primary",
  "Semi-Private": "bg-info/10 text-info",
  Private: "bg-success/10 text-success",
  ICU: "bg-destructive/10 text-destructive",
  NICU: "bg-warning/10 text-warning",
  Isolation: "bg-muted text-muted-foreground",
  Maternity: "bg-accent text-accent-foreground",
  Pediatric: "bg-info/10 text-info",
};
