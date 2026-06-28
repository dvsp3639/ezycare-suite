/* ──────────────────────────────────────────────────────────────────────
 * PharmacyWorkspace — realtime synced scan-to-bill pipeline
 *
 * Responsive: mobile = full-screen sheet per scan, desktop = two-pane.
 * Every state change persists to Supabase; both devices stay in sync.
 * ────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import {
  ScanLine, Sparkles, Loader2, ChevronLeft, Plus, Trash2, X,
  CheckCircle2, Pill, ShoppingCart, CreditCard, FileText, Smartphone,
  Monitor, Camera, Upload, Printer, Package, AlertTriangle,
  PanelLeftClose, PanelLeftOpen, Maximize2, Minimize2,
  ZoomIn, ZoomOut, RotateCw, ChevronRight, Image as ImageIcon,
  MoreVertical, Search, Replace, Eye, Layers, Edit3, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useMedicines } from "@/modules/pharmacy/hooks";
import { pharmacyService } from "@/modules/pharmacy/services";
import { supabase } from "@/integrations/supabase/client";
import {
  workspaceService, matchInventory, recomputeTotals,
  useWorkspaceQueue, useWorkspaceScan,
  STAGE_LABEL, STAGE_ORDER,
  type WorkspaceScan, type WorkspaceItem, type WorkspaceStage, type SaleType,
} from "@/modules/pharmacy/workspace";
import { batchesFor } from "@/modules/pharmacy/workspace";
import { canvasToBlob, enhance, fileToImage, imageToCanvas, blobToBase64 } from "@/lib/docScan";
import type { Medicine } from "@/modules/pharmacy/types";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileScanView from "@/components/pharmacy/MobileScanView";

function MobileScanViewWrapper({
  scanId, onBack, onCompleted,
}: { scanId: string; onBack: () => void; onCompleted: () => void }) {
  const { user } = useAuth();
  const { scan, loading } = useWorkspaceScan(scanId);
  const { data: medicines = [] } = useMedicines();
  const save = useCallback(async (patch: Partial<WorkspaceScan>) => {
    try { await workspaceService.updateScan(scanId, patch); }
    catch (e: any) { toast.error(e?.message || "Sync failed"); }
  }, [scanId]);
  if (loading) return <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline mr-1" /> Loading…</div>;
  if (!scan || !user) return <div className="p-8 text-center text-sm text-muted-foreground">Scan not found.</div>;
  return (
    <MobileScanView
      scan={scan}
      userId={user.id}
      medicines={medicines as any}
      onBack={onBack}
      onCompleted={onCompleted}
      onSave={save}
    />
  );
}

/* ───────────────────── Stage helpers ───────────────────── */
const STAGE_INDEX = Object.fromEntries(STAGE_ORDER.map((s, i) => [s, i])) as Record<WorkspaceStage, number>;

function stagePct(s: WorkspaceStage) {
  return Math.round(((STAGE_INDEX[s] + 1) / STAGE_ORDER.length) * 100);
}

