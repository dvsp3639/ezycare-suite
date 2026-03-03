export type StaffRole = "Doctor" | "Nurse" | "Technician" | "Pharmacist" | "Admin" | "Receptionist" | "Housekeeping" | "Security" | "Driver";
export type EmploymentType = "Full-Time" | "Part-Time" | "Contract" | "Visiting";
export type LeaveType = "Casual" | "Sick" | "Earned" | "Maternity" | "Paternity" | "Unpaid";
export type LeaveStatus = "Pending" | "Approved" | "Rejected";
export type AttendanceStatus = "Present" | "Absent" | "Half Day" | "On Leave" | "Holiday";

export interface StaffMember {
  id: string;
  employeeId: string;
  name: string;
  role: StaffRole;
  department: string;
  designation: string;
  employmentType: EmploymentType;
  joiningDate: string;
  phone: string;
  email: string;
  address: string;
  emergencyContact: string;
  bloodGroup: string;
  qualification: string;
  specialization?: string;
  aadharNo: string;
  panNo: string;
  bankAccount: string;
  bankName: string;
  ifscCode: string;
  baseSalary: number;
  status: "Active" | "Inactive" | "On Leave";
}

export interface SalaryRecord {
  id: string;
  staffId: string;
  staffName: string;
  month: string; // "2026-03"
  baseSalary: number;
  hra: number;
  da: number;
  specialAllowance: number;
  overtime: number;
  deductions: number;
  pf: number;
  esi: number;
  tax: number;
  advance: number;
  netSalary: number;
  status: "Pending" | "Processed" | "Paid";
  paidDate?: string;
}

export interface SalaryAdvance {
  id: string;
  staffId: string;
  staffName: string;
  amount: number;
  requestDate: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected" | "Repaid";
  approvedBy?: string;
  repaymentMonths?: number;
  monthlyDeduction?: number;
}

export interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: AttendanceStatus;
  hoursWorked?: number;
  overtimeHours?: number;
  notes?: string;
}

export interface LeaveRequest {
  id: string;
  staffId: string;
  staffName: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedDate: string;
  approvedBy?: string;
}

export const staffRoles: StaffRole[] = ["Doctor", "Nurse", "Technician", "Pharmacist", "Admin", "Receptionist", "Housekeeping", "Security", "Driver"];
export const leaveTypes: LeaveType[] = ["Casual", "Sick", "Earned", "Maternity", "Paternity", "Unpaid"];

