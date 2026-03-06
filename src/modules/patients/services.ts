import { supabase } from "@/integrations/supabase/client";
import { snakeToCamel, camelToSnake } from "@/lib/caseConverter";
import type { Patient, PatientInsert, PatientUpdate } from "./types";

export const patientService = {
  async getAll(): Promise<Patient[]> {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return snakeToCamel(data || []) as Patient[];
  },

  async getByMobile(mobile: string): Promise<Patient[]> {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("mobile", mobile);
    if (error) throw error;
    return snakeToCamel(data || []) as Patient[];
  },

  async getById(id: string): Promise<Patient | null> {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? snakeToCamel(data) as Patient : null;
  },

  async create(patient: PatientInsert): Promise<Patient> {
    const { data, error } = await supabase
      .from("patients")
      .insert(camelToSnake(patient) as any)
      .select()
      .single();
    if (error) throw error;
    return snakeToCamel(data) as Patient;
  },

  async update(id: string, updates: PatientUpdate): Promise<Patient> {
    const { data, error } = await supabase
      .from("patients")
      .update(camelToSnake(updates) as any)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return snakeToCamel(data) as Patient;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("patients")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async generateRegistrationNumber(): Promise<string> {
    const { data, error } = await supabase.rpc("next_registration_number", {
      _hospital_id: await getHospitalId(),
    });
    if (error) throw error;
    return data as string;
  },

  async search(query: string): Promise<Patient[]> {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .or(`name.ilike.%${query}%,mobile.ilike.%${query}%,registration_number.ilike.%${query}%`)
      .order("name");
    if (error) throw error;
    return snakeToCamel(data || []) as Patient[];
  },
};

async function getHospitalId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data } = await supabase.rpc("get_user_hospital_id", { _user_id: user.id });
  if (!data) throw new Error("No hospital assigned");
  return data;
}
