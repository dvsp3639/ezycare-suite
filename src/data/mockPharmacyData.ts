export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  category: string;
  manufacturer: string;
  batchNo: string;
  expiryDate: string;
  mrp: number;
  stock: number;
  unit: string;
  hsnCode: string;
  gstPercent: number;
}

export interface PharmacyOrderItem {
  medicineId: string;
  medicineName: string;
  batchNo: string;
  quantity: number;
  mrp: number;
  discount: number;
  gstPercent: number;
  amount: number;
}

export interface PharmacyOrder {
  id: string;
  issueType: "IP Sale" | "IP Return" | "OP Sale" | "OP Return";
  patientName: string;
  registrationNumber: string;
  mobile: string;
  age: number;
  gender: string;
  doctorName: string;
  issueDate: string;
  items: PharmacyOrderItem[];
  totalAmount: number;
  discount: number;
  gstAmount: number;
  netAmount: number;
  paymentMode: "Cash" | "Credit" | "";
  status: "Draft" | "Completed";
}

export const mockMedicines: Medicine[] = [
  { id: "m1", name: "Paracetamol 500mg", genericName: "Paracetamol", category: "Analgesic", manufacturer: "Cipla", batchNo: "B2026-001", expiryDate: "2027-06-30", mrp: 25, stock: 500, unit: "Strip (10)", hsnCode: "3004", gstPercent: 12 },
  { id: "m2", name: "Amoxicillin 500mg", genericName: "Amoxicillin", category: "Antibiotic", manufacturer: "Sun Pharma", batchNo: "B2026-002", expiryDate: "2027-03-15", mrp: 85, stock: 200, unit: "Strip (10)", hsnCode: "3004", gstPercent: 12 },
  { id: "m3", name: "Metformin 500mg", genericName: "Metformin", category: "Antidiabetic", manufacturer: "USV Ltd", batchNo: "B2026-003", expiryDate: "2027-09-30", mrp: 45, stock: 350, unit: "Strip (10)", hsnCode: "3004", gstPercent: 12 },
  { id: "m4", name: "Amlodipine 5mg", genericName: "Amlodipine", category: "Antihypertensive", manufacturer: "Torrent Pharma", batchNo: "B2026-004", expiryDate: "2027-12-31", mrp: 55, stock: 280, unit: "Strip (10)", hsnCode: "3004", gstPercent: 12 },
  { id: "m5", name: "Omeprazole 20mg", genericName: "Omeprazole", category: "Antacid", manufacturer: "Dr. Reddy's", batchNo: "B2026-005", expiryDate: "2027-08-15", mrp: 65, stock: 400, unit: "Strip (10)", hsnCode: "3004", gstPercent: 12 },
  { id: "m6", name: "Cetirizine 10mg", genericName: "Cetirizine", category: "Antihistamine", manufacturer: "Cipla", batchNo: "B2026-006", expiryDate: "2027-05-31", mrp: 30, stock: 600, unit: "Strip (10)", hsnCode: "3004", gstPercent: 12 },
  { id: "m7", name: "Azithromycin 500mg", genericName: "Azithromycin", category: "Antibiotic", manufacturer: "Alkem Labs", batchNo: "B2026-007", expiryDate: "2027-07-20", mrp: 120, stock: 150, unit: "Strip (3)", hsnCode: "3004", gstPercent: 12 },
  { id: "m8", name: "Diclofenac 50mg", genericName: "Diclofenac", category: "NSAID", manufacturer: "Novartis", batchNo: "B2026-008", expiryDate: "2027-04-30", mrp: 35, stock: 450, unit: "Strip (10)", hsnCode: "3004", gstPercent: 12 },
  { id: "m9", name: "Atorvastatin 20mg", genericName: "Atorvastatin", category: "Statin", manufacturer: "Ranbaxy", batchNo: "B2026-009", expiryDate: "2027-11-30", mrp: 90, stock: 220, unit: "Strip (10)", hsnCode: "3004", gstPercent: 12 },
  { id: "m10", name: "Pantoprazole 40mg", genericName: "Pantoprazole", category: "Antacid", manufacturer: "Alkem Labs", batchNo: "B2026-010", expiryDate: "2027-10-15", mrp: 75, stock: 320, unit: "Strip (10)", hsnCode: "3004", gstPercent: 12 },
  { id: "m11", name: "Vitamin D3 60000 IU", genericName: "Cholecalciferol", category: "Supplement", manufacturer: "Abbott", batchNo: "B2026-011", expiryDate: "2028-01-31", mrp: 40, stock: 180, unit: "Capsule (4)", hsnCode: "3004", gstPercent: 12 },
  { id: "m12", name: "Calcium + D3 Tablet", genericName: "Calcium Carbonate", category: "Supplement", manufacturer: "Abbott", batchNo: "B2026-012", expiryDate: "2027-12-15", mrp: 150, stock: 250, unit: "Strip (15)", hsnCode: "3004", gstPercent: 12 },
  { id: "m13", name: "Clopidogrel 75mg", genericName: "Clopidogrel", category: "Antiplatelet", manufacturer: "Sun Pharma", batchNo: "B2026-013", expiryDate: "2027-09-30", mrp: 110, stock: 190, unit: "Strip (10)", hsnCode: "3004", gstPercent: 12 },
  { id: "m14", name: "Telmisartan 40mg", genericName: "Telmisartan", category: "Antihypertensive", manufacturer: "Glenmark", batchNo: "B2026-014", expiryDate: "2027-06-30", mrp: 70, stock: 300, unit: "Strip (10)", hsnCode: "3004", gstPercent: 12 },
  { id: "m15", name: "ORS Sachets", genericName: "ORS", category: "Rehydration", manufacturer: "Cipla", batchNo: "B2026-015", expiryDate: "2028-03-31", mrp: 20, stock: 800, unit: "Sachet", hsnCode: "3004", gstPercent: 5 },
];

export const sampleDoctorPrescriptions = [
  {
    doctorName: "Dr. Anil Mehta",
    patientRegNo: "EZY-2026-0001",
    items: [
      { medicineName: "Metformin 500mg", dosage: "Twice daily", quantity: 2 },
      { medicineName: "Vitamin D3 60000 IU", dosage: "Weekly", quantity: 1 },
    ],
  },
  {
    doctorName: "Dr. Priya Singh",
    patientRegNo: "EZY-2026-0003",
    items: [
      { medicineName: "Amlodipine 5mg", dosage: "Morning", quantity: 3 },
      { medicineName: "Telmisartan 40mg", dosage: "Morning", quantity: 3 },
      { medicineName: "Clopidogrel 75mg", dosage: "Morning", quantity: 3 },
    ],
  },
  {
    doctorName: "Dr. Sneha Gupta",
    patientRegNo: "EZY-2026-0006",
    items: [
      { medicineName: "Paracetamol 500mg", dosage: "3x daily", quantity: 1 },
      { medicineName: "ORS Sachets", dosage: "As needed", quantity: 5 },
      { medicineName: "Cetirizine 10mg", dosage: "At night", quantity: 1 },
    ],
  },
  {
    doctorName: "Dr. Ravi Patel",
    patientRegNo: "EZY-2026-0005",
    items: [
      { medicineName: "Diclofenac 50mg", dosage: "Twice daily", quantity: 2 },
      { medicineName: "Calcium + D3 Tablet", dosage: "Once daily", quantity: 2 },
    ],
  },
];
