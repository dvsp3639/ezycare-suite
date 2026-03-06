import { supabase } from "@/integrations/supabase/client";
import type { StaffMember, SalaryRecord, SalaryAdvance, AttendanceRecord, LeaveRequest } from "./types";

export const staffService = {
  // ─── Staff Members ───
  async getStaff(filters?: { role?: string; status?: string }): Promise<StaffMember[]> {
    let query = supabase.from("staff_members").select("*").order("name");
    if (filters?.role) query = query.eq("role", filters.role);
    if (filters?.status) query = query.eq("status", filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as unknown as StaffMember[];
  },

  async createStaff(staff: Partial<StaffMember>): Promise<StaffMember> {
    const { data, error } = await supabase.from("staff_members").insert(staff as any).select().single();
    if (error) throw error;
    return data as unknown as StaffMember;
  },

  async updateStaff(id: string, updates: Partial<StaffMember>): Promise<void> {
    const { error } = await supabase.from("staff_members").update(updates as any).eq("id", id);
    if (error) throw error;
  },

  async deleteStaff(id: string): Promise<void> {
    const { error } = await supabase.from("staff_members").delete().eq("id", id);
    if (error) throw error;
  },

  // ─── Salary Records ───
  async getSalaryRecords(month?: string): Promise<SalaryRecord[]> {
    let query = supabase.from("salary_records").select("*").order("created_at", { ascending: false });
    if (month) query = query.eq("month", month);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as unknown as SalaryRecord[];
  },

  async createSalaryRecord(record: Partial<SalaryRecord>): Promise<SalaryRecord> {
    const { data, error } = await supabase.from("salary_records").insert(record as any).select().single();
    if (error) throw error;
    return data as unknown as SalaryRecord;
  },

  async updateSalaryRecord(id: string, updates: Partial<SalaryRecord>): Promise<void> {
    const { error } = await supabase.from("salary_records").update(updates as any).eq("id", id);
    if (error) throw error;
  },

  // ─── Salary Advances ───
  async getAdvances(): Promise<SalaryAdvance[]> {
    const { data, error } = await supabase.from("salary_advances").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as SalaryAdvance[];
  },

  async createAdvance(advance: Partial<SalaryAdvance>): Promise<SalaryAdvance> {
    const { data, error } = await supabase.from("salary_advances").insert(advance as any).select().single();
    if (error) throw error;
    return data as unknown as SalaryAdvance;
  },

  async updateAdvance(id: string, updates: Partial<SalaryAdvance>): Promise<void> {
    const { error } = await supabase.from("salary_advances").update(updates as any).eq("id", id);
    if (error) throw error;
  },

  // ─── Attendance ───
  async getAttendance(date?: string): Promise<AttendanceRecord[]> {
    let query = supabase.from("attendance_records").select("*").order("staff_name");
    if (date) query = query.eq("attendance_date", date);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as unknown as AttendanceRecord[];
  },

  async createAttendance(record: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
    const { data, error } = await supabase.from("attendance_records").insert(record as any).select().single();
    if (error) throw error;
    return data as unknown as AttendanceRecord;
  },

  async updateAttendance(id: string, updates: Partial<AttendanceRecord>): Promise<void> {
    const { error } = await supabase.from("attendance_records").update(updates as any).eq("id", id);
    if (error) throw error;
  },

  // ─── Leave Requests ───
  async getLeaveRequests(status?: string): Promise<LeaveRequest[]> {
    let query = supabase.from("leave_requests").select("*").order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as unknown as LeaveRequest[];
  },

  async createLeaveRequest(request: Partial<LeaveRequest>): Promise<LeaveRequest> {
    const { data, error } = await supabase.from("leave_requests").insert(request as any).select().single();
    if (error) throw error;
    return data as unknown as LeaveRequest;
  },

  async updateLeaveRequest(id: string, updates: Partial<LeaveRequest>): Promise<void> {
    const { error } = await supabase.from("leave_requests").update(updates as any).eq("id", id);
    if (error) throw error;
  },
};
