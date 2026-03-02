export interface DayCareTreatment {
  id: string;
  name: string;
  category: string;
  duration: string;
  price: number;
  description: string;
}

export interface DayCareBillingItem {
  id: string;
  description: string;
  category: "Treatment" | "Medicine" | "Consumable" | "Investigation" | "Other";
  qty: number;
  unitPrice: number;
  total: number;
}

export interface DayCareBill {
  id: string;
  patientId: string;
  items: DayCareBillingItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paymentStatus: "Pending" | "Partial" | "Paid";
  paymentMode?: "Cash" | "Card" | "UPI" | "Insurance";
  createdAt: string;
}

export interface DayCarePatient {
  id: string;
  patientName: string;
  registrationNumber: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  mobile: string;
  doctorName: string;
  admissionTime: string;
  status: "In Progress" | "Completed" | "Discharged";
  treatments: { treatmentId: string; treatmentName: string; status: "Scheduled" | "In Progress" | "Completed"; startTime?: string; endTime?: string; notes?: string }[];
  diagnosis: string;
  bill?: DayCareBill;
  date: string;
}

export const dayCareCategories = [
  "Chemotherapy",
  "Dialysis",
  "Minor Surgery",
  "Infusion Therapy",
  "Blood Transfusion",
  "Wound Care",
  "Physiotherapy",
  "Endoscopy",
  "Observation",
  "Other",
];

export const mockDayCareTreatments: DayCareTreatment[] = [
  { id: "t1", name: "IV Infusion Therapy", category: "Infusion Therapy", duration: "2-3 hrs", price: 2500, description: "Intravenous fluid/medication administration" },
  { id: "t2", name: "Chemotherapy Cycle", category: "Chemotherapy", duration: "4-6 hrs", price: 15000, description: "Single cycle chemotherapy session" },
  { id: "t3", name: "Hemodialysis Session", category: "Dialysis", duration: "4 hrs", price: 3500, description: "Standard hemodialysis" },
  { id: "t4", name: "Blood Transfusion (1 Unit)", category: "Blood Transfusion", duration: "3-4 hrs", price: 4000, description: "Packed RBC transfusion per unit" },
  { id: "t5", name: "Wound Debridement", category: "Wound Care", duration: "1-2 hrs", price: 3000, description: "Surgical wound cleaning and dressing" },
  { id: "t6", name: "Abscess Drainage", category: "Minor Surgery", duration: "1 hr", price: 5000, description: "Incision and drainage under local anesthesia" },
  { id: "t7", name: "Upper GI Endoscopy", category: "Endoscopy", duration: "30-45 min", price: 6000, description: "Diagnostic upper GI endoscopy" },
  { id: "t8", name: "Colonoscopy", category: "Endoscopy", duration: "45-60 min", price: 8000, description: "Diagnostic colonoscopy" },
  { id: "t9", name: "Physiotherapy Session", category: "Physiotherapy", duration: "45 min", price: 800, description: "Rehabilitation physiotherapy" },
  { id: "t10", name: "Post-Op Observation", category: "Observation", duration: "6-8 hrs", price: 2000, description: "Post-operative monitoring and observation" },
  { id: "t11", name: "Iron Sucrose Infusion", category: "Infusion Therapy", duration: "1-2 hrs", price: 1800, description: "IV iron infusion for anemia" },
  { id: "t12", name: "Lumbar Puncture", category: "Minor Surgery", duration: "1 hr", price: 4500, description: "CSF collection under local anesthesia" },
];

