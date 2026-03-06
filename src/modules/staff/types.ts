// Staff & Payroll Module Types

export type StaffRole = "Doctor" | "Nurse" | "Technician" | "Pharmacist" | "Admin" | "Receptionist" | "Housekeeping" | "Security" | "Driver";
export type EmploymentType = "Full-Time" | "Part-Time" | "Contract" | "Visiting";
export type LeaveType = "Casual" | "Sick" | "Earned" | "Maternity" | "Paternity" | "Unpaid";
export type LeaveStatus = "Pending" | "Approved" | "Rejected";
export type AttendanceStatus = "Present" | "Absent" | "Half Day" | "On Leave" | "Holiday";

export interface StaffMember {
  id: string;
  hospital_id: string;
  employee_id: string;
  name: string;
  role: StaffRole;
  department: string;
  designation: string;
  employment_type: EmploymentType;
  joining_date: string | null;
  phone: string;
  email: string;
  address: string;
  emergency_contact: string;
  blood_group: string;
  qualification: string;
  specialization: string;
  aadhar_no: string;
  pan_no: string;
  bank_account: string;
  bank_name: string;
  ifsc_code: string;
  base_salary: number;
  status: "Active" | "Inactive" | "On Leave";
  created_at: string;
  updated_at: string;
}

export interface SalaryRecord {
  id: string;
  hospital_id: string;
  staff_id: string;
  staff_name: string;
  month: string;
  base_salary: number;
  hra: number;
  da: number;
  special_allowance: number;
  overtime: number;
  deductions: number;
  pf: number;
  esi: number;
  tax: number;
  advance: number;
  net_salary: number;
  status: "Pending" | "Processed" | "Paid";
  paid_date: string | null;
  created_at: string;
}

export interface SalaryAdvance {
  id: string;
  hospital_id: string;
  staff_id: string;
  staff_name: string;
  amount: number;
  request_date: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected" | "Repaid";
  approved_by: string | null;
  repayment_months: number | null;
  monthly_deduction: number | null;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  hospital_id: string;
  staff_id: string;
  staff_name: string;
  attendance_date: string;
  check_in: string | null;
  check_out: string | null;
  status: AttendanceStatus;
  hours_worked: number | null;
  overtime_hours: number | null;
  notes: string;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  hospital_id: string;
  staff_id: string;
  staff_name: string;
  leave_type: LeaveType;
  from_date: string;
  to_date: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  applied_date: string;
  approved_by: string | null;
  created_at: string;
}