function StageBadge({ stage }: { stage: WorkspaceStage }) {
  const colors: Record<WorkspaceStage, string> = {
    scan: "bg-slate-100 text-slate-700",
    ai_extraction: "bg-blue-100 text-blue-700",
    inventory_match: "bg-indigo-100 text-indigo-700",
    review: "bg-amber-100 text-amber-700",
    billing: "bg-purple-100 text-purple-700",
    payment: "bg-orange-100 text-orange-700",
    deducted: "bg-teal-100 text-teal-700",
    audit: "bg-emerald-100 text-emerald-700",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", colors[stage])}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

/* ═════════════════════ Workspace shell ═════════════════════ */
export default function PharmacyWorkspace() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const userId = user?.id;
  const { scans, loading } = useWorkspaceQueue(userId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Toast on new mobile scan arriving on desktop
  const knownIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    scans.forEach((s) => {
      if (!knownIds.current.has(s.id)) {
        if (knownIds.current.size > 0 && !isMobile) {
          toast.success(`📱 New prescription synced — ${s.patient_json?.name || "Unknown"}`);
        }
        knownIds.current.add(s.id);
      }
    });
  }, [scans, isMobile]);

  const startNew = useCallback(async () => {
    if (!userId) return;
    const created = await workspaceService.createScan(userId);
    setActiveId(created.id);
  }, [userId]);

  if (!userId) return null;

  /* ── Mobile: list OR detail ── */
  if (isMobile) {
    if (activeId) {
      return (
        <MobileScanViewWrapper
          scanId={activeId}
          onBack={() => setActiveId(null)}
          onCompleted={() => setActiveId(null)}
        />
      );
    }
    return (
      <div className="p-4 pb-24">
        <Header />
        <Button onClick={startNew} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 h-14 px-8 rounded-full shadow-xl gap-2">
          <ScanLine className="h-5 w-5" /> Scan Prescription
        </Button>
        <Queue scans={scans} loading={loading} onOpen={setActiveId} compact />
      </div>
    );
  }

  /* ── Desktop: two-pane ── */
  /* ── Desktop: 3-column workspace (Queue | Preview | Editor) ── */
  const showPreview = !!activeId;
  const cols = !activeId
    ? "grid-cols-[300px_1fr]"
    : queueCollapsed
      ? "grid-cols-[44px_1.1fr_minmax(440px,0.9fr)]"
      : "grid-cols-[minmax(240px,1fr)_2fr_minmax(420px,1fr)]";
  return (
    <div
      className={cn(
        "grid gap-3 p-3 transition-all",
        cols,
        fullscreen
          ? "fixed inset-0 z-50 bg-background h-screen"
          : "h-[calc(100vh-9rem)]",
      )}
    >
      {/* Queue column */}
      <div className="border rounded-xl bg-card flex flex-col overflow-hidden">
        {queueCollapsed ? (
          <button
            onClick={() => setQueueCollapsed(false)}
            className="h-full w-full flex flex-col items-center gap-2 pt-3 text-xs text-muted-foreground hover:bg-accent/40"
            title="Expand queue"
          >
            <PanelLeftOpen className="h-4 w-4" />
            <span className="[writing-mode:vertical-rl] rotate-180 mt-1">Live Queue · {scans.length}</span>
          </button>
        ) : (
          <>
            <div className="p-3 border-b flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <Monitor className="h-3.5 w-3.5" /> Live Queue
                  <Badge variant="outline" className="text-[10px] ml-1">{scans.length}</Badge>
                </p>
                <p className="text-[11px] text-muted-foreground truncate">Synced across your devices</p>
              </div>
              <div className="flex items-center gap-1">
                <Button onClick={startNew} size="sm" className="gap-1 h-8">
                  <Plus className="h-3.5 w-3.5" /> New
                </Button>
                {activeId && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setQueueCollapsed(true)}
                    title="Collapse"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <Queue scans={scans} loading={loading} onOpen={setActiveId} activeId={activeId} />
            </div>
          </>
        )}
      </div>

      {/* Center: Prescription preview (only when scan active) */}
      {showPreview && (
        <div className="border rounded-xl bg-card overflow-hidden flex flex-col">
          <PrescriptionPreview
            scanId={activeId!}
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen((f) => !f)}
          />
        </div>
      )}

      {/* Right: Editor / stage view */}
      <div className="border rounded-xl bg-card overflow-hidden">
        {activeId ? (
          <WorkspaceScanView
            scanId={activeId}
            onBack={() => setActiveId(null)}
            onCompleted={() => { setActiveId(null); setFullscreen(false); }}
          />
        ) : (
          <EmptyDetail onStart={startNew} />
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <ScanLine className="h-4 w-4 text-primary" /> Pharmacy Workspace
        <Sparkles className="h-3.5 w-3.5 text-primary" />
      </h2>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Smartphone className="h-3 w-3" /> ↔ <Monitor className="h-3 w-3" /> Same account, both devices sync in real time
      </p>
    </div>
  );
}

function EmptyDetail({ onStart }: { onStart: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
      <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
        <ScanLine className="h-8 w-8" />
      </div>
      <p className="font-medium text-foreground">No scan selected</p>
      <p className="text-xs mt-1 max-w-xs">Open a queued scan from the left, or start a new prescription. Anything scanned on mobile appears here live.</p>
      <Button onClick={onStart} className="mt-4 gap-2"><Plus className="h-4 w-4" /> New Prescription</Button>
    </div>
  );
}

/* ═════════════════════ Prescription Preview Pane ═════════════════════ */
function PrescriptionPreview({
  scanId, fullscreen, onToggleFullscreen,
}: { scanId: string; fullscreen: boolean; onToggleFullscreen: () => void }) {
  const { scan } = useWorkspaceScan(scanId);
  const pages = scan?.source_files || [];
  const [pageIdx, setPageIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [enhanced, setEnhanced] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setPageIdx(0); setZoom(1); setRotation(0); }, [scanId]);

  useEffect(() => {
    let cancelled = false;
    const p = pages[pageIdx];
    if (!p) { setUrl(null); return; }
    setLoading(true);
    workspaceService.signedUrl(p, 3600).then((u) => {
      if (!cancelled) { setUrl(u); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pages, pageIdx]);

  const hasPages = pages.length > 0;

  return (
    <>
      <div className="p-2 border-b flex items-center gap-1 flex-wrap bg-card">
        <span className="text-xs font-semibold flex items-center gap-1.5 px-1">
          <ImageIcon className="h-3.5 w-3.5" /> Prescription
        </span>
        {hasPages && (
          <div className="flex items-center gap-0.5 ml-2">
            <Button size="icon" variant="ghost" className="h-7 w-7"
              disabled={pageIdx === 0}
              onClick={() => setPageIdx((i) => Math.max(0, i - 1))}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[11px] tabular-nums text-muted-foreground px-1">
              {pageIdx + 1} / {pages.length}
            </span>
            <Button size="icon" variant="ghost" className="h-7 w-7"
              disabled={pageIdx >= pages.length - 1}
              onClick={() => setPageIdx((i) => Math.min(pages.length - 1, i + 1))}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        <div className="flex-1" />
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Zoom out"
          onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.2).toFixed(2)))}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-[11px] tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Zoom in"
          onClick={() => setZoom((z) => Math.min(4, +(z + 0.2).toFixed(2)))}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Rotate"
          onClick={() => setRotation((r) => (r + 90) % 360)}>
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm" variant={enhanced ? "default" : "ghost"}
          className="h-7 px-2 text-[11px]"
          onClick={() => setEnhanced((e) => !e)}
          title="Toggle contrast enhancement"
        >
          Enhance
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7"
          onClick={onToggleFullscreen}
          title={fullscreen ? "Exit full screen" : "Full screen review"}>
          {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <div className="flex-1 overflow-auto bg-muted/30 flex items-start justify-center p-3">
        {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-10" />}
        {!loading && !hasPages && (
          <div className="text-xs text-muted-foreground mt-10 text-center">
            No prescription image yet.<br />Capture from the Scan stage.
          </div>
        )}
        {!loading && url && (
          <img
            src={url}
            alt={`Prescription page ${pageIdx + 1}`}
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: "top center",
              filter: enhanced ? "contrast(1.35) brightness(1.05) saturate(0.9)" : undefined,
            }}
            className="max-w-full select-none shadow-sm rounded transition-transform"
            draggable={false}
          />
        )}
      </div>
    </>
  );
}

/* ═════════════════════ Queue ═════════════════════ */
function Queue({
  scans, loading, onOpen, compact, activeId,
}: {
  scans: WorkspaceScan[]; loading: boolean; onOpen: (id: string) => void;
  compact?: boolean; activeId?: string | null;
}) {
  if (loading) {
    return <div className="p-6 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Loading…</div>;
  }
  if (!scans.length) {
    return (
      <div className="p-6 text-center">
        <div className="text-sm text-muted-foreground">Queue is empty.</div>
        <div className="text-xs text-muted-foreground mt-1">Scan a prescription to begin.</div>
      </div>
    );
  }
  return (
    <div className={cn("divide-y", compact && "border rounded-xl bg-card mt-4")}>
      {scans.map((s) => (
        <QueueRow key={s.id} scan={s} active={s.id === activeId} onClick={() => onOpen(s.id)} />
      ))}
    </div>
  );
}

function QueueRow({ scan, active, onClick }: { scan: WorkspaceScan; active?: boolean; onClick: () => void }) {
  const itemCount = scan.items_json?.length || 0;
  const conf = scan.ai_confidence ? Math.round(scan.ai_confidence * 100) : null;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 hover:bg-accent/40 transition-colors flex flex-col gap-1.5",
        active && "bg-accent/60",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm truncate">
          {scan.patient_json?.name || <span className="text-muted-foreground italic">No patient yet</span>}
        </span>
        <StageBadge stage={scan.stage} />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })}</span>
        <span className="flex items-center gap-2">
          {conf !== null && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">AI {conf}%</span>}
          <span className="px-1.5 py-0.5 rounded bg-slate-100">{itemCount} med</span>
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className={cn(
          "px-1.5 py-0.5 rounded",
          scan.verification_status === "verified" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
        )}>
          {scan.verification_status === "verified" ? "✓ Verified" : "Unverified"}
        </span>
        <span className={cn(
          "px-1.5 py-0.5 rounded",
          scan.billing_status === "paid" ? "bg-emerald-50 text-emerald-700" :
          scan.billing_status === "billed" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600",
        )}>
          {scan.billing_status === "paid" ? "💰 Paid" : scan.billing_status === "billed" ? "📋 Billed" : "Unbilled"}
        </span>
      </div>
    </button>
  );
}

