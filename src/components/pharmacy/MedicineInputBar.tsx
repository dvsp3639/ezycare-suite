import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Mic, Square, Loader2, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { compressImageFile } from "@/lib/mobileScanHelpers";

export type MedicineLike = {
  id: string;
  name: string;
  genericName?: string;
  stock: number;
  unit?: string;
  batchNo?: string;
  mrp?: number;
};

interface Props {
  medicines: MedicineLike[];
  onAdd: (med: MedicineLike, quantity: number) => void;
}

/* ---------------- shared parsing / matching ---------------- */

function parseSpokenItems(text: string): { token: string; qty: number }[] {
  if (!text) return [];
  const cleaned = text.replace(/\band\b/gi, ",").replace(/\s+/g, " ").trim();
  const segments = cleaned.split(/[,;]|\bthen\b|\balso\b/i).map((s) => s.trim()).filter(Boolean);
  const numWord: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const out: { token: string; qty: number }[] = [];
  for (const seg of segments) {
    const stripped = seg.replace(/\b(tablets?|tabs?|capsules?|caps?|strips?|bottles?|pieces?|pcs|units?|nos?)\b\.?$/i, "").trim();
    const m = stripped.match(/^(.*?)[\s-]+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)$/i);
    let token = stripped;
    let qty = 1;
    if (m) {
      token = m[1].trim();
      const raw = m[2].toLowerCase();
      qty = /^\d+$/.test(raw) ? parseInt(raw, 10) : numWord[raw] || 1;
    }
    if (token) out.push({ token, qty: Math.max(1, qty) });
  }
  return out;
}

function findBestMatch(token: string, medicines: MedicineLike[]): MedicineLike | null {
  if (!token) return null;
  const t = token.toLowerCase();
  const exact = medicines.find((m) => m.name.toLowerCase() === t);
  if (exact) return exact;
  const starts = medicines.find((m) => m.name.toLowerCase().startsWith(t));
  if (starts) return starts;
  const partial = medicines.find(
    (m) => m.name.toLowerCase().includes(t) || (m.genericName || "").toLowerCase().includes(t),
  );
  if (partial) return partial;
  const words = t.split(/\s+/).filter((w) => w.length >= 3);
  if (words.length) {
    const scored = medicines
      .map((m) => {
        const name = `${m.name} ${m.genericName || ""}`.toLowerCase();
        const hits = words.filter((w) => name.includes(w)).length;
        return { m, hits };
      })
      .filter((x) => x.hits > 0)
      .sort((a, b) => b.hits - a.hits);
    if (scored.length) return scored[0].m;
  }
  return null;
}

/** FileReader-based base64. Char-by-char loops on 5–12 MP phone photos
 * stall or OOM mobile Chrome silently. */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); res(s.split(",")[1] || s); };
    r.onerror = () => rej(r.error || new Error("read failed"));
    r.readAsDataURL(blob);
  });
}

/* ---------------- component ---------------- */

