import { useState, useMemo, useRef, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  BedDouble, Search, Plus, User, Phone, Stethoscope, FileText, ArrowLeftRight,
  IndianRupee, Clock, CheckCircle, AlertTriangle, Edit, Trash2, Eye, Activity,
  ClipboardList, Pill, Scissors, Microscope, Receipt, ChevronRight, Printer,
  UserPlus, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  bedStatusColors, wardTypeColors,
  type Ward, type Bed, type BedStatus, type IPDAdmission, type AdmissionStatus,
  type DoctorVisitNote, type NurseNote, type MedicineEntry, type SurgicalEntry,
  type DiagnosticEntry, type BedTransfer, type DischargeSummary,
} from "@/data/mockIPDData";
import { useWardsBeds } from "@/contexts/WardsBedContext";
import { useAdmissions } from "@/modules/ipd/hooks";
import { ipdService } from "@/modules/ipd/services";
import { usePatients } from "@/modules/patients/hooks";
import { useStaffMembers } from "@/modules/staff/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

const admissionStatusColors: Record<AdmissionStatus, string> = {
  Active: "bg-success/10 text-success border-success/30",
  Discharged: "bg-info/10 text-info border-info/30",
  LAMA: "bg-warning/10 text-warning border-warning/30",
  Expired: "bg-destructive/10 text-destructive border-destructive/30",
};

