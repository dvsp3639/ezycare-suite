import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar, Clock, Users, Search, Settings2, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  mockDoctorSchedules,
  mockQueue,
  mockClinicPatients,
  type DoctorSchedule,
  type QueueEntry,
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

const ClinicManagement = () => {
  const [activeTab, setActiveTab] = useState("slots");
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [queueFilter, setQueueFilter] = useState<string>("all");
  const [patientSearch, setPatientSearch] = useState("");
  const [editSlotDoctor, setEditSlotDoctor] = useState<DoctorSchedule | null>(null);
  const [schedules, setSchedules] = useState(mockDoctorSchedules);
  const [queue, setQueue] = useState(mockQueue);

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
        <SummaryCard label="In Consultation" value={inConsultCount} icon={<Calendar className="h-4 w-4" />} accent="text-info" />
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
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-foreground">{doc.doctorName}</h3>
                      <p className="text-xs text-muted-foreground">{doc.specialization}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditSlotDoctor(doc)}
                    >
                      <Settings2 className="h-4 w-4 mr-1.5" /> Manage Slots
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {doc.timeSlots.map((slot) => {
                      const full = slot.bookedPatients >= slot.maxPatients;
                      const pct = (slot.bookedPatients / slot.maxPatients) * 100;
                      return (
                        <div
                          key={slot.time}
                          className={cn(
                            "rounded-lg border p-3 text-center transition-all",
                            full
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
                  <TableHead className="text-right">Visits</TableHead>
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
                    <TableCell className="text-right">
                      <Badge variant="outline">{p.totalVisits}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredPatients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No patients found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Manage Slots Dialog */}
      <Dialog open={!!editSlotDoctor} onOpenChange={(v) => !v && setEditSlotDoctor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Manage Slots — {editSlotDoctor?.doctorName}</DialogTitle>
            <p className="text-sm text-muted-foreground">{editSlotDoctor?.specialization} · Max patients per slot</p>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {editSlotDoctor?.timeSlots.map((slot) => (
              <div key={slot.time} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <span className="text-sm font-medium text-foreground">{slot.time}</span>
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
                      disabled={slot.maxPatients <= slot.bookedPatients || slot.maxPatients <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-semibold text-foreground text-sm">{slot.maxPatients}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => updateMaxPatients(editSlotDoctor.id, slot.time, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button onClick={() => { setEditSlotDoctor(null); toast.success("Slot configuration saved"); }} className="w-full mt-2">
            Save Configuration
          </Button>
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
