import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Medicine = {
  id: string;
  name: string;
  genericName?: string;
  stock: number;
  unit?: string;
};

interface VoiceMedicineInputProps {
  medicines: Medicine[];
  onAdd: (med: Medicine, quantity: number) => void;
}

/** Parse transcript like "Paracetamol 2, Augmentin 1 strip, dolo 650 5 tablets". */
function parseSpokenItems(text: string): { token: string; qty: number }[] {
  if (!text) return [];
  const cleaned = text.replace(/\band\b/gi, ",").replace(/\s+/g, " ").trim();
  const segments = cleaned.split(/[,;]|\bthen\b|\balso\b/i).map((s) => s.trim()).filter(Boolean);
  const out: { token: string; qty: number }[] = [];
  const numWord: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  for (const seg of segments) {
    // Strip trailing units
    const stripped = seg.replace(/\b(tablets?|tabs?|capsules?|caps?|strips?|bottles?|pieces?|pcs|units?|nos?)\b\.?$/i, "").trim();
    // Find a trailing quantity (digit or number-word)
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

function findBestMatch(token: string, medicines: Medicine[]): Medicine | null {
  if (!token) return null;
  const t = token.toLowerCase();
  // Exact / startsWith on name
  const exact = medicines.find((m) => m.name.toLowerCase() === t);
  if (exact) return exact;
  const starts = medicines.find((m) => m.name.toLowerCase().startsWith(t));
  if (starts) return starts;
  // Partial on name or generic
  const partial = medicines.find(
    (m) => m.name.toLowerCase().includes(t) || (m.genericName || "").toLowerCase().includes(t),
  );
  if (partial) return partial;
  // Token-level: any word of token is included in name
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

export const VoiceMedicineInput = ({ medicines, onAdd }: VoiceMedicineInputProps) => {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [lastAdded, setLastAdded] = useState<{ name: string; qty: number }[]>([]);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const start = async () => {
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
        if (blob.size < 1500) {
          toast.error("Recording too short — try again");
          return;
        }
        await transcribeAndAdd(blob);
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stop = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  const transcribeAndAdd = async (blob: Blob) => {
    setProcessing(true);
    setTranscript("");
    try {
      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      form.append("file", blob, `voice.${ext}`);
      const { data, error } = await supabase.functions.invoke("voice-transcribe", { body: form });
      if (error) throw error;
      const text: string = (data as any)?.text || "";
      setTranscript(text);
      if (!text.trim()) {
        toast.error("Couldn't catch that — please try again");
        return;
      }
      const items = parseSpokenItems(text);
      if (!items.length) {
        toast.error("No medicines detected in voice");
        return;
      }
      const added: { name: string; qty: number }[] = [];
      const missed: string[] = [];
      for (const it of items) {
        const match = findBestMatch(it.token, medicines);
        if (match) {
          onAdd(match, it.qty);
          added.push({ name: match.name, qty: it.qty });
        } else {
          missed.push(it.token);
        }
      }
      setLastAdded(added);
      if (added.length) toast.success(`Added ${added.length} medicine${added.length > 1 ? "s" : ""} from voice`);
      if (missed.length) toast.warning(`Not found: ${missed.join(", ")}`);
    } catch (e: any) {
      toast.error(e?.message || "Transcription failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <Button
          type="button"
          onClick={recording ? stop : start}
          disabled={processing}
          size="lg"
          variant={recording ? "destructive" : "default"}
          className="gap-2 shrink-0 h-14 w-14 rounded-full p-0"
          aria-label={recording ? "Stop recording" : "Start voice input"}
        >
          {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : recording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Voice-add medicines
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {recording
              ? "Listening… speak medicine names, e.g. \"Paracetamol 2, Augmentin 1, Dolo 650 three\"."
              : processing
              ? "Transcribing and matching against inventory…"
              : "Tap the mic and say medicine names with quantity. They'll auto-add to the order."}
          </p>
          {transcript && (
            <div className="mt-2 text-xs bg-background border border-border rounded-md px-2 py-1.5">
              <span className="text-muted-foreground">Heard: </span>
              <span className="text-foreground">{transcript}</span>
            </div>
          )}
          {lastAdded.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {lastAdded.map((a, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{a.name} × {a.qty}</Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceMedicineInput;