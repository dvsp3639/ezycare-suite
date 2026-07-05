/* Universal Upload Engine — Layer 1 of the AI Core Engine.
 * Mobile-first full-screen sheet. Desktop drag-and-drop on the same component.
 * No classification, no AI calls, no HMS writes. */
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, FileText, X, RefreshCw, Trash2, Check, AlertCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useUploadEngine } from "./hooks";
import type { UploadEngineProps, UploadItem } from "./types";

function StatusIcon({ item }: { item: UploadItem }) {
  if (item.status === "done") return <Check className="h-4 w-4 text-emerald-600" />;
  if (item.status === "error") return <AlertCircle className="h-4 w-4 text-destructive" />;
  return <Upload className="h-4 w-4 text-muted-foreground animate-pulse" />;
}

function formatKB(n?: number) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function UploadEngine(props: UploadEngineProps) {
  const {
    open, onClose, onComplete,
    accept = "image/*,application/pdf",
    multiple = true,
    maxFiles = 10,
    folder = "misc",
    title = "Upload documents",
    subtitle = "Capture or pick prescriptions, invoices, lab reports.",
  } = props;

  const { items, addFiles, remove, retry, reset } = useUploadEngine({ folder, maxFiles, onComplete });
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Reset state when closed
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const handlePicked = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || !list.length) return;
    const files = Array.from(list);
    // Reset the input so picking the same file again still fires onChange
    e.target.value = "";
    await addFiles(files);
  }, [addFiles]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) await addFiles(files);
  }, [addFiles]);

  const allDone = items.length > 0 && items.every((i) => i.status === "done" || i.status === "error");
  const successCount = items.filter((i) => i.status === "done").length;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[100dvh] sm:h-[90vh] sm:max-w-2xl sm:mx-auto p-0 flex flex-col gap-0 rounded-t-2xl"
      >
        <SheetHeader className="px-4 pt-4 pb-3 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-base">{title}</SheetTitle>
              <SheetDescription className="text-xs">{subtitle}</SheetDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        {/* Source pickers */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`mx-4 mt-4 rounded-xl border-2 border-dashed transition ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/20"}`}
        >
          <div className="grid grid-cols-3 gap-2 p-3">
            <Button variant="secondary" size="lg" className="h-20 flex-col gap-1" onClick={() => cameraRef.current?.click()}>
              <Camera className="h-5 w-5" />
              <span className="text-xs font-medium">Camera</span>
            </Button>
            <Button variant="secondary" size="lg" className="h-20 flex-col gap-1" onClick={() => galleryRef.current?.click()}>
              <ImageIcon className="h-5 w-5" />
              <span className="text-xs font-medium">Gallery</span>
            </Button>
            <Button variant="secondary" size="lg" className="h-20 flex-col gap-1" onClick={() => fileRef.current?.click()}>
              <FileText className="h-5 w-5" />
              <span className="text-xs font-medium">Files</span>
            </Button>
          </div>
          <p className="hidden sm:block text-center text-xs text-muted-foreground pb-3">
            …or drop files here
          </p>
        </div>

        {/* Hidden inputs — kept simple; never use `capture` on gallery/file inputs */}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={handlePicked} />
        <input ref={galleryRef} type="file" accept="image/*" multiple={multiple} hidden onChange={handlePicked} />
        <input ref={fileRef} type="file" accept={accept} multiple={multiple} hidden onChange={handlePicked} />

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {items.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              No files yet. Choose a source above.
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border bg-card p-2">
                <div className="h-12 w-12 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {item.previewUrl ? (
                    <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusIcon item={item} />
                    <p className="truncate text-sm font-medium">{item.file.name}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {formatKB(item.originalSize)}
                    {item.finalSize && item.finalSize !== item.originalSize ? ` → ${formatKB(item.finalSize)}` : ""}
                    {item.errorMessage ? ` · ${item.errorMessage}` : ""}
                  </p>
                  {item.status !== "done" && item.status !== "error" && (
                    <Progress value={item.progress * 100} className="h-1 mt-1" />
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {item.status === "error" && (
                    <Button variant="ghost" size="icon" onClick={() => retry(item.id)} aria-label="Retry">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => remove(item.id)} aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-3 flex items-center justify-between gap-3 bg-background">
          <span className="text-xs text-muted-foreground">
            {items.length === 0 ? `Up to ${maxFiles} files` : `${successCount}/${items.length} uploaded`}
          </span>
          <Button onClick={onClose} disabled={!allDone && items.length > 0} size="sm">
            {allDone ? "Done" : items.length > 0 ? "Uploading…" : "Close"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default UploadEngine;