export const MedicineInputBar = ({ medicines, onAdd }: Props) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [lastAdded, setLastAdded] = useState<{ name: string; qty: number }[]>([]);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // close suggestions on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return medicines
      .filter((m) => m.name.toLowerCase().includes(q) || (m.genericName || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, medicines]);

  const pick = (m: MedicineLike) => {
    onAdd(m, 1);
    toast.success(`${m.name} added`);
    setQuery("");
    setOpen(false);
    setActiveIdx(0);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !suggestions.length) {
      if (e.key === "Enter" && query.trim()) {
        const m = findBestMatch(query.trim(), medicines);
        if (m) pick(m);
        else toast.error("No medicine found");
      }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(suggestions[activeIdx]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  /* --- voice --- */
  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (blob.size < 1500) { toast.error("Recording too short — try again"); return; }
        await transcribeAndAdd(blob);
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };
  const stopVoice = () => { mediaRef.current?.stop(); setRecording(false); };

  const transcribeAndAdd = async (blob: Blob) => {
    setVoiceBusy(true);
    try {
      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      form.append("file", blob, `voice.${ext}`);
      const { data, error } = await supabase.functions.invoke("voice-transcribe", { body: form });
      if (error) throw error;
      const text: string = (data as any)?.text || "";
      if (!text.trim()) { toast.error("Couldn't catch that — please try again"); return; }
      setQuery(text);
      const items = parseSpokenItems(text);
      const added: { name: string; qty: number }[] = [];
      const missed: string[] = [];
      for (const it of items) {
        const m = findBestMatch(it.token, medicines);
        if (m) { onAdd(m, it.qty); added.push({ name: m.name, qty: it.qty }); }
        else missed.push(it.token);
      }
      setLastAdded(added);
      if (added.length) { toast.success(`Added ${added.length} from voice`); setQuery(""); }
      if (missed.length) toast.warning(`Not found: ${missed.join(", ")}`);
    } catch (e: any) {
      toast.error(e?.message || "Transcription failed");
    } finally {
      setVoiceBusy(false);
    }
  };

  /* --- image scan --- */
  const onPickImage = () => fileRef.current?.click();
  const onImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const log = (...a: any[]) => console.log("[MedInputBar:scan]", ...a);
    log("file selected", { name: file.name, size: file.size, type: file.type });
    setScanBusy(true);
    try {
      const compressed = await compressImageFile(file);
      log("compressed", { fromKB: Math.round(file.size / 1024), toKB: Math.round(compressed.size / 1024) });
      const base64 = await blobToBase64(compressed);
      log("base64 ready", "len=", base64.length, "→ invoking medicine-scan-ai");
      const { data, error } = await supabase.functions.invoke("medicine-scan-ai", {
        body: { fileBase64: base64, mimeType: compressed.type || "image/jpeg" },
      });
      log("ai response", { hasError: !!error, items: (data as any)?.invoice?.items?.length });
      if (error) throw error;
      const tokens: { token: string; qty: number }[] = [];
      const inv = (data as any)?.invoice?.items as any[] | undefined;
      if (inv?.length) {
        for (const it of inv) {
          const t = it?.brandName || it?.name || it?.genericName;
          if (t) tokens.push({ token: String(t), qty: Number(it?.quantity) > 0 ? Number(it.quantity) : 1 });
        }
      } else {
        const med = (data as any)?.medicine;
        const t = med?.brandName?.value || med?.name?.value || med?.genericName?.value;
        if (t) tokens.push({ token: String(t), qty: 1 });
      }
      if (!tokens.length) { toast.error("Couldn't read medicines from image"); return; }
      const added: { name: string; qty: number }[] = [];
      const missed: string[] = [];
      for (const it of tokens) {
        const m = findBestMatch(it.token, medicines);
        if (m) { onAdd(m, it.qty); added.push({ name: m.name, qty: it.qty }); }
        else missed.push(it.token);
      }
      setLastAdded(added);
      if (added.length) toast.success(`Added ${added.length} from image`);
      if (missed.length) toast.warning(`Not found: ${missed.join(", ")}`);
    } catch (err: any) {
      console.error("[MedInputBar:scan] failed", err);
      toast.error(err?.message || "Image scan failed");
    } finally {
      setScanBusy(false);
    }
  };

  return (
    <div className="space-y-2" ref={wrapRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIdx(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="Search medicine by name, salt or brand…"
          className="pl-10 pr-28 h-11"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setQuery("")}
              aria-label="Clear">
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant={recording ? "destructive" : "ghost"}
            className="h-8 w-8"
            onClick={recording ? stopVoice : startVoice}
            disabled={voiceBusy}
            aria-label={recording ? "Stop voice" : "Voice add"}
            title={recording ? "Stop recording" : "Speak medicine names"}
          >
            {voiceBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onPickImage}
            disabled={scanBusy}
            aria-label="Scan image"
            title="Scan medicine / prescription image"
          >
            {scanBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={onImageChange}
        />

        {open && suggestions.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-72 overflow-y-auto">
            {suggestions.map((m, i) => (
              <button
                type="button"
                key={m.id}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => pick(m)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 border-b border-border last:border-b-0 ${i === activeIdx ? "bg-muted" : "hover:bg-muted/60"}`}
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {m.genericName || "—"}{m.batchNo ? ` · Batch ${m.batchNo}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant={m.stock > 0 ? "outline" : "destructive"} className="text-[10px]">
                    Stock {m.stock}
                  </Badge>
                  {typeof m.mrp === "number" && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">₹{m.mrp.toFixed(2)}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {recording ? "Listening… speak names with quantity (e.g. \"Dolo 650 two, Augmentin one\")"
            : scanBusy ? "Reading image…"
            : "Type to search, press Enter to add. Use mic for voice or camera to scan."}
        </span>
        {lastAdded.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end">
            {lastAdded.slice(-3).map((a, i) => (
              <Badge key={i} variant="secondary" className="text-[10px]">{a.name} × {a.qty}</Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicineInputBar;