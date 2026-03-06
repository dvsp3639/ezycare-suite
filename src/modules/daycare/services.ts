import { supabase } from "@/integrations/supabase/client";
import type { DayCareTreatment, DayCareSession, DayCareSessionTreatment, DayCareBill, DayCareBillItem } from "./types";

export const daycareService = {
  // ─── Treatment Catalog ───
  async getTreatments(): Promise<DayCareTreatment[]> {
    const { data, error } = await supabase.from("daycare_treatments").select("*").order("name");
    if (error) throw error;
    return (data || []) as unknown as DayCareTreatment[];
  },

  async createTreatment(treatment: Partial<DayCareTreatment>): Promise<DayCareTreatment> {
    const { data, error } = await supabase.from("daycare_treatments").insert(treatment as any).select().single();
    if (error) throw error;
    return data as unknown as DayCareTreatment;
  },

  // ─── Sessions ───
  async getSessions(date?: string, status?: string): Promise<DayCareSession[]> {
    let query = supabase
      .from("daycare_sessions")
      .select("*, daycare_session_treatments(*), daycare_bills(*, daycare_bill_items(*))")
      .order("created_at", { ascending: false });
    if (date) query = query.eq("session_date", date);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      treatments: d.daycare_session_treatments,
      bill: d.daycare_bills?.[0] ? {
        ...d.daycare_bills[0],
        items: d.daycare_bills[0].daycare_bill_items,
      } : undefined,
    })) as unknown as DayCareSession[];
  },

  async createSession(session: Partial<DayCareSession>): Promise<DayCareSession> {
    const { data, error } = await supabase.from("daycare_sessions").insert(session as any).select().single();
    if (error) throw error;
    return data as unknown as DayCareSession;
  },

  async updateSession(id: string, updates: Partial<DayCareSession>): Promise<void> {
    const { error } = await supabase.from("daycare_sessions").update(updates as any).eq("id", id);
    if (error) throw error;
  },

  // ─── Session Treatments ───
  async addSessionTreatment(treatment: Partial<DayCareSessionTreatment>): Promise<DayCareSessionTreatment> {
    const { data, error } = await supabase.from("daycare_session_treatments").insert(treatment as any).select().single();
    if (error) throw error;
    return data as unknown as DayCareSessionTreatment;
  },

  async updateSessionTreatment(id: string, updates: Partial<DayCareSessionTreatment>): Promise<void> {
    const { error } = await supabase.from("daycare_session_treatments").update(updates as any).eq("id", id);
    if (error) throw error;
  },

  // ─── Billing ───
  async createBill(bill: Partial<DayCareBill>, items: Omit<DayCareBillItem, "id" | "bill_id" | "hospital_id">[]): Promise<DayCareBill> {
    const { data: billData, error: billError } = await supabase
      .from("daycare_bills")
      .insert(bill as any)
      .select()
      .single();
    if (billError) throw billError;

    if (items.length > 0) {
      const rows = items.map((item) => ({ ...item, bill_id: billData.id }));
      const { error } = await supabase.from("daycare_bill_items").insert(rows as any);
      if (error) throw error;
    }

    return billData as unknown as DayCareBill;
  },

  async updateBill(id: string, updates: Partial<DayCareBill>): Promise<void> {
    const { error } = await supabase.from("daycare_bills").update(updates as any).eq("id", id);
    if (error) throw error;
  },
};
