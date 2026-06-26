import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

interface Module { id: string; title: string; route: string; }

const SYSTEM = `You are the Ezy OP Hospital Operating System assistant.
Translate a user's natural-language query (English, Telugu, Hindi, Hinglish) into a structured JSON action for the HMS.

Available modules (id → route):
- patient-registration → /patient-registration
- clinic-management → /clinic-management
- day-care → /day-care
- ipd → /ipd
- accounts → /accounts
- insurance → /insurance
- diagnostics → /diagnostics
- inventory → /inventory
- pharmacy → /pharmacy
- staff-payroll → /staff-payroll
- users-roles → /users-roles
- dashboard → /

Return ONLY valid JSON of shape:
{ "intent": "navigate"|"search_medicine"|"search_patient"|"action"|"unknown",
  "route": "/path" | null,
  "query": "extracted entity text" | null,
  "action": "issue|stock|expiry|alternatives|low_stock|book_appointment|print_bill|refund|new_purchase_order|view_reports|null",
  "reply": "one short sentence describing what you'll do" }

Examples:
"Search Azithromycin" → {"intent":"search_medicine","route":"/pharmacy","query":"Azithromycin","action":null,"reply":"Searching for Azithromycin in Pharmacy"}
"Open OP Sale" → {"intent":"navigate","route":"/pharmacy","query":null,"action":null,"reply":"Opening Pharmacy"}
"Show low stock medicines" → {"intent":"action","route":"/pharmacy","query":null,"action":"low_stock","reply":"Showing low stock medicines"}
"Open patient Teja" → {"intent":"search_patient","route":"/patient-registration","query":"Teja","action":null,"reply":"Searching patient Teja"}
"Paracetamol 650" → {"intent":"search_medicine","route":"/pharmacy","query":"Paracetamol 650","action":null,"reply":"Searching Paracetamol 650"}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { query } = await req.json();
    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: 'query required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return new Response(JSON.stringify({ error: 'AI not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const r = await fetch(GATEWAY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: query },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (r.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (r.status === 402) return new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: 'ai_failed', detail: t.slice(0, 200) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const j = await r.json();
    const content = j.choices?.[0]?.message?.content || '{}';
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { parsed = { intent: 'unknown', reply: 'Sorry, I could not understand.' }; }
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'server_error', detail: String((e as Error)?.message ?? e).slice(0, 200) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});