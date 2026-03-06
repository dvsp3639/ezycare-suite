import { supabase } from "@/integrations/supabase/client";
import { snakeToCamel, camelToSnake } from "@/lib/caseConverter";
import type {
  Ward, Bed, IPDAdmission, DoctorVisitNote, NurseNote,
  MedicineEntry, SurgicalEntry, DiagnosticEntry, DischargeSummary, BedTransfer,
} from "./types";

export const ipdService = {
  // ─── Wards & Beds ───
  async getWards(): Promise<Ward[]> {
    const { data, error } = await supabase
      .from("wards")
      .select("*, beds(*)")
      .order("name");
    if (error) throw error;
    return snakeToCamel(data || []) as Ward[];
  },

  async createWard(ward: Partial<Ward>): Promise<Ward> {
    const { data, error } = await supabase.from("wards").insert(camelToSnake(ward) as any).select().single();
    if (error) throw error;
    return snakeToCamel(data) as Ward;
  },

  async updateWard(id: string, updates: Partial<Ward>): Promise<void> {
    const { error } = await supabase.from("wards").update(camelToSnake(updates) as any).eq("id", id);
    if (error) throw error;
  },

  async getBeds(wardId?: string): Promise<Bed[]> {
    let query = supabase.from("beds").select("*").order("bed_number");
    if (wardId) query = query.eq("ward_id", wardId);
    const { data, error } = await query;
    if (error) throw error;
    return snakeToCamel(data || []) as Bed[];
  },

  async createBed(bed: Partial<Bed>): Promise<Bed> {
    const { data, error } = await supabase.from("beds").insert(camelToSnake(bed) as any).select().single();
    if (error) throw error;
    return snakeToCamel(data) as Bed;
  },

  async updateBed(id: string, updates: Partial<Bed>): Promise<void> {
    const { error } = await supabase.from("beds").update(camelToSnake(updates) as any).eq("id", id);
    if (error) throw error;
  },

  // ─── Admissions ───
  async getAdmissions(status?: string): Promise<IPDAdmission[]> {
    let query = supabase.from("ipd_admissions").select("*").order("admission_date", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    return snakeToCamel(data || []) as IPDAdmission[];
  },

  async createAdmission(admission: Partial<IPDAdmission>): Promise<IPDAdmission> {
    const { data, error } = await supabase.from("ipd_admissions").insert(camelToSnake(admission) as any).select().single();
    if (error) throw error;
    return snakeToCamel(data) as IPDAdmission;
  },

  async updateAdmission(id: string, updates: Partial<IPDAdmission>): Promise<void> {
    const { error } = await supabase.from("ipd_admissions").update(camelToSnake(updates) as any).eq("id", id);
    if (error) throw error;
  },

  // ─── Doctor Visit Notes ───
  async getDoctorNotes(admissionId: string): Promise<DoctorVisitNote[]> {
    const { data, error } = await supabase
      .from("doctor_visit_notes")
      .select("*")
      .eq("admission_id", admissionId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return snakeToCamel(data || []) as DoctorVisitNote[];
  },

  async createDoctorNote(note: Partial<DoctorVisitNote>): Promise<DoctorVisitNote> {
    const { data, error } = await supabase.from("doctor_visit_notes").insert(camelToSnake(note) as any).select().single();
    if (error) throw error;
    return snakeToCamel(data) as DoctorVisitNote;
  },

  // ─── Nurse Notes ───
  async getNurseNotes(admissionId: string): Promise<NurseNote[]> {
    const { data, error } = await supabase
      .from("nurse_notes")
      .select("*")
      .eq("admission_id", admissionId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return snakeToCamel(data || []) as NurseNote[];
  },

  async createNurseNote(note: Partial<NurseNote>): Promise<NurseNote> {
    const { data, error } = await supabase.from("nurse_notes").insert(camelToSnake(note) as any).select().single();
    if (error) throw error;
    return snakeToCamel(data) as NurseNote;
  },

  // ─── Medicine Entries ───
  async getMedicineEntries(admissionId: string): Promise<MedicineEntry[]> {
    const { data, error } = await supabase
      .from("medicine_entries")
      .select("*")
      .eq("admission_id", admissionId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return snakeToCamel(data || []) as MedicineEntry[];
  },

  async createMedicineEntry(entry: Partial<MedicineEntry>): Promise<MedicineEntry> {
    const { data, error } = await supabase.from("medicine_entries").insert(camelToSnake(entry) as any).select().single();
    if (error) throw error;
    return snakeToCamel(data) as MedicineEntry;
  },

  // ─── Surgical Entries ───
  async getSurgicalEntries(admissionId: string): Promise<SurgicalEntry[]> {
    const { data, error } = await supabase
      .from("surgical_entries")
      .select("*")
      .eq("admission_id", admissionId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return snakeToCamel(data || []) as SurgicalEntry[];
  },

  async createSurgicalEntry(entry: Partial<SurgicalEntry>): Promise<SurgicalEntry> {
    const { data, error } = await supabase.from("surgical_entries").insert(camelToSnake(entry) as any).select().single();
    if (error) throw error;
    return snakeToCamel(data) as SurgicalEntry;
  },

  // ─── Diagnostic Entries ───
  async getDiagnosticEntries(admissionId: string): Promise<DiagnosticEntry[]> {
    const { data, error } = await supabase
      .from("diagnostic_entries")
      .select("*")
      .eq("admission_id", admissionId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return snakeToCamel(data || []) as DiagnosticEntry[];
  },

  async createDiagnosticEntry(entry: Partial<DiagnosticEntry>): Promise<DiagnosticEntry> {
    const { data, error } = await supabase.from("diagnostic_entries").insert(camelToSnake(entry) as any).select().single();
    if (error) throw error;
    return snakeToCamel(data) as DiagnosticEntry;
  },

  // ─── Discharge Summaries ───
  async getDischargeSummary(admissionId: string): Promise<DischargeSummary | null> {
    const { data, error } = await supabase
      .from("discharge_summaries")
      .select("*")
      .eq("admission_id", admissionId)
      .maybeSingle();
    if (error) throw error;
    return data ? snakeToCamel(data) as DischargeSummary : null;
  },

  async createDischargeSummary(summary: Partial<DischargeSummary>): Promise<DischargeSummary> {
    const { data, error } = await supabase.from("discharge_summaries").insert(camelToSnake(summary) as any).select().single();
    if (error) throw error;
    return snakeToCamel(data) as DischargeSummary;
  },

  // ─── Bed Transfers ───
  async getBedTransfers(admissionId: string): Promise<BedTransfer[]> {
    const { data, error } = await supabase
      .from("bed_transfers")
      .select("*")
      .eq("admission_id", admissionId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return snakeToCamel(data || []) as BedTransfer[];
  },

  async createBedTransfer(transfer: Partial<BedTransfer>): Promise<BedTransfer> {
    const { data, error } = await supabase.from("bed_transfers").insert(camelToSnake(transfer) as any).select().single();
    if (error) throw error;
    return snakeToCamel(data) as BedTransfer;
  },
};