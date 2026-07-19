import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LabReportConfig } from "@/lib/labReportConfig";

export interface HospitalProfile {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  licenseNumber: string;
  logoUrl?: string;
  tagline?: string;
  accentColor?: string;
  reportConfig?: Partial<LabReportConfig>;
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

async function resolveLogoUrl(path: string | null | undefined): Promise<string | undefined> {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  const { data } = await supabase.storage
    .from("hospital-assets")
    .createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl;
}

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
      const [{ data, error }, { data: profileRow }] = await Promise.all([
        supabase
          .from("hospitals")
          .select("id,name,address,city,state,phone,email,license_number")
          .eq("id", hospitalId)
          .maybeSingle(),
        supabase
          .from("hospital_profiles")
          .select("branding,contact,compliance")
          .eq("hospital_id", hospitalId)
          .maybeSingle(),
      ]);
      if (error || !data) return FALLBACK;
      const branding = (profileRow?.branding as any) || {};
      const contact = (profileRow?.contact as any) || {};
      const compliance = (profileRow?.compliance as any) || {};
      const logoUrl = await resolveLogoUrl(branding.logoPath || branding.logoUrl);
      return {
        id: data.id,
        name: branding.displayName || data.name || FALLBACK.name,
        address: contact.address || data.address || "",
        city: contact.city || data.city || "",
        state: contact.state || data.state || "",
        phone: contact.phone || data.phone || "",
        email: contact.email || data.email || "",
        licenseNumber: compliance.licenseNumber || data.license_number || "",
        logoUrl,
        tagline: branding.tagline || "",
        accentColor: branding.accentColor,
        reportConfig: {
          logoUrl,
          accentColor: branding.accentColor,
          accreditation: compliance.accreditation,
          pathologistName: (profileRow as any)?.signatures?.pathologistName,
          pathologistReg: (profileRow as any)?.signatures?.pathologistReg,
          digitalSignatureUrl: (profileRow as any)?.signatures?.digitalSignatureUrl,
          watermarkText: branding.watermarkText,
          showWatermark: !!branding.watermarkText,
          customerSupport: contact.email || contact.supportEmail,
        },
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}