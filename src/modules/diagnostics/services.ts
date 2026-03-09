import { supabase } from "@/integrations/supabase/client";
import { snakeToCamel, camelToSnake } from "@/lib/caseConverter";
import type { LabTestCatalogItem, LabOrder, LabResult, LabOrderInsert, LabTestParameter } from "./types";

export const diagnosticsService = {
  // ─── Test Catalog ───
  async getTestCatalog(): Promise<LabTestCatalogItem[]> {
    const { data, error } = await supabase
      .from("lab_test_catalog")
      .select("*, lab_test_parameters(*)")
      .order("name");
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...snakeToCamel(d),
      parameters: (d.lab_test_parameters || []).map((p: any) => snakeToCamel(p)),
    })) as LabTestCatalogItem[];
  },

  async createTestCatalogItem(item: Partial<LabTestCatalogItem>): Promise<LabTestCatalogItem> {
    const { parameters, ...rest } = item as any;
    const { data, error } = await supabase
      .from("lab_test_catalog")
      .insert(camelToSnake(rest) as any)
      .select()
      .single();
    if (error) throw error;
    return snakeToCamel(data) as LabTestCatalogItem;
  },

  async updateTestCatalogItem(id: string, updates: Partial<LabTestCatalogItem>): Promise<void> {
    const { parameters, ...rest } = updates as any;
    const { error } = await supabase
      .from("lab_test_catalog")
      .update(camelToSnake(rest) as any)
      .eq("id", id);
    if (error) throw error;
  },

  async deleteTestCatalogItem(id: string): Promise<void> {
    // Delete parameters first, then the test
    await supabase.from("lab_test_parameters").delete().eq("test_id", id);
    const { error } = await supabase.from("lab_test_catalog").delete().eq("id", id);
    if (error) throw error;
  },

  // ─── Test Parameters ───
  async saveTestParameters(testId: string, params: Omit<LabTestParameter, "id" | "test_id" | "hospital_id">[]): Promise<void> {
    await supabase.from("lab_test_parameters").delete().eq("test_id", testId);
    if (params.length > 0) {
      const rows = params.map((p) => ({ ...camelToSnake(p), test_id: testId }));
      const { error } = await supabase.from("lab_test_parameters").insert(rows as any);
      if (error) throw error;
    }
  },

  // ─── Lab Orders ───
  async getLabOrders(filters?: { status?: string; category?: string; appointmentId?: string }): Promise<LabOrder[]> {
    let query = supabase
      .from("lab_orders")
      .select("*, lab_results(*)")
      .order("ordered_at", { ascending: false });
    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.category) query = query.eq("category", filters.category);
    if (filters?.appointmentId) query = query.eq("appointment_id", filters.appointmentId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...snakeToCamel(d),
      results: (d.lab_results || []).map((r: any) => snakeToCamel(r)),
    })) as LabOrder[];
  },

  async createLabOrder(order: LabOrderInsert): Promise<LabOrder> {
    const { data, error } = await supabase
      .from("lab_orders")
      .insert(camelToSnake(order) as any)
      .select()
      .single();
    if (error) throw error;
    return snakeToCamel(data) as LabOrder;
  },

  async updateLabOrderStatus(id: string, status: string, extraFields?: Record<string, any>): Promise<void> {
    const updates: any = { status, ...extraFields };
    if (status === "Sample Collected") updates.sample_collected_at = new Date().toISOString();
    if (status === "Completed") updates.completed_at = new Date().toISOString();
    const { error } = await supabase.from("lab_orders").update(updates).eq("id", id);
    if (error) throw error;
  },

  async updateLabOrderPayment(id: string, paymentMode: "Cash" | "Credit"): Promise<void> {
    const { error } = await supabase
      .from("lab_orders")
      .update({ payment_status: "Paid", payment_mode: paymentMode } as any)
      .eq("id", id);
    if (error) throw error;
  },

  async saveResults(labOrderId: string, results: Omit<LabResult, "id" | "lab_order_id" | "hospital_id">[], reportNotes?: string, reportFileUrl?: string, reportFileName?: string): Promise<void> {
    await supabase.from("lab_results").delete().eq("lab_order_id", labOrderId);
    if (results.length > 0) {
      const rows = results.map((r) => ({ ...camelToSnake(r), lab_order_id: labOrderId }));
      const { error } = await supabase.from("lab_results").insert(rows as any);
      if (error) throw error;
    }
    // Always mark as Completed when saving results
    const updateData: any = {
      report_notes: reportNotes ?? "",
      status: "Completed",
      completed_at: new Date().toISOString(),
    };
    if (reportFileUrl) updateData.report_file_url = reportFileUrl;
    if (reportFileName) updateData.report_file_name = reportFileName;
    const { error: updateError } = await supabase.from("lab_orders").update(updateData).eq("id", labOrderId);
    if (updateError) throw updateError;
  },
};