/* ═════════════════════ Scan detail ═════════════════════ */
function WorkspaceScanView({
  scanId, onBack, onCompleted, isMobile,
}: { scanId: string; onBack: () => void; onCompleted: () => void; isMobile?: boolean }) {
  const { user } = useAuth();
  const { scan, loading } = useWorkspaceScan(scanId);
  const { data: medicines = [] } = useMedicines();

  // Optimistic local patch shadow (merged with realtime scan)
  const [savingField, setSavingField] = useState<string | null>(null);
  const save = useCallback(async (patch: Partial<WorkspaceScan>) => {
    setSavingField("any");
    try {
      await workspaceService.updateScan(scanId, patch);
    } catch (e: any) {
      toast.error(e?.message || "Sync failed");
    } finally {
      setSavingField(null);
    }
  }, [scanId]);

  if (loading) {
    return <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline mr-1" /> Loading…</div>;
  }
  if (!scan) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Scan not found.</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b flex items-center gap-2 bg-card sticky top-0 z-10">
        <Button size="icon" variant="ghost" onClick={onBack}><ChevronLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate flex items-center gap-2">
            {scan.patient_json?.name || "New prescription"}
            <StageBadge stage={scan.stage} />
            {savingField && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <Progress value={stagePct(scan.stage)} className="h-1 mt-1" />
        </div>
        <CancelButton scan={scan} onCancelled={onBack} />
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Stage stepper (desktop only) */}
        {!isMobile && <StageStepper scan={scan} onJump={(s) => save({ stage: s })} />}

        {scan.stage === "scan" && <ScanStage scan={scan} userId={user!.id} onAdvance={(patch) => save(patch)} />}
        {scan.stage === "ai_extraction" && <AIExtractionStage scan={scan} onAdvance={save} medicines={medicines as any} />}
        {scan.stage === "inventory_match" && <InventoryMatchStage scan={scan} onAdvance={save} medicines={medicines as any} />}
        {scan.stage === "review" && <ReviewStage scan={scan} onSave={save} medicines={medicines as any} />}
        {scan.stage === "billing" && <BillingStage scan={scan} onSave={save} />}
        {scan.stage === "payment" && <PaymentStage scan={scan} onSave={save} />}
        {scan.stage === "deducted" && <DeductionStage scan={scan} onSave={save} />}
        {scan.stage === "audit" && <AuditStage scan={scan} onDone={async () => { await workspaceService.complete(scanId); onCompleted(); }} />}
      </div>
    </div>
  );
}

function CancelButton({ scan, onCancelled }: { scan: WorkspaceScan; onCancelled: () => void }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={async () => {
        if (!confirm("Cancel this scan? It will be removed from the queue.")) return;
        await workspaceService.cancel(scan.id);
        toast.message("Scan cancelled");
        onCancelled();
      }}
      className="text-destructive hover:text-destructive"
    >
      <X className="h-4 w-4" />
    </Button>
  );
}

function StageStepper({ scan, onJump }: { scan: WorkspaceScan; onJump: (s: WorkspaceStage) => void }) {
  const curIdx = STAGE_INDEX[scan.stage];
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {STAGE_ORDER.map((s, i) => {
        const done = i < curIdx;
        const current = i === curIdx;
        return (
          <button
            key={s}
            disabled={i > curIdx}
            onClick={() => onJump(s)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap transition-colors",
              current && "bg-primary text-primary-foreground font-medium",
              done && "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
              !done && !current && "bg-muted text-muted-foreground",
            )}
          >
            <span className="h-4 w-4 rounded-full bg-background/40 flex items-center justify-center text-[10px]">
              {done ? "✓" : i + 1}
            </span>
            {STAGE_LABEL[s]}
          </button>
        );
      })}
    </div>
  );
}

/* ═════════════════════ Stage 1 · Scan ═════════════════════ */
function ScanStage({
  scan, userId, onAdvance,
}: { scan: WorkspaceScan; userId: string; onAdvance: (p: Partial<WorkspaceScan>) => Promise<void> }) {
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function ingest(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      const paths: string[] = [...scan.source_files];
      let i = paths.length;
      for (const f of Array.from(files)) {
        let blob: Blob = f;
        if (f.type.startsWith("image/")) {
          const img = await fileToImage(f);
          const c = imageToCanvas(img, 1800);
          enhance(c);
          blob = await canvasToBlob(c, "image/jpeg", 0.85);
        }
        const path = await workspaceService.uploadPage(scan.id, userId, blob, i++);
        paths.push(path);
      }
      await onAdvance({ source_files: paths as any, page_count: paths.length });
      toast.success(`${files.length} page(s) added`);
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Camera className="h-4 w-4" /> Capture Prescription</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input ref={camRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => ingest(e.target.files)} />
          <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => ingest(e.target.files)} />
          <Button variant="outline" disabled={busy} onClick={() => camRef.current?.click()} className="h-20 flex-col gap-1">
            <Camera className="h-5 w-5" /><span className="text-xs">Take Photo</span>
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()} className="h-20 flex-col gap-1">
            <Upload className="h-5 w-5" /><span className="text-xs">Upload</span>
          </Button>
        </div>
        {!!scan.source_files.length && (
          <div className="text-xs text-muted-foreground">{scan.source_files.length} page(s) captured.</div>
        )}
        <Button
          disabled={!scan.source_files.length || busy}
          onClick={() => onAdvance({ stage: "ai_extraction" })}
          className="w-full gap-2"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Process with AI →
        </Button>
      </CardContent>
    </Card>
  );
}

