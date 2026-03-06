import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ipdService } from "./services";
import type { Ward, Bed, IPDAdmission, DoctorVisitNote, NurseNote, MedicineEntry, SurgicalEntry, DiagnosticEntry, DischargeSummary, BedTransfer } from "./types";

const KEYS = {
  wards: ["ipd", "wards"] as const,
  beds: (wardId?: string) => ["ipd", "beds", wardId] as const,
  admissions: (status?: string) => ["ipd", "admissions", status] as const,
  doctorNotes: (admissionId: string) => ["ipd", "doctorNotes", admissionId] as const,
  nurseNotes: (admissionId: string) => ["ipd", "nurseNotes", admissionId] as const,
  medicineEntries: (admissionId: string) => ["ipd", "medicineEntries", admissionId] as const,
  surgicalEntries: (admissionId: string) => ["ipd", "surgicalEntries", admissionId] as const,
  diagnosticEntries: (admissionId: string) => ["ipd", "diagnosticEntries", admissionId] as const,
  discharge: (admissionId: string) => ["ipd", "discharge", admissionId] as const,
  bedTransfers: (admissionId: string) => ["ipd", "bedTransfers", admissionId] as const,
};

export function useWards() {
  return useQuery({ queryKey: KEYS.wards, queryFn: ipdService.getWards });
}

export function useBeds(wardId?: string) {
  return useQuery({ queryKey: KEYS.beds(wardId), queryFn: () => ipdService.getBeds(wardId) });
}

export function useAdmissions(status?: string) {
  return useQuery({ queryKey: KEYS.admissions(status), queryFn: () => ipdService.getAdmissions(status) });
}

export function useDoctorNotes(admissionId: string) {
  return useQuery({ queryKey: KEYS.doctorNotes(admissionId), queryFn: () => ipdService.getDoctorNotes(admissionId), enabled: !!admissionId });
}

export function useNurseNotes(admissionId: string) {
  return useQuery({ queryKey: KEYS.nurseNotes(admissionId), queryFn: () => ipdService.getNurseNotes(admissionId), enabled: !!admissionId });
}

export function useMedicineEntries(admissionId: string) {
  return useQuery({ queryKey: KEYS.medicineEntries(admissionId), queryFn: () => ipdService.getMedicineEntries(admissionId), enabled: !!admissionId });
}

export function useSurgicalEntries(admissionId: string) {
  return useQuery({ queryKey: KEYS.surgicalEntries(admissionId), queryFn: () => ipdService.getSurgicalEntries(admissionId), enabled: !!admissionId });
}

export function useDiagnosticEntries(admissionId: string) {
  return useQuery({ queryKey: KEYS.diagnosticEntries(admissionId), queryFn: () => ipdService.getDiagnosticEntries(admissionId), enabled: !!admissionId });
}

export function useDischargeSummary(admissionId: string) {
  return useQuery({ queryKey: KEYS.discharge(admissionId), queryFn: () => ipdService.getDischargeSummary(admissionId), enabled: !!admissionId });
}

export function useBedTransfers(admissionId: string) {
  return useQuery({ queryKey: KEYS.bedTransfers(admissionId), queryFn: () => ipdService.getBedTransfers(admissionId), enabled: !!admissionId });
}

export function useCreateAdmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (admission: Partial<IPDAdmission>) => ipdService.createAdmission(admission),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ipd"] }),
  });
}

export function useUpdateAdmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<IPDAdmission> }) => ipdService.updateAdmission(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ipd"] }),
  });
}

export function useCreateWard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ward: Partial<Ward>) => ipdService.createWard(ward),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.wards }),
  });
}

export function useUpdateBed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Bed> }) => ipdService.updateBed(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ipd"] }),
  });
}

export function useCreateDoctorNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note: Partial<DoctorVisitNote>) => ipdService.createDoctorNote(note),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: KEYS.doctorNotes(vars.admission_id!) }),
  });
}

export function useCreateNurseNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note: Partial<NurseNote>) => ipdService.createNurseNote(note),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: KEYS.nurseNotes(vars.admission_id!) }),
  });
}

export function useCreateMedicineEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: Partial<MedicineEntry>) => ipdService.createMedicineEntry(entry),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: KEYS.medicineEntries(vars.admission_id!) }),
  });
}

export function useCreateSurgicalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: Partial<SurgicalEntry>) => ipdService.createSurgicalEntry(entry),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: KEYS.surgicalEntries(vars.admission_id!) }),
  });
}

export function useCreateDiagnosticEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: Partial<DiagnosticEntry>) => ipdService.createDiagnosticEntry(entry),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: KEYS.diagnosticEntries(vars.admission_id!) }),
  });
}

export function useCreateDischargeSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (summary: Partial<DischargeSummary>) => ipdService.createDischargeSummary(summary),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ipd"] }),
  });
}

export function useCreateBedTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (transfer: Partial<BedTransfer>) => ipdService.createBedTransfer(transfer),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ipd"] }),
  });
}
