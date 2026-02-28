import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { generateTimeSlots } from "@/data/mockPatients";
import { cn } from "@/lib/utils";

interface TimeSlotPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (time: string) => void;
  selectedTime: string;
}

const TimeSlotPicker = ({ open, onOpenChange, onSelect, selectedTime }: TimeSlotPickerProps) => {
  const [slots] = useState(() => generateTimeSlots());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Select Time Slot</DialogTitle>
          <p className="text-sm text-muted-foreground">Choose an available slot</p>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 max-h-[400px] overflow-y-auto p-1">
          {slots.map((slot, i) => (
            <button
              key={i}
              disabled={!slot.available}
              onClick={() => {
                onSelect(slot.time);
                onOpenChange(false);
              }}
              className={cn(
                "p-3 rounded-lg text-sm font-medium transition-all border",
                slot.available && slot.time !== selectedTime
                  ? "border-border bg-card text-foreground hover:border-primary hover:bg-accent cursor-pointer"
                  : "",
                slot.time === selectedTime
                  ? "bg-primary text-primary-foreground border-primary"
                  : "",
                !slot.available
                  ? "bg-muted text-muted-foreground/40 border-transparent cursor-not-allowed line-through"
                  : ""
              )}
            >
              {slot.time}
            </button>
          ))}
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
            Booked
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TimeSlotPicker;