/* ═════════════════════ Stage 2 · AI Extraction ═════════════════════ */
function AIExtractionStage({
  scan, onAdvance, medicines,
}: { scan: WorkspaceScan; onAdvance: (p: Partial<WorkspaceScan>) => Promise<void>; medicines: Medicine[] }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async () => {
    setBusy(true); setErr(null);
    try {
      const path = scan.source_files[0];
      if (!path) throw new Error("No scanned page to process");
      const { data: blob, error } = await supabase.storage.from("prescriptions").download(path);
      if (error || !blob) throw error || new Error("Failed to load page");
      const b64 = await blobToBase64(blob);
      const { data, error: fnErr } = await supabase.functions.invoke("prescription-scan-ai", {
        body: { fileBase64: b64, mimeType: blob.type || "image/jpeg" },
      });
      if (fnErr) throw fnErr;
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
      await onAdvance({
        stage: "inventory_match",
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
    } catch (e: any) {
      setErr(e?.message || "AI extraction failed");
    } finally { setBusy(false); }
  }, [scan, onAdvance, medicines]);

  useEffect(() => {
    // Auto-run if just entered this stage with no items yet
    if (!scan.items_json?.length && !busy && !err) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI Extraction</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {busy && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
            Reading prescription… AI is identifying patient, doctor, and medicines.
          </div>
        )}
        {err && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {err}
            <Button size="sm" variant="outline" onClick={run} className="ml-2">Retry</Button>
          </div>
        )}
        {!busy && !err && (
          <Button onClick={run} className="w-full gap-2"><Sparkles className="h-4 w-4" /> Run AI Extraction</Button>
        )}
      </CardContent>
    </Card>
  );
}

/* ═════════════════════ Stage 3 · Inventory Match ═════════════════════ */
function InventoryMatchStage({
  scan, onAdvance, medicines,
}: { scan: WorkspaceScan; onAdvance: (p: Partial<WorkspaceScan>) => Promise<void>; medicines: Medicine[] }) {
  const items = scan.items_json || [];
  const counts = useMemo(() => ({
    available: items.filter((i) => i.matchStatus === "available").length,
    low: items.filter((i) => i.matchStatus === "low").length,
    out: items.filter((i) => i.matchStatus === "out").length,
    unmatched: items.filter((i) => i.matchStatus === "unmatched").length,
  }), [items]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Inventory Match</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="p-2 rounded bg-emerald-50 text-emerald-700"><div className="text-base font-semibold">{counts.available}</div>Available</div>
          <div className="p-2 rounded bg-amber-50 text-amber-700"><div className="text-base font-semibold">{counts.low}</div>Low</div>
          <div className="p-2 rounded bg-red-50 text-red-700"><div className="text-base font-semibold">{counts.out}</div>Out</div>
          <div className="p-2 rounded bg-slate-100 text-slate-700"><div className="text-base font-semibold">{counts.unmatched}</div>Unmatched</div>
        </div>
        <div className="border rounded-lg divide-y max-h-72 overflow-auto">
          {items.map((it, idx) => (
            <div key={idx} className="p-2 flex items-center justify-between text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{it.name} {it.strength && <span className="text-muted-foreground">· {it.strength}</span>}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  Qty {it.quantity} · {it.matchStatus === "unmatched" ? "Not in stock catalog" : `Stock: ${it.availableStock ?? 0}`}
                </div>
              </div>
              <MatchPill s={it.matchStatus} />
            </div>
          ))}
          {!items.length && <div className="p-4 text-xs text-muted-foreground text-center">No medicines extracted.</div>}
        </div>
        <Button
          onClick={() => onAdvance({
            stage: "review",
            items_json: matchInventory(items, medicines) as any,
          })}
          className="w-full gap-2"
        >
          Continue to Review →
        </Button>
      </CardContent>
    </Card>
  );
}

function MatchPill({ s }: { s?: WorkspaceItem["matchStatus"] }) {
  const map: Record<string, string> = {
    available: "bg-emerald-100 text-emerald-700",
    low: "bg-amber-100 text-amber-700",
    out: "bg-red-100 text-red-700",
    unmatched: "bg-slate-200 text-slate-700",
  };
  return <span className={cn("text-[10px] px-2 py-0.5 rounded-full", map[s || "unmatched"])}>{s || "unmatched"}</span>;
}

