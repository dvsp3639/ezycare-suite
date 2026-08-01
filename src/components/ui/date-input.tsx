import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Shared masked dd/mm/yyyy date input. Stores ISO yyyy-mm-dd via onChange.
// Drop-in replacement for <Input type="date" value onChange /> across the app.

const isoToDisplay = (iso: string) => {
  if (!iso) return "";
  const s = iso.length > 10 ? iso.slice(0, 10) : iso;
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
};

const mask = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 2));
  if (digits.length >= 3) parts.push(digits.slice(2, 4));
  if (digits.length >= 5) parts.push(digits.slice(4, 8));
  return parts.join("/");
};

const displayToIso = (display: string) => {
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const [, dd, mm, yyyy] = m;
  const d = parseInt(dd, 10), mo = parseInt(mm, 10), y = parseInt(yyyy, 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900) return "";
  return `${yyyy}-${mm}-${dd}`;
};

export interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: string | null | undefined;
  onChange: (isoValue: string) => void;
  min?: string;
  max?: string;
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, onChange, className, placeholder = "dd/mm/yyyy", min, max, ...rest }, ref) => {
    const [text, setText] = React.useState<string>(isoToDisplay(value || ""));

    React.useEffect(() => {
      const iso = value || "";
      const display = isoToDisplay(iso);
      // Only sync from parent if it doesn't match the current text's ISO form
      if (displayToIso(text) !== iso) setText(display);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const masked = mask(e.target.value);
      setText(masked);
      const iso = displayToIso(masked);
      if (iso) {
        if (min && iso < min) return;
        if (max && iso > max) return;
        onChange(iso);
      } else if (masked === "") {
        onChange("");
      }
    };

    return (
      <Input
        {...rest}
        ref={ref}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={text}
        onChange={handleChange}
        maxLength={10}
        className={cn(className)}
      />
    );
  }
);
DateInput.displayName = "DateInput";

export default DateInput;