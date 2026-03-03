import { useState, useMemo } from "react";
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
  ClipboardList, Pill, Scissors, Microscope, Receipt, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  mockWards, mockBeds, mockAdmissions, mockDoctorNotes, mockNurseNotes,
  mockMedicineEntries, mockSurgicalEntries, mockDiagnosticEntries,
  mockBedTransfers, mockDischargeSummaries, bedStatusColors, wardTypeColors,
  type Ward, type Bed, type BedStatus, type IPDAdmission, type AdmissionStatus,
  type DoctorVisitNote, type NurseNote, type MedicineEntry, type SurgicalEntry,
  type DiagnosticEntry, type BedTransfer, type DischargeSummary,
} from "@/data/mockIPDData";
import { mockPatients, mockDoctors } from "@/data/mockPatients";

const admissionStatusColors: Record<AdmissionStatus, string> = {
  Active: "bg-success/10 text-success border-success/30",
  Discharged: "bg-info/10 text-info border-info/30",
  LAMA: "bg-warning/10 text-warning border-warning/30",
  Expired: "bg-destructive/10 text-destructive border-destructive/30",
};

const IPD = () => {
  const [activeTab, setActiveTab] = useState("admissions");
  const [admissions, setAdmissions] = useState<IPDAdmission[]>(mockAdmissions);
  const [wards] = useState<Ward[]>(mockWards);
  const [beds, setBeds] = useState<Bed[]>(mockBeds);
  const [doctorNotes, setDoctorNotes] = useState<DoctorVisitNote[]>(mockDoctorNotes);
  const [nurseNotes, setNurseNotes] = useState<NurseNote[]>(mockNurseNotes);
  const [medicineEntries, setMedicineEntries] = useState<MedicineEntry[]>(mockMedicineEntries);
  const [surgicalEntries, setSurgicalEntries] = useState<SurgicalEntry[]>(mockSurgicalEntries);
  const [diagnosticEntries, setDiagnosticEntries] = useState<DiagnosticEntry[]>(mockDiagnosticEntries);
  const [bedTransfers, setBedTransfers] = useState<BedTransfer[]>(mockBedTransfers);
  const [dischargeSummaries, setDischargeSummaries] = useState<DischargeSummary[]>(mockDischargeSummaries);

  // Filters
  const [admSearch, setAdmSearch] = useState("");
  const [admStatusFilter, setAdmStatusFilter] = useState("all");
  const [selectedAdmission, setSelectedAdmission] = useState<IPDAdmission | null>(null);
  const [bedWardFilter, setBedWardFilter] = useState("all");

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

  // Forms
  const [admitForm, setAdmitForm] = useState<Partial<IPDAdmission>>({});
  const [noteForm, setNoteForm] = useState({ doctor: "", notes: "", instructions: "" });
  const [nurseForm, setNurseForm] = useState({ nurse: "", bp: "", temp: "", pulse: "", spo2: "", notes: "" });
  const [medForm, setMedForm] = useState({ medicineName: "", dosage: "", frequency: "OD", quantity: 1, unitPrice: 0 });
  const [surgForm, setSurgForm] = useState({ procedureName: "", surgeon: "", notes: "", cost: 0 });
  const [diagForm, setDiagForm] = useState({ testName: "", cost: 0 });
  const [transferForm, setTransferForm] = useState({ toWard: "", toBed: "", reason: "" });
  const [dischargeForm, setDischargeForm] = useState({ conditionAtDischarge: "", finalDiagnosis: "", treatmentSummary: "", followUpDate: "", followUpInstructions: "", medicationsOnDischarge: "" });

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

  // ──── Handlers ────
  const handleAdmit = () => {
    if (!admitForm.patientId || !admitForm.admittingDoctor || !admitForm.bedId) {
      toast.error("Patient, doctor, and bed are required"); return;
    }
    const patient = mockPatients.find((p) => p.id === admitForm.patientId);
    const bed = beds.find((b) => b.id === admitForm.bedId);
    const ward = wards.find((w) => w.id === bed?.wardId);
    if (!patient || !bed || !ward) return;

    const newAdm: IPDAdmission = {
      id: `adm-${Date.now()}`, patientId: patient.id, patientName: patient.name,
      registrationNumber: patient.registrationNumber, age: new Date().getFullYear() - new Date(patient.dob).getFullYear(),
      gender: patient.gender, contactNumber: patient.mobile, referredBy: admitForm.referredBy || "",
      admittingDoctor: admitForm.admittingDoctor || "", department: admitForm.department || "General Medicine",
      diagnosis: admitForm.diagnosis || "", wardId: ward.id, wardName: ward.name,
      bedId: bed.id, bedNumber: bed.bedNumber, admissionDate: new Date().toLocaleString(),
      status: "Active", emergencyContact: patient.emergencyContact, insuranceInfo: admitForm.insuranceInfo,
    };
    setAdmissions((prev) => [newAdm, ...prev]);
    setBeds((prev) => prev.map((b) => b.id === bed.id ? { ...b, status: "Occupied" as BedStatus, patientId: patient.id, patientName: patient.name, admissionId: newAdm.id } : b));
    toast.success(`${patient.name} admitted to ${ward.name} - ${bed.bedNumber}`);
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

    // Update beds
    setBeds((prev) => prev.map((b) => {
      if (b.id === selectedAdmission.bedId) return { ...b, status: "Available" as BedStatus, patientId: undefined, patientName: undefined, admissionId: undefined };
      if (b.id === destBed.id) return { ...b, status: "Occupied" as BedStatus, patientId: selectedAdmission.patientId, patientName: selectedAdmission.patientName, admissionId: selectedAdmission.id };
      return b;
    }));

    // Update admission
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

  const availableBedsForAdmission = beds.filter((b) => b.status === "Available");
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
          <Plus className="h-4 w-4 mr-1" /> Admit Patient
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
          <div className="flex items-center gap-3 mb-4">
            <Select value={bedWardFilter} onValueChange={setBedWardFilter}>
              <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Filter by ward" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Wards</SelectItem>
                {wards.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-3 ml-auto">
              {(["Available", "Occupied", "Reserved", "Under Maintenance"] as BedStatus[]).map((s) => (
                <div key={s} className="flex items-center gap-1.5 text-xs">
                  <div className={cn("w-3 h-3 rounded-sm border", bedStatusColors[s])} />
                  <span className="text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {wards.filter((w) => bedWardFilter === "all" || w.id === bedWardFilter).map((ward) => {
              const wardBeds = beds.filter((b) => b.wardId === ward.id);
              const occupied = wardBeds.filter((b) => b.status === "Occupied").length;
              return (
                <Card key={ward.id} className="border border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={cn("text-xs", wardTypeColors[ward.type])}>{ward.type}</Badge>
                        <CardTitle className="text-sm font-semibold">{ward.name}</CardTitle>
                        <span className="text-xs text-muted-foreground">{ward.floor}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{occupied}/{ward.totalBeds} occupied</span>
                        <span>₹{ward.chargePerDay}/day</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
                      {wardBeds.map((bed) => (
                        <div key={bed.id} className={cn(
                          "relative group rounded-lg border-2 p-2 text-center transition-all hover:scale-105 cursor-default",
                          bedStatusColors[bed.status],
                        )} title={bed.patientName ? `${bed.patientName}` : bed.status}>
                          <BedDouble className="h-5 w-5 mx-auto mb-0.5" />
                          <p className="text-[10px] font-bold leading-tight">{bed.bedNumber.split("-").pop()}</p>
                          {bed.patientName && (
                            <p className="text-[8px] truncate leading-tight mt-0.5 opacity-80">{bed.patientName.split(" ")[0]}</p>
                          )}
                        </div>
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
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { const a = admissions.find((x) => x.id === ds.admissionId); if (a) { setSelectedAdmission(a); setActiveTab("daily-entries"); } }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
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

      {/* Admit Patient Dialog */}
      <Dialog open={showAdmitDialog} onOpenChange={setShowAdmitDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Admit Patient (IPD)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Patient</Label>
              <Select value={admitForm.patientId || ""} onValueChange={(v) => setAdmitForm({ ...admitForm, patientId: v })}>
                <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>{mockPatients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.registrationNumber})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Admitting Doctor</Label>
              <Select value={admitForm.admittingDoctor || ""} onValueChange={(v) => setAdmitForm({ ...admitForm, admittingDoctor: v })}>
                <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                <SelectContent>{mockDoctors.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Department</Label><Input value={admitForm.department || ""} onChange={(e) => setAdmitForm({ ...admitForm, department: e.target.value })} placeholder="e.g. General Medicine" /></div>
            <div><Label>Diagnosis</Label><Textarea value={admitForm.diagnosis || ""} onChange={(e) => setAdmitForm({ ...admitForm, diagnosis: e.target.value })} placeholder="Primary diagnosis" /></div>
            <div><Label>Bed</Label>
              <Select value={admitForm.bedId || ""} onValueChange={(v) => setAdmitForm({ ...admitForm, bedId: v })}>
                <SelectTrigger><SelectValue placeholder="Select available bed" /></SelectTrigger>
                <SelectContent>{availableBedsForAdmission.map((b) => <SelectItem key={b.id} value={b.id}>{b.wardName} / {b.bedNumber}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Referred By</Label><Input value={admitForm.referredBy || ""} onChange={(e) => setAdmitForm({ ...admitForm, referredBy: e.target.value })} /></div>
            <div><Label>Insurance Info (Optional)</Label><Input value={admitForm.insuranceInfo || ""} onChange={(e) => setAdmitForm({ ...admitForm, insuranceInfo: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleAdmit}>Admit Patient</Button></DialogFooter>
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
                <SelectContent>{mockDoctors.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
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
                <SelectContent>{mockDoctors.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
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
            <div><Label>Final Diagnosis</Label><Textarea value={dischargeForm.finalDiagnosis} onChange={(e) => setDischargeForm({ ...dischargeForm, finalDiagnosis: e.target.value })} rows={2} /></div>
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
