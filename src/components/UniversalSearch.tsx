import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Search, Mic, MicOff, ScanLine, Sparkles, Loader2, ArrowRight, Clock,
  Pill, User, LayoutGrid, Camera, X, CheckCircle2, Keyboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { modules } from "@/data/modules";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const location = useLocation();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [listening, setListening] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanHint, setScanHint] = useState("Point the camera at the medicine barcode");
  const [confirm, setConfirm] = useState<{ title: string; lines: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);
  const recRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanRafRef = useRef<number | null>(null);

  // ⌘K / Ctrl+K to focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") { setOpen(false); setScanOpen(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Auto-focus when entering Pharmacy
  useEffect(() => {
    if (location.pathname === "/pharmacy") {
      const t = setTimeout(() => inputRef.current?.focus(), 180);
      return () => clearTimeout(t);
    }
  }, [location.pathname]);

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

  const showConfirm = (title: string, lines: string[]) => {
    setConfirm({ title, lines });
    setTimeout(() => setConfirm(null), 2000);
  };

  const stopScanner = () => {
    if (scanRafRef.current) { cancelAnimationFrame(scanRafRef.current); scanRafRef.current = null; }
    scanStreamRef.current?.getTracks().forEach((t) => t.stop());
    scanStreamRef.current = null;
  };

  const handleScannedCode = async (code: string) => {
    setScanHint("Verifying…");
    stopScanner();
    setScanOpen(false);
    const { data } = await supabase
      .from("medicines")
      .select("id,name,generic_name,strength,stock")
      .ilike("name", `%${code}%`)
      .limit(1)
      .maybeSingle();
    const med = data as any;
    if (med && med.id) {
      bumpFreq(`med:${med.id}`);
      pushRecent(med.name);
      showConfirm(`${med.name}${med.strength ? " " + med.strength : ""}`, [
        (med.stock ?? 0) > 0 ? "Stock Available" : "Out of Stock",
        "Batch Verified",
        "Added to OP Sale",
      ]);
      navigate("/pharmacy", { state: { universalSearch: med.name } });
    } else {
      showConfirm("Code scanned", [code, "No matching medicine found"]);
      setQ(code);
      inputRef.current?.focus();
    }
  };

  const openScanner = async () => {
    const Detector = (window as any).BarcodeDetector;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.info("Camera not available. Focus the search and use a USB scanner.");
      inputRef.current?.focus();
      return;
    }
    if (!Detector) {
      toast.info("Barcode detection not supported in this browser. Use a USB scanner.");
      inputRef.current?.focus();
      return;
    }
    try {
      setScanOpen(true);
      setScanHint("Point the camera at the medicine barcode");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      scanStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new Detector({ formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "data_matrix"] });
      const loop = async () => {
        if (!videoRef.current || !scanStreamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes && codes.length > 0) {
            const raw = String(codes[0].rawValue || "").trim();
            if (raw) { await handleScannedCode(raw); return; }
          }
        } catch {}
        scanRafRef.current = requestAnimationFrame(loop);
      };
      scanRafRef.current = requestAnimationFrame(loop);
    } catch {
      toast.error("Camera permission denied");
      setScanOpen(false);
      stopScanner();
    }
  };

  useEffect(() => () => stopScanner(), []);

  const recent = useMemo(() => getRecent(), [open]);

  const placeholder = "Search medicines, speak naturally or scan…";

  return (
    <>
    <div ref={containerRef} className="relative flex-1 max-w-2xl">
      {/* AI Assistant Bar */}
      <div
        className={cn(
          "group relative flex items-center gap-2 h-12 pl-4 pr-2 rounded-full transition-all",
          "bg-gradient-to-r from-background via-background to-primary/[0.04]",
          "border border-border/60 shadow-sm hover:shadow-md focus-within:shadow-lg",
          "focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15",
          listening && "border-destructive/40 ring-2 ring-destructive/20 bg-destructive/[0.03]",
        )}
        onClick={() => { inputRef.current?.focus(); setOpen(true); }}
        role="button"
        tabIndex={-1}
      >
        {listening ? (
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inset-0 rounded-full bg-destructive animate-ping" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
            </span>
            <div className="flex items-end gap-[3px] h-6">
              {[0.0, 0.15, 0.3, 0.1, 0.25, 0.05, 0.2].map((d, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-destructive/70 origin-center animate-wave"
                  style={{ height: "100%", animationDelay: `${d}s` }}
                />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground leading-tight">Listening…</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Speak medicine name</p>
            </div>
          </div>
        ) : (
          <>
            <Sparkles className="h-4 w-4 text-primary/70 shrink-0" />
            <Input
              ref={inputRef}
              value={q}
              onChange={(e) => { setQ(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKey}
              placeholder={placeholder}
              aria-label="AI universal search"
              className="flex-1 h-10 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-[15px] placeholder:text-muted-foreground/70"
            />
          </>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {!listening && (
            <kbd className="hidden md:inline-flex items-center px-1.5 h-5 text-[10px] rounded border border-border/60 bg-muted/60 text-muted-foreground">⌘K</kbd>
          )}
          {/* Secondary: Scan */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openScanner(); }}
            title="Scan medicine"
            className="hidden sm:inline-flex items-center justify-center h-9 w-9 rounded-full bg-muted hover:bg-accent text-foreground transition-all hover:scale-105"
          >
            <ScanLine className="h-4 w-4" />
          </button>
          {/* Primary: Speak */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleVoice(); }}
            title="Speak (English / Hindi / Telugu)"
            className={cn(
              "relative inline-flex items-center justify-center h-10 w-10 rounded-full transition-all",
              listening
                ? "bg-destructive text-destructive-foreground"
                : "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground hover:scale-105 animate-ai-glow",
            )}
          >
            {listening ? <MicOff className="h-[18px] w-[18px]" /> : <Mic className="h-[18px] w-[18px]" />}
          </button>
          {aiBusy && (
            <Loader2 className="h-4 w-4 animate-spin text-primary mr-1" />
          )}
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

    {/* Mobile floating action bar */}
    {isMobile && (
      <div className="fixed bottom-4 inset-x-4 z-40 pointer-events-none">
        <div className="pointer-events-auto mx-auto max-w-md flex items-center justify-between gap-2 p-2 rounded-2xl bg-popover/95 backdrop-blur border border-border shadow-2xl">
          <button
            onClick={() => { inputRef.current?.focus(); setOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl hover:bg-accent active:scale-95 transition"
          >
            <Keyboard className="h-5 w-5 text-foreground" />
            <span className="text-[10px] font-medium">Search</span>
          </button>
          <button
            onClick={openScanner}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl bg-muted hover:bg-accent active:scale-95 transition"
          >
            <ScanLine className="h-5 w-5 text-foreground" />
            <span className="text-[10px] font-medium">Scan</span>
          </button>
          <button
            onClick={toggleVoice}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl active:scale-95 transition text-primary-foreground",
              listening ? "bg-destructive" : "bg-gradient-to-br from-primary to-primary/80 animate-ai-glow",
            )}
          >
            {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            <span className="text-[10px] font-medium">{listening ? "Stop" : "Speak"}</span>
          </button>
        </div>
      </div>
    )}

    {/* Scan overlay */}
    {scanOpen && (
      <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col animate-fade-in">
        <div className="flex items-center justify-between p-4 text-white">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            <span className="font-medium">Smart Scan</span>
          </div>
          <button onClick={() => { stopScanner(); setScanOpen(false); }} className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="relative w-full max-w-md aspect-square rounded-3xl overflow-hidden bg-black ring-1 ring-white/10">
            <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
            {/* corner frame */}
            <div className="absolute inset-6 pointer-events-none">
              <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-primary rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-primary rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-primary rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-primary rounded-br-xl" />
              <div className="absolute inset-x-0 h-[2px] bg-primary/80 shadow-[0_0_12px_hsl(var(--primary))] animate-scan-line" />
            </div>
          </div>
        </div>
        <p className="text-center text-white/80 pb-8 px-6 text-sm">{scanHint}</p>
      </div>
    )}

    {/* AI confirmation card */}
    {confirm && (
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[110] animate-scale-in">
        <div className="min-w-[280px] max-w-sm rounded-2xl bg-popover/95 backdrop-blur border border-border shadow-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground truncate">{confirm.title}</p>
              <ul className="mt-1 space-y-0.5">
                {confirm.lines.map((l, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-primary/60" /> {l}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}