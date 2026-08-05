import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarIcon, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { clinicService } from "@/modules/clinic/services";

export interface RescheduleTarget {
  id: string;
  patientName: string;
  registrationNumber: string;
  doctorName: string;
  timeSlot: string;
  tokenNo: number;
  status: string;
}

const REASONS = ["Patient Request", "Doctor Delay", "Doctor Leave", "Emergency", "Hospital Request", "Other"];

const parseTime12 = (t: string): number => {
  const [timePart, meridiem] = (t || "").split(" ");
  let [h, m] = (timePart || "0:0").split(":").map(Number);
  if (meridiem === "PM" && h !== 12) h += 12;
  if (meridiem === "AM" && h === 12) h = 0;
  return h * 60 + (m || 0);
};

interface Props {
  target: RescheduleTarget | null;
  onClose: () => void;
  onDone: () => void;
}

export function RescheduleDialog({ target, onClose, onDone }: Props) {
  const [date, setDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<{ id: string; time: string; maxPatients: number; bookedPatients: number; isActive: boolean }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [calOpen, setCalOpen] = useState(false);

  useEffect(() => {
    if (target) {
      setDate(new Date());
      setSelectedSlot("");
      setReason("");
    }
  }, [target?.id]);

  const dateStr = format(date, "yyyy-MM-dd");
  const isToday = dateStr === format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSelectedSlot("");
    clinicService
      .getAvailableSlots(target.doctorName, dateStr)
      .then((rows) => {
        if (!cancelled) setSlots(rows);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [target?.id, dateStr]);

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  const availableSlots = useMemo(() => {
    return slots
      .filter((s) => s.isActive)
      .filter((s) => s.bookedPatients < s.maxPatients)
      .filter((s) => !(isToday && nowMinutes >= parseTime12(s.time) + 30))
      .filter((s) => !(dateStr === format(new Date(), "yyyy-MM-dd") && s.time === target?.timeSlot && false))
      .sort((a, b) => parseTime12(a.time) - parseTime12(b.time));
  }, [slots, isToday, nowMinutes, dateStr, target?.timeSlot]);

  const handleReschedule = async () => {
    if (!target || !selectedSlot) return;
    setSaving(true);
    try {
      const res = await clinicService.rescheduleAppointment({
        appointmentId: target.id,
        newDate: dateStr,
        newTimeSlot: selectedSlot,
        reason,
      });
      // Notification hook — SMS / WhatsApp / Patient App integrations plug in here
      try {
        window.dispatchEvent(
          new CustomEvent("ezyop:appointment-rescheduled", {
            detail: {
              appointmentId: target.id,
              patientName: target.patientName,
              registrationNumber: target.registrationNumber,
              doctorName: target.doctorName,
              oldSlot: target.timeSlot,
              oldToken: target.tokenNo,
              newDate: dateStr,
              newSlot: selectedSlot,
              newToken: (res as any)?.new_token_no,
              reason,
            },
          })
        );
      } catch {
        /* notification dispatch is best-effort */
      }
      toast.success(
        `Rescheduled to ${format(date, "dd/MM/yyyy")} · ${selectedSlot} · Token ${(res as any)?.new_token_no ?? "-"}`
      );
      onDone();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Could not reschedule appointment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule Appointment</DialogTitle>
        </DialogHeader>
        {target && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium text-foreground">{target.patientName}</p>
              <p className="text-xs text-muted-foreground">
                {target.registrationNumber} · {target.doctorName} · Token {target.tokenNo} · {target.timeSlot}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>New Date</Label>
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(date, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                      if (d) setDate(d);
                      setCalOpen(false);
                    }}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label>Available Slots</Label>
              {loadingSlots ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading slots…
                </div>
              ) : availableSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">
                  No appointment slots are available for this doctor on the selected date.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                  {availableSlots.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSlot(s.time)}
                      className={cn(
                        "rounded-md border px-2 py-2 text-xs font-medium transition-colors",
                        selectedSlot === s.time
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-accent"
                      )}
                    >
                      <Clock className="h-3 w-3 inline mr-1" />
                      {s.time}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleReschedule} disabled={!selectedSlot || saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Rescheduling…</> : "Reschedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
