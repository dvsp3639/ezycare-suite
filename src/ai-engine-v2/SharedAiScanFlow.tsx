/* SharedAiScanFlow — the ONE AI scanner used everywhere in Ezy OP.
 *
 * Pipeline (identical for Pharmacy + Inventory + Universal Search):
 *   1. MobileUploadEngine  → uploads file(s) to `ai-core-uploads` bucket
 *   2. ai-document-router  → classifies (prescription | purchase_invoice | lab_report)
 *                            + extracts structured data
 *   3. Verify screen       → user reviews / edits extracted data
 *   4. Approve             → downstream side-effects (inventory, billing,
 *                            patient history, audit log)
 *
 * There is deliberately no other file-picker, upload path, or classifier in
 * the codebase. Pharmacy AI Scanner and Inventory AI Scanner both mount this
 * component and call the same functions.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MobileUploadEngine } from "./MobileUploadEngine";
import type { UploadResult } from "./types";
import { routeDocument, type RouterResult } from "./router";
import InvoiceVerify from "./verify/InvoiceVerify";
import PrescriptionVerify from "./verify/PrescriptionVerify";
import LabReportVerify from "./verify/LabReportVerify";

export type SharedAiScanFlowProps = {
  open: boolean;
  onClose: () => void;
  /** Soft prior for classifier. */
  mode?: "pharmacy" | "inventory" | "auto";
  /** Called after user approves the extracted data and downstream write succeeds. */
  onDone?: (result: { documentType: string; id?: string }) => void;
};

type Phase = "upload" | "processing" | "verify" | "error";

export function SharedAiScanFlow({
  open, onClose, mode = "auto", onDone,
}: SharedAiScanFlowProps) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [uploads, setUploads] = useState<UploadResult[]>([]);
  const [routed, setRouted] = useState<RouterResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const resetAll = useCallback(() => {
    setPhase("upload");
    setUploads([]);
    setRouted(null);
    setErrorMsg(null);
  }, []);

  useEffect(() => { if (!open) resetAll(); }, [open, resetAll]);

  const onUploadComplete = useCallback(async (results: UploadResult[]) => {
    const ok = results.filter((r) => r.signedUrl);
    console.info("[ai-flow] step=upload:complete", { uploaded: ok.length, total: results.length });
    if (!ok.length) {
      toast.error("No files were uploaded");
      return;
    }
    setUploads(ok);
    setPhase("processing");
    setErrorMsg(null);
    try {
      console.info("[ai-flow] step=route:start", { file: ok[0].name, size: ok[0].size, mime: ok[0].mime });
      const r = await routeDocument(ok[0].signedUrl, mode);
      console.info("[ai-flow] step=extract:done", { documentType: r.documentType, confidence: r.confidence });
      if (r.documentType === "unknown") {
        setErrorMsg("Could not identify this document as a prescription, purchase invoice, or lab report.");
        setPhase("error");
        return;
      }
      setRouted(r);
      setPhase("verify");
      console.info("[ai-flow] step=verify:open", { documentType: r.documentType });
    } catch (e: any) {
      console.error("[ai-flow] step=route:failed", e);
      setErrorMsg(e?.message || "AI classification failed");
      setPhase("error");
    }
  }, [mode]);

  const handleDone = useCallback((id?: string) => {
    console.info("[ai-flow] step=save:done", { documentType: routed?.documentType, id });
    if (routed) onDone?.({ documentType: routed.documentType, id });
    resetAll();
    onClose();
  }, [routed, onDone, onClose, resetAll]);

  if (!open) return null;

  // Upload phase — delegate to MobileUploadEngine (the only picker in the app).
  if (phase === "upload") {
    return (
      <MobileUploadEngine
        open
        onClose={onClose}
        onComplete={onUploadComplete}
        folder={mode === "inventory" ? "invoices" : mode === "pharmacy" ? "prescriptions" : "docs"}
        title="AI Scanner"
        subtitle="Upload prescription, purchase invoice, or lab report — AI will detect and extract."
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">
            {phase === "processing" ? "AI is analysing the document…"
              : phase === "verify" ? "Verify extracted data"
              : "AI Scanner"}
          </h2>
          {routed && (
            <p className="text-xs text-muted-foreground">
              Detected: <span className="font-medium capitalize">{routed.documentType.replace("_", " ")}</span>
              {" · "}Confidence {(routed.confidence * 100).toFixed(0)}%
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {phase === "processing" && (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Classifying and extracting… this usually takes 5–15 seconds.
            </p>
          </div>
        )}

        {phase === "error" && (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium">{errorMsg || "Something went wrong."}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetAll}>Try another file</Button>
              <Button variant="ghost" onClick={onClose}>Close</Button>
            </div>
          </div>
        )}

        {phase === "verify" && routed && routed.documentType === "purchase_invoice" && (
          <InvoiceVerify
            data={routed.data}
            uploads={uploads}
            onCancel={onClose}
            onDone={handleDone}
          />
        )}
        {phase === "verify" && routed && routed.documentType === "prescription" && (
          <PrescriptionVerify
            data={routed.data}
            uploads={uploads}
            onCancel={onClose}
            onDone={handleDone}
          />
        )}
        {phase === "verify" && routed && routed.documentType === "lab_report" && (
          <LabReportVerify
            data={routed.data}
            uploads={uploads}
            onCancel={onClose}
            onDone={handleDone}
          />
        )}
      </div>
    </div>
  );
}

export default SharedAiScanFlow;