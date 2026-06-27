import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HospitalProfile {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  licenseNumber: string;
}

const FALLBACK: HospitalProfile = {
  id: "",
  name: "EzyOp Diagnostics",
  address: "",
  city: "",
  state: "",
  phone: "",
  email: "",
  licenseNumber: "",
};

export function useHospitalProfile() {
  return useQuery({
    queryKey: ["hospital-profile"],
    queryFn: async (): Promise<HospitalProfile> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return FALLBACK;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("hospital_id")
        .eq("user_id", auth.user.id)
        .not("hospital_id", "is", null)
        .limit(1)
        .maybeSingle();
      const hospitalId = roles?.hospital_id;
      if (!hospitalId) return FALLBACK;
      const { data, error } = await supabase
        .from("hospitals")
        .select("id,name,address,city,state,phone,email,license_number")
        .eq("id", hospitalId)
        .maybeSingle();
      if (error || !data) return FALLBACK;
      return {
        id: data.id,
        name: data.name || FALLBACK.name,
        address: data.address || "",
        city: data.city || "",
        state: data.state || "",
        phone: data.phone || "",
        email: data.email || "",
        licenseNumber: data.license_number || "",
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}