import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  clearUploadTrace,
  fileDebugInfo,
  installMobileLifecycleTrace,
  readUploadTrace,
  traceFailure,
  traceUpload,
} from "@/lib/mobileUploadDiagnostics";

function safeName(name: string) {
  return (name || "debug-upload").replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default function DebugUpload() {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string; path?: string } | null>(null);
  const [rows, setRows] = useState(() => readUploadTrace());

  useEffect(() => installMobileLifecycleTrace("DebugUpload"), []);
  useEffect(() => {
    traceUpload("1 Scanner opened", {
      file: "src/pages/DebugUpload.tsx",
      component: "DebugUpload",
      function: "DebugUpload.useEffect",
      block: "debug upload page mounted",
      mode: "storage-only-debug",
    });
  }, []);
  useEffect(() => {
    const refresh = () => setRows(readUploadTrace());
    window.addEventListener("mobile-upload-trace", refresh as EventListener);
    window.addEventListener("mobile-upload-trace-cleared", refresh as EventListener);
    return () => {
      window.removeEventListener("mobile-upload-trace", refresh as EventListener);
      window.removeEventListener("mobile-upload-trace-cleared", refresh as EventListener);
    };
  }, []);

  const startPicker = () => {
    traceUpload("2 Camera / Gallery opened", {
      file: "src/pages/DebugUpload.tsx",
      component: "DebugUpload",
      function: "startPicker",
      block: "Select Image button click -> hidden file input click",
      compression: "disabled",
      ocr: "disabled",
      ai: "disabled",
    });
    inputRef.current?.click();
  };

  const uploadOriginal = async (file: File) => {
    if (!user) throw new Error("Signed-in user missing");
    const path = `${user.id}/debug-upload/${Date.now()}-${safeName(file.name)}`;
    traceUpload("8 Upload request created", {
      file: "src/pages/DebugUpload.tsx",
      component: "DebugUpload",
      function: "uploadOriginal",
      block: "create storage upload request with original file",
      bucket: "prescriptions",
      path,
      selectedFile: fileDebugInfo(file),
      compression: "disabled",
    });
    traceUpload("9 Upload request sent", {
      file: "src/pages/DebugUpload.tsx",
      component: "DebugUpload",
      function: "uploadOriginal",
      block: "supabase.storage.from('prescriptions').upload(path, file)",
      bucket: "prescriptions",
      path,
    });
    const { data, error } = await supabase.storage.from("prescriptions").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    traceUpload("10 Supabase Storage response", {
      file: "src/pages/DebugUpload.tsx",
      component: "DebugUpload",
      function: "uploadOriginal",
      block: "storage upload response",
      ok: !error,
      data,
      error: error ? { name: error.name, message: error.message } : null,
    });
    if (error) throw error;
    traceUpload("11 Database record created", {
      file: "src/pages/DebugUpload.tsx",
      component: "DebugUpload",
      function: "uploadOriginal",
      block: "skipped by design: /debug-upload performs storage-only upload",
      skipped: true,
    });
    return data?.path || path;
  };

  const onChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    traceUpload("4 onChange fired", {
      file: "src/pages/DebugUpload.tsx",
      component: "DebugUpload",
      function: "onChange",
      block: "native file input onChange entry",
      filesLength: event.target.files?.length || 0,
    });
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) {
      traceFailure("3 File selected", {
        file: "src/pages/DebugUpload.tsx",
        component: "DebugUpload",
        function: "onChange",
        block: "event.target.files[0] missing after Android picker returned",
        stopReason: "The file picker returned no File object; upload cannot start.",
      }, new Error("No File returned from file input"));
      setStatus({ ok: false, message: "No file returned from picker." });
      return;
    }

    traceUpload("3 File selected", {
      file: "src/pages/DebugUpload.tsx",
      component: "DebugUpload",
      function: "onChange",
      block: "read event.target.files[0]",
      selectedFile: fileDebugInfo(file),
    });
    traceUpload("5 File object created", {
      file: "src/pages/DebugUpload.tsx",
      component: "DebugUpload",
      function: "onChange",
      block: "verified selected object is a File/Blob",
      selectedFile: fileDebugInfo(file),
    });
    setBusy(true);
    setStatus(null);
    try {
      traceUpload("6 Compression started", {
        file: "src/pages/DebugUpload.tsx",
        component: "DebugUpload",
        function: "onChange",
        block: "compression intentionally bypassed",
        skipped: true,
      });
      traceUpload("7 Compression completed", {
        file: "src/pages/DebugUpload.tsx",
        component: "DebugUpload",
        function: "onChange",
        block: "original file retained unchanged",
        selectedFile: fileDebugInfo(file),
        skipped: true,
      });
      const path = await uploadOriginal(file);
      setStatus({ ok: true, message: "Original file uploaded successfully.", path });
    } catch (error: any) {
      traceFailure("10 Supabase Storage response", {
        file: "src/pages/DebugUpload.tsx",
        component: "DebugUpload",
        function: "onChange",
        block: "storage-only debug upload failed",
        stopReason: "The original file did not upload to backend storage; scanner/AI were not executed.",
      }, error);
      setStatus({ ok: false, message: error?.message || "Upload failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Debug Upload</h1>
          <p className="text-sm text-muted-foreground">Storage-only diagnostic: no compression, OCR, AI, extraction, or database writes.</p>
        </div>
        <Badge variant="outline">Temporary</Badge>
      </div>

      <section className="rounded-lg border bg-card p-4 space-y-3">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
        <Button onClick={startPicker} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Select Image
        </Button>
        {status && (
          <div className={`rounded-md border p-3 text-sm flex gap-2 ${status.ok ? "bg-success/10 text-success border-success/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}>
            {status.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <AlertCircle className="h-4 w-4 mt-0.5" />}
            <div className="min-w-0">
              <p className="font-medium">{status.message}</p>
              {status.path && <p className="font-mono text-xs break-all mt-1">{status.path}</p>}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Trace log</h2>
          <Button variant="outline" size="sm" onClick={() => { clearUploadTrace(); setRows([]); }}>Clear</Button>
        </div>
        <div className="max-h-[460px] overflow-auto rounded-md bg-muted/30 p-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trace rows yet.</p>
          ) : (
            <pre className="text-[11px] whitespace-pre-wrap break-words">{JSON.stringify(rows.slice(-80), null, 2)}</pre>
          )}
        </div>
      </section>
    </main>
  );
}