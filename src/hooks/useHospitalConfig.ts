import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface HospitalConfig {
  hospitalId: string | null;
  aiEnabled: boolean;
  subscription: {
    plan: string;
    status: string;
    trial_ends_at?: string | null;
    current_period_end?: string | null;
  } | null;
  loading: boolean;
}

/**
 * Reads the current user's hospital config (AI flag + subscription).
 * Super admins get { aiEnabled: true, hospitalId: null }.
 */
export function useHospitalConfig(): HospitalConfig {
  const { roles, isSuperAdmin, user } = useAuth();
  const hospitalId = roles.find((r) => r.hospital_id)?.hospital_id || null;
  const [aiEnabled, setAiEnabled] = useState(true);
  const [subscription, setSubscription] = useState<HospitalConfig["subscription"]>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    async function load() {
      if (!user || isSuperAdmin || !hospitalId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const [h, s] = await Promise.all([
        supabase.from("hospitals").select("ai_enabled").eq("id", hospitalId).maybeSingle(),
        (supabase.from("hospital_subscriptions" as any) as any)
          .select("plan,status,trial_ends_at,current_period_end")
          .eq("hospital_id", hospitalId)
          .maybeSingle(),
      ]);
      if (cancel) return;
      setAiEnabled(h.data?.ai_enabled ?? true);
      setSubscription((s.data as any) || null);
      setLoading(false);
    }
    load();
    return () => {
      cancel = true;
    };
  }, [user, isSuperAdmin, hospitalId]);

  return { hospitalId, aiEnabled: isSuperAdmin ? true : aiEnabled, subscription, loading };
}