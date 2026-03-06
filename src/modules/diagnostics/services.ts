import { supabase } from "@/integrations/supabase/client";
import type { LabTestCatalogItem, LabOrder, LabResult, LabOrderInsert } from "./types";

export const diagnosticsService = {
  // ─── Lab Test Catalog ───
  async getTestCatalog(): Promise<LabTestCatalogItem[]> {
    const { data, error } = await supabase
      .from("lab_test_catalog")
      .select("*, lab_test_parameters(*)")
      .order("name");
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      parameters: d.lab_test_parameters,
    })) as unknown as LabTestCatalogItem[];
  },

  async createTestCatalogItem(item: Partial<LabTestCatalogItem>): Promise<LabTestCatalogItem> {
    const { data, error } = await supabase
      .from("lab_test_catalog")
      .insert(item as any)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as LabTestCatalogItem;
  },

  // ─── Lab Orders ───
  async getLabOrders(filters?: { status?: string; category?: string }): Promise<LabOrder[]> {
    let query = supabase
      .from("lab_orders")
      .select("*, lab_results(*)")
      .order("ordered_at", { ascending: false });
    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.category) query = query.eq("category", filters.category);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      results: d.lab_results,
    })) as unknown as LabOrder[];
  },

  async createLabOrder(order: LabOrderInsert): Promise<LabOrder> {
    const { data, error } = await supabase
      .from("lab_orders")
      .insert(order as any)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as LabOrder;
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

  // ─── Lab Results ───
  async saveResults(labOrderId: string, results: Omit<LabResult, "id" | "lab_order_id">[], reportNotes?: string): Promise<void> {
    await supabase.from("lab_results").delete().eq("lab_order_id", labOrderId);
    if (results.length > 0) {
      const rows = results.map((r) => ({ ...r, lab_order_id: labOrderId }));
      const { error } = await supabase.from("lab_results").insert(rows as any);
      if (error) throw error;
    }
    if (reportNotes !== undefined) {
      await supabase.from("lab_orders").update({
        report_notes: reportNotes,
        status: "Completed",
        completed_at: new Date().toISOString(),
      } as any).eq("id", labOrderId);
    }
  },
};
