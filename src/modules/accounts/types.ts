// Accounts & Revenue Module Types

export interface OperatingExpense {
  id: string;
  hospitalId: string;
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  paymentMode: string;
  vendor: string;
  referenceNo: string;
  notes: string;
  createdAt: string;
}

export interface PurchaseBill {
  id: string;
  hospitalId: string;
  billDate: string;
  billType: "Pharmacy" | "Inventory";
  vendor: string;
  invoiceNo: string;
  subtotal: number;
  gstAmount: number;
  discount: number;
  totalAmount: number;
  paymentMode: string;
  paymentStatus: "Paid" | "Pending" | "Partial";
  notes: string;
  createdAt: string;
}

export interface RevenueTransaction {
  id: string;
  date: string;
  source: "OPD" | "IPD" | "Pharmacy" | "Diagnostics" | "Day Care";
  reference: string;
  patient: string;
  amount: number;
  gst: number;
  paymentMode: string;
  paymentStatus: string;
  doctor?: string;
  department?: string;
}

export interface ExpenseTransaction {
  id: string;
  date: string;
  source: "Salary" | "Salary Advance" | "Purchase" | "Operating";
  category: string;
  description: string;
  amount: number;
  paymentMode: string;
  vendor?: string;
}

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Utilities",
  "Maintenance",
  "Marketing",
  "Office Supplies",
  "Travel",
  "Professional Fees",
  "Insurance",
  "Other",
] as const;

export const PAYMENT_MODES = ["Cash", "Card", "UPI", "Bank Transfer", "Cheque", "Insurance"] as const;
