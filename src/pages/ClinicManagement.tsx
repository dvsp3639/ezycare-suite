import { useState, useMemo } from "react";
import { format, startOfDay, isBefore, isToday } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Clock, Users, Search, Settings2, Plus, Minus, Eye, FileText, Pill, ClockIcon, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  mockDoctorSchedules,
  mockQueue,
  mockClinicPatients,
  type DoctorSchedule,
  type QueueEntry,
  type ClinicPatient,
} from "@/data/mockClinicData";

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


const ClinicManagement = () => {
  const [activeTab, setActiveTab] = useState("slots");
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [queueFilter, setQueueFilter] = useState<string>("all");
  const [patientSearch, setPatientSearch] = useState("");
  const [editSlotDoctorId, setEditSlotDoctorId] = useState<string | null>(null);
  const [slotDate, setSlotDate] = useState<Date>(new Date());
  const [schedules, setSchedules] = useState(mockDoctorSchedules);
  const [queue, setQueue] = useState(mockQueue);
  const [selectedPatient, setSelectedPatient] = useState<ClinicPatient | null>(null);

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

  // Derive dialog doctor from schedules state (fixes stale data bug)
  const editSlotDoctor = editSlotDoctorId
    ? schedules.find((d) => d.id === editSlotDoctorId) ?? null
    : null;

  // Slot management
  const updateMaxPatients = (doctorId: string, slotTime: string, delta: number) => {
    setSchedules((prev) =>
      prev.map((doc) =>
        doc.id === doctorId
          ? {
              ...doc,
              timeSlots: doc.timeSlots.map((s) =>
                s.time === slotTime
                  ? { ...s, maxPatients: Math.max(1, s.maxPatients + delta) }
                  : s
              ),
            }
          : doc
      )
    );
  };

  const toggleSlotActive = (doctorId: string, slotTime: string) => {
    setSchedules((prev) =>
      prev.map((doc) =>
        doc.id === doctorId
          ? {
              ...doc,
              timeSlots: doc.timeSlots.map((s) =>
                s.time === slotTime ? { ...s, isActive: !s.isActive } : s
              ),
            }
          : doc
      )
    );
  };

  const updateDoctorAvailability = (doctorId: string, field: "availableFrom" | "availableTo", value: string) => {
    setSchedules((prev) =>
      prev.map((doc) => (doc.id === doctorId ? { ...doc, [field]: value } : doc))
    );
  };

  // Queue actions
  const updateQueueStatus = (id: string, status: QueueEntry["status"]) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
    toast.success(`Status updated to ${status}`);
  };

  const filteredQueue =
    queueFilter === "all" ? queue : queue.filter((q) => q.status === queueFilter);

  const filteredPatients = mockClinicPatients.filter(
    (p) =>
      p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
      p.registrationNumber.toLowerCase().includes(patientSearch.toLowerCase()) ||
      p.mobile.includes(patientSearch)
  );

  const waitingCount = queue.filter((q) => q.status === "Waiting").length;
  const inConsultCount = queue.filter((q) => q.status === "In Consultation").length;
  const completedCount = queue.filter((q) => q.status === "Completed").length;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-display font-bold text-foreground">Clinic Management</h1>
        <p className="text-sm text-muted-foreground">
          Manage doctor schedules, monitor OP queue & view patient data
        </p>
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
          <TabsTrigger value="slots">
            <Clock className="h-4 w-4 mr-1.5" /> Doctor Slots
          </TabsTrigger>
          <TabsTrigger value="queue">
            <Users className="h-4 w-4 mr-1.5" /> OP Queue
          </TabsTrigger>
          <TabsTrigger value="patients">
            <Search className="h-4 w-4 mr-1.5" /> Patients
          </TabsTrigger>
        </TabsList>

        {/* ─── Doctor Slot Management ─── */}
        <TabsContent value="slots">
          <div className="flex items-center gap-3 mb-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  {format(slotDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={slotDate}
                  onSelect={(d) => d && setSlotDate(d)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Filter by doctor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Doctors</SelectItem>
                {schedules.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.doctorName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {schedules
              .filter((d) => selectedDoctor === "all" || d.id === selectedDoctor)
              .map((doc) => (
                <div key={doc.id} className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{doc.doctorName}</h3>
                      <p className="text-xs text-muted-foreground">{doc.specialization}</p>
                    </div>
                    {!isPastDate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditSlotDoctorId(doc.id)}
                      >
                        <Settings2 className="h-4 w-4 mr-1.5" /> Manage Slots
                      </Button>
                    )}
                  </div>
                    {isPastDate && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Read Only</Badge>
                    )}

                  {/* Availability info */}
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
                        <div
                          key={slot.time}
                          className={cn(
                            "rounded-lg border p-3 text-center transition-all",
                            past
                              ? "border-border/50 bg-muted/40 opacity-50"
                              : full
                              ? "border-destructive/30 bg-destructive/5"
                              : pct >= 60
                              ? "border-warning/30 bg-warning/5"
                              : "border-border bg-card"
                          )}
                        >
                          <p className="text-sm font-medium text-foreground">{slot.time}</p>
                          <p className={cn(
                            "text-xs font-semibold mt-1",
                            full ? "text-destructive" : pct >= 60 ? "text-warning" : "text-success"
                          )}>
                            {slot.bookedPatients}/{slot.maxPatients}
                          </p>
                          <div className="w-full bg-muted rounded-full h-1.5 mt-1.5">
                            <div
                              className={cn(
                                "h-1.5 rounded-full transition-all",
                                full ? "bg-destructive" : pct >= 60 ? "bg-warning" : "bg-success"
                              )}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
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
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
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
                  <TableHead>Check-in</TableHead>
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
                      <Badge variant="outline" className={cn("text-xs", opdTypeColor[q.opdType])}>
                        {q.opdType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{q.checkInTime || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", statusColor[q.status])}>
                        {q.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {q.status === "Waiting" && (
                        <Button size="sm" variant="outline" onClick={() => updateQueueStatus(q.id, "In Consultation")}>
                          Start
                        </Button>
                      )}
                      {q.status === "In Consultation" && (
                        <Button size="sm" variant="outline" onClick={() => updateQueueStatus(q.id, "Completed")}>
                          Complete
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredQueue.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No entries found
                    </TableCell>
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
              <Input
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search name, reg. no., or mobile"
                className="pl-9 h-10"
              />
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
                  <TableHead>Doctor</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Last Visit</TableHead>
                  <TableHead>Visits</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm font-medium text-foreground">{p.registrationNumber}</TableCell>
                    <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.mobile}</TableCell>
                    <TableCell className="text-sm">{p.age} / {p.gender}</TableCell>
                    <TableCell className="text-sm">{p.doctor}</TableCell>
                    <TableCell className="text-sm">{p.diagnosis}</TableCell>
                    <TableCell className="text-sm">{formatDateDisplay(p.lastVisit)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.totalVisits}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelectedPatient(p)}>
                        <Eye className="h-4 w-4 mr-1" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredPatients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No patients found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
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
              {/* Availability Hours */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ClockIcon className="h-4 w-4" /> Availability Hours
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">From</label>
                    <Select value={editSlotDoctor.availableFrom} onValueChange={(v) => updateDoctorAvailability(editSlotDoctor.id, "availableFrom", v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">To</label>
                    <Select value={editSlotDoctor.availableTo} onValueChange={(v) => updateDoctorAvailability(editSlotDoctor.id, "availableTo", v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Slot Configuration */}
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {editSlotDoctor.timeSlots.map((slot) => {
                  const past = isSlotPast(slot.time);
                  return (
                  <div
                    key={slot.time}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-all",
                      past ? "border-border/50 bg-muted/30 opacity-50" :
                      slot.isActive ? "border-border bg-card" : "border-border/50 bg-muted/30 opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={slot.isActive}
                        onCheckedChange={() => toggleSlotActive(editSlotDoctor.id, slot.time)}
                        disabled={past || (slot.bookedPatients > 0 && slot.isActive)}
                      />
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm font-medium", slot.isActive && !past ? "text-foreground" : "text-muted-foreground")}>
                          {slot.time}
                        </span>
                        {past && <Badge variant="outline" className="text-[10px] text-muted-foreground">Past</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {slot.bookedPatients} booked
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => updateMaxPatients(editSlotDoctor.id, slot.time, -1)}
                          disabled={past || !slot.isActive || slot.maxPatients <= slot.bookedPatients || slot.maxPatients <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-semibold text-foreground text-sm">{slot.maxPatients}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => updateMaxPatients(editSlotDoctor.id, slot.time, 1)}
                          disabled={past || !slot.isActive}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
              <Button onClick={() => { setEditSlotDoctorId(null); toast.success("Slot configuration saved"); }} className="w-full mt-2">
                Save Configuration
              </Button>
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
                  <Badge variant="outline" className="text-xs">{selectedPatient.age} yrs · {selectedPatient.gender}</Badge>
                  <Badge variant="outline" className="text-xs">{selectedPatient.mobile}</Badge>
                </div>
              </DialogHeader>

              {/* Current Overview */}
              <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Current Doctor</p>
                  <p className="font-medium text-foreground">{selectedPatient.doctor}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Latest Diagnosis</p>
                  <p className="font-medium text-foreground">{selectedPatient.diagnosis}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Visits</p>
                  <p className="font-medium text-foreground">{selectedPatient.totalVisits}</p>
                </div>
              </div>

              {/* Visit History */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Visit History
                </h4>
                <div className="space-y-3">
                  {selectedPatient.visitHistory.map((visit) => (
                    <div key={visit.id} className="border border-border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{formatDateDisplay(visit.date)}</span>
                          <Badge variant="outline" className={cn("text-xs", opdTypeColor[visit.opdType])}>
                            {visit.opdType}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{visit.doctor}</span>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Diagnosis</p>
                        <p className="text-sm font-medium text-foreground">{visit.diagnosis}</p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Pill className="h-3 w-3" /> Prescription
                        </p>
                        <ul className="space-y-0.5">
                          {visit.prescription.map((rx, i) => (
                            <li key={i} className="text-sm text-foreground flex items-start gap-1.5">
                              <span className="text-primary mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                              {rx}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {visit.notes && (
                        <div className="bg-muted/50 rounded p-2">
                          <p className="text-xs text-muted-foreground">Doctor's Notes</p>
                          <p className="text-sm text-foreground">{visit.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
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

export default ClinicManagement;
