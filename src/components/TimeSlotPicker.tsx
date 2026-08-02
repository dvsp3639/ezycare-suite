import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { TimeSlot } from "@/data/mockClinicData";

interface TimeSlotPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (time: string) => void;
  selectedTime: string;
  slots: TimeSlot[];
  doctorName: string;
  selectedDate: string; // yyyy-mm-dd
}

const parseTime12 = (t: string): number => {
  const [timePart, meridiem] = t.split(" ");
  let [h, m] = timePart.split(":").map(Number);
  if (meridiem === "PM" && h !== 12) h += 12;
  if (meridiem === "AM" && h === 12) h = 0;
  return h * 60 + m;
};

const isToday = (dateStr: string) => {
  const today = new Date();
  const [y, m, d] = dateStr.split("-").map(Number);
  return today.getFullYear() === y && today.getMonth() + 1 === m && today.getDate() === d;
};

const SLOT_LENGTH_MIN = 30;

const TimeSlotPicker = ({ open, onOpenChange, onSelect, selectedTime, slots, doctorName, selectedDate }: TimeSlotPickerProps) => {
  const [currentMinutes, setCurrentMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date();
      setCurrentMinutes(n.getHours() * 60 + n.getMinutes());
    }, 30000);
    return () => clearInterval(id);
  }, []);
  const checkToday = isToday(selectedDate);

  const activeSlots = [...slots]
    .filter((s) => s.isActive)
    .sort((a, b) => parseTime12(a.time) - parseTime12(b.time));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Select Time Slot</DialogTitle>
          <p className="text-sm text-muted-foreground">{doctorName}</p>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 max-h-[400px] overflow-y-auto p-1">
          {activeSlots.map((slot) => {
            const max = Math.max(1, slot.maxPatients);
            const left = Math.max(0, max - slot.bookedPatients);
            const full = left === 0;
            // Only freeze once the slot's own 30-minute window has fully elapsed
            const isPast = checkToday && currentMinutes >= parseTime12(slot.time) + SLOT_LENGTH_MIN;
            const disabled = full || isPast;
            const selected = slot.time === selectedTime;
            const pct = (slot.bookedPatients / max) * 100;
            const tone = full
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : pct >= 80
              ? "border-orange-500/40 bg-orange-500/5 text-foreground hover:border-orange-500"
              : pct >= 50
              ? "border-warning/40 bg-warning/5 text-foreground hover:border-warning"
              : "border-success/40 bg-success/5 text-foreground hover:border-success";

            return (
              <button
                key={slot.time}
                disabled={disabled}
                onClick={() => {
                  onSelect(slot.time);
                  onOpenChange(false);
                }}
                className={cn(
                  "p-3 rounded-lg text-sm font-medium transition-all border flex flex-col items-center gap-0.5",
                  selected
                    ? "bg-primary text-primary-foreground border-primary"
                    : isPast
                    ? "bg-muted text-muted-foreground/40 border-transparent cursor-not-allowed line-through"
                    : full
                    ? "bg-destructive/10 text-destructive/70 border-destructive/30 cursor-not-allowed"
                    : cn(tone, "cursor-pointer")
                )}
              >
                <span>{slot.time}</span>
                <span className={cn("text-[10px]", isPast && !selected ? "text-muted-foreground/30" : selected ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {isPast ? "Closed" : full ? "Full" : `${left} left`}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-success/30 border border-success/50" />
            Available
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-warning/40 border border-warning/60" />
            Filling
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-destructive/40 border border-destructive/60" />
            Full
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-primary" />
            Selected
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-muted" />
            Closed
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TimeSlotPicker;
