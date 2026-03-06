import { supabase } from "@/integrations/supabase/client";
import { snakeToCamel, camelToSnake } from "@/lib/caseConverter";
import type { DayCareTreatment, DayCareSession, DayCareSessionTreatment, DayCareBill, DayCareBillItem } from "./types";

export const daycareService = {
  async getTreatments(): Promise<DayCareTreatment[]> {
    const { data, error } = await supabase.from("daycare_treatments").select("*").order("name");
    if (error) throw error;
    return snakeToCamel(data || []) as DayCareTreatment[];
  },

  async createTreatment(treatment: Partial<DayCareTreatment>): Promise<DayCareTreatment> {
    const { data, error } = await supabase.from("daycare_treatments").insert(camelToSnake(treatment) as any).select().single();
    if (error) throw error;
    return snakeToCamel(data) as DayCareTreatment;
  },

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
      ...snakeToCamel(d),
      treatments: snakeToCamel(d.daycare_session_treatments),
      bill: d.daycare_bills?.[0] ? {
        ...snakeToCamel(d.daycare_bills[0]),
        items: snakeToCamel(d.daycare_bills[0].daycare_bill_items),
      } : undefined,
    })) as DayCareSession[];
  },

  async createSession(session: Partial<DayCareSession>): Promise<DayCareSession> {
    const { data, error } = await supabase.from("daycare_sessions").insert(camelToSnake(session) as any).select().single();
    if (error) throw error;
    return snakeToCamel(data) as DayCareSession;
  },

  async updateSession(id: string, updates: Partial<DayCareSession>): Promise<void> {
    const { error } = await supabase.from("daycare_sessions").update(camelToSnake(updates) as any).eq("id", id);
    if (error) throw error;
  },

  async addSessionTreatment(treatment: Partial<DayCareSessionTreatment>): Promise<DayCareSessionTreatment> {
    const { data, error } = await supabase.from("daycare_session_treatments").insert(camelToSnake(treatment) as any).select().single();
    if (error) throw error;
    return snakeToCamel(data) as DayCareSessionTreatment;
  },

  async updateSessionTreatment(id: string, updates: Partial<DayCareSessionTreatment>): Promise<void> {
    const { error } = await supabase.from("daycare_session_treatments").update(camelToSnake(updates) as any).eq("id", id);
    if (error) throw error;
  },

  async createBill(bill: Partial<DayCareBill>, items: Omit<DayCareBillItem, "id" | "billId" | "hospitalId">[]): Promise<DayCareBill> {
    const { data: billData, error: billError } = await supabase
      .from("daycare_bills")
      .insert(camelToSnake(bill) as any)
      .select()
      .single();
    if (billError) throw billError;

    if (items.length > 0) {
      const rows = items.map((item) => ({ ...camelToSnake(item), bill_id: billData.id }));
      const { error } = await supabase.from("daycare_bill_items").insert(rows as any);
      if (error) throw error;
    }

    return snakeToCamel(billData) as DayCareBill;
  },

  async updateBill(id: string, updates: Partial<DayCareBill>): Promise<void> {
    const { error } = await supabase.from("daycare_bills").update(camelToSnake(updates) as any).eq("id", id);
    if (error) throw error;
  },
};