export const mockStaff: StaffMember[] = [
  { id: "s-1", employeeId: "EMP-001", name: "Dr. Anil Mehta", role: "Doctor", department: "General Medicine", designation: "Senior Consultant", employmentType: "Full-Time", joiningDate: "2020-06-01", phone: "9876500001", email: "anil.mehta@hospital.com", address: "12, MG Road, Bengaluru", emergencyContact: "9876500010", bloodGroup: "O+", qualification: "MBBS, MD", specialization: "Internal Medicine", aadharNo: "1234-5678-9001", panNo: "ABCDE1234F", bankAccount: "12345678901", bankName: "SBI", ifscCode: "SBIN0001234", baseSalary: 150000, status: "Active" },
  { id: "s-2", employeeId: "EMP-002", name: "Dr. Priya Singh", role: "Doctor", department: "Cardiology", designation: "Consultant", employmentType: "Full-Time", joiningDate: "2021-03-15", phone: "9876500002", email: "priya.singh@hospital.com", address: "45, Nehru Nagar, Mumbai", emergencyContact: "9876500020", bloodGroup: "A+", qualification: "MBBS, DM Cardiology", specialization: "Cardiology", aadharNo: "1234-5678-9002", panNo: "FGHIJ5678K", bankAccount: "23456789012", bankName: "HDFC", ifscCode: "HDFC0001234", baseSalary: 180000, status: "Active" },
  { id: "s-3", employeeId: "EMP-003", name: "Nurse Priya Nair", role: "Nurse", department: "ICU", designation: "Head Nurse", employmentType: "Full-Time", joiningDate: "2019-08-01", phone: "9876500003", email: "priya.nair@hospital.com", address: "78, Gandhi Marg, Delhi", emergencyContact: "9876500030", bloodGroup: "B+", qualification: "BSc Nursing", aadharNo: "1234-5678-9003", panNo: "KLMNO9012P", bankAccount: "34567890123", bankName: "Axis", ifscCode: "UTIB0001234", baseSalary: 45000, status: "Active" },
  { id: "s-4", employeeId: "EMP-004", name: "Nurse Kavita Sharma", role: "Nurse", department: "General Ward", designation: "Staff Nurse", employmentType: "Full-Time", joiningDate: "2022-01-10", phone: "9876500004", email: "kavita.s@hospital.com", address: "22, Patel Road, Ahmedabad", emergencyContact: "9876500040", bloodGroup: "AB+", qualification: "GNM", aadharNo: "1234-5678-9004", panNo: "PQRST3456U", bankAccount: "45678901234", bankName: "PNB", ifscCode: "PUNB0001234", baseSalary: 30000, status: "Active" },
  { id: "s-5", employeeId: "EMP-005", name: "Amit Kumar", role: "Technician", department: "Lab", designation: "Lab Technician", employmentType: "Full-Time", joiningDate: "2021-06-15", phone: "9876500005", email: "amit.k@hospital.com", address: "56, Rajiv Nagar, Pune", emergencyContact: "9876500050", bloodGroup: "O-", qualification: "DMLT", aadharNo: "1234-5678-9005", panNo: "UVWXY7890Z", bankAccount: "56789012345", bankName: "BOB", ifscCode: "BARB0001234", baseSalary: 25000, status: "Active" },
  { id: "s-6", employeeId: "EMP-006", name: "Rajesh Patel", role: "Pharmacist", department: "Pharmacy", designation: "Chief Pharmacist", employmentType: "Full-Time", joiningDate: "2020-01-01", phone: "9876500006", email: "rajesh.p@hospital.com", address: "99, Station Road, Jaipur", emergencyContact: "9876500060", bloodGroup: "A-", qualification: "B.Pharm", aadharNo: "1234-5678-9006", panNo: "ABCFG1234H", bankAccount: "67890123456", bankName: "ICICI", ifscCode: "ICIC0001234", baseSalary: 35000, status: "Active" },
  { id: "s-7", employeeId: "EMP-007", name: "Sunita Devi", role: "Receptionist", department: "Front Desk", designation: "Senior Receptionist", employmentType: "Full-Time", joiningDate: "2021-09-01", phone: "9876500007", email: "sunita.d@hospital.com", address: "33, Shivaji Nagar, Kolkata", emergencyContact: "9876500070", bloodGroup: "B-", qualification: "BCA", aadharNo: "1234-5678-9007", panNo: "HIJKL5678M", bankAccount: "78901234567", bankName: "Canara", ifscCode: "CNRB0001234", baseSalary: 22000, status: "Active" },
  { id: "s-8", employeeId: "EMP-008", name: "Ramesh Yadav", role: "Housekeeping", department: "Maintenance", designation: "Supervisor", employmentType: "Full-Time", joiningDate: "2018-04-01", phone: "9876500008", email: "ramesh.y@hospital.com", address: "11, Industrial Area, Chennai", emergencyContact: "9876500080", bloodGroup: "O+", qualification: "10th Pass", aadharNo: "1234-5678-9008", panNo: "NOPQR9012S", bankAccount: "89012345678", bankName: "Indian Bank", ifscCode: "IDIB0001234", baseSalary: 18000, status: "Active" },
];

export const mockSalaryRecords: SalaryRecord[] = [
  { id: "sal-1", staffId: "s-1", staffName: "Dr. Anil Mehta", month: "2026-02", baseSalary: 150000, hra: 22500, da: 15000, specialAllowance: 10000, overtime: 0, deductions: 0, pf: 18000, esi: 0, tax: 15000, advance: 0, netSalary: 164500, status: "Paid", paidDate: "2026-02-28" },
  { id: "sal-2", staffId: "s-2", staffName: "Dr. Priya Singh", month: "2026-02", baseSalary: 180000, hra: 27000, da: 18000, specialAllowance: 12000, overtime: 0, deductions: 0, pf: 21600, esi: 0, tax: 20000, advance: 0, netSalary: 195400, status: "Paid", paidDate: "2026-02-28" },
  { id: "sal-3", staffId: "s-3", staffName: "Nurse Priya Nair", month: "2026-02", baseSalary: 45000, hra: 6750, da: 4500, specialAllowance: 2000, overtime: 3000, deductions: 0, pf: 5400, esi: 1125, tax: 0, advance: 0, netSalary: 54725, status: "Paid", paidDate: "2026-02-28" },
  { id: "sal-4", staffId: "s-4", staffName: "Nurse Kavita Sharma", month: "2026-02", baseSalary: 30000, hra: 4500, da: 3000, specialAllowance: 1000, overtime: 1500, deductions: 500, pf: 3600, esi: 750, tax: 0, advance: 5000, netSalary: 30150, status: "Paid", paidDate: "2026-02-28" },
  { id: "sal-5", staffId: "s-5", staffName: "Amit Kumar", month: "2026-03", baseSalary: 25000, hra: 3750, da: 2500, specialAllowance: 1000, overtime: 0, deductions: 0, pf: 3000, esi: 625, tax: 0, advance: 0, netSalary: 28625, status: "Pending" },
  { id: "sal-6", staffId: "s-6", staffName: "Rajesh Patel", month: "2026-03", baseSalary: 35000, hra: 5250, da: 3500, specialAllowance: 1500, overtime: 2000, deductions: 0, pf: 4200, esi: 875, tax: 0, advance: 0, netSalary: 42175, status: "Pending" },
];

