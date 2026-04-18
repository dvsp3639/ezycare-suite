import { supabase } from "@/integrations/supabase/client";
import { snakeToCamel, camelToSnake } from "@/lib/caseConverter";
import type {
  OperatingExpense,
  PurchaseBill,
  RevenueTransaction,
  ExpenseTransaction,
} from "./types";

export const accountsService = {
  // ─── Operating Expenses ───
  async getOperatingExpenses(from?: string, to?: string): Promise<OperatingExpense[]> {
    let q = supabase.from("operating_expenses").select("*").order("expense_date", { ascending: false });
    if (from) q = q.gte("expense_date", from);
    if (to) q = q.lte("expense_date", to);
    const { data, error } = await q;
    if (error) throw error;
    return snakeToCamel(data || []) as OperatingExpense[];
  },

  async createOperatingExpense(expense: Partial<OperatingExpense>): Promise<OperatingExpense> {
    const { data, error } = await supabase
      .from("operating_expenses")
      .insert(camelToSnake(expense) as any)
      .select()
      .single();
    if (error) throw error;
    return snakeToCamel(data) as OperatingExpense;
  },

  async deleteOperatingExpense(id: string): Promise<void> {
    const { error } = await supabase.from("operating_expenses").delete().eq("id", id);
    if (error) throw error;
  },

  // ─── Purchase Bills ───
  async getPurchaseBills(from?: string, to?: string): Promise<PurchaseBill[]> {
    let q = supabase.from("purchase_bills").select("*").order("bill_date", { ascending: false });
    if (from) q = q.gte("bill_date", from);
    if (to) q = q.lte("bill_date", to);
    const { data, error } = await q;
    if (error) throw error;
    return snakeToCamel(data || []) as PurchaseBill[];
  },

  async createPurchaseBill(bill: Partial<PurchaseBill>): Promise<PurchaseBill> {
    const { data, error } = await supabase
      .from("purchase_bills")
      .insert(camelToSnake(bill) as any)
      .select()
      .single();
    if (error) throw error;
    return snakeToCamel(data) as PurchaseBill;
  },

  async deletePurchaseBill(id: string): Promise<void> {
    const { error } = await supabase.from("purchase_bills").delete().eq("id", id);
    if (error) throw error;
  },

  // ─── Aggregated Revenue (across modules) ───
  async getRevenue(from: string, to: string): Promise<RevenueTransaction[]> {
    const [opd, pharmacy, lab, ipd, daycare] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, appointment_date, doctor_name, patient_name, registration_number, consultation_fee, payment_mode, payment_status, opd_type")
        .gte("appointment_date", from)
        .lte("appointment_date", to),
      supabase
        .from("pharmacy_orders")
        .select("id, issue_date, patient_name, registration_number, net_amount, gst_amount, payment_mode, status, issue_type")
        .gte("issue_date", from)
        .lte("issue_date", to)
        .eq("status", "Completed"),
      supabase
        .from("lab_orders")
        .select("id, ordered_at, patient_name, patient_reg_no, price, payment_mode, payment_status, ordered_by, category")
        .gte("ordered_at", `${from}T00:00:00`)
        .lte("ordered_at", `${to}T23:59:59`),
      supabase
        .from("discharge_summaries")
        .select("id, discharge_date, total_bill, paid_amount, payment_status, admission_id, ipd_admissions(patient_name, registration_number, admitting_doctor, department)")
        .gte("discharge_date", `${from}T00:00:00`)
        .lte("discharge_date", `${to}T23:59:59`),
      supabase
        .from("daycare_bills")
        .select("id, created_at, grand_total, tax, payment_mode, payment_status, session_id, daycare_sessions(patient_name, registration_number, doctor_name)")
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`),
    ]);

    const txns: RevenueTransaction[] = [];

    (opd.data || []).forEach((a: any) => {
      const fee = Number(a.consultation_fee) || 0;
      if (fee > 0) {
        txns.push({
          id: `opd-${a.id}`,
          date: a.appointment_date,
          source: "OPD",
          reference: a.registration_number,
          patient: a.patient_name,
          amount: fee,
          gst: 0,
          paymentMode: a.payment_mode || "Cash",
          paymentStatus: a.payment_status || "Paid",
          doctor: a.doctor_name,
          department: a.opd_type,
        });
      }
    });

    (pharmacy.data || []).forEach((p: any) => {
      const isReturn = String(p.issue_type).includes("Return");
      const amt = Number(p.net_amount) || 0;
      txns.push({
        id: `phr-${p.id}`,
        date: p.issue_date,
        source: "Pharmacy",
        reference: p.registration_number || "—",
        patient: p.patient_name,
        amount: isReturn ? -amt : amt,
        gst: Number(p.gst_amount) || 0,
        paymentMode: p.payment_mode || "Cash",
        paymentStatus: "Paid",
        department: p.issue_type,
      });
    });

    (lab.data || []).forEach((l: any) => {
      txns.push({
        id: `lab-${l.id}`,
        date: String(l.ordered_at).slice(0, 10),
        source: "Diagnostics",
        reference: l.patient_reg_no,
        patient: l.patient_name,
        amount: Number(l.price) || 0,
        gst: 0,
        paymentMode: l.payment_mode || "Cash",
        paymentStatus: l.payment_status || "Pending",
        doctor: l.ordered_by,
        department: l.category,
      });
    });

    (ipd.data || []).forEach((d: any) => {
      const adm = d.ipd_admissions || {};
      txns.push({
        id: `ipd-${d.id}`,
        date: String(d.discharge_date).slice(0, 10),
        source: "IPD",
        reference: adm.registration_number || "—",
        patient: adm.patient_name || "—",
        amount: Number(d.total_bill) || 0,
        gst: 0,
        paymentMode: "—",
        paymentStatus: d.payment_status || "Pending",
        doctor: adm.admitting_doctor,
        department: adm.department,
      });
    });

    (daycare.data || []).forEach((b: any) => {
      const s = b.daycare_sessions || {};
      txns.push({
        id: `dc-${b.id}`,
        date: String(b.created_at).slice(0, 10),
        source: "Day Care",
        reference: s.registration_number || "—",
        patient: s.patient_name || "—",
        amount: Number(b.grand_total) || 0,
        gst: Number(b.tax) || 0,
        paymentMode: b.payment_mode || "Cash",
        paymentStatus: b.payment_status || "Pending",
        doctor: s.doctor_name,
      });
    });

    return txns.sort((a, b) => b.date.localeCompare(a.date));
  },

  // ─── Aggregated Expenses ───
  async getExpenses(from: string, to: string): Promise<ExpenseTransaction[]> {
    const [salaries, advances, purchases, ops] = await Promise.all([
      supabase
        .from("salary_records")
        .select("id, month, staff_name, net_salary, paid_date, status")
        .eq("status", "Paid")
        .gte("paid_date", from)
        .lte("paid_date", to),
      supabase
        .from("salary_advances")
        .select("id, request_date, staff_name, amount, status, reason")
        .eq("status", "Approved")
        .gte("request_date", from)
        .lte("request_date", to),
      supabase
        .from("purchase_bills")
        .select("*")
        .gte("bill_date", from)
        .lte("bill_date", to),
      supabase
        .from("operating_expenses")
        .select("*")
        .gte("expense_date", from)
        .lte("expense_date", to),
    ]);

    const txns: ExpenseTransaction[] = [];

    (salaries.data || []).forEach((s: any) => {
      txns.push({
        id: `sal-${s.id}`,
        date: s.paid_date || s.month,
        source: "Salary",
        category: "Payroll",
        description: `${s.staff_name} — ${s.month}`,
        amount: Number(s.net_salary) || 0,
        paymentMode: "Bank Transfer",
      });
    });

    (advances.data || []).forEach((a: any) => {
      txns.push({
        id: `adv-${a.id}`,
        date: a.request_date,
        source: "Salary Advance",
        category: "Payroll",
        description: `${a.staff_name} — ${a.reason || "Advance"}`,
        amount: Number(a.amount) || 0,
        paymentMode: "Bank Transfer",
      });
    });

    (purchases.data || []).forEach((p: any) => {
      txns.push({
        id: `pur-${p.id}`,
        date: p.bill_date,
        source: "Purchase",
        category: p.bill_type,
        description: `${p.vendor} — ${p.invoice_no || "Bill"}`,
        amount: Number(p.total_amount) || 0,
        paymentMode: p.payment_mode,
        vendor: p.vendor,
      });
    });

    (ops.data || []).forEach((e: any) => {
      txns.push({
        id: `op-${e.id}`,
        date: e.expense_date,
        source: "Operating",
        category: e.category,
        description: e.description,
        amount: Number(e.amount) || 0,
        paymentMode: e.payment_mode,
        vendor: e.vendor,
      });
    });

    return txns.sort((a, b) => b.date.localeCompare(a.date));
  },
};
