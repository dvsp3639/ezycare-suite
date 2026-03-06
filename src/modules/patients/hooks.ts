import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { patientService } from "./services";
import type { PatientInsert, PatientUpdate } from "./types";

const KEYS = {
  all: ["patients"] as const,
  byMobile: (mobile: string) => ["patients", "mobile", mobile] as const,
  byId: (id: string) => ["patients", id] as const,
  search: (q: string) => ["patients", "search", q] as const,
};

export function usePatients() {
  return useQuery({
    queryKey: KEYS.all,
    queryFn: patientService.getAll,
  });
}

export function usePatientsByMobile(mobile: string) {
  return useQuery({
    queryKey: KEYS.byMobile(mobile),
    queryFn: () => patientService.getByMobile(mobile),
    enabled: mobile.length >= 10,
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: KEYS.byId(id),
    queryFn: () => patientService.getById(id),
    enabled: !!id,
  });
}

export function useSearchPatients(query: string) {
  return useQuery({
    queryKey: KEYS.search(query),
    queryFn: () => patientService.search(query),
    enabled: query.length >= 2,
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patient: PatientInsert) => patientService.create(patient),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useUpdatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: PatientUpdate }) =>
      patientService.update(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useDeletePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => patientService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}
