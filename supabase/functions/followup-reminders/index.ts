import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function buildMessage(p: {
  patientName: string;
  hospitalName: string;
  doctorName: string;
  expiryDate: string;
  link: string;
}) {
  const [y, m, d] = p.expiryDate.slice(0, 10).split("-");
  return `Dear ${p.patientName},\n\nGreetings from ${p.hospitalName}.\n\nDr. ${p.doctorName} hopes you are recovering well.\n\nAccording to our hospital's follow-up policy, your free follow-up consultation is available until ${d}/${m}/${y}.\n\nIf you are still experiencing symptoms or your doctor advised a review, you may book your follow-up appointment using the link below.\n\nBook Now\n${p.link}\n\nThank you.\n${p.hospitalName}\nPowered by EzyOp`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const hospitalFilter: string | undefined = body?.hospital_id;

    await admin.rpc("expire_followup_entitlements");

    let pq = admin
      .from("followup_policies")
      .select("*")
      .eq("enabled", true)
      .eq("reminder_enabled", true);
    if (hospitalFilter) pq = pq.eq("hospital_id", hospitalFilter);
    const { data: policies, error: pErr } = await pq;
    if (pErr) throw pErr;

    let scheduled = 0;
    let sent = 0;
    let skipped = 0;
    const today = new Date().toISOString().slice(0, 10);

    for (const pol of policies ?? []) {
      const { data: hospital } = await admin
        .from("hospitals")
        .select("id,name,followup_enabled")
        .eq("id", pol.hospital_id)
        .maybeSingle();
      if (!hospital?.followup_enabled) {
        skipped++;
        continue;
      }

      const channels = [
        pol.sms_enabled ? "sms" : null,
        pol.whatsapp_enabled ? "whatsapp" : null,
        pol.push_enabled ? "push" : null,
      ].filter(Boolean) as string[];
      if (channels.length === 0) {
        skipped++;
        continue;
      }

      const { data: ents } = await admin
        .from("followup_entitlements")
        .select("*")
        .eq("hospital_id", pol.hospital_id)
        .eq("status", "active")
        .eq("consent", true)
        .gte("expiry_date", today);

      for (const e of ents ?? []) {
        for (const offset of (pol.reminder_days ?? []) as number[]) {
          const due = new Date(`${e.expiry_date}T00:00:00Z`);
          due.setUTCDate(due.getUTCDate() - offset);
          const dueDate = due.toISOString().slice(0, 10);
          if (dueDate > today) continue;

          for (const channel of channels) {
            const message = buildMessage({
              patientName: e.patient_name,
              hospitalName: hospital.name,
              doctorName: e.doctor_name,
              expiryDate: e.expiry_date,
              link: `${body?.booking_base_url ?? "https://opd.ezyop.in"}/follow-up?ref=${e.id}`,
            });

            const { data: existing } = await admin
              .from("followup_reminders")
              .select("id,status")
              .eq("entitlement_id", e.id)
              .eq("channel", channel)
              .eq("offset_days", offset)
              .maybeSingle();
            if (existing) continue;

            const { data: row } = await admin
              .from("followup_reminders")
              .insert({
                hospital_id: pol.hospital_id,
                entitlement_id: e.id,
                channel,
                scheduled_for: dueDate,
                offset_days: offset,
                status: "queued",
                message,
                error_message: "No messaging provider connected — reminder queued for delivery",
              })
              .select("id")
              .single();
            scheduled++;

            if (row) {
              await admin.from("followup_audit_log").insert({
                hospital_id: pol.hospital_id,
                action: "reminder_queued",
                entity_type: "reminder",
                entity_id: row.id,
                details: { channel, offset_days: offset, entitlement_id: e.id },
              });
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        scheduled,
        sent,
        skipped,
        reason:
          sent === 0 && scheduled > 0
            ? "Reminders queued. Connect an SMS/WhatsApp provider to deliver them."
            : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("followup-reminders failed:", err);
    return new Response(JSON.stringify({ error: String((err as Error)?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});