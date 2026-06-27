import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import {
  Camera, X, Upload, FileText, FileSpreadsheet, Image as ImageIcon,
  Loader2, CheckCircle2, AlertCircle, ScanLine, Save, Plus, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Mode = "menu" | "camera" | "verify" | "excel" | "loading";
type Field = { value: any; confidence: number; corrected?: boolean };
type MedicineExtract = Record<string, Field>;

const FIELDS: { key: string; label: string; type?: "number" | "date" | "text" }[] = [
  { key: "name", label: "Medicine Name" },
  { key: "brandName", label: "Brand" },
  { key: "genericName", label: "Generic / Salt" },
  { key: "strength", label: "Strength" },
  { key: "dosageForm", label: "Dosage Form" },
  { key: "manufacturer", label: "Manufacturer" },
  { key: "batchNo", label: "Batch No." },
  { key: "mfgDate", label: "Mfg Date", type: "date" },
  { key: "expiryDate", label: "Expiry Date", type: "date" },
  { key: "mrp", label: "MRP (₹)", type: "number" },
  { key: "hsnCode", label: "HSN Code" },
  { key: "gstPercent", label: "GST %", type: "number" },
  { key: "packSize", label: "Pack Size" },
  { key: "barcode", label: "Barcode" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onScannedBarcode?: (code: string) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      res(s.split(",")[1] || s);
    };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function confidenceTone(c?: number) {
  if (c == null) return "bg-muted text-muted-foreground";
  if (c >= 0.85) return "bg-success/10 text-success";
  if (c >= 0.6) return "bg-warning/10 text-warning";
  return "bg-destructive/10 text-destructive";
}

export function UniversalScanner({ open, onClose, onScannedBarcode }: Props) {
  const [mode, setMode] = useState<Mode>("menu");
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [extract, setExtract] = useState<MedicineExtract | null>(null);
  const [documentType, setDocumentType] = useState<string>("");
  const [existingMedicineId, setExistingMedicineId] = useState<string | null>(null);
  const [existingStock, setExistingStock] = useState<number | null>(null);
  const [addQty, setAddQty] = useState<number>(0);
  const [excelRows, setExcelRows] = useState<any[]>([]);
  const [excelCols, setExcelCols] = useState<string[]>([]);
  const [sourceType, setSourceType] = useState<"image" | "pdf" | "excel" | "camera">("image");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    setMode("menu");
    setBusy(false);
    setExtract(null);
    setDocumentType("");
    setExistingMedicineId(null);
    setExistingStock(null);
    setAddQty(0);
    setExcelRows([]);
    setExcelCols([]);
  }, []);

  const close = useCallback(() => {
    stopCamera();
    reset();
    onClose();
  }, [onClose, reset]);

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => () => stopCamera(), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  async function lookupExisting(name?: string, barcode?: string) {
    if (!name && !barcode) return;
    let q = supabase.from("medicines").select("id,name,stock").limit(1);
    if (barcode) q = q.eq("barcode", barcode);
    else if (name) q = q.ilike("name", `%${name}%`);
    const { data } = await q.maybeSingle();
    if (data) {
      setExistingMedicineId(data.id);
      setExistingStock(data.stock ?? 0);
    } else {
      setExistingMedicineId(null);
      setExistingStock(null);
    }
  }

  async function handleFile(file: File) {
    setBusy(true);
    setMode("loading");
    try {
      const name = file.name.toLowerCase();
      const isExcel = /\.(xlsx?|csv)$/i.test(name) || file.type.includes("sheet") || file.type === "text/csv";
      const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
      const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|heic|webp)$/i.test(name);

      if (isExcel) {
        setSourceType("excel");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        if (!rows.length) { toast.error("Sheet is empty"); reset(); return; }
        setExcelCols(Object.keys(rows[0]));
        setExcelRows(rows);
        setMode("excel");
        setBusy(false);
        return;
      }

      if (!isImage && !isPdf) {
        toast.error("Unsupported file. Upload JPG/PNG/HEIC, PDF, or Excel.");
        reset();
        return;
      }

      setSourceType(isPdf ? "pdf" : "image");
      // HEIC isn't recognized by browsers but Gemini handles it via the data url
      const mime = file.type || (isPdf ? "application/pdf" : "image/jpeg");
      const fileBase64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("medicine-scan-ai", {
        body: { fileBase64, mimeType: mime },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error === "credits_exhausted" ? "AI credits exhausted." : data.error === "rate_limited" ? "Rate limited — retry shortly." : data.error);
      const med = data?.medicine || {};
      setDocumentType(data?.documentType || "medicine_label");
      setExtract(med as MedicineExtract);
      await lookupExisting(med?.name?.value, med?.barcode?.value);
      setMode("verify");
    } catch (e: any) {
      toast.error(e?.message || "Could not analyze file");
      reset();
    } finally {
      setBusy(false);
    }
  }

  // Camera barcode (kept lightweight; reuses BarcodeDetector when available)
  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.info("Camera not available on this device.");
      return;
    }
    setMode("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const Detector = (window as any).BarcodeDetector;
      if (Detector) {
        const detector = new Detector({ formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "data_matrix"] });
        const loop = async () => {
          if (!videoRef.current || !streamRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes?.length) {
              const raw = String(codes[0].rawValue || "").trim();
              if (raw) {
                onScannedBarcode?.(raw);
                toast.success(`Barcode: ${raw}`);
                stopCamera();
                close();
                return;
              }
            }
          } catch {}
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      }
    } catch {
      toast.error("Camera permission denied");
      reset();
    }
  }

  async function captureFromCamera() {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.9)!);
    stopCamera();
    await handleFile(new File([blob], "capture.jpg", { type: "image/jpeg" }));
  }

  function updateField(key: string, value: any) {
    setExtract((prev) => prev ? ({ ...prev, [key]: { ...(prev[key] || { confidence: 1 }), value, corrected: true } }) : prev);
  }

  async function logCorrections(medicineId: string | null) {
    if (!extract) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return;
    const rows = Object.entries(extract)
      .filter(([, f]) => f?.corrected)
      .map(([field, f]) => ({
        user_id: u.user!.id,
        source_type: sourceType,
        field,
        ai_value: null,
        corrected_value: f.value != null ? String(f.value) : null,
        medicine_id: medicineId,
      }));
    if (!rows.length) return;
    await supabase.from("scanner_corrections").insert(rows as any);
  }

  async function saveMedicine() {
    if (!extract) return;
    setBusy(true);
    try {
      const v = (k: string) => extract[k]?.value ?? null;
      const payload: any = {
        name: v("name"),
        brand_name: v("brandName"),
        generic_name: v("genericName"),
        salt_name: v("genericName"),
        strength: v("strength"),
        dosage_form: v("dosageForm"),
        manufacturer: v("manufacturer"),
        batch_no: v("batchNo"),
        expiry_date: v("expiryDate") || null,
        mrp: Number(v("mrp")) || 0,
        selling_price: Number(v("mrp")) || 0,
        hsn_code: v("hsnCode"),
        gst_percent: Number(v("gstPercent")) || 12,
        barcode: v("barcode"),
        unit: "Strip",
        stock: Math.max(0, Number(addQty) || 0),
        is_active: true,
      };
      if (!payload.name) { toast.error("Medicine name is required"); setBusy(false); return; }

      let medId: string | null = null;
      if (existingMedicineId) {
        const updates: any = { ...payload };
        delete updates.stock;
        if (addQty > 0) updates.stock = (existingStock ?? 0) + Number(addQty);
        const { error } = await supabase.from("medicines").update(updates).eq("id", existingMedicineId);
        if (error) throw error;
        medId = existingMedicineId;
        toast.success(addQty > 0 ? `Updated · +${addQty} added to stock` : "Medicine updated");
      } else {
        const { data, error } = await supabase.from("medicines").insert(payload).select("id").single();
        if (error) throw error;
        medId = data.id;
        toast.success("New medicine saved to inventory");
      }
      await logCorrections(medId);
      close();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function importExcel(mapping: Record<string, string>) {
    setBusy(true);
    try {
      const required = mapping.name;
      if (!required) { toast.error("Map at least the Medicine Name column"); setBusy(false); return; }
      const payload = excelRows.map((r) => ({
        name: String(r[mapping.name] ?? "").trim(),
        brand_name: mapping.brandName ? String(r[mapping.brandName] ?? "") : null,
        generic_name: mapping.genericName ? String(r[mapping.genericName] ?? "") : null,
        strength: mapping.strength ? String(r[mapping.strength] ?? "") : null,
        manufacturer: mapping.manufacturer ? String(r[mapping.manufacturer] ?? "") : null,
        batch_no: mapping.batchNo ? String(r[mapping.batchNo] ?? "") : null,
        expiry_date: mapping.expiryDate ? (String(r[mapping.expiryDate] ?? "") || null) : null,
        mrp: mapping.mrp ? Number(r[mapping.mrp]) || 0 : 0,
        selling_price: mapping.mrp ? Number(r[mapping.mrp]) || 0 : 0,
        hsn_code: mapping.hsnCode ? String(r[mapping.hsnCode] ?? "") : null,
        gst_percent: mapping.gstPercent ? Number(r[mapping.gstPercent]) || 12 : 12,
        stock: mapping.stock ? Number(r[mapping.stock]) || 0 : 0,
        unit: "Strip",
        is_active: true,
      })).filter((p) => p.name);
      if (!payload.length) { toast.error("No valid rows to import"); setBusy(false); return; }
      const { error } = await supabase.from("medicines").insert(payload as any);
      if (error) throw error;
      // Also create one purchase bill row to record the lot
      const total = payload.reduce((s, p) => s + p.mrp * (p.stock || 0), 0);
      await supabase.from("purchase_bills").insert({
        bill_type: "Pharmacy", vendor: "Bulk Excel Import",
        invoice_no: `XLS-${Date.now()}`,
        bill_date: new Date().toISOString().slice(0, 10),
        subtotal: total, gst_amount: 0, discount: 0, total_amount: total,
        payment_mode: "Pending", payment_status: "Pending",
        notes: `Imported ${payload.length} medicines from Excel`,
      } as any);
      toast.success(`Imported ${payload.length} medicines`);
      close();
    } catch (e: any) {
      toast.error(e?.message || "Excel import failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const node = (
    <div className="fixed inset-0 z-[120] bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center">
            <ScanLine className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold leading-tight">Universal AI Scanner</p>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {mode === "menu" && "Camera · Image · PDF · Excel · Drag & drop"}
              {mode === "camera" && "Live camera"}
              {mode === "loading" && "AI analyzing document…"}
              {mode === "verify" && (documentType.replace("_", " ") || "Verify extracted data")}
              {mode === "excel" && `${excelRows.length} rows · map columns`}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={close}><X className="h-5 w-5" /></Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {mode === "menu" && (
          <MenuView
            dragActive={dragActive}
            onDrag={setDragActive}
            onDrop={(f) => handleFile(f)}
            onPickFile={() => fileInputRef.current?.click()}
            onCamera={startCamera}
          />
        )}

        {mode === "loading" && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Reading document with AI…</p>
          </div>
        )}

        {mode === "camera" && (
          <div className="p-4 flex flex-col items-center gap-4">
            <div className="relative w-full max-w-md aspect-square rounded-3xl overflow-hidden bg-black ring-1 ring-border">
              <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-6 pointer-events-none">
                <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-primary rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-primary rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-primary rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-primary rounded-br-xl" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={captureFromCamera}><Camera className="h-4 w-4 mr-2" />Capture & analyze</Button>
              <Button variant="outline" onClick={() => { stopCamera(); reset(); }}>Cancel</Button>
            </div>
            <p className="text-xs text-muted-foreground">Or wait — barcodes are detected automatically.</p>
          </div>
        )}

        {mode === "verify" && extract && (
          <VerifyView
            extract={extract}
            onChange={updateField}
            existingId={existingMedicineId}
            existingStock={existingStock}
            addQty={addQty}
            setAddQty={setAddQty}
            busy={busy}
            onSave={saveMedicine}
            onCancel={reset}
          />
        )}

        {mode === "excel" && (
          <ExcelView
            rows={excelRows}
            cols={excelCols}
            busy={busy}
            onCancel={reset}
            onImport={importExcel}
          />
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept="image/*,.pdf,.xls,.xlsx,.csv,.heic"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </div>
  );

  return createPortal(node, document.body);
}

/* ------------------------- Sub views ------------------------- */

function MenuView({ dragActive, onDrag, onDrop, onPickFile, onCamera }: {
  dragActive: boolean;
  onDrag: (b: boolean) => void;
  onDrop: (f: File) => void;
  onPickFile: () => void;
  onCamera: () => void;
}) {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div
        onDragOver={(e) => { e.preventDefault(); onDrag(true); }}
        onDragLeave={() => onDrag(false)}
        onDrop={(e) => {
          e.preventDefault(); onDrag(false);
          const f = e.dataTransfer.files?.[0]; if (f) onDrop(f);
        }}
        className={cn(
          "rounded-3xl border-2 border-dashed p-10 text-center transition-all",
          dragActive ? "border-primary bg-primary/5" : "border-border bg-muted/30",
        )}
      >
        <Upload className="h-10 w-10 mx-auto text-primary mb-3" />
        <p className="font-semibold text-foreground">Drop a file to scan</p>
        <p className="text-xs text-muted-foreground mt-1">
          Medicine label · Supplier invoice · Purchase bill · Prescription · Lab report
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">JPG · PNG · HEIC · PDF · XLSX · CSV</p>
        <Button className="mt-4" onClick={onPickFile}>
          <Upload className="h-4 w-4 mr-2" /> Choose file
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        <ActionTile icon={Camera} label="Camera" subtitle="Live scan" onClick={onCamera} />
        <ActionTile icon={ImageIcon} label="Image" subtitle="JPG / PNG" onClick={onPickFile} />
        <ActionTile icon={FileText} label="PDF" subtitle="Invoice / report" onClick={onPickFile} />
        <ActionTile icon={FileSpreadsheet} label="Excel" subtitle="Bulk import" onClick={onPickFile} />
      </div>

      <div className="mt-6 rounded-xl bg-muted/30 p-4 text-xs text-muted-foreground">
        Tip: On Android/iOS, use the <span className="font-medium text-foreground">Share</span> menu in WhatsApp, Gmail or Files and pick this browser, then drop the file here.
      </div>
    </div>
  );
}

function ActionTile({ icon: Icon, label, subtitle, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 p-4 rounded-2xl border border-border bg-card hover:border-primary/40 hover:bg-accent transition active:scale-95"
    >
      <Icon className="h-6 w-6 text-primary" />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-[10px] text-muted-foreground">{subtitle}</span>
    </button>
  );
}

function VerifyView({ extract, onChange, existingId, existingStock, addQty, setAddQty, busy, onSave, onCancel }: {
  extract: MedicineExtract;
  onChange: (k: string, v: any) => void;
  existingId: string | null;
  existingStock: number | null;
  addQty: number;
  setAddQty: (n: number) => void;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className={cn(
        "rounded-2xl p-4 flex items-center gap-3",
        existingId ? "bg-info/10 text-info" : "bg-success/10 text-success",
      )}>
        {existingId ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <Plus className="h-5 w-5 shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="font-semibold">
            {existingId ? "Medicine already in inventory" : "New medicine — will be added to inventory"}
          </p>
          {existingId && (
            <p className="text-xs">Current stock: {existingStock ?? 0}</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Pencil className="h-4 w-4 text-primary" />
          <p className="font-semibold">Verify extracted fields</p>
          <span className="text-[10px] text-muted-foreground ml-auto">
            <span className="inline-block h-2 w-2 rounded-full bg-success mr-1" /> high
            <span className="inline-block h-2 w-2 rounded-full bg-warning ml-2 mr-1" /> medium
            <span className="inline-block h-2 w-2 rounded-full bg-destructive ml-2 mr-1" /> low
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FIELDS.map((f) => {
            const fld = extract[f.key];
            const c = fld?.confidence ?? 0;
            return (
              <div key={f.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{f.label}</Label>
                  {fld && (
                    <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", confidenceTone(c))}>
                      {Math.round(c * 100)}%
                    </Badge>
                  )}
                </div>
                <Input
                  type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                  value={fld?.value ?? ""}
                  onChange={(e) => onChange(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                  className={cn(c > 0 && c < 0.6 && "border-destructive/40")}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col md:flex-row md:items-end gap-3">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">{existingId ? "Add quantity to stock" : "Initial quantity"}</Label>
          <Input type="number" min={0} value={addQty} onChange={(e) => setAddQty(Number(e.target.value) || 0)} />
        </div>
        <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button onClick={onSave} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {existingId ? "Update inventory" : "Save to inventory"}
        </Button>
      </div>
    </div>
  );
}

function ExcelView({ rows, cols, busy, onCancel, onImport }: {
  rows: any[]; cols: string[]; busy: boolean;
  onCancel: () => void;
  onImport: (mapping: Record<string, string>) => void;
}) {
  // Auto-guess mapping by header similarity
  const guess = (k: string) => {
    const lower = cols.map((c) => c.toLowerCase());
    const candidates: Record<string, string[]> = {
      name: ["name", "medicine", "product", "item"],
      brandName: ["brand"],
      genericName: ["generic", "salt"],
      strength: ["strength", "dose", "mg"],
      manufacturer: ["manufacturer", "mfg", "company"],
      batchNo: ["batch"],
      expiryDate: ["expiry", "exp"],
      mrp: ["mrp", "price", "rate"],
      hsnCode: ["hsn"],
      gstPercent: ["gst", "tax"],
      stock: ["stock", "qty", "quantity"],
    };
    const opts = candidates[k] || [];
    for (let i = 0; i < lower.length; i++) {
      if (opts.some((o) => lower[i].includes(o))) return cols[i];
    }
    return "";
  };
  const [mapping, setMapping] = useState<Record<string, string>>(() => Object.fromEntries(
    ["name","brandName","genericName","strength","manufacturer","batchNo","expiryDate","mrp","hsnCode","gstPercent","stock"].map((k) => [k, guess(k)])
  ));

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="font-semibold mb-3 flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" /> Column mapping
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            ["name","Medicine Name *"],["brandName","Brand"],["genericName","Generic / Salt"],
            ["strength","Strength"],["manufacturer","Manufacturer"],["batchNo","Batch No."],
            ["expiryDate","Expiry"],["mrp","MRP"],["hsnCode","HSN"],["gstPercent","GST %"],["stock","Stock Qty"],
          ].map(([k,l]) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs">{l}</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={mapping[k] || ""}
                onChange={(e) => setMapping((m) => ({ ...m, [k]: e.target.value }))}
              >
                <option value="">— skip —</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2 border-b text-xs text-muted-foreground flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5" /> Showing first {Math.min(rows.length, 10)} of {rows.length} rows
        </div>
        <div className="max-h-72 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>{cols.map((c) => <TableHead key={c} className="text-xs">{c}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 10).map((r, i) => (
                <TableRow key={i}>
                  {cols.map((c) => <TableCell key={c} className="text-xs">{String(r[c] ?? "")}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button onClick={() => onImport(mapping)} disabled={busy || !mapping.name}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Import {rows.length} medicines
        </Button>
      </div>
    </div>
  );
}