import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { staffService } from "./services";
import type { StaffMember, SalaryRecord, SalaryAdvance, AttendanceRecord, LeaveRequest } from "./types";

const KEYS = {
  staff: (filters?: any) => ["staff", "members", filters] as const,
  salary: (month?: string) => ["staff", "salary", month] as const,
  advances: ["staff", "advances"] as const,
  attendance: (date?: string) => ["staff", "attendance", date] as const,
  leaves: (status?: string) => ["staff", "leaves", status] as const,
};

export function useStaffMembers(filters?: { role?: string; status?: string }) {
  return useQuery({ queryKey: KEYS.staff(filters), queryFn: () => staffService.getStaff(filters) });
}

export function useSalaryRecords(month?: string) {
  return useQuery({ queryKey: KEYS.salary(month), queryFn: () => staffService.getSalaryRecords(month) });
}

export function useSalaryAdvances() {
  return useQuery({ queryKey: KEYS.advances, queryFn: staffService.getAdvances });
}

export function useAttendance(date?: string) {
  return useQuery({ queryKey: KEYS.attendance(date), queryFn: () => staffService.getAttendance(date) });
}

export function useLeaveRequests(status?: string) {
  return useQuery({ queryKey: KEYS.leaves(status), queryFn: () => staffService.getLeaveRequests(status) });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (staff: Partial<StaffMember>) => staffService.createStaff(staff),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<StaffMember> }) => staffService.updateStaff(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
  });
}

export function useCreateSalaryRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: Partial<SalaryRecord>) => staffService.createSalaryRecord(record),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff", "salary"] }),
  });
}

export function useUpdateSalaryRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<SalaryRecord> }) => staffService.updateSalaryRecord(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff", "salary"] }),
  });
}

export function useCreateAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: Partial<AttendanceRecord>) => staffService.createAttendance(record),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff", "attendance"] }),
  });
}

export function useUpdateAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<AttendanceRecord> }) => staffService.updateAttendance(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff", "attendance"] }),
  });
}

export function useCreateLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (request: Partial<LeaveRequest>) => staffService.createLeaveRequest(request),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff", "leaves"] }),
  });
}

export function useUpdateLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<LeaveRequest> }) => staffService.updateLeaveRequest(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff", "leaves"] }),
  });
}

export function useCreateAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (advance: Partial<SalaryAdvance>) => staffService.createAdvance(advance),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.advances }),
  });
}

export function useUpdateAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<SalaryAdvance> }) => staffService.updateAdvance(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.advances }),
  });
}
