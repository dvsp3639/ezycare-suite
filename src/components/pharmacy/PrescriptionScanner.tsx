import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Camera, FileText, Image as ImageIcon, Loader2, CheckCircle2, AlertTriangle,
  ScanLine, ArrowLeft, ArrowRight, ShieldCheck, Pill, User as UserIcon,
  Plus, Trash2, Copy, ChevronUp, ChevronDown, Search, RotateCw, Sliders, Wand2,
  Barcode as BarcodeIcon, SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMedicines } from "@/modules/pharmacy/hooks";
import { buildIndex, searchMedicines, stockStatus, isExpired } from "@/modules/pharmacy/smartSearch";
import { rxLearningService } from "@/modules/pharmacy/services";
import { patientService } from "@/modules/patients/services";
import type { Medicine as DbMedicine } from "@/modules/pharmacy/types";
import {
  fileToImage, imageToCanvas, enhance, rotateCanvas, canvasToBlob,
  pagesToPdf, blobToBase64,
} from "@/lib/docScan";
import { decodeFromVideo } from "@/lib/barcodeReader";

/* ──────────────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────────────────── */

export type VerifiedPrescriptionItem = {
  medicineId: string;
  medicineName: string;
  batchNo: string;
  quantity: number;
  mrp: number;
  gstPercent: number;
  prescribedName: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  substituted?: boolean;
};

export type PrescriptionScanResult = {
  scanId: string;
  patient: { name: string; mobile?: string; age?: string; gender?: string };
  doctor: { name: string };
  hospital: { name: string };
  prescriptionDate: string;
  items: VerifiedPrescriptionItem[];
  saleType?: "OP" | "IP" | "Direct" | "Return";
  patientId?: string;
  registrationNumber?: string;
};

type AiMedicine = {
  name: string;
  brandName?: string;
  genericName?: string;
  strength?: string;
  dosageForm?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  quantity?: number;
  instructions?: string;
  route?: string;
  confidence?: number;
};

type RowState = AiMedicine & {
  id: string;
  matchId: string | null;
  matchAlternatives: DbMedicine[];
  pickedQty: number;
  substituted: boolean;
  verified: {
    medicine: boolean;
    strength: boolean;
    quantity: boolean;
    batch: boolean;
    notExpired: boolean;
  };
  dropped: boolean;
  barcodeVerified?: boolean;
  originalAiText?: string;
};

type Step = "scan" | "extracting" | "review" | "transaction" | "verify" | "barcode";

type SaleType = "OP" | "IP" | "Direct" | "Return";

type Page = {
  id: string;
  blob: Blob;
  previewUrl: string;
  rotation: 0 | 90 | 180 | 270;
  brightness: number;
  contrast: number;
};

type PatientInfo = {
  patientId?: string;
  name: string;
  mobile: string;
  opIp: string;
  uhid: string;
  age: string;
  gender: string;
  doctor: string;
  department: string;
};

