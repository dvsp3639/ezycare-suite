import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clinicService } from "./services";
import type { Appointment, Vitals, Prescription } from "./types";

const KEYS = {
  schedules: (date?: string) => ["clinic", "schedules", date] as const,
  appointments: (date?: string) => ["clinic", "appointments", date] as const,
};

export function useDoctorSchedules(date?: string) {
  return useQuery({
    queryKey: KEYS.schedules(date),
    queryFn: () => clinicService.getSchedules(date),
  });
}

export function useAppointments(date?: string) {
  return useQuery({
    queryKey: KEYS.appointments(date),
    queryFn: () => clinicService.getAppointments(date),
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (appointment: Partial<Appointment>) => clinicService.createAppointment(appointment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic"] });
    },
  });
}

export function useUpdateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Appointment> }) =>
      clinicService.updateAppointment(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinic"] }),
  });
}

export function useSaveVitals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vitals: Omit<Vitals, "id" | "recorded_at">) => clinicService.saveVitals(vitals),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinic"] }),
  });
}

export function useSavePrescriptions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ appointmentId, prescriptions }: { appointmentId: string; prescriptions: Omit<Prescription, "id" | "created_at" | "appointment_id">[] }) =>
      clinicService.savePrescriptions(appointmentId, prescriptions),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinic"] }),
  });
}
