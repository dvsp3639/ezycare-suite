import { supabase } from "@/integrations/supabase/client";
import { snakeToCamel, camelToSnake } from "@/lib/caseConverter";
import type { LabTestCatalogItem, LabOrder, LabResult, LabOrderInsert } from "./types";

export const diagnosticsService = {
  async getTestCatalog(): Promise<LabTestCatalogItem[]> {
    const { data, error } = await supabase
      .from("lab_test_catalog")
      .select("*, lab_test_parameters(*)")
      .order("name");
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...snakeToCamel(d),
      parameters: snakeToCamel(d.lab_test_parameters),
    })) as LabTestCatalogItem[];
  },

  async createTestCatalogItem(item: Partial<LabTestCatalogItem>): Promise<LabTestCatalogItem> {
    const { data, error } = await supabase
      .from("lab_test_catalog")
      .insert(camelToSnake(item) as any)
      .select()
      .single();
    if (error) throw error;
    return snakeToCamel(data) as LabTestCatalogItem;
  },

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
      ...snakeToCamel(d),
      results: snakeToCamel(d.lab_results),
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

  async saveResults(labOrderId: string, results: Omit<LabResult, "id" | "lab_order_id" | "hospital_id">[], reportNotes?: string): Promise<void> {
    await supabase.from("lab_results").delete().eq("lab_order_id", labOrderId);
    if (results.length > 0) {
      const rows = results.map((r) => ({ ...camelToSnake(r), lab_order_id: labOrderId }));
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
