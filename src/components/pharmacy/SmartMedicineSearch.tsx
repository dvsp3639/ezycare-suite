import { useEffect, useRef, useState } from "react";
import { Search, Mic, MicOff, ScanBarcode, Package, Info, Layers, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { highlightMatch } from "@/lib/highlightMatch";
import { useSmartMedicineSearch } from "@/modules/pharmacy/useSmartMedicineSearch";
import type { Medicine } from "@/modules/pharmacy/types";
import { toast } from "sonner";

export type SmartMedicineAction = "issue" | "details" | "alternatives" | "stock";

interface Props {
  placeholder?: string;
  onSelect: (medicine: Medicine, action: SmartMedicineAction) => void;
  /** Auto-clear input after selection */
  clearOnSelect?: boolean;
  autoFocus?: boolean;
}

// Minimal speech recognition typing
type SR = {
  start: () => void;
  stop: () => void;
  onresult: (e: any) => void;
  onend: () => void;
  onerror: (e: any) => void;
  lang: string;
  interimResults: boolean;
  continuous: boolean;
};

function getSpeechRecognition(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function SmartMedicineSearch({
  placeholder = "Search medicines — name, salt, brand, strength…",
  onSelect,
  clearOnSelect = true,
  autoFocus,
}: Props) {
  const { query, setQuery, results, pickMedicine } = useSmartMedicineSearch();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SR | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    setHighlight(0);
    setOpen(query.trim().length >= 2);
  }, [query, results.length]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = async (med: Medicine, action: SmartMedicineAction = "issue") => {
    onSelect(med, action);
    pickMedicine(med.id);
    if (clearOnSelect) setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[highlight];
      if (r) handleSelect(r.medicine, "issue");
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const toggleVoice = () => {
    const SRClass = getSpeechRecognition();
    if (!SRClass) {
      toast.error("Voice search not supported in this browser");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SRClass();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (ev: any) => {
      const transcript = ev.results?.[0]?.[0]?.transcript || "";
      if (transcript) setQuery(transcript.trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder={placeholder}
          className="pl-10 pr-24 h-11 text-sm"
          aria-label="Smart medicine search"
          aria-autocomplete="list"
          aria-expanded={open}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={toggleVoice}
            className={cn("h-8 w-8", listening && "text-destructive animate-pulse")}
            title="Voice search"
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => inputRef.current?.focus()}
            className="h-8 w-8"
            title="Scan barcode (focus & scan)"
          >
            <ScanBarcode className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden animate-fade-in">
          {results.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No medicines match "{query}"
            </div>
          ) : (
            <ul role="listbox" className="max-h-96 overflow-y-auto divide-y divide-border">
              {results.map((r, i) => {
                const m = r.medicine;
                const active = i === highlight;
                const stockColor =
                  r.stockStatus === "in"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                    : r.stockStatus === "low"
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                    : "bg-red-500/10 text-red-600 border-red-500/30";
                const stockLabel =
                  r.stockStatus === "in"
                    ? `🟢 In Stock · ${m.stock}`
                    : r.stockStatus === "low"
                    ? `🟡 Low · ${m.stock}`
                    : "🔴 Out of Stock";
                return (
                  <li
                    key={m.id}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setHighlight(i)}
                    className={cn(
                      "p-3 transition-colors cursor-pointer",
                      active ? "bg-accent" : "hover:bg-accent/50",
                    )}
                    onClick={() => handleSelect(m, "issue")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {highlightMatch(m.name, query)}
                            {m.strength ? <span className="text-muted-foreground font-normal"> · {m.strength}</span> : null}
                          </p>
                          {m.dosageForm && (
                            <Badge variant="outline" className="text-[10px] py-0 h-4">
                              {m.dosageForm}
                            </Badge>
                          )}
                          {r.expired && (
                            <Badge variant="destructive" className="text-[10px] py-0 h-4">Expired</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {m.genericName ? <>Salt: {highlightMatch(m.genericName, query)} · </> : null}
                          {m.brandName ? <>Brand: {highlightMatch(m.brandName, query)} · </> : null}
                          {m.unit ? <>{m.unit} · </> : null}
                          {m.rackLocation ? <>Rack {m.rackLocation} · </> : null}
                          Batch {m.batchNo || "—"}
                          {m.expiryDate ? <> · Exp {m.expiryDate}</> : null}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-foreground">
                          ₹{(m.sellingPrice ?? m.mrp ?? 0).toFixed(2)}
                        </p>
                        <Badge variant="outline" className={cn("text-[10px] mt-1 border", stockColor)}>
                          {stockLabel}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={(e) => { e.stopPropagation(); handleSelect(m, "issue"); }}
                      >
                        <Package className="h-3 w-3" /> Issue
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={(e) => { e.stopPropagation(); handleSelect(m, "details"); }}
                      >
                        <Info className="h-3 w-3" /> Details
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={(e) => { e.stopPropagation(); handleSelect(m, "alternatives"); }}
                      >
                        <Layers className="h-3 w-3" /> Alternatives
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={(e) => { e.stopPropagation(); handleSelect(m, "stock"); }}
                      >
                        <Store className="h-3 w-3" /> Stock
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="px-3 py-1.5 border-t border-border bg-muted/30 text-[10px] text-muted-foreground flex items-center justify-between">
            <span>↑ ↓ navigate · Enter select · Esc close</span>
            <span>{results.length} result{results.length === 1 ? "" : "s"}</span>
          </div>
        </div>
      )}
    </div>
  );
}