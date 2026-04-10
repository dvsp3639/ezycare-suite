import { supabase } from "@/integrations/supabase/client";
import { snakeToCamel, camelToSnake } from "@/lib/caseConverter";
import type { LabTestCatalogItem, LabOrder, LabResult, LabOrderInsert, LabTestParameter, ParameterRange, ParameterSaveInput } from "./types";

export const diagnosticsService = {
  // ─── Test Catalog ───
  async getTestCatalog(): Promise<LabTestCatalogItem[]> {
    const { data, error } = await supabase
      .from("lab_test_catalog")
      .select("*, lab_test_parameters(*, lab_test_parameter_ranges(*))")
      .order("name");
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...snakeToCamel(d),
      parameters: (d.lab_test_parameters || []).map((p: any) => ({
        id: p.id,
        testId: p.test_id,
        name: p.name,
        unit: p.unit || "",
        ranges: (p.lab_test_parameter_ranges || []).map((r: any) => ({
          id: r.id,
          parameterId: r.parameter_id,
          sex: r.sex || "any",
          minAge: r.min_age,
          maxAge: r.max_age,
          normalRange: r.normal_range || "",
        })),
      })),
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

  async toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
    const { error } = await supabase
      .from("lab_test_catalog")
      .update({ is_favorite: isFavorite } as any)
      .eq("id", id);
    if (error) throw error;
  },

  async deleteTestCatalogItem(id: string): Promise<void> {
    // Delete parameters (cascades to ranges), composite items, then the test
    await Promise.all([
      supabase.from("lab_test_parameters").delete().eq("test_id", id),
      supabase.from("composite_test_items").delete().eq("parent_test_id", id),
      supabase.from("composite_test_items").delete().eq("child_test_id", id),
    ]);
    const { error } = await supabase.from("lab_test_catalog").delete().eq("id", id);
    if (error) throw error;
  },

  // ─── Test Parameters with Ranges ───
  async saveTestParameters(testId: string, params: ParameterSaveInput[]): Promise<void> {
    // Delete existing parameters (cascades to ranges)
    await supabase.from("lab_test_parameters").delete().eq("test_id", testId);
    if (params.length === 0) return;

    // Insert parameters one at a time to get IDs back for ranges
    for (const p of params) {
      const { data: paramData, error: paramError } = await supabase
        .from("lab_test_parameters")
        .insert({ test_id: testId, name: p.name, unit: p.unit || "" } as any)
        .select()
        .single();
      if (paramError) throw paramError;

      // Insert ranges for this parameter
      if (p.ranges.length > 0) {
        const rangeRows = p.ranges.map((r) => ({
          parameter_id: paramData.id,
          sex: r.sex || "any",
          min_age: r.min_age ?? null,
          max_age: r.max_age ?? null,
          normal_range: r.normal_range || "",
        }));
        const { error: rangeError } = await supabase
          .from("lab_test_parameter_ranges")
          .insert(rangeRows as any);
        if (rangeError) throw rangeError;
      }
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
