import { supabase } from "@/integrations/supabase/client";

export type DocumentType = "prescription" | "purchase_invoice" | "lab_report" | "unknown";

export type RouterResult = {
  documentType: DocumentType;
  confidence: number;
  data: any;
  model: string;
};

export async function routeDocument(
  signedUrl: string,
  hint: "pharmacy" | "inventory" | "auto" = "auto",
): Promise<RouterResult> {
  // Send only the signed URL — the edge function downloads the file server-side.
  // This avoids the ~6 MB request-body cap that killed the flow on mobile photos.
  console.info("[ai-flow] step=route:invoke", { hint });
  const t0 = performance.now();
  const { data, error } = await supabase.functions.invoke("ai-document-router", {
    body: { signedUrl, hint },
  });
  const ms = Math.round(performance.now() - t0);
  if (error) {
    console.error("[ai-flow] step=route:error", { ms, error });
    throw error;
  }
  console.info("[ai-flow] step=route:ok", { ms, documentType: (data as any)?.documentType });
  return data as RouterResult;
}