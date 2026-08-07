import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchSelect } from "@/components/daycare/SearchSelect";
import { useToast } from "@/hooks/use-toast";
import {
  Sun, Search, Plus, Activity, CheckCircle, Receipt, IndianRupee, Users, ChevronRight, Stethoscope, Clock,
} from "lucide-react";
import { istDateStr, istTimeStr } from "@/lib/datetime";
import { useDayCareSessions, useCreateDayCareSession } from "@/modules/daycare/hooks";
import { daycareCaseService } from "@/modules/daycare/services";
import { usePatients } from "@/modules/patients/hooks";
import { useStaffMembers } from "@/modules/staff/hooks";

export const DAYCARE_STATUSES = ["Admitted", "Under Treatment", "Ready for Billing", "Completed", "Discharged"] as const;

export const statusBadge = (s: string) => {
  switch (s) {
    case "Admitted": return "bg-info/10 text-info border-info/30";
    case "Under Treatment":
    case "In Progress": return "bg-warning/10 text-warning border-warning/30";
    case "Ready for Billing": return "bg-primary/10 text-primary border-primary/30";
    case "Completed":
    case "Discharged": return "bg-success/10 text-success border-success/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const DEPARTMENTS = ["General Medicine", "Surgery", "Paediatrics", "Orthopaedics", "Gynaecology", "Oncology", "Nephrology", "Cardiology", "ENT", "Other"];

const DayCare = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const today = istDateStr();

  const { data: sessions = [], isLoading } = useDayCareSessions(today);
  const { data: patients = [] } = usePatients();
  const { data: staff = [] } = useStaffMembers();
  const createSession = useCreateDayCareSession();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    patientId: "", department: "", doctorName: "",
    admissionTime: istTimeStr(), chiefComplaint: "", remarks: "",
  });

  const doctors = useMemo(
    () => (staff as any[]).filter((s) => s.role === "Doctor" && s.status !== "Inactive"),
    [staff],
  );

  const stats = useMemo(() => {
    const list = sessions as any[];
    const norm = (s: string) => (s === "In Progress" ? "Under Treatment" : s);
    return {
      admissions: list.length,
      underTreatment: list.filter((s) => norm(s.status) === "Under Treatment").length,
      readyForBilling: list.filter((s) => norm(s.status) === "Ready for Billing").length,
      completed: list.filter((s) => ["Completed", "Discharged"].includes(norm(s.status))).length,
      revenue: list.reduce((sum, s) => sum + (s.bill?.paymentStatus === "Paid" ? Number(s.bill.grandTotal || 0) : 0), 0),
    };
  }, [sessions]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (sessions as any[]).filter((s) => {
      const matchQ = !q ||
        (s.patientName || "").toLowerCase().includes(q) ||
        (s.registrationNumber || "").toLowerCase().includes(q) ||
        (s.doctorName || "").toLowerCase().includes(q);
      const status = s.status === "In Progress" ? "Under Treatment" : s.status;
      return matchQ && (statusFilter === "all" || status === statusFilter);
    });
  }, [sessions, search, statusFilter]);

  const handleCreate = async () => {
    const patient = (patients as any[]).find((p) => p.id === form.patientId);
    if (!patient || !form.doctorName) {
      toast({ title: "Patient and doctor are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const created: any = await createSession.mutateAsync({
        patientId: patient.id,
        patientName: patient.name,
        registrationNumber: patient.registrationNumber,
        age: patient.age ?? null,
        gender: patient.gender || "",
        mobile: patient.mobile || "",
        doctorName: form.doctorName,
        department: form.department,
        admissionTime: form.admissionTime || istTimeStr(),
        chiefComplaint: form.chiefComplaint,
        remarks: form.remarks,
        status: "Admitted",
        sessionDate: today,
      } as any);
      await daycareCaseService.logEvent(created.id, "Patient Admitted", `${patient.name} • ${form.doctorName}`);
      toast({ title: "Day Care case created" });
      setShowNew(false);
      setForm({ patientId: "", department: "", doctorName: "", admissionTime: istTimeStr(), chiefComplaint: "", remarks: "" });
      navigate(`/day-care/${created.id}`);
    } catch (e: any) {
      toast({ title: "Could not create case", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const cards = [
    { label: "Today's Admissions", value: stats.admissions, icon: Users, tone: "text-info" },
    { label: "Under Treatment", value: stats.underTreatment, icon: Activity, tone: "text-warning" },
    { label: "Ready for Billing", value: stats.readyForBilling, icon: Receipt, tone: "text-primary" },
    { label: "Completed Cases", value: stats.completed, icon: CheckCircle, tone: "text-success" },
    { label: "Today's Revenue", value: `₹${stats.revenue.toLocaleString("en-IN")}`, icon: IndianRupee, tone: "text-success" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Sun className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Day Care Services</h1>
          <p className="text-sm text-muted-foreground">One patient, one day care case — admission to discharge</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{c.label}</p>
                  <p className="text-xl font-bold mt-1">{c.value}</p>
                </div>
                <c.icon className={`h-5 w-5 shrink-0 ${c.tone}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search patient, UHID or doctor…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-52"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {DAYCARE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New Day Care Case
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading cases…</p>}
        {!isLoading && filtered.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3 border-dashed">
            <CardContent className="p-10 text-center text-muted-foreground text-sm">
              No day care cases for today. Create one to get started.
            </CardContent>
          </Card>
        )}
        {filtered.map((s: any) => (
          <Card key={s.id} className="border-border/60 hover:border-primary/40 transition-colors">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{s.patientName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{s.registrationNumber}</p>
                </div>
                <Badge variant="outline" className={`text-[11px] ${statusBadge(s.status)}`}>
                  {s.status === "In Progress" ? "Under Treatment" : s.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 truncate"><Stethoscope className="h-3.5 w-3.5" />{s.doctorName || "—"}</span>
                <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{s.admissionTime || "—"}</span>
              </div>
              <Button variant="outline" size="sm" className="w-full justify-between" onClick={() => navigate(`/day-care/${s.id}`)}>
                View Case <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Day Care Case</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Patient *</Label>
              <SearchSelect
                options={(patients as any[]).map((p) => ({ id: p.id, name: p.name, meta: `${p.registrationNumber} • ${p.mobile || ""}` }))}
                value={form.patientId}
                placeholder="Search patient by name / UHID"
                onSelect={(o) => setForm((f) => ({ ...f, patientId: o.id }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Doctor *</Label>
                <SearchSelect
                  options={doctors.map((d: any) => ({ id: d.name, name: d.name, meta: d.specialization || "" }))}
                  value={form.doctorName}
                  placeholder="Select doctor"
                  onSelect={(o) => setForm((f) => ({ ...f, doctorName: o.name }))}
                />
              </div>
              <div>
                <Label className="text-xs">Department</Label>
                <Select value={form.department} onValueChange={(v) => setForm((f) => ({ ...f, department: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Admission Time</Label>
              <Input type="time" value={form.admissionTime} onChange={(e) => setForm((f) => ({ ...f, admissionTime: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Chief Complaint</Label>
              <Textarea rows={2} value={form.chiefComplaint} onChange={(e) => setForm((f) => ({ ...f, chiefComplaint: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Remarks</Label>
              <Textarea rows={2} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Creating…" : "Create Case"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DayCare;
