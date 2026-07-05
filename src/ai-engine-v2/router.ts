// Client for the shared AI document router edge function.
import { supabase } from "@/integrations/supabase/client";

export type DocumentType = "prescription" | "purchase_invoice" | "lab_report" | "unknown";

export type RouterResult = {
  documentType: DocumentType;
  confidence: number;
  data: any;
  model: string;
};

/** Fetches a file from a signed URL and returns its base64 payload + MIME. */
export async function fetchAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const blob = await res.blob();
  const mimeType = blob.type || "application/octet-stream";
  const base64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.split(",")[1] || s);
    };
    r.onerror = () => reject(r.error || new Error("read_failed"));
    r.readAsDataURL(blob);
  });
  return { base64, mimeType };
}

export async function routeDocument(
  signedUrl: string,
  hint: "pharmacy" | "inventory" | "auto" = "auto",
): Promise<RouterResult> {
  const { base64, mimeType } = await fetchAsBase64(signedUrl);
  const { data, error } = await supabase.functions.invoke("ai-document-router", {
    body: { fileBase64: base64, mimeType, hint },
  });
  if (error) throw error;
  return data as RouterResult;
}