/* ═════════════════════ Stage 4 · Review ═════════════════════ */
function ReviewStage({
  scan, onSave, medicines,
}: { scan: WorkspaceScan; onSave: (p: Partial<WorkspaceScan>) => Promise<void>; medicines: Medicine[] }) {
  const [patient, setPatient] = useState(scan.patient_json);
  const [doctor, setDoctor] = useState(scan.doctor_json);
  const [items, setItems] = useState<WorkspaceItem[]>(scan.items_json || []);
  const [saleType, setSaleType] = useState<SaleType>(scan.sale_type);

  // Reflect remote edits into local state when remote updated_at changes
  useEffect(() => { setPatient(scan.patient_json); }, [scan.updated_at]);
  useEffect(() => { setDoctor(scan.doctor_json); }, [scan.updated_at]);
  useEffect(() => { setItems(scan.items_json || []); }, [scan.updated_at]);
  useEffect(() => { setSaleType(scan.sale_type); }, [scan.updated_at]);

  const updateItem = (i: number, patch: Partial<WorkspaceItem>) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    setItems(next);
  };
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const replaceItem = (i: number, next: WorkspaceItem) =>
    setItems(items.map((it, idx) => (idx === i ? next : it)));
  const appendItem = (next: WorkspaceItem) => setItems([...items, next]);

  // UI state for new safe workflows
  const [picker, setPicker] = useState<{ open: boolean; mode: "add" | "replace"; index?: number; seedName?: string }>({ open: false, mode: "add" });
  const [removeIdx, setRemoveIdx] = useState<number | null>(null);
  const [inspect, setInspect] = useState<{ kind: "inventory" | "alternatives" | "batches"; item: WorkspaceItem } | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);

  // Append an audit entry into notes (lightweight, no migration)
  const appendAudit = (action: string, detail: string) => {
    const stamp = format(new Date(), "dd/MM/yyyy HH:mm");
    const line = `[${stamp}] ${action} — ${detail}`;
    const prev = scan.notes ? `${scan.notes}\n` : "";
    return prev + line;
  };

  const commit = async (next?: Partial<WorkspaceScan>) => {
    await onSave({
      patient_json: patient,
      doctor_json: doctor,
      items_json: items as any,
      sale_type: saleType,
      totals_json: recomputeTotals(items, scan.totals_json?.discountPercent || 0) as any,
      ...next,
    });
  };

  const proceed = async () => {
    if (saleType !== "Direct Sale" && !(patient.name || "").trim()) {
      toast.error("Patient name required");
      return;
    }
    if (!items.length) {
      toast.error("Add at least one medicine");
      return;
    }
    // Quantity / availability guard — block billing on errors
    const blockers = items.filter(
      (it) => it.matchStatus === "unmatched" || it.matchStatus === "out" ||
              (it.availableStock !== undefined && it.quantity > (it.availableStock || 0)),
    );
    if (blockers.length) {
      toast.error(`${blockers.length} medicine(s) need attention before billing`);
      return;
    }
    setVerifyOpen(true);
  };

  const confirmAndBill = async () => {
    setVerifyOpen(false);
    await commit({
      stage: "billing",
      verification_status: "verified",
      notes: appendAudit("Verified", `${items.length} medicine(s) confirmed for billing`) as any,
    });
  };

  const missing = (v?: string) => !v || !v.trim();

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Sale Type</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {(["OP Sale", "IP Sale", "Direct Sale", "OP Return", "IP Return"] as SaleType[]).map((t) => (
              <button
                key={t}
                onClick={() => setSaleType(t)}
                className={cn(
                  "px-2 py-2 rounded-lg border text-xs font-medium transition-colors",
                  saleType === t ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/40",
                )}
              >{t}</button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Patient & Doctor</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Patient Name {saleType !== "Direct Sale" && <span className="text-destructive">*</span>}</Label>
            <Input value={patient.name || ""} onChange={(e) => setPatient({ ...patient, name: e.target.value })}
              className={cn(missing(patient.name) && saleType !== "Direct Sale" && "border-amber-400 bg-amber-50/50")} />
          </div>
          <div>
            <Label className="text-xs">Mobile</Label>
            <Input value={patient.mobile || ""} onChange={(e) => setPatient({ ...patient, mobile: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Age</Label>
            <Input value={String(patient.age || "")} onChange={(e) => setPatient({ ...patient, age: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Gender</Label>
            <Select value={patient.gender || ""} onValueChange={(v) => setPatient({ ...patient, gender: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Doctor</Label>
            <Input value={doctor.name || ""} onChange={(e) => setDoctor({ ...doctor, name: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">OP / IP No.</Label>
            <Input value={patient.registrationNumber || ""} onChange={(e) => setPatient({ ...patient, registrationNumber: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Medicines ({items.length})</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPicker({ open: true, mode: "add" })}
            className="gap-1"
          >
            <Plus className="h-3 w-3" /> Add Medicine
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="border rounded-lg p-2 grid grid-cols-12 gap-2 items-center">
              <div className="col-span-12 md:col-span-4">
                <Input value={it.name} onChange={(e) => updateItem(i, { name: e.target.value })} placeholder="Medicine name" />
                {it.aiText && it.aiText !== it.name && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">AI: {it.aiText}</div>
                )}
              </div>
              <div className="col-span-4 md:col-span-2">
                <Input value={it.strength || ""} onChange={(e) => updateItem(i, { strength: e.target.value })} placeholder="Strength" />
              </div>
              <div className="col-span-3 md:col-span-1">
                <Input type="number" min={1} value={it.quantity}
                  onChange={(e) => updateItem(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                  className={cn(
                    it.availableStock !== undefined && it.quantity > (it.availableStock || 0) &&
                      "border-destructive bg-destructive/5",
                  )} />
              </div>
              <div className="col-span-3 md:col-span-2">
                <Input type="number" min={0} step="0.01" value={it.mrp}
                  onChange={(e) => updateItem(i, { mrp: Number(e.target.value) || 0 })} placeholder="MRP" />
              </div>
              <div className="col-span-2 md:col-span-2 flex items-center gap-1 flex-wrap">
                <MatchPill s={it.matchStatus} />
                {it.confidence !== undefined && <span className="text-[10px] text-muted-foreground">{Math.round((it.confidence || 0) * 100)}%</span>}
                {it.availableStock !== undefined && it.quantity > (it.availableStock || 0) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                    Need {it.quantity}, have {it.availableStock}
                  </span>
                )}
              </div>
              <div className="col-span-12 md:col-span-1 flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="More actions">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel className="text-xs">{it.name || "Medicine"}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setPicker({ open: true, mode: "replace", index: i, seedName: it.name })}>
                      <Replace className="h-3.5 w-3.5 mr-2" /> Replace Medicine
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setInspect({ kind: "inventory", item: it })}>
                      <Eye className="h-3.5 w-3.5 mr-2" /> View Inventory
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setInspect({ kind: "alternatives", item: it })}>
                      <Layers className="h-3.5 w-3.5 mr-2" /> View Alternatives
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setInspect({ kind: "batches", item: it })}>
                      <Package className="h-3.5 w-3.5 mr-2" /> View Batch Details
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setRemoveIdx(i)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Remove Medicine…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
          {!items.length && <div className="text-xs text-muted-foreground text-center p-3">No medicines yet.</div>}
        </CardContent>
      </Card>

      <div className="flex gap-2 sticky bottom-0 bg-background/80 backdrop-blur p-2 -mx-4 border-t">
        <Button variant="outline" onClick={() => commit()} className="flex-1">Save Draft</Button>
        <Button onClick={proceed} className="flex-1 gap-2"><CheckCircle2 className="h-4 w-4" /> Verify & Bill →</Button>
      </div>

      {/* Guided medicine picker (search → batch → qty → review) */}
      <MedicinePickerDialog
        open={picker.open}
        mode={picker.mode}
        seedName={picker.seedName}
        medicines={medicines}
        onClose={() => setPicker({ open: false, mode: "add" })}
        onConfirm={(next) => {
          if (picker.mode === "replace" && picker.index !== undefined) {
            const prev = items[picker.index];
            replaceItem(picker.index, next);
            commit({ notes: appendAudit("Replaced", `${prev?.name || "—"} → ${next.name} × ${next.quantity}`) as any });
          } else {
            appendItem(next);
            commit({ notes: appendAudit("Added", `${next.name} × ${next.quantity} (batch ${next.batchNo || "—"})`) as any });
          }
          setPicker({ open: false, mode: "add" });
        }}
      />

      {/* Confirm remove */}
      <AlertDialog open={removeIdx !== null} onOpenChange={(o) => !o && setRemoveIdx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this medicine?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeIdx !== null && (
                <>This will remove <strong>{items[removeIdx]?.name || "the line"}</strong> from the prescription. You can re-add it from the inventory.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (removeIdx !== null) {
                  const target = items[removeIdx];
                  removeItem(removeIdx);
                  commit({ notes: appendAudit("Removed", `${target?.name || "—"} × ${target?.quantity || 0}`) as any });
                }
                setRemoveIdx(null);
              }}
            >Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Inventory / alternatives / batches inspector */}
      <InspectDialog
        info={inspect}
        medicines={medicines}
        onClose={() => setInspect(null)}
        onReplace={(med) => {
          if (!inspect) return;
          const idx = items.findIndex((x) => x === inspect.item);
          if (idx >= 0) {
            const next: WorkspaceItem = {
              ...inspect.item,
              name: med.name,
              strength: med.strength || inspect.item.strength,
              medicineId: med.id,
              medicineName: med.name,
              batchNo: med.batchNo || "",
              mrp: med.mrp || 0,
              gstPercent: med.gstPercent ?? 12,
              availableStock: med.stock || 0,
              matchStatus: (med.stock || 0) <= 0 ? "out" : (med.stock || 0) < (inspect.item.quantity || 1) ? "low" : "available",
            };
            replaceItem(idx, next);
            commit({ notes: appendAudit("Replaced", `${inspect.item.name} → ${med.name}`) as any });
          }
          setInspect(null);
        }}
      />

      {/* Pre-bill verification summary */}
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" /> Verify & Bill
            </DialogTitle>
            <DialogDescription>
              Confirm patient, medicines and reserved stock before billing. Inventory will only be deducted after successful payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><div className="text-muted-foreground">Patient</div><div className="font-medium">{patient.name || "—"} {patient.mobile && `· ${patient.mobile}`}</div></div>
              <div><div className="text-muted-foreground">Doctor</div><div className="font-medium">{doctor.name || "—"}</div></div>
              <div><div className="text-muted-foreground">Sale Type</div><div className="font-medium">{saleType}</div></div>
              <div><div className="text-muted-foreground">Items</div><div className="font-medium">{items.length}</div></div>
            </div>
            <div className="border rounded-lg max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr><th className="p-2 text-left">Medicine</th><th className="p-2">Batch</th><th className="p-2">Qty</th><th className="p-2">Stock</th><th className="p-2 text-right">Amount</th></tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((it, i) => (
                    <tr key={i}>
                      <td className="p-2">{it.name} {it.strength && <span className="text-muted-foreground">{it.strength}</span>}</td>
                      <td className="p-2 text-center font-mono">{it.batchNo || "—"}</td>
                      <td className="p-2 text-center">{it.quantity}</td>
                      <td className="p-2 text-center">
                        <MatchPill s={it.matchStatus} />
                      </td>
                      <td className="p-2 text-right">₹{((it.mrp || 0) * it.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-800">
              ✓ Stock will be <strong>reserved</strong> now and deducted only after payment is confirmed. Cancelling releases the reservation.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyOpen(false)}>Back to Edit</Button>
            <Button onClick={confirmAndBill} className="gap-2">
              <CheckCircle2 className="h-4 w-4" /> Confirm & Proceed to Billing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═════════════════════ Stage 5 · Billing ═════════════════════ */
function BillingStage({ scan, onSave }: { scan: WorkspaceScan; onSave: (p: Partial<WorkspaceScan>) => Promise<void> }) {
  const [discount, setDiscount] = useState(scan.totals_json?.discountPercent || 0);
  useEffect(() => { setDiscount(scan.totals_json?.discountPercent || 0); }, [scan.updated_at]);

  const items = scan.items_json || [];
  const totals = useMemo(() => recomputeTotals(items, discount), [items, discount]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Billing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs">
              <tr><th className="p-2 text-left">Medicine</th><th className="p-2">Qty</th><th className="p-2 text-right">MRP</th><th className="p-2 text-right">GST%</th><th className="p-2 text-right">Amount</th></tr>
            </thead>
            <tbody className="divide-y">
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="p-2">{it.name} {it.strength && <span className="text-muted-foreground text-xs">{it.strength}</span>}</td>
                  <td className="p-2 text-center">{it.quantity}</td>
                  <td className="p-2 text-right">₹{(it.mrp || 0).toFixed(2)}</td>
                  <td className="p-2 text-right">{it.gstPercent}%</td>
                  <td className="p-2 text-right">₹{((it.mrp || 0) * it.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Discount %</Label>
            <Input type="number" min={0} max={100} value={discount}
              onChange={(e) => setDiscount(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
          </div>
          <div className="text-sm space-y-1 self-end">
            <div className="flex justify-between"><span>Subtotal</span><span>₹{totals.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>GST</span><span>₹{totals.gstAmount.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>−₹{totals.discountAmount.toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold text-base pt-1 border-t"><span>Net</span><span>₹{totals.netAmount.toFixed(2)}</span></div>
          </div>
        </div>
        <Button
          onClick={() => onSave({ totals_json: totals as any, stage: "payment", billing_status: "billed" })}
          className="w-full gap-2"
        ><CreditCard className="h-4 w-4" /> Proceed to Payment →</Button>
      </CardContent>
    </Card>
  );
}

/* ═════════════════════ Stage 6 · Payment ═════════════════════ */
function PaymentStage({ scan, onSave }: { scan: WorkspaceScan; onSave: (p: Partial<WorkspaceScan>) => Promise<void> }) {
  const [mode, setMode] = useState<NonNullable<WorkspaceScan["payment_json"]["mode"]>>(
    (scan.payment_json?.mode as any) || "Cash",
  );
  const [tendered, setTendered] = useState(scan.payment_json?.amountTendered || scan.totals_json?.netAmount || 0);
  useEffect(() => {
    setMode((scan.payment_json?.mode as any) || "Cash");
    setTendered(scan.payment_json?.amountTendered || scan.totals_json?.netAmount || 0);
  }, [scan.updated_at]);

  const net = scan.totals_json?.netAmount || 0;
  const change = Math.max(0, tendered - net);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-center py-3">
          <div className="text-xs text-muted-foreground">Net Payable</div>
          <div className="text-3xl font-bold text-primary">₹{net.toFixed(2)}</div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(["Cash", "UPI", "Card", "Credit"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={cn("py-2 rounded-lg border text-xs font-medium",
                mode === m ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border")}>
              {m}
            </button>
          ))}
        </div>
        {mode === "Cash" && (
          <>
            <div>
              <Label className="text-xs">Amount Tendered</Label>
              <Input type="number" min={0} value={tendered} onChange={(e) => setTendered(Number(e.target.value) || 0)} />
            </div>
            <div className="flex justify-between text-sm"><span>Change</span><span className="font-semibold">₹{change.toFixed(2)}</span></div>
          </>
        )}
        <Button
          disabled={mode === "Cash" && tendered < net}
          onClick={() => onSave({
            payment_json: { mode, amountTendered: tendered, change } as any,
            stage: "deducted",
            billing_status: "paid",
          })}
          className="w-full gap-2"
        ><CheckCircle2 className="h-4 w-4" /> Confirm Payment →</Button>
      </CardContent>
    </Card>
  );
}

/* ═════════════════════ Stage 7 · Deduction ═════════════════════ */
function DeductionStage({ scan, onSave }: { scan: WorkspaceScan; onSave: (p: Partial<WorkspaceScan>) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async () => {
    setBusy(true); setErr(null);
    try {
      const isReturn = scan.sale_type.includes("Return");
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
        total_amount: scan.totals_json?.subtotal || 0,
        discount: scan.totals_json?.discountAmount || 0,
        gst_amount: scan.totals_json?.gstAmount || 0,
        net_amount: scan.totals_json?.netAmount || 0,
        payment_mode: scan.payment_json?.mode || "Cash",
        status: "Completed",
      };
      const items = (scan.items_json || []).map((i) => ({
        medicine_id: i.medicineId || null,
        medicine_name: i.name,
        batch_no: i.batchNo || "",
        quantity: i.quantity,
        mrp: i.mrp || 0,
        discount: i.discount || 0,
        gst_percent: i.gstPercent || 12,
        amount: (i.mrp || 0) * i.quantity,
      }));
      const created: any = await pharmacyService.completeSale(order as any, items as any);
      await onSave({
        stage: "audit",
        linked_order_id: created?.id || null,
        payment_json: { ...scan.payment_json, invoiceNo: created?.invoice_no } as any,
      });
      toast.success(isReturn ? "Return processed" : "Sale recorded · stock updated");
    } catch (e: any) {
      setErr(e?.message || "Failed to record sale");
    } finally { setBusy(false); }
  }, [scan, onSave]);

  useEffect(() => { if (!scan.linked_order_id && !busy && !err) run(); /* eslint-disable-next-line */ }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Inventory Deduction</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {busy && <div className="text-center text-sm p-4"><Loader2 className="h-5 w-5 animate-spin inline mr-1" /> Updating stock and creating invoice…</div>}
        {err && (
          <div className="p-3 rounded bg-destructive/10 text-destructive text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1">{err}</div>
            <Button size="sm" variant="outline" onClick={run}>Retry</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ═════════════════════ Stage 8 · Audit ═════════════════════ */
function AuditStage({ scan, onDone }: { scan: WorkspaceScan; onDone: () => void }) {
  const items = scan.items_json || [];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
          <CheckCircle2 className="h-5 w-5" /> Completed — Audit Trail
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
          <div className="text-xs text-emerald-700">Invoice</div>
          <div className="font-mono font-semibold">{scan.payment_json?.invoiceNo || scan.linked_order_id?.slice(0, 8)}</div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div><div className="text-muted-foreground">Patient</div><div className="font-medium">{scan.patient_json?.name || "—"}</div></div>
          <div><div className="text-muted-foreground">Doctor</div><div className="font-medium">{scan.doctor_json?.name || "—"}</div></div>
          <div><div className="text-muted-foreground">Sale Type</div><div className="font-medium">{scan.sale_type}</div></div>
          <div><div className="text-muted-foreground">Payment</div><div className="font-medium">{scan.payment_json?.mode}</div></div>
          <div><div className="text-muted-foreground">Items</div><div className="font-medium">{items.length}</div></div>
          <div><div className="text-muted-foreground">Net</div><div className="font-medium">₹{(scan.totals_json?.netAmount || 0).toFixed(2)}</div></div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1 gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print Receipt</Button>
          <Button onClick={onDone} className="flex-1 gap-2"><CheckCircle2 className="h-4 w-4" /> Done</Button>
        </div>
        <div className="text-[10px] text-muted-foreground text-center pt-2 border-t">
          Scan {scan.id.slice(0, 8)} · Created {format(new Date(scan.created_at), "dd/MM/yyyy HH:mm")} · Owner {scan.owner_user_id.slice(0, 8)}
        </div>
      </CardContent>
    </Card>
  );
}

/* ═════════════════════ Medicine Picker (guided add/replace) ═════════════════════ */
function MedicinePickerDialog({
  open, mode, seedName, medicines, onClose, onConfirm,
}: {
  open: boolean;
  mode: "add" | "replace";
  seedName?: string;
  medicines: Medicine[];
  onClose: () => void;
  onConfirm: (it: WorkspaceItem) => void;
}) {
  const [step, setStep] = useState<"search" | "qty">("search");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Medicine | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (open) {
      setStep("search");
      setQ(seedName || "");
      setSelected(null);
      setQty(1);
    }
  }, [open, seedName]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return medicines.slice(0, 30);
    return medicines
      .filter((m) =>
        (m.name || "").toLowerCase().includes(t) ||
        (m.genericName || "").toLowerCase().includes(t) ||
        (m.brandName || "").toLowerCase().includes(t),
      )
      .slice(0, 50);
  }, [q, medicines]);

  const status = (m: Medicine, want: number): WorkspaceItem["matchStatus"] =>
    (m.stock || 0) <= 0 ? "out" : (m.stock || 0) < want ? "low" : "available";

  const confirm = () => {
    if (!selected) return;
    if (qty < 1) { toast.error("Quantity must be at least 1"); return; }
    if ((selected.stock || 0) <= 0) {
      toast.error("Out of stock — choose another batch or alternative");
      return;
    }
    if (qty > (selected.stock || 0)) {
      toast.error(`Only ${selected.stock} unit(s) available`);
      return;
    }
    const next: WorkspaceItem = {
      name: selected.name,
      strength: selected.strength || "",
      quantity: qty,
      medicineId: selected.id,
      medicineName: selected.name,
      batchNo: selected.batchNo || "",
      mrp: selected.mrp || 0,
      gstPercent: selected.gstPercent ?? 12,
      availableStock: selected.stock || 0,
      matchStatus: status(selected, qty),
    };
    onConfirm(next);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "replace" ? <Replace className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {mode === "replace" ? "Replace Medicine" : "Add Medicine"}
          </DialogTitle>
          <DialogDescription>
            Search inventory → pick batch → set quantity → review. Nothing is added until you confirm.
          </DialogDescription>
        </DialogHeader>

        {step === "search" && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by brand, generic, salt…"
                className="pl-8"
              />
            </div>
            <div className="border rounded-lg divide-y max-h-80 overflow-auto">
              {results.map((m) => {
                const expired = m.expiryDate && new Date(m.expiryDate) < new Date();
                const s = status(m, 1);
                return (
                  <button
                    key={m.id}
                    onClick={() => { setSelected(m); setStep("qty"); }}
                    disabled={!!expired}
                    className={cn(
                      "w-full text-left p-2 hover:bg-accent/40 flex items-center gap-2",
                      expired && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <Pill className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {m.name} {m.strength && <span className="text-muted-foreground">· {m.strength}</span>}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {m.genericName || "—"} · Batch {m.batchNo || "—"} ·
                        {m.expiryDate ? ` Exp ${format(new Date(m.expiryDate), "MM/yy")}` : " No expiry"}
                        {expired && <span className="text-destructive font-medium"> · EXPIRED</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold">₹{(m.mrp || 0).toFixed(2)}</div>
                      <MatchPill s={s} />
                    </div>
                  </button>
                );
              })}
              {!results.length && (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No medicines match "{q}". Try a different brand or generic name.
                </div>
              )}
            </div>
          </div>
        )}

        {step === "qty" && selected && (
          <div className="space-y-3">
            <div className="border rounded-lg p-3 bg-muted/30">
              <div className="text-sm font-semibold">{selected.name} {selected.strength}</div>
              <div className="text-xs text-muted-foreground">
                {selected.genericName || "—"} · {selected.manufacturer || "—"}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                <div><div className="text-muted-foreground">Batch</div><div className="font-mono">{selected.batchNo || "—"}</div></div>
                <div><div className="text-muted-foreground">Expiry</div><div>{selected.expiryDate ? format(new Date(selected.expiryDate), "dd/MM/yyyy") : "—"}</div></div>
                <div><div className="text-muted-foreground">In Stock</div><div className="font-semibold">{selected.stock || 0} {selected.unit || ""}</div></div>
                <div><div className="text-muted-foreground">MRP</div><div>₹{(selected.mrp || 0).toFixed(2)}</div></div>
                <div><div className="text-muted-foreground">Selling</div><div>₹{(selected.sellingPrice || selected.mrp || 0).toFixed(2)}</div></div>
                <div><div className="text-muted-foreground">GST</div><div>{selected.gstPercent ?? 12}%</div></div>
              </div>
            </div>
            <div>
              <Label className="text-xs">Quantity</Label>
              <Input
                type="number" min={1} max={selected.stock || 1} value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className={cn(qty > (selected.stock || 0) && "border-destructive bg-destructive/5")}
              />
              {qty > (selected.stock || 0) && (
                <div className="text-[11px] text-destructive mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Only {selected.stock || 0} unit(s) available
                </div>
              )}
            </div>
            <div className="flex justify-between text-sm bg-emerald-50 border border-emerald-200 rounded p-2">
              <span>Line total (incl GST)</span>
              <span className="font-semibold">
                ₹{(((selected.mrp || 0) * qty) * (1 + (selected.gstPercent ?? 12) / 100)).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "qty" ? (
            <>
              <Button variant="outline" onClick={() => setStep("search")}>← Back</Button>
              <Button onClick={confirm} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {mode === "replace" ? "Replace" : "Add"} to Prescription
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═════════════════════ Inspect dialog (inventory / alternatives / batches) ═════════════════════ */
function InspectDialog({
  info, medicines, onClose, onReplace,
}: {
  info: { kind: "inventory" | "alternatives" | "batches"; item: WorkspaceItem } | null;
  medicines: Medicine[];
  onClose: () => void;
  onReplace: (m: Medicine) => void;
}) {
  const open = !!info;
  const item = info?.item;
  const kind = info?.kind;

  const title = kind === "alternatives" ? "Generic Alternatives"
    : kind === "batches" ? "Available Batches" : "Inventory Match";

  const rows = useMemo(() => {
    if (!item) return [];
    const norm = (s?: string) => (s || "").toLowerCase().trim();
    if (kind === "batches") {
      return medicines.filter((m) => norm(m.name) === norm(item.name));
    }
    if (kind === "alternatives") {
      const salt = norm(item.medicineName ? medicines.find((x) => x.id === item.medicineId)?.genericName : "") || norm(item.name);
      return medicines.filter((m) => norm(m.genericName).includes(salt) || norm(m.saltName || "").includes(salt) || norm(m.name).includes(norm(item.name))).slice(0, 30);
    }
    // inventory: exact + similar
    return medicines.filter((m) => norm(m.name).includes(norm(item.name)) || norm(item.name).includes(norm(m.name))).slice(0, 30);
  }, [info, medicines, kind, item]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {item ? <>For <strong>{item.name}</strong> {item.strength}</> : null}
          </DialogDescription>
        </DialogHeader>
        <div className="border rounded-lg divide-y max-h-96 overflow-auto">
          {rows.map((m) => {
            const expired = m.expiryDate && new Date(m.expiryDate) < new Date();
            const s: WorkspaceItem["matchStatus"] = (m.stock || 0) <= 0 ? "out" : "available";
            return (
              <div key={m.id} className="p-2 flex items-center gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{m.name} {m.strength}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {m.genericName || "—"} · Batch {m.batchNo || "—"} ·
                    {m.expiryDate ? ` Exp ${format(new Date(m.expiryDate), "MM/yy")}` : " No expiry"} ·
                    Stock {m.stock || 0}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs">₹{(m.mrp || 0).toFixed(2)}</div>
                  <MatchPill s={s} />
                </div>
                <Button
                  size="sm" variant="outline"
                  disabled={!!expired || (m.stock || 0) <= 0}
                  onClick={() => onReplace(m)}
                >
                  Use
                </Button>
              </div>
            );
          })}
          {!rows.length && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No matching items in inventory.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
