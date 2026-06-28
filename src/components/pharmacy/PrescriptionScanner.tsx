import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Upload, Camera, FileText, Image as ImageIcon, Loader2,
  CheckCircle2, AlertTriangle, ScanLine, ArrowLeft, ArrowRight,
  ShieldCheck, Pill, RefreshCw, User as UserIcon, Stethoscope, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMedicines } from "@/modules/pharmacy/hooks";
import { buildIndex, searchMedicines, stockStatus, isExpired } from "@/modules/pharmacy/smartSearch";
import type { Medicine as DbMedicine } from "@/modules/pharmacy/types";

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
  /** snapshot of prescription line for audit */
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
  /** matched/selected inventory medicine */
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
};

type Step = "upload" | "extracting" | "review" | "verify";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Patient context if pharmacy already has one selected */
  patient?: { id?: string; name?: string; mobile?: string; registrationNumber?: string } | null;
  /** Called once pharmacist has verified everything. Apply items to the cart. */
  onApply: (result: PrescriptionScanResult) => void;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────────── */

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); res(s.split(",")[1] || s); };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function deviceInfo() {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  return ua.slice(0, 180);
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

/* ──────────────────────────────────────────────────────────────────────────
 * Component
 * ────────────────────────────────────────────────────────────────────────── */

export function PrescriptionScanner({ open, onClose, patient, onApply }: Props) {
  const { user, profile } = useAuth();
  const { data: medicines = [] } = useMedicines();

  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [filePreview, setFilePreview] = useState<string>("");
  const [fileMime, setFileMime] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [fileBase64, setFileBase64] = useState<string>("");
  const [storagePath, setStoragePath] = useState<string>("");

  const [aiPayload, setAiPayload] = useState<any>(null);
  const [patientName, setPatientName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [rxDate, setRxDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<RowState[]>([]);

  const [scanId, setScanId] = useState<string>("");
  const [streamingCamera, setStreamingCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fuse = useMemo(() => buildIndex(medicines as DbMedicine[]), [medicines]);

  const reset = useCallback(() => {
    setStep("upload"); setBusy(false);
    setFilePreview(""); setFileMime(""); setFileName(""); setFileBase64(""); setStoragePath("");
    setAiPayload(null); setRows([]);
    setPatientName(patient?.name || ""); setDoctorName(""); setHospitalName("");
    setRxDate(new Date().toISOString().slice(0, 10));
    setScanId("");
    stopCamera();
  }, [patient?.name]);

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

  function doClose() { stopCamera(); onClose(); }

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
    stopCamera();
    await handleFile(file);
  }

  /* ── File intake ── */
  async function handleFile(file: File) {
    const ok = file.type.startsWith("image/") || file.type === "application/pdf" ||
      /\.(jpe?g|png|webp|heic|pdf)$/i.test(file.name);
    if (!ok) { toast.error("Use an image (JPG/PNG) or PDF prescription"); return; }
    setBusy(true);
    try {
      const b64 = await fileToBase64(file);
      setFileBase64(b64);
      setFileMime(file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "image/jpeg"));
      setFileName(file.name);
      setFilePreview(file.type.startsWith("image/") ? `data:${file.type};base64,${b64}` : "");
      setStep("extracting");
      await runExtraction(b64, file.type, file.name);
    } catch (e: any) {
      toast.error(e?.message || "Failed to read file");
      setStep("upload");
    } finally { setBusy(false); }
  }

  /* ── AI Extraction ── */
  async function runExtraction(b64: string, mime: string, name: string) {
    try {
      const { data, error } = await supabase.functions.invoke("prescription-scan-ai", {
        body: { fileBase64: b64, mimeType: mime || "image/jpeg" },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.error === "credits_exhausted") throw new Error("AI credits exhausted. Add credits to continue.");
        if (data.error === "rate_limited") throw new Error("Rate limited — retry shortly.");
        throw new Error(data.error);
      }
      if (data?.documentType !== "prescription" || !Array.isArray(data?.medicines) || data.medicines.length === 0) {
        toast.warning("AI couldn't detect prescribed medicines. Try a clearer image.");
        setStep("upload");
        return;
      }

      // Upload original for audit
      let path = "";
      if (user) {
        try {
          const blob = await (await fetch(`data:${mime || "image/jpeg"};base64,${b64}`)).blob();
          const p = `${user.id}/${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const { error: upErr } = await supabase.storage.from("prescriptions").upload(p, blob, { contentType: mime || "image/jpeg", upsert: false });
          if (!upErr) path = p;
        } catch { /* non-fatal */ }
      }
      setStoragePath(path);
      setAiPayload(data);

      setPatientName(data?.patient?.name?.value || patient?.name || "");
      setDoctorName(data?.doctor?.name?.value || "");
      setHospitalName(data?.hospital?.name?.value || "");
      setRxDate(data?.prescriptionDate?.value || new Date().toISOString().slice(0, 10));

      const mapped: RowState[] = (data.medicines as AiMedicine[]).map((m, i) => {
        const q = `${m.name || ""} ${m.strength || ""}`.trim();
        const hits = searchMedicines(q, medicines as DbMedicine[], fuse, new Map(), 5);
        const top = hits[0]?.medicine || null;
        const alts = hits.slice(0, 5).map((h) => h.medicine);
        return {
          ...m,
          id: `${i}-${(m.name || "rx")}`,
          matchId: top?.id || null,
          matchAlternatives: alts,
          pickedQty: Math.max(1, Number(m.quantity) || 1),
          substituted: false,
          verified: blankVerify(),
          dropped: false,
        };
      });
      setRows(mapped);

      // Persist scan record (status = extracted)
      const { data: scanRec, error: insErr } = await supabase.from("prescription_scans").insert({
        scanned_by: user?.id ?? null,
        scanned_by_name: profile?.full_name || user?.email || "",
        patient_id: patient?.id ?? null,
        patient_name: data?.patient?.name?.value || patient?.name || "",
        registration_number: patient?.registrationNumber || "",
        doctor_name: data?.doctor?.name?.value || "",
        hospital_name: data?.hospital?.name?.value || "",
        prescription_date: data?.prescriptionDate?.value || null,
        source_file_path: path || null,
        source_file_mime: mime || null,
        extracted_payload: data,
        device_info: deviceInfo(),
        status: "extracted",
      } as any).select("id").single();
      if (insErr) console.warn("scan insert failed", insErr);
      else setScanId(scanRec.id);

      setStep("review");
    } catch (e: any) {
      toast.error(e?.message || "AI extraction failed");
      setStep("upload");
    }
  }

  /* ── Row mutations ── */
  function updateRow(id: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
  }
  function setMatch(id: string, medId: string) {
    const med = (medicines as DbMedicine[]).find((m) => m.id === medId);
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const substituted = !!r.name && !!med && med.name.toLowerCase() !== (r.brandName || r.name).toLowerCase();
      return { ...r, matchId: medId, substituted };
    }));
  }
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

  const verifiableRows = rows.filter((r) => !r.dropped);
  const allVerified = verifiableRows.length > 0 && verifiableRows.every(isFullyVerified);
  const verifiedCount = verifiableRows.filter(isFullyVerified).length;

  /* ── Apply to cart ── */
  async function applyToCart() {
    if (!patientName.trim()) { toast.error("Patient name is required"); return; }
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

    // Update scan record
    if (scanId) {
      await supabase.from("prescription_scans").update({
        verified_by: user?.id ?? null,
        verified_by_name: profile?.full_name || user?.email || "",
        patient_name: patientName,
        doctor_name: doctorName,
        hospital_name: hospitalName,
        prescription_date: rxDate || null,
        verified_items: verifiedItems as any,
        substitutions: verifiableRows.filter((r) => r.substituted).map((r) => ({
          prescribed: r.name, dispensed_id: r.matchId,
        })) as any,
        status: "verified",
      } as any).eq("id", scanId);
    }

    onApply({
      scanId,
      patient: { name: patientName, mobile: patient?.mobile, age: aiPayload?.patient?.age?.value, gender: aiPayload?.patient?.gender?.value },
      doctor: { name: doctorName },
      hospital: { name: hospitalName },
      prescriptionDate: rxDate,
      items: verifiedItems,
    });
    toast.success(`${verifiedItems.length} verified medicine(s) added to cart`);
    doClose();
  }

  /* ──────────────────────────────────────────────────────────────────── */

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
              {step === "upload" && "Upload, scan, or photograph the prescription"}
              {step === "extracting" && "AI is reading the prescription…"}
              {step === "review" && `${rows.length} medicine(s) detected — match & verify`}
              {step === "verify" && "Final pharmacist verification"}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={doClose}><X className="h-5 w-5" /></Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {step === "upload" && (
          <UploadStep
            busy={busy}
            streaming={streamingCamera}
            videoRef={videoRef}
            onPick={() => fileInputRef.current?.click()}
            onStartCamera={startCamera}
            onCapture={captureFromCamera}
            onStopCamera={stopCamera}
          />
        )}

        {step === "extracting" && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Reading prescription with AI…</p>
            {filePreview && <img src={filePreview} alt="prescription" className="mt-4 max-h-72 rounded-lg border border-border" />}
          </div>
        )}

        {step === "review" && (
          <ReviewStep
            filePreview={filePreview}
            fileMime={fileMime}
            fileName={fileName}
            patientName={patientName} setPatientName={setPatientName}
            doctorName={doctorName} setDoctorName={setDoctorName}
            hospitalName={hospitalName} setHospitalName={setHospitalName}
            rxDate={rxDate} setRxDate={setRxDate}
            rows={rows} medicines={medicines as DbMedicine[]}
            updateRow={updateRow} setMatch={setMatch}
            onNext={() => setStep("verify")}
          />
        )}

        {step === "verify" && (
          <VerifyStep
            rows={rows} medicines={medicines as DbMedicine[]}
            toggleVerify={toggleVerify} verifyAll={verifyAll}
            updateRow={updateRow}
            verifiedCount={verifiedCount} total={verifiableRows.length}
          />
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-card/80 px-4 py-3 flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {step === "review" && "AI prepares · Pharmacist verifies · System records"}
          {step === "verify" && `${verifiedCount}/${verifiableRows.length} verified`}
        </div>
        <div className="flex items-center gap-2">
          {step === "review" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Re-upload
              </Button>
              <Button
                disabled={!rows.some((r) => !r.dropped && r.matchId)}
                onClick={() => setStep("verify")}
                className="gap-2"
              >
                Continue to Verify <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}
          {step === "verify" && (
            <>
              <Button variant="outline" onClick={() => setStep("review")} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                onClick={applyToCart}
                disabled={!allVerified}
                className="gap-2"
              >
                <ShieldCheck className="h-4 w-4" /> Add Verified Items to Cart
              </Button>
            </>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef} type="file"
        accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }}
      />
    </div>,
    document.body,
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Sub views
 * ────────────────────────────────────────────────────────────────────────── */

function UploadStep(props: {
  busy: boolean;
  streaming: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  onPick: () => void;
  onStartCamera: () => void;
  onCapture: () => void;
  onStopCamera: () => void;
}) {
  const { busy, streaming, videoRef, onPick, onStartCamera, onCapture, onStopCamera } = props;
  return (
    <div className="max-w-3xl mx-auto p-6">
      {streaming ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-border overflow-hidden bg-black">
            <video ref={videoRef} playsInline muted className="w-full max-h-[60vh] object-contain" />
          </div>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={onStopCamera}>Cancel</Button>
            <Button onClick={onCapture} className="gap-2"><Camera className="h-4 w-4" /> Capture Prescription</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={onStartCamera} disabled={busy}
            className="rounded-xl border-2 border-primary/30 bg-primary/5 hover:border-primary p-6 text-center transition-all"
          >
            <Camera className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="font-semibold text-sm">Scan with Camera</p>
            <p className="text-xs text-muted-foreground mt-1">Use device camera for handwritten Rx</p>
          </button>
          <button
            onClick={onPick} disabled={busy}
            className="rounded-xl border-2 border-info/30 bg-info/5 hover:border-info p-6 text-center transition-all"
          >
            <ImageIcon className="h-8 w-8 text-info mx-auto mb-2" />
            <p className="font-semibold text-sm">Upload from Gallery</p>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP, HEIC</p>
          </button>
          <button
            onClick={onPick} disabled={busy}
            className="rounded-xl border-2 border-warning/30 bg-warning/5 hover:border-warning p-6 text-center transition-all"
          >
            <FileText className="h-8 w-8 text-warning mx-auto mb-2" />
            <p className="font-semibold text-sm">Upload PDF</p>
            <p className="text-xs text-muted-foreground mt-1">Scanned or e-prescription PDFs</p>
          </button>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1 flex items-center gap-1"><ScanLine className="h-3.5 w-3.5" /> Tips for accurate handwriting recognition</p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>Good lighting, no shadows, full prescription in frame.</li>
          <li>Place flat — avoid wrinkles or folds.</li>
          <li>Multi-page PDFs are supported.</li>
        </ul>
      </div>
    </div>
  );
}

function ReviewStep(props: {
  filePreview: string;
  fileMime: string;
  fileName: string;
  patientName: string; setPatientName: (v: string) => void;
  doctorName: string; setDoctorName: (v: string) => void;
  hospitalName: string; setHospitalName: (v: string) => void;
  rxDate: string; setRxDate: (v: string) => void;
  rows: RowState[]; medicines: DbMedicine[];
  updateRow: (id: string, patch: Partial<RowState>) => void;
  setMatch: (id: string, medId: string) => void;
  onNext: () => void;
}) {
  const {
    filePreview, fileMime, fileName,
    patientName, setPatientName, doctorName, setDoctorName,
    hospitalName, setHospitalName, rxDate, setRxDate,
    rows, medicines, updateRow, setMatch,
  } = props;

  return (
    <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      {/* Original preview */}
      <div className="rounded-xl border border-border bg-card p-3 sticky top-0 self-start">
        <p className="text-xs text-muted-foreground mb-2 truncate">{fileName || "Original prescription"}</p>
        {filePreview ? (
          <img src={filePreview} alt="Rx" className="w-full rounded-md border border-border" />
        ) : (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            <FileText className="h-6 w-6 mx-auto mb-2" /> {fileMime || "PDF"} stored for audit
          </div>
        )}
      </div>

      {/* Extracted */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <UserIcon className="h-4 w-4 text-primary" /> Prescription Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Patient Name *</Label>
              <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Doctor</Label>
              <Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Hospital</Label>
              <Input value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={rxDate} onChange={(e) => setRxDate(e.target.value)} className="h-9" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Pill className="h-4 w-4 text-primary" /> Extracted Medicines ({rows.length})
            </h3>
            <Badge variant="outline" className="text-[10px]">Inventory matched automatically</Badge>
          </div>
          <div className="divide-y divide-border">
            {rows.map((r) => {
              const med = medicines.find((m) => m.id === r.matchId);
              const status = statusBadge(med, r.pickedQty);
              return (
                <div key={r.id} className={cn("p-4", r.dropped && "opacity-50")}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <p className="font-semibold text-sm">{r.name || "Unnamed medicine"}{r.strength ? ` · ${r.strength}` : ""}</p>
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
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {[r.dosage, r.frequency, r.duration].filter(Boolean).join(" · ") || "Doctor instructions unavailable"}
                        {r.instructions ? ` — ${r.instructions}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn(
                        "text-[11px]",
                        status.tone === "success" && "border-success/40 text-success",
                        status.tone === "warning" && "border-warning/40 text-warning",
                        status.tone === "destructive" && "border-destructive/40 text-destructive",
                      )}>{status.icon} {status.label}</Badge>
                      <Button
                        variant="ghost" size="sm" className="text-xs"
                        onClick={() => updateRow(r.id, { dropped: !r.dropped })}
                      >{r.dropped ? "Restore" : "Drop"}</Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_140px] gap-3">
                    <div>
                      <Label className="text-xs">Dispense from inventory</Label>
                      <Select value={r.matchId || ""} onValueChange={(v) => setMatch(r.id, v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Pick a stocked medicine" /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          {r.matchAlternatives.length === 0 && (
                            <SelectItem disabled value="__none">No matches in stock</SelectItem>
                          )}
                          {r.matchAlternatives.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}{m.strength ? ` · ${m.strength}` : ""} · stock {m.stock} {m.genericName ? `· ${m.genericName}` : ""}
                            </SelectItem>
                          ))}
                          {/* Manual search fallback list — last 10 inventory items beyond alternatives */}
                          {medicines.slice(0, 30).filter((m) => !r.matchAlternatives.find((a) => a.id === m.id)).map((m) => (
                            <SelectItem key={`alt-${m.id}`} value={m.id}>
                              {m.name}{m.strength ? ` · ${m.strength}` : ""} · stock {m.stock}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {med && med.batchNo && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Batch {med.batchNo}{med.expiryDate ? ` · Exp ${med.expiryDate}` : ""}{med.rackLocation ? ` · Rack ${med.rackLocation}` : ""}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        type="number" min={1}
                        value={r.pickedQty}
                        onChange={(e) => updateRow(r.id, { pickedQty: Math.max(1, Number(e.target.value) || 1) })}
                        className="h-9"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline" size="sm" className="h-9 w-full text-xs gap-1"
                        onClick={() => {
                          const q = `${r.genericName || r.name || ""}`.trim();
                          const hits = searchMedicines(q, medicines, buildIndex(medicines), new Map(), 8);
                          updateRow(r.id, { matchAlternatives: hits.map((h) => h.medicine) });
                          toast.info(`${hits.length} alternative(s) shown`);
                        }}
                      ><RefreshCw className="h-3 w-3" /> Suggest</Button>
                    </div>
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
  updateRow: (id: string, patch: Partial<RowState>) => void;
  verifiedCount: number; total: number;
}) {
  const { rows, medicines, toggleVerify, verifyAll, updateRow, verifiedCount, total } = props;
  return (
    <div className="max-w-5xl mx-auto p-4 space-y-3">
      <div className="rounded-xl border border-info/30 bg-info/5 p-3 flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-info" />
        <div className="text-xs">
          <p className="font-medium text-foreground">Pharmacist mandatory verification</p>
          <p className="text-muted-foreground">Tick every box for every medicine before adding to cart. AI never dispenses automatically.</p>
        </div>
        <Badge variant="outline" className="ml-auto">{verifiedCount}/{total} verified</Badge>
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
                  <Checkbox
                    checked={r.verified[k]}
                    onCheckedChange={(v) => toggleVerify(r.id, k, !!v)}
                  />
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