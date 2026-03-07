import { useState, useMemo, useRef } from "react";
import { format, startOfDay, isBefore, isToday } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon, Clock, Users, Search, Settings2, Plus, Minus, Eye, FileText, Pill, ClockIcon,
  CalendarDays, Monitor, Stethoscope, X, Heart, Thermometer, Weight, Activity, Printer, FlaskConical,
  CalendarPlus, Trash2, CheckCircle2, Save, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClinicData } from "@/contexts/ClinicDataContext";
import { usePatients } from "@/modules/patients/hooks";
import { clinicService } from "@/modules/clinic/services";
import { useCreateSchedule } from "@/modules/clinic/hooks";
import { clinicService } from "@/modules/clinic/services";
import {
  type DoctorSchedule,
  type QueueEntry,
  type ClinicPatient,
  type PrescriptionItem,
  type LabOrder,
  type LabCategory,
  type Vitals,
} from "@/data/mockClinicData";
import { labCategoryColors } from "@/data/mockDiagnosticsData";
import { useLabTestCatalog } from "@/modules/diagnostics/hooks";

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
};

const statusColor: Record<QueueEntry["status"], string> = {
  Waiting: "bg-warning/10 text-warning border-warning/20",
  "In Consultation": "bg-info/10 text-info border-info/20",
  Completed: "bg-success/10 text-success border-success/20",
  "No Show": "bg-destructive/10 text-destructive border-destructive/20",
};

