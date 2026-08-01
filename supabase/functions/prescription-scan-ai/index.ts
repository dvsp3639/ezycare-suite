import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const SYSTEM = `You are an expert pharmacy prescription OCR assistant for Indian hospitals. The user uploads a photo, scan, or PDF of a doctor's prescription — printed or HANDWRITTEN. Extract every prescribed medicine with the highest possible accuracy.

Return ONLY valid JSON in this exact shape (omit unknown fields, never invent values, never include markdown fences):

{
  "documentType": "prescription" | "other",
  "confidence": 0.0-1.0,
  "patient": {
    "name":   { "value": string, "confidence": number },
    "age":    { "value": string, "confidence": number },
    "gender": { "value": "Male"|"Female"|"Other", "confidence": number },
    "mobile": { "value": string, "confidence": number }
  },
  "doctor": {
    "name":         { "value": string, "confidence": number },
    "qualification":{ "value": string, "confidence": number },
    "registration": { "value": string, "confidence": number }
  },
  "hospital": {
    "name":    { "value": string, "confidence": number },
    "address": { "value": string, "confidence": number }
  },
  "prescriptionDate": { "value": "YYYY-MM-DD", "confidence": number },
  "diagnosis": { "value": string, "confidence": number },
  "medicines": [
    {
      "name": string,
      "brandName": string,
      "genericName": string,
      "strength": string,
      "dosageForm": "Tablet"|"Capsule"|"Syrup"|"Injection"|"Cream"|"Drops"|"Inhaler"|"Other",
      "dosage": string,
      "frequency": string,
      "duration": string,
      "quantity": number,
      "instructions": string,
      "route": "Oral"|"Topical"|"IV"|"IM"|"SC"|"Inhaled"|"Other",
      "confidence": number
    }
  ],
  "rawText": "all extracted text"
}

Rules:
- ALWAYS attempt extraction even if handwriting is unclear; lower the per-item confidence accordingly.
- Normalise common abbreviations:
    BD/BID = twice a day, TDS/TID = three times a day, QID = four times a day,
    OD/QD = once a day, HS = at bedtime, SOS/PRN = as needed,
    AC = before food, PC = after food, x5d = for 5 days, x1w = for 1 week.
- Expand "Tab" -> "Tablet", "Cap" -> "Capsule", "Inj" -> "Injection", "Syp" -> "Syrup".
- Compute a sensible "quantity" when possible: tablets/day * duration days. Otherwise 0.
- Use both brand and generic name fields when distinguishable.
- If the document is clearly not a prescription, set "documentType": "other" and return an empty medicines array.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { fileBase64, mimeType, hint } = await req.json();
    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: 'fileBase64 and mimeType required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return new Response(JSON.stringify({ error: 'AI not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    const isPdf = mimeType === 'application/pdf';
    const dataUrl = `data:${mimeType};base64,${fileBase64}`;
    const userContent: any[] = [
      { type: 'text', text: hint || 'Extract every prescribed medicine from this doctor prescription.' },
    ];
    if (isPdf) userContent.push({ type: 'file', file: { filename: 'rx.pdf', file_data: dataUrl } });
    else userContent.push({ type: 'image_url', image_url: { url: dataUrl } });

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
    try { parsed = JSON.parse(content); } catch { parsed = { documentType: 'other', confidence: 0, rawText: content, medicines: [] }; }
    if (!Array.isArray(parsed.medicines)) parsed.medicines = [];
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'server_error', detail: String((e as Error)?.message ?? e).slice(0, 200) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});