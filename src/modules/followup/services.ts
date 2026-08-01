import { supabase } from "@/integrations/supabase/client";
import type {
  FollowupAuditEntry,
  FollowupDoctorPolicy,
  FollowupEntitlement,
  FollowupPolicy,
  FollowupReminder,
  FollowupVisit,
} from "./types";

const db = supabase as any;

export const followupService = {
  async getPolicy(hospitalId: string): Promise<FollowupPolicy | null> {
    const { data, error } = await db
      .from("followup_policies")
      .select("*")
      .eq("hospital_id", hospitalId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async savePolicy(hospitalId: string, patch: Partial<FollowupPolicy>): Promise<FollowupPolicy> {
    const { data: userRes } = await supabase.auth.getUser();
    const { data, error } = await db
      .from("followup_policies")
      .upsert(
        { hospital_id: hospitalId, ...patch, updated_by: userRes?.user?.id ?? null },
        { onConflict: "hospital_id" },
      )
      .select()
      .single();
    if (error) throw error;
    await followupService.audit(hospitalId, "policy_updated", "policy", data.id, patch as any);
    return data;
  },

  async getDoctorPolicies(hospitalId: string): Promise<FollowupDoctorPolicy[]> {
    const { data, error } = await db
      .from("followup_doctor_policies")
      .select("*")
      .eq("hospital_id", hospitalId)
      .order("doctor_name");
    if (error) throw error;
    return data || [];
  },

  async saveDoctorPolicy(hospitalId: string, row: Partial<FollowupDoctorPolicy>) {
    const { data, error } = await db
      .from("followup_doctor_policies")
      .upsert({ hospital_id: hospitalId, ...row }, { onConflict: "hospital_id,doctor_name" })
      .select()
      .single();
    if (error) throw error;
    await followupService.audit(hospitalId, "doctor_policy_updated", "doctor_policy", data.id, row as any);
    return data as FollowupDoctorPolicy;
  },

  async listEntitlements(
    hospitalId: string,
    opts: { status?: string; search?: string } = {},
  ): Promise<FollowupEntitlement[]> {
    let q = db
      .from("followup_entitlements")
      .select("*")
      .eq("hospital_id", hospitalId)
      .order("expiry_date", { ascending: true })
      .limit(500);
    if (opts.status) q = q.eq("status", opts.status);
    if (opts.search) {
      const s = opts.search.replace(/[%,]/g, "");
      q = q.or(
        `mobile.ilike.%${s}%,registration_number.ilike.%${s}%,patient_name.ilike.%${s}%`,
      );
    }
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  /** Reception eligibility lookup by mobile / UHID / OP number / QR payload. */
  async lookup(hospitalId: string, term: string): Promise<FollowupEntitlement[]> {
    const clean = term.trim().replace(/^.*[?&](uhid|reg)=/i, "");
    if (!clean) return [];
    await db.rpc("expire_followup_entitlements");
    return followupService.listEntitlements(hospitalId, { search: clean });
  },

  async listVisits(hospitalId: string, date?: string): Promise<FollowupVisit[]> {
    let q = db
      .from("followup_visits")
      .select("*")
      .eq("hospital_id", hospitalId)
      .order("visit_date", { ascending: false })
      .limit(500);
    if (date) q = q.eq("visit_date", date);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async bookVisit(entitlementId: string, date: string, timeSlot?: string, channel = "reception") {
    const { data, error } = await db.rpc("book_followup_visit", {
      _entitlement_id: entitlementId,
      _appointment_date: date,
      _time_slot: timeSlot || null,
      _channel: channel,
    });
    if (error) throw error;
    return data as { appointment_id: string; token_no: number; visit_date: string; doctor_name: string };
  },

  async setVisitStatus(hospitalId: string, visitId: string, status: string) {
    const { error } = await db.from("followup_visits").update({ status }).eq("id", visitId);
    if (error) throw error;
    await followupService.audit(hospitalId, `followup_${status.toLowerCase()}`, "visit", visitId, { status });
  },

  async listReminders(hospitalId: string): Promise<FollowupReminder[]> {
    const { data, error } = await db
      .from("followup_reminders")
      .select("*")
      .eq("hospital_id", hospitalId)
      .order("scheduled_for", { ascending: false })
      .limit(500);
    if (error) throw error;
    return data || [];
  },

  async runReminderEngine(hospitalId: string) {
    const { data, error } = await supabase.functions.invoke("followup-reminders", {
      body: { hospital_id: hospitalId },
    });
    if (error) throw error;
    return data as { scheduled: number; sent: number; skipped: number; reason?: string };
  },

  async listAudit(hospitalId: string): Promise<FollowupAuditEntry[]> {
    const { data, error } = await db
      .from("followup_audit_log")
      .select("*")
      .eq("hospital_id", hospitalId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data || [];
  },

  async audit(
    hospitalId: string,
    action: string,
    entityType?: string,
    entityId?: string | null,
    details: Record<string, unknown> = {},
  ) {
    const { data: userRes } = await supabase.auth.getUser();
    await db.from("followup_audit_log").insert({
      hospital_id: hospitalId,
      actor_id: userRes?.user?.id ?? null,
      actor_name: userRes?.user?.user_metadata?.full_name || userRes?.user?.email || null,
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      details,
    });
  },

  async setConsent(patientId: string, consent: boolean) {
    const { error } = await db.from("patients").update({ reminder_consent: consent }).eq("id", patientId);
    if (error) throw error;
    await db.from("followup_entitlements").update({ consent }).eq("patient_id", patientId).eq("status", "active");
  },
};

/** Reminder body preview — always branded with the treating hospital. */
export function buildReminderMessage(opts: {
  patientName: string;
  hospitalName: string;
  doctorName: string;
  expiryDate: string;
  link: string;
}) {
  const [y, m, d] = opts.expiryDate.slice(0, 10).split("-");
  return `Dear ${opts.patientName},

Greetings from ${opts.hospitalName}.

Dr. ${opts.doctorName} hopes you are recovering well.

According to our hospital's follow-up policy, your free follow-up consultation is available until ${d}/${m}/${y}.

If you are still experiencing symptoms or your doctor advised a review, you may book your follow-up appointment using the link below.

Book Now
${opts.link}

Thank you.
${opts.hospitalName}
Powered by EzyOp`;
}