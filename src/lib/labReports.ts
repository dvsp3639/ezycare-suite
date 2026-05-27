import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve a stored lab-report reference into a viewable URL.
 * - Legacy rows may contain a full public URL (kept working for backward compat).
 * - New rows store a storage path; we mint a short-lived signed URL on demand.
 */
export async function resolveLabReportUrl(stored: string, expiresInSeconds = 600): Promise<string> {
  if (!stored) throw new Error("No report file available");
  if (/^https?:\/\//i.test(stored)) return stored;
  const { data, error } = await supabase.storage
    .from("lab-reports")
    .createSignedUrl(stored, expiresInSeconds);
  if (error || !data?.signedUrl) throw new Error(error?.message || "Unable to access report");
  return data.signedUrl;
}