// Pharmacy Module Types

export interface Medicine {
  id: string;
  hospitalId: string;
  name: string;
  genericName: string;
  category: string;
  manufacturer: string;
  batchNo: string;
  expiryDate: string | null;
  mrp: number;
  stock: number;
  unit: string;
  hsnCode: string;
  gstPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface PharmacyOrder {
  id: string;
  hospitalId: string;
  issueType: "IP Sale" | "IP Return" | "OP Sale" | "OP Return" | "Direct Sale";
  saleChannel: "Patient" | "Direct";
  invoiceNo: string;
  customerName: string;
  customerMobile: string;
  patientName: string;
  registrationNumber: string;
  mobile: string;
  age: number | null;
  gender: string;
  doctorName: string;
  issueDate: string;
  totalAmount: number;
  discount: number;
  gstAmount: number;
  netAmount: number;
  paymentMode: string;
  status: "Draft" | "Completed";
  completedAt: string | null;
  createdAt: string;
  items?: PharmacyOrderItem[];
}

export interface PharmacyOrderItem {
  id: string;
  orderId: string;
  medicineId: string | null;
  medicineName: string;
  batchNo: string;
  quantity: number;
  mrp: number;
  discount: number;
  gstPercent: number;
  amount: number;
}

export type MedicineInsert = Omit<Medicine, "id" | "createdAt" | "updatedAt" | "hospitalId"> & {
  hospitalId?: string;
};
