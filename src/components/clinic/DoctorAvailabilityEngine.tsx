import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CalendarDays, Clock, Copy, Plus, Trash2, Save, Zap, Coffee, AlertTriangle,
  Ban, PauseCircle, PlayCircle, RadioTower, Stethoscope, Users, Loader2, CalendarIcon,
  Sparkles, IndianRupee,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  availabilityService, DAY_NAMES, DAY_NAMES_FULL, emptySession,
  LIVE_STATUS_META,
  type WeeklySchedule, type OpSession, type DoctorLeave, type HospitalHoliday,
  type DoctorLiveStatus, type DailyOverride,
} from "@/modules/clinic/availability";

interface Props {
  open: boolean;
  onClose: () => void;
  doctorName: string;
  specialization?: string;
  onSlotsRegenerated?: () => void;
}

// ── Small helpers ──
const TIME_STEPS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${h.toString().padStart(2, "0")}:${m}`;
});

function fmt12(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

// ═══════════════════════════════════════════════════════════════

export default function DoctorAvailabilityEngine({ open, onClose, doctorName, specialization, onSlotsRegenerated }: Props) {
  const [tab, setTab] = useState("weekly");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Per-day weekly state: day_of_week -> { row + sessions }
  const [weeklyByDay, setWeeklyByDay] = useState<Record<number, { id?: string; is_working: boolean; sessions: OpSession[] }>>({});

  const [leaves, setLeaves] = useState<DoctorLeave[]>([]);
  const [holidays, setHolidays] = useState<HospitalHoliday[]>([]);
  const [liveStatus, setLiveStatus] = useState<DoctorLiveStatus | null>(null);
  const [overrides, setOverrides] = useState<DailyOverride[]>([]);

  // Doctor-level default consultation fee — auto-fills new sessions and
  // can be applied to all existing sessions in one click.
  const [defaultFee, setDefaultFee] = useState<number>(0);

  const load = async () => {
    if (!doctorName) return;
    setLoading(true);
    try {
      const [w, l, h, s, o] = await Promise.all([
        availabilityService.getWeekly(doctorName),
        availabilityService.getLeaves(doctorName),
        availabilityService.getHolidays(),
        availabilityService.getLiveStatus(doctorName),
        availabilityService.getOverrides(
          doctorName,
          format(new Date(), "yyyy-MM-dd"),
          format(addDays(new Date(), 30), "yyyy-MM-dd")
        ),
      ]);
      const map: Record<number, { id?: string; is_working: boolean; sessions: OpSession[] }> = {};
      for (let i = 0; i < 7; i++) map[i] = { is_working: false, sessions: [] };
      for (const row of w as any[]) {
        map[row.day_of_week] = {
          id: row.id,
          is_working: row.is_working,
          sessions: (row.sessions || []).sort((a: OpSession, b: OpSession) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        };
      }
      setWeeklyByDay(map);
      // Derive default fee from the most common fee across existing sessions
      const allFees = (w as any[]).flatMap((row) => (row.sessions || []).map((s: any) => Number(s.consultation_fee) || 0));
      if (allFees.length > 0) {
        const counts: Record<number, number> = {};
        allFees.forEach((f) => (counts[f] = (counts[f] || 0) + 1));
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        setDefaultFee(Number(top[0]));
      }
      setLeaves(l);
      setHolidays(h);
      setLiveStatus(s);
      setOverrides(o);
    } catch (err: any) {
      toast.error("Failed to load availability: " + (err.message || "unknown"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doctorName]);

  // ── Regenerate slots for next 7 days after any save ──
  const regenerateNext7 = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const end = format(addDays(new Date(), 6), "yyyy-MM-dd");
    try {
      await availabilityService.generateSlots(doctorName, today, end);
      onSlotsRegenerated?.();
    } catch (err: any) {
      console.warn("slot regen failed", err);
    }
  };

  // ═══════ Weekly editing ═══════
  const setDayWorking = (day: number, working: boolean) => {
    setWeeklyByDay((p) => ({ ...p, [day]: { ...p[day], is_working: working, sessions: working && p[day].sessions.length === 0 ? [emptySession()] : p[day].sessions } }));
  };
  const addSession = (day: number) => {
    setWeeklyByDay((p) => {
      const base = emptySession(
        p[day].sessions.length === 0 ? "Morning OP" : "Evening OP",
        p[day].sessions.length === 0 ? "09:00" : "17:00",
        p[day].sessions.length === 0 ? "13:00" : "20:00",
      );
      // Pre-fill new sessions with the doctor-level default fee
      base.consultation_fee = defaultFee || 0;
      return { ...p, [day]: { ...p[day], sessions: [...p[day].sessions, base] } };
    });
  };

  const applyDefaultFeeToAll = () => {
    setWeeklyByDay((p) => {
      const next: typeof p = {};
      for (const [k, v] of Object.entries(p)) {
        next[Number(k)] = { ...v, sessions: v.sessions.map((s) => ({ ...s, consultation_fee: defaultFee || 0 })) };
      }
      return next;
    });
    toast.success(`Applied ₹${defaultFee || 0} to all sessions`);
  };
  const removeSession = (day: number, idx: number) => {
    setWeeklyByDay((p) => ({ ...p, [day]: { ...p[day], sessions: p[day].sessions.filter((_, i) => i !== idx) } }));
  };
  const updateSession = (day: number, idx: number, patch: Partial<OpSession>) => {
    setWeeklyByDay((p) => ({ ...p, [day]: { ...p[day], sessions: p[day].sessions.map((s, i) => i === idx ? { ...s, ...patch } : s) } }));
  };

  const saveWeekly = async () => {
    setSaving(true);
    try {
      for (let d = 0; d < 7; d++) {
        const dayState = weeklyByDay[d];
        // validate sessions
        for (const s of dayState.sessions) {
          if (s.end_time <= s.start_time) throw new Error(`${DAY_NAMES_FULL[d]}: end time must be after start`);
        }
        const row = await availabilityService.upsertWeeklyDay(doctorName, d, dayState.is_working);
        await availabilityService.replaceSessions(row.id, dayState.is_working ? dayState.sessions : []);
      }
      await regenerateNext7();
      toast.success("Weekly schedule saved & slots regenerated");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Bulk copy
  const copyMondayToWeekdays = () => {
    const mon = weeklyByDay[1];
    setWeeklyByDay((p) => {
      const next = { ...p };
      for (const d of [2, 3, 4, 5]) next[d] = { ...next[d], is_working: mon.is_working, sessions: mon.sessions.map((s) => ({ ...s })) };
      return next;
    });
    toast.success("Copied Monday to Tue–Fri");
  };

  // ═══════ Leaves ═══════
  const [newLeave, setNewLeave] = useState<DoctorLeave>({
    doctor_name: doctorName, from_date: format(new Date(), "yyyy-MM-dd"),
    to_date: format(new Date(), "yyyy-MM-dd"), leave_type: "single", reason: "", status: "Approved",
  });
  useEffect(() => setNewLeave((p) => ({ ...p, doctor_name: doctorName })), [doctorName]);

  const addLeave = async () => {
    try {
      await availabilityService.addLeave(newLeave);
      await regenerateNext7();
      toast.success("Leave recorded — affected days blocked");
      const l = await availabilityService.getLeaves(doctorName);
      setLeaves(l);
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };
  const removeLeave = async (id: string) => {
    try {
      await availabilityService.deleteLeave(id);
      await regenerateNext7();
      setLeaves((p) => p.filter((x) => x.id !== id));
      toast.success("Leave removed");
    } catch (err: any) { toast.error(err.message); }
  };

  // ═══════ Holidays ═══════
  const [newHoliday, setNewHoliday] = useState<HospitalHoliday>({
    holiday_date: format(new Date(), "yyyy-MM-dd"), name: "", is_recurring_yearly: false,
  });
  const addHoliday = async () => {
    if (!newHoliday.name.trim()) return toast.error("Holiday name required");
    try {
      await availabilityService.addHoliday(newHoliday);
      await regenerateNext7();
      toast.success("Holiday added");
      setHolidays(await availabilityService.getHolidays());
      setNewHoliday({ holiday_date: format(new Date(), "yyyy-MM-dd"), name: "", is_recurring_yearly: false });
    } catch (err: any) { toast.error(err.message); }
  };
  const removeHoliday = async (id: string) => {
    try {
      await availabilityService.deleteHoliday(id);
      await regenerateNext7();
      setHolidays((p) => p.filter((x) => x.id !== id));
      toast.success("Holiday removed");
    } catch (err: any) { toast.error(err.message); }
  };

  // ═══════ Live status ═══════
  const applyStatus = async (status: DoctorLiveStatus["status"], delay = 0) => {
    try {
      await availabilityService.setLiveStatus({
        doctor_name: doctorName, status, delay_minutes: delay, message: "",
      });
      setLiveStatus({ doctor_name: doctorName, status, delay_minutes: delay });
      toast.success(`Status: ${LIVE_STATUS_META[status].label}`);
    } catch (err: any) { toast.error(err.message); }
  };

  // ═══════ Daily override ═══════
  const [overrideDate, setOverrideDate] = useState<Date>(new Date());
  const [overrideType, setOverrideType] = useState<DailyOverride["override_type"]>("custom");
  const [overrideSessions, setOverrideSessions] = useState<{ start_time: string; end_time: string; slot_duration_min: number; token_capacity: number }[]>([
    { start_time: "10:00", end_time: "13:00", slot_duration_min: 15, token_capacity: 15 },
  ]);
  const [overrideReason, setOverrideReason] = useState("");

  const saveOverride = async () => {
    try {
      await availabilityService.upsertOverride({
        doctor_name: doctorName,
        override_date: format(overrideDate, "yyyy-MM-dd"),
        override_type: overrideType,
        sessions: overrideType === "closed" ? [] : overrideSessions,
        reason: overrideReason,
      });
      await regenerateNext7();
      toast.success(`Override saved for ${format(overrideDate, "dd/MM/yyyy")}`);
      setOverrides(await availabilityService.getOverrides(doctorName, format(new Date(), "yyyy-MM-dd"), format(addDays(new Date(), 30), "yyyy-MM-dd")));
    } catch (err: any) { toast.error(err.message); }
  };

  const next7Days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(), i)), []);

  // ─────────────────────────────────────── UI ───────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[900px] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle className="font-display text-xl flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Doctor Availability Engine
              </SheetTitle>
              <SheetDescription className="mt-1">
                <span className="font-medium text-foreground">{doctorName}</span>
                {specialization ? <span className="ml-2 text-xs">· {specialization}</span> : null}
              </SheetDescription>
            </div>
            {liveStatus && (
              <Badge variant="outline" className={cn("gap-1.5 px-2.5", LIVE_STATUS_META[liveStatus.status].chip)}>
                <span className={cn("w-2 h-2 rounded-full", LIVE_STATUS_META[liveStatus.status].dot)} />
                {LIVE_STATUS_META[liveStatus.status].label}
                {liveStatus.status === "late" && liveStatus.delay_minutes ? ` +${liveStatus.delay_minutes}m` : ""}
              </Badge>
            )}
          </div>
        </SheetHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-4 shrink-0 border-b border-border">
              <TabsList className="h-auto flex-wrap justify-start bg-transparent p-0 gap-1">
                <TabsTrigger value="weekly">Weekly Schedule</TabsTrigger>
                <TabsTrigger value="calendar">7-Day Calendar</TabsTrigger>
                <TabsTrigger value="live">Live Status</TabsTrigger>
                <TabsTrigger value="override">Daily Override</TabsTrigger>
                <TabsTrigger value="leaves">Leaves</TabsTrigger>
                <TabsTrigger value="holidays">Holidays</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <div className="px-6 py-5">
                {/* ─── WEEKLY ─── */}
                <TabsContent value="weekly" className="mt-0 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Set the recurring template. The system auto-generates the next 7 days of slots on save.</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={copyMondayToWeekdays}>
                        <Copy className="h-4 w-4 mr-1.5" /> Copy Mon → Weekdays
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {DAY_NAMES_FULL.map((dayName, d) => {
                      const state = weeklyByDay[d] || { is_working: false, sessions: [] };
                      return (
                        <div key={d} className={cn("rounded-xl border p-4 transition-colors", state.is_working ? "border-border bg-card" : "border-border/60 bg-muted/30")}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm", state.is_working ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                                {DAY_NAMES[d]}
                              </div>
                              <div>
                                <div className="font-medium text-foreground text-sm">{dayName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {state.is_working ? `${state.sessions.length} session${state.sessions.length === 1 ? "" : "s"}` : "Off"}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {state.is_working && (
                                <Button size="sm" variant="outline" onClick={() => addSession(d)}>
                                  <Plus className="h-3.5 w-3.5 mr-1" /> Session
                                </Button>
                              )}
                              <Switch checked={state.is_working} onCheckedChange={(v) => setDayWorking(d, v)} />
                            </div>
                          </div>

                          {state.is_working && (
                            <div className="space-y-2">
                              {state.sessions.map((s, i) => (
                                <div key={i} className="rounded-lg border border-border bg-background p-3 grid grid-cols-12 gap-2 items-end">
                                  <div className="col-span-12 sm:col-span-3">
                                    <Label className="text-[10px] text-muted-foreground">Session</Label>
                                    <Input className="h-8 text-xs" value={s.session_name} onChange={(e) => updateSession(d, i, { session_name: e.target.value })} />
                                  </div>
                                  <div className="col-span-6 sm:col-span-2">
                                    <Label className="text-[10px] text-muted-foreground">Start</Label>
                                    <Select value={s.start_time} onValueChange={(v) => updateSession(d, i, { start_time: v })}>
                                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                      <SelectContent className="max-h-[240px]">{TIME_STEPS.map((t) => <SelectItem key={t} value={t}>{fmt12(t)}</SelectItem>)}</SelectContent>
                                    </Select>
                                  </div>
                                  <div className="col-span-6 sm:col-span-2">
                                    <Label className="text-[10px] text-muted-foreground">End</Label>
                                    <Select value={s.end_time} onValueChange={(v) => updateSession(d, i, { end_time: v })}>
                                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                      <SelectContent className="max-h-[240px]">{TIME_STEPS.map((t) => <SelectItem key={t} value={t}>{fmt12(t)}</SelectItem>)}</SelectContent>
                                    </Select>
                                  </div>
                                  <div className="col-span-4 sm:col-span-1">
                                    <Label className="text-[10px] text-muted-foreground">Dur</Label>
                                    <Input type="number" min={5} step={5} className="h-8 text-xs" value={s.slot_duration_min} onChange={(e) => updateSession(d, i, { slot_duration_min: parseInt(e.target.value) || 15 })} />
                                  </div>
                                  <div className="col-span-4 sm:col-span-1">
                                    <Label className="text-[10px] text-muted-foreground">Buffer</Label>
                                    <Input type="number" min={0} step={5} className="h-8 text-xs" value={s.buffer_min} onChange={(e) => updateSession(d, i, { buffer_min: parseInt(e.target.value) || 0 })} />
                                  </div>
                                  <div className="col-span-4 sm:col-span-1">
                                    <Label className="text-[10px] text-muted-foreground">Cap</Label>
                                    <Input type="number" min={1} className="h-8 text-xs" value={s.token_capacity} onChange={(e) => updateSession(d, i, { token_capacity: parseInt(e.target.value) || 1 })} />
                                  </div>
                                  <div className="col-span-8 sm:col-span-1">
                                    <Label className="text-[10px] text-muted-foreground">Fee ₹</Label>
                                    <Input type="number" min={0} className="h-8 text-xs" value={s.consultation_fee} onChange={(e) => updateSession(d, i, { consultation_fee: parseFloat(e.target.value) || 0 })} />
                                  </div>
                                  <div className="col-span-4 sm:col-span-1 flex items-center justify-end">
                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeSession(d, i)}>
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </div>
                                  <div className="col-span-12 flex flex-wrap items-center gap-4 pt-1 border-t border-border/60">
                                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Switch checked={s.online_enabled} onCheckedChange={(v) => updateSession(d, i, { online_enabled: v })} /> Online booking
                                    </label>
                                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Switch checked={s.walkin_enabled} onCheckedChange={(v) => updateSession(d, i, { walkin_enabled: v })} /> Walk-in
                                    </label>
                                    <span className="text-xs text-muted-foreground ml-auto">Booking window: <Input type="number" min={1} max={90} className="inline-block w-14 h-6 text-xs ml-1" value={s.booking_window_days} onChange={(e) => updateSession(d, i, { booking_window_days: parseInt(e.target.value) || 7 })} /> days</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="sticky bottom-0 -mx-6 px-6 py-3 bg-background/95 backdrop-blur border-t border-border">
                    <Button onClick={saveWeekly} disabled={saving} className="w-full">
                      {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Saving…</> : <><Save className="h-4 w-4 mr-1.5" /> Save Weekly & Regenerate 7-Day Slots</>}
                    </Button>
                  </div>
                </TabsContent>

                {/* ─── 7-DAY CALENDAR ─── */}
                <TabsContent value="calendar" className="mt-0 space-y-3">
                  <p className="text-sm text-muted-foreground">Preview of next 7 days computed from the weekly template, minus leaves, holidays and overrides.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {next7Days.map((d) => {
                      const dow = d.getDay();
                      const dayState = weeklyByDay[dow];
                      const dateStr = format(d, "yyyy-MM-dd");
                      const onLeave = leaves.some((l) => l.status !== "Rejected" && dateStr >= l.from_date && dateStr <= l.to_date);
                      const isHoliday = holidays.some((h) => h.holiday_date === dateStr || (h.is_recurring_yearly && h.holiday_date.slice(5) === dateStr.slice(5)));
                      const ov = overrides.find((o) => o.override_date === dateStr);
                      const closed = onLeave || isHoliday || (ov && ov.override_type === "closed") || !dayState?.is_working;
                      const sessions = ov && ov.override_type !== "closed" ? ov.sessions : dayState?.sessions || [];
                      return (
                        <div key={dateStr} className={cn("rounded-xl border p-4", closed ? "border-border/60 bg-muted/40" : "border-border bg-card")}>
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="text-xs uppercase text-muted-foreground tracking-wide">{format(d, "EEE")}</div>
                              <div className="font-semibold text-foreground text-lg">{format(d, "dd/MM/yyyy")}</div>
                            </div>
                            {onLeave && <Badge variant="outline" className="text-xs">On Leave</Badge>}
                            {isHoliday && <Badge variant="outline" className="text-xs">Holiday</Badge>}
                            {ov && !onLeave && !isHoliday && <Badge variant="outline" className="text-xs">Override</Badge>}
                            {closed && !onLeave && !isHoliday && !ov && <Badge variant="outline" className="text-xs">Closed</Badge>}
                          </div>
                          {!closed && sessions.length > 0 ? (
                            <div className="space-y-1.5">
                              {sessions.map((s: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-sm">
                                  <Clock className="h-3.5 w-3.5 text-primary" />
                                  <span className="text-foreground">{fmt12(s.start_time)} – {fmt12(s.end_time)}</span>
                                  <span className="text-xs text-muted-foreground ml-auto">{s.token_capacity ?? "—"} tokens · {s.slot_duration_min}m</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">No sessions</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

                {/* ─── LIVE STATUS ─── */}
                <TabsContent value="live" className="mt-0 space-y-4">
                  <p className="text-sm text-muted-foreground">One-click status updates. Synced live to the reception dashboard, patient app and partner app.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(Object.keys(LIVE_STATUS_META) as DoctorLiveStatus["status"][]).map((k) => {
                      const meta = LIVE_STATUS_META[k];
                      const active = liveStatus?.status === k;
                      return (
                        <button
                          key={k}
                          onClick={() => applyStatus(k)}
                          className={cn(
                            "rounded-xl border p-4 flex items-center gap-3 text-left transition-all hover:border-primary/50",
                            active ? meta.chip + " ring-2 ring-primary/30" : "bg-card border-border"
                          )}
                        >
                          <span className={cn("w-3 h-3 rounded-full", meta.dot)} />
                          <span className="font-medium text-sm">{meta.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                    <Label className="text-xs">Running late by (minutes)</Label>
                    <div className="flex gap-2 flex-wrap">
                      {[10, 15, 30, 45, 60].map((m) => (
                        <Button key={m} size="sm" variant="outline" onClick={() => applyStatus("late", m)}>+{m} min</Button>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* ─── DAILY OVERRIDE ─── */}
                <TabsContent value="override" className="mt-0 space-y-4">
                  <p className="text-sm text-muted-foreground">Change only a single day without touching the weekly template. Use for OT, emergency, delayed start, conference.</p>
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left h-9">
                              <CalendarIcon className="h-4 w-4 mr-1.5" /> {format(overrideDate, "dd/MM/yyyy")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent mode="single" selected={overrideDate} onSelect={(d) => d && setOverrideDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <Label className="text-xs">Type</Label>
                        <Select value={overrideType} onValueChange={(v) => setOverrideType(v as any)}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom">Custom timings</SelectItem>
                            <SelectItem value="half-day">Half day</SelectItem>
                            <SelectItem value="closed">Closed for the day</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Reason</Label>
                        <Input className="h-9" placeholder="OT, Emergency, Conference…" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
                      </div>
                    </div>

                    {overrideType !== "closed" && (
                      <div className="space-y-2">
                        {overrideSessions.map((s, i) => (
                          <div key={i} className="grid grid-cols-12 gap-2 items-end rounded-lg border border-border p-3 bg-background">
                            <div className="col-span-3">
                              <Label className="text-[10px] text-muted-foreground">Start</Label>
                              <Select value={s.start_time} onValueChange={(v) => setOverrideSessions((p) => p.map((x, j) => j === i ? { ...x, start_time: v } : x))}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent className="max-h-[240px]">{TIME_STEPS.map((t) => <SelectItem key={t} value={t}>{fmt12(t)}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-3">
                              <Label className="text-[10px] text-muted-foreground">End</Label>
                              <Select value={s.end_time} onValueChange={(v) => setOverrideSessions((p) => p.map((x, j) => j === i ? { ...x, end_time: v } : x))}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent className="max-h-[240px]">{TIME_STEPS.map((t) => <SelectItem key={t} value={t}>{fmt12(t)}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-2">
                              <Label className="text-[10px] text-muted-foreground">Slot</Label>
                              <Input type="number" min={5} step={5} className="h-8 text-xs" value={s.slot_duration_min} onChange={(e) => setOverrideSessions((p) => p.map((x, j) => j === i ? { ...x, slot_duration_min: parseInt(e.target.value) || 15 } : x))} />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-[10px] text-muted-foreground">Cap</Label>
                              <Input type="number" min={1} className="h-8 text-xs" value={s.token_capacity} onChange={(e) => setOverrideSessions((p) => p.map((x, j) => j === i ? { ...x, token_capacity: parseInt(e.target.value) || 1 } : x))} />
                            </div>
                            <div className="col-span-2 flex justify-end">
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOverrideSessions((p) => p.filter((_, j) => j !== i))}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={() => setOverrideSessions((p) => [...p, { start_time: "17:00", end_time: "19:00", slot_duration_min: 15, token_capacity: 10 }])}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add session
                        </Button>
                      </div>
                    )}

                    <Button className="w-full" onClick={saveOverride}>
                      <Save className="h-4 w-4 mr-1.5" /> Save Override
                    </Button>
                  </div>

                  {overrides.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Upcoming overrides</p>
                      {overrides.map((o) => (
                        <div key={o.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                          <div className="text-sm">
                            <div className="font-medium text-foreground">{format(parseISO(o.override_date), "dd/MM/yyyy")} — {o.override_type}</div>
                            <div className="text-xs text-muted-foreground">{o.reason || "—"}</div>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => availabilityService.deleteOverride(o.id!).then(regenerateNext7).then(() => setOverrides((p) => p.filter((x) => x.id !== o.id)))}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ─── LEAVES ─── */}
                <TabsContent value="leaves" className="mt-0 space-y-4">
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <p className="text-sm font-semibold text-foreground">Add leave</p>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <Label className="text-xs">From</Label>
                        <Input type="date" className="h-9" value={newLeave.from_date} onChange={(e) => setNewLeave({ ...newLeave, from_date: e.target.value, to_date: e.target.value > newLeave.to_date ? e.target.value : newLeave.to_date })} />
                      </div>
                      <div>
                        <Label className="text-xs">To</Label>
                        <Input type="date" className="h-9" value={newLeave.to_date} onChange={(e) => setNewLeave({ ...newLeave, to_date: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Type</Label>
                        <Select value={newLeave.leave_type} onValueChange={(v: any) => setNewLeave({ ...newLeave, leave_type: v })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single">Single day</SelectItem>
                            <SelectItem value="half">Half day</SelectItem>
                            <SelectItem value="vacation">Vacation</SelectItem>
                            <SelectItem value="conference">Conference</SelectItem>
                            <SelectItem value="emergency">Emergency</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Reason</Label>
                        <Input className="h-9" value={newLeave.reason} onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })} />
                      </div>
                    </div>
                    <Button onClick={addLeave} className="w-full"><Plus className="h-4 w-4 mr-1.5" /> Record Leave</Button>
                  </div>

                  <div className="space-y-2">
                    {leaves.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No leaves recorded</p>}
                    {leaves.map((l) => (
                      <div key={l.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                        <div>
                          <div className="font-medium text-foreground text-sm">
                            {format(parseISO(l.from_date), "dd/MM/yyyy")}
                            {l.from_date !== l.to_date ? ` – ${format(parseISO(l.to_date), "dd/MM/yyyy")}` : ""}
                          </div>
                          <div className="text-xs text-muted-foreground">{l.leave_type} · {l.reason || "—"}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{l.status}</Badge>
                          <Button size="icon" variant="ghost" onClick={() => removeLeave(l.id!)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* ─── HOLIDAYS ─── */}
                <TabsContent value="holidays" className="mt-0 space-y-4">
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <p className="text-sm font-semibold text-foreground">Add hospital holiday</p>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <Label className="text-xs">Date</Label>
                        <Input type="date" className="h-9" value={newHoliday.holiday_date} onChange={(e) => setNewHoliday({ ...newHoliday, holiday_date: e.target.value })} />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Name</Label>
                        <Input className="h-9" placeholder="Diwali, Republic Day…" value={newHoliday.name} onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })} />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground pb-2">
                          <Switch checked={newHoliday.is_recurring_yearly} onCheckedChange={(v) => setNewHoliday({ ...newHoliday, is_recurring_yearly: v })} />
                          Recurring yearly
                        </label>
                      </div>
                    </div>
                    <Button onClick={addHoliday} className="w-full"><Plus className="h-4 w-4 mr-1.5" /> Add Holiday</Button>
                  </div>

                  <div className="space-y-2">
                    {holidays.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No holidays configured</p>}
                    {holidays.map((h) => (
                      <div key={h.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                        <div>
                          <div className="font-medium text-foreground text-sm">{format(parseISO(h.holiday_date), "dd/MM/yyyy")} — {h.name}</div>
                          {h.is_recurring_yearly && <div className="text-xs text-muted-foreground">Repeats yearly</div>}
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => removeHoliday(h.id!)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}