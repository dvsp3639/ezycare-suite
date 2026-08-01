import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const SYSTEM = `You are an expert pharmacy OCR assistant for an Indian hospital. The user uploads an image or PDF of a medicine strip, supplier invoice, purchase bill, prescription, or lab report (camera photo, WhatsApp image, scanned PDF, etc.).

Auto-detect the document type. If it shows ANY supplier/distributor info, invoice number, or a table of medicine line items, classify it as "supplier_invoice" and fill BOTH "supplier" and "invoice". Only use "medicine_label" for a single strip/bottle photo without any invoice/bill context.

Return ONLY valid JSON in this exact shape (omit unknown fields, never invent values):

{
  "documentType": "supplier_invoice" | "medicine_label" | "prescription" | "lab_report" | "discharge_summary" | "other",
  "confidence": 0.0-1.0,
  "supplier": {
    "name": { "value": string, "confidence": number },
    "gst":  { "value": string, "confidence": number },
    "address": { "value": string, "confidence": number },
    "contact": { "value": string, "confidence": number }
  },
  "invoice": {
    "invoiceNo":   { "value": string, "confidence": number },
    "invoiceDate": { "value": "YYYY-MM-DD", "confidence": number },
    "subtotal":    { "value": number, "confidence": number },
    "discount":    { "value": number, "confidence": number },
    "gstAmount":   { "value": number, "confidence": number },
    "roundOff":    { "value": number, "confidence": number },
    "totalAmount": { "value": number, "confidence": number },
    "netPayable":  { "value": number, "confidence": number },
    "items": [
      {
        "name": string,
        "brandName": string,
        "genericName": string,
        "strength": string,
        "packSize": string,
        "manufacturer": string,
        "batchNo": string,
        "mfgDate": "YYYY-MM-DD",
        "expiryDate": "YYYY-MM-DD",
        "quantity": number,
        "freeQuantity": number,
        "purchaseRate": number,
        "mrp": number,
        "sellingRate": number,
        "gstPercent": number,
        "hsnCode": string,
        "amount": number,
        "confidence": number
      }
    ]
  },
  "medicine": {
    "name": { "value": string, "confidence": number },
    "brandName": { "value": string, "confidence": number },
    "genericName": { "value": string, "confidence": number },
    "strength": { "value": string, "confidence": number },
    "dosageForm": { "value": "Tablet"|"Capsule"|"Syrup"|"Injection"|"Cream"|"Drops"|"Other", "confidence": number },
    "manufacturer": { "value": string, "confidence": number },
    "batchNo": { "value": string, "confidence": number },
    "mfgDate": { "value": "YYYY-MM-DD", "confidence": number },
    "expiryDate": { "value": "YYYY-MM-DD", "confidence": number },
    "mrp": { "value": number, "confidence": number },
    "hsnCode": { "value": string, "confidence": number },
    "gstPercent": { "value": number, "confidence": number },
    "packSize": { "value": string, "confidence": number },
    "barcode": { "value": string, "confidence": number }
  },
  "rawText": "all extracted text"
}

Rules:
- Extract EVERY medicine row in an invoice table — do not stop at the first row.
- For dates like "07/2027" return "2027-07-31"; "07/27" → assume 20YY; "Mar-26" → "2026-03-31".
- If selling rate isn't printed, leave it null — do not invent it.
- Use 0 for missing free quantity, never null.
- Always set per-item "confidence" 0.0-1.0 reflecting OCR clarity for that row.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { fileBase64, mimeType, hint } = await req.json();
    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: 'fileBase64 and mimeType required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return new Response(JSON.stringify({ error: 'AI not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const isPdf = mimeType === 'application/pdf';
    const dataUrl = `data:${mimeType};base64,${fileBase64}`;
    const userContent: any[] = [
      { type: 'text', text: hint || 'Extract structured medicine and/or invoice data from this document.' },
    ];
    if (isPdf) {
      userContent.push({ type: 'file', file: { filename: 'doc.pdf', file_data: dataUrl } });
    } else {
      userContent.push({ type: 'image_url', image_url: { url: dataUrl } });
    }

    const r = await fetch(GATEWAY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (r.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (r.status === 402) return new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: 'ai_failed', detail: t.slice(0, 300) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const j = await r.json();
    const content = j.choices?.[0]?.message?.content || '{}';
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { parsed = { documentType: 'other', confidence: 0, rawText: content }; }
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'server_error', detail: String((e as Error)?.message ?? e).slice(0, 200) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});