export const mockDayCarePatients: DayCarePatient[] = [
  {
    id: "dc1", patientName: "Rahul Verma", registrationNumber: "EZY-2026-0001", age: 36, gender: "Male", mobile: "9876543210",
    doctorName: "Dr. Anil Mehta", admissionTime: "08:30 AM", status: "In Progress", diagnosis: "Iron Deficiency Anemia",
    date: "2026-03-02",
    treatments: [
      { treatmentId: "t11", treatmentName: "Iron Sucrose Infusion", status: "In Progress", startTime: "09:00 AM" },
    ],
  },
  {
    id: "dc2", patientName: "Suresh Kumar", registrationNumber: "EZY-2026-0003", age: 48, gender: "Male", mobile: "9123456789",
    doctorName: "Dr. Priya Singh", admissionTime: "07:45 AM", status: "In Progress", diagnosis: "Chronic Kidney Disease",
    date: "2026-03-02",
    treatments: [
      { treatmentId: "t3", treatmentName: "Hemodialysis Session", status: "In Progress", startTime: "08:00 AM" },
    ],
  },
  {
    id: "dc3", patientName: "Arjun Reddy", registrationNumber: "EZY-2026-0007", age: 62, gender: "Male", mobile: "9334455667",
    doctorName: "Dr. Priya Singh", admissionTime: "09:00 AM", status: "Completed", diagnosis: "Post-Angioplasty Follow-up",
    date: "2026-03-02",
    treatments: [
      { treatmentId: "t10", treatmentName: "Post-Op Observation", status: "Completed", startTime: "09:15 AM", endTime: "03:15 PM" },
    ],
    bill: {
      id: "bill-dc3", patientId: "dc3",
      items: [
        { id: "bi1", description: "Post-Op Observation", category: "Treatment", qty: 1, unitPrice: 2000, total: 2000 },
        { id: "bi2", description: "ECG Monitoring", category: "Investigation", qty: 2, unitPrice: 500, total: 1000 },
        { id: "bi3", description: "Nursing Charges", category: "Other", qty: 1, unitPrice: 800, total: 800 },
      ],
      subtotal: 3800, discount: 0, tax: 0, grandTotal: 3800, paymentStatus: "Paid", paymentMode: "Card", createdAt: "03:30 PM",
    },
  },
  {
    id: "dc4", patientName: "Meena Devi", registrationNumber: "EZY-2026-0004", age: 55, gender: "Female", mobile: "9988776655",
    doctorName: "Dr. Anil Mehta", admissionTime: "10:00 AM", status: "In Progress", diagnosis: "Lumbar Disc Herniation",
    date: "2026-03-02",
    treatments: [
      { treatmentId: "t9", treatmentName: "Physiotherapy Session", status: "Completed", startTime: "10:15 AM", endTime: "11:00 AM" },
      { treatmentId: "t5", treatmentName: "Wound Debridement", status: "Scheduled" },
    ],
  },
  {
    id: "dc5", patientName: "Pooja Nair", registrationNumber: "EZY-2026-0006", age: 7, gender: "Female", mobile: "9223344556",
    doctorName: "Dr. Sneha Gupta", admissionTime: "08:00 AM", status: "Completed", diagnosis: "Severe Anemia",
    date: "2026-03-02",
    treatments: [
      { treatmentId: "t4", treatmentName: "Blood Transfusion (1 Unit)", status: "Completed", startTime: "08:30 AM", endTime: "12:00 PM" },
    ],
    bill: {
      id: "bill-dc5", patientId: "dc5",
      items: [
        { id: "bi4", description: "Blood Transfusion (1 Unit)", category: "Treatment", qty: 1, unitPrice: 4000, total: 4000 },
        { id: "bi5", description: "Blood Cross-Match", category: "Investigation", qty: 1, unitPrice: 600, total: 600 },
        { id: "bi6", description: "IV Set & Consumables", category: "Consumable", qty: 1, unitPrice: 350, total: 350 },
      ],
      subtotal: 4950, discount: 200, tax: 0, grandTotal: 4750, paymentStatus: "Pending", createdAt: "12:30 PM",
    },
  },
  {
    id: "dc6", patientName: "Vikram Singh", registrationNumber: "EZY-2026-0005", age: 29, gender: "Male", mobile: "9112233445",
    doctorName: "Dr. Ravi Patel", admissionTime: "11:00 AM", status: "Completed", diagnosis: "Knee Cartilage Injury",
    date: "2026-03-01",
    treatments: [
      { treatmentId: "t9", treatmentName: "Physiotherapy Session", status: "Completed", startTime: "11:15 AM", endTime: "12:00 PM" },
    ],
    bill: {
      id: "bill-dc6", patientId: "dc6",
      items: [
        { id: "bi7", description: "Physiotherapy Session", category: "Treatment", qty: 1, unitPrice: 800, total: 800 },
      ],
      subtotal: 800, discount: 0, tax: 0, grandTotal: 800, paymentStatus: "Paid", paymentMode: "Cash", createdAt: "12:15 PM",
    },
  },
];