export const mockAdvances: SalaryAdvance[] = [
  { id: "adv-1", staffId: "s-4", staffName: "Nurse Kavita Sharma", amount: 15000, requestDate: "2026-01-15", reason: "Medical emergency at home", status: "Approved", approvedBy: "Admin", repaymentMonths: 3, monthlyDeduction: 5000 },
  { id: "adv-2", staffId: "s-8", staffName: "Ramesh Yadav", amount: 10000, requestDate: "2026-02-20", reason: "Children school fees", status: "Pending" },
];

export const mockAttendance: AttendanceRecord[] = [
  { id: "att-1", staffId: "s-1", staffName: "Dr. Anil Mehta", date: "2026-03-03", checkIn: "08:45 AM", checkOut: "05:30 PM", status: "Present", hoursWorked: 8.75 },
  { id: "att-2", staffId: "s-2", staffName: "Dr. Priya Singh", date: "2026-03-03", checkIn: "09:00 AM", checkOut: "06:00 PM", status: "Present", hoursWorked: 9 },
  { id: "att-3", staffId: "s-3", staffName: "Nurse Priya Nair", date: "2026-03-03", checkIn: "07:00 AM", checkOut: "03:00 PM", status: "Present", hoursWorked: 8 },
  { id: "att-4", staffId: "s-4", staffName: "Nurse Kavita Sharma", date: "2026-03-03", status: "On Leave", notes: "Sick leave" },
  { id: "att-5", staffId: "s-5", staffName: "Amit Kumar", date: "2026-03-03", checkIn: "09:00 AM", checkOut: "01:00 PM", status: "Half Day", hoursWorked: 4 },
  { id: "att-6", staffId: "s-6", staffName: "Rajesh Patel", date: "2026-03-03", checkIn: "08:30 AM", checkOut: "05:00 PM", status: "Present", hoursWorked: 8.5 },
  { id: "att-7", staffId: "s-7", staffName: "Sunita Devi", date: "2026-03-03", checkIn: "08:00 AM", checkOut: "04:00 PM", status: "Present", hoursWorked: 8 },
  { id: "att-8", staffId: "s-8", staffName: "Ramesh Yadav", date: "2026-03-03", status: "Absent" },
];

export const mockLeaveRequests: LeaveRequest[] = [
  { id: "lv-1", staffId: "s-4", staffName: "Nurse Kavita Sharma", leaveType: "Sick", fromDate: "2026-03-03", toDate: "2026-03-04", days: 2, reason: "Fever and body ache", status: "Approved", appliedDate: "2026-03-02", approvedBy: "Admin" },
  { id: "lv-2", staffId: "s-8", staffName: "Ramesh Yadav", leaveType: "Casual", fromDate: "2026-03-03", toDate: "2026-03-03", days: 1, reason: "Personal work", status: "Pending", appliedDate: "2026-03-01" },
  { id: "lv-3", staffId: "s-5", staffName: "Amit Kumar", leaveType: "Earned", fromDate: "2026-03-10", toDate: "2026-03-14", days: 5, reason: "Family vacation", status: "Pending", appliedDate: "2026-02-28" },
];

export const roleColors: Record<StaffRole, string> = {
  Doctor: "bg-primary/10 text-primary border-primary/20",
  Nurse: "bg-info/10 text-info border-info/20",
  Technician: "bg-warning/10 text-warning border-warning/20",
  Pharmacist: "bg-success/10 text-success border-success/20",
  Admin: "bg-accent text-accent-foreground border-accent",
  Receptionist: "bg-muted text-muted-foreground border-border",
  Housekeeping: "bg-muted text-muted-foreground border-border",
  Security: "bg-destructive/10 text-destructive border-destructive/20",
  Driver: "bg-warning/10 text-warning border-warning/20",
};
