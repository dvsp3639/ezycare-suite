/* ──────────────────────────────────────────────────────────────────────
 * MobileScanView — phone-first, one-handed prescription verification
 *
 * - Bottom nav: Scan · Medicines · Patient · Review · Finish
 * - One medicine per screen with swipe gestures
 * - Verified sections collapse with a green check
 * - Tap-to-expand prescription thumbnail
 * - Floating "Add Medicine" available everywhere
 * ────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ScanLine, Camera, Upload, Sparkles, Loader2, ChevronLeft, ChevronRight,
  Plus, Trash2, CheckCircle2, AlertTriangle, Pill, User, ClipboardCheck,
  CreditCard, X, ImageIcon, Package, Printer,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { canvasToBlob, enhance, fileToImage, imageToCanvas, blobToBase64 } from "@/lib/docScan";
import { fileDebugInfo, installMobileLifecycleTrace, traceFailure, traceUpload } from "@/lib/mobileUploadDiagnostics";
import {
  workspaceService, matchInventory, recomputeTotals,
  type WorkspaceScan, type WorkspaceItem, type SaleType,
} from "@/modules/pharmacy/workspace";
import { pharmacyService } from "@/modules/pharmacy/services";
import type { Medicine } from "@/modules/pharmacy/types";

type Tab = "scan" | "medicines" | "patient" | "review" | "finish";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "scan", label: "Scan", icon: ScanLine },
  { id: "medicines", label: "Meds", icon: Pill },
  { id: "patient", label: "Patient", icon: User },
  { id: "review", label: "Review", icon: ClipboardCheck },
  { id: "finish", label: "Finish", icon: CreditCard },
];

export default function MobileScanView({
  scan, userId, medicines, onBack, onCompleted, onSave,
}: {
  scan: WorkspaceScan;
  userId: string;
  medicines: Medicine[];
  onBack: () => void;
  onCompleted: () => void;
  onSave: (patch: Partial<WorkspaceScan>) => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>(() => initialTab(scan));
  const [thumbOpen, setThumbOpen] = useState(false);

  // Auto-advance tab as backend stage progresses (cross-device sync)
  useEffect(() => {
    if (scan.stage === "audit") setTab("finish");
  }, [scan.stage]);

  const addMedicine = () => {
    const next = [...(scan.items_json || []),
      { name: "", quantity: 1, mrp: 0, gstPercent: 12, matchStatus: "unmatched" as const }];
    onSave({ items_json: next as any, totals_json: recomputeTotals(next) as any });
    setTab("medicines");
  };

  return (
    <div className="fixed inset-0 bg-background z-40 flex flex-col">
      {/* Top bar */}
      <div className="px-3 py-2 border-b flex items-center gap-2 bg-card">
        <Button size="icon" variant="ghost" onClick={onBack} className="h-9 w-9">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">
            {scan.patient_json?.name || "New prescription"}
          </div>
          <Progress value={tabProgress(tab)} className="h-1 mt-1" />
        </div>
        <ThumbButton scan={scan} onOpen={() => setThumbOpen(true)} />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-28">
        {tab === "scan" && <ScanTab scan={scan} userId={userId} medicines={medicines} onSave={onSave} onNext={() => setTab("medicines")} />}
        {tab === "medicines" && <MedicinesTab scan={scan} onSave={onSave} />}
        {tab === "patient" && <PatientTab scan={scan} onSave={onSave} />}
        {tab === "review" && <ReviewTab scan={scan} onSave={onSave} onGoto={setTab} onProceed={() => setTab("finish")} />}
        {tab === "finish" && <FinishTab scan={scan} onSave={onSave} onCompleted={onCompleted} />}
      </div>

      {/* Floating Add Medicine */}
      {tab !== "finish" && (
        <button
          onClick={addMedicine}
          aria-label="Add medicine"
          className="fixed right-4 bottom-24 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-card border-t pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex flex-col items-center justify-center py-2.5 text-[11px] font-medium transition-colors min-h-[56px]",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5 mb-0.5", active && "scale-110")} />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Prescription preview */}
      <Dialog open={thumbOpen} onOpenChange={setThumbOpen}>
        <DialogContent className="max-w-md p-2">
          <PrescriptionPreview scan={scan} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function initialTab(scan: WorkspaceScan): Tab {
  if (scan.stage === "scan") return "scan";
  if (scan.stage === "ai_extraction" || scan.stage === "inventory_match") return "medicines";
  if (scan.stage === "review") return "review";
  if (scan.stage === "billing" || scan.stage === "payment" || scan.stage === "deducted" || scan.stage === "audit") return "finish";
  return "scan";
}

function tabProgress(t: Tab) {
  const i = TABS.findIndex((x) => x.id === t);
  return Math.round(((i + 1) / TABS.length) * 100);
}

/* ───────────── Thumbnail button ───────────── */
function ThumbButton({ scan, onOpen }: { scan: WorkspaceScan; onOpen: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const p = scan.source_files?.[0];
    if (!p) { setUrl(null); return; }
    workspaceService.signedUrl(p, 1800).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [scan.source_files?.[0]]);
  if (!scan.source_files?.length) return null;
  return (
    <button onClick={onOpen} className="h-9 w-9 rounded-md border overflow-hidden bg-muted flex items-center justify-center shrink-0" aria-label="View prescription">
      {url
        ? <img src={url} alt="Rx" className="h-full w-full object-cover" />
        : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
    </button>
  );
}

function PrescriptionPreview({ scan }: { scan: WorkspaceScan }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.all((scan.source_files || []).map((p) => workspaceService.signedUrl(p, 1800)))
      .then((all) => { if (!cancelled) setUrls(all.filter(Boolean) as string[]); });
    return () => { cancelled = true; };
  }, [scan.source_files]);
  if (!urls.length) return <div className="p-6 text-sm text-muted-foreground text-center">No pages.</div>;
  return (
    <div className="space-y-2 max-h-[80vh] overflow-y-auto">
      {urls.map((u, i) => <img key={i} src={u} alt={`page ${i + 1}`} className="w-full rounded-md border" />)}
    </div>
  );
}

/* ───────────── Tab 1 · Scan ───────────── */
function ScanTab({
  scan, userId, medicines, onSave, onNext,
}: {
  scan: WorkspaceScan; userId: string; medicines: Medicine[];
  onSave: (p: Partial<WorkspaceScan>) => Promise<void>; onNext: () => void;
}) {
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    traceUpload("1 Scanner opened", {
      file: "src/components/pharmacy/MobileScanView.tsx",
      component: "ScanTab",
      function: "ScanTab.useEffect",
      block: "mobile prescription scan tab mounted",
      scanId: scan.id,
      existingPages: scan.source_files?.length || 0,
    });
    return installMobileLifecycleTrace("MobileScanView.ScanTab");
  }, [scan.id, scan.source_files?.length]);

  async function ingest(files: FileList | null) {
    if (!files?.length) {
      traceFailure("3 File selected", {
        file: "src/components/pharmacy/MobileScanView.tsx",
        component: "ScanTab",
        function: "ingest",
        block: "FileList was empty before upload pipeline",
        scanId: scan.id,
        stopReason: "No File object reached ingest(); upload cannot start.",
      }, new Error("Empty FileList"));
      return;
    }
    traceUpload("3 File selected", {
      file: "src/components/pharmacy/MobileScanView.tsx",
      component: "ScanTab",
      function: "ingest",
      block: "ingest received FileList",
      scanId: scan.id,
      files: Array.from(files).map(fileDebugInfo),
    });
    setBusy(true);
    setErr(null);
    try {
      const paths = [...scan.source_files];
      let i = paths.length;
      for (const f of Array.from(files)) {
        try {
          traceUpload("5 File object created", {
            file: "src/components/pharmacy/MobileScanView.tsx",
            component: "ScanTab",
            function: "ingest",
            block: "for-of FileList item verified",
            scanId: scan.id,
            selectedFile: fileDebugInfo(f),
          });
          let blob: Blob = f;
          if (f.type.startsWith("image/")) {
            traceUpload("6 Compression started", {
              file: "src/components/pharmacy/MobileScanView.tsx",
              component: "ScanTab",
              function: "ingest",
              block: "fileToImage -> canvas enhance -> canvasToBlob",
              scanId: scan.id,
              selectedFile: fileDebugInfo(f),
            });
            const img = await fileToImage(f);
            const c = imageToCanvas(img, 1400);
            enhance(c);
            blob = await canvasToBlob(c, "image/jpeg", 0.78);
            traceUpload("7 Compression completed", {
              file: "src/components/pharmacy/MobileScanView.tsx",
              component: "ScanTab",
              function: "ingest",
              block: "canvasToBlob returned upload blob",
              scanId: scan.id,
              original: fileDebugInfo(f),
              compressed: fileDebugInfo(blob),
            });
          } else {
            traceUpload("6 Compression started", {
              file: "src/components/pharmacy/MobileScanView.tsx",
              component: "ScanTab",
              function: "ingest",
              block: "non-image file bypasses compression",
              scanId: scan.id,
              selectedFile: fileDebugInfo(f),
              skipped: true,
            });
            traceUpload("7 Compression completed", {
              file: "src/components/pharmacy/MobileScanView.tsx",
              component: "ScanTab",
              function: "ingest",
              block: "original non-image file retained",
              scanId: scan.id,
              selectedFile: fileDebugInfo(f),
              skipped: true,
            });
          }
          const path = await workspaceService.uploadPage(scan.id, userId, blob, i++);
          paths.push(path);
        } catch (perFileErr: any) {
          traceFailure("Upload pipeline stopped", {
            file: "src/components/pharmacy/MobileScanView.tsx",
            component: "ScanTab",
            function: "ingest",
            block: "per-file compression/upload loop",
            scanId: scan.id,
            selectedFile: fileDebugInfo(f),
            stopReason: "A selected prescription page failed before it could be saved to storage.",
          }, perFileErr);
          throw perFileErr;
        }
      }
      if (paths.length === scan.source_files.length) {
        setErr("No pages could be uploaded. Check your connection and try again.");
        return;
      }
      await onSave({ source_files: paths as any, page_count: paths.length });
      toast.success(`${paths.length - scan.source_files.length} page(s) added`);
    } catch (e: any) {
      traceFailure("Upload pipeline stopped", {
        file: "src/components/pharmacy/MobileScanView.tsx",
        component: "ScanTab",
        function: "ingest",
        block: "outer upload pipeline catch",
        scanId: scan.id,
        stopReason: "Prescription page upload did not complete; AI was not started.",
      }, e);
      setErr(e?.message || "Upload failed");
      toast.error(e?.message || "Upload failed");
    }
    finally { setBusy(false); }
  }

  const runAI = useCallback(async () => {
    setAiBusy(true); setErr(null);
    try {
      const path = scan.source_files[0];
      if (!path) throw new Error("Capture a page first");
      traceUpload("12 Edge Function triggered", {
        file: "src/components/pharmacy/MobileScanView.tsx",
        component: "ScanTab",
        function: "runAI",
        block: "download stored page before prescription-scan-ai",
        scanId: scan.id,
        path,
      });
      const { data: blob, error } = await supabase.storage.from("prescriptions").download(path);
      if (error || !blob) throw error || new Error("Failed to load page");
      const b64 = await blobToBase64(blob);
      traceUpload("13 OCR started", {
        file: "src/components/pharmacy/MobileScanView.tsx",
        component: "ScanTab",
        function: "runAI",
        block: "invoke prescription-scan-ai with stored page base64",
        scanId: scan.id,
        path,
        mimeType: blob.type || "image/jpeg",
        base64Length: b64.length,
      });
      const { data, error: fnErr } = await supabase.functions.invoke("prescription-scan-ai", {
        body: { fileBase64: b64, mimeType: blob.type || "image/jpeg" },
      });
      if (fnErr) throw fnErr;
      traceUpload("14 OCR completed", {
        file: "src/components/pharmacy/MobileScanView.tsx",
        component: "ScanTab",
        function: "runAI",
        block: "prescription-scan-ai returned response",
        scanId: scan.id,
        documentType: (data as any)?.documentType,
      });
      const items: WorkspaceItem[] = (data?.medicines || []).map((m: any) => ({
        aiText: m.name,
        name: m.brandName || m.name || "",
        strength: m.strength || "",
        dosage: m.dosage || "",
        frequency: m.frequency || "",
        duration: m.duration || "",
        instructions: m.instructions || "",
        quantity: Number(m.quantity) || 1,
        mrp: 0, gstPercent: 12,
        confidence: m.confidence ?? data?.confidence ?? 0.7,
      }));
      const matched = matchInventory(items, medicines);
      traceUpload("15 AI extraction completed", {
        file: "src/components/pharmacy/MobileScanView.tsx",
        component: "ScanTab",
        function: "runAI",
        block: "mapped OCR response to workspace medicines",
        scanId: scan.id,
        itemCount: matched.length,
        confidence: data?.confidence ?? null,
      });
      await onSave({
        stage: "review",
        ai_confidence: data?.confidence ?? null,
        patient_json: {
          name: data?.patient?.name?.value || "",
          mobile: data?.patient?.mobile?.value || "",
          age: data?.patient?.age?.value || "",
          gender: data?.patient?.gender?.value || "",
        },
        doctor_json: {
          name: data?.doctor?.name?.value || "",
          qualification: data?.doctor?.qualification?.value || "",
          registration: data?.doctor?.registration?.value || "",
        },
        items_json: matched as any,
        totals_json: recomputeTotals(matched) as any,
      });
      toast.success("AI extraction complete");
      traceUpload("16 Verification screen opened", {
        file: "src/components/pharmacy/MobileScanView.tsx",
        component: "ScanTab",
        function: "runAI",
        block: "onNext() opens medicines/verification tab",
        scanId: scan.id,
      });
      onNext();
    } catch (e: any) {
      traceFailure("AI pipeline stopped", {
        file: "src/components/pharmacy/MobileScanView.tsx",
        component: "ScanTab",
        function: "runAI",
        block: "download -> base64 -> prescription-scan-ai -> map medicines",
        scanId: scan.id,
        stopReason: "Prescription AI extraction failed; verification screen cannot open.",
      }, e);
      setErr(e?.message || "AI extraction failed");
    }
    finally { setAiBusy(false); }
  }, [scan, onSave, medicines, onNext]);

  return (
    <div className="p-4 space-y-4">
      <div className="text-center pt-4">
        <div className="h-20 w-20 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
          <Camera className="h-10 w-10" />
        </div>
        <h2 className="mt-3 text-lg font-semibold">Capture Prescription</h2>
        <p className="text-xs text-muted-foreground mt-1 px-6">
          Tap a clear photo or upload a saved image. AI will extract patient and medicines.
        </p>
      </div>

      <input ref={camRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => {
        traceUpload("4 onChange fired", {
          file: "src/components/pharmacy/MobileScanView.tsx",
          component: "ScanTab",
          function: "cameraInput.onChange",
          block: "camera file input onChange entry",
          scanId: scan.id,
          filesLength: e.target.files?.length || 0,
          files: Array.from(e.target.files || []).map(fileDebugInfo),
        });
        ingest(e.target.files);
      }} />
      <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => {
        traceUpload("4 onChange fired", {
          file: "src/components/pharmacy/MobileScanView.tsx",
          component: "ScanTab",
          function: "fileInput.onChange",
          block: "gallery/pdf file input onChange entry",
          scanId: scan.id,
          filesLength: e.target.files?.length || 0,
          files: Array.from(e.target.files || []).map(fileDebugInfo),
        });
        ingest(e.target.files);
      }} />

      <div className="grid grid-cols-2 gap-3">
        <Button disabled={busy} onClick={() => {
          traceUpload("2 Camera / Gallery opened", {
            file: "src/components/pharmacy/MobileScanView.tsx",
            component: "ScanTab",
            function: "TakePhotoButton.onClick",
            block: "Take Photo button -> hidden capture input click",
            scanId: scan.id,
            source: "camera",
          });
          camRef.current?.click();
        }} className="h-20 flex-col gap-1 text-base">
          <Camera className="h-6 w-6" /> Take Photo
        </Button>
        <Button disabled={busy} variant="outline" onClick={() => {
          traceUpload("2 Camera / Gallery opened", {
            file: "src/components/pharmacy/MobileScanView.tsx",
            component: "ScanTab",
            function: "UploadButton.onClick",
            block: "Upload button -> hidden gallery/pdf input click",
            scanId: scan.id,
            source: "gallery_or_pdf",
          });
          fileRef.current?.click();
        }} className="h-20 flex-col gap-1 text-base">
          <Upload className="h-6 w-6" /> Upload
        </Button>
      </div>

      {!!scan.source_files.length && (
        <div className="rounded-lg border bg-emerald-50/50 border-emerald-200 px-3 py-2 flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {scan.source_files.length} page{scan.source_files.length > 1 ? "s" : ""} captured
        </div>
      )}

      {err && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{err}
        </div>
      )}

      <Button
        disabled={!scan.source_files.length || aiBusy}
        onClick={runAI}
        className="w-full h-14 text-base gap-2"
      >
        {aiBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
        {aiBusy ? "Reading prescription…" : "Process with AI"}
      </Button>

      {!!scan.items_json?.length && (
        <Button variant="outline" onClick={onNext} className="w-full h-12 gap-2">
          Skip AI · Go to Medicines <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

/* ───────────── Tab 2 · Medicines (one at a time + swipe) ───────────── */
function MedicinesTab({
  scan, onSave,
}: { scan: WorkspaceScan; onSave: (p: Partial<WorkspaceScan>) => Promise<void> }) {
  const items = scan.items_json || [];
  const [idx, setIdx] = useState(0);
  useEffect(() => { if (idx >= items.length) setIdx(Math.max(0, items.length - 1)); }, [items.length, idx]);

  // Touch swipe
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && idx < items.length - 1) setIdx(idx + 1);
      if (dx > 0 && idx > 0) setIdx(idx - 1);
    }
  };

  const update = (patch: Partial<WorkspaceItem>) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onSave({ items_json: next as any, totals_json: recomputeTotals(next, scan.totals_json?.discountPercent || 0) as any });
  };
  const remove = () => {
    const next = items.filter((_, i) => i !== idx);
    onSave({ items_json: next as any, totals_json: recomputeTotals(next, scan.totals_json?.discountPercent || 0) as any });
    setIdx(Math.max(0, idx - 1));
  };

  if (!items.length) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        <Pill className="h-10 w-10 mx-auto mb-2 opacity-40" />
        No medicines yet. Tap <span className="font-semibold text-primary">+</span> to add one or run AI from the Scan tab.
      </div>
    );
  }

  const it = items[idx];
  return (
    <div className="p-4 space-y-3" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Pager */}
      <div className="flex items-center justify-between">
        <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)} className="h-10 w-10">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-sm font-medium">
          Medicine {idx + 1} <span className="text-muted-foreground">of {items.length}</span>
        </div>
        <Button size="icon" variant="ghost" disabled={idx === items.length - 1} onClick={() => setIdx(idx + 1)} className="h-10 w-10">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5">
        {items.map((_, i) => (
          <span key={i} className={cn("h-1.5 rounded-full transition-all", i === idx ? "w-6 bg-primary" : "w-1.5 bg-muted")} />
        ))}
      </div>

      {/* Card */}
      <div className="rounded-2xl border bg-card shadow-sm p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <MatchBadge s={it.matchStatus} />
          {it.confidence !== undefined && (
            <span className="text-[11px] text-muted-foreground">AI {Math.round((it.confidence || 0) * 100)}%</span>
          )}
        </div>

        <div>
          <Label className="text-xs">Medicine</Label>
          <Input value={it.name} onChange={(e) => update({ name: e.target.value })} className="h-12 text-base" placeholder="Name" />
          {it.aiText && it.aiText !== it.name && (
            <div className="text-[11px] text-muted-foreground mt-1">AI read: {it.aiText}</div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Strength</Label>
            <Input value={it.strength || ""} onChange={(e) => update({ strength: e.target.value })} className="h-12 text-base" />
          </div>
          <div>
            <Label className="text-xs">Quantity</Label>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-12 w-12" onClick={() => update({ quantity: Math.max(1, (it.quantity || 1) - 1) })}>−</Button>
              <Input type="number" inputMode="numeric" value={it.quantity} onChange={(e) => update({ quantity: Math.max(1, Number(e.target.value) || 1) })} className="h-12 text-base text-center" />
              <Button size="icon" variant="outline" className="h-12 w-12" onClick={() => update({ quantity: (it.quantity || 1) + 1 })}>+</Button>
            </div>
          </div>
        </div>

        {(it.dosage || it.frequency || it.duration) && (
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs space-y-0.5">
            {it.dosage && <div><span className="text-muted-foreground">Dosage:</span> {it.dosage}</div>}
            {it.frequency && <div><span className="text-muted-foreground">Frequency:</span> {it.frequency}</div>}
            {it.duration && <div><span className="text-muted-foreground">Duration:</span> {it.duration}</div>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">MRP (₹)</Label>
            <Input type="number" inputMode="decimal" value={it.mrp} onChange={(e) => update({ mrp: Number(e.target.value) || 0 })} className="h-12 text-base" />
          </div>
          <div>
            <Label className="text-xs">Stock</Label>
            <div className="h-12 rounded-md border bg-muted/30 flex items-center px-3 text-sm">
              {it.availableStock ?? "—"}
            </div>
          </div>
        </div>

        <Button variant="ghost" onClick={remove} className="w-full text-destructive gap-2">
          <Trash2 className="h-4 w-4" /> Remove medicine
        </Button>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">Swipe left or right to switch medicines</p>
    </div>
  );
}

function MatchBadge({ s }: { s?: WorkspaceItem["matchStatus"] }) {
  const map: Record<string, { cls: string; label: string }> = {
    available: { cls: "bg-emerald-100 text-emerald-700", label: "✓ Available" },
    low: { cls: "bg-amber-100 text-amber-700", label: "⚠ Low stock" },
    out: { cls: "bg-red-100 text-red-700", label: "✗ Out of stock" },
    unmatched: { cls: "bg-slate-200 text-slate-700", label: "Not matched" },
  };
  const v = map[s || "unmatched"];
  return <span className={cn("text-[11px] px-2.5 py-1 rounded-full font-medium", v.cls)}>{v.label}</span>;
}

/* ───────────── Tab 3 · Patient (collapse when verified) ───────────── */
function PatientTab({
  scan, onSave,
}: { scan: WorkspaceScan; onSave: (p: Partial<WorkspaceScan>) => Promise<void> }) {
  const [patient, setPatient] = useState(scan.patient_json);
  const [doctor, setDoctor] = useState(scan.doctor_json);
  const [saleType, setSaleType] = useState<SaleType>(scan.sale_type);
  useEffect(() => { setPatient(scan.patient_json); }, [scan.updated_at]);
  useEffect(() => { setDoctor(scan.doctor_json); }, [scan.updated_at]);
  useEffect(() => { setSaleType(scan.sale_type); }, [scan.updated_at]);

  const patientFilled = !!(patient.name || "").trim();
  const doctorFilled = !!(doctor.name || "").trim();

  const [editPatient, setEditPatient] = useState(!patientFilled);
  const [editDoctor, setEditDoctor] = useState(!doctorFilled);

  const commit = () => onSave({ patient_json: patient, doctor_json: doctor, sale_type: saleType });

  return (
    <div className="p-4 space-y-3">
      {/* Sale type chips */}
      <div>
        <Label className="text-xs">Sale Type</Label>
        <div className="grid grid-cols-3 gap-1.5 mt-1">
          {(["OP Sale", "IP Sale", "Direct Sale", "OP Return", "IP Return"] as SaleType[]).map((t) => (
            <button key={t} onClick={() => { setSaleType(t); onSave({ sale_type: t }); }}
              className={cn(
                "px-2 py-2.5 rounded-lg border text-xs font-medium min-h-[44px]",
                saleType === t ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
              )}>{t}</button>
          ))}
        </div>
      </div>

      {/* Patient card */}
      <CollapsibleCard
        icon={<User className="h-4 w-4" />}
        title="Patient"
        verified={patientFilled && !editPatient}
        subtitle={patientFilled ? `${patient.name}${patient.mobile ? ` · ${patient.mobile}` : ""}` : "Not captured"}
        onEdit={() => setEditPatient(true)}
      >
        {editPatient ? (
          <div className="space-y-2">
            <Field label="Name" value={patient.name || ""} onChange={(v) => setPatient({ ...patient, name: v })} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Mobile" value={patient.mobile || ""} onChange={(v) => setPatient({ ...patient, mobile: v })} inputMode="tel" />
              <Field label="Age" value={String(patient.age || "")} onChange={(v) => setPatient({ ...patient, age: v })} inputMode="numeric" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Gender</Label>
                <Select value={patient.gender || ""} onValueChange={(v) => setPatient({ ...patient, gender: v })}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field label="OP / IP No." value={patient.registrationNumber || ""} onChange={(v) => setPatient({ ...patient, registrationNumber: v })} />
            </div>
            <Button onClick={() => { commit(); setEditPatient(false); }} className="w-full h-11 gap-2">
              <CheckCircle2 className="h-4 w-4" /> Confirm
            </Button>
          </div>
        ) : null}
      </CollapsibleCard>

      {/* Doctor card */}
      <CollapsibleCard
        icon={<User className="h-4 w-4" />}
        title="Doctor"
        verified={doctorFilled && !editDoctor}
        subtitle={doctorFilled ? doctor.name || "" : "Not captured"}
        onEdit={() => setEditDoctor(true)}
      >
        {editDoctor ? (
          <div className="space-y-2">
            <Field label="Doctor name" value={doctor.name || ""} onChange={(v) => setDoctor({ ...doctor, name: v })} />
            <Field label="Registration" value={doctor.registration || ""} onChange={(v) => setDoctor({ ...doctor, registration: v })} />
            <Button onClick={() => { commit(); setEditDoctor(false); }} className="w-full h-11 gap-2">
              <CheckCircle2 className="h-4 w-4" /> Confirm
            </Button>
          </div>
        ) : null}
      </CollapsibleCard>
    </div>
  );
}

function CollapsibleCard({
  icon, title, verified, subtitle, onEdit, children,
}: {
  icon: React.ReactNode; title: string; verified: boolean; subtitle?: string;
  onEdit: () => void; children?: React.ReactNode;
}) {
  return (
    <div className={cn(
      "rounded-2xl border bg-card overflow-hidden",
      verified && "border-emerald-200 bg-emerald-50/40"
    )}>
      <div className="px-4 py-3 flex items-center gap-3">
        <div className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
          verified ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
        )}>
          {verified ? <CheckCircle2 className="h-5 w-5" /> : icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">{title}{verified && <span className="ml-2 text-[10px] uppercase text-emerald-700 font-medium tracking-wide">Verified</span>}</div>
          <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
        </div>
        {verified && (
          <Button size="sm" variant="ghost" onClick={onEdit} className="text-xs">Edit</Button>
        )}
      </div>
      {children && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function Field({
  label, value, onChange, inputMode,
}: { label: string; value: string; onChange: (v: string) => void; inputMode?: any }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} inputMode={inputMode} className="h-11 text-base" />
    </div>
  );
}

/* ───────────── Tab 4 · Review summary ───────────── */
function ReviewTab({
  scan, onSave, onGoto, onProceed,
}: {
  scan: WorkspaceScan; onSave: (p: Partial<WorkspaceScan>) => Promise<void>;
  onGoto: (t: Tab) => void; onProceed: () => void;
}) {
  const items = scan.items_json || [];
  const patientOk = scan.sale_type === "Direct Sale" || !!(scan.patient_json?.name || "").trim();
  const doctorOk = !!(scan.doctor_json?.name || "").trim() || scan.sale_type === "Direct Sale";
  const medsOk = items.length > 0 && items.every((i) => !!(i.name || "").trim() && i.quantity > 0);
  const stockOk = items.length > 0 && items.every((i) => i.matchStatus === "available" || i.matchStatus === "low");
  const readyForBilling = patientOk && medsOk;

  const totals = useMemo(() => recomputeTotals(items, scan.totals_json?.discountPercent || 0), [items, scan.totals_json?.discountPercent]);

  return (
    <div className="p-4 space-y-3">
      <SummaryRow ok={patientOk} title="Patient verified"
        detail={scan.patient_json?.name || (scan.sale_type === "Direct Sale" ? "Direct sale" : "Missing")}
        onTap={() => onGoto("patient")} />
      <SummaryRow ok={doctorOk} title="Doctor verified"
        detail={scan.doctor_json?.name || (scan.sale_type === "Direct Sale" ? "N/A" : "Missing")}
        onTap={() => onGoto("patient")} />
      <SummaryRow ok={medsOk} title="Medicines verified"
        detail={`${items.length} item${items.length !== 1 ? "s" : ""}`}
        onTap={() => onGoto("medicines")} />
      <SummaryRow ok={stockOk} title="Inventory matched"
        detail={stockOk ? "All in stock" : items.some((i) => i.matchStatus === "out") ? "Some out of stock" : "Some unmatched"}
        warn={!stockOk}
        onTap={() => onGoto("medicines")} />
      <SummaryRow ok={readyForBilling} title="Ready for billing"
        detail={`Net ₹${totals.netAmount.toFixed(2)}`}
        onTap={onProceed} />

      <Button
        disabled={!readyForBilling}
        onClick={async () => {
          await onSave({ totals_json: totals as any, verification_status: "verified", stage: "billing" });
          onProceed();
        }}
        className="w-full h-14 text-base gap-2 mt-2"
      >
        <CheckCircle2 className="h-5 w-5" /> Verify & Continue
      </Button>
    </div>
  );
}

function SummaryRow({
  ok, warn, title, detail, onTap,
}: { ok: boolean; warn?: boolean; title: string; detail: string; onTap: () => void }) {
  return (
    <button onClick={onTap} className={cn(
      "w-full text-left rounded-2xl border bg-card px-4 py-3 flex items-center gap-3 active:scale-[0.99] transition-transform",
      ok && !warn && "border-emerald-200 bg-emerald-50/40",
      !ok && "border-amber-200 bg-amber-50/40",
      warn && ok && "border-amber-200 bg-amber-50/40",
    )}>
      <div className={cn(
        "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
        ok && !warn ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
      )}>
        {ok && !warn ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground truncate">{detail}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

/* ───────────── Tab 5 · Finish (billing → payment → audit) ───────────── */
function FinishTab({
  scan, onSave, onCompleted,
}: { scan: WorkspaceScan; onSave: (p: Partial<WorkspaceScan>) => Promise<void>; onCompleted: () => void }) {
  const [discount, setDiscount] = useState(scan.totals_json?.discountPercent || 0);
  const [mode, setMode] = useState<NonNullable<WorkspaceScan["payment_json"]["mode"]>>(
    (scan.payment_json?.mode as any) || "Cash",
  );
  const items = scan.items_json || [];
  const totals = useMemo(() => recomputeTotals(items, discount), [items, discount]);
  const [tendered, setTendered] = useState(scan.payment_json?.amountTendered || totals.netAmount);
  useEffect(() => { setTendered(totals.netAmount); /* eslint-disable-next-line */ }, [totals.netAmount]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const change = Math.max(0, tendered - totals.netAmount);

  const completed = scan.stage === "audit" && !!scan.linked_order_id;

  const finalize = async () => {
    setBusy(true); setErr(null);
    try {
      // Persist billing + payment, then create sale
      const issueType = scan.sale_type;
      const order = {
        patient_name: scan.patient_json?.name || "",
        registration_number: scan.patient_json?.registrationNumber || "",
        customer_name: scan.patient_json?.name || "",
        customer_mobile: scan.patient_json?.mobile || "",
        sale_channel: scan.sale_type === "Direct Sale" ? "Direct" : "Patient",
        doctor_name: scan.doctor_json?.name || "",
        issue_type: issueType,
        issue_date: new Date().toISOString().split("T")[0],
        age: Number(scan.patient_json?.age) || null,
        gender: scan.patient_json?.gender || "",
        mobile: scan.patient_json?.mobile || "",
        total_amount: totals.subtotal,
        discount: totals.discountAmount,
        gst_amount: totals.gstAmount,
        net_amount: totals.netAmount,
        payment_mode: mode,
        status: "Completed",
      };
      const lineItems = items.map((i) => ({
        medicine_id: i.medicineId || null,
        medicine_name: i.name,
        batch_no: i.batchNo || "",
        quantity: i.quantity,
        mrp: i.mrp || 0,
        discount: i.discount || 0,
        gst_percent: i.gstPercent || 12,
        amount: (i.mrp || 0) * i.quantity,
      }));
      const created: any = await pharmacyService.completeSale(order as any, lineItems as any);
      await onSave({
        totals_json: totals as any,
        payment_json: { mode, amountTendered: tendered, change, invoiceNo: created?.invoice_no } as any,
        billing_status: "paid",
        stage: "audit",
        linked_order_id: created?.id || null,
      });
      toast.success("Sale recorded · stock updated");
    } catch (e: any) { setErr(e?.message || "Failed to record sale"); }
    finally { setBusy(false); }
  };

  if (completed) {
    return (
      <div className="p-4 space-y-3">
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center">
          <div className="h-14 w-14 mx-auto rounded-full bg-emerald-500 text-white flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="mt-2 text-base font-semibold text-emerald-900">Dispensed</div>
          <div className="text-xs text-emerald-800 mt-1">Invoice {scan.payment_json?.invoiceNo || scan.linked_order_id?.slice(0, 8)}</div>
          <div className="text-2xl font-bold mt-3 text-emerald-900">₹{(scan.totals_json?.netAmount || 0).toFixed(2)}</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => window.print()} className="h-12 gap-2"><Printer className="h-4 w-4" /> Receipt</Button>
          <Button onClick={async () => { await workspaceService.complete(scan.id); onCompleted(); }} className="h-12 gap-2">
            <CheckCircle2 className="h-4 w-4" /> Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Totals */}
      <div className="rounded-2xl border bg-card p-4 space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{totals.subtotal.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>₹{totals.gstAmount.toFixed(2)}</span></div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Discount %</span>
          <Input type="number" min={0} max={100} value={discount}
            onChange={(e) => setDiscount(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            className="h-9 w-24 text-right" />
        </div>
        <div className="flex justify-between pt-2 border-t">
          <span className="font-semibold">Net Payable</span>
          <span className="text-xl font-bold text-primary">₹{totals.netAmount.toFixed(2)}</span>
        </div>
      </div>

      {/* Payment mode */}
      <div>
        <Label className="text-xs">Payment Mode</Label>
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {(["Cash", "UPI", "Card", "Credit"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={cn("py-3 rounded-lg border text-xs font-medium min-h-[48px]",
                mode === m ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border")}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {mode === "Cash" && (
        <div className="rounded-2xl border bg-card p-4 space-y-2">
          <Label className="text-xs">Amount Tendered</Label>
          <Input type="number" inputMode="decimal" value={tendered} onChange={(e) => setTendered(Number(e.target.value) || 0)} className="h-12 text-base" />
          <div className="flex justify-between text-sm"><span>Change</span><span className="font-semibold">₹{change.toFixed(2)}</span></div>
        </div>
      )}

      {err && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{err}
        </div>
      )}

      <Button
        disabled={busy || (mode === "Cash" && tendered < totals.netAmount)}
        onClick={finalize}
        className="w-full h-14 text-base gap-2"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
        {busy ? "Recording sale…" : `Confirm & Dispense · ₹${totals.netAmount.toFixed(2)}`}
      </Button>
    </div>
  );
}