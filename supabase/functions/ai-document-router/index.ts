// ai-document-router — the ONE AI engine for Ezy OP.
// Input:  { fileBase64: string, mimeType: string, hint?: "pharmacy"|"inventory"|"auto" }
// Output: { documentType: "prescription"|"purchase_invoice"|"lab_report"|"unknown",
//           data: <doc-type-specific structured JSON>, confidence: number, model: string }
//
// Uses Lovable AI Gateway (Gemini) for both classification and extraction in one call.
// Auth: verify_jwt disabled at platform level; we validate the caller's JWT with getClaims.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MODEL = "google/gemini-2.5-flash";

type Body = {
  fileBase64?: string;
  mimeType?: string;
  hint?: "pharmacy" | "inventory" | "auto";
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `You are the Ezy OP HMS document router.
You receive ONE medical document image or PDF page.

Step 1 — classify it into exactly one of:
  - "prescription"        (a doctor's prescription for a patient)
  - "purchase_invoice"    (a pharmaceutical distributor/wholesaler invoice)
  - "lab_report"          (a diagnostic/pathology/radiology report)
  - "unknown"             (anything else)

Step 2 — extract structured data for that type.

Return STRICT JSON, no prose, no markdown fences. Shape:

{
  "documentType": "...",
  "confidence": 0..1,
  "data": { ... }
}

### data shape when documentType = "prescription"
{
  "patient":  { "name": "", "age": "", "gender": "", "mobile": "" },
  "doctor":   { "name": "", "registrationNo": "", "clinic": "" },
  "date":     "YYYY-MM-DD" | "",
  "items": [
    { "name": "", "brandName": "", "genericName": "", "strength": "",
      "dosageForm": "", "quantity": 1, "frequency": "", "duration": "",
      "instructions": "" }
  ],
  "notes": ""
}

### data shape when documentType = "purchase_invoice"
{
  "supplier": { "name": "", "gst": "", "address": "", "contact": "" },
  "invoice":  { "invoiceNo": "", "invoiceDate": "YYYY-MM-DD",
                "subtotal": 0, "gstAmount": 0, "discount": 0,
                "roundOff": 0, "totalAmount": 0, "netPayable": 0 },
  "items": [
    { "name": "", "brandName": "", "genericName": "", "strength": "",
      "dosageForm": "", "packSize": "", "manufacturer": "",
      "batchNo": "", "mfgDate": "YYYY-MM-DD", "expiryDate": "YYYY-MM-DD",
      "quantity": 0, "freeQuantity": 0,
      "purchaseRate": 0, "mrp": 0, "sellingRate": 0,
      "gstPercent": 12, "hsnCode": "", "amount": 0, "barcode": "" }
  ]
}

### data shape when documentType = "lab_report"
{
  "patient":  { "name": "", "age": "", "gender": "", "mobile": "" },
  "labName":  "",
  "reportDate": "YYYY-MM-DD" | "",
  "tests": [ { "name": "", "value": "", "unit": "", "reference": "" } ],
  "notes": ""
}

### data shape when documentType = "unknown"
{ "reason": "" }

Rules:
- Never invent data. If a field is missing, use "" or 0.
- Always output valid JSON parseable by JSON.parse.
- The "hint" is only a soft prior; you still decide the true type from content.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "unauthorized" });

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimErr } = await supabase.auth.getClaims(token);
  if (claimErr || !claims?.claims) return json(401, { error: "unauthorized" });

  if (!LOVABLE_API_KEY) return json(500, { error: "missing_lovable_api_key" });

  let body: Body;
  try { body = await req.json(); }
  catch { return json(400, { error: "invalid_json" }); }

  const { fileBase64, mimeType, hint = "auto" } = body;
  if (!fileBase64 || !mimeType) return json(400, { error: "missing_file" });

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: `hint: ${hint}. Classify and extract this document.` },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${fileBase64}` },
        },
      ],
    },
  ];

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  if (resp.status === 402) return json(402, { error: "ai_credits_exhausted" });
  if (resp.status === 429) return json(429, { error: "ai_rate_limited" });
  if (!resp.ok) {
    const t = await resp.text();
    console.error("[ai-document-router] gateway_error", resp.status, t);
    return json(502, { error: "ai_gateway_error", detail: t.slice(0, 400) });
  }

  const raw = await resp.json();
  const content: string = raw?.choices?.[0]?.message?.content ?? "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(content); }
  catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch { /* noop */ } }
  }

  const documentType = ["prescription", "purchase_invoice", "lab_report"].includes(parsed?.documentType)
    ? parsed.documentType
    : "unknown";
  const confidence = typeof parsed?.confidence === "number" ? parsed.confidence : 0.5;
  const data = parsed?.data ?? {};

  return json(200, { documentType, confidence, data, model: MODEL });
});