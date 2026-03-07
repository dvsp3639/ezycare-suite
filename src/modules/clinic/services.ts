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
    return snakeToCamel(data || []) as DoctorSchedule[];
  },

  async createSchedule(schedule: Partial<DoctorSchedule>): Promise<DoctorSchedule> {
    const { data, error } = await supabase
      .from("doctor_schedules")
      .insert(camelToSnake(schedule) as any)
      .select()
      .single();
    if (error) throw error;
    return snakeToCamel(data) as DoctorSchedule;
  },

  async updateSchedule(id: string, updates: Partial<DoctorSchedule>): Promise<DoctorSchedule> {
    const { data, error } = await supabase
      .from("doctor_schedules")
      .update(camelToSnake(updates) as any)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return snakeToCamel(data) as DoctorSchedule;
  },

  // ─── Time Slots ───
  async createTimeSlot(slot: { scheduleId: string; time: string; maxPatients?: number; isActive?: boolean }) {
    const { data, error } = await supabase
      .from("time_slots")
      .insert(camelToSnake(slot) as any)
      .select()
      .single();
    if (error) throw error;
    return snakeToCamel(data);
  },

  async deleteTimeSlotsBySchedule(scheduleId: string): Promise<void> {
    const { error } = await supabase
      .from("time_slots")
      .delete()
      .eq("schedule_id", scheduleId);
    if (error) throw error;
  },

  async updateTimeSlot(slotId: string, updates: { maxPatients?: number; isActive?: boolean }): Promise<void> {
    const { error } = await supabase
      .from("time_slots")
      .update(camelToSnake(updates) as any)
      .eq("id", slotId);
    if (error) throw error;
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
    return snakeToCamel(data || []) as Appointment[];
  },

  async createAppointment(appointment: Partial<Appointment>): Promise<Appointment> {
    const { data, error } = await supabase
      .from("appointments")
      .insert(camelToSnake(appointment) as any)
      .select()
      .single();
    if (error) throw error;
    return snakeToCamel(data) as Appointment;
  },

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment> {
    const { data, error } = await supabase
      .from("appointments")
      .update(camelToSnake(updates) as any)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return snakeToCamel(data) as Appointment;
  },

  // ─── Vitals ───
  async saveVitals(vitals: Omit<Vitals, "id" | "recordedAt">): Promise<Vitals> {
    const { data, error } = await supabase
      .from("vitals")
      .insert(camelToSnake(vitals) as any)
      .select()
      .single();
    if (error) throw error;
    return snakeToCamel(data) as Vitals;
  },

  // ─── Prescriptions ───
  async savePrescriptions(appointmentId: string, prescriptions: Omit<Prescription, "id" | "createdAt" | "appointmentId">[]): Promise<void> {
    await supabase.from("prescriptions").delete().eq("appointment_id", appointmentId);
    if (prescriptions.length > 0) {
      const rows = prescriptions.map((p) => ({ ...camelToSnake(p), appointment_id: appointmentId }));
      const { error } = await supabase.from("prescriptions").insert(rows as any);
      if (error) throw error;
    }
  },
};
