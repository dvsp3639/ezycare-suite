import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Mic, MicOff, ScanBarcode, QrCode, Sparkles, Loader2, ArrowRight, Clock, Pill, User, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { modules } from "@/data/modules";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Kind = "module" | "medicine" | "patient" | "ai" | "recent";
interface Result {
  kind: Kind;
  id: string;
  title: string;
  subtitle?: string;
  route: string;
  state?: any;
  score?: number;
}

const RECENT_KEY = "ezyop.universal.recent";
const FREQ_KEY = "ezyop.universal.freq";

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}
function pushRecent(q: string) {
  if (!q.trim()) return;
  const cur = getRecent().filter((x) => x.toLowerCase() !== q.toLowerCase());
  cur.unshift(q);
  localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, 12)));
}
function bumpFreq(key: string) {
  try {
    const m = JSON.parse(localStorage.getItem(FREQ_KEY) || "{}");
    m[key] = (m[key] || 0) + 1;
    localStorage.setItem(FREQ_KEY, JSON.stringify(m));
  } catch {}
}
function getFreq(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(FREQ_KEY) || "{}"); } catch { return {}; }
}

function getSR(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function UniversalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [listening, setListening] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);
  const recRef = useRef<any>(null);

  // ⌘K / Ctrl+K to focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const moduleResults = useMemo<Result[]>(() => {
    const freq = getFreq();
    const term = q.trim().toLowerCase();
    const list = modules
      .filter((m) => !term || m.title.toLowerCase().includes(term) || m.id.includes(term) || m.description.toLowerCase().includes(term))
      .map((m) => ({
        kind: "module" as const,
        id: `mod:${m.id}`,
        title: m.title,
        subtitle: m.description,
        route: m.route,
        score: (freq[`mod:${m.id}`] || 0) + (m.title.toLowerCase().startsWith(term) ? 5 : 0),
      }));
    list.sort((a, b) => (b.score || 0) - (a.score || 0));
    return list.slice(0, term ? 6 : 8);
  }, [q]);

  // Live search of medicines + patients (debounced)
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const term = q.trim();
    if (term.length < 2) {
      setResults(moduleResults);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      const like = `%${term}%`;
      const [medsR, patsR] = await Promise.all([
        supabase.from("medicines").select("id,name,generic_name,strength,stock").or(`name.ilike.${like},generic_name.ilike.${like}`).limit(6),
        supabase.from("patients").select("id,full_name,registration_number,mobile").or(`full_name.ilike.${like},registration_number.ilike.${like},mobile.ilike.${like}`).limit(6),
      ]);
      const med: Result[] = (medsR.data || []).map((m: any) => ({
        kind: "medicine",
        id: `med:${m.id}`,
        title: `${m.name}${m.strength ? " · " + m.strength : ""}`,
        subtitle: `${m.generic_name || ""}${m.generic_name ? " · " : ""}Stock: ${m.stock ?? 0}`,
        route: "/pharmacy",
        state: { universalSearch: m.name },
      }));
      const pat: Result[] = (patsR.data || []).map((p: any) => ({
        kind: "patient",
        id: `pat:${p.id}`,
        title: p.full_name,
        subtitle: `${p.registration_number || ""}${p.mobile ? " · " + p.mobile : ""}`,
        route: "/patient-registration",
        state: { universalSearch: p.registration_number || p.full_name },
      }));
      setResults([...moduleResults, ...med, ...pat]);
      setHighlight(0);
    }, 180);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [q, moduleResults]);

  const runAi = async (text: string) => {
    if (!text.trim()) return;
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("universal-ai-search", { body: { query: text } });
      if (error) throw error;
      if (data?.route) {
        toast.success(data.reply || "Done");
        navigate(data.route, { state: { universalSearch: data.query, universalAction: data.action } });
        pushRecent(text);
        bumpFreq(`ai:${data.route}`);
        setOpen(false);
        setQ("");
      } else {
        toast.info(data?.reply || "I couldn't understand that. Try a module name or medicine.");
      }
    } catch (e: any) {
      const msg = e?.message || "AI request failed";
      if (msg.includes("402")) toast.error("AI credits exhausted. Please top up.");
      else if (msg.includes("429")) toast.error("AI rate limit reached. Try again shortly.");
      else toast.error(msg);
    } finally {
      setAiBusy(false);
    }
  };

  const choose = (r: Result) => {
    bumpFreq(r.id);
    pushRecent(q || r.title);
    navigate(r.route, { state: r.state });
    setOpen(false);
    setQ("");
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) setOpen(true);
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, results.length)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[highlight];
      if (r) choose(r); else if (q.trim()) runAi(q);
    }
  };

  const toggleVoice = () => {
    const SR = getSR();
    if (!SR) { toast.error("Voice search not supported in this browser"); return; }
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (ev: any) => {
      const t = ev.results?.[0]?.[0]?.transcript || "";
      if (t) { setQ(t); setOpen(true); runAi(t); }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
    toast.info("Listening… speak now");
  };

  const scanBarcode = async () => {
    const Detector = (window as any).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      toast.info("Barcode scanner not supported here. Use a USB scanner — focus the search box and scan.");
      inputRef.current?.focus();
      return;
    }
    toast.info("Camera barcode scan coming soon. Focus and scan with a USB reader.");
    inputRef.current?.focus();
  };

  const recent = useMemo(() => getRecent(), [open]);

  return (
    <div ref={containerRef} className="relative flex-1 max-w-2xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="Search anything — patient, medicine, module, or ask AI…"
          className="pl-10 pr-44 h-10 bg-background/60 border-border/60 focus-visible:ring-1"
          aria-label="Universal search"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          <kbd className="hidden md:inline-flex items-center px-1.5 h-5 text-[10px] rounded border border-border bg-muted text-muted-foreground mr-1">⌘K</kbd>
          <Button type="button" size="icon" variant="ghost" className={cn("h-8 w-8", listening && "text-destructive animate-pulse")} onClick={toggleVoice} title="Voice (English/Hindi/Telugu)">
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={scanBarcode} title="Barcode scan">
            <ScanBarcode className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={scanBarcode} title="QR scan">
            <QrCode className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => runAi(q || "")} disabled={aiBusy || !q.trim()} title="Ask AI">
            {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-border bg-popover shadow-xl overflow-hidden animate-fade-in">
          {q.trim().length < 2 && recent.length > 0 && (
            <div className="p-2 border-b border-border">
              <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">Recent</p>
              <div className="flex flex-wrap gap-1.5 px-1 pb-1">
                {recent.slice(0, 6).map((r) => (
                  <button key={r} onClick={() => { setQ(r); runAi(r); }} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-muted hover:bg-accent">
                    <Clock className="h-3 w-3" /> {r}
                  </button>
                ))}
              </div>
            </div>
          )}
          <ul role="listbox" className="max-h-[60vh] overflow-y-auto divide-y divide-border">
            {results.map((r, i) => {
              const active = i === highlight;
              const Icon = r.kind === "medicine" ? Pill : r.kind === "patient" ? User : LayoutGrid;
              return (
                <li
                  key={r.id}
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => choose(r)}
                  className={cn("flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors", active ? "bg-accent" : "hover:bg-accent/50")}
                >
                  <div className={cn("h-8 w-8 rounded-md flex items-center justify-center shrink-0",
                    r.kind === "medicine" ? "bg-info/10 text-info" :
                    r.kind === "patient" ? "bg-primary/10 text-primary" :
                    "bg-muted text-foreground")}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                    {r.subtitle && <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>}
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">{r.kind}</Badge>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </li>
              );
            })}
            {q.trim() && (
              <li
                role="option"
                onMouseEnter={() => setHighlight(results.length)}
                onClick={() => runAi(q)}
                className={cn("flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors border-t border-border bg-gradient-to-r from-primary/5 to-transparent",
                  highlight === results.length ? "bg-accent" : "hover:bg-accent/50")}
              >
                <div className="h-8 w-8 rounded-md flex items-center justify-center bg-primary/10 text-primary">
                  {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">Ask AI: "{q}"</p>
                  <p className="text-xs text-muted-foreground">Understands English, Hindi, Telugu, Hinglish</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </li>
            )}
            {results.length === 0 && q.trim().length < 2 && (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">Start typing or press the mic to speak</li>
            )}
          </ul>
          <div className="px-3 py-1.5 border-t border-border bg-muted/30 text-[10px] text-muted-foreground flex items-center justify-between">
            <span>↑ ↓ navigate · Enter select · Esc close</span>
            <span className="hidden md:inline">Powered by Ezy OP AI</span>
          </div>
        </div>
      )}
    </div>
  );
}