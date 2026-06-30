/* AI Engine V2 — Phase 1: MobileUploadEngine
 * Standalone. No Pharmacy / Inventory / Billing / OCR / AI / routing / scanner deps.
 * Implemented as a plain fixed full-screen overlay (not Radix Dialog) so the
 * Android system file-picker can't trigger focus/escape side-effects that
 * unmount the host. */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera, Image as ImageIcon, FileText, X, RefreshCw, Trash2,
  Check, AlertCircle, Upload, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUploadQueue } from "./useUploadQueue";
import type { MobileUploadEngineProps, UploadFile } from "./types";

function fmtSize(n?: number) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function StatusBadge({ item }: { item: UploadFile }) {
  if (item.status === "done")
    return <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3.5 w-3.5" />Uploaded</span>;
  if (item.status === "error")
    return <span className="inline-flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5" />Failed</span>;
  if (item.status === "uploading")
    return <span className="inline-flex items-center gap-1 text-xs text-primary"><Loader2 className="h-3.5 w-3.5 animate-spin" />Uploading</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Upload className="h-3.5 w-3.5" />Queued</span>;
}

export function MobileUploadEngine(props: MobileUploadEngineProps) {
  const {
    open, onClose, onComplete,
    accept = "image/*,application/pdf",
    multiple = true,
    maxFiles = 10,
    folder = "v2",
    title = "Upload",
    subtitle = "Camera, gallery, or PDF — multi-file supported.",
  } = props;

  const { items, addFiles, remove, retry, reset } = useUploadQueue({ folder, maxFiles, onComplete });

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const anyRef = useRef<HTMLInputElement>(null);

  // Guard: while a native picker is open, swallow Escape and history pops that
  // some Android browsers fire when the picker dismisses.
  const pickerOpenRef = useRef(false);
  const armPickerGuard = useCallback(() => {
    pickerOpenRef.current = true;
    window.setTimeout(() => { pickerOpenRef.current = false; }, 1500);
  }, []);

  // Reset on close
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  // Block Escape while open (esp. during/right after picker dismiss)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const onPicked = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    const files = list ? Array.from(list) : [];
    // Always clear so picking the same file again still fires onChange
    e.target.value = "";
    if (!files.length) {
      // user cancelled — do NOT close the overlay
      return;
    }
    addFiles(files);
  }, [addFiles]);

  const openPicker = useCallback((ref: React.RefObject<HTMLInputElement>) => {
    armPickerGuard();
    // Use a microtask so the guard is set before the synthetic click
    queueMicrotask(() => ref.current?.click());
  }, [armPickerGuard]);

  const safeClose = useCallback(() => {
    if (pickerOpenRef.current) return;
    onClose();
  }, [onClose]);

  const allTerminal = items.length > 0 && items.every((i) => i.status === "done" || i.status === "error");
  const successCount = items.filter((i) => i.status === "done").length;
  const uploading = items.some((i) => i.status === "uploading" || i.status === "queued");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-background flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={safeClose} aria-label="Close" disabled={uploading}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Sources */}
      <div className="px-4 pt-4">
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" size="lg" className="h-24 flex-col gap-1.5 rounded-xl"
                  onClick={() => openPicker(cameraRef)}>
            <Camera className="h-6 w-6" />
            <span className="text-xs font-medium">Camera</span>
          </Button>
          <Button variant="secondary" size="lg" className="h-24 flex-col gap-1.5 rounded-xl"
                  onClick={() => openPicker(galleryRef)}>
            <ImageIcon className="h-6 w-6" />
            <span className="text-xs font-medium">Gallery</span>
          </Button>
          <Button variant="secondary" size="lg" className="h-24 flex-col gap-1.5 rounded-xl"
                  onClick={() => openPicker(pdfRef)}>
            <FileText className="h-6 w-6" />
            <span className="text-xs font-medium">PDF</span>
          </Button>
        </div>
        {accept.includes(",") && (
          <Button variant="outline" size="sm" className="w-full mt-2"
                  onClick={() => openPicker(anyRef)}>
            Browse files…
          </Button>
        )}
      </div>

      {/* Hidden inputs */}
      <input ref={cameraRef}  type="file" accept="image/*" capture="environment" hidden onChange={onPicked} />
      <input ref={galleryRef} type="file" accept="image/*" multiple={multiple} hidden onChange={onPicked} />
      <input ref={pdfRef}     type="file" accept="application/pdf" multiple={multiple} hidden onChange={onPicked} />
      <input ref={anyRef}     type="file" accept={accept} multiple={multiple} hidden onChange={onPicked} />

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {items.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-16">
            No files yet. Choose a source above.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg border bg-card p-2">
              <div className="h-14 w-14 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
                {item.previewUrl ? (
                  <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <StatusBadge item={item} />
                  <span className="text-[11px] text-muted-foreground">{fmtSize(item.size)}</span>
                </div>
                {item.errorMessage && (
                  <p className="text-[11px] text-destructive mt-0.5 truncate">{item.errorMessage}</p>
                )}
                {(item.status === "uploading" || item.status === "queued") && (
                  <Progress value={item.progress * 100} className="h-1 mt-1.5" />
                )}
              </div>
              <div className="flex items-center gap-1">
                {item.status === "error" && (
                  <Button variant="ghost" size="icon" onClick={() => retry(item.id)} aria-label="Retry">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => remove(item.id)} aria-label="Remove"
                        disabled={item.status === "uploading"}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div
        className="border-t p-3 flex items-center justify-between gap-3 bg-background"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <span className="text-xs text-muted-foreground">
          {items.length === 0 ? `Up to ${maxFiles} files` : `${successCount}/${items.length} uploaded`}
        </span>
        <Button onClick={safeClose} disabled={uploading} size="sm">
          {uploading ? "Uploading…" : allTerminal ? "Done" : "Close"}
        </Button>
      </div>
    </div>
  );
}

export default MobileUploadEngine;