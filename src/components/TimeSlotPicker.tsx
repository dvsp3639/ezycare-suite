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

const TimeSlotPicker = ({ open, onOpenChange, onSelect, selectedTime, slots, doctorName, selectedDate }: TimeSlotPickerProps) => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const checkToday = isToday(selectedDate);

  const activeSlots = slots.filter((s) => s.isActive);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Select Time Slot</DialogTitle>
          <p className="text-sm text-muted-foreground">{doctorName}</p>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 max-h-[400px] overflow-y-auto p-1">
          {activeSlots.map((slot) => {
            const full = slot.bookedPatients >= slot.maxPatients;
            const isPast = checkToday && parseTime12(slot.time) <= currentMinutes;
            const disabled = full || isPast;
            const selected = slot.time === selectedTime;

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
                    : disabled
                    ? "bg-muted text-muted-foreground/40 border-transparent cursor-not-allowed line-through"
                    : "border-border bg-card text-foreground hover:border-primary hover:bg-accent cursor-pointer"
                )}
              >
                <span>{slot.time}</span>
                <span className={cn("text-[10px]", disabled && !selected ? "text-muted-foreground/30" : selected ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {slot.bookedPatients}/{slot.maxPatients}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-card border border-border" />
            Available
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-primary" />
            Selected
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-muted" />
            Full / Past
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TimeSlotPicker;
