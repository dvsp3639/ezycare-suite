import { supabase } from "@/integrations/supabase/client";
import { snakeToCamel, camelToSnake } from "@/lib/caseConverter";
import type { DayCareTreatment, DayCareSession, DayCareSessionTreatment, DayCareBill, DayCareBillItem, DayCareCase, DayCareCaseItem, DayCareTimelineEvent } from "./types";

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

  async createBill(bill: Partial<DayCareBill>, items: Omit<DayCareBillItem, "id" | "bill_id" | "hospital_id">[]): Promise<DayCareBill> {
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

/* ── Day Care Case workflow (procedures / medicines / consumables /
 *    investigations, automatic timeline and auto-generated billing) ── */

export const daycareCaseService = {
  async getCase(id: string): Promise<DayCareCase | null> {
    const { data, error } = await supabase
      .from("daycare_sessions")
      .select("*, daycare_case_items(*), daycare_timeline(*), daycare_bills(*, daycare_bill_items(*))")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const d: any = data;
    return {
      ...(d as any),
      items: (d.daycare_case_items || []).sort((a: any, b: any) => a.created_at.localeCompare(b.created_at)),
      timeline: (d.daycare_timeline || []).sort((a: any, b: any) => a.created_at.localeCompare(b.created_at)),
      bill: d.daycare_bills?.[0]
        ? { ...d.daycare_bills[0], items: d.daycare_bills[0].daycare_bill_items || [] }
        : undefined,
    } as DayCareCase;
  },

  async updateCase(id: string, updates: Record<string, any>): Promise<void> {
    const { error } = await supabase.from("daycare_sessions").update(updates as any).eq("id", id);
    if (error) throw error;
  },

  async addItem(item: Partial<DayCareCaseItem>): Promise<DayCareCaseItem> {
    const { data, error } = await supabase
      .from("daycare_case_items" as any)
      .insert(item as any)
      .select()
      .single();
    if (error) throw error;
    return data as any as DayCareCaseItem;
  },

  async updateItem(id: string, updates: Partial<DayCareCaseItem>): Promise<void> {
    const { error } = await supabase.from("daycare_case_items" as any).update(updates as any).eq("id", id);
    if (error) throw error;
  },

  async deleteItem(id: string): Promise<void> {
    const { error } = await supabase.from("daycare_case_items" as any).delete().eq("id", id);
    if (error) throw error;
  },

  async logEvent(sessionId: string, event: string, details = "", actor = ""): Promise<void> {
    const { error } = await supabase
      .from("daycare_timeline" as any)
      .insert({ session_id: sessionId, event, details, actor } as any);
    if (error) console.warn("daycare timeline log failed", error);
  },

  async getTimeline(sessionId: string): Promise<DayCareTimelineEvent[]> {
    const { data, error } = await supabase
      .from("daycare_timeline" as any)
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at");
    if (error) throw error;
    return (data || []) as any as DayCareTimelineEvent[];
  },

  /** Creates or replaces the auto-generated bill for a case. */
  async saveBill(
    sessionId: string,
    bill: { subtotal: number; discount: number; tax: number; grand_total: number; payment_status: string; payment_mode?: string | null },
    items: { description: string; category: string; qty: number; unit_price: number; total: number }[],
  ): Promise<string> {
    const { data: existing } = await supabase.from("daycare_bills").select("id").eq("session_id", sessionId).maybeSingle();
    let billId = existing?.id as string | undefined;
    if (billId) {
      const { error } = await supabase.from("daycare_bills").update(bill as any).eq("id", billId);
      if (error) throw error;
      await supabase.from("daycare_bill_items").delete().eq("bill_id", billId);
    } else {
      const { data, error } = await supabase
        .from("daycare_bills")
        .insert({ ...bill, session_id: sessionId } as any)
        .select("id")
        .single();
      if (error) throw error;
      billId = data.id;
    }
    if (items.length > 0) {
      const { error } = await supabase
        .from("daycare_bill_items")
        .insert(items.map((i) => ({ ...i, bill_id: billId })) as any);
      if (error) throw error;
    }
    return billId!;
  },
};