const opdTypeColor: Record<string, string> = {
  Normal: "bg-muted text-muted-foreground",
  Emergency: "bg-destructive/10 text-destructive",
  "Follow Up": "bg-info/10 text-info",
};

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h24 = Math.floor(i / 2);
  const min = i % 2 === 0 ? "00" : "30";
  const period = h24 < 12 ? "AM" : "PM";
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${min} ${period}`;
});

const emptyPrescriptionItem = (): PrescriptionItem => ({
  medicine: "", dosage: "", frequency: "", duration: "", instructions: "",
});

const emptyVitals = (): Vitals => ({
  bp: "", temperature: "", weight: "", height: "", spo2: "", pulse: "",
});

const ClinicManagement = () => {
  const {
    schedules, setSchedules, queue, setQueue,
    updateQueueStatus, updateQueueConsultation, updateQueueVitals, updateQueueLabOrders, updateQueueFollowUp,
    refreshData,
  } = useClinicData();

  const { data: labTestCatalog = [] } = useLabTestCatalog();
  const [activeTab, setActiveTab] = useState("slots");
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [queueFilter, setQueueFilter] = useState<string>("all");
  const [patientSearch, setPatientSearch] = useState("");
  const [editSlotDoctorId, setEditSlotDoctorId] = useState<string | null>(null);
  const [slotDate, setSlotDate] = useState<Date>(new Date());
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

  // Removed: Add Doctor button and dialog - doctors auto-pull from staff

  // Consultation dialog state
  const [consultPatient, setConsultPatient] = useState<QueueEntry | null>(null);
  const [consultTab, setConsultTab] = useState("vitals");
  const [consultDiagnosis, setConsultDiagnosis] = useState("");
  const [consultNotes, setConsultNotes] = useState("");
  const [consultVitals, setConsultVitals] = useState<Vitals>(emptyVitals());
  const [consultPrescriptions, setConsultPrescriptions] = useState<PrescriptionItem[]>([emptyPrescriptionItem()]);
  const [consultLabOrders, setConsultLabOrders] = useState<LabOrder[]>([]);
  const [consultFollowUp, setConsultFollowUp] = useState<Date | undefined>();
  const [newLabTest, setNewLabTest] = useState("");
  const [newLabPriority, setNewLabPriority] = useState<"Routine" | "Urgent">("Routine");
  const [newLabCategory, setNewLabCategory] = useState<LabCategory>("Blood");
  const [newLabClinicalNotes, setNewLabClinicalNotes] = useState("");

  // Vitals dialog (separate for nurse entry from queue)
  const [vitalsPatient, setVitalsPatient] = useState<QueueEntry | null>(null);
  const [nurseVitals, setNurseVitals] = useState<Vitals>(emptyVitals());

  const printRef = useRef<HTMLDivElement>(null);

  // Date helpers
  const isPastDate = isBefore(startOfDay(slotDate), startOfDay(new Date()));
  const isTodayDate = isToday(slotDate);

  const isSlotPast = (slotTime: string): boolean => {
    if (!isTodayDate) return false;
    const now = new Date();
    const [time, period] = slotTime.split(" ");
    const [h, m] = time.split(":").map(Number);
    let hours = h;
    if (period === "PM" && h !== 12) hours += 12;
    if (period === "AM" && h === 12) hours = 0;
    const slotDate_ = new Date();
    slotDate_.setHours(hours, m, 0, 0);
    return isBefore(slotDate_, now);
  };

  const editSlotDoctor = editSlotDoctorId ? schedules.find((d) => d.id === editSlotDoctorId) ?? null : null;

  // Slot management
  const updateMaxPatients = (doctorId: string, slotTime: string, delta: number) => {
    setSchedules((prev) =>
      prev.map((doc) =>
        doc.id === doctorId
          ? { ...doc, timeSlots: doc.timeSlots.map((s) => s.time === slotTime ? { ...s, maxPatients: Math.max(1, s.maxPatients + delta) } : s) }
          : doc
      )
    );
  };

  const toggleSlotActive = (doctorId: string, slotTime: string) => {
    setSchedules((prev) =>
      prev.map((doc) =>
        doc.id === doctorId
          ? { ...doc, timeSlots: doc.timeSlots.map((s) => s.time === slotTime ? { ...s, isActive: !s.isActive } : s) }
          : doc
      )
    );
  };

  const updateDoctorAvailability = (doctorId: string, field: "availableFrom" | "availableTo", value: string) => {
    setSchedules((prev) => prev.map((doc) => (doc.id === doctorId ? { ...doc, [field]: value } : doc)));
  };

  // Queue actions
  const handleStartConsultation = (entry: QueueEntry) => {
    updateQueueStatus(entry.id, "In Consultation");
    toast.success(`Started consultation for ${entry.patientName}`);
  };

  const handleOpenVitalsDialog = (entry: QueueEntry) => {
    setVitalsPatient(entry);
    setNurseVitals(entry.vitals || emptyVitals());
  };

  const handleSaveVitals = () => {
    if (!vitalsPatient) return;
    updateQueueVitals(vitalsPatient.id, nurseVitals);
    toast.success(`Vitals saved for ${vitalsPatient.patientName}`);
    setVitalsPatient(null);
  };

  const handleOpenConsultDialog = (entry: QueueEntry) => {
    setConsultPatient(entry);
    setConsultTab("vitals");
    setConsultDiagnosis(entry.diagnosis || "");
    setConsultNotes(entry.doctorNotes || "");
    setConsultVitals(entry.vitals || emptyVitals());
    setConsultPrescriptions(entry.structuredPrescription?.length ? [...entry.structuredPrescription] : [emptyPrescriptionItem()]);
    setConsultLabOrders(entry.labOrders || []);
    setConsultFollowUp(entry.followUpDate ? new Date(entry.followUpDate) : undefined);
  };

  const handleSaveData = () => {
    if (!consultPatient) return;
    // Save vitals
    if (consultVitals.bp || consultVitals.temperature) {
      updateQueueVitals(consultPatient.id, consultVitals);
    }
    // Send lab orders to diagnostics
    if (consultLabOrders.length > 0) {
      updateQueueLabOrders(consultPatient.id, consultLabOrders);
    }
    // Send prescription to pharmacy (saved on queue entry)
    const prescriptionLines = consultPrescriptions
      .filter((p) => p.medicine.trim())
      .map((p) => `${p.medicine} ${p.dosage} – ${p.frequency}${p.duration ? ` for ${p.duration}` : ""}${p.instructions ? ` (${p.instructions})` : ""}`);
    if (prescriptionLines.length > 0 || consultDiagnosis.trim()) {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === consultPatient.id
            ? { ...q, diagnosis: consultDiagnosis || q.diagnosis, prescription: prescriptionLines.length > 0 ? prescriptionLines : q.prescription, structuredPrescription: consultPrescriptions.filter((p) => p.medicine.trim()), doctorNotes: consultNotes || q.doctorNotes }
            : q
        )
      );
    }
    if (consultFollowUp) {
      updateQueueFollowUp(consultPatient.id, format(consultFollowUp, "yyyy-MM-dd"));
    }
    toast.success(`Data saved & sent to Pharmacy/Diagnostics for ${consultPatient.patientName}`);
  };

  const handleCompleteConsultation = () => {
    if (!consultPatient) return;
    if (!consultDiagnosis.trim()) {
      toast.error("Please enter a diagnosis before completing");
      return;
    }
    const prescriptionLines = consultPrescriptions
      .filter((p) => p.medicine.trim())
      .map((p) => `${p.medicine} ${p.dosage} – ${p.frequency}${p.duration ? ` for ${p.duration}` : ""}${p.instructions ? ` (${p.instructions})` : ""}`);

    updateQueueConsultation(consultPatient.id, {
      diagnosis: consultDiagnosis,
      prescription: prescriptionLines,
      structuredPrescription: consultPrescriptions.filter((p) => p.medicine.trim()),
      notes: consultNotes,
    });

    if (consultLabOrders.length > 0) {
      updateQueueLabOrders(consultPatient.id, consultLabOrders);
    }
    if (consultFollowUp) {
      updateQueueFollowUp(consultPatient.id, format(consultFollowUp, "yyyy-MM-dd"));
    }
    if (consultVitals.bp || consultVitals.temperature) {
      updateQueueVitals(consultPatient.id, consultVitals);
    }

    toast.success(`Consultation completed for ${consultPatient.patientName}`);
    setConsultPatient(null);
  };

  const addPrescriptionRow = () => setConsultPrescriptions((prev) => [...prev, emptyPrescriptionItem()]);
  const removePrescriptionRow = (idx: number) => setConsultPrescriptions((prev) => prev.filter((_, i) => i !== idx));
  const updatePrescriptionRow = (idx: number, field: keyof PrescriptionItem, value: string) => {
    setConsultPrescriptions((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const addLabOrder = () => {
    if (!newLabTest.trim() || !consultPatient) return;
    const testDef = labTestCatalog.find((t) => t.name === newLabTest);
    const newOrder: LabOrder = {
      id: `lab-${Date.now()}`,
      testName: newLabTest,
      category: newLabCategory,
      priority: newLabPriority,
      status: "Ordered",
      price: testDef?.price || 0,
      clinicalNotes: newLabClinicalNotes || undefined,
      orderedBy: consultPatient.doctorName,
      orderedAt: new Date().toLocaleTimeString(),
      patientName: consultPatient.patientName,
      patientRegNo: consultPatient.registrationNumber,
    };
    setConsultLabOrders((prev) => [...prev, newOrder]);
    setNewLabTest("");
    setNewLabPriority("Routine");
    setNewLabClinicalNotes("");
  };

  const removeLabOrder = (id: string) => setConsultLabOrders((prev) => prev.filter((l) => l.id !== id));

  const handlePrintPrescription = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow || !consultPatient) return;
    const rxLines = consultPrescriptions.filter((p) => p.medicine.trim());
    printWindow.document.write(`
      <html><head><title>Prescription – ${consultPatient.patientName}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: auto; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 16px; margin-bottom: 24px; }
        .header h1 { font-size: 20px; margin: 0; }
        .header p { margin: 4px 0; font-size: 12px; color: #666; }
        .patient-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
        .section { margin-bottom: 16px; }
        .section h3 { font-size: 14px; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #f5f5f5; }
        .footer { margin-top: 48px; display: flex; justify-content: space-between; font-size: 12px; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <div class="header">
        <h1>EzyOp Clinic</h1>
        <p>Medical Prescription</p>
      </div>
      <div class="patient-info">
        <div><strong>Patient:</strong> ${consultPatient.patientName}<br/><strong>Reg No:</strong> ${consultPatient.registrationNumber}</div>
        <div><strong>Date:</strong> ${format(new Date(), "dd/MM/yyyy")}<br/><strong>Doctor:</strong> ${consultPatient.doctorName}</div>
      </div>
      ${consultVitals.bp ? `<div class="section"><h3>Vitals</h3><p>BP: ${consultVitals.bp} | Temp: ${consultVitals.temperature}°F | Wt: ${consultVitals.weight}kg | SpO2: ${consultVitals.spo2}% | Pulse: ${consultVitals.pulse}/min</p></div>` : ""}
      <div class="section"><h3>Diagnosis</h3><p>${consultDiagnosis}</p></div>
      <div class="section"><h3>Prescription</h3>
      <table><thead><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
      <tbody>${rxLines.map((r, i) => `<tr><td>${i + 1}</td><td>${r.medicine}</td><td>${r.dosage}</td><td>${r.frequency}</td><td>${r.duration}</td><td>${r.instructions}</td></tr>`).join("")}</tbody></table></div>
      ${consultLabOrders.length > 0 ? `<div class="section"><h3>Lab Orders</h3><ul>${consultLabOrders.map((l) => `<li>${l.testName} (${l.priority})</li>`).join("")}</ul></div>` : ""}
      ${consultFollowUp ? `<div class="section"><h3>Follow-up</h3><p>${format(consultFollowUp, "dd/MM/yyyy")}</p></div>` : ""}
      ${consultNotes ? `<div class="section"><h3>Doctor's Notes</h3><p>${consultNotes}</p></div>` : ""}
      <div class="footer"><span>Signature: ___________________</span><span>Date: ${format(new Date(), "dd/MM/yyyy")}</span></div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const filteredQueue = queueFilter === "all" ? queue : queue.filter((q) => q.status === queueFilter);

  const { data: dbPatients = [] } = usePatients();
  const filteredPatients = dbPatients.filter(
    (p: any) =>
      (p.name || "").toLowerCase().includes(patientSearch.toLowerCase()) ||
      (p.registrationNumber || "").toLowerCase().includes(patientSearch.toLowerCase()) ||
      (p.mobile || "").includes(patientSearch)
  );

  const waitingCount = queue.filter((q) => q.status === "Waiting").length;
  const inConsultCount = queue.filter((q) => q.status === "In Consultation").length;
  const completedCount = queue.filter((q) => q.status === "Completed").length;

  const isReadOnly = consultPatient?.status === "Completed";

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-display font-bold text-foreground">Clinic Management</h1>
        <p className="text-sm text-muted-foreground">Manage doctor schedules, monitor OP queue & view patient data</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total Doctors" value={schedules.length} icon={<Users className="h-4 w-4" />} accent="text-primary" />
        <SummaryCard label="Waiting" value={waitingCount} icon={<Clock className="h-4 w-4" />} accent="text-warning" />
        <SummaryCard label="In Consultation" value={inConsultCount} icon={<CalendarIcon className="h-4 w-4" />} accent="text-info" />
        <SummaryCard label="Completed" value={completedCount} icon={<Users className="h-4 w-4" />} accent="text-success" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="slots"><Clock className="h-4 w-4 mr-1.5" /> Doctor Slots</TabsTrigger>
          <TabsTrigger value="queue"><Users className="h-4 w-4 mr-1.5" /> OP Queue</TabsTrigger>
          <TabsTrigger value="patients"><Search className="h-4 w-4 mr-1.5" /> Patients</TabsTrigger>
          <TabsTrigger value="token-display"><Monitor className="h-4 w-4 mr-1.5" /> Token Display</TabsTrigger>
        </TabsList>

        {/* ─── Doctor Slot Management ─── */}
        <TabsContent value="slots">
          <div className="flex items-center gap-3 mb-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                  <CalendarDays className="h-4 w-4 mr-2" />{format(slotDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent mode="single" selected={slotDate} onSelect={(d) => d && setSlotDate(d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
              <SelectTrigger className="w-[240px]"><SelectValue placeholder="Filter by doctor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Doctors</SelectItem>
                {schedules.map((d) => (<SelectItem key={d.id} value={d.id}>{d.doctorName}</SelectItem>))}
              </SelectContent>
            </Select>
            {/* Doctors are auto-pulled from Staff & Payroll */}
          </div>

          <div className="space-y-4">
            {schedules.filter((d) => selectedDoctor === "all" || d.id === selectedDoctor).map((doc) => (
              <div key={doc.id} className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{doc.doctorName}</h3>
                    <p className="text-xs text-muted-foreground">{doc.specialization}</p>
                  </div>
                  {!isPastDate && (
                    <Button variant="outline" size="sm" onClick={() => setEditSlotDoctorId(doc.id)}>
                      <Settings2 className="h-4 w-4 mr-1.5" /> Manage Slots
                    </Button>
                  )}
                </div>
                {isPastDate && <Badge variant="outline" className="text-xs text-muted-foreground">Read Only</Badge>}
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" /> {doc.availableFrom} – {doc.availableTo}</span>
                  <span>{doc.consultationDuration} min/slot</span>
                  <span>{doc.timeSlots.filter((s) => s.isActive).length} active slots</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {doc.timeSlots.filter(s => s.isActive).map((slot) => {
                    const past = isPastDate || isSlotPast(slot.time);
                    const full = slot.bookedPatients >= slot.maxPatients;
                    const pct = (slot.bookedPatients / slot.maxPatients) * 100;
                    return (
                      <div key={slot.time} className={cn("rounded-lg border p-3 text-center transition-all", past ? "border-border/50 bg-muted/40 opacity-50" : full ? "border-destructive/30 bg-destructive/5" : pct >= 60 ? "border-warning/30 bg-warning/5" : "border-border bg-card")}>
                        <p className="text-sm font-medium text-foreground">{slot.time}</p>
                        <p className={cn("text-xs font-semibold mt-1", full ? "text-destructive" : pct >= 60 ? "text-warning" : "text-success")}>{slot.bookedPatients}/{slot.maxPatients}</p>
                        <div className="w-full bg-muted rounded-full h-1.5 mt-1.5">
                          <div className={cn("h-1.5 rounded-full transition-all", full ? "bg-destructive" : pct >= 60 ? "bg-warning" : "bg-success")} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-success" /> Available</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-warning" /> Filling Up</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-destructive" /> Full</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ─── OP Queue ─── */}
        <TabsContent value="queue">
          <div className="flex items-center gap-3 mb-4">
            <Select value={queueFilter} onValueChange={setQueueFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Waiting">Waiting</SelectItem>
                <SelectItem value="In Consultation">In Consultation</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="No Show">No Show</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Token</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Vitals</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQueue.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono font-bold text-foreground">{q.tokenNo}</TableCell>
                    <TableCell>
                      <p className="font-medium text-foreground">{q.patientName}</p>
                      <p className="text-xs text-muted-foreground">{q.registrationNumber}</p>
                    </TableCell>
                    <TableCell className="text-sm">{q.doctorName}</TableCell>
                    <TableCell className="text-sm">{q.timeSlot}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", opdTypeColor[q.opdType])}>{q.opdType}</Badge>
                    </TableCell>
                    <TableCell>
                      {q.vitals?.bp ? (
                        <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                          <Heart className="h-3 w-3 mr-1" /> Done
                        </Badge>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleOpenVitalsDialog(q)} disabled={q.status === "Completed" || q.status === "No Show"}>
                          <Activity className="h-3 w-3 mr-1" /> Add
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", statusColor[q.status])}>{q.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {q.status === "Waiting" && (
                        <Button size="sm" variant="outline" onClick={() => handleStartConsultation(q)}>Start</Button>
                      )}
                      {q.status === "In Consultation" && (
                        <Button size="sm" variant="outline" onClick={() => handleOpenConsultDialog(q)}>
                          <Stethoscope className="h-3.5 w-3.5 mr-1" /> Consult
                        </Button>
                      )}
                      {q.status === "Completed" && q.diagnosis && (
                        <Button size="sm" variant="ghost" onClick={() => handleOpenConsultDialog(q)}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredQueue.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No entries found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ─── Patients Data ─── */}
        <TabsContent value="patients">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} placeholder="Search name, reg. no., or mobile" className="pl-9 h-10" />
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reg. No.</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Age/Gender</TableHead>
                  <TableHead>Blood Group</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>-</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm font-medium text-foreground">{p.registrationNumber}</TableCell>
                    <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.mobile}</TableCell>
                    <TableCell className="text-sm">{p.dob ? `${new Date().getFullYear() - new Date(p.dob).getFullYear()}` : "-"} / {p.gender}</TableCell>
                    <TableCell className="text-sm">{p.bloodGroup || "-"}</TableCell>
                    <TableCell className="text-sm">{p.chronicConditions || "-"}</TableCell>
                    <TableCell className="text-sm">{p.createdAt ? formatDateDisplay(p.createdAt.split("T")[0]) : "-"}</TableCell>
                    <TableCell><Badge variant="outline">-</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelectedPatient(p)}><Eye className="h-4 w-4 mr-1" /> View</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredPatients.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No patients found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ─── Token Display Board ─── */}
        <TabsContent value="token-display">
          <TokenDisplayBoard queue={queue} schedules={schedules} />
        </TabsContent>
      </Tabs>

      {/* ─── Manage Slots Dialog ─── */}
      <Dialog open={!!editSlotDoctorId} onOpenChange={(v) => !v && setEditSlotDoctorId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Manage Slots — {editSlotDoctor?.doctorName}</DialogTitle>
            <p className="text-sm text-muted-foreground">{editSlotDoctor?.specialization}</p>
          </DialogHeader>
          {editSlotDoctor && (
            <>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><ClockIcon className="h-4 w-4" /> Availability Hours</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">From</label>
                    <Select value={editSlotDoctor.availableFrom} onValueChange={(v) => updateDoctorAvailability(editSlotDoctor.id, "availableFrom", v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">To</label>
                    <Select value={editSlotDoctor.availableTo} onValueChange={(v) => updateDoctorAvailability(editSlotDoctor.id, "availableTo", v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {editSlotDoctor.timeSlots.map((slot) => {
                  const past = isSlotPast(slot.time);
                  return (
                    <div key={slot.time} className={cn("flex items-center justify-between p-3 rounded-lg border transition-all", past ? "border-border/50 bg-muted/30 opacity-50" : slot.isActive ? "border-border bg-card" : "border-border/50 bg-muted/30 opacity-60")}>
                      <div className="flex items-center gap-3">
                        <Switch checked={slot.isActive} onCheckedChange={() => toggleSlotActive(editSlotDoctor.id, slot.time)} disabled={past || (slot.bookedPatients > 0 && slot.isActive)} />
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-medium", slot.isActive && !past ? "text-foreground" : "text-muted-foreground")}>{slot.time}</span>
                          {past && <Badge variant="outline" className="text-[10px] text-muted-foreground">Past</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{slot.bookedPatients} booked</span>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateMaxPatients(editSlotDoctor.id, slot.time, -1)} disabled={past || !slot.isActive || slot.maxPatients <= slot.bookedPatients || slot.maxPatients <= 1}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-semibold text-foreground text-sm">{slot.maxPatients}</span>
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateMaxPatients(editSlotDoctor.id, slot.time, 1)} disabled={past || !slot.isActive}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button onClick={() => { setEditSlotDoctorId(null); toast.success("Slot configuration saved"); }} className="w-full mt-2">Save Configuration</Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Nurse Vitals Entry Dialog ─── */}
      <Dialog open={!!vitalsPatient} onOpenChange={(v) => !v && setVitalsPatient(null)}>
        <DialogContent className="max-w-md">
          {vitalsPatient && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" /> Record Vitals
                </DialogTitle>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{vitalsPatient.patientName}</Badge>
                  <Badge variant="outline" className="text-xs font-mono">{vitalsPatient.registrationNumber}</Badge>
                </div>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Heart className="h-3 w-3" /> Blood Pressure</Label>
                  <Input value={nurseVitals.bp} onChange={(e) => setNurseVitals({ ...nurseVitals, bp: e.target.value })} placeholder="120/80 mmHg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Thermometer className="h-3 w-3" /> Temperature</Label>
                  <Input value={nurseVitals.temperature} onChange={(e) => setNurseVitals({ ...nurseVitals, temperature: e.target.value })} placeholder="98.6 °F" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Weight className="h-3 w-3" /> Weight (kg)</Label>
                  <Input value={nurseVitals.weight} onChange={(e) => setNurseVitals({ ...nurseVitals, weight: e.target.value })} placeholder="70" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Height (cm)</Label>
                  <Input value={nurseVitals.height} onChange={(e) => setNurseVitals({ ...nurseVitals, height: e.target.value })} placeholder="170" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">SpO2 (%)</Label>
                  <Input value={nurseVitals.spo2} onChange={(e) => setNurseVitals({ ...nurseVitals, spo2: e.target.value })} placeholder="98" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Pulse (bpm)</Label>
                  <Input value={nurseVitals.pulse} onChange={(e) => setNurseVitals({ ...nurseVitals, pulse: e.target.value })} placeholder="72" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setVitalsPatient(null)}>Cancel</Button>
                <Button onClick={handleSaveVitals}><Activity className="h-4 w-4 mr-1.5" /> Save Vitals</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Enhanced Consultation Dialog ─── */}
      <Dialog open={!!consultPatient} onOpenChange={(v) => !v && setConsultPatient(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {consultPatient && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-primary" />
                  {isReadOnly ? "Consultation Summary" : "Consultation"}
                </DialogTitle>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{consultPatient.patientName}</Badge>
                  <Badge variant="outline" className="text-xs font-mono">{consultPatient.registrationNumber}</Badge>
                  <Badge variant="outline" className={cn("text-xs", opdTypeColor[consultPatient.opdType])}>{consultPatient.opdType}</Badge>
                  <Badge variant="outline" className="text-xs">{consultPatient.timeSlot}</Badge>
                </div>
              </DialogHeader>

              {/* Consult tabs */}
              <Tabs value={consultTab} onValueChange={setConsultTab}>
                <TabsList className="w-full grid grid-cols-5">
                  <TabsTrigger value="vitals" className="text-xs"><Activity className="h-3.5 w-3.5 mr-1" /> Vitals</TabsTrigger>
                  <TabsTrigger value="labs" className="text-xs"><FlaskConical className="h-3.5 w-3.5 mr-1" /> Labs</TabsTrigger>
                  <TabsTrigger value="diagnosis" className="text-xs"><Stethoscope className="h-3.5 w-3.5 mr-1" /> Diagnosis</TabsTrigger>
                  <TabsTrigger value="prescription" className="text-xs"><Pill className="h-3.5 w-3.5 mr-1" /> Rx</TabsTrigger>
                  <TabsTrigger value="followup" className="text-xs"><CalendarPlus className="h-3.5 w-3.5 mr-1" /> Follow-up</TabsTrigger>
                </TabsList>

                {/* Vitals Tab */}
                <TabsContent value="vitals" className="mt-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1"><Heart className="h-3 w-3 text-destructive" /> BP</Label>
                      <Input value={consultVitals.bp} onChange={(e) => setConsultVitals({ ...consultVitals, bp: e.target.value })} placeholder="120/80" disabled={isReadOnly} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1"><Thermometer className="h-3 w-3 text-warning" /> Temp (°F)</Label>
                      <Input value={consultVitals.temperature} onChange={(e) => setConsultVitals({ ...consultVitals, temperature: e.target.value })} placeholder="98.6" disabled={isReadOnly} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Weight (kg)</Label>
                      <Input value={consultVitals.weight} onChange={(e) => setConsultVitals({ ...consultVitals, weight: e.target.value })} placeholder="70" disabled={isReadOnly} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Height (cm)</Label>
                      <Input value={consultVitals.height} onChange={(e) => setConsultVitals({ ...consultVitals, height: e.target.value })} placeholder="170" disabled={isReadOnly} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">SpO2 (%)</Label>
                      <Input value={consultVitals.spo2} onChange={(e) => setConsultVitals({ ...consultVitals, spo2: e.target.value })} placeholder="98" disabled={isReadOnly} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Pulse (bpm)</Label>
                      <Input value={consultVitals.pulse} onChange={(e) => setConsultVitals({ ...consultVitals, pulse: e.target.value })} placeholder="72" disabled={isReadOnly} />
                    </div>
                  </div>
                </TabsContent>

                {/* Diagnosis Tab */}
                <TabsContent value="diagnosis" className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Diagnosis *</Label>
                    <Input value={consultDiagnosis} onChange={(e) => setConsultDiagnosis(e.target.value)} placeholder="e.g., Type 2 Diabetes, Viral Fever" disabled={isReadOnly} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground"><FileText className="h-3 w-3 inline mr-1" /> Doctor's Notes</Label>
                    <Textarea value={consultNotes} onChange={(e) => setConsultNotes(e.target.value)} placeholder="Clinical observations, follow-up instructions..." rows={4} disabled={isReadOnly} />
                  </div>
                </TabsContent>

                {/* Prescription Tab */}
                <TabsContent value="prescription" className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold flex items-center gap-1"><Pill className="h-4 w-4" /> Structured Prescription</Label>
                    {!isReadOnly && (
                      <Button size="sm" variant="outline" onClick={addPrescriptionRow}><Plus className="h-3.5 w-3.5 mr-1" /> Add Medicine</Button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {consultPrescriptions.map((rx, idx) => (
                      <div key={idx} className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground">Medicine #{idx + 1}</span>
                          {!isReadOnly && consultPrescriptions.length > 1 && (
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removePrescriptionRow(idx)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input value={rx.medicine} onChange={(e) => updatePrescriptionRow(idx, "medicine", e.target.value)} placeholder="Medicine name" disabled={isReadOnly} className="text-sm" />
                          <Input value={rx.dosage} onChange={(e) => updatePrescriptionRow(idx, "dosage", e.target.value)} placeholder="Dosage (e.g. 500mg)" disabled={isReadOnly} className="text-sm" />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Select value={rx.frequency} onValueChange={(v) => updatePrescriptionRow(idx, "frequency", v)} disabled={isReadOnly}>
                            <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Frequency" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Once daily">Once daily</SelectItem>
                              <SelectItem value="Twice daily">Twice daily</SelectItem>
                              <SelectItem value="Thrice daily">Thrice daily</SelectItem>
                              <SelectItem value="SOS">SOS (as needed)</SelectItem>
                              <SelectItem value="Before meals">Before meals</SelectItem>
                              <SelectItem value="After meals">After meals</SelectItem>
                              <SelectItem value="At bedtime">At bedtime</SelectItem>
                              <SelectItem value="Weekly">Weekly</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input value={rx.duration} onChange={(e) => updatePrescriptionRow(idx, "duration", e.target.value)} placeholder="Duration (e.g. 7 days)" disabled={isReadOnly} className="text-xs" />
                          <Input value={rx.instructions} onChange={(e) => updatePrescriptionRow(idx, "instructions", e.target.value)} placeholder="Instructions" disabled={isReadOnly} className="text-xs" />
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* Labs Tab */}
                <TabsContent value="labs" className="mt-4 space-y-4">
                  <Label className="text-sm font-semibold flex items-center gap-1"><FlaskConical className="h-4 w-4" /> Lab Test Orders</Label>
                  {!isReadOnly && (
                    <div className="space-y-3 bg-muted/30 rounded-lg p-4 border border-border">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Category</Label>
                          <Select value={newLabCategory} onValueChange={(v) => { setNewLabCategory(v as LabCategory); setNewLabTest(""); }}>
                            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Blood">🩸 Blood</SelectItem>
                              <SelectItem value="Urine">🧪 Urine</SelectItem>
                              <SelectItem value="Radiology">📷 Radiology</SelectItem>
                              <SelectItem value="Serology">🔬 Serology</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Priority</Label>
                          <Select value={newLabPriority} onValueChange={(v) => setNewLabPriority(v as "Routine" | "Urgent")}>
                            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Routine">Routine</SelectItem>
                              <SelectItem value="Urgent">🔴 Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Select Test</Label>
                        <Select value={newLabTest} onValueChange={setNewLabTest}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Choose a test..." /></SelectTrigger>
                          <SelectContent>
                            {labTestCatalog.filter((t) => t.category === newLabCategory).map((t) => (
                              <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Clinical Notes (optional)</Label>
                        <Input value={newLabClinicalNotes} onChange={(e) => setNewLabClinicalNotes(e.target.value)} placeholder="e.g. Fasting sample, suspected typhoid..." className="text-xs" />
                      </div>
                      <Button size="sm" onClick={addLabOrder} disabled={!newLabTest}><Plus className="h-3.5 w-3.5 mr-1" /> Add Test</Button>
                    </div>
                  )}
                  {consultLabOrders.length > 0 ? (
                    <div className="space-y-2">
                      {consultLabOrders.map((lab) => (
                        <div key={lab.id} className="flex items-center justify-between border border-border rounded-lg p-3 bg-card">
                          <div className="flex items-center gap-2 flex-wrap">
                            <FlaskConical className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground">{lab.testName}</span>
                            <Badge variant="outline" className={cn("text-[10px]", labCategoryColors[lab.category])}>{lab.category}</Badge>
                            <Badge variant="outline" className={cn("text-[10px]", lab.priority === "Urgent" ? "text-destructive border-destructive/30 bg-destructive/10" : "text-muted-foreground")}>{lab.priority}</Badge>
                            <Badge variant="outline" className={cn("text-[10px]", lab.status === "Completed" ? "text-success border-success/20 bg-success/10" : lab.status === "In Progress" ? "text-info border-info/20 bg-info/10" : "text-muted-foreground")}>{lab.status}</Badge>
                            {lab.status === "Completed" && lab.results && (
                              <Badge variant="outline" className="text-[10px] text-success border-success/20 bg-success/10 cursor-pointer">
                                <CheckCircle2 className="h-3 w-3 mr-0.5" /> Report Ready
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {lab.status === "Completed" && lab.results && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs"><Eye className="h-3 w-3 mr-1" /> View</Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 max-h-60 overflow-y-auto" align="end">
                                  <h4 className="text-sm font-semibold mb-2">{lab.testName} Report</h4>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs p-1">Parameter</TableHead>
                                        <TableHead className="text-xs p-1">Value</TableHead>
                                        <TableHead className="text-xs p-1">Normal</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {lab.results.map((r, i) => (
                                        <TableRow key={i}>
                                          <TableCell className={cn("text-xs p-1", r.isAbnormal && "text-destructive font-semibold")}>{r.parameter}</TableCell>
                                          <TableCell className={cn("text-xs p-1 font-mono", r.isAbnormal && "text-destructive font-bold")}>{r.value} {r.unit}</TableCell>
                                          <TableCell className="text-xs p-1 text-muted-foreground">{r.normalRange}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                  {lab.reportNotes && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">{lab.reportNotes}</p>}
                                  {lab.reportFiles && lab.reportFiles.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-border space-y-1">
                                      <p className="text-xs font-semibold text-foreground flex items-center gap-1"><Download className="h-3 w-3" /> Attached Files</p>
                                      {lab.reportFiles.map((file, fi) => (
                                        <a key={fi} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-info hover:underline">
                                          <FileText className="h-3 w-3" /> {file.name}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </PopoverContent>
                              </Popover>
                            )}
                            {!isReadOnly && lab.status === "Ordered" && (
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeLabOrder(lab.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No lab orders yet</p>
                  )}
                </TabsContent>

                {/* Follow-up Tab */}
                <TabsContent value="followup" className="mt-4 space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-1"><CalendarPlus className="h-4 w-4" /> Schedule Follow-up</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !consultFollowUp && "text-muted-foreground")} disabled={isReadOnly}>
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {consultFollowUp ? format(consultFollowUp, "dd/MM/yyyy") : "Select follow-up date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={consultFollowUp}
                        onSelect={setConsultFollowUp}
                        disabled={(date) => isBefore(date, startOfDay(new Date()))}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  {consultFollowUp && (
                    <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
                      <p className="text-sm text-foreground">Follow-up scheduled for <strong>{format(consultFollowUp, "dd/MM/yyyy")}</strong></p>
                      {!isReadOnly && (
                        <Button size="sm" variant="ghost" onClick={() => setConsultFollowUp(undefined)}><X className="h-3.5 w-3.5" /></Button>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <Button variant="outline" size="sm" onClick={handlePrintPrescription}>
                  <Printer className="h-4 w-4 mr-1.5" /> Print Prescription
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setConsultPatient(null)}>{isReadOnly ? "Close" : "Cancel"}</Button>
                  {!isReadOnly && (
                    <>
                      <Button variant="secondary" onClick={handleSaveData}>
                        <Save className="h-4 w-4 mr-1.5" /> Save & Send
                      </Button>
                      <Button onClick={handleCompleteConsultation}>
                        <Stethoscope className="h-4 w-4 mr-1.5" /> Complete Consultation
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Patient Detail Dialog ─── */}
      <Dialog open={!!selectedPatient} onOpenChange={(v) => !v && setSelectedPatient(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedPatient && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{selectedPatient.name}</DialogTitle>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{selectedPatient.registrationNumber}</Badge>
                  <Badge variant="outline" className="text-xs">{selectedPatient.dob ? `${new Date().getFullYear() - new Date(selectedPatient.dob).getFullYear()} yrs` : "-"} · {selectedPatient.gender}</Badge>
                  <Badge variant="outline" className="text-xs">{selectedPatient.mobile}</Badge>
                </div>
              </DialogHeader>
              <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-3 gap-4 text-sm">
                <div><p className="text-xs text-muted-foreground">Blood Group</p><p className="font-medium text-foreground">{selectedPatient.bloodGroup || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Chronic Conditions</p><p className="font-medium text-foreground">{selectedPatient.chronicConditions || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Address</p><p className="font-medium text-foreground">{selectedPatient.address || "-"}</p></div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5"><FileText className="h-4 w-4" /> Patient Information</h4>
                <div className="border border-border rounded-lg p-4 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><p className="text-xs text-muted-foreground">Emergency Contact</p><p className="text-foreground">{selectedPatient.emergencyContact || "-"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Date of Birth</p><p className="text-foreground">{selectedPatient.dob ? formatDateDisplay(selectedPatient.dob) : "-"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Registered On</p><p className="text-foreground">{selectedPatient.createdAt ? formatDateDisplay(selectedPatient.createdAt.split("T")[0]) : "-"}</p></div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Add Doctor Schedule Dialog ─── */}
      <Dialog open={showAddDoctor} onOpenChange={setShowAddDoctor}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Add Doctor Schedule</DialogTitle>
            <p className="text-sm text-muted-foreground">Select a doctor from staff to create a schedule for {format(slotDate, "dd/MM/yyyy")}</p>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {(() => {
              const scheduledNames = schedules.map((s) => s.doctorName.toLowerCase());
              const available = (staffDoctors as any[]).filter(
                (s: any) => !scheduledNames.includes((s.name || "").toLowerCase()) && (s.status === "Active" || !s.status)
              );
              if (available.length === 0) {
                return <p className="text-sm text-muted-foreground py-4 text-center">All staff doctors already have schedules for this date.</p>;
              }
              return available.map((doc: any) => (
                <Button
                  key={doc.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={async () => {
                    try {
                      await clinicService.createSchedule({
                        doctorName: doc.name,
                        specialization: doc.specialization || doc.designation || "",
                        scheduleDate: format(slotDate, "yyyy-MM-dd"),
                        availableFrom: "9:00 AM",
                        availableTo: "5:00 PM",
                        consultationDuration: 30,
                      } as any);
                      await refreshData();
                      toast.success(`Schedule created for Dr. ${doc.name}`);
                      setShowAddDoctor(false);
                    } catch (err: any) {
                      toast.error(err.message || "Failed to create schedule");
                    }
                  }}
                >
                  <Stethoscope className="h-4 w-4 mr-2 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.specialization || doc.designation || "General"}</p>
                  </div>
                </Button>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SummaryCard = ({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent: string }) => (
  <div className="bg-card rounded-xl border border-border p-4">
    <div className="flex items-center gap-2 mb-2">
      <span className={accent}>{icon}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
    <p className="text-2xl font-bold text-foreground">{value}</p>
  </div>
);

const TokenDisplayBoard = ({ queue, schedules }: { queue: QueueEntry[]; schedules: DoctorSchedule[] }) => {
  const doctorQueues = schedules.map((doc) => {
    const docQueue = queue.filter((q) => q.doctorName === doc.doctorName);
    const serving = docQueue.find((q) => q.status === "In Consultation");
    const waiting = docQueue.filter((q) => q.status === "Waiting");
    const completed = docQueue.filter((q) => q.status === "Completed");
    const estWaitMin = waiting.length * 10;
    return { doc, serving, waiting, completed, estWaitMin };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Live token status — suitable for waiting area display</p>
        <Badge variant="outline" className="animate-pulse text-success border-success/30 bg-success/10">● LIVE</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {doctorQueues.map(({ doc, serving, waiting, completed, estWaitMin }) => (
          <div key={doc.id} className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="bg-primary/5 border-b border-border px-5 py-3">
              <h3 className="font-semibold text-foreground">{doc.doctorName}</h3>
              <p className="text-xs text-muted-foreground">{doc.specialization}</p>
            </div>
            <div className="p-5">
              <div className="text-center mb-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Now Serving</p>
                {serving ? (
                  <div>
                    <span className="text-4xl font-bold text-primary">{serving.tokenNo}</span>
                    <p className="text-sm text-foreground mt-1">{serving.patientName}</p>
                  </div>
                ) : (
                  <span className="text-2xl font-bold text-muted-foreground">—</span>
                )}
              </div>
              {waiting.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-2">Up Next</p>
                  <div className="flex flex-wrap gap-2">
                    {waiting.slice(0, 6).map((w) => (
                      <Badge key={w.id} variant="outline" className="text-base font-mono font-bold px-3 py-1">{w.tokenNo}</Badge>
                    ))}
                    {waiting.length > 6 && <Badge variant="outline" className="text-xs">+{waiting.length - 6} more</Badge>}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
                <span>Completed: {completed.length}</span>
                <span>Waiting: {waiting.length}</span>
                <span>~{estWaitMin} min wait</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClinicManagement;
