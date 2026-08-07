import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";

export interface SearchOption {
  id: string;
  name: string;
  price?: number;
  meta?: string;
}

interface SearchSelectProps {
  options: SearchOption[];
  value?: string;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  allowCustom?: boolean;
  onSelect: (option: SearchOption) => void;
}

/** Fast, keyboard-friendly type-ahead selector reused across the Day Care case screen. */
export function SearchSelect({
  options, value, placeholder = "Search…", emptyText = "No matches found",
  className, allowCustom, onSelect,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = useMemo(() => options.find((o) => o.id === value), [options, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <span className="truncate">{selected?.name || placeholder}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
        <Command shouldFilter>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList className="max-h-64">
            <CommandEmpty>
              {allowCustom && query.trim() ? (
                <button
                  type="button"
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent rounded-sm"
                  onClick={() => { onSelect({ id: `custom:${query.trim()}`, name: query.trim() }); setOpen(false); setQuery(""); }}
                >
                  Use “{query.trim()}”
                </button>
              ) : emptyText}
            </CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.name} ${o.meta || ""}`}
                  onSelect={() => { onSelect(o); setOpen(false); setQuery(""); }}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Check className={cn("h-3.5 w-3.5 shrink-0", value === o.id ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">
                      {o.name}
                      {o.meta && <span className="ml-2 text-xs text-muted-foreground">{o.meta}</span>}
                    </span>
                  </span>
                  {o.price !== undefined && (
                    <span className="shrink-0 text-xs font-medium">₹{Number(o.price).toFixed(0)}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
