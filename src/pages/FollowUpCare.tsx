import { useEffect, useMemo, useState } from "react";
import { istDateStr } from "@/lib/datetime";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, HeartPulse, CalendarDays, BellRing, ShieldCheck, RefreshCw } from "lucide-react";
import { useHospitalConfig } from "@/hooks/useHospitalConfig";
import { useHospitalProfile } from "@/modules/diagnostics/useHospitalProfile";
import { followupService } from "@/modules/followup/services";
import { daysLeft, formatIndian, type FollowupAuditEntry, type FollowupEntitlement, type FollowupReminder, type FollowupVisit } from "@/modules/followup/types";
import { EligibilityCard } from "@/components/followup/EligibilityCard";

const today = () => istDateStr();

export default function FollowUpCare() {
  const { hospitalId } = useHospitalConfig();
  const { data: profile } = useHospitalProfile();
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<FollowupEntitlement[] | null>(null);
  const [entitlements, setEntitlements] = useState<FollowupEntitlement[]>([]);
  const [visits, setVisits] = useState<FollowupVisit[]>([]);
  const [reminders, setReminders] = useState<FollowupReminder[]>([]);
  const [audit, setAudit] = useState<FollowupAuditEntry[]>([]);

  const load = async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const [e, v, r, a] = await Promise.all([
        followupService.listEntitlements(hospitalId),
        followupService.listVisits(hospitalId),
        followupService.listReminders(hospitalId),
        followupService.listAudit(hospitalId),
      ]);
      setEntitlements(e);
      setVisits(v);
      setReminders(r);
      setAudit(a);
    } catch (err: any) {
      toast.error(err.message || "Failed to load follow-up data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitalId]);

  const runSearch = async () => {
    if (!hospitalId || term.trim().length < 3) {
      toast.error("Enter mobile number, UHID or OP number");
      return;
    }
    setSearching(true);
    try {
      setResults(await followupService.lookup(hospitalId, term));
    } catch (err: any) {
      toast.error(err.message || "Lookup failed");
    } finally {
      setSearching(false);
    }
  };

  const book = async (ent: FollowupEntitlement, date: string) => {
    try {
      const res = await followupService.bookVisit(ent.id, date);
      toast.success(`Free follow-up booked · Token ${res.token_no} · Dr. ${res.doctor_name}`);
      setResults(null);
      setTerm("");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Booking failed");
    }
  };

  const t = today();
  const eligible = entitlements.filter((e) => e.status === "active" && daysLeft(e.expiry_date) >= 0);
  const expired = entitlements.filter((e) => e.status === "expired" || (e.status === "active" && daysLeft(e.expiry_date) < 0));
  const todays = visits.filter((v) => v.visit_date === t);
  const completed = visits.filter((v) => v.status === "Completed");
  const missed = visits.filter((v) => v.status !== "Completed" && v.visit_date < t);

  const analytics = useMemo(() => {
    const byDoctor = new Map<string, { granted: number; booked: number }>();
    entitlements.forEach((e) => {
      const row = byDoctor.get(e.doctor_name) || { granted: 0, booked: 0 };
      row.granted++;
      byDoctor.set(e.doctor_name, row);
    });
    visits.forEach((v) => {
      const row = byDoctor.get(v.doctor_name) || { granted: 0, booked: 0 };
      row.booked++;
      byDoctor.set(v.doctor_name, row);
    });
    const byDept = new Map<string, { granted: number; booked: number }>();
    entitlements.forEach((e) => {
      const key = e.department || "Unassigned";
      const row = byDept.get(key) || { granted: 0, booked: 0 };
      row.granted++;
      if (e.used_visits > 0) row.booked++;
      byDept.set(key, row);
    });
    const delivered = reminders.filter((r) => r.status === "delivered" || r.status === "sent").length;
    return {
      doctors: [...byDoctor.entries()],
      departments: [...byDept.entries()],
      reminderTotal: reminders.length,
      reminderDelivered: delivered,
      reminderRate: reminders.length ? Math.round((delivered / reminders.length) * 100) : 0,
    };
  }, [entitlements, visits, reminders]);

  const kpis = [
    { label: "Eligible now", value: eligible.length, icon: HeartPulse },
    { label: "Today's follow-ups", value: todays.length, icon: CalendarDays },
    { label: "Completed", value: completed.length, icon: ShieldCheck },
    { label: "Expired", value: expired.length, icon: RefreshCw },
    { label: "Missed", value: missed.length, icon: BellRing },
  ];

  if (!hospitalId) {
    return <div className="p-6 text-sm text-muted-foreground">No hospital is linked to your account.</div>;
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] mx-auto w-full space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl lg:text-2xl font-display font-bold">Follow-up Care Management</h1>
          <p className="text-sm text-muted-foreground">
            Free follow-up eligibility, booking and reminders — governed entirely by {profile?.name || "your hospital"}'s policy.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <k.icon className="h-3.5 w-3.5" /> {k.label}
              </div>
              <p className="text-2xl font-bold mt-1">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">One-click reception lookup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Mobile number, UHID, OP number or scanned QR value"
              className="max-w-xl"
            />
            <Button onClick={runSearch} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Check eligibility</span>
            </Button>
          </div>
          {results && results.length === 0 && (
            <p className="text-sm text-muted-foreground">No follow-up entitlement found for this patient.</p>
          )}
          <div className="grid gap-3">
            {results?.map((e) => (
              <EligibilityCard
                key={e.id}
                entitlement={e}
                hospitalName={profile?.name}
                onBook={(date) => book(e, date)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="queue">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="queue">Follow-up Queue</TabsTrigger>
          <TabsTrigger value="visits">Visits</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4 space-y-3">
          {eligible.length === 0 && <p className="text-sm text-muted-foreground">No patients are currently eligible.</p>}
          {eligible.map((e) => (
            <EligibilityCard key={e.id} entitlement={e} hospitalName={profile?.name} onBook={(d) => book(e, d)} />
          ))}
          {expired.length > 0 && (
            <>
              <p className="text-xs uppercase tracking-wide text-muted-foreground pt-2">Expired follow-ups</p>
              {expired.slice(0, 20).map((e) => (
                <EligibilityCard key={e.id} entitlement={e} hospitalName={profile?.name} compact />
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="visits" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visits.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>{formatIndian(v.visit_date)}</TableCell>
                      <TableCell>#{v.token_no ?? "—"}</TableCell>
                      <TableCell>Dr. {v.doctor_name}</TableCell>
                      <TableCell className="capitalize">{v.channel}</TableCell>
                      <TableCell>
                        <Badge variant={v.status === "Completed" ? "secondary" : v.visit_date < t ? "destructive" : "outline"}>
                          {v.status === "Completed" ? "Completed" : v.visit_date < t ? "Missed" : v.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {v.status !== "Completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await followupService.setVisitStatus(hospitalId, v.id, "Completed");
                              toast.success("Follow-up marked complete");
                              load();
                            }}
                          >
                            Mark complete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {visits.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                        No follow-up visits yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reminders" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Offset</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reminders.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{formatIndian(r.scheduled_for)}</TableCell>
                      <TableCell className="uppercase text-xs">{r.channel}</TableCell>
                      <TableCell>{r.offset_days === 0 ? "Last day" : `${r.offset_days} days before`}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "delivered" ? "secondary" : "outline"}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-sm truncate">{r.error_message || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {reminders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                        No reminders scheduled yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Doctor-wise follow-up rate</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {analytics.doctors.map(([name, r]) => (
                <div key={name} className="flex items-center justify-between text-sm">
                  <span className="truncate">Dr. {name}</span>
                  <span className="text-muted-foreground">
                    {r.booked}/{r.granted} · {r.granted ? Math.round((r.booked / r.granted) * 100) : 0}%
                  </span>
                </div>
              ))}
              {analytics.doctors.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Department-wise follow-up rate</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {analytics.departments.map(([name, r]) => (
                <div key={name} className="flex items-center justify-between text-sm">
                  <span className="truncate">{name}</span>
                  <span className="text-muted-foreground">
                    {r.booked}/{r.granted} · {r.granted ? Math.round((r.booked / r.granted) * 100) : 0}%
                  </span>
                </div>
              ))}
              {analytics.departments.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Reminder delivery</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>Total reminders: <strong>{analytics.reminderTotal}</strong></p>
              <p>Delivered / sent: <strong>{analytics.reminderDelivered}</strong></p>
              <p>Success rate: <strong>{analytics.reminderRate}%</strong></p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Follow-up totals</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>Entitlements granted: <strong>{entitlements.length}</strong></p>
              <p>Follow-ups booked: <strong>{visits.length}</strong></p>
              <p>Completed: <strong>{completed.length}</strong></p>
              <p>Expired unused: <strong>{expired.length}</strong></p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatIndian(a.created_at)} {new Date(a.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell>{a.actor_name || "System"}</TableCell>
                      <TableCell className="capitalize">{a.action.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.entity_type || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {audit.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                        No activity recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}