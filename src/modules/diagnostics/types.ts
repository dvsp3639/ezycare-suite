// Diagnostics Module Types

export interface LabTestCatalogItem {
  id: string;
  hospital_id: string;
  name: string;
  category: "Blood" | "Urine" | "Radiology" | "Serology";
  price: number;
  created_at: string;
  parameters?: LabTestParameter[];
}

export interface LabTestParameter {
  id: string;
  test_id: string;
  name: string;
  unit: string;
  normal_range: string;
}

export interface LabOrder {
  id: string;
  hospital_id: string;
  appointment_id: string | null;
  test_name: string;
  category: string;
  priority: "Routine" | "Urgent";
  status: "Ordered" | "Sample Collected" | "In Progress" | "Completed";
  price: number;
  payment_status: string;
  payment_mode: string | null;
  clinical_notes: string;
  ordered_by: string;
  patient_name: string;
  patient_reg_no: string;
  ordered_at: string;
  sample_collected_at: string | null;
  completed_at: string | null;
  report_notes: string;
  created_at: string;
  results?: LabResult[];
}

export interface LabResult {
  id: string;
  lab_order_id: string;
  parameter: string;
  value: string;
  unit: string;
  normal_range: string;
  is_abnormal: boolean;
}

export type LabOrderInsert = Omit<LabOrder, "id" | "created_at" | "hospital_id" | "results"> & {
  hospital_id?: string;
};
