import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import {
  Camera, X, Upload, FileText, FileSpreadsheet, Image as ImageIcon,
  Loader2, CheckCircle2, AlertCircle, ScanLine, Save, Plus, Pencil,
  FileCheck2, Building2, Trash2, ArrowLeft, ArrowRight, ShieldCheck,
  ChevronUp, ChevronDown, AlertTriangle, FileWarning,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Mode = "menu" | "camera" | "verify" | "invoice" | "excel" | "loading" | "success";
type Field = { value: any; confidence: number; corrected?: boolean };
type MedicineExtract = Record<string, Field>;

type InvoiceLine = {
  name: string;
  brandName?: string;
  genericName?: string;
  strength?: string;
  packSize?: string;
  manufacturer?: string;
  batchNo?: string;
  mfgDate?: string;
  expiryDate?: string;
  quantity: number;
  freeQuantity: number;
  purchaseRate: number;
  mrp: number;
  sellingRate?: number;
  gstPercent: number;
  hsnCode?: string;
  amount: number;
  confidence?: number;
  _existingId?: string | null;
  _existingStock?: number | null;
  _existingMrp?: number | null;
  _existingBatchNo?: string | null;
  _sourceFile?: string;
};

type SupplierExtract = { name: string; gst: string; address: string; contact: string };
type InvoiceMeta = {
  invoiceNo: string;
  invoiceDate: string;
  subtotal: number;
  discount: number;
  gstAmount: number;
  roundOff: number;
  totalAmount: number;
  netPayable: number;
};

type SourceFile = {
  id: string;
  name: string;
  size: number;
  mime: string;
  base64: string;
  status: "queued" | "processing" | "done" | "error";
  error?: string;
  storagePath?: string;
  itemCount?: number;
};

type Correction = {
  ts: string;
  scope: "supplier" | "invoice" | "line";
  field: string;
  oldValue: any;
  newValue: any;
  lineKey?: string;
};

type Warning = {
  kind: "duplicate_invoice" | "duplicate_batch" | "expired" | "near_expiry" | "supplier_mismatch" | "price_anomaly";
  message: string;
  severity: "warn" | "block";
};

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
    r.onload = () => { const s = String(r.result); res(s.split(",")[1] || s); };
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

function deviceInfo() {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  const plat = (navigator as any).userAgentData?.platform || navigator.platform || "";
  return `${plat} · ${ua.slice(0, 140)}`;
}

function lineKey(l: InvoiceLine, i: number) {
  return `${i}-${(l.name || "").slice(0, 40)}-${l.batchNo || ""}`;
}

export function UniversalScanner({ open, onClose, onScannedBarcode }: Props) {
  const { user, profile } = useAuth();
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

  // Invoice wizard state
  const [invoiceStep, setInvoiceStep] = useState<1 | 2 | 3>(1);
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [supplier, setSupplier] = useState<SupplierExtract>({ name: "", gst: "", address: "", contact: "" });
  const [invoiceMeta, setInvoiceMeta] = useState<InvoiceMeta>({
    invoiceNo: "", invoiceDate: "", subtotal: 0, discount: 0, gstAmount: 0, roundOff: 0, totalAmount: 0, netPayable: 0,
  });
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [acknowledgedWarnings, setAcknowledgedWarnings] = useState(false);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [approverName, setApproverName] = useState<string>("");
  const [successInfo, setSuccessInfo] = useState<{ billId: string; vendor: string; invoiceNo: string; created: number; updated: number; total: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    setMode("menu"); setBusy(false); setExtract(null); setDocumentType("");
    setExistingMedicineId(null); setExistingStock(null); setAddQty(0);
    setExcelRows([]); setExcelCols([]);
    setInvoiceStep(1); setSourceFiles([]); setLines([]); setCorrections([]);
    setWarnings([]); setAcknowledgedWarnings(false); setApproverName("");
    setSuccessInfo(null);
    setSupplier({ name: "", gst: "", address: "", contact: "" });
    setInvoiceMeta({ invoiceNo: "", invoiceDate: "", subtotal: 0, discount: 0, gstAmount: 0, roundOff: 0, totalAmount: 0, netPayable: 0 });
  }, []);

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  const close = useCallback(() => { stopCamera(); reset(); onClose(); }, [onClose, reset]);

  useEffect(() => () => stopCamera(), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, close]);

  async function lookupExisting(name?: string, barcode?: string) {
    if (!name && !barcode) return;
    let q = supabase.from("medicines").select("id,name,stock").limit(1);
    if (barcode) q = q.eq("barcode", barcode);
    else if (name) q = q.ilike("name", `%${name}%`);
    const { data } = await q.maybeSingle();
    if (data) { setExistingMedicineId(data.id); setExistingStock(data.stock ?? 0); }
    else { setExistingMedicineId(null); setExistingStock(null); }
  }

  async function resolveLineMatches(items: InvoiceLine[]): Promise<InvoiceLine[]> {
    const names = Array.from(new Set(items.map((i) => (i.name || "").trim()).filter(Boolean)));
    if (!names.length) return items;
    const { data } = await supabase
      .from("medicines")
      .select("id,name,strength,stock,mrp,batch_no")
      .in("name", names);
    const map = new Map<string, any>();
    (data || []).forEach((m: any) => {
      const key = `${m.name?.toLowerCase()}|${(m.strength || "").toLowerCase()}`;
      map.set(key, m);
    });
    return items.map((i) => {
      const key = `${i.name?.toLowerCase()}|${(i.strength || "").toLowerCase()}`;
      const hit = map.get(key) || Array.from(map.entries()).find(([k]) => k.startsWith(`${i.name?.toLowerCase()}|`))?.[1];
      return {
        ...i,
        _existingId: hit?.id ?? null,
        _existingStock: hit?.stock ?? null,
        _existingMrp: hit?.mrp ?? null,
        _existingBatchNo: hit?.batch_no ?? null,
      };
    });
  }

  /** Upload originals to private bucket for the audit trail. Returns array of storage paths. */
  async function uploadOriginals(files: SourceFile[]): Promise<SourceFile[]> {
    if (!user) return files;
    const out: SourceFile[] = [];
    for (const f of files) {
      if (f.storagePath) { out.push(f); continue; }
      try {
        const blob = await (await fetch(`data:${f.mime};base64,${f.base64}`)).blob();
        const path = `${user.id}/${Date.now()}-${f.id}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await supabase.storage.from("purchase-invoices").upload(path, blob, { contentType: f.mime, upsert: false });
        if (error) { out.push(f); continue; }
        out.push({ ...f, storagePath: path });
      } catch { out.push(f); }
    }
    return out;
  }

  /** Extract a single file via the AI edge function. Returns merged invoice or medicine label data. */
  async function extractOne(f: SourceFile) {
    const { data, error } = await supabase.functions.invoke("medicine-scan-ai", {
      body: { fileBase64: f.base64, mimeType: f.mime },
    });
    if (error) throw error;
    if (data?.error) throw new Error(
      data.error === "credits_exhausted" ? "AI credits exhausted."
      : data.error === "rate_limited" ? "Rate limited — retry shortly." : data.error
    );
    return data;
  }

  /** Merge invoice-shaped extraction results across multiple files. */
  function mergeInvoiceResults(results: { file: SourceFile; data: any }[]) {
    const num = (x: any) => Number(x ?? 0) || 0;
    const sup: SupplierExtract = { name: "", gst: "", address: "", contact: "" };
    const meta: InvoiceMeta = { invoiceNo: "", invoiceDate: "", subtotal: 0, discount: 0, gstAmount: 0, roundOff: 0, totalAmount: 0, netPayable: 0 };
    const allItems: InvoiceLine[] = [];
    for (const { file, data } of results) {
      const s = data?.supplier || {};
      sup.name ||= s.name?.value || "";
      sup.gst ||= s.gst?.value || "";
      sup.address ||= s.address?.value || "";
      sup.contact ||= s.contact?.value || "";
      const inv = data?.invoice || {};
      meta.invoiceNo ||= inv.invoiceNo?.value || "";
      meta.invoiceDate ||= inv.invoiceDate?.value || "";
      // Sum money fields across pages of the same invoice
      meta.subtotal += num(inv.subtotal?.value);
      meta.discount += num(inv.discount?.value);
      meta.gstAmount += num(inv.gstAmount?.value);
      meta.roundOff += num(inv.roundOff?.value);
      meta.totalAmount += num(inv.totalAmount?.value);
      meta.netPayable += num(inv.netPayable?.value) || num(inv.totalAmount?.value);
      const items: any[] = data?.invoice?.items || [];
      items.forEach((it) => {
        const name = String(it.name || "").trim();
        if (!name) return;
        allItems.push({
          name,
          brandName: it.brandName || "",
          genericName: it.genericName || "",
          strength: it.strength || "",
          packSize: it.packSize || "",
          manufacturer: it.manufacturer || "",
          batchNo: it.batchNo || "",
          mfgDate: it.mfgDate || "",
          expiryDate: it.expiryDate || "",
          quantity: num(it.quantity),
          freeQuantity: num(it.freeQuantity),
          purchaseRate: num(it.purchaseRate),
          mrp: num(it.mrp),
          sellingRate: it.sellingRate != null ? num(it.sellingRate) : undefined,
          gstPercent: it.gstPercent != null ? num(it.gstPercent) : 12,
          hsnCode: it.hsnCode || "",
          amount: num(it.amount) || num(it.purchaseRate) * num(it.quantity),
          confidence: typeof it.confidence === "number" ? it.confidence : 0.7,
          _sourceFile: file.name,
        });
      });
    }
    if (!meta.invoiceDate) meta.invoiceDate = new Date().toISOString().slice(0, 10);
    return { supplier: sup, meta, items: allItems };
  }

  /** Handle multiple files; if any looks like an invoice, route to wizard; else single-medicine flow. */
  async function handleFiles(files: File[]) {
    if (!files.length) return;
    setBusy(true);

    // Excel shortcut — only single excel at a time
    const xl = files.find((f) => /\.(xlsx?|csv)$/i.test(f.name) || f.type.includes("sheet") || f.type === "text/csv");
    if (xl && files.length === 1) {
      setSourceType("excel");
      setMode("loading");
      try {
        const buf = await xl.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        if (!rows.length) { toast.error("Sheet is empty"); reset(); return; }
        setExcelCols(Object.keys(rows[0]));
        setExcelRows(rows);
        setMode("excel");
      } finally { setBusy(false); }
      return;
    }

    // Build queue
    const sf: SourceFile[] = [];
    for (const file of files) {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|heic|webp)$/i.test(file.name);
      if (!isImage && !isPdf) {
        toast.error(`Unsupported file: ${file.name}`);
        continue;
      }
      sf.push({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        mime: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
        base64: await fileToBase64(file),
        status: "queued",
      });
    }
    if (!sf.length) { setBusy(false); return; }

    // Open wizard immediately so the user sees per-file progress
    setSourceType(sf[0].mime === "application/pdf" ? "pdf" : "image");
    setSourceFiles(sf);
    setMode("invoice");
    setInvoiceStep(1);
    setBusy(false);

    await runExtraction(sf);
  }

  async function runExtraction(files: SourceFile[]) {
    const results: { file: SourceFile; data: any }[] = [];
    let firstMedicineLabel: any = null;

    for (const f of files) {
      setSourceFiles((prev) => prev.map((p) => p.id === f.id ? { ...p, status: "processing" } : p));
      try {
        const data = await extractOne(f);
        const items = data?.invoice?.items || [];
        const isInvoice = (data?.documentType === "supplier_invoice") || items.length > 0;
        if (isInvoice) {
          results.push({ file: f, data });
          setSourceFiles((prev) => prev.map((p) => p.id === f.id ? { ...p, status: "done", itemCount: items.length } : p));
        } else if (data?.medicine?.name?.value && !firstMedicineLabel) {
          firstMedicineLabel = data.medicine;
          setSourceFiles((prev) => prev.map((p) => p.id === f.id ? { ...p, status: "done", itemCount: 0 } : p));
        } else {
          setSourceFiles((prev) => prev.map((p) => p.id === f.id ? { ...p, status: "error", error: "No medicine data detected" } : p));
        }
      } catch (e: any) {
        setSourceFiles((prev) => prev.map((p) => p.id === f.id ? { ...p, status: "error", error: e?.message || "AI failed" } : p));
      }
    }

    if (results.length === 0 && firstMedicineLabel && files.length === 1) {
      // Single medicine label flow
      setDocumentType("medicine_label");
      setExtract(firstMedicineLabel as MedicineExtract);
      await lookupExisting(firstMedicineLabel?.name?.value, firstMedicineLabel?.barcode?.value);
      setMode("verify");
      return;
    }
    if (results.length === 0) {
      toast.error("AI could not detect a supplier invoice or medicine label. Try clearer files.");
      return;
    }

    const merged = mergeInvoiceResults(results);
    setSupplier(merged.supplier);
    setInvoiceMeta(merged.meta);
    const resolved = await resolveLineMatches(merged.items);
    setLines(resolved);
    setDocumentType("supplier_invoice");
  }

  // Append files from inside the wizard (Step 1 — Add more pages)
  async function addMoreFiles(files: File[]) {
    if (!files.length) return;
    const sf: SourceFile[] = [];
    for (const file of files) {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|heic|webp)$/i.test(file.name);
      if (!isImage && !isPdf) { toast.error(`Unsupported: ${file.name}`); continue; }
      sf.push({
        id: crypto.randomUUID(),
        name: file.name, size: file.size,
        mime: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
        base64: await fileToBase64(file),
        status: "queued",
      });
    }
    if (!sf.length) return;
    setSourceFiles((prev) => [...prev, ...sf]);
    // Run extraction only for the new files and merge
    const newResults: { file: SourceFile; data: any }[] = [];
    for (const f of sf) {
      setSourceFiles((prev) => prev.map((p) => p.id === f.id ? { ...p, status: "processing" } : p));
      try {
        const data = await extractOne(f);
        const items = data?.invoice?.items || [];
        newResults.push({ file: f, data });
        setSourceFiles((prev) => prev.map((p) => p.id === f.id ? { ...p, status: "done", itemCount: items.length } : p));
      } catch (e: any) {
        setSourceFiles((prev) => prev.map((p) => p.id === f.id ? { ...p, status: "error", error: e?.message || "AI failed" } : p));
      }
    }
    if (newResults.length === 0) return;
    const m = mergeInvoiceResults(newResults);
    setSupplier((prev) => ({
      name: prev.name || m.supplier.name,
      gst: prev.gst || m.supplier.gst,
      address: prev.address || m.supplier.address,
      contact: prev.contact || m.supplier.contact,
    }));
    setInvoiceMeta((prev) => ({
      invoiceNo: prev.invoiceNo || m.meta.invoiceNo,
      invoiceDate: prev.invoiceDate || m.meta.invoiceDate,
      subtotal: prev.subtotal + m.meta.subtotal,
      discount: prev.discount + m.meta.discount,
      gstAmount: prev.gstAmount + m.meta.gstAmount,
      roundOff: prev.roundOff + m.meta.roundOff,
      totalAmount: prev.totalAmount + m.meta.totalAmount,
      netPayable: prev.netPayable + m.meta.netPayable,
    }));
    const resolved = await resolveLineMatches(m.items);
    setLines((prev) => [...prev, ...resolved]);
  }

  // -------- Camera (barcode-only) --------
  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) { toast.info("Camera not available on this device."); return; }
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
              if (raw) { onScannedBarcode?.(raw); toast.success(`Barcode: ${raw}`); stopCamera(); close(); return; }
            }
          } catch {}
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      }
    } catch { toast.error("Camera permission denied"); reset(); }
  }

  async function captureFromCamera() {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.9)!);
    stopCamera();
    await handleFiles([new File([blob], "capture.jpg", { type: "image/jpeg" })]);
  }

  // -------- Single-medicine path --------
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
        user_id: u.user!.id, source_type: sourceType, field,
        ai_value: null, corrected_value: f.value != null ? String(f.value) : null,
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
        name: v("name"), brand_name: v("brandName"), generic_name: v("genericName"), salt_name: v("genericName"),
        strength: v("strength"), dosage_form: v("dosageForm"), manufacturer: v("manufacturer"),
        batch_no: v("batchNo"), expiry_date: v("expiryDate") || null,
        mrp: Number(v("mrp")) || 0, selling_price: Number(v("mrp")) || 0,
        hsn_code: v("hsnCode"), gst_percent: Number(v("gstPercent")) || 12,
        barcode: v("barcode"), unit: "Strip",
        stock: Math.max(0, Number(addQty) || 0), is_active: true,
      };
      if (!payload.name) { toast.error("Medicine name is required"); setBusy(false); return; }
      let medId: string | null = null;
      if (existingMedicineId) {
        const updates: any = { ...payload }; delete updates.stock;
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
    } finally { setBusy(false); }
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
        unit: "Strip", is_active: true,
      })).filter((p) => p.name);
      if (!payload.length) { toast.error("No valid rows to import"); setBusy(false); return; }
      const { error } = await supabase.from("medicines").insert(payload as any);
      if (error) throw error;
      const total = payload.reduce((s, p) => s + p.mrp * (p.stock || 0), 0);
      await supabase.from("purchase_bills").insert({
        bill_type: "Pharmacy", vendor: "Bulk Excel Import",
        invoice_no: `XLS-${Date.now()}`, bill_date: new Date().toISOString().slice(0, 10),
        subtotal: total, gst_amount: 0, discount: 0, total_amount: total,
        payment_mode: "Pending", payment_status: "Pending",
        notes: `Imported ${payload.length} medicines from Excel`,
      } as any);
      toast.success(`Imported ${payload.length} medicines`);
      close();
    } catch (e: any) { toast.error(e?.message || "Excel import failed"); }
    finally { setBusy(false); }
  }

  // -------- Invoice wizard line edits w/ correction log --------
  const updateLine = useCallback((idx: number, patch: Partial<InvoiceLine>) => {
    setLines((prev) => {
      const old = prev[idx]; if (!old) return prev;
      const lk = lineKey(old, idx);
      const next = { ...old, ...patch };
      const newCorr: Correction[] = [];
      for (const k of Object.keys(patch) as (keyof InvoiceLine)[]) {
        if ((old as any)[k] !== (next as any)[k]) {
          newCorr.push({ ts: new Date().toISOString(), scope: "line", field: String(k), oldValue: (old as any)[k], newValue: (next as any)[k], lineKey: lk });
        }
      }
      if (newCorr.length) setCorrections((c) => [...c, ...newCorr]);
      return prev.map((l, i) => i === idx ? next : l);
    });
  }, []);
  const removeLine = (idx: number) => {
    setLines((prev) => {
      const removed = prev[idx];
      if (removed) setCorrections((c) => [...c, { ts: new Date().toISOString(), scope: "line", field: "_removed", oldValue: removed.name, newValue: null, lineKey: lineKey(removed, idx) }]);
      return prev.filter((_, i) => i !== idx);
    });
  };
  const updateSupplier = (patch: Partial<SupplierExtract>) => {
    setSupplier((prev) => {
      const next = { ...prev, ...patch };
      const newCorr: Correction[] = [];
      for (const k of Object.keys(patch) as (keyof SupplierExtract)[]) {
        if (prev[k] !== next[k]) newCorr.push({ ts: new Date().toISOString(), scope: "supplier", field: String(k), oldValue: prev[k], newValue: next[k] });
      }
      if (newCorr.length) setCorrections((c) => [...c, ...newCorr]);
      return next;
    });
  };
  const updateInvoice = (patch: Partial<InvoiceMeta>) => {
    setInvoiceMeta((prev) => {
      const next = { ...prev, ...patch };
      const newCorr: Correction[] = [];
      for (const k of Object.keys(patch) as (keyof InvoiceMeta)[]) {
        if (prev[k] !== next[k]) newCorr.push({ ts: new Date().toISOString(), scope: "invoice", field: String(k), oldValue: prev[k], newValue: next[k] });
      }
      if (newCorr.length) setCorrections((c) => [...c, ...newCorr]);
      return next;
    });
  };

  // Pre-import checks → warnings list
  async function runPreImportChecks(): Promise<Warning[]> {
    const w: Warning[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const ninetyDays = new Date(today); ninetyDays.setDate(today.getDate() + 90);

    // 1. duplicate invoice (same vendor + invoice_no)
    if (invoiceMeta.invoiceNo && supplier.name) {
      const { data: dup } = await supabase.from("purchase_bills")
        .select("id, bill_date")
        .eq("invoice_no", invoiceMeta.invoiceNo)
        .ilike("vendor", supplier.name)
        .limit(1);
      if (dup && dup.length) {
        w.push({ kind: "duplicate_invoice", severity: "block", message: `Invoice "${invoiceMeta.invoiceNo}" from "${supplier.name}" was already imported.` });
      }
    }

    // 2. supplier name appears with a different GST anywhere
    if (supplier.name && supplier.gst) {
      const { data: sm } = await supabase.from("purchase_bills")
        .select("supplier_gst")
        .ilike("vendor", supplier.name)
        .neq("supplier_gst", supplier.gst)
        .not("supplier_gst", "is", null)
        .limit(1);
      if (sm && sm.length) {
        w.push({ kind: "supplier_mismatch", severity: "warn", message: `Supplier "${supplier.name}" was previously seen with a different GST (${sm[0].supplier_gst}).` });
      }
    }

    // 3-6. per-line checks
    const expiredNames: string[] = [];
    const nearExpiry: string[] = [];
    const dupBatch: string[] = [];
    const priceAnomalies: string[] = [];
    for (const l of lines) {
      if (l.expiryDate) {
        const d = new Date(l.expiryDate);
        if (!isNaN(d.getTime())) {
          if (d < today) expiredNames.push(`${l.name} (${l.expiryDate})`);
          else if (d <= ninetyDays) nearExpiry.push(`${l.name} (${l.expiryDate})`);
        }
      }
      if (l._existingId && l.batchNo && l._existingBatchNo && l._existingBatchNo === l.batchNo) {
        dupBatch.push(`${l.name} — batch ${l.batchNo}`);
      }
      if (l._existingMrp && l.mrp) {
        const diff = Math.abs(l.mrp - l._existingMrp) / l._existingMrp;
        if (diff > 0.5) priceAnomalies.push(`${l.name}: ₹${l.mrp} vs previous ₹${l._existingMrp}`);
      }
    }
    if (expiredNames.length) w.push({ kind: "expired", severity: "warn", message: `Expired medicines: ${expiredNames.slice(0, 3).join("; ")}${expiredNames.length > 3 ? ` and ${expiredNames.length - 3} more` : ""}.` });
    if (nearExpiry.length) w.push({ kind: "near_expiry", severity: "warn", message: `Near-expiry (≤ 90 days): ${nearExpiry.slice(0, 3).join("; ")}${nearExpiry.length > 3 ? ` and ${nearExpiry.length - 3} more` : ""}.` });
    if (dupBatch.length) w.push({ kind: "duplicate_batch", severity: "warn", message: `Duplicate batch already on file: ${dupBatch.slice(0, 3).join("; ")}${dupBatch.length > 3 ? ` and ${dupBatch.length - 3} more` : ""}.` });
    if (priceAnomalies.length) w.push({ kind: "price_anomaly", severity: "warn", message: `Unusual price change: ${priceAnomalies.slice(0, 3).join("; ")}${priceAnomalies.length > 3 ? ` and ${priceAnomalies.length - 3} more` : ""}.` });
    return w;
  }

  async function gotoApproval() {
    if (!supplier.name.trim()) { toast.error("Supplier name is required"); return; }
    if (!lines.length) { toast.error("Add at least one medicine line"); return; }
    setBusy(true);
    try {
      const w = await runPreImportChecks();
      setWarnings(w);
      setAcknowledgedWarnings(false);
      setInvoiceStep(3);
    } finally { setBusy(false); }
  }

  const finalSummary = useMemo(() => {
    const qty = lines.reduce((s, l) => s + (Number(l.quantity) || 0) + (Number(l.freeQuantity) || 0), 0);
    const newCount = lines.filter((l) => !l._existingId).length;
    const updatedBatches = lines.filter((l) => l._existingId && l.batchNo && l._existingBatchNo !== l.batchNo).length;
    return { qty, newCount, existingCount: lines.length - newCount, updatedBatches, total: invoiceMeta.netPayable || invoiceMeta.totalAmount };
  }, [lines, invoiceMeta]);

  async function finalImport(force = false) {
    setBusy(true);
    try {
      // 1. Upload originals for audit
      const uploaded = await uploadOriginals(sourceFiles);
      setSourceFiles(uploaded);

      const payloadItems = lines.map((l) => ({
        name: l.name, brandName: l.brandName || null, genericName: l.genericName || null,
        strength: l.strength || null, packSize: l.packSize || null, manufacturer: l.manufacturer || null,
        batchNo: l.batchNo || null, mfgDate: l.mfgDate || null, expiryDate: l.expiryDate || null,
        quantity: Number(l.quantity) || 0, freeQuantity: Number(l.freeQuantity) || 0,
        purchaseRate: Number(l.purchaseRate) || 0, mrp: Number(l.mrp) || 0,
        sellingRate: l.sellingRate != null ? Number(l.sellingRate) : null,
        gstPercent: Number(l.gstPercent) || 12, hsnCode: l.hsnCode || null,
        amount: Number(l.amount) || 0, confidence: l.confidence ?? null,
      }));
      const audit = {
        force,
        verified_by: user?.id ?? null,
        verified_by_name: profile?.full_name ?? user?.email ?? null,
        approved_by: user?.id ?? null,
        approved_by_name: approverName || profile?.full_name || user?.email || null,
        employee_id: employeeId || null,
        device_info: deviceInfo(),
        source_files: uploaded.map((f) => ({
          name: f.name, size: f.size, mime: f.mime,
          storage_path: f.storagePath ?? null,
          item_count: f.itemCount ?? 0,
          status: f.status,
        })),
        manual_corrections: corrections,
        warnings: warnings,
      };

      const { data, error } = await supabase.rpc("import_purchase_invoice", {
        _supplier: supplier as any,
        _invoice: invoiceMeta as any,
        _items: payloadItems as any,
        _audit: audit as any,
      });
      if (error) {
        const msg = String(error.message || "");
        if (msg.startsWith("duplicate_invoice") && !force) {
          const ok = window.confirm(`This invoice was already imported.\n\nForce import anyway? Stock will be added on top of the previous import.`);
          if (ok) return finalImport(true);
          return;
        }
        throw error;
      }
      const summary = data as any;
      toast.success(`Imported · ${summary?.created ?? 0} new · ${summary?.updated ?? 0} updated · ${summary?.total_items ?? lines.length} lines saved`);
      close();
    } catch (e: any) {
      toast.error(e?.message || "Import failed");
    } finally { setBusy(false); }
  }

  if (!open) return null;

  const node = (
    <div className="fixed inset-0 z-[120] bg-background/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center">
            <ScanLine className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold leading-tight">Universal AI Scanner</p>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {mode === "menu" && "Camera · Image · PDF · Excel · Drag & drop (multi-file)"}
              {mode === "camera" && "Live camera"}
              {mode === "loading" && "AI analyzing document…"}
              {mode === "verify" && (documentType.replace("_", " ") || "Verify extracted data")}
              {mode === "invoice" && `Purchase invoice wizard · Step ${invoiceStep} of 3`}
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
            onDrop={(fs) => handleFiles(fs)}
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
            extract={extract} onChange={updateField}
            existingId={existingMedicineId} existingStock={existingStock}
            addQty={addQty} setAddQty={setAddQty}
            busy={busy} onSave={saveMedicine} onCancel={reset}
          />
        )}

        {mode === "invoice" && (
          <InvoiceWizard
            step={invoiceStep} setStep={setInvoiceStep}
            sourceFiles={sourceFiles} setSourceFiles={setSourceFiles}
            onAddMore={addMoreFiles}
            supplier={supplier} updateSupplier={updateSupplier}
            invoice={invoiceMeta} updateInvoice={updateInvoice}
            lines={lines} updateLine={updateLine} removeLine={removeLine}
            warnings={warnings}
            acknowledged={acknowledgedWarnings} setAcknowledged={setAcknowledgedWarnings}
            employeeId={employeeId} setEmployeeId={setEmployeeId}
            approverName={approverName} setApproverName={setApproverName}
            corrections={corrections}
            summary={finalSummary}
            user={user} profile={profile}
            busy={busy}
            onCancel={reset}
            onGotoApproval={gotoApproval}
            onFinalImport={() => finalImport(false)}
          />
        )}

        {mode === "excel" && (
          <ExcelView rows={excelRows} cols={excelCols} busy={busy} onCancel={reset} onImport={importExcel} />
        )}
      </div>

      <input
        ref={fileInputRef} type="file" hidden multiple
        accept="image/*,.pdf,.xls,.xlsx,.csv,.heic"
        onChange={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) handleFiles(fs); e.target.value = ""; }}
      />
    </div>
  );

  return createPortal(node, document.body);
}

/* ------------------------- Menu ------------------------- */

function MenuView({ dragActive, onDrag, onDrop, onPickFile, onCamera }: {
  dragActive: boolean;
  onDrag: (b: boolean) => void;
  onDrop: (fs: File[]) => void;
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
          const fs = Array.from(e.dataTransfer.files || []);
          if (fs.length) onDrop(fs);
        }}
        className={cn(
          "rounded-3xl border-2 border-dashed p-10 text-center transition-all",
          dragActive ? "border-primary bg-primary/5" : "border-border bg-muted/30",
        )}
      >
        <Upload className="h-10 w-10 mx-auto text-primary mb-3" />
        <p className="font-semibold text-foreground">Drop files to scan</p>
        <p className="text-xs text-muted-foreground mt-1">
          Drop multiple images or PDFs of the same purchase invoice — they'll be merged
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">JPG · PNG · HEIC · PDF · XLSX · CSV</p>
        <Button className="mt-4" onClick={onPickFile}>
          <Upload className="h-4 w-4 mr-2" /> Choose files
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        <ActionTile icon={Camera} label="Camera" subtitle="Live scan" onClick={onCamera} />
        <ActionTile icon={ImageIcon} label="Images" subtitle="JPG / PNG" onClick={onPickFile} />
        <ActionTile icon={FileText} label="PDFs" subtitle="Invoice / report" onClick={onPickFile} />
        <ActionTile icon={FileSpreadsheet} label="Excel" subtitle="Bulk import" onClick={onPickFile} />
      </div>

      <div className="mt-6 rounded-xl bg-muted/30 p-4 text-xs text-muted-foreground">
        Tip: Photograph every page of the invoice and drop them all at once — the AI will merge them into a single import.
      </div>
    </div>
  );
}

function ActionTile({ icon: Icon, label, subtitle, onClick }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 p-4 rounded-2xl border border-border bg-card hover:border-primary/40 hover:bg-accent transition active:scale-95">
      <Icon className="h-6 w-6 text-primary" />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-[10px] text-muted-foreground">{subtitle}</span>
    </button>
  );
}

/* ------------------------- Single medicine verify ------------------------- */

function VerifyView({ extract, onChange, existingId, existingStock, addQty, setAddQty, busy, onSave, onCancel }: {
  extract: MedicineExtract; onChange: (k: string, v: any) => void;
  existingId: string | null; existingStock: number | null;
  addQty: number; setAddQty: (n: number) => void;
  busy: boolean; onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className={cn("rounded-2xl p-4 flex items-center gap-3", existingId ? "bg-info/10 text-info" : "bg-success/10 text-success")}>
        {existingId ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <Plus className="h-5 w-5 shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{existingId ? "Medicine already in inventory" : "New medicine — will be added to inventory"}</p>
          {existingId && <p className="text-xs">Current stock: {existingStock ?? 0}</p>}
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
                  {fld && <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", confidenceTone(c))}>{Math.round(c * 100)}%</Badge>}
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

/* ------------------------- Excel bulk ------------------------- */

function ExcelView({ rows, cols, busy, onCancel, onImport }: {
  rows: any[]; cols: string[]; busy: boolean;
  onCancel: () => void; onImport: (mapping: Record<string, string>) => void;
}) {
  const guess = (k: string) => {
    const lower = cols.map((c) => c.toLowerCase());
    const candidates: Record<string, string[]> = {
      name: ["name", "medicine", "product", "item"],
      brandName: ["brand"], genericName: ["generic", "salt"],
      strength: ["strength", "dose", "mg"],
      manufacturer: ["manufacturer", "mfg", "company"],
      batchNo: ["batch"], expiryDate: ["expiry", "exp"],
      mrp: ["mrp", "price", "rate"], hsnCode: ["hsn"],
      gstPercent: ["gst", "tax"], stock: ["stock", "qty", "quantity"],
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
        <p className="font-semibold mb-3 flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-primary" /> Column mapping</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[["name","Medicine Name *"],["brandName","Brand"],["genericName","Generic / Salt"],["strength","Strength"],["manufacturer","Manufacturer"],["batchNo","Batch No."],["expiryDate","Expiry"],["mrp","MRP"],["hsnCode","HSN"],["gstPercent","GST %"],["stock","Stock Qty"]].map(([k,l]) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs">{l}</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={mapping[k] || ""} onChange={(e) => setMapping((m) => ({ ...m, [k]: e.target.value }))}>
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
            <TableHeader><TableRow>{cols.map((c) => <TableHead key={c} className="text-xs">{c}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {rows.slice(0, 10).map((r, i) => (
                <TableRow key={i}>{cols.map((c) => <TableCell key={c} className="text-xs">{String(r[c] ?? "")}</TableCell>)}</TableRow>
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

/* ============================ Invoice wizard ============================ */

function StepHeader({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "AI Extraction" },
    { n: 2, label: "Human Verification" },
    { n: 3, label: "Final Approval" },
  ];
  return (
    <ol className="flex items-center gap-2 sm:gap-3 flex-wrap">
      {steps.map((s, i) => {
        const active = step === (s.n as any);
        const done = step > (s.n as any);
        return (
          <li key={s.n} className="flex items-center gap-2">
            <div className={cn(
              "h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border",
              done ? "bg-success text-success-foreground border-success"
                  : active ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border",
            )}>{done ? <CheckCircle2 className="h-4 w-4" /> : s.n}</div>
            <span className={cn("text-xs sm:text-sm", active ? "font-semibold" : "text-muted-foreground")}>{s.label}</span>
            {i < 2 && <ArrowRight className="h-3 w-3 text-muted-foreground mx-1" />}
          </li>
        );
      })}
      <li className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
        <ShieldCheck className="h-3.5 w-3.5" /> Inventory updates only after final approval
      </li>
    </ol>
  );
}

function InvoiceWizard(props: {
  step: 1 | 2 | 3; setStep: (s: 1 | 2 | 3) => void;
  sourceFiles: SourceFile[]; setSourceFiles: (fn: any) => void;
  onAddMore: (files: File[]) => Promise<void>;
  supplier: SupplierExtract; updateSupplier: (p: Partial<SupplierExtract>) => void;
  invoice: InvoiceMeta; updateInvoice: (p: Partial<InvoiceMeta>) => void;
  lines: InvoiceLine[]; updateLine: (i: number, p: Partial<InvoiceLine>) => void; removeLine: (i: number) => void;
  warnings: Warning[]; acknowledged: boolean; setAcknowledged: (b: boolean) => void;
  employeeId: string; setEmployeeId: (s: string) => void;
  approverName: string; setApproverName: (s: string) => void;
  corrections: Correction[];
  summary: { qty: number; newCount: number; existingCount: number; updatedBatches: number; total: number };
  user: any; profile: any;
  busy: boolean;
  onCancel: () => void;
  onGotoApproval: () => Promise<void>;
  onFinalImport: () => Promise<void>;
}) {
  const {
    step, setStep, sourceFiles, setSourceFiles, onAddMore,
    supplier, updateSupplier, invoice, updateInvoice, lines, updateLine, removeLine,
    warnings, acknowledged, setAcknowledged,
    employeeId, setEmployeeId, approverName, setApproverName,
    corrections, summary, user, profile, busy, onCancel, onGotoApproval, onFinalImport,
  } = props;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const addRef = useRef<HTMLInputElement>(null);
  const allExtracted = sourceFiles.length > 0 && sourceFiles.every((f) => f.status === "done" || f.status === "error");
  const anyExtracted = sourceFiles.some((f) => f.status === "done");

  const totals = useMemo(() => {
    const qty = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
    const amt = lines.reduce((s, l) => s + (Number(l.amount) || (Number(l.purchaseRate) || 0) * (Number(l.quantity) || 0)), 0);
    const newCount = lines.filter((l) => !l._existingId).length;
    return { qty, amt, newCount, updateCount: lines.length - newCount };
  }, [lines]);

  function moveFile(idx: number, dir: -1 | 1) {
    setSourceFiles((prev: SourceFile[]) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }
  function deleteFile(id: string) {
    setSourceFiles((prev: SourceFile[]) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <StepHeader step={step} />

      {/* ---------- Step 1 ---------- */}
      {step === 1 && (
        <>
          <div className="rounded-2xl border border-border bg-card">
            <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <p className="font-semibold text-sm">Uploaded pages ({sourceFiles.length})</p>
              </div>
              <div className="flex items-center gap-2">
                <input ref={addRef} type="file" multiple hidden accept="image/*,.pdf,.heic"
                  onChange={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) onAddMore(fs); e.target.value = ""; }} />
                <Button variant="outline" size="sm" onClick={() => addRef.current?.click()}>
                  <Plus className="h-4 w-4 mr-1" /> Add more pages
                </Button>
              </div>
            </div>
            <div className="divide-y">
              {sourceFiles.map((f, i) => (
                <div key={f.id} className="px-4 py-2 flex items-center gap-3 text-sm">
                  <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                  {f.mime === "application/pdf" ? <FileText className="h-4 w-4 text-muted-foreground" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{f.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(f.size / 1024).toFixed(0)} KB
                      {f.status === "done" && f.itemCount != null && ` · ${f.itemCount} medicine row${f.itemCount === 1 ? "" : "s"}`}
                      {f.error && ` · ${f.error}`}
                    </p>
                  </div>
                  <StatusBadge status={f.status} />
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => moveFile(i, -1)}><ChevronUp className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === sourceFiles.length - 1} onClick={() => moveFile(i, 1)}><ChevronDown className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteFile(f.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
              {!sourceFiles.length && <p className="px-4 py-6 text-center text-xs text-muted-foreground">No files queued.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold mb-1">Extraction summary</p>
            <p className="text-xs text-muted-foreground">
              {allExtracted
                ? `${lines.length} medicine line${lines.length === 1 ? "" : "s"} detected across ${sourceFiles.filter(f => f.status === "done").length} file${sourceFiles.length === 1 ? "" : "s"}.`
                : "AI extraction in progress…"}
            </p>
          </div>

          <WizardFooter onCancel={onCancel} busy={busy}>
            <Button onClick={() => setStep(2)} disabled={!allExtracted || !anyExtracted || lines.length === 0}>
              Continue to verification <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </WizardFooter>
        </>
      )}

      {/* ---------- Step 2 ---------- */}
      {step === 2 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Tile icon={FileCheck2} label="Document" value="Purchase Invoice" tone="success" />
            <Tile icon={Building2} label="Supplier" value={supplier.name || "—"} tone="info" />
            <Tile icon={Pencil} label="Lines" value={`${lines.length} · ${totals.newCount} new · ${totals.updateCount} update`} tone="primary" />
          </div>

          <Section title="Supplier information" icon={Building2}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <Fld label="Supplier Name *" value={supplier.name} onChange={(v) => updateSupplier({ name: v })} />
              <Fld label="GST Number" value={supplier.gst} onChange={(v) => updateSupplier({ gst: v })} />
              <Fld label="Contact" value={supplier.contact} onChange={(v) => updateSupplier({ contact: v })} />
              <Fld label="Address" value={supplier.address} onChange={(v) => updateSupplier({ address: v })} />
            </div>
          </Section>

          <Section title="Invoice summary" icon={FileText}>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <Fld label="Invoice No." value={invoice.invoiceNo} onChange={(v) => updateInvoice({ invoiceNo: v })} />
              <Fld label="Invoice Date" type="date" value={invoice.invoiceDate} onChange={(v) => updateInvoice({ invoiceDate: v })} />
              <Fld label="Subtotal" type="number" value={invoice.subtotal} onChange={(v) => updateInvoice({ subtotal: Number(v) || 0 })} />
              <Fld label="Discount" type="number" value={invoice.discount} onChange={(v) => updateInvoice({ discount: Number(v) || 0 })} />
              <Fld label="GST" type="number" value={invoice.gstAmount} onChange={(v) => updateInvoice({ gstAmount: Number(v) || 0 })} />
              <Fld label="Round Off" type="number" value={invoice.roundOff} onChange={(v) => updateInvoice({ roundOff: Number(v) || 0 })} />
              <Fld label="Total" type="number" value={invoice.totalAmount} onChange={(v) => updateInvoice({ totalAmount: Number(v) || 0 })} />
              <Fld label="Net Payable" type="number" value={invoice.netPayable} onChange={(v) => updateInvoice({ netPayable: Number(v) || 0 })} />
            </div>
          </Section>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2 border-b flex items-center justify-between">
              <p className="font-semibold text-sm flex items-center gap-2"><Pencil className="h-4 w-4 text-primary" /> Medicine line items</p>
              <p className="text-xs text-muted-foreground">Edit any field · low-confidence rows highlighted</p>
            </div>
            <div className="overflow-x-auto max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow className="text-[11px]">
                    <TableHead className="min-w-[200px]">Medicine</TableHead>
                    <TableHead>Strength</TableHead>
                    <TableHead>Pack</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Free</TableHead>
                    <TableHead className="text-right">P. Rate</TableHead>
                    <TableHead className="text-right">MRP</TableHead>
                    <TableHead className="text-right">GST%</TableHead>
                    <TableHead>HSN</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, i) => {
                    const low = (l.confidence ?? 1) < 0.6;
                    return (
                      <TableRow key={i} className={cn("text-xs align-top", low && "bg-warning/5")}>
                        <TableCell>
                          <Input className={cn("h-8 text-xs", low && "border-warning")} value={l.name} onChange={(e) => updateLine(i, { name: e.target.value })} />
                          <Input className="h-7 text-[11px] mt-1 text-muted-foreground" placeholder="Brand / Generic" value={l.brandName || ""} onChange={(e) => updateLine(i, { brandName: e.target.value })} />
                        </TableCell>
                        <TableCell><Input className="h-8 text-xs w-20" value={l.strength || ""} onChange={(e) => updateLine(i, { strength: e.target.value })} /></TableCell>
                        <TableCell><Input className="h-8 text-xs w-20" value={l.packSize || ""} onChange={(e) => updateLine(i, { packSize: e.target.value })} /></TableCell>
                        <TableCell><Input className="h-8 text-xs w-24" value={l.batchNo || ""} onChange={(e) => updateLine(i, { batchNo: e.target.value })} /></TableCell>
                        <TableCell><Input type="date" className="h-8 text-xs w-36" value={l.expiryDate || ""} onChange={(e) => updateLine(i, { expiryDate: e.target.value })} /></TableCell>
                        <TableCell><Input type="number" className="h-8 text-xs w-16 text-right" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) || 0 })} /></TableCell>
                        <TableCell><Input type="number" className="h-8 text-xs w-14 text-right" value={l.freeQuantity} onChange={(e) => updateLine(i, { freeQuantity: Number(e.target.value) || 0 })} /></TableCell>
                        <TableCell><Input type="number" className="h-8 text-xs w-20 text-right" value={l.purchaseRate} onChange={(e) => updateLine(i, { purchaseRate: Number(e.target.value) || 0 })} /></TableCell>
                        <TableCell><Input type="number" className="h-8 text-xs w-20 text-right" value={l.mrp} onChange={(e) => updateLine(i, { mrp: Number(e.target.value) || 0 })} /></TableCell>
                        <TableCell><Input type="number" className="h-8 text-xs w-14 text-right" value={l.gstPercent} onChange={(e) => updateLine(i, { gstPercent: Number(e.target.value) || 12 })} /></TableCell>
                        <TableCell><Input className="h-8 text-xs w-20" value={l.hsnCode || ""} onChange={(e) => updateLine(i, { hsnCode: e.target.value })} /></TableCell>
                        <TableCell>
                          {l._existingId
                            ? <Badge variant="outline" className="text-[10px] bg-info/10 text-info">Update</Badge>
                            : <Badge variant="outline" className="text-[10px] bg-success/10 text-success">New</Badge>}
                          {low && <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning ml-1">Review</Badge>}
                        </TableCell>
                        <TableCell><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeLine(i)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 py-2 border-t bg-muted/30 text-xs flex items-center justify-between">
              <span>Total qty: <strong>{totals.qty}</strong></span>
              <span>Computed amount: <strong>₹ {totals.amt.toFixed(2)}</strong></span>
            </div>
          </div>

          <WizardFooter onCancel={onCancel} busy={busy}>
            <Button variant="outline" onClick={() => setStep(1)} disabled={busy}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button onClick={onGotoApproval} disabled={busy || !lines.length || !supplier.name.trim()}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Continue to approval <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </WizardFooter>
        </>
      )}

      {/* ---------- Step 3 ---------- */}
      {step === 3 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile icon={Plus} label="New medicines" value={String(summary.newCount)} tone="success" />
            <Tile icon={CheckCircle2} label="Existing medicines" value={String(summary.existingCount)} tone="info" />
            <Tile icon={Pencil} label="Updated batches" value={String(summary.updatedBatches)} tone="primary" />
            <Tile icon={FileCheck2} label="Total invoice value" value={`₹ ${(summary.total || 0).toFixed(2)}`} tone="primary" />
          </div>

          {warnings.length > 0 && (
            <div className="rounded-2xl border border-warning/40 bg-warning/5 p-4 space-y-2">
              <p className="flex items-center gap-2 font-semibold text-warning"><AlertTriangle className="h-4 w-4" /> Pre-import checks</p>
              <ul className="text-xs space-y-1">
                {warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <FileWarning className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span><Badge variant="outline" className="text-[10px] mr-1">{w.kind.replace(/_/g, " ")}</Badge>{w.message}</span>
                  </li>
                ))}
              </ul>
              <label className="flex items-center gap-2 pt-2 text-xs cursor-pointer">
                <Checkbox checked={acknowledged} onCheckedChange={(v) => setAcknowledged(!!v)} />
                I have reviewed all warnings and want to proceed.
              </label>
            </div>
          )}

          <Section title="Audit trail" icon={ShieldCheck}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div><p className="text-muted-foreground">Verified by</p><p className="font-medium">{profile?.full_name || user?.email || "—"}</p></div>
              <div><p className="text-muted-foreground">Date & time</p><p className="font-medium">{new Date().toLocaleString()}</p></div>
              <div className="space-y-1">
                <Label className="text-xs">Employee ID</Label>
                <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="e.g. EMP1023" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Approved by (optional)</Label>
                <Input value={approverName} onChange={(e) => setApproverName(e.target.value)} placeholder="Pharmacist / Manager name" />
              </div>
              <div className="md:col-span-2"><p className="text-muted-foreground">Device</p><p className="font-mono text-[11px] break-all">{deviceInfo()}</p></div>
              <div className="md:col-span-2"><p className="text-muted-foreground">Original uploads ({sourceFiles.length})</p><p className="font-medium">{sourceFiles.map((f) => f.name).join(", ") || "—"}</p></div>
              <div className="md:col-span-2"><p className="text-muted-foreground">Manual corrections ({corrections.length})</p>
                {corrections.length === 0
                  ? <p className="text-xs italic">No manual edits</p>
                  : <p className="text-[11px] text-muted-foreground line-clamp-3">{corrections.slice(0, 5).map((c) => `${c.scope}.${c.field}`).join(", ")}{corrections.length > 5 ? ` …+${corrections.length - 5}` : ""}</p>}
              </div>
            </div>
          </Section>

          <WizardFooter onCancel={onCancel} busy={busy}>
            <Button variant="outline" onClick={() => props.setStep(2)} disabled={busy}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={busy || (warnings.some((w) => w.severity === "warn") && !acknowledged)}
            >
              <ShieldCheck className="h-4 w-4 mr-2" /> Approve & import
            </Button>
          </WizardFooter>
        </>
      )}

      {/* Final confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !busy && setConfirmOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm inventory import</DialogTitle>
            <DialogDescription>
              Once approved, all medicines below will be added to Inventory, Pharmacy, OP Sale and IP Sale immediately. This action is logged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <Row label="Supplier" value={supplier.name || "—"} />
            <Row label="Invoice" value={`${invoice.invoiceNo || "—"} · ${invoice.invoiceDate || "—"}`} />
            <Row label="New medicines" value={String(summary.newCount)} />
            <Row label="Existing medicines" value={String(summary.existingCount)} />
            <Row label="Updated batches" value={String(summary.updatedBatches)} />
            <Row label="Total quantity" value={String(summary.qty)} />
            <Row label="Total invoice value" value={`₹ ${(summary.total || 0).toFixed(2)}`} />
            {warnings.length > 0 && (
              <p className="text-xs text-warning flex items-center gap-1 pt-2"><AlertTriangle className="h-3.5 w-3.5" /> {warnings.length} warning{warnings.length === 1 ? "" : "s"} acknowledged.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={async () => { setConfirmOpen(false); await onFinalImport(); }} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Confirm & import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --- small UI helpers --- */

function Tile({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: "success" | "info" | "primary" | "warning" }) {
  const map = {
    success: "bg-success/10 text-success",
    info: "bg-info/10 text-info",
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning",
  } as const;
  return (
    <div className={cn("rounded-2xl p-3 flex items-center gap-2", map[tone])}>
      <Icon className="h-5 w-5 shrink-0" />
      <div className="min-w-0"><p className="text-xs opacity-80">{label}</p><p className="font-semibold text-sm truncate">{value}</p></div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><p className="font-semibold">{title}</p></div>
      {children}
    </div>
  );
}

function Fld({ label, value, onChange, type = "text" }: { label: string; value: any; onChange: (v: any) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(type === "number" ? e.target.value : e.target.value)} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right truncate">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: SourceFile["status"] }) {
  if (status === "queued") return <Badge variant="outline" className="text-[10px]">Queued</Badge>;
  if (status === "processing") return <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Reading</Badge>;
  if (status === "done") return <Badge variant="outline" className="text-[10px] bg-success/10 text-success">Extracted</Badge>;
  return <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive">Error</Badge>;
}

function WizardFooter({ children, onCancel, busy }: { children: React.ReactNode; onCancel: () => void; busy: boolean }) {
  return (
    <div className="flex flex-col-reverse md:flex-row md:justify-end gap-2 sticky bottom-0 bg-background/95 backdrop-blur p-2 -mx-4 md:-mx-6 border-t">
      <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
      {children}
    </div>
  );
}