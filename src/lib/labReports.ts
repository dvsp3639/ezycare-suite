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

/**
 * Fetch a lab report as a Blob so the UI can preview/download it from a local
 * blob URL instead of navigating to the private storage signed URL.
 */
export async function resolveLabReportBlob(stored: string): Promise<Blob> {
  if (!stored) throw new Error("No report file available");

  if (/^https?:\/\//i.test(stored)) {
    const response = await fetch(stored, { credentials: "omit" });
    if (!response.ok) throw new Error("Unable to access report");
    return response.blob();
  }

  const { data, error } = await supabase.storage
    .from("lab-reports")
    .download(stored);

  if (error || !data) throw new Error(error?.message || "Unable to access report");
  return data;
}