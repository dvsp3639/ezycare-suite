import { supabase } from "@/integrations/supabase/client";

// New tables aren't in generated types.ts yet — use a loose client accessor.
const sb = supabase as any;

export type WeeklySchedule = {
  id: string;
  hospital_id: string;
  doctor_name: string;
  day_of_week: number; // 0=Sun..6=Sat
  is_working: boolean;
  notes: string;
  sessions?: OpSession[];
};

export type OpSession = {
  id?: string;
  weekly_schedule_id?: string;
  session_name: string;
  start_time: string; // "HH:mm" 24h
  end_time: string;
  slot_duration_min: number;
  buffer_min: number;
  token_capacity: number;
  max_online: number;
  max_walkin: number;
  consultation_fee: number;
  booking_window_days: number;
  online_enabled: boolean;
  walkin_enabled: boolean;
  sort_order?: number;
};

export type DailyOverride = {
  id?: string;
  doctor_name: string;
  override_date: string; // YYYY-MM-DD
  override_type: "custom" | "closed" | "half-day";
  sessions: Pick<OpSession, "start_time" | "end_time" | "slot_duration_min" | "token_capacity">[];
  reason?: string;
};

export type DoctorLeave = {
  id?: string;
  doctor_name: string;
  from_date: string;
  to_date: string;
  leave_type: "single" | "half" | "vacation" | "conference" | "emergency" | "recurring";
  half_day_period?: "AM" | "PM" | null;
  reason?: string;
  status?: "Pending" | "Approved" | "Rejected";
};

export type HospitalHoliday = {
  id?: string;
  holiday_date: string;
  name: string;
  is_recurring_yearly: boolean;
};

export type DoctorLiveStatus = {
  id?: string;
  doctor_name: string;
  status: "available" | "late" | "consulting" | "in_ot" | "emergency" | "closed" | "leave";
  delay_minutes?: number;
  message?: string;
  updated_at?: string;
};

