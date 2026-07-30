import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, BellRing } from "lucide-react";
import { useHospitalConfig } from "@/hooks/useHospitalConfig";
import { useHospitalProfile } from "@/modules/diagnostics/useHospitalProfile";
import { buildReminderMessage, followupService } from "@/modules/followup/services";
import { WINDOW_PRESETS, type FollowupDoctorPolicy, type FollowupPolicy } from "@/modules/followup/types";

const DEFAULTS: Partial<FollowupPolicy> = {
  enabled: false,
  window_days: 7,
  max_visits: 1,
  doctor_wise: true,
  department_wise: false,
  reminder_enabled: false,
  reminder_days: [5, 2, 0],
  sms_enabled: false,
  whatsapp_enabled: false,
  push_enabled: false,
  notes: "",
};

export default function HospitalSettings() {
  const { hospitalId } = useHospitalConfig();
  const { data: profile } = useHospitalProfile();
  const [policy, setPolicy] = useState<Partial<FollowupPolicy>>(DEFAULTS);
  const [doctors, setDoctors] = useState<{ name: string; department: string | null }[]>([]);
  const [docPolicies, setDocPolicies] = useState<Record<string, FollowupDoctorPolicy>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [customWindow, setCustomWindow] = useState(false);

  useEffect(() => {
    (async () => {
      if (!hospitalId) return;
      setLoading(true);
      try {
        const [p, dp, staff] = await Promise.all([
          followupService.getPolicy(hospitalId),
          followupService.getDoctorPolicies(hospitalId),
          supabase
            .from("staff_members")
            .select("name,department,specialization")
            .eq("hospital_id", hospitalId)
            .eq("role", "Doctor")
            .order("name"),
        ]);
        if (p) {
          setPolicy(p);
          setCustomWindow(!(WINDOW_PRESETS as readonly number[]).includes(p.window_days));
        }
        setDocPolicies(Object.fromEntries(dp.map((d) => [d.doctor_name.toLowerCase(), d])));
        setDoctors(
          (staff.data || []).map((s: any) => ({ name: s.name, department: s.department || s.specialization || null })),
        );
      } catch (err: any) {
        toast.error(err.message || "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, [hospitalId]);

  const set = <K extends keyof FollowupPolicy>(key: K, value: FollowupPolicy[K]) =>
    setPolicy((p) => ({ ...p, [key]: value }));

  const savePolicy = async () => {
    if (!hospitalId) return;
    setSaving(true);
    try {
      const saved = await followupService.savePolicy(hospitalId, policy);
      setPolicy(saved);
      toast.success("Follow-up policy saved");
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveDoctor = async (name: string, patch: Partial<FollowupDoctorPolicy>) => {
    if (!hospitalId) return;
    const existing = docPolicies[name.toLowerCase()];
    const dept = doctors.find((d) => d.name === name)?.department ?? null;
    try {
      const saved = await followupService.saveDoctorPolicy(hospitalId, {
        doctor_name: name,
        department: dept,
        enabled: existing?.enabled ?? true,
        window_days: existing?.window_days ?? null,
        max_visits: existing?.max_visits ?? null,
        remarks: existing?.remarks ?? null,
        ...patch,
      });
      setDocPolicies((m) => ({ ...m, [name.toLowerCase()]: saved }));
    } catch (err: any) {
      toast.error(err.message || "Could not update doctor policy");
    }
  };

  const runReminders = async () => {
    if (!hospitalId) return;
    setRunning(true);
    try {
      const res = await followupService.runReminderEngine(hospitalId);
      toast.success(`Reminder engine: ${res.scheduled} queued, ${res.sent} sent`, { description: res.reason });
    } catch (err: any) {
      toast.error(err.message || "Reminder run failed");
    } finally {
      setRunning(false);
    }
  };

  const reminderDays = policy.reminder_days ?? [];
  const toggleReminderDay = (d: number) =>
    set(
      "reminder_days",
      (reminderDays.includes(d) ? reminderDays.filter((x) => x !== d) : [...reminderDays, d]).sort((a, b) => b - a),
    );

  if (!hospitalId) return <div className="p-6 text-sm text-muted-foreground">No hospital linked to your account.</div>;
  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-[1200px] mx-auto w-full space-y-4">
      <div>
        <h1 className="text-xl lg:text-2xl font-display font-bold">Hospital Settings</h1>
        <p className="text-sm text-muted-foreground">Follow-up Care Management policy for {profile?.name || "your hospital"}.</p>
      </div>

      <Tabs defaultValue="policy">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="policy">Follow-up Policy</TabsTrigger>
          <TabsTrigger value="doctors">Doctor Settings</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
        </TabsList>

        <TabsContent value="policy" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Free follow-up policy</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm">Enable free follow-up</Label>
                  <p className="text-xs text-muted-foreground">Grants an entitlement automatically when a consultation is completed.</p>
                </div>
                <Switch checked={!!policy.enabled} onCheckedChange={(v) => set("enabled", v)} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-sm">Default follow-up window</Label>
                  <div className="flex gap-2 mt-1">
                    <Select
                      value={customWindow ? "custom" : String(policy.window_days ?? 7)}
                      onValueChange={(v) => {
                        if (v === "custom") setCustomWindow(true);
                        else {
                          setCustomWindow(false);
                          set("window_days", Number(v));
                        }
                      }}
                    >
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WINDOW_PRESETS.map((d) => (
                          <SelectItem key={d} value={String(d)}>{d} Days</SelectItem>
                        ))}
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    {customWindow && (
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        className="w-28"
                        value={policy.window_days ?? 7}
                        onChange={(e) => set("window_days", Math.max(1, Number(e.target.value) || 1))}
                      />
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-sm">Maximum free follow-up visits</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    className="w-28 mt-1"
                    value={policy.max_visits ?? 1}
                    onChange={(e) => set("max_visits", Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label className="text-sm">Doctor-wise follow-up</Label>
                  <Switch checked={!!policy.doctor_wise} onCheckedChange={(v) => set("doctor_wise", v)} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label className="text-sm">Department-wise follow-up</Label>
                  <Switch checked={!!policy.department_wise} onCheckedChange={(v) => set("department_wise", v)} />
                </div>
              </div>

              <div>
                <Label className="text-sm">Policy notes (internal)</Label>
                <Textarea
                  className="mt-1"
                  rows={3}
                  value={policy.notes ?? ""}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="e.g. Free review only for the same complaint, within the same department."
                />
              </div>

              <Button onClick={savePolicy} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save policy
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="doctors" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Follow-up</TableHead>
                    <TableHead>Window (days)</TableHead>
                    <TableHead>Free visits</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doctors.map((d) => {
                    const dp = docPolicies[d.name.toLowerCase()];
                    return (
                      <TableRow key={d.name}>
                        <TableCell>
                          <p className="font-medium text-sm">Dr. {d.name}</p>
                          <p className="text-xs text-muted-foreground">{d.department || "—"}</p>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={dp?.enabled ?? true}
                            onCheckedChange={(v) => saveDoctor(d.name, { enabled: v })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            className="w-24"
                            placeholder={String(policy.window_days ?? 7)}
                            defaultValue={dp?.window_days ?? ""}
                            onBlur={(e) =>
                              saveDoctor(d.name, { window_days: e.target.value ? Number(e.target.value) : null })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            className="w-20"
                            placeholder={String(policy.max_visits ?? 1)}
                            defaultValue={dp?.max_visits ?? ""}
                            onBlur={(e) =>
                              saveDoctor(d.name, { max_visits: e.target.value ? Number(e.target.value) : null })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="min-w-[200px]"
                            defaultValue={dp?.remarks ?? ""}
                            onBlur={(e) => saveDoctor(d.name, { remarks: e.target.value || null })}
                            placeholder="Optional"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {doctors.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                        Add doctors in Staff &amp; Payroll to configure doctor-wise follow-up.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reminders" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Reminder schedule &amp; channels</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm">Enable reminders</Label>
                  <p className="text-xs text-muted-foreground">Reminders are sent only to patients who consented.</p>
                </div>
                <Switch checked={!!policy.reminder_enabled} onCheckedChange={(v) => set("reminder_enabled", v)} />
              </div>

              <div>
                <Label className="text-sm">Reminder schedule</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {[7, 5, 3, 2, 1, 0].map((d) => (
                    <Badge
                      key={d}
                      variant={reminderDays.includes(d) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleReminderDay(d)}
                    >
                      {d === 0 ? "Last day" : `${d} days before expiry`}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {([
                  ["sms_enabled", "SMS"],
                  ["whatsapp_enabled", "WhatsApp"],
                  ["push_enabled", "Push notification"],
                ] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                    <Label className="text-sm">{label}</Label>
                    <Switch checked={!!policy[key]} onCheckedChange={(v) => set(key, v)} />
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button onClick={savePolicy} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save reminder settings
                </Button>
                <Button variant="outline" onClick={runReminders} disabled={running || !policy.reminder_enabled}>
                  {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BellRing className="h-4 w-4 mr-2" />}
                  Run reminder engine now
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Message preview</CardTitle></CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-xs bg-muted/40 rounded-lg p-4 leading-relaxed">
                {buildReminderMessage({
                  patientName: "Mr/Ms Patient Name",
                  hospitalName: profile?.name || "Your Hospital",
                  doctorName: "Doctor Name",
                  expiryDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
                  link: "https://opd.ezyop.in/follow-up",
                })}
              </pre>
              <p className="text-xs text-muted-foreground mt-3">
                Every reminder is branded with your hospital only. EzyOp never uses patient data to promote another hospital.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}