import { supabase } from "@/integrations/supabase/client";
import { snakeToCamel, camelToSnake } from "@/lib/caseConverter";
import type { DoctorSchedule, Appointment, Vitals, Prescription } from "./types";

export const clinicService = {
  // ─── Doctor Schedules ───
  async getSchedules(date?: string): Promise<DoctorSchedule[]> {
    let query = supabase
      .from("doctor_schedules")
      .select("*, time_slots(*)")
      .order("doctor_name");
    if (date) query = query.eq("schedule_date", date);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as unknown as DoctorSchedule[];
  },

  async createSchedule(schedule: Partial<DoctorSchedule>): Promise<DoctorSchedule> {
    const { data, error } = await supabase
      .from("doctor_schedules")
      .insert(schedule as any)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as DoctorSchedule;
  },

  async updateSchedule(id: string, updates: Partial<DoctorSchedule>): Promise<DoctorSchedule> {
    const { data, error } = await supabase
      .from("doctor_schedules")
      .update(updates as any)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as DoctorSchedule;
  },

  // ─── Time Slots ───
  async createTimeSlot(slot: { schedule_id: string; time: string; max_patients?: number; is_active?: boolean }) {
    const { data, error } = await supabase
      .from("time_slots")
      .insert(slot as any)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async incrementSlotBooked(slotId: string): Promise<void> {
    const { data: slot } = await supabase
      .from("time_slots")
      .select("booked_patients")
      .eq("id", slotId)
      .single();
    if (slot) {
      await supabase
        .from("time_slots")
        .update({ booked_patients: (slot.booked_patients || 0) + 1 } as any)
        .eq("id", slotId);
    }
  },

  // ─── Appointments (OP Queue) ───
  async getAppointments(date?: string): Promise<Appointment[]> {
    let query = supabase
      .from("appointments")
      .select("*, vitals(*), prescriptions(*)")
      .order("token_no");
    if (date) query = query.eq("appointment_date", date);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as unknown as Appointment[];
  },

  async createAppointment(appointment: Partial<Appointment>): Promise<Appointment> {
    const { data, error } = await supabase
      .from("appointments")
      .insert(appointment as any)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as Appointment;
  },

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment> {
    const { data, error } = await supabase
      .from("appointments")
      .update(updates as any)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as Appointment;
  },

  // ─── Vitals ───
  async saveVitals(vitals: Omit<Vitals, "id" | "recorded_at">): Promise<Vitals> {
    const { data, error } = await supabase
      .from("vitals")
      .insert(vitals as any)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as Vitals;
  },

  // ─── Prescriptions ───
  async savePrescriptions(appointmentId: string, prescriptions: Omit<Prescription, "id" | "created_at" | "appointment_id">[]): Promise<void> {
    // Delete existing and re-insert
    await supabase.from("prescriptions").delete().eq("appointment_id", appointmentId);
    if (prescriptions.length > 0) {
      const rows = prescriptions.map((p) => ({ ...p, appointment_id: appointmentId }));
      const { error } = await supabase.from("prescriptions").insert(rows as any);
      if (error) throw error;
    }
  },
};