export const availabilityService = {
  // ── Weekly ──
  async getWeekly(doctorName: string): Promise<WeeklySchedule[]> {
    const { data, error } = await sb
      .from("doctor_weekly_schedules")
      .select("*, sessions:doctor_op_sessions(*)")
      .eq("doctor_name", doctorName)
      .order("day_of_week");
    if (error) throw error;
    return (data || []) as WeeklySchedule[];
  },

  async upsertWeeklyDay(doctorName: string, dayOfWeek: number, isWorking: boolean, notes = ""): Promise<WeeklySchedule> {
    const { data, error } = await sb
      .from("doctor_weekly_schedules")
      .upsert(
        { doctor_name: doctorName, day_of_week: dayOfWeek, is_working: isWorking, notes },
        { onConflict: "hospital_id,doctor_name,day_of_week" }
      )
      .select()
      .single();
    if (error) throw error;
    return data as WeeklySchedule;
  },

  async replaceSessions(weeklyId: string, sessions: OpSession[]): Promise<void> {
    const { error: delErr } = await sb.from("doctor_op_sessions").delete().eq("weekly_schedule_id", weeklyId);
    if (delErr) throw delErr;
    if (sessions.length === 0) return;
    const rows = sessions.map((s, i) => ({ ...s, weekly_schedule_id: weeklyId, sort_order: i }));
    const { error } = await sb.from("doctor_op_sessions").insert(rows);
    if (error) throw error;
  },

  // ── Overrides ──
  async getOverrides(doctorName: string, from: string, to: string): Promise<DailyOverride[]> {
    const { data, error } = await sb
      .from("doctor_daily_overrides")
      .select("*")
      .eq("doctor_name", doctorName)
      .gte("override_date", from)
      .lte("override_date", to)
      .order("override_date");
    if (error) throw error;
    return (data || []) as DailyOverride[];
  },
  async upsertOverride(o: DailyOverride): Promise<void> {
    const { error } = await sb
      .from("doctor_daily_overrides")
      .upsert(o, { onConflict: "hospital_id,doctor_name,override_date" });
    if (error) throw error;
  },
  async deleteOverride(id: string): Promise<void> {
    const { error } = await sb.from("doctor_daily_overrides").delete().eq("id", id);
    if (error) throw error;
  },

  // ── Leaves ──
  async getLeaves(doctorName: string): Promise<DoctorLeave[]> {
    const { data, error } = await sb
      .from("doctor_leaves")
      .select("*")
      .eq("doctor_name", doctorName)
      .order("from_date", { ascending: false });
    if (error) throw error;
    return (data || []) as DoctorLeave[];
  },
  async addLeave(l: DoctorLeave): Promise<void> {
    const { error } = await sb.from("doctor_leaves").insert(l);
    if (error) throw error;
  },
  async deleteLeave(id: string): Promise<void> {
    const { error } = await sb.from("doctor_leaves").delete().eq("id", id);
    if (error) throw error;
  },

  // ── Holidays ──
  async getHolidays(): Promise<HospitalHoliday[]> {
    const { data, error } = await sb
      .from("hospital_holidays")
      .select("*")
      .order("holiday_date");
    if (error) throw error;
    return (data || []) as HospitalHoliday[];
  },
  async addHoliday(h: HospitalHoliday): Promise<void> {
    const { error } = await sb.from("hospital_holidays").insert(h);
    if (error) throw error;
  },
  async deleteHoliday(id: string): Promise<void> {
    const { error } = await sb.from("hospital_holidays").delete().eq("id", id);
    if (error) throw error;
  },

  // ── Live status ──
  async getLiveStatus(doctorName: string): Promise<DoctorLiveStatus | null> {
    const { data, error } = await sb
      .from("doctor_live_status")
      .select("*")
      .eq("doctor_name", doctorName)
      .maybeSingle();
    if (error) throw error;
    return data as DoctorLiveStatus | null;
  },
  async setLiveStatus(s: DoctorLiveStatus): Promise<void> {
    const { error } = await sb
      .from("doctor_live_status")
      .upsert(s, { onConflict: "hospital_id,doctor_name" });
    if (error) throw error;
  },

  // ── Materialize slots ──
  async generateSlots(doctorName: string, fromDate: string, toDate: string): Promise<number> {
    const { data, error } = await sb.rpc("generate_doctor_slots", {
      _doctor_name: doctorName,
      _from_date: fromDate,
      _to_date: toDate,
    });
    if (error) throw error;
    return (data as number) || 0;
  },
};

// Helpers
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function emptySession(name = "Morning OP", start = "09:00", end = "13:00"): OpSession {
  return {
    session_name: name,
    start_time: start,
    end_time: end,
    slot_duration_min: 15,
    buffer_min: 0,
    token_capacity: 20,
    max_online: 10,
    max_walkin: 10,
    consultation_fee: 0,
    booking_window_days: 7,
    online_enabled: true,
    walkin_enabled: true,
  };
}

export const LIVE_STATUS_META: Record<DoctorLiveStatus["status"], { label: string; dot: string; chip: string }> = {
  available: { label: "Available", dot: "bg-success", chip: "bg-success/10 text-success border-success/30" },
  late: { label: "Running Late", dot: "bg-warning", chip: "bg-warning/10 text-warning border-warning/30" },
  consulting: { label: "Consulting", dot: "bg-info", chip: "bg-info/10 text-info border-info/30" },
  in_ot: { label: "In OT", dot: "bg-primary", chip: "bg-primary/10 text-primary border-primary/30" },
  emergency: { label: "Emergency", dot: "bg-destructive", chip: "bg-destructive/10 text-destructive border-destructive/30" },
  closed: { label: "OP Closed", dot: "bg-muted-foreground", chip: "bg-muted text-muted-foreground border-border" },
  leave: { label: "On Leave", dot: "bg-muted-foreground", chip: "bg-muted text-muted-foreground border-border" },
};