type AuditCorrection = {
  field: string;
  from: string;
  to: string;
  rowId: string;
  at: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  patient?: { id?: string; name?: string; mobile?: string; registrationNumber?: string } | null;
  onApply: (result: PrescriptionScanResult) => void;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────────── */

function deviceInfo() {
  if (typeof navigator === "undefined") return "unknown";
  return (navigator.userAgent || "").slice(0, 180);
}

function blankVerify() {
  return { medicine: false, strength: false, quantity: false, batch: false, notExpired: false };
}

function isFullyVerified(r: RowState): boolean {
  if (r.dropped) return true;
  if (!r.matchId) return false;
  const v = r.verified;
  return v.medicine && v.strength && v.quantity && v.batch && v.notExpired;
}

function statusBadge(med: DbMedicine | undefined, requestedQty: number) {
  if (!med) return { label: "Out of Stock", tone: "destructive" as const, icon: "❌" };
  const s = stockStatus(med);
  if (s === "out") return { label: "Out of Stock", tone: "destructive" as const, icon: "❌" };
  if ((med.stock || 0) < requestedQty) return { label: `Short — ${med.stock} avail`, tone: "warning" as const, icon: "⚠" };
  if (s === "low") return { label: `Low — ${med.stock}`, tone: "warning" as const, icon: "⚠" };
  return { label: `In Stock — ${med.stock}`, tone: "success" as const, icon: "✅" };
}

function txnGateValid(saleType: SaleType, info: PatientInfo): boolean {
  if (saleType === "Direct") return true;
  if (saleType === "OP" || saleType === "Return") {
    return info.name.trim().length >= 2 && (info.opIp.trim() !== "" || !!info.patientId || info.mobile.trim() !== "");
  }
  if (saleType === "IP") {
    return info.name.trim().length >= 2 && (info.opIp.trim() !== "" || !!info.patientId);
  }
  return false;
}

function txnSaleStatus(saleType: SaleType, info: PatientInfo): string {
  if (saleType === "Direct") return "OTC sale — patient details optional";
  if (txnGateValid(saleType, info)) return `${saleType} · ${info.name}`;
  return `Link a patient to continue (${saleType})`;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Component
 * ────────────────────────────────────────────────────────────────────────── */

export function PrescriptionScanner({ open, onClose, patient, onApply }: Props) {
  const { user, profile } = useAuth();
  const { data: medicines = [] } = useMedicines();

  const [step, setStep] = useState<Step>("scan");
  const [busy, setBusy] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const [storagePath, setStoragePath] = useState<string>("");
  const [enhancedPath, setEnhancedPath] = useState<string>("");
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    name: patient?.name || "", mobile: patient?.mobile || "",
    opIp: patient?.registrationNumber || "", uhid: "", age: "", gender: "",
    doctor: "", department: "", patientId: patient?.id,
  });
  const [patientMatches, setPatientMatches] = useState<any[]>([]);
  const [patientSearchBusy, setPatientSearchBusy] = useState(false);

  const [aiPayload, setAiPayload] = useState<any>(null);
  const [hospitalName, setHospitalName] = useState("");
  const [rxDate, setRxDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<RowState[]>([]);
  const [corrections, setCorrections] = useState<AuditCorrection[]>([]);
  const [barcodeChecks, setBarcodeChecks] = useState<Array<{ rowId: string; scanned: string; matched: boolean; at: string }>>([]);
  const [saleType, setSaleType] = useState<SaleType>("OP");
  const [txnSearch, setTxnSearch] = useState("");
  const [txnMatches, setTxnMatches] = useState<any[]>([]);
  const [txnSearchBusy, setTxnSearchBusy] = useState(false);

  const [scanId, setScanId] = useState<string>("");
  const [streamingCamera, setStreamingCamera] = useState(false);
  const [streamingBarcode, setStreamingBarcode] = useState<{ rowId: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const barcodeVideoRef = useRef<HTMLVideoElement>(null);
  const barcodeControlsRef = useRef<{ stop: () => void } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fuse = useMemo(() => buildIndex(medicines as DbMedicine[]), [medicines]);

  const reset = useCallback(() => {
    setStep("scan"); setBusy(false);
    setPages([]); setStoragePath(""); setEnhancedPath("");
    setAiPayload(null); setRows([]);
    setPatientInfo({
      name: patient?.name || "", mobile: patient?.mobile || "",
      opIp: patient?.registrationNumber || "", uhid: "", age: "", gender: "",
      doctor: "", department: "", patientId: patient?.id,
    });
    setHospitalName("");
    setRxDate(new Date().toISOString().slice(0, 10));
    setScanId(""); setCorrections([]); setBarcodeChecks([]);
    stopCamera(); stopBarcode();
  }, [patient?.name, patient?.mobile, patient?.registrationNumber, patient?.id]);

  useEffect(() => { if (open) reset(); }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") doClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreamingCamera(false);
  }
  function stopBarcode() {
    try { barcodeControlsRef.current?.stop(); } catch { /* */ }
    barcodeControlsRef.current = null;
    setStreamingBarcode(null);
  }

  function doClose() { stopCamera(); stopBarcode(); onClose(); }

  /* ── Camera ── */
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setStreamingCamera(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      }, 50);
    } catch {
      toast.error("Could not access camera");
    }
  }

  async function captureFromCamera() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 1280;
    canvas.height = v.videoHeight || 720;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
    if (!blob) return;
    const file = new File([blob], `rx-${Date.now()}.jpg`, { type: "image/jpeg" });
    await addPageFromFile(file);
  }

  /* ── Page intake ── */
  async function addPageFromFile(file: File) {
    const isImg = file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic)$/i.test(file.name);
    if (!isImg) { toast.error("Use image files (JPG/PNG/WEBP/HEIC)"); return; }
    setBusy(true);
    try {
      const img = await fileToImage(file);
      const c = imageToCanvas(img);
      enhance(c, { brightness: 8, contrast: 25, shadowRemoval: true });
      const blob = await canvasToBlob(c);
      const page: Page = {
        id: crypto.randomUUID(),
        blob,
        previewUrl: URL.createObjectURL(blob),
        rotation: 0, brightness: 8, contrast: 25,
      };
      setPages((p) => [...p, page]);
    } finally { setBusy(false); }
  }

  async function reEnhancePage(pageId: string, patch: Partial<Pick<Page, "rotation" | "brightness" | "contrast">>) {
    const idx = pages.findIndex((p) => p.id === pageId);
    if (idx < 0) return;
    const orig = pages[idx];
    const next = { ...orig, ...patch };
    setBusy(true);
    try {
      const img = await fileToImage(orig.blob);
      let c = imageToCanvas(img);
      if (next.rotation) c = rotateCanvas(c, next.rotation as 90 | 180 | 270);
      enhance(c, { brightness: next.brightness, contrast: next.contrast, shadowRemoval: true });
      const blob = await canvasToBlob(c);
      URL.revokeObjectURL(orig.previewUrl);
      const page: Page = { ...next, blob, previewUrl: URL.createObjectURL(blob) };
      setPages((p) => p.map((x, i) => i === idx ? page : x));
    } finally { setBusy(false); }
  }

  function movePage(idx: number, dir: -1 | 1) {
    setPages((p) => {
      const next = [...p];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return p;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }
  function removePage(idx: number) {
    setPages((p) => {
      const next = [...p];
      const [gone] = next.splice(idx, 1);
      URL.revokeObjectURL(gone.previewUrl);
      return next;
    });
  }

  async function processPages() {
    if (pages.length === 0) { toast.error("Scan at least one page"); return; }
    setStep("extracting");
    setBusy(true);
    try {
      const pdfBlob = await pagesToPdf(pages.map((p) => p.blob));
      const b64 = await blobToBase64(pdfBlob);

      let enhancedKey = "";
      if (user) {
        try {
          const key = `${user.id}/${Date.now()}-rx-enhanced.pdf`;
          const { error } = await supabase.storage.from("prescriptions").upload(key, pdfBlob, { contentType: "application/pdf", upsert: false });
          if (!error) enhancedKey = key;
        } catch { /* */ }
      }
      setEnhancedPath(enhancedKey);
      setStoragePath(enhancedKey);

      await runExtraction(b64, "application/pdf");
    } catch (e: any) {
      toast.error(e?.message || "Failed to process pages");
      setStep("scan");
    } finally { setBusy(false); }
  }

  /* ── AI Extraction with doctor-specific learning ── */
  async function runExtraction(b64: string, mime: string) {
    try {
      const { data, error } = await supabase.functions.invoke("prescription-scan-ai", {
        body: { fileBase64: b64, mimeType: mime || "application/pdf" },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.error === "credits_exhausted") throw new Error("AI credits exhausted. Add credits to continue.");
        if (data.error === "rate_limited") throw new Error("Rate limited — retry shortly.");
        throw new Error(data.error);
      }
      if (data?.documentType !== "prescription" || !Array.isArray(data?.medicines) || data.medicines.length === 0) {
        toast.warning("AI couldn't detect prescribed medicines. Add manually below.");
        setRows([]); setStep("review"); return;
      }

      setAiPayload(data);
      const aiDoctor = data?.doctor?.name?.value || patientInfo.doctor || "";
      if (!patientInfo.doctor && aiDoctor) setPatientInfo((p) => ({ ...p, doctor: aiDoctor }));
      setHospitalName(data?.hospital?.name?.value || "");
      setRxDate(data?.prescriptionDate?.value || new Date().toISOString().slice(0, 10));

      const learned = await rxLearningService.loadForDoctor(aiDoctor);
      const learnedMap = new Map<string, { id: string; name: string }>();
      for (const c of learned) {
        if (!c.medicine_id) continue;
        learnedMap.set((c.ai_text || "").toLowerCase().trim(), { id: c.medicine_id, name: c.medicine_name });
      }

      const mapped: RowState[] = (data.medicines as AiMedicine[]).map((m, i) => {
        const aiKey = (m.name || "").toLowerCase().trim();
        const learnedHit = learnedMap.get(aiKey);
        const q = `${m.name || ""} ${m.strength || ""}`.trim();
        const hits = searchMedicines(q, medicines as DbMedicine[], fuse, new Map(), 8);
        const topFromLearning = learnedHit?.id
          ? (medicines as DbMedicine[]).find((med) => med.id === learnedHit.id)
          : null;
        const top = topFromLearning || hits[0]?.medicine || null;
        const alts = [
          ...(topFromLearning ? [topFromLearning] : []),
          ...hits.map((h) => h.medicine).filter((x) => x.id !== topFromLearning?.id),
        ].slice(0, 8);
        return {
          ...m,
          id: `${i}-${(m.name || "rx")}-${crypto.randomUUID().slice(0, 6)}`,
          matchId: top?.id || null,
          matchAlternatives: alts,
          pickedQty: Math.max(1, Number(m.quantity) || 1),
          substituted: !!topFromLearning,
          verified: blankVerify(),
          dropped: false,
          originalAiText: m.name || "",
        };
      });
      setRows(mapped);

      const { data: scanRec, error: insErr } = await supabase.from("prescription_scans").insert({
        scanned_by: user?.id ?? null,
        scanned_by_name: profile?.full_name || user?.email || "",
        patient_id: patientInfo.patientId ?? null,
        patient_name: patientInfo.name,
        registration_number: patientInfo.opIp || patient?.registrationNumber || "",
        doctor_name: aiDoctor,
        hospital_name: data?.hospital?.name?.value || "",
        prescription_date: data?.prescriptionDate?.value || null,
        source_file_path: storagePath || enhancedPath || null,
        source_file_mime: mime || null,
        enhanced_file_path: enhancedPath || null,
        pages: pages.map((p, idx) => ({ index: idx, rotation: p.rotation, brightness: p.brightness, contrast: p.contrast })) as any,
        extracted_payload: data,
        device_info: deviceInfo(),
        status: "extracted",
      } as any).select("id").single();
      if (insErr) console.warn("scan insert failed", insErr);
      else setScanId(scanRec.id);

      setStep("review");
    } catch (e: any) {
      toast.error(e?.message || "AI extraction failed");
      setStep("scan");
    }
  }

  /* ── Row mutations ── */
  function updateRow(id: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
  }
  function setMatch(id: string, med: DbMedicine) {
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const substituted = !!r.name && med.name.toLowerCase() !== (r.brandName || r.name).toLowerCase();
      const prevName = r.matchId ? (medicines as DbMedicine[]).find((x) => x.id === r.matchId)?.name || r.name : r.name;
      setCorrections((c) => [...c, {
        field: "medicine", from: prevName || "", to: med.name, rowId: id, at: new Date().toISOString(),
      }]);
      const aiText = r.originalAiText || r.name || "";
      if (aiText && med.id) {
        rxLearningService.record(patientInfo.doctor, aiText, med.id, med.name);
      }
      return { ...r, matchId: med.id, substituted };
    }));
  }
  function editField(id: string, field: keyof RowState, value: any) {
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const before = (r as any)[field];
      if (String(before ?? "") !== String(value ?? "")) {
        setCorrections((c) => [...c, { field: String(field), from: String(before ?? ""), to: String(value ?? ""), rowId: id, at: new Date().toISOString() }]);
      }
      return { ...r, [field]: value };
    }));
  }
  function addBlankRow() {
    const id = `manual-${crypto.randomUUID()}`;
    setRows((p) => [...p, {
      id, name: "", matchId: null, matchAlternatives: [], pickedQty: 1, substituted: false,
      verified: blankVerify(), dropped: false, originalAiText: "",
    }]);
  }
  function duplicateRow(id: string) {
    setRows((p) => {
      const idx = p.findIndex((r) => r.id === id);
      if (idx < 0) return p;
      const copy: RowState = { ...p[idx], id: `${p[idx].id}-dup-${crypto.randomUUID().slice(0, 4)}`, verified: blankVerify() };
      const next = [...p];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }
  function deleteRow(id: string) { setRows((p) => p.filter((r) => r.id !== id)); }
  function moveRow(id: string, dir: -1 | 1) {
    setRows((p) => {
      const i = p.findIndex((r) => r.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function mergeDuplicates() {
    setRows((p) => {
      const seen = new Map<string, RowState>();
      for (const r of p) {
        const key = (r.matchId || r.name || "").toLowerCase();
        if (!key) { seen.set(`__${r.id}`, r); continue; }
        const existing = seen.get(key);
        if (existing) existing.pickedQty += r.pickedQty;
        else seen.set(key, { ...r });
      }
      return Array.from(seen.values());
    });
    toast.success("Duplicates merged");
  }

  /* ── Patient gate ── */
  useEffect(() => {
    const q = patientInfo.mobile.trim();
    if (!open || step !== "transaction" || q.length < 4) { setPatientMatches([]); return; }
    let cancel = false;
    setPatientSearchBusy(true);
    const t = setTimeout(async () => {
      try {
        const hits = await patientService.search(q);
        if (!cancel) setPatientMatches(hits.slice(0, 5));
      } catch { /* */ }
      finally { if (!cancel) setPatientSearchBusy(false); }
    }, 300);
    return () => { cancel = true; clearTimeout(t); };
  }, [patientInfo.mobile, open, step]);

  // Transaction search (OP/IP) — UHID / Mobile / OP-IP no / Name / Ward
  useEffect(() => {
    const q = txnSearch.trim();
    if (!open || step !== "transaction" || (saleType !== "OP" && saleType !== "IP") || q.length < 2) {
      setTxnMatches([]); return;
    }
    let cancel = false;
    setTxnSearchBusy(true);
    const t = setTimeout(async () => {
      try {
        const hits = await patientService.search(q);
        if (!cancel) setTxnMatches(hits.slice(0, 8));
      } catch { /* */ }
      finally { if (!cancel) setTxnSearchBusy(false); }
    }, 250);
    return () => { cancel = true; clearTimeout(t); };
  }, [txnSearch, open, step, saleType]);

  async function pickPatient(p: any) {
    setPatientInfo((prev) => ({
      ...prev,
      patientId: p.id,
      name: p.name,
      mobile: p.mobile,
      opIp: p.registrationNumber || prev.opIp,
      uhid: p.uhid || prev.uhid,
      age: p.age ? String(p.age) : prev.age,
      gender: p.gender || prev.gender,
    }));
    setPatientMatches([]);
    toast.success(`Loaded ${p.name}`);
  }

  async function quickRegister() {
    if (!patientInfo.name.trim() || !patientInfo.mobile.trim()) {
      toast.error("Name and mobile required to register"); return;
    }
    try {
      const created = await patientService.create({
        name: patientInfo.name.trim(),
        mobile: patientInfo.mobile.trim(),
        gender: (patientInfo.gender as any) || "Other",
        age: patientInfo.age ? Number(patientInfo.age) : undefined,
      } as any);
      setPatientInfo((p) => ({ ...p, patientId: created.id, opIp: created.registrationNumber || p.opIp }));
      toast.success(`Registered as ${created.registrationNumber}`);
    } catch (e: any) {
      toast.error(e?.message || "Registration failed");
    }
  }

  function patientGateValid() {
    return patientInfo.name.trim().length >= 2
      && patientInfo.mobile.trim().length >= 8
      && (patientInfo.opIp.trim() !== "" || !!patientInfo.patientId);
  }

  /* ── Verification ── */
  function toggleVerify(id: string, key: keyof RowState["verified"], v: boolean) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, verified: { ...r.verified, [key]: v } } : r));
  }
  function verifyAll(id: string) {
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const med = (medicines as DbMedicine[]).find((m) => m.id === r.matchId);
      return {
        ...r,
        verified: {
          medicine: !!med,
          strength: !!med,
          quantity: !!med && (med.stock || 0) >= r.pickedQty,
          batch: !!med?.batchNo,
          notExpired: med ? !isExpired(med) : false,
        },
      };
    }));
  }
  function verifyEverything() {
    setRows((prev) => prev.map((r) => {
      if (r.dropped) return r;
      const med = (medicines as DbMedicine[]).find((m) => m.id === r.matchId);
      if (!med) return r;
      return {
        ...r,
        verified: {
          medicine: true, strength: true,
          quantity: (med.stock || 0) >= r.pickedQty,
          batch: !!med.batchNo, notExpired: !isExpired(med),
        },
      };
    }));
  }

  const verifiableRows = rows.filter((r) => !r.dropped);
  const allVerified = verifiableRows.length > 0 && verifiableRows.every(isFullyVerified);
  const verifiedCount = verifiableRows.filter(isFullyVerified).length;

  /* ── Barcode verification ── */
  async function startBarcodeFor(rowId: string) {
    setStreamingBarcode({ rowId });
    setTimeout(async () => {
      const v = barcodeVideoRef.current;
      if (!v) return;
      try {
        const controls = await decodeFromVideo(v, (text) => {
          const row = rows.find((r) => r.id === rowId);
          if (!row) return;
          const med = (medicines as DbMedicine[]).find((m) => m.id === row.matchId);
          const matched = !!med?.barcode && med.barcode.trim() === text.trim();
          setBarcodeChecks((b) => [...b, { rowId, scanned: text, matched, at: new Date().toISOString() }]);
          if (matched) {
            updateRow(rowId, { barcodeVerified: true });
            toast.success(`Barcode matched: ${med?.name}`);
          } else {
            toast.warning(`Barcode ${text} does not match ${med?.name || "selected medicine"}`);
          }
          stopBarcode();
        });
        barcodeControlsRef.current = controls;
      } catch (e: any) {
        toast.error(e?.message || "Could not start camera");
        stopBarcode();
      }
    }, 60);
  }

  /* ── Apply to cart ── */
  async function applyToCart() {
    if (saleType !== "Direct" && !patientInfo.name.trim()) {
      toast.error("Patient name is required");
      return;
    }
    if (!allVerified) { toast.error("Verify every medicine before continuing"); return; }

    const verifiedItems: VerifiedPrescriptionItem[] = verifiableRows.map((r) => {
      const med = (medicines as DbMedicine[]).find((m) => m.id === r.matchId)!;
      return {
        medicineId: med.id,
        medicineName: med.name,
        batchNo: med.batchNo || "",
        quantity: r.pickedQty,
        mrp: med.sellingPrice ?? med.mrp ?? 0,
        gstPercent: med.gstPercent ?? 12,
        prescribedName: r.name,
        dosage: r.dosage, frequency: r.frequency, duration: r.duration,
        instructions: r.instructions, substituted: r.substituted,
      };
    });

    if (scanId) {
      await supabase.from("prescription_scans").update({
        verified_by: user?.id ?? null,
        verified_by_name: profile?.full_name || user?.email || "",
        patient_name: patientInfo.name,
        doctor_name: patientInfo.doctor,
        hospital_name: hospitalName,
        prescription_date: rxDate || null,
        verified_items: verifiedItems as any,
        corrections: corrections as any,
        barcode_verifications: barcodeChecks as any,
        substitutions: verifiableRows.filter((r) => r.substituted).map((r) => ({
          prescribed: r.name, dispensed_id: r.matchId,
        })) as any,
        status: "verified",
      } as any).eq("id", scanId);
    }

    onApply({
      scanId,
      patient: { name: patientInfo.name, mobile: patientInfo.mobile, age: patientInfo.age, gender: patientInfo.gender },
      doctor: { name: patientInfo.doctor },
      hospital: { name: hospitalName },
      prescriptionDate: rxDate,
      items: verifiedItems,
      saleType,
      patientId: patientInfo.patientId,
      registrationNumber: patientInfo.opIp,
    });
    toast.success(`${verifiedItems.length} verified medicine(s) added to cart`);
    doClose();
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <ScanLine className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground text-sm">AI Prescription Scanner</h2>
            <p className="text-xs text-muted-foreground">
              {step === "scan" && "Scan or upload prescription pages — auto-enhanced"}
              {step === "extracting" && "AI is reading the prescription…"}
              {step === "review" && `${rows.length} medicine(s) — edit, search, match`}
              {step === "transaction" && "Choose sale type & link patient"}
              {step === "verify" && "Final pharmacist verification"}
              {step === "barcode" && "Optional: scan physical packs"}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={doClose}><X className="h-5 w-5" /></Button>
      </div>

      <Stepper step={step} pages={pages.length} rows={rows.length} verified={verifiedCount} />

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {step === "scan" && (
          <ScanStep
            busy={busy} pages={pages}
            streaming={streamingCamera} videoRef={videoRef}
            onPick={() => fileInputRef.current?.click()}
            onStartCamera={startCamera}
            onCapture={captureFromCamera}
            onStopCamera={stopCamera}
            onRemove={removePage}
            onMove={movePage}
            onAdjust={reEnhancePage}
          />
        )}

        {step === "extracting" && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Reading prescription with AI…</p>
            {pages[0] && <img src={pages[0].previewUrl} alt="prescription" className="mt-4 max-h-72 rounded-lg border border-border" />}
          </div>
        )}

        {step === "review" && (
          <ReviewStep
            pages={pages}
            info={patientInfo} setInfo={setPatientInfo}
            hospitalName={hospitalName} setHospitalName={setHospitalName}
            rxDate={rxDate} setRxDate={setRxDate}
            rows={rows} medicines={medicines as DbMedicine[]}
            editField={editField} setMatch={setMatch}
            addRow={addBlankRow} duplicateRow={duplicateRow} deleteRow={deleteRow}
            moveRow={moveRow} mergeDuplicates={mergeDuplicates}
          />
        )}

        {step === "transaction" && (
          <TransactionStep
            saleType={saleType} setSaleType={setSaleType}
            info={patientInfo} setInfo={setPatientInfo}
            search={txnSearch} setSearch={setTxnSearch}
            matches={txnMatches} searching={txnSearchBusy}
            onPick={(p) => { pickPatient(p); setTxnMatches([]); setTxnSearch(""); }}
            onQuickRegister={quickRegister}
          />
        )}

        {step === "verify" && (
          <VerifyStep
            rows={rows} medicines={medicines as DbMedicine[]}
            toggleVerify={toggleVerify} verifyAll={verifyAll}
            verifyEverything={verifyEverything}
            updateRow={updateRow}
            verifiedCount={verifiedCount} total={verifiableRows.length}
          />
        )}

        {step === "barcode" && (
          <BarcodeStep
            rows={verifiableRows} medicines={medicines as DbMedicine[]}
            streaming={streamingBarcode} videoRef={barcodeVideoRef}
            startBarcodeFor={startBarcodeFor} stopBarcode={stopBarcode}
          />
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-card/80 px-4 py-3 flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {step === "scan" && `${pages.length} page(s) ready`}
          {step === "review" && "AI prepares · Pharmacist edits · System records"}
          {step === "transaction" && txnSaleStatus(saleType, patientInfo)}
          {step === "verify" && `${verifiedCount}/${verifiableRows.length} verified`}
          {step === "barcode" && "Barcode verification is optional"}
        </div>
        <div className="flex items-center gap-2">
          {step === "scan" && (
            <Button disabled={pages.length === 0 || busy} onClick={processPages} className="gap-2">
              <Wand2 className="h-4 w-4" /> Process with AI
            </Button>
          )}
          {step === "review" && (
            <>
              <Button variant="outline" onClick={() => setStep("scan")} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                disabled={!rows.some((r) => !r.dropped && r.matchId)}
                onClick={() => setStep("transaction")}
                className="gap-2"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}
          {step === "transaction" && (
            <>
              <Button variant="outline" onClick={() => setStep("review")} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                disabled={!txnGateValid(saleType, patientInfo)}
                onClick={() => setStep("verify")}
                className="gap-2"
              >
                Continue to Verify <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}
          {step === "verify" && (
            <>
              <Button variant="outline" onClick={() => setStep("transaction")} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button variant="outline" disabled={!allVerified} onClick={() => setStep("barcode")} className="gap-2">
                <BarcodeIcon className="h-4 w-4" /> Barcode (optional)
              </Button>
              <Button onClick={applyToCart} disabled={!allVerified} className="gap-2">
                <ShieldCheck className="h-4 w-4" /> Add Verified Items to Cart
              </Button>
            </>
          )}
          {step === "barcode" && (
            <>
              <Button variant="outline" onClick={() => setStep("verify")} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button variant="outline" onClick={applyToCart} className="gap-2">
                <SkipForward className="h-4 w-4" /> Skip & Add to Cart
              </Button>
              <Button onClick={applyToCart} className="gap-2">
                <ShieldCheck className="h-4 w-4" /> Confirm & Add to Cart
              </Button>
            </>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef} type="file" multiple
        accept="image/*,.jpg,.jpeg,.png,.webp,.heic"
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          for (const f of files) await addPageFromFile(f);
          e.currentTarget.value = "";
        }}
      />
    </div>,
    document.body,
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Sub views
 * ────────────────────────────────────────────────────────────────────────── */

function Stepper({ step, pages, rows, verified }: { step: Step; pages: number; rows: number; verified: number }) {
  const steps: Array<{ key: Step; label: string; meta?: string }> = [
    { key: "scan", label: "Scan", meta: pages ? `${pages} page${pages > 1 ? "s" : ""}` : "" },
    { key: "extracting", label: "AI" },
    { key: "review", label: "Edit", meta: rows ? `${rows}` : "" },
    { key: "transaction", label: "Sale" },
    { key: "verify", label: "Verify", meta: rows ? `${verified}/${rows}` : "" },
    { key: "barcode", label: "Barcode" },
  ];
  const idx = steps.findIndex((s) => s.key === step);
  return (
    <div className="border-b border-border bg-muted/30 px-4 py-2 overflow-x-auto">
      <ol className="flex items-center gap-2 text-xs">
        {steps.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2 shrink-0">
            <div className={cn(
              "h-6 px-2 inline-flex items-center gap-1 rounded-full border",
              i < idx ? "bg-success/10 border-success/40 text-success" :
              i === idx ? "bg-primary/10 border-primary/40 text-primary font-medium" :
              "bg-card border-border text-muted-foreground"
            )}>
              <span>{i + 1}. {s.label}</span>
              {s.meta && <span className="opacity-70">· {s.meta}</span>}
            </div>
            {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ScanStep(props: {
  busy: boolean; pages: Page[];
  streaming: boolean; videoRef: React.RefObject<HTMLVideoElement>;
  onPick: () => void; onStartCamera: () => void;
  onCapture: () => void; onStopCamera: () => void;
  onRemove: (idx: number) => void;
  onMove: (idx: number, dir: -1 | 1) => void;
  onAdjust: (id: string, patch: Partial<Pick<Page, "rotation" | "brightness" | "contrast">>) => void;
}) {
  const { busy, pages, streaming, videoRef, onPick, onStartCamera, onCapture, onStopCamera, onRemove, onMove, onAdjust } = props;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
      {streaming ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-border overflow-hidden bg-black">
            <video ref={videoRef} playsInline muted className="w-full max-h-[60vh] object-contain" />
          </div>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={onStopCamera}>Stop Camera</Button>
            <Button onClick={onCapture} className="gap-2"><Camera className="h-4 w-4" /> Capture Page</Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">Multi-page: capture again to add another page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={onStartCamera} disabled={busy}
            className="rounded-xl border-2 border-primary/30 bg-primary/5 hover:border-primary p-6 text-center transition-all"
          >
            <Camera className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="font-semibold text-sm">Scan Pages</p>
            <p className="text-xs text-muted-foreground mt-1">Auto-enhanced for OCR · multi-page</p>
          </button>
          <button
            onClick={onPick} disabled={busy}
            className="rounded-xl border-2 border-info/30 bg-info/5 hover:border-info p-6 text-center transition-all"
          >
            <ImageIcon className="h-8 w-8 text-info mx-auto mb-2" />
            <p className="font-semibold text-sm">Upload Images</p>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP, HEIC · select multiple</p>
          </button>
        </div>
      )}

      {pages.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <p className="text-sm font-medium flex items-center gap-2"><FileText className="h-4 w-4" /> Pages ({pages.length})</p>
            {busy && <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> enhancing…</span>}
          </div>
          <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            {pages.map((p, i) => (
              <div key={p.id} className="rounded-lg border border-border overflow-hidden bg-background">
                <div className="relative">
                  <img src={p.previewUrl} alt={`Page ${i + 1}`} className="w-full h-44 object-cover bg-black/5" />
                  <span className="absolute top-1 left-1 text-[10px] bg-card/80 px-1.5 py-0.5 rounded">#{i + 1}</span>
                </div>
                <div className="p-2 flex items-center justify-between gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onMove(i, -1)} disabled={i === 0}><ChevronUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onMove(i, 1)} disabled={i === pages.length - 1}><ChevronDown className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onAdjust(p.id, { rotation: ((p.rotation + 90) % 360) as any })}><RotateCw className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}><Sliders className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onRemove(i)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                {expandedId === p.id && (
                  <div className="p-2 border-t border-border space-y-2 text-xs">
                    <div>
                      <Label className="text-[11px]">Brightness {p.brightness}</Label>
                      <Slider value={[p.brightness]} min={-50} max={50} step={5} onValueCommit={(v) => onAdjust(p.id, { brightness: v[0] })} />
                    </div>
                    <div>
                      <Label className="text-[11px]">Contrast {p.contrast}</Label>
                      <Slider value={[p.contrast]} min={-50} max={80} step={5} onValueCommit={(v) => onAdjust(p.id, { contrast: v[0] })} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1 flex items-center gap-1"><Wand2 className="h-3.5 w-3.5" /> Automatic enhancement applied</p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>Grayscale + contrast stretch · shadow removal · brightness boost.</li>
          <li>Adjust per page with the sliders, or rotate with the rotate button.</li>
          <li>Pages are merged into a single PDF before AI extraction.</li>
        </ul>
      </div>
    </div>
  );
}

function PatientStep(props: {
  info: PatientInfo; setInfo: React.Dispatch<React.SetStateAction<PatientInfo>>;
  matches: any[]; searching: boolean;
  onPick: (p: any) => void; onQuickRegister: () => void;
}) {
  const { info, setInfo, matches, searching, onPick, onQuickRegister } = props;
  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div className="text-xs">
          <p className="font-medium text-foreground">Mandatory before AI processing</p>
          <p className="text-muted-foreground">Name + Mobile + OP/IP Number are required. If patient is new, quick-register first.</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2"><UserIcon className="h-4 w-4 text-primary" /> Patient Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Patient Name *</Label>
            <Input value={info.name} onChange={(e) => setInfo((p) => ({ ...p, name: e.target.value }))} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Mobile *</Label>
            <Input value={info.mobile} onChange={(e) => setInfo((p) => ({ ...p, mobile: e.target.value }))} placeholder="Search existing patient" className="h-9" />
            {searching && <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> searching…</p>}
            {matches.length > 0 && (
              <div className="mt-1 rounded-md border border-border bg-popover divide-y divide-border">
                {matches.map((m) => (
                  <button key={m.id} type="button" onClick={() => onPick(m)} className="w-full text-left px-2 py-1.5 hover:bg-accent text-xs">
                    <span className="font-medium">{m.name}</span> · {m.mobile} · {m.registrationNumber}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs">OP/IP Number *</Label>
            <Input value={info.opIp} onChange={(e) => setInfo((p) => ({ ...p, opIp: e.target.value }))} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">UHID</Label>
            <Input value={info.uhid} onChange={(e) => setInfo((p) => ({ ...p, uhid: e.target.value }))} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Age</Label>
            <Input value={info.age} onChange={(e) => setInfo((p) => ({ ...p, age: e.target.value }))} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Gender</Label>
            <Input value={info.gender} onChange={(e) => setInfo((p) => ({ ...p, gender: e.target.value }))} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Doctor</Label>
            <Input value={info.doctor} onChange={(e) => setInfo((p) => ({ ...p, doctor: e.target.value }))} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Department</Label>
            <Input value={info.department} onChange={(e) => setInfo((p) => ({ ...p, department: e.target.value }))} className="h-9" />
          </div>
        </div>

        {!info.patientId && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">Not registered? Save patient now to enable full audit trail.</p>
            <Button size="sm" variant="outline" className="gap-2" onClick={onQuickRegister}><Plus className="h-3.5 w-3.5" /> Quick Register</Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* Inline 2-char debounced medicine search dropdown */
function MedicineSearchInline({
  medicines, value, onPick,
}: {
  medicines: DbMedicine[];
  value: DbMedicine | undefined;
  onPick: (m: DbMedicine) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const fuse = useMemo(() => buildIndex(medicines), [medicines]);
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 150); return () => clearTimeout(t); }, [q]);
  const results = useMemo(() => {
    if (debounced.trim().length < 2) return [];
    return searchMedicines(debounced, medicines, fuse, new Map(), 10);
  }, [debounced, medicines, fuse]);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full h-9 rounded-md border px-2 text-left text-sm flex items-center justify-between gap-2",
          value ? "border-border bg-background" : "border-warning/40 bg-warning/5 text-muted-foreground",
        )}
      >
        <span className="truncate">
          {value ? <>
            {value.name}{value.strength ? ` · ${value.strength}` : ""}
            <span className="text-xs text-muted-foreground ml-1">stock {value.stock}</span>
          </> : "Search inventory…"}
        </span>
        <Search className="h-4 w-4 shrink-0 opacity-60" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 left-0 right-0 rounded-md border border-border bg-popover shadow-lg max-h-80 overflow-auto">
          <div className="p-2 border-b border-border">
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type 2+ chars (e.g. Azi)…" className="h-8" />
          </div>
          {debounced.trim().length < 2 && <p className="px-3 py-2 text-xs text-muted-foreground">Type at least 2 characters.</p>}
          {debounced.trim().length >= 2 && results.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No matches in inventory.</p>}
          {results.map((r) => {
            const m = r.medicine;
            return (
              <button
                key={m.id} type="button"
                className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b border-border/50 last:border-0"
                onClick={() => { onPick(m); setOpen(false); setQ(""); }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{m.name}{m.strength ? ` · ${m.strength}` : ""}</span>
                  <Badge variant="outline" className={cn(
                    "text-[10px] shrink-0",
                    r.stockStatus === "out" && "border-destructive/40 text-destructive",
                    r.stockStatus === "low" && "border-warning/40 text-warning",
                    r.stockStatus === "in" && "border-success/40 text-success",
                  )}>
                    {r.stockStatus === "out" ? "Out" : `${m.stock} in stock`}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  {[m.genericName, m.brandName, m.manufacturer].filter(Boolean).join(" · ")}
                  {m.batchNo ? ` · Batch ${m.batchNo}` : ""}{m.expiryDate ? ` · Exp ${m.expiryDate}` : ""}
                  {m.rackLocation ? ` · Rack ${m.rackLocation}` : ""}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReviewStep(props: {
  pages: Page[];
  info: PatientInfo; setInfo: React.Dispatch<React.SetStateAction<PatientInfo>>;
  hospitalName: string; setHospitalName: (v: string) => void;
  rxDate: string; setRxDate: (v: string) => void;
  rows: RowState[]; medicines: DbMedicine[];
  editField: (id: string, field: keyof RowState, value: any) => void;
  setMatch: (id: string, med: DbMedicine) => void;
  addRow: () => void; duplicateRow: (id: string) => void; deleteRow: (id: string) => void;
  moveRow: (id: string, dir: -1 | 1) => void; mergeDuplicates: () => void;
}) {
  const {
    pages, info, setInfo, hospitalName, setHospitalName, rxDate, setRxDate,
    rows, medicines, editField, setMatch, addRow, duplicateRow, deleteRow, moveRow, mergeDuplicates,
  } = props;

  return (
    <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      <div className="rounded-xl border border-border bg-card p-3 sticky top-0 self-start">
        <p className="text-xs text-muted-foreground mb-2">Scanned pages ({pages.length})</p>
        <div className="space-y-2 max-h-[70vh] overflow-auto">
          {pages.map((p, i) => (
            <div key={p.id}>
              <img src={p.previewUrl} alt={`Page ${i + 1}`} className="w-full rounded-md border border-border" />
              <p className="text-[10px] text-muted-foreground text-center mt-0.5">Page {i + 1}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <UserIcon className="h-4 w-4 text-primary" /> Prescription Details
          </h3>
          {(!info.name.trim() || !info.mobile.trim() || !info.doctor.trim() || !info.opIp.trim()) && (
            <div className="mb-3 rounded-lg border border-warning/40 bg-warning/5 p-2 text-xs text-warning flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              AI couldn't extract some fields — please fill the highlighted ones below.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Patient Name {!info.name.trim() && <span className="text-warning">⚠ missing</span>}</Label>
              <Input value={info.name} onChange={(e) => setInfo((p) => ({ ...p, name: e.target.value }))} className={cn("h-9", !info.name.trim() && "border-warning/60 bg-warning/5")} />
            </div>
            <div>
              <Label className="text-xs">Mobile {!info.mobile.trim() && <span className="text-warning">⚠ missing</span>}</Label>
              <Input value={info.mobile} onChange={(e) => setInfo((p) => ({ ...p, mobile: e.target.value }))} className={cn("h-9", !info.mobile.trim() && "border-warning/60 bg-warning/5")} />
            </div>
            <div>
              <Label className="text-xs">Doctor {!info.doctor.trim() && <span className="text-warning">⚠ missing</span>}</Label>
              <Input value={info.doctor} onChange={(e) => setInfo((p) => ({ ...p, doctor: e.target.value }))} className={cn("h-9", !info.doctor.trim() && "border-warning/60 bg-warning/5")} />
            </div>
            <div>
              <Label className="text-xs">OP/IP # {!info.opIp.trim() && <span className="text-warning">⚠ missing</span>}</Label>
              <Input value={info.opIp} onChange={(e) => setInfo((p) => ({ ...p, opIp: e.target.value }))} className={cn("h-9", !info.opIp.trim() && "border-warning/60 bg-warning/5")} />
            </div>
            <div>
              <Label className="text-xs">Hospital</Label>
              <Input value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={rxDate} onChange={(e) => setRxDate(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Age</Label>
              <Input value={info.age} onChange={(e) => setInfo((p) => ({ ...p, age: e.target.value }))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Gender</Label>
              <Input value={info.gender} onChange={(e) => setInfo((p) => ({ ...p, gender: e.target.value }))} className="h-9" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Pill className="h-4 w-4 text-primary" /> Medicines ({rows.length})
            </h3>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={mergeDuplicates}>Merge Duplicates</Button>
              <Button size="sm" className="text-xs gap-1" onClick={addRow}><Plus className="h-3.5 w-3.5" /> Add Medicine</Button>
            </div>
          </div>
          <div className="divide-y divide-border">
            {rows.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No medicines yet. Click "Add Medicine" to enter manually.
              </div>
            )}
            {rows.map((r) => {
              const med = medicines.find((m) => m.id === r.matchId);
              const status = statusBadge(med, r.pickedQty);
              const alternatives = med?.genericName
                ? medicines.filter((m) => m.id !== med.id && (m.genericName || "").toLowerCase() === (med.genericName || "").toLowerCase()).slice(0, 3)
                : [];
              return (
                <div key={r.id} className={cn("p-4", r.dropped && "opacity-50")}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <p className="font-semibold text-sm">{r.name || "(New medicine)"}{r.strength ? ` · ${r.strength}` : ""}</p>
                        {r.dosageForm && <Badge variant="outline" className="text-[10px]">{r.dosageForm}</Badge>}
                        {typeof r.confidence === "number" && (
                          <Badge variant="outline" className={cn(
                            "text-[10px]",
                            r.confidence >= 0.85 ? "border-success/40 text-success" :
                            r.confidence >= 0.6 ? "border-warning/40 text-warning" : "border-destructive/40 text-destructive",
                          )}>
                            AI {Math.round(r.confidence * 100)}%
                          </Badge>
                        )}
                        {r.substituted && <Badge variant="outline" className="text-[10px] border-info/40 text-info">Substituted</Badge>}
                        {med?.rackLocation && <Badge variant="outline" className="text-[10px]">Rack {med.rackLocation}</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className={cn(
                        "text-[11px]",
                        status.tone === "success" && "border-success/40 text-success",
                        status.tone === "warning" && "border-warning/40 text-warning",
                        status.tone === "destructive" && "border-destructive/40 text-destructive",
                      )}>{status.icon} {status.label}</Badge>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveRow(r.id, -1)} title="Move up"><ChevronUp className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveRow(r.id, 1)} title="Move down"><ChevronDown className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => duplicateRow(r.id)} title="Duplicate"><Copy className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteRow(r.id)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_100px] gap-3">
                    <div>
                      <Label className="text-xs">Dispense from inventory (type 2+ chars)</Label>
                      <MedicineSearchInline
                        medicines={medicines} value={med}
                        onPick={(m) => setMatch(r.id, m)}
                      />
                      {med && med.batchNo && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Batch {med.batchNo}{med.expiryDate ? ` · Exp ${med.expiryDate}` : ""}
                          {med.genericName ? ` · Generic: ${med.genericName}` : ""}
                        </p>
                      )}
                      {alternatives.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="text-[10px] text-muted-foreground">Alt brands:</span>
                          {alternatives.map((a) => (
                            <button key={a.id} type="button" className="text-[10px] px-1.5 py-0.5 rounded border border-border hover:bg-accent" onClick={() => setMatch(r.id, a)}>
                              {a.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        type="number" min={1}
                        value={r.pickedQty}
                        onChange={(e) => editField(r.id, "pickedQty" as any, Math.max(1, Number(e.target.value) || 1))}
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                    <div>
                      <Label className="text-[11px]">Rx Name</Label>
                      <Input value={r.name || ""} onChange={(e) => editField(r.id, "name", e.target.value)} className="h-8" />
                    </div>
                    <div>
                      <Label className="text-[11px]">Brand</Label>
                      <Input value={r.brandName || ""} onChange={(e) => editField(r.id, "brandName", e.target.value)} className="h-8" />
                    </div>
                    <div>
                      <Label className="text-[11px]">Generic</Label>
                      <Input value={r.genericName || ""} onChange={(e) => editField(r.id, "genericName", e.target.value)} className="h-8" />
                    </div>
                    <div>
                      <Label className="text-[11px]">Strength</Label>
                      <Input value={r.strength || ""} onChange={(e) => editField(r.id, "strength", e.target.value)} className="h-8" />
                    </div>
                    <div>
                      <Label className="text-[11px]">Frequency</Label>
                      <Input value={r.frequency || ""} onChange={(e) => editField(r.id, "frequency", e.target.value)} className="h-8" />
                    </div>
                    <div>
                      <Label className="text-[11px]">Duration</Label>
                      <Input value={r.duration || ""} onChange={(e) => editField(r.id, "duration", e.target.value)} className="h-8" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label className="text-[11px]">Doctor instructions</Label>
                    <Input value={r.instructions || ""} onChange={(e) => editField(r.id, "instructions", e.target.value)} className="h-8" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function VerifyStep(props: {
  rows: RowState[]; medicines: DbMedicine[];
  toggleVerify: (id: string, key: keyof RowState["verified"], v: boolean) => void;
  verifyAll: (id: string) => void;
  verifyEverything: () => void;
  updateRow: (id: string, patch: Partial<RowState>) => void;
  verifiedCount: number; total: number;
}) {
  const { rows, medicines, toggleVerify, verifyAll, verifyEverything, updateRow, verifiedCount, total } = props;
  return (
    <div className="max-w-5xl mx-auto p-4 space-y-3">
      <div className="rounded-xl border border-info/30 bg-info/5 p-3 flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-info" />
        <div className="text-xs flex-1">
          <p className="font-medium text-foreground">Pharmacist mandatory verification</p>
          <p className="text-muted-foreground">Tick every box for every medicine before adding to cart. AI never dispenses automatically.</p>
        </div>
        <Badge variant="outline">{verifiedCount}/{total} verified</Badge>
        <Button size="sm" variant="outline" className="text-xs gap-1" onClick={verifyEverything}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Verify All
        </Button>
      </div>
      {rows.filter((r) => !r.dropped).map((r) => {
        const med = medicines.find((m) => m.id === r.matchId);
        const expired = med ? isExpired(med) : false;
        return (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-semibold text-sm">{med?.name || r.name}{med?.strength ? ` · ${med.strength}` : ""}</p>
                <p className="text-xs text-muted-foreground">
                  Prescribed: {r.name}{r.strength ? ` ${r.strength}` : ""} · Qty {r.pickedQty}
                  {med?.batchNo ? ` · Batch ${med.batchNo}` : ""}
                  {med?.expiryDate ? ` · Exp ${med.expiryDate}` : ""}
                </p>
              </div>
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => verifyAll(r.id)}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Verify all
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              {([
                ["medicine", "Correct Medicine"],
                ["strength", "Correct Strength"],
                ["quantity", "Correct Quantity"],
                ["batch", "Correct Batch"],
                ["notExpired", "Not Expired"],
              ] as const).map(([k, label]) => (
                <label key={k} className={cn(
                  "flex items-center gap-2 rounded-lg border p-2 cursor-pointer",
                  r.verified[k] ? "border-success/40 bg-success/5" : "border-border",
                )}>
                  <Checkbox checked={r.verified[k]} onCheckedChange={(v) => toggleVerify(r.id, k, !!v)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            {expired && (
              <div className="mt-2 flex items-center gap-2 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> This batch is expired — do not dispense.
              </div>
            )}
            <div className="mt-3">
              <Label className="text-[11px] text-muted-foreground">Pharmacist note (optional)</Label>
              <Textarea
                value={r.instructions || ""}
                onChange={(e) => updateRow(r.id, { instructions: e.target.value })}
                rows={2}
                placeholder="Counselling note, alternative reason…"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BarcodeStep(props: {
  rows: RowState[]; medicines: DbMedicine[];
  streaming: { rowId: string } | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  startBarcodeFor: (rowId: string) => void;
  stopBarcode: () => void;
}) {
  const { rows, medicines, streaming, videoRef, startBarcodeFor, stopBarcode } = props;
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-3">
      <div className="rounded-xl border border-info/30 bg-info/5 p-3 flex items-center gap-3">
        <BarcodeIcon className="h-5 w-5 text-info" />
        <div className="text-xs">
          <p className="font-medium text-foreground">Optional barcode verification</p>
          <p className="text-muted-foreground">Scan the physical pack to confirm medicine, batch, and strength match. Skip if not required.</p>
        </div>
      </div>

      {streaming && (
        <div className="rounded-xl border border-border bg-black overflow-hidden">
          <video ref={videoRef} playsInline muted className="w-full max-h-[50vh] object-contain" />
          <div className="p-3 flex justify-center">
            <Button variant="outline" onClick={stopBarcode}>Cancel</Button>
          </div>
        </div>
      )}

      {rows.map((r) => {
        const med = medicines.find((m) => m.id === r.matchId);
        if (!med) return null;
        return (
          <div key={r.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{med.name}{med.strength ? ` · ${med.strength}` : ""}</p>
              <p className="text-[11px] text-muted-foreground">Stored barcode: {med.barcode || "none on file"}</p>
            </div>
            {r.barcodeVerified ? (
              <Badge variant="outline" className="border-success/40 text-success gap-1"><CheckCircle2 className="h-3 w-3" /> Verified</Badge>
            ) : med.barcode ? (
              <Button size="sm" variant="outline" className="gap-1" onClick={() => startBarcodeFor(r.id)}>
                <BarcodeIcon className="h-4 w-4" /> Scan
              </Button>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">No barcode on file</Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}
function TransactionStep(props: {
  saleType: SaleType;
  setSaleType: (s: SaleType) => void;
  info: PatientInfo;
  setInfo: React.Dispatch<React.SetStateAction<PatientInfo>>;
  search: string;
  setSearch: (v: string) => void;
  matches: any[];
  searching: boolean;
  onPick: (p: any) => void;
  onQuickRegister: () => void;
}) {
  const { saleType, setSaleType, info, setInfo, search, setSearch, matches, searching, onPick, onQuickRegister } = props;
  const tabs: { key: SaleType; label: string; desc: string }[] = [
    { key: "OP", label: "OP Sale", desc: "Outpatient — link UHID / Mobile / OP #" },
    { key: "IP", label: "IP Sale", desc: "Inpatient — link IP # / Ward / Bed" },
    { key: "Direct", label: "Direct Sale", desc: "OTC — patient details optional" },
    { key: "Return", label: "Return", desc: "Refund / replacement" },
  ];
  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {tabs.map((t) => (
          <button
            key={t.key} type="button"
            onClick={() => setSaleType(t.key)}
            className={cn(
              "rounded-xl border-2 p-3 text-left transition-all",
              saleType === t.key
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:border-primary/40",
            )}
          >
            <p className="font-semibold text-sm">{t.label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</p>
          </button>
        ))}
      </div>

      {(saleType === "OP" || saleType === "IP" || saleType === "Return") && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" /> Find patient
          </h3>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              saleType === "IP"
                ? "Search by IP #, Ward, Bed, Patient Name…"
                : "Search by UHID, Mobile, OP #, or Name…"
            }
            className="h-10"
          />
          {searching && (
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> searching…
            </p>
          )}
          {matches.length > 0 && (
            <div className="rounded-md border border-border bg-popover divide-y divide-border max-h-60 overflow-auto">
              {matches.map((m) => (
                <button
                  key={m.id} type="button"
                  onClick={() => onPick(m)}
                  className="w-full text-left px-3 py-2 hover:bg-accent text-xs"
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="text-muted-foreground"> · {m.mobile} · {m.registrationNumber}</span>
                  {m.age && <span className="text-muted-foreground"> · {m.age}y</span>}
                  {m.gender && <span className="text-muted-foreground"> · {m.gender}</span>}
                </button>
              ))}
            </div>
          )}
          {info.patientId && (
            <div className="rounded-lg border border-success/40 bg-success/5 p-3 text-xs">
              <p className="font-medium text-success flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Linked: {info.name}
              </p>
              <p className="text-muted-foreground mt-0.5">
                {info.opIp ? `Reg # ${info.opIp}` : ""}
                {info.mobile ? ` · ${info.mobile}` : ""}
                {info.age ? ` · ${info.age}y` : ""}
                {info.gender ? ` · ${info.gender}` : ""}
              </p>
            </div>
          )}

          {!info.patientId && (
            <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
              <p className="text-xs font-medium text-foreground">No match? Quick register</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input placeholder="Name *" value={info.name} onChange={(e) => setInfo((p) => ({ ...p, name: e.target.value }))} className="h-9" />
                <Input placeholder="Mobile *" value={info.mobile} onChange={(e) => setInfo((p) => ({ ...p, mobile: e.target.value }))} className="h-9" />
                <Input placeholder="Age" value={info.age} onChange={(e) => setInfo((p) => ({ ...p, age: e.target.value }))} className="h-9" />
              </div>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" className="gap-1" onClick={onQuickRegister}>
                  <Plus className="h-3.5 w-3.5" /> Register Patient
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {saleType === "Direct" && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Walk-in customer (optional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Customer Name</Label>
              <Input value={info.name} onChange={(e) => setInfo((p) => ({ ...p, name: e.target.value }))} className="h-9" placeholder="Optional" />
            </div>
            <div>
              <Label className="text-xs">Mobile</Label>
              <Input value={info.mobile} onChange={(e) => setInfo((p) => ({ ...p, mobile: e.target.value }))} className="h-9" placeholder="Optional" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">OTC sale — no prescription link required.</p>
        </div>
      )}
    </div>
  );
}
