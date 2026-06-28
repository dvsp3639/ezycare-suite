import { supabase } from "@/integrations/supabase/client";
import { snakeToCamel, camelToSnake } from "@/lib/caseConverter";
import type { Medicine, PharmacyOrder, PharmacyOrderItem, MedicineInsert } from "./types";

export const pharmacyService = {
  // ─── Medicines ───
  async getMedicines(): Promise<Medicine[]> {
    const { data, error } = await supabase
      .from("medicines")
      .select("*")
      .order("name");
    if (error) throw error;
    return snakeToCamel(data || []) as Medicine[];
  },

  async searchMedicines(query: string): Promise<Medicine[]> {
    const { data, error } = await supabase
      .from("medicines")
      .select("*")
      .or(`name.ilike.%${query}%,generic_name.ilike.%${query}%`)
      .order("name");
    if (error) throw error;
    return snakeToCamel(data || []) as Medicine[];
  },

  async createMedicine(medicine: MedicineInsert): Promise<Medicine> {
    const { data, error } = await supabase
      .from("medicines")
      .insert(camelToSnake(medicine) as any)
      .select()
      .single();
    if (error) throw error;
    return snakeToCamel(data) as Medicine;
  },

  async updateMedicineStock(id: string, stockChange: number): Promise<void> {
    const { data: med } = await supabase.from("medicines").select("stock").eq("id", id).single();
    if (med) {
      const { error } = await supabase
        .from("medicines")
        .update({ stock: (med.stock || 0) + stockChange } as any)
        .eq("id", id);
      if (error) throw error;
    }
  },

  // ─── Pharmacy Orders ───
  async getOrders(filters?: { status?: string; issueType?: string }): Promise<PharmacyOrder[]> {
    let query = supabase
      .from("pharmacy_orders")
      .select("*, pharmacy_order_items(*)")
      .order("created_at", { ascending: false });
    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.issueType) query = query.eq("issue_type", filters.issueType);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...snakeToCamel(d),
      items: snakeToCamel(d.pharmacy_order_items),
    })) as PharmacyOrder[];
  },

  async createOrder(order: Partial<PharmacyOrder>, items: Omit<PharmacyOrderItem, "id" | "orderId">[]): Promise<PharmacyOrder> {
    const { data: orderData, error: orderError } = await supabase
      .from("pharmacy_orders")
      .insert(camelToSnake(order) as any)
      .select()
      .single();
    if (orderError) throw orderError;

    if (items.length > 0) {
      const rows = items.map((item) => ({ ...camelToSnake(item), order_id: orderData.id }));
      const { error } = await supabase.from("pharmacy_order_items").insert(rows as any);
      if (error) throw error;
    }

    return snakeToCamel(orderData) as PharmacyOrder;
  },

  async completeSale(order: Partial<PharmacyOrder>, items: Omit<PharmacyOrderItem, "id" | "orderId">[]): Promise<PharmacyOrder> {
    const { data, error } = await supabase.rpc("create_pharmacy_sale" as any, {
      _order: camelToSnake(order),
      _items: items.map((item) => camelToSnake(item)),
    });
    if (error) throw error;
    return snakeToCamel(data) as PharmacyOrder;
  },

  async updateOrder(id: string, updates: Partial<PharmacyOrder>): Promise<void> {
    const { error } = await supabase
      .from("pharmacy_orders")
      .update(camelToSnake(updates) as any)
      .eq("id", id);
    if (error) throw error;
  },
};

/* ──────────────────────────────────────────────────────────────────────
 * Prescription correction memory (AI learning loop)
 * ──────────────────────────────────────────────────────────────────── */

export type RxCorrection = {
  ai_text: string;
  medicine_id: string | null;
  medicine_name: string;
  picks: number;
  doctor_name: string;
};

export const rxLearningService = {
  async record(doctorName: string, aiText: string, medicineId: string, medicineName: string) {
    try {
      await supabase.rpc("record_rx_correction" as any, {
        _doctor_name: doctorName || "",
        _ai_text: aiText || "",
        _medicine_id: medicineId,
        _medicine_name: medicineName,
      });
    } catch (e) {
      // non-fatal
      console.warn("record_rx_correction failed", e);
    }
  },
  async loadForDoctor(doctorName: string): Promise<RxCorrection[]> {
    const d = (doctorName || "").toLowerCase().trim();
    const { data, error } = await supabase
      .from("prescription_corrections" as any)
      .select("ai_text, medicine_id, medicine_name, picks, doctor_name")
      .or(`doctor_name.eq.${d},doctor_name.eq.`)
      .order("picks", { ascending: false })
      .limit(500);
    if (error) return [];
    return (data || []) as any as RxCorrection[];
  },
};