const IPD = () => {
  const { wards, beds, setBeds } = useWardsBeds();
  const { data: dbAdmissions, refetch: refetchAdmissions } = useAdmissions();
  const { data: patientsData } = usePatients();
  const { data: staffData } = useStaffMembers();
  const { roles } = useAuth();
  const hospitalId = roles?.[0]?.hospital_id || "";
  const queryClient = useQueryClient();
  const dbPatients = patientsData || [];
  const dbDoctors = (staffData || []).filter((s: any) => s.role === "Doctor" || s.designation?.toLowerCase().includes("doctor")).map((s: any) => ({ id: s.id, name: s.name, specialization: s.specialization || "" }));

  const [activeTab, setActiveTab] = useState("admissions");
  const [admissions, setAdmissions] = useState<IPDAdmission[]>([]);
  const [doctorNotes, setDoctorNotes] = useState<DoctorVisitNote[]>([]);
  const [nurseNotes, setNurseNotes] = useState<NurseNote[]>([]);
  const [medicineEntries, setMedicineEntries] = useState<MedicineEntry[]>([]);
  const [surgicalEntries, setSurgicalEntries] = useState<SurgicalEntry[]>([]);
  const [diagnosticEntries, setDiagnosticEntries] = useState<DiagnosticEntry[]>([]);
  const [bedTransfers, setBedTransfers] = useState<BedTransfer[]>([]);
  const [dischargeSummaries, setDischargeSummaries] = useState<DischargeSummary[]>([]);

  useEffect(() => {
    if (dbAdmissions) {
      setAdmissions(dbAdmissions.map((a: any) => ({
        id: a.id, patientId: a.patientId || a.id, patientName: a.patientName,
        registrationNumber: a.registrationNumber, age: a.age || 0,
        gender: a.gender || "", contactNumber: a.contactNumber || "",
        referredBy: a.referredBy || "", admittingDoctor: a.admittingDoctor,
        department: a.department || "", diagnosis: a.diagnosis || "",
        wardId: a.wardId || "", wardName: a.wardName || "",
        bedId: a.bedId || "", bedNumber: a.bedNumber || "",
        admissionDate: a.admissionDate, dischargeDate: a.dischargeDate,
        status: a.status, emergencyContact: a.emergencyContact || "",
        insuranceInfo: a.insuranceInfo || "",
      })));
    }
  }, [dbAdmissions]);

  // Filters
  const [admSearch, setAdmSearch] = useState("");
  const [admStatusFilter, setAdmStatusFilter] = useState("all");
  const [selectedAdmission, setSelectedAdmission] = useState<IPDAdmission | null>(null);
  const [bedWardFilter, setBedWardFilter] = useState("all");
  const [bedStatusFilter, setBedStatusFilter] = useState("all");

  // Dialogs
  const [showAdmitDialog, setShowAdmitDialog] = useState(false);
  const [showDoctorNoteDialog, setShowDoctorNoteDialog] = useState(false);
  const [showNurseNoteDialog, setShowNurseNoteDialog] = useState(false);
  const [showMedicineDialog, setShowMedicineDialog] = useState(false);
  const [showSurgicalDialog, setShowSurgicalDialog] = useState(false);
  const [showDiagnosticDialog, setShowDiagnosticDialog] = useState(false);
  const [showBedTransferDialog, setShowBedTransferDialog] = useState(false);
  const [showDischargeDialog, setShowDischargeDialog] = useState(false);
  const [showBillDialog, setShowBillDialog] = useState(false);
  const [showBedAllocateDialog, setShowBedAllocateDialog] = useState(false);
  const [showDischargeSummaryDialog, setShowDischargeSummaryDialog] = useState(false);
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [viewingDischarge, setViewingDischarge] = useState<DischargeSummary | null>(null);

  // Print ref
  const printRef = useRef<HTMLDivElement>(null);

  // Forms
  const [admitForm, setAdmitForm] = useState<Partial<IPDAdmission>>({});
  const [noteForm, setNoteForm] = useState({ doctor: "", notes: "", instructions: "" });
  const [nurseForm, setNurseForm] = useState({ nurse: "", bp: "", temp: "", pulse: "", spo2: "", notes: "" });
  const [medForm, setMedForm] = useState({ medicineName: "", dosage: "", frequency: "OD", quantity: 1, unitPrice: 0 });
  const [surgForm, setSurgForm] = useState({ procedureName: "", surgeon: "", notes: "", cost: 0 });
  const [diagForm, setDiagForm] = useState({ testName: "", cost: 0 });
  const [transferForm, setTransferForm] = useState({ toWard: "", toBed: "", reason: "" });
  const [dischargeForm, setDischargeForm] = useState({ conditionAtDischarge: "", finalDiagnosis: "", treatmentSummary: "", followUpDate: "", followUpInstructions: "", medicationsOnDischarge: "" });
  const [allocateForm, setAllocateForm] = useState({ patientId: "", admittingDoctor: "", department: "", diagnosis: "", referredBy: "", insuranceInfo: "" });

  // ──── Computed ────
  const filteredAdmissions = useMemo(() => admissions.filter((a) => {
    const matchSearch = !admSearch || a.patientName.toLowerCase().includes(admSearch.toLowerCase()) || a.registrationNumber.toLowerCase().includes(admSearch.toLowerCase());
    const matchStatus = admStatusFilter === "all" || a.status === admStatusFilter;
    return matchSearch && matchStatus;
  }), [admissions, admSearch, admStatusFilter]);

  const activeAdmissions = admissions.filter((a) => a.status === "Active");
  const totalBeds = beds.length;
  const occupiedBeds = beds.filter((b) => b.status === "Occupied").length;
  const availableBeds = beds.filter((b) => b.status === "Available").length;

  // Get entries for selected admission
  const admDoctorNotes = selectedAdmission ? doctorNotes.filter((n) => n.admissionId === selectedAdmission.id) : [];
  const admNurseNotes = selectedAdmission ? nurseNotes.filter((n) => n.admissionId === selectedAdmission.id) : [];
  const admMedicines = selectedAdmission ? medicineEntries.filter((m) => m.admissionId === selectedAdmission.id) : [];
  const admSurgicals = selectedAdmission ? surgicalEntries.filter((s) => s.admissionId === selectedAdmission.id) : [];
  const admDiagnostics = selectedAdmission ? diagnosticEntries.filter((d) => d.admissionId === selectedAdmission.id) : [];
  const admTransfers = selectedAdmission ? bedTransfers.filter((t) => t.admissionId === selectedAdmission.id) : [];
  const admDischarge = selectedAdmission ? dischargeSummaries.find((d) => d.admissionId === selectedAdmission.id) : undefined;

  // Bill calculation
  const billBreakdown = useMemo(() => {
    if (!selectedAdmission) return null;
    const ward = wards.find((w) => w.id === selectedAdmission.wardId);
    const admDate = new Date(selectedAdmission.admissionDate);
    const endDate = selectedAdmission.dischargeDate ? new Date(selectedAdmission.dischargeDate) : new Date();
    const days = Math.max(1, Math.ceil((endDate.getTime() - admDate.getTime()) / (1000 * 60 * 60 * 24)));
    const wardCharges = days * (ward?.chargePerDay || 0);
    const medTotal = admMedicines.reduce((s, m) => s + m.total, 0);
    const surgTotal = admSurgicals.reduce((s, m) => s + m.cost, 0);
    const diagTotal = admDiagnostics.reduce((s, m) => s + m.cost, 0);
    return { days, wardCharges, medTotal, surgTotal, diagTotal, grandTotal: wardCharges + medTotal + surgTotal + diagTotal };
  }, [selectedAdmission, admMedicines, admSurgicals, admDiagnostics, wards]);

  // Bill for any admission (for discharge summary view)
  const getBillForAdmission = (adm: IPDAdmission) => {
    const ward = wards.find((w) => w.id === adm.wardId);
    const admDate = new Date(adm.admissionDate);
    const endDate = adm.dischargeDate ? new Date(adm.dischargeDate) : new Date();
    const days = Math.max(1, Math.ceil((endDate.getTime() - admDate.getTime()) / (1000 * 60 * 60 * 24)));
    const wardCharges = days * (ward?.chargePerDay || 0);
    const meds = medicineEntries.filter((m) => m.admissionId === adm.id);
    const surgs = surgicalEntries.filter((s) => s.admissionId === adm.id);
    const diags = diagnosticEntries.filter((d) => d.admissionId === adm.id);
    const medTotal = meds.reduce((s, m) => s + m.total, 0);
    const surgTotal = surgs.reduce((s, m) => s + m.cost, 0);
    const diagTotal = diags.reduce((s, m) => s + m.cost, 0);
    return { days, wardCharges, medTotal, surgTotal, diagTotal, grandTotal: wardCharges + medTotal + surgTotal + diagTotal, meds, surgs, diags };
  };

  // ──── Handlers ────
  const handleBedClick = (bed: Bed) => {
    if (bed.status === "Available") {
      setSelectedBed(bed);
      setAllocateForm({ patientId: "", admittingDoctor: "", department: "", diagnosis: "", referredBy: "", insuranceInfo: "" });
      setShowBedAllocateDialog(true);
    } else if (bed.status === "Occupied" && bed.admissionId) {
      const adm = admissions.find((a) => a.id === bed.admissionId);
      if (adm) {
        setSelectedAdmission(adm);
        setActiveTab("daily-entries");
      }
    }
  };

  const handleAllocateBed = () => {
    if (!selectedBed || !allocateForm.patientId || !allocateForm.admittingDoctor) {
      toast.error("Patient and doctor are required"); return;
    }
    const patient = dbPatients.find((p: any) => p.id === allocateForm.patientId);
    const ward = wards.find((w) => w.id === selectedBed.wardId);
    if (!patient || !ward) return;

    const newAdm: IPDAdmission = {
      id: `adm-${Date.now()}`, patientId: patient.id, patientName: patient.name,
      registrationNumber: patient.registrationNumber, age: new Date().getFullYear() - new Date(patient.dob).getFullYear(),
      gender: patient.gender, contactNumber: patient.mobile, referredBy: allocateForm.referredBy,
      admittingDoctor: allocateForm.admittingDoctor, department: allocateForm.department || "General Medicine",
      diagnosis: allocateForm.diagnosis || "", wardId: ward.id, wardName: ward.name,
      bedId: selectedBed.id, bedNumber: selectedBed.bedNumber, admissionDate: new Date().toLocaleString(),
      status: "Active", emergencyContact: patient.emergencyContact, insuranceInfo: allocateForm.insuranceInfo || undefined,
    };
    setAdmissions((prev) => [newAdm, ...prev]);
    setBeds((prev) => prev.map((b) => b.id === selectedBed.id ? { ...b, status: "Occupied" as BedStatus, patientId: patient.id, patientName: patient.name, admissionId: newAdm.id } : b));
    toast.success(`${patient.name} admitted to ${ward.name} - ${selectedBed.bedNumber}`);
    setShowBedAllocateDialog(false);
    setSelectedBed(null);
  };

  const handleAdmit = () => {
    if (!admitForm.patientId || !admitForm.admittingDoctor) {
      toast.error("Patient and doctor are required"); return;
    }
    // Find first available bed
    const availableBed = beds.find((b) => b.status === "Available");
    if (!availableBed) { toast.error("No beds available. Please free up a bed first."); return; }

    const patient = dbPatients.find((p: any) => p.id === admitForm.patientId);
    const ward = wards.find((w) => w.id === availableBed.wardId);
    if (!patient || !ward) return;

    const newAdm: IPDAdmission = {
      id: `adm-${Date.now()}`, patientId: patient.id, patientName: patient.name,
      registrationNumber: patient.registrationNumber, age: new Date().getFullYear() - new Date(patient.dob).getFullYear(),
      gender: patient.gender, contactNumber: patient.mobile, referredBy: admitForm.referredBy || "",
      admittingDoctor: admitForm.admittingDoctor || "", department: admitForm.department || "General Medicine",
      diagnosis: admitForm.diagnosis || "", wardId: ward.id, wardName: ward.name,
      bedId: availableBed.id, bedNumber: availableBed.bedNumber, admissionDate: new Date().toLocaleString(),
      status: "Active", emergencyContact: patient.emergencyContact, insuranceInfo: admitForm.insuranceInfo,
    };
    setAdmissions((prev) => [newAdm, ...prev]);
    setBeds((prev) => prev.map((b) => b.id === availableBed.id ? { ...b, status: "Occupied" as BedStatus, patientId: patient.id, patientName: patient.name, admissionId: newAdm.id } : b));
    toast.success(`${patient.name} admitted — assigned to ${ward.name} / ${availableBed.bedNumber}. You can transfer bed from Bed Management.`);
    setShowAdmitDialog(false);
    setAdmitForm({});
  };

  const handleAddDoctorNote = () => {
    if (!selectedAdmission || !noteForm.notes) { toast.error("Notes required"); return; }
    const note: DoctorVisitNote = {
      id: `dn-${Date.now()}`, admissionId: selectedAdmission.id,
      date: new Date().toISOString().split("T")[0], time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      doctor: noteForm.doctor || "Dr. Unknown", notes: noteForm.notes, instructions: noteForm.instructions,
    };
    setDoctorNotes((prev) => [...prev, note]);
    toast.success("Doctor note added");
    setShowDoctorNoteDialog(false);
    setNoteForm({ doctor: "", notes: "", instructions: "" });
  };

  const handleAddNurseNote = () => {
    if (!selectedAdmission) return;
    const note: NurseNote = {
      id: `nn-${Date.now()}`, admissionId: selectedAdmission.id,
      date: new Date().toISOString().split("T")[0], time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      nurse: nurseForm.nurse || "Nurse", vitals: { bp: nurseForm.bp, temp: nurseForm.temp, pulse: nurseForm.pulse, spo2: nurseForm.spo2 },
      notes: nurseForm.notes,
    };
    setNurseNotes((prev) => [...prev, note]);
    toast.success("Nurse note added");
    setShowNurseNoteDialog(false);
    setNurseForm({ nurse: "", bp: "", temp: "", pulse: "", spo2: "", notes: "" });
  };

  const handleAddMedicine = () => {
    if (!selectedAdmission || !medForm.medicineName) { toast.error("Medicine name required"); return; }
    const entry: MedicineEntry = {
      id: `me-${Date.now()}`, admissionId: selectedAdmission.id,
      date: new Date().toISOString().split("T")[0], medicineName: medForm.medicineName,
      dosage: medForm.dosage, frequency: medForm.frequency, quantity: medForm.quantity,
      unitPrice: medForm.unitPrice, total: medForm.quantity * medForm.unitPrice,
    };
    setMedicineEntries((prev) => [...prev, entry]);
    toast.success("Medicine entry added");
    setShowMedicineDialog(false);
    setMedForm({ medicineName: "", dosage: "", frequency: "OD", quantity: 1, unitPrice: 0 });
  };

  const handleAddSurgical = () => {
    if (!selectedAdmission || !surgForm.procedureName) { toast.error("Procedure name required"); return; }
    const entry: SurgicalEntry = {
      id: `se-${Date.now()}`, admissionId: selectedAdmission.id,
      date: new Date().toISOString().split("T")[0], procedureName: surgForm.procedureName,
      surgeon: surgForm.surgeon, notes: surgForm.notes, cost: surgForm.cost,
    };
    setSurgicalEntries((prev) => [...prev, entry]);
    toast.success("Surgical entry added");
    setShowSurgicalDialog(false);
    setSurgForm({ procedureName: "", surgeon: "", notes: "", cost: 0 });
  };

  const handleAddDiagnostic = () => {
    if (!selectedAdmission || !diagForm.testName) { toast.error("Test name required"); return; }
    const entry: DiagnosticEntry = {
      id: `de-${Date.now()}`, admissionId: selectedAdmission.id,
      date: new Date().toISOString().split("T")[0], testName: diagForm.testName, cost: diagForm.cost,
    };
    setDiagnosticEntries((prev) => [...prev, entry]);
    toast.success("Diagnostic entry added");
    setShowDiagnosticDialog(false);
    setDiagForm({ testName: "", cost: 0 });
  };

  const handleBedTransfer = () => {
    if (!selectedAdmission || !transferForm.toBed) { toast.error("Select destination bed"); return; }
    const destBed = beds.find((b) => b.id === transferForm.toBed);
    const destWard = wards.find((w) => w.id === destBed?.wardId);
    if (!destBed || !destWard) return;

    const transfer: BedTransfer = {
      id: `bt-${Date.now()}`, admissionId: selectedAdmission.id, patientName: selectedAdmission.patientName,
      fromWard: selectedAdmission.wardName, fromBed: selectedAdmission.bedNumber,
      toWard: destWard.name, toBed: destBed.bedNumber, reason: transferForm.reason,
      transferDate: new Date().toLocaleString(), transferredBy: "Current User",
    };
    setBedTransfers((prev) => [...prev, transfer]);
    setBeds((prev) => prev.map((b) => {
      if (b.id === selectedAdmission.bedId) return { ...b, status: "Available" as BedStatus, patientId: undefined, patientName: undefined, admissionId: undefined };
      if (b.id === destBed.id) return { ...b, status: "Occupied" as BedStatus, patientId: selectedAdmission.patientId, patientName: selectedAdmission.patientName, admissionId: selectedAdmission.id };
      return b;
    }));
    setAdmissions((prev) => prev.map((a) => a.id === selectedAdmission.id ? { ...a, wardId: destWard.id, wardName: destWard.name, bedId: destBed.id, bedNumber: destBed.bedNumber } : a));
    setSelectedAdmission((prev) => prev ? { ...prev, wardId: destWard.id, wardName: destWard.name, bedId: destBed.id, bedNumber: destBed.bedNumber } : null);
    toast.success(`Patient transferred to ${destWard.name} - ${destBed.bedNumber}`);
    setShowBedTransferDialog(false);
    setTransferForm({ toWard: "", toBed: "", reason: "" });
  };

  const handleDischarge = () => {
    if (!selectedAdmission || !dischargeForm.finalDiagnosis) { toast.error("Final diagnosis required"); return; }
    const ds: DischargeSummary = {
      id: `ds-${Date.now()}`, admissionId: selectedAdmission.id,
      dischargeDate: new Date().toLocaleString(), conditionAtDischarge: dischargeForm.conditionAtDischarge,
      finalDiagnosis: dischargeForm.finalDiagnosis, treatmentSummary: dischargeForm.treatmentSummary,
      followUpDate: dischargeForm.followUpDate, followUpInstructions: dischargeForm.followUpInstructions,
      medicationsOnDischarge: dischargeForm.medicationsOnDischarge,
      totalBill: billBreakdown?.grandTotal || 0, paidAmount: 0, paymentStatus: "Pending",
    };
    setDischargeSummaries((prev) => [...prev, ds]);
    setAdmissions((prev) => prev.map((a) => a.id === selectedAdmission.id ? { ...a, status: "Discharged" as AdmissionStatus, dischargeDate: ds.dischargeDate } : a));
    setBeds((prev) => prev.map((b) => b.id === selectedAdmission.bedId ? { ...b, status: "Available" as BedStatus, patientId: undefined, patientName: undefined, admissionId: undefined } : b));
    setSelectedAdmission((prev) => prev ? { ...prev, status: "Discharged", dischargeDate: ds.dischargeDate } : null);
    toast.success("Patient discharged successfully");
    setShowDischargeDialog(false);
    setDischargeForm({ conditionAtDischarge: "", finalDiagnosis: "", treatmentSummary: "", followUpDate: "", followUpInstructions: "", medicationsOnDischarge: "" });
  };

  const handlePrintDischarge = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Discharge Summary</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        h2 { font-size: 16px; color: #444; border-bottom: 2px solid #0066cc; padding-bottom: 4px; margin-top: 24px; }
        .header { text-align: center; border-bottom: 3px solid #0066cc; padding-bottom: 16px; margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
        .value { font-size: 13px; font-weight: 600; }
        .section { margin-bottom: 16px; }
        .bill-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; border-bottom: 1px solid #eee; }
        .bill-total { font-weight: bold; font-size: 15px; border-top: 2px solid #333; padding-top: 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      ${printRef.current.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const availableBedsForTransfer = selectedAdmission ? beds.filter((b) => b.status === "Available" && b.id !== selectedAdmission.bedId) : [];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-primary" /> In-Patient Department (IPD)
          </h1>
          <p className="text-sm text-muted-foreground">Admissions, bed management, daily entries & discharge</p>
        </div>
        <Button size="sm" onClick={() => { setShowAdmitDialog(true); setAdmitForm({}); }}>
          <Plus className="h-4 w-4 mr-1" /> Quick Admit
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Active Patients" value={activeAdmissions.length} icon={<User className="h-4 w-4" />} accent="text-primary" />
        <StatCard label="Total Beds" value={totalBeds} icon={<BedDouble className="h-4 w-4" />} accent="text-info" />
        <StatCard label="Occupied" value={occupiedBeds} icon={<Activity className="h-4 w-4" />} accent="text-warning" />
        <StatCard label="Available" value={availableBeds} icon={<CheckCircle className="h-4 w-4" />} accent="text-success" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="admissions"><ClipboardList className="h-4 w-4 mr-1" /> Admissions</TabsTrigger>
          <TabsTrigger value="beds"><BedDouble className="h-4 w-4 mr-1" /> Bed Management</TabsTrigger>
          <TabsTrigger value="daily-entries"><FileText className="h-4 w-4 mr-1" /> Daily Entries</TabsTrigger>
          <TabsTrigger value="discharge"><Receipt className="h-4 w-4 mr-1" /> Discharge</TabsTrigger>
        </TabsList>

        {/* ════════ ADMISSIONS TAB ════════ */}
        <TabsContent value="admissions">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={admSearch} onChange={(e) => setAdmSearch(e.target.value)} placeholder="Search patient name or reg no..." className="pl-9 h-9" />
            </div>
            <Select value={admStatusFilter} onValueChange={setAdmStatusFilter}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Discharged">Discharged</SelectItem>
                <SelectItem value="LAMA">LAMA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Patient</TableHead>
                  <TableHead>Reg No.</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Ward / Bed</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Admitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmissions.map((adm) => (
                  <TableRow key={adm.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => { setSelectedAdmission(adm); setActiveTab("daily-entries"); }}>
                    <TableCell className="font-medium">{adm.patientName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{adm.registrationNumber}</TableCell>
                    <TableCell className="text-sm">{adm.admittingDoctor}</TableCell>
                    <TableCell className="text-sm">{adm.wardName} / {adm.bedNumber}</TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate">{adm.diagnosis}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{adm.admissionDate}</TableCell>
                    <TableCell><Badge variant="outline" className={cn("text-xs", admissionStatusColors[adm.status])}>{adm.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSelectedAdmission(adm); setActiveTab("daily-entries"); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredAdmissions.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No admissions found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ════════ BED MANAGEMENT TAB ════════ */}
        <TabsContent value="beds">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <Select value={bedWardFilter} onValueChange={setBedWardFilter}>
              <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Filter by ward" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Wards</SelectItem>
                {wards.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={bedStatusFilter} onValueChange={setBedStatusFilter}>
              <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Bed Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Available">Available</SelectItem>
                <SelectItem value="Occupied">Occupied</SelectItem>
                <SelectItem value="Under Maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-4 ml-auto">
              {(["Available", "Occupied", "Under Maintenance"] as BedStatus[]).map((s) => (
                <div key={s} className="flex items-center gap-1.5 text-xs">
                  <div className={cn("w-3 h-3 rounded-full border", bedStatusColors[s])} />
                  <span className="text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
            <UserPlus className="h-3.5 w-3.5" /> Click on an <span className="font-semibold text-success">available</span> bed to assign a patient • Click on an <span className="font-semibold text-destructive">occupied</span> bed to view patient details
          </p>

          <div className="space-y-5">
            {wards.filter((w) => bedWardFilter === "all" || w.id === bedWardFilter).map((ward) => {
              const wardBeds = beds.filter((b) => b.wardId === ward.id && (bedStatusFilter === "all" || b.status === bedStatusFilter));
              const allWardBeds = beds.filter((b) => b.wardId === ward.id);
              const occupied = allWardBeds.filter((b) => b.status === "Occupied").length;
              const available = allWardBeds.filter((b) => b.status === "Available").length;
              const occupancyPercent = Math.round((occupied / allWardBeds.length) * 100);

              if (wardBeds.length === 0 && bedStatusFilter !== "all") return null;

              return (
                <Card key={ward.id} className="border border-border overflow-hidden">
                  <CardHeader className="pb-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={cn("text-xs font-semibold", wardTypeColors[ward.type])}>{ward.type}</Badge>
                        <CardTitle className="text-sm font-bold">{ward.name}</CardTitle>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{ward.floor}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="text-success font-semibold">{available} free</span>
                            <span>•</span>
                            <span className="text-destructive font-semibold">{occupied} used</span>
                            <span>•</span>
                            <span>{allWardBeds.length} total</span>
                          </div>
                          <div className="w-32 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all", occupancyPercent > 80 ? "bg-destructive" : occupancyPercent > 50 ? "bg-warning" : "bg-success")}
                              style={{ width: `${occupancyPercent}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">₹{ward.chargePerDay}/day</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2.5">
                      {wardBeds.map((bed) => (
                        <button
                          key={bed.id}
                          onClick={() => handleBedClick(bed)}
                          disabled={bed.status === "Under Maintenance"}
                          className={cn(
                            "relative group rounded-xl border-2 p-2.5 text-center transition-all duration-200",
                            "focus:outline-none focus:ring-2 focus:ring-primary/50",
                            bedStatusColors[bed.status],
                            bed.status === "Available" && "hover:scale-110 hover:shadow-lg hover:shadow-success/20 cursor-pointer hover:border-success",
                            bed.status === "Occupied" && "hover:scale-105 hover:shadow-md cursor-pointer",
                            bed.status === "Under Maintenance" && "opacity-60 cursor-not-allowed",
                          )}
                          title={bed.patientName ? `${bed.patientName} — Click to view` : bed.status === "Available" ? "Click to assign patient" : bed.status}
                        >
                          <BedDouble className={cn("h-5 w-5 mx-auto mb-1", bed.status === "Available" && "group-hover:animate-pulse")} />
                          <p className="text-[10px] font-bold leading-tight">{bed.bedNumber.split("-").pop()}</p>
                          {bed.patientName && (
                            <p className="text-[8px] truncate leading-tight mt-0.5 opacity-80 max-w-full">{bed.patientName.split(" ")[0]}</p>
                          )}
                          {bed.status === "Available" && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-success border-2 border-card opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus className="h-2 w-2 text-card m-[1px]" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ════════ DAILY ENTRIES TAB ════════ */}
        <TabsContent value="daily-entries">
          {!selectedAdmission ? (
            <Card className="border border-border">
              <CardContent className="py-12 text-center">
                <User className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Select a patient from the Admissions tab to view daily entries</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Patient Header */}
              <Card className="border border-border">
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        {selectedAdmission.patientName}
                        <Badge variant="outline" className={cn("text-xs", admissionStatusColors[selectedAdmission.status])}>{selectedAdmission.status}</Badge>
                      </h2>
                      <p className="text-sm text-muted-foreground">{selectedAdmission.registrationNumber} • {selectedAdmission.age}y/{selectedAdmission.gender} • {selectedAdmission.diagnosis}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium">{selectedAdmission.wardName}</span> / Bed {selectedAdmission.bedNumber} • Dr. {selectedAdmission.admittingDoctor}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => setShowDoctorNoteDialog(true)}><Stethoscope className="h-3.5 w-3.5 mr-1" /> Doctor Note</Button>
                      <Button size="sm" variant="outline" onClick={() => setShowNurseNoteDialog(true)}><ClipboardList className="h-3.5 w-3.5 mr-1" /> Nurse Note</Button>
                      <Button size="sm" variant="outline" onClick={() => setShowMedicineDialog(true)}><Pill className="h-3.5 w-3.5 mr-1" /> Medicine</Button>
                      <Button size="sm" variant="outline" onClick={() => setShowSurgicalDialog(true)}><Scissors className="h-3.5 w-3.5 mr-1" /> Surgical</Button>
                      <Button size="sm" variant="outline" onClick={() => setShowDiagnosticDialog(true)}><Microscope className="h-3.5 w-3.5 mr-1" /> Diagnostic</Button>
                      <Button size="sm" variant="outline" onClick={() => setShowBedTransferDialog(true)}><ArrowLeftRight className="h-3.5 w-3.5 mr-1" /> Transfer</Button>
                      {selectedAdmission.status === "Active" && (
                        <Button size="sm" variant="destructive" onClick={() => setShowDischargeDialog(true)}><FileText className="h-3.5 w-3.5 mr-1" /> Discharge</Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => setShowBillDialog(true)}><Receipt className="h-3.5 w-3.5 mr-1" /> Bill</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Discharge Summary Card (if discharged) */}
              {admDischarge && (
                <Card className="border-2 border-info/30 bg-info/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><Receipt className="h-4 w-4 text-info" /> Discharge Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      <div><p className="text-[10px] text-muted-foreground uppercase">Discharge Date</p><p className="text-foreground">{admDischarge.dischargeDate}</p></div>
                      <div><p className="text-[10px] text-muted-foreground uppercase">Condition</p><p className="text-foreground">{admDischarge.conditionAtDischarge}</p></div>
                      <div className="col-span-2"><p className="text-[10px] text-muted-foreground uppercase">Final Diagnosis</p><p className="text-foreground">{admDischarge.finalDiagnosis}</p></div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setViewingDischarge(admDischarge); setShowDischargeSummaryDialog(true); }}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> View Full Summary
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setViewingDischarge(admDischarge); setShowDischargeSummaryDialog(true); setTimeout(handlePrintDischarge, 300); }}>
                        <Printer className="h-3.5 w-3.5 mr-1" /> Print
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Doctor Visit Notes */}
              <Card className="border border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Stethoscope className="h-4 w-4 text-primary" /> Doctor Visit Notes ({admDoctorNotes.length})</CardTitle></CardHeader>
                <CardContent>
                  {admDoctorNotes.length === 0 ? <p className="text-sm text-muted-foreground">No doctor notes yet</p> : (
                    <div className="space-y-3">
                      {admDoctorNotes.map((n) => (
                        <div key={n.id} className="p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-foreground">{n.doctor}</span>
                            <span className="text-[10px] text-muted-foreground">{n.date} {n.time}</span>
                          </div>
                          <p className="text-sm text-foreground">{n.notes}</p>
                          {n.instructions && <p className="text-xs text-info mt-1">📋 {n.instructions}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Nurse Notes */}
              <Card className="border border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4 text-info" /> Nurse Notes ({admNurseNotes.length})</CardTitle></CardHeader>
                <CardContent>
                  {admNurseNotes.length === 0 ? <p className="text-sm text-muted-foreground">No nurse notes yet</p> : (
                    <div className="space-y-3">
                      {admNurseNotes.map((n) => (
                        <div key={n.id} className="p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-foreground">{n.nurse}</span>
                            <span className="text-[10px] text-muted-foreground">{n.date} {n.time}</span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs mb-1">
                            <span>BP: <strong>{n.vitals.bp}</strong></span>
                            <span>Temp: <strong>{n.vitals.temp}</strong></span>
                            <span>Pulse: <strong>{n.vitals.pulse}</strong></span>
                            <span>SpO₂: <strong>{n.vitals.spo2}</strong></span>
                          </div>
                          {n.notes && <p className="text-sm text-foreground">{n.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Medicine Entries */}
              <Card className="border border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Pill className="h-4 w-4 text-success" /> Medicine Entries ({admMedicines.length}) — ₹{admMedicines.reduce((s, m) => s + m.total, 0)}</CardTitle></CardHeader>
                <CardContent>
                  {admMedicines.length === 0 ? <p className="text-sm text-muted-foreground">No medicines added</p> : (
                    <Table>
                      <TableHeader><TableRow className="bg-muted/30"><TableHead>Date</TableHead><TableHead>Medicine</TableHead><TableHead>Dosage</TableHead><TableHead>Freq</TableHead><TableHead>Qty</TableHead><TableHead>Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {admMedicines.map((m) => (
                          <TableRow key={m.id}><TableCell className="text-xs">{m.date}</TableCell><TableCell className="text-sm font-medium">{m.medicineName}</TableCell><TableCell className="text-xs">{m.dosage}</TableCell><TableCell className="text-xs">{m.frequency}</TableCell><TableCell className="text-xs">{m.quantity}</TableCell><TableCell className="text-xs">₹{m.unitPrice}</TableCell><TableCell className="text-right text-xs font-medium">₹{m.total}</TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Surgical Entries */}
              <Card className="border border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Scissors className="h-4 w-4 text-destructive" /> Surgical Entries ({admSurgicals.length}) — ₹{admSurgicals.reduce((s, m) => s + m.cost, 0)}</CardTitle></CardHeader>
                <CardContent>
                  {admSurgicals.length === 0 ? <p className="text-sm text-muted-foreground">No surgical entries</p> : (
                    <Table>
                      <TableHeader><TableRow className="bg-muted/30"><TableHead>Date</TableHead><TableHead>Procedure</TableHead><TableHead>Surgeon</TableHead><TableHead>Notes</TableHead><TableHead className="text-right">Cost</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {admSurgicals.map((s) => (
                          <TableRow key={s.id}><TableCell className="text-xs">{s.date}</TableCell><TableCell className="text-sm font-medium">{s.procedureName}</TableCell><TableCell className="text-xs">{s.surgeon}</TableCell><TableCell className="text-xs max-w-[200px] truncate">{s.notes}</TableCell><TableCell className="text-right text-xs font-medium">₹{s.cost}</TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Diagnostic Entries */}
              <Card className="border border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Microscope className="h-4 w-4 text-warning" /> Diagnostic Entries ({admDiagnostics.length}) — ₹{admDiagnostics.reduce((s, m) => s + m.cost, 0)}</CardTitle></CardHeader>
                <CardContent>
                  {admDiagnostics.length === 0 ? <p className="text-sm text-muted-foreground">No diagnostics</p> : (
                    <Table>
                      <TableHeader><TableRow className="bg-muted/30"><TableHead>Date</TableHead><TableHead>Test</TableHead><TableHead>Result</TableHead><TableHead className="text-right">Cost</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {admDiagnostics.map((d) => (
                          <TableRow key={d.id}><TableCell className="text-xs">{d.date}</TableCell><TableCell className="text-sm font-medium">{d.testName}</TableCell><TableCell className="text-xs">{d.result || "Pending"}</TableCell><TableCell className="text-right text-xs font-medium">₹{d.cost}</TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Bed Transfer History */}
              {admTransfers.length > 0 && (
                <Card className="border border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ArrowLeftRight className="h-4 w-4 text-info" /> Bed Transfer History</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {admTransfers.map((t) => (
                        <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border text-sm">
                          <Badge variant="outline" className="text-xs">{t.fromWard} / {t.fromBed}</Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary">{t.toWard} / {t.toBed}</Badge>
                          <span className="text-xs text-muted-foreground ml-auto">{t.transferDate} • {t.transferredBy}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* ════════ DISCHARGE TAB ════════ */}
        <TabsContent value="discharge">
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Patient</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Admission</TableHead>
                  <TableHead>Discharge</TableHead>
                  <TableHead>Total Bill</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dischargeSummaries.map((ds) => {
                  const adm = admissions.find((a) => a.id === ds.admissionId);
                  return (
                    <TableRow key={ds.id}>
                      <TableCell className="font-medium">{adm?.patientName}</TableCell>
                      <TableCell className="text-sm">{ds.finalDiagnosis}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{adm?.admissionDate}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{ds.dischargeDate}</TableCell>
                      <TableCell className="text-sm font-medium">₹{ds.totalBill.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs", ds.paymentStatus === "Paid" ? "bg-success/10 text-success" : ds.paymentStatus === "Partial" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive")}>{ds.paymentStatus}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setViewingDischarge(ds); setShowDischargeSummaryDialog(true); }} title="View Summary">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setViewingDischarge(ds); setShowDischargeSummaryDialog(true); setTimeout(handlePrintDischarge, 300); }} title="Print">
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {dischargeSummaries.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No discharge summaries</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══════════ DIALOGS ═══════════ */}

      {/* Bed Allocate Dialog */}
      <Dialog open={showBedAllocateDialog} onOpenChange={setShowBedAllocateDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-success" /> Assign Patient to Bed
            </DialogTitle>
          </DialogHeader>
          {selectedBed && (
            <div className="space-y-4">
              <div className="rounded-lg bg-success/5 border border-success/20 p-3 flex items-center gap-3">
                <BedDouble className="h-8 w-8 text-success" />
                <div>
                  <p className="text-sm font-bold text-foreground">{selectedBed.wardName} — Bed {selectedBed.bedNumber}</p>
                  <p className="text-xs text-muted-foreground">{wards.find(w => w.id === selectedBed.wardId)?.type} • ₹{wards.find(w => w.id === selectedBed.wardId)?.chargePerDay}/day</p>
                </div>
              </div>
              <div><Label>Patient *</Label>
                <Select value={allocateForm.patientId} onValueChange={(v) => setAllocateForm({ ...allocateForm, patientId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select registered patient" /></SelectTrigger>
                  <SelectContent>{dbPatients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.registrationNumber})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Admitting Doctor *</Label>
                <Select value={allocateForm.admittingDoctor} onValueChange={(v) => setAllocateForm({ ...allocateForm, admittingDoctor: v })}>
                  <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                  <SelectContent>{dbDoctors.map((d: any) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Department</Label><Input value={allocateForm.department} onChange={(e) => setAllocateForm({ ...allocateForm, department: e.target.value })} placeholder="e.g. General Medicine" /></div>
              <div><Label>Diagnosis</Label><Textarea value={allocateForm.diagnosis} onChange={(e) => setAllocateForm({ ...allocateForm, diagnosis: e.target.value })} placeholder="Primary diagnosis" rows={2} /></div>
              <div><Label>Referred By</Label><Input value={allocateForm.referredBy} onChange={(e) => setAllocateForm({ ...allocateForm, referredBy: e.target.value })} /></div>
              <div><Label>Insurance (Optional)</Label><Input value={allocateForm.insuranceInfo} onChange={(e) => setAllocateForm({ ...allocateForm, insuranceInfo: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={handleAllocateBed} className="bg-success hover:bg-success/90"><UserPlus className="h-4 w-4 mr-1" /> Assign & Admit</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Admit Dialog (no bed selection) */}
      <Dialog open={showAdmitDialog} onOpenChange={setShowAdmitDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Quick Admit Patient</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2 mb-2">A bed will be automatically assigned. You can transfer later from Bed Management.</p>
          <div className="space-y-3">
            <div><Label>Patient *</Label>
              <Select value={admitForm.patientId || ""} onValueChange={(v) => setAdmitForm({ ...admitForm, patientId: v })}>
                <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>{dbPatients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.registrationNumber})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Admitting Doctor *</Label>
              <Select value={admitForm.admittingDoctor || ""} onValueChange={(v) => setAdmitForm({ ...admitForm, admittingDoctor: v })}>
                <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                <SelectContent>{dbDoctors.map((d: any) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Department</Label><Input value={admitForm.department || ""} onChange={(e) => setAdmitForm({ ...admitForm, department: e.target.value })} placeholder="e.g. General Medicine" /></div>
            <div><Label>Diagnosis</Label><Textarea value={admitForm.diagnosis || ""} onChange={(e) => setAdmitForm({ ...admitForm, diagnosis: e.target.value })} placeholder="Primary diagnosis" /></div>
            <div><Label>Referred By</Label><Input value={admitForm.referredBy || ""} onChange={(e) => setAdmitForm({ ...admitForm, referredBy: e.target.value })} /></div>
            <div><Label>Insurance Info (Optional)</Label><Input value={admitForm.insuranceInfo || ""} onChange={(e) => setAdmitForm({ ...admitForm, insuranceInfo: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleAdmit}>Admit Patient</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discharge Summary View Dialog */}
      <Dialog open={showDischargeSummaryDialog} onOpenChange={setShowDischargeSummaryDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" /> Discharge Summary
            </DialogTitle>
          </DialogHeader>
          {viewingDischarge && (() => {
            const adm = admissions.find((a) => a.id === viewingDischarge.admissionId);
            if (!adm) return null;
            const bill = getBillForAdmission(adm);
            return (
              <div ref={printRef}>
                <div className="header" style={{ textAlign: "center", borderBottom: "3px solid hsl(var(--primary))", paddingBottom: "16px", marginBottom: "20px" }}>
                  <h1 style={{ fontSize: "20px", fontWeight: "bold", margin: 0 }}>🏥 Hospital Discharge Summary</h1>
                  <p style={{ fontSize: "12px", color: "#666", margin: "4px 0 0" }}>EzyOp Healthcare Management System</p>
                </div>

                <h2 style={{ fontSize: "14px", fontWeight: "bold", borderBottom: "2px solid hsl(var(--primary))", paddingBottom: "4px", marginTop: "16px" }}>Patient Information</h2>
                <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                  <div><span className="text-[10px] text-muted-foreground uppercase block">Name</span><span className="font-medium">{adm.patientName}</span></div>
                  <div><span className="text-[10px] text-muted-foreground uppercase block">Reg. No.</span><span className="font-medium">{adm.registrationNumber}</span></div>
                  <div><span className="text-[10px] text-muted-foreground uppercase block">Age / Gender</span><span>{adm.age}y / {adm.gender}</span></div>
                  <div><span className="text-[10px] text-muted-foreground uppercase block">Contact</span><span>{adm.contactNumber}</span></div>
                  <div><span className="text-[10px] text-muted-foreground uppercase block">Admission Date</span><span>{adm.admissionDate}</span></div>
                  <div><span className="text-[10px] text-muted-foreground uppercase block">Discharge Date</span><span>{viewingDischarge.dischargeDate}</span></div>
                  <div><span className="text-[10px] text-muted-foreground uppercase block">Ward / Bed</span><span>{adm.wardName} / {adm.bedNumber}</span></div>
                  <div><span className="text-[10px] text-muted-foreground uppercase block">Doctor</span><span>{adm.admittingDoctor}</span></div>
                </div>

                <h2 style={{ fontSize: "14px", fontWeight: "bold", borderBottom: "2px solid hsl(var(--primary))", paddingBottom: "4px", marginTop: "20px" }}>Clinical Details</h2>
                <div className="space-y-2 mt-2 text-sm">
                  <div><span className="text-[10px] text-muted-foreground uppercase block">Final Diagnosis</span><span className="font-medium">{viewingDischarge.finalDiagnosis}</span></div>
                  <div><span className="text-[10px] text-muted-foreground uppercase block">Condition at Discharge</span><span>{viewingDischarge.conditionAtDischarge}</span></div>
                  <div><span className="text-[10px] text-muted-foreground uppercase block">Treatment Summary</span><span>{viewingDischarge.treatmentSummary}</span></div>
                  <div><span className="text-[10px] text-muted-foreground uppercase block">Medications on Discharge</span><span>{viewingDischarge.medicationsOnDischarge}</span></div>
                </div>

                {viewingDischarge.followUpDate && (
                  <>
                    <h2 style={{ fontSize: "14px", fontWeight: "bold", borderBottom: "2px solid hsl(var(--primary))", paddingBottom: "4px", marginTop: "20px" }}>Follow-Up</h2>
                    <div className="space-y-2 mt-2 text-sm">
                      <div><span className="text-[10px] text-muted-foreground uppercase block">Follow-up Date</span><span className="font-medium">{viewingDischarge.followUpDate}</span></div>
                      <div><span className="text-[10px] text-muted-foreground uppercase block">Instructions</span><span>{viewingDischarge.followUpInstructions}</span></div>
                    </div>
                  </>
                )}

                <h2 style={{ fontSize: "14px", fontWeight: "bold", borderBottom: "2px solid hsl(var(--primary))", paddingBottom: "4px", marginTop: "20px" }}>Bill Summary</h2>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between py-1 border-b border-border"><span>Ward Charges ({bill.days} days)</span><span className="font-medium">₹{bill.wardCharges.toLocaleString()}</span></div>
                  <div className="flex justify-between py-1 border-b border-border"><span>Medicines ({bill.meds.length} items)</span><span className="font-medium">₹{bill.medTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between py-1 border-b border-border"><span>Surgical ({bill.surgs.length} procedures)</span><span className="font-medium">₹{bill.surgTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between py-1 border-b border-border"><span>Diagnostics ({bill.diags.length} tests)</span><span className="font-medium">₹{bill.diagTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between py-2 border-t-2 border-foreground text-base font-bold"><span>Grand Total</span><span>₹{bill.grandTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between py-1"><span>Paid</span><span className="font-medium">₹{viewingDischarge.paidAmount.toLocaleString()}</span></div>
                  <div className="flex justify-between py-1"><span>Balance</span><span className={cn("font-bold", (bill.grandTotal - viewingDischarge.paidAmount) > 0 ? "text-destructive" : "text-success")}>₹{(bill.grandTotal - viewingDischarge.paidAmount).toLocaleString()}</span></div>
                </div>
              </div>
            );
          })()}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDischargeSummaryDialog(false)}>Close</Button>
            <Button onClick={handlePrintDischarge}><Printer className="h-4 w-4 mr-1" /> Print Summary</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Doctor Note Dialog */}
      <Dialog open={showDoctorNoteDialog} onOpenChange={setShowDoctorNoteDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Doctor Visit Note</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Doctor</Label>
              <Select value={noteForm.doctor} onValueChange={(v) => setNoteForm({ ...noteForm, doctor: v })}>
                <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                <SelectContent>{dbDoctors.map((d: any) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Textarea value={noteForm.notes} onChange={(e) => setNoteForm({ ...noteForm, notes: e.target.value })} placeholder="Clinical notes..." rows={3} /></div>
            <div><Label>Instructions</Label><Textarea value={noteForm.instructions} onChange={(e) => setNoteForm({ ...noteForm, instructions: e.target.value })} placeholder="Instructions for staff..." rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={handleAddDoctorNote}>Add Note</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nurse Note Dialog */}
      <Dialog open={showNurseNoteDialog} onOpenChange={setShowNurseNoteDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Nurse Note</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nurse Name</Label><Input value={nurseForm.nurse} onChange={(e) => setNurseForm({ ...nurseForm, nurse: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>BP</Label><Input value={nurseForm.bp} onChange={(e) => setNurseForm({ ...nurseForm, bp: e.target.value })} placeholder="120/80" /></div>
              <div><Label>Temperature</Label><Input value={nurseForm.temp} onChange={(e) => setNurseForm({ ...nurseForm, temp: e.target.value })} placeholder="98.6°F" /></div>
              <div><Label>Pulse</Label><Input value={nurseForm.pulse} onChange={(e) => setNurseForm({ ...nurseForm, pulse: e.target.value })} placeholder="72" /></div>
              <div><Label>SpO₂</Label><Input value={nurseForm.spo2} onChange={(e) => setNurseForm({ ...nurseForm, spo2: e.target.value })} placeholder="98%" /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={nurseForm.notes} onChange={(e) => setNurseForm({ ...nurseForm, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={handleAddNurseNote}>Add Note</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Medicine Dialog */}
      <Dialog open={showMedicineDialog} onOpenChange={setShowMedicineDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Medicine Entry</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Medicine Name</Label><Input value={medForm.medicineName} onChange={(e) => setMedForm({ ...medForm, medicineName: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Dosage</Label><Input value={medForm.dosage} onChange={(e) => setMedForm({ ...medForm, dosage: e.target.value })} placeholder="500mg" /></div>
              <div><Label>Frequency</Label>
                <Select value={medForm.frequency} onValueChange={(v) => setMedForm({ ...medForm, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="OD">OD</SelectItem><SelectItem value="BD">BD</SelectItem><SelectItem value="TDS">TDS</SelectItem><SelectItem value="QID">QID</SelectItem><SelectItem value="SOS">SOS</SelectItem><SelectItem value="STAT">STAT</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Quantity</Label><Input type="number" value={medForm.quantity} onChange={(e) => setMedForm({ ...medForm, quantity: +e.target.value })} /></div>
              <div><Label>Unit Price (₹)</Label><Input type="number" value={medForm.unitPrice} onChange={(e) => setMedForm({ ...medForm, unitPrice: +e.target.value })} /></div>
            </div>
            <p className="text-sm text-muted-foreground">Total: ₹{medForm.quantity * medForm.unitPrice}</p>
          </div>
          <DialogFooter><Button onClick={handleAddMedicine}>Add Medicine</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Surgical Dialog */}
      <Dialog open={showSurgicalDialog} onOpenChange={setShowSurgicalDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Surgical Entry</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Procedure Name</Label><Input value={surgForm.procedureName} onChange={(e) => setSurgForm({ ...surgForm, procedureName: e.target.value })} /></div>
            <div><Label>Surgeon</Label>
              <Select value={surgForm.surgeon} onValueChange={(v) => setSurgForm({ ...surgForm, surgeon: v })}>
                <SelectTrigger><SelectValue placeholder="Select surgeon" /></SelectTrigger>
                <SelectContent>{dbDoctors.map((d: any) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Textarea value={surgForm.notes} onChange={(e) => setSurgForm({ ...surgForm, notes: e.target.value })} rows={2} /></div>
            <div><Label>Cost (₹)</Label><Input type="number" value={surgForm.cost} onChange={(e) => setSurgForm({ ...surgForm, cost: +e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleAddSurgical}>Add Entry</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diagnostic Dialog */}
      <Dialog open={showDiagnosticDialog} onOpenChange={setShowDiagnosticDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Diagnostic Entry</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Test Name</Label><Input value={diagForm.testName} onChange={(e) => setDiagForm({ ...diagForm, testName: e.target.value })} /></div>
            <div><Label>Cost (₹)</Label><Input type="number" value={diagForm.cost} onChange={(e) => setDiagForm({ ...diagForm, cost: +e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleAddDiagnostic}>Add Diagnostic</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bed Transfer Dialog */}
      <Dialog open={showBedTransferDialog} onOpenChange={setShowBedTransferDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transfer Bed</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Current: {selectedAdmission?.wardName} / {selectedAdmission?.bedNumber}</p>
            <div><Label>Destination Bed</Label>
              <Select value={transferForm.toBed} onValueChange={(v) => setTransferForm({ ...transferForm, toBed: v })}>
                <SelectTrigger><SelectValue placeholder="Select bed" /></SelectTrigger>
                <SelectContent>{availableBedsForTransfer.map((b) => <SelectItem key={b.id} value={b.id}>{b.wardName} / {b.bedNumber}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Reason</Label><Textarea value={transferForm.reason} onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })} placeholder="Reason for transfer" rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={handleBedTransfer}>Transfer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discharge Dialog */}
      <Dialog open={showDischargeDialog} onOpenChange={setShowDischargeDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Discharge Patient</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Condition at Discharge</Label><Input value={dischargeForm.conditionAtDischarge} onChange={(e) => setDischargeForm({ ...dischargeForm, conditionAtDischarge: e.target.value })} placeholder="Stable, afebrile..." /></div>
            <div><Label>Final Diagnosis *</Label><Textarea value={dischargeForm.finalDiagnosis} onChange={(e) => setDischargeForm({ ...dischargeForm, finalDiagnosis: e.target.value })} rows={2} /></div>
            <div><Label>Treatment Summary</Label><Textarea value={dischargeForm.treatmentSummary} onChange={(e) => setDischargeForm({ ...dischargeForm, treatmentSummary: e.target.value })} rows={3} /></div>
            <div><Label>Follow-up Date</Label><Input type="date" value={dischargeForm.followUpDate} onChange={(e) => setDischargeForm({ ...dischargeForm, followUpDate: e.target.value })} /></div>
            <div><Label>Follow-up Instructions</Label><Textarea value={dischargeForm.followUpInstructions} onChange={(e) => setDischargeForm({ ...dischargeForm, followUpInstructions: e.target.value })} rows={2} /></div>
            <div><Label>Medications on Discharge</Label><Textarea value={dischargeForm.medicationsOnDischarge} onChange={(e) => setDischargeForm({ ...dischargeForm, medicationsOnDischarge: e.target.value })} rows={2} /></div>
            {billBreakdown && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-sm font-semibold mb-1">Bill Summary</p>
                <div className="text-xs space-y-0.5">
                  <p>Ward ({billBreakdown.days} days): ₹{billBreakdown.wardCharges.toLocaleString()}</p>
                  <p>Medicines: ₹{billBreakdown.medTotal.toLocaleString()}</p>
                  <p>Surgical: ₹{billBreakdown.surgTotal.toLocaleString()}</p>
                  <p>Diagnostics: ₹{billBreakdown.diagTotal.toLocaleString()}</p>
                  <p className="font-bold text-sm pt-1 border-t border-border">Total: ₹{billBreakdown.grandTotal.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter><Button variant="destructive" onClick={handleDischarge}>Confirm Discharge</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bill Dialog */}
      <Dialog open={showBillDialog} onOpenChange={setShowBillDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Bill Summary — {selectedAdmission?.patientName}</DialogTitle></DialogHeader>
          {billBreakdown ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span>Ward Charges ({billBreakdown.days} days)</span><span className="font-medium">₹{billBreakdown.wardCharges.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span>Medicines</span><span className="font-medium">₹{billBreakdown.medTotal.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span>Surgical Procedures</span><span className="font-medium">₹{billBreakdown.surgTotal.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span>Diagnostics</span><span className="font-medium">₹{billBreakdown.diagTotal.toLocaleString()}</span></div>
                <div className="border-t border-border pt-2 flex justify-between text-base font-bold"><span>Grand Total</span><span>₹{billBreakdown.grandTotal.toLocaleString()}</span></div>
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground">No admission selected</p>}
          <DialogFooter><Button variant="outline" onClick={() => setShowBillDialog(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ──── Stat Card ────
const StatCard = ({ label, value, icon, accent }: { label: string; value: string | number; icon: React.ReactNode; accent: string }) => (
  <Card className="border border-border">
    <CardContent className="py-3 px-4 flex items-center gap-3">
      <div className={cn("p-2 rounded-lg bg-muted/50", accent)}>{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground">{value}</p>
      </div>
    </CardContent>
  </Card>
);

export default IPD;
