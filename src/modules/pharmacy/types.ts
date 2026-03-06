// Pharmacy Module Types

export interface Medicine {
  id: string;
  hospital_id: string;
  name: string;
  generic_name: string;
  category: string;
  manufacturer: string;
  batch_no: string;
  expiry_date: string | null;
  mrp: number;
  stock: number;
  unit: string;
  hsn_code: string;
  gst_percent: number;
  created_at: string;
  updated_at: string;
}

export interface PharmacyOrder {
  id: string;
  hospital_id: string;
  issue_type: "IP Sale" | "IP Return" | "OP Sale" | "OP Return";
  patient_name: string;
  registration_number: string;
  mobile: string;
  age: number | null;
  gender: string;
  doctor_name: string;
  issue_date: string;
  total_amount: number;
  discount: number;
  gst_amount: number;
  net_amount: number;
  payment_mode: string;
  status: "Draft" | "Completed";
  created_at: string;
  items?: PharmacyOrderItem[];
}

export interface PharmacyOrderItem {
  id: string;
  order_id: string;
  medicine_id: string | null;
  medicine_name: string;
  batch_no: string;
  quantity: number;
  mrp: number;
  discount: number;
  gst_percent: number;
  amount: number;
}

export type MedicineInsert = Omit<Medicine, "id" | "created_at" | "updated_at" | "hospital_id"> & {
  hospital_id?: string;
};
