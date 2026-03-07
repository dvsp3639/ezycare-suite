import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Users, Search, Plus, User, Eye, CheckCircle, XCircle,
  Clock, IndianRupee, Calendar, FileText, ClipboardList, BadgeCheck,
  AlertTriangle, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useStaffMembers, useSalaryRecords, useSalaryAdvances, useAttendance, useLeaveRequests,
  useCreateStaff, useUpdateStaff, useCreateSalaryRecord, useUpdateSalaryRecord,
  useCreateAttendance, useUpdateAttendance, useCreateLeaveRequest, useUpdateLeaveRequest,
  useCreateAdvance, useUpdateAdvance,
} from "@/modules/staff/hooks";
import type { StaffMember, SalaryRecord, AttendanceRecord, LeaveRequest, SalaryAdvance } from "@/modules/staff/types";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { modules } from "@/data/modules";

const STAFF_ROLE_TO_AUTH_ROLE: Record<string, string> = {
  Doctor: "doctor", Nurse: "nurse", Technician: "lab_technician",
  Pharmacist: "pharmacist", Receptionist: "receptionist", Admin: "staff",
  Housekeeping: "staff", Security: "staff", Driver: "staff",
};

const accessibleModules = modules.filter((m) => m.id !== "users-roles");

const staffRoles = ["Doctor", "Nurse", "Technician", "Pharmacist", "Admin", "Receptionist", "Housekeeping", "Security", "Driver"];
const leaveTypes = ["Casual", "Sick", "Earned", "Maternity", "Paternity", "Unpaid"];

const roleColors: Record<string, string> = {
  Doctor: "bg-primary/10 text-primary border-primary/20",
  Nurse: "bg-info/10 text-info border-info/20",
  Technician: "bg-warning/10 text-warning border-warning/20",
  Pharmacist: "bg-success/10 text-success border-success/30",
  Admin: "bg-accent text-accent-foreground border-accent",
  Receptionist: "bg-muted text-muted-foreground border-border",
  Housekeeping: "bg-muted text-muted-foreground border-border",
  Security: "bg-muted text-muted-foreground border-border",
  Driver: "bg-muted text-muted-foreground border-border",
};

const attendanceColors: Record<string, string> = {
  Present: "bg-success/10 text-success border-success/30",
  Absent: "bg-destructive/10 text-destructive border-destructive/30",
  "Half Day": "bg-warning/10 text-warning border-warning/30",
  "On Leave": "bg-info/10 text-info border-info/30",
  Holiday: "bg-muted text-muted-foreground border-border",
};

const leaveStatusColors: Record<string, string> = {
  Pending: "bg-warning/10 text-warning border-warning/30",
  Approved: "bg-success/10 text-success border-success/30",
  Rejected: "bg-destructive/10 text-destructive border-destructive/30",
};

const StaffPayroll = () => {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState("staff");
  const [staffSearch, setStaffSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0]);

  // Dialogs
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showStaffProfile, setShowStaffProfile] = useState(false);
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showMarkAttendance, setShowMarkAttendance] = useState(false);

  // Forms
  const [staffForm, setStaffForm] = useState<Partial<StaffMember>>({});
  const [createLogin, setCreateLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [creatingUser, setCreatingUser] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({ staff_id: "", amount: 0, reason: "", repayment_months: 3 });
  const [leaveForm, setLeaveForm] = useState({ staff_id: "", leave_type: "Casual", from_date: "", to_date: "", reason: "" });

  // Queries
  const { data: staff = [], isLoading: loadingStaff } = useStaffMembers(
    roleFilter !== "all" ? { role: roleFilter } : undefined
  );
  const { data: salaries = [] } = useSalaryRecords();
  const { data: advances = [] } = useSalaryAdvances();
  const { data: attendance = [] } = useAttendance(attendanceDate);
  const { data: leaves = [] } = useLeaveRequests();

  // Mutations
  const createStaff = useCreateStaff();
  const createAttendanceMut = useCreateAttendance();
  const updateAttendanceMut = useUpdateAttendance();
  const createLeaveMut = useCreateLeaveRequest();
  const updateLeaveMut = useUpdateLeaveRequest();
  const updateSalaryMut = useUpdateSalaryRecord();
  const createAdvanceMut = useCreateAdvance();
  const updateAdvanceMut = useUpdateAdvance();

  // Computed
  const filteredStaff = useMemo(() => staff.filter((s) => {
    if (!staffSearch) return true;
    const q = staffSearch.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.employee_id.toLowerCase().includes(q);
  }), [staff, staffSearch]);

  const totalStaff = staff.length;
  const activeStaff = staff.filter((s) => s.status === "Active").length;
  const totalSalaryBill = salaries.reduce((sum, s) => sum + (s.net_salary || 0), 0);
  const pendingLeaves = leaves.filter((l) => l.status === "Pending").length;

  // Handlers
  const handleAddStaff = async () => {
    if (!staffForm.name || !staffForm.employee_id) { toast.error("Name and Employee ID required"); return; }
    if (createLogin && (!loginEmail || !loginPassword)) { toast.error("Email and password required for login"); return; }
    if (createLogin && loginPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (createLogin && selectedModules.length === 0) { toast.error("Select at least one module for access"); return; }

    setCreatingUser(true);
    try {
      await createStaff.mutateAsync({
        employee_id: staffForm.employee_id,
        name: staffForm.name,
        role: staffForm.role || "Admin",
        department: staffForm.department || "",
        designation: staffForm.designation || "",
        employment_type: staffForm.employment_type || "Full-Time",
        joining_date: staffForm.joining_date || null,
        phone: staffForm.phone || "",
        email: staffForm.email || "",
        address: staffForm.address || "",
        emergency_contact: staffForm.emergency_contact || "",
        blood_group: staffForm.blood_group || "",
        qualification: staffForm.qualification || "",
        specialization: staffForm.specialization || "",
        aadhar_no: staffForm.aadhar_no || "",
        pan_no: staffForm.pan_no || "",
        bank_account: staffForm.bank_account || "",
        bank_name: staffForm.bank_name || "",
        ifsc_code: staffForm.ifsc_code || "",
        base_salary: staffForm.base_salary || 0,
        status: "Active",
      });

      // Create login if checked
      if (createLogin) {
        const authRole = STAFF_ROLE_TO_AUTH_ROLE[staffForm.role || "Admin"] || "staff";
        const { data, error } = await supabase.functions.invoke("admin-api/hospital-users", {
          headers: { Authorization: `Bearer ${session?.access_token}` },
          body: {
            email: loginEmail,
            password: loginPassword,
            full_name: staffForm.name,
            phone: staffForm.phone || "",
            role: authRole,
            module_permissions: selectedModules,
          },
        });
        if (error) throw new Error(error.message || "Failed to create login");
        if (data?.error) throw new Error(data.error);
        toast.success(`${staffForm.name} added with login access`);
      } else {
        toast.success(`${staffForm.name} added`);
      }

      setShowAddStaff(false);
      setStaffForm({});
      setCreateLogin(false);
      setLoginEmail("");
      setLoginPassword("");
      setSelectedModules([]);
    } catch (err: any) {
      toast.error(err.message || "Failed to add staff");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleRequestAdvance = async () => {
    if (!advanceForm.staff_id || advanceForm.amount <= 0) { toast.error("Select staff and enter amount"); return; }
    const s = staff.find((x) => x.id === advanceForm.staff_id);
    try {
      await createAdvanceMut.mutateAsync({
        staff_id: advanceForm.staff_id,
        staff_name: s?.name || "",
        amount: advanceForm.amount,
        reason: advanceForm.reason,
        repayment_months: advanceForm.repayment_months,
        monthly_deduction: Math.ceil(advanceForm.amount / advanceForm.repayment_months),
        status: "Pending",
      });
      toast.success("Advance request submitted");
      setShowAdvanceDialog(false);
      setAdvanceForm({ staff_id: "", amount: 0, reason: "", repayment_months: 3 });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleApproveAdvance = async (id: string) => {
    await updateAdvanceMut.mutateAsync({ id, updates: { status: "Approved", approved_by: "Admin" } });
    toast.success("Advance approved");
  };

  const handleRejectAdvance = async (id: string) => {
    await updateAdvanceMut.mutateAsync({ id, updates: { status: "Rejected" } });
    toast.info("Advance rejected");
  };

  const handleApplyLeave = async () => {
    if (!leaveForm.staff_id || !leaveForm.from_date || !leaveForm.to_date) { toast.error("Fill all fields"); return; }
    const s = staff.find((x) => x.id === leaveForm.staff_id);
    const from = new Date(leaveForm.from_date);
    const to = new Date(leaveForm.to_date);
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    try {
      await createLeaveMut.mutateAsync({
        staff_id: leaveForm.staff_id,
        staff_name: s?.name || "",
        leave_type: leaveForm.leave_type as any,
        from_date: leaveForm.from_date,
        to_date: leaveForm.to_date,
        days,
        reason: leaveForm.reason,
        status: "Pending",
      });
      toast.success("Leave request submitted");
      setShowLeaveDialog(false);
      setLeaveForm({ staff_id: "", leave_type: "Casual", from_date: "", to_date: "", reason: "" });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleApproveLeave = async (id: string) => {
    await updateLeaveMut.mutateAsync({ id, updates: { status: "Approved", approved_by: "Admin" } });
    toast.success("Leave approved");
  };

  const handleRejectLeave = async (id: string) => {
    await updateLeaveMut.mutateAsync({ id, updates: { status: "Rejected" } });
    toast.info("Leave rejected");
  };

  const handleProcessSalary = async (id: string) => {
    await updateSalaryMut.mutateAsync({ id, updates: { status: "Processed" } });
    toast.success("Salary processed");
  };

  const handlePaySalary = async (id: string) => {
    await updateSalaryMut.mutateAsync({ id, updates: { status: "Paid", paid_date: new Date().toISOString().split("T")[0] } });
    toast.success("Salary marked as paid");
  };

  const handleMarkPresent = async (s: StaffMember) => {
    const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    await createAttendanceMut.mutateAsync({
      staff_id: s.id, staff_name: s.name, attendance_date: attendanceDate, check_in: now, status: "Present",
    });
    toast.success(`${s.name} checked in at ${now}`);
  };

  const handleMarkHalfDay = async (s: StaffMember) => {
    const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    await createAttendanceMut.mutateAsync({
      staff_id: s.id, staff_name: s.name, attendance_date: attendanceDate, check_in: now, status: "Half Day", hours_worked: 4,
    });
    toast.success(`${s.name} marked as half day`);
  };

  const handleMarkAbsent = async (s: StaffMember) => {
    await createAttendanceMut.mutateAsync({
      staff_id: s.id, staff_name: s.name, attendance_date: attendanceDate, status: "Absent",
    });
    toast.info(`${s.name} marked absent`);
  };

  const handleClockOut = async (a: AttendanceRecord) => {
    const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const hoursWorked = a.check_in
      ? Math.round((Date.now() - new Date(`${a.attendance_date} ${a.check_in}`).getTime()) / (1000 * 60 * 60) * 10) / 10
      : null;
    await updateAttendanceMut.mutateAsync({ id: a.id, updates: { check_out: now, hours_worked: hoursWorked } });
    toast.success(`${a.staff_name} checked out at ${now}`);
  };

  if (loadingStaff) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Staff Attendance & Payroll
          </h1>
          <p className="text-sm text-muted-foreground">Staff profiles, attendance, leaves & salary management</p>
        </div>
        <Button size="sm" onClick={() => { setShowAddStaff(true); setStaffForm({ role: "Nurse", employment_type: "Full-Time" }); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Staff
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SCard label="Total Staff" value={totalStaff} icon={<Users className="h-4 w-4" />} accent="text-primary" />
        <SCard label="Active" value={activeStaff} icon={<BadgeCheck className="h-4 w-4" />} accent="text-success" />
        <SCard label="Salary Bill" value={`₹${(totalSalaryBill / 1000).toFixed(0)}K`} icon={<IndianRupee className="h-4 w-4" />} accent="text-info" />
        <SCard label="Pending Leaves" value={pendingLeaves} icon={<AlertTriangle className="h-4 w-4" />} accent="text-warning" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="staff"><User className="h-4 w-4 mr-1" /> Staff</TabsTrigger>
          <TabsTrigger value="attendance"><Calendar className="h-4 w-4 mr-1" /> Attendance</TabsTrigger>
          <TabsTrigger value="leaves"><ClipboardList className="h-4 w-4 mr-1" /> Leaves</TabsTrigger>
          <TabsTrigger value="salary"><IndianRupee className="h-4 w-4 mr-1" /> Salary</TabsTrigger>
          <TabsTrigger value="advances"><FileText className="h-4 w-4 mr-1" /> Advances</TabsTrigger>
        </TabsList>

        {/* ════════ STAFF TAB ════════ */}
        <TabsContent value="staff">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)} placeholder="Search name or ID..." className="pl-9 h-9" />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {staffRoles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Employee</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Salary</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.map((s) => (
                  <TableRow key={s.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.employee_id}</TableCell>
                    <TableCell><Badge variant="outline" className={cn("text-xs", roleColors[s.role] || "")}>{s.role}</Badge></TableCell>
                    <TableCell className="text-sm">{s.department}</TableCell>
                    <TableCell className="text-xs">{s.phone}</TableCell>
                    <TableCell className="text-xs">{s.employment_type}</TableCell>
                    <TableCell className="text-sm font-medium">₹{(s.base_salary || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedStaff(s); setShowStaffProfile(true); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredStaff.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No staff members found. Click "Add Staff" to create one.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ════════ ATTENDANCE TAB ════════ */}
        <TabsContent value="attendance">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} className="w-[170px] h-9" />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground ml-2">
              <span className="text-success font-semibold">{attendance.filter((a) => a.status === "Present").length} Present</span>
              <span className="text-destructive font-semibold">{attendance.filter((a) => a.status === "Absent").length} Absent</span>
              <span className="text-info font-semibold">{attendance.filter((a) => a.status === "On Leave").length} On Leave</span>
              <span className="text-warning font-semibold">{attendance.filter((a) => a.status === "Half Day").length} Half Day</span>
            </div>
            <Button size="sm" className="ml-auto" onClick={() => setShowMarkAttendance(true)}>
              <Plus className="h-4 w-4 mr-1" /> Mark Attendance
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mb-3">
            💡 <strong>How attendance works:</strong> Click "Mark Attendance" to record check-in. When staff leave, click clock-out. Hours are auto-calculated.
          </p>

          {(() => {
            const unmarkedStaff = staff.filter((s) => s.status === "Active" && !attendance.find((r) => r.staff_id === s.id));
            return (
              <div className="space-y-4">
                {unmarkedStaff.length > 0 && (
                  <div className="rounded-lg bg-warning/5 border border-warning/20 p-3">
                    <p className="text-xs font-semibold text-warning mb-2 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {unmarkedStaff.length} staff not yet marked for {attendanceDate}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {unmarkedStaff.map((s) => (
                        <Badge key={s.id} variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">{s.name}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Staff</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Check Out</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendance.map((a) => {
                        const staffMember = staff.find((s) => s.id === a.staff_id);
                        return (
                          <TableRow key={a.id}>
                            <TableCell className="font-medium">{a.staff_name}</TableCell>
                            <TableCell><Badge variant="outline" className={cn("text-[10px]", staffMember ? roleColors[staffMember.role] || "" : "")}>{staffMember?.role}</Badge></TableCell>
                            <TableCell className="text-sm font-medium text-success">{a.check_in || "—"}</TableCell>
                            <TableCell className="text-sm font-medium text-destructive">{a.check_out || "—"}</TableCell>
                            <TableCell className="text-sm">{a.hours_worked ? <span className="font-semibold">{a.hours_worked}h</span> : "—"}</TableCell>
                            <TableCell><Badge variant="outline" className={cn("text-xs", attendanceColors[a.status] || "")}>{a.status}</Badge></TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{a.notes || "—"}</TableCell>
                            <TableCell className="text-right">
                              {a.check_in && !a.check_out && a.status === "Present" && (
                                <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => handleClockOut(a)}>
                                  <Clock className="h-3 w-3 mr-1" /> Clock Out
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {attendance.length === 0 && (
                        <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No attendance records for this date.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })()}
        </TabsContent>

        {/* ════════ LEAVES TAB ════════ */}
        <TabsContent value="leaves">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{leaves.length} leave requests</p>
            <Button size="sm" onClick={() => setShowLeaveDialog(true)}><Plus className="h-4 w-4 mr-1" /> Apply Leave</Button>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Staff</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.staff_name}</TableCell>
                    <TableCell className="text-sm">{l.leave_type}</TableCell>
                    <TableCell className="text-xs">{l.from_date}</TableCell>
                    <TableCell className="text-xs">{l.to_date}</TableCell>
                    <TableCell className="text-sm">{l.days}</TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">{l.reason}</TableCell>
                    <TableCell><Badge variant="outline" className={cn("text-xs", leaveStatusColors[l.status || ""] || "")}>{l.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {l.status === "Pending" && (
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => handleApproveLeave(l.id)}><CheckCircle className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRejectLeave(l.id)}><XCircle className="h-3.5 w-3.5" /></Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ════════ SALARY TAB ════════ */}
        <TabsContent value="salary">
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Staff</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>Allowances</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaries.map((s) => {
                  const allowances = (s.hra || 0) + (s.da || 0) + (s.special_allowance || 0) + (s.overtime || 0);
                  const deductions = (s.deductions || 0) + (s.pf || 0) + (s.esi || 0) + (s.tax || 0) + (s.advance || 0);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.staff_name}</TableCell>
                      <TableCell className="text-sm">{s.month}</TableCell>
                      <TableCell className="text-sm">₹{(s.base_salary || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-success">+₹{allowances.toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-destructive">-₹{deductions.toLocaleString()}</TableCell>
                      <TableCell className="text-sm font-bold">₹{(s.net_salary || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs",
                          s.status === "Paid" ? "bg-success/10 text-success" : s.status === "Processed" ? "bg-info/10 text-info" : "bg-warning/10 text-warning"
                        )}>{s.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {s.status === "Pending" && <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleProcessSalary(s.id)}>Process</Button>}
                        {s.status === "Processed" && <Button variant="ghost" size="sm" className="text-xs" onClick={() => handlePaySalary(s.id)}>Pay</Button>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ════════ ADVANCES TAB ════════ */}
        <TabsContent value="advances">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{advances.length} advance requests</p>
            <Button size="sm" onClick={() => setShowAdvanceDialog(true)}><Plus className="h-4 w-4 mr-1" /> Request Advance</Button>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Staff</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Repayment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advances.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.staff_name}</TableCell>
                    <TableCell className="text-sm font-bold">₹{a.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{a.request_date}</TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">{a.reason}</TableCell>
                    <TableCell className="text-xs">{a.repayment_months ? `${a.repayment_months} months (₹${a.monthly_deduction}/mo)` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs",
                        a.status === "Approved" ? "bg-success/10 text-success" : a.status === "Pending" ? "bg-warning/10 text-warning" : a.status === "Repaid" ? "bg-info/10 text-info" : "bg-destructive/10 text-destructive"
                      )}>{a.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {a.status === "Pending" && (
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => handleApproveAdvance(a.id)}><CheckCircle className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRejectAdvance(a.id)}><XCircle className="h-3.5 w-3.5" /></Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══════════ DIALOGS ═══════════ */}

      {/* Add Staff Dialog */}
      <Dialog open={showAddStaff} onOpenChange={setShowAddStaff}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name</Label><Input value={staffForm.name || ""} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} /></div>
              <div><Label>Employee ID</Label><Input value={staffForm.employee_id || ""} onChange={(e) => setStaffForm({ ...staffForm, employee_id: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Role</Label>
                <Select value={staffForm.role || "Nurse"} onValueChange={(v) => setStaffForm({ ...staffForm, role: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{staffRoles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Department</Label><Input value={staffForm.department || ""} onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Designation</Label><Input value={staffForm.designation || ""} onChange={(e) => setStaffForm({ ...staffForm, designation: e.target.value })} /></div>
              <div><Label>Employment Type</Label>
                <Select value={staffForm.employment_type || "Full-Time"} onValueChange={(v) => setStaffForm({ ...staffForm, employment_type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Full-Time">Full-Time</SelectItem><SelectItem value="Part-Time">Part-Time</SelectItem><SelectItem value="Contract">Contract</SelectItem><SelectItem value="Visiting">Visiting</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={staffForm.phone || ""} onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={staffForm.email || ""} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} /></div>
            </div>
            <div><Label>Address</Label><Input value={staffForm.address || ""} onChange={(e) => setStaffForm({ ...staffForm, address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Qualification</Label><Input value={staffForm.qualification || ""} onChange={(e) => setStaffForm({ ...staffForm, qualification: e.target.value })} /></div>
              <div><Label>Specialization</Label><Input value={staffForm.specialization || ""} onChange={(e) => setStaffForm({ ...staffForm, specialization: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Blood Group</Label><Input value={staffForm.blood_group || ""} onChange={(e) => setStaffForm({ ...staffForm, blood_group: e.target.value })} /></div>
              <div><Label>Aadhar No</Label><Input value={staffForm.aadhar_no || ""} onChange={(e) => setStaffForm({ ...staffForm, aadhar_no: e.target.value })} /></div>
              <div><Label>PAN No</Label><Input value={staffForm.pan_no || ""} onChange={(e) => setStaffForm({ ...staffForm, pan_no: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Bank Account</Label><Input value={staffForm.bank_account || ""} onChange={(e) => setStaffForm({ ...staffForm, bank_account: e.target.value })} /></div>
              <div><Label>Bank Name</Label><Input value={staffForm.bank_name || ""} onChange={(e) => setStaffForm({ ...staffForm, bank_name: e.target.value })} /></div>
              <div><Label>IFSC Code</Label><Input value={staffForm.ifsc_code || ""} onChange={(e) => setStaffForm({ ...staffForm, ifsc_code: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Emergency Contact</Label><Input value={staffForm.emergency_contact || ""} onChange={(e) => setStaffForm({ ...staffForm, emergency_contact: e.target.value })} /></div>
              <div><Label>Base Salary (₹)</Label><Input type="number" value={staffForm.base_salary || 0} onChange={(e) => setStaffForm({ ...staffForm, base_salary: +e.target.value })} /></div>
            </div>
            <div><Label>Joining Date</Label><Input type="date" value={staffForm.joining_date || ""} onChange={(e) => setStaffForm({ ...staffForm, joining_date: e.target.value })} /></div>

            {/* Login Creation Section */}
            <div className="border-t border-border pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Checkbox
                  id="createLogin"
                  checked={createLogin}
                  onCheckedChange={(checked) => {
                    setCreateLogin(!!checked);
                    if (!checked) { setLoginEmail(""); setLoginPassword(""); setSelectedModules([]); }
                  }}
                />
                <Label htmlFor="createLogin" className="text-sm font-semibold cursor-pointer">Create Login Access</Label>
              </div>

              {createLogin && (
                <div className="space-y-3 pl-6 border-l-2 border-primary/20">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Login Email</Label><Input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="user@hospital.com" /></div>
                    <div><Label>Password</Label><Input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Min 6 characters" /></div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Module Access</Label>
                    <p className="text-xs text-muted-foreground mb-2">Select which modules this user can access</p>
                    <div className="grid grid-cols-2 gap-2">
                      {accessibleModules.map((mod) => (
                        <div key={mod.id} className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-muted/30 transition-colors">
                          <Checkbox
                            id={`mod-${mod.id}`}
                            checked={selectedModules.includes(mod.id)}
                            onCheckedChange={(checked) => {
                              setSelectedModules((prev) =>
                                checked ? [...prev, mod.id] : prev.filter((m) => m !== mod.id)
                              );
                            }}
                          />
                          <Label htmlFor={`mod-${mod.id}`} className="text-xs cursor-pointer flex items-center gap-1.5">
                            <mod.icon className="h-3.5 w-3.5 text-muted-foreground" />
                            {mod.title}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => setSelectedModules(accessibleModules.map((m) => m.id))}>Select All</Button>
                      <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => setSelectedModules([])}>Clear All</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddStaff} disabled={createStaff.isPending || creatingUser}>
            {(createStaff.isPending || creatingUser) && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Add Staff
          </Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Profile Dialog */}
      <Dialog open={showStaffProfile} onOpenChange={setShowStaffProfile}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Staff Profile — {selectedStaff?.name}</DialogTitle></DialogHeader>
          {selectedStaff && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                  {selectedStaff.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{selectedStaff.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedStaff.designation} • {selectedStaff.department}</p>
                  <Badge variant="outline" className={cn("text-xs", roleColors[selectedStaff.role] || "")}>{selectedStaff.role}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Detail label="Employee ID" value={selectedStaff.employee_id} />
                <Detail label="Employment" value={selectedStaff.employment_type || ""} />
                <Detail label="Phone" value={selectedStaff.phone || ""} />
                <Detail label="Email" value={selectedStaff.email || ""} />
                <Detail label="Joining Date" value={selectedStaff.joining_date || "—"} />
                <Detail label="Blood Group" value={selectedStaff.blood_group || "—"} />
                <Detail label="Qualification" value={selectedStaff.qualification || "—"} />
                <Detail label="Specialization" value={selectedStaff.specialization || "—"} />
                <Detail label="Aadhar" value={selectedStaff.aadhar_no || "—"} />
                <Detail label="PAN" value={selectedStaff.pan_no || "—"} />
                <Detail label="Bank" value={`${selectedStaff.bank_name || ""} (${selectedStaff.ifsc_code || ""})`} />
                <Detail label="Account" value={selectedStaff.bank_account || "—"} />
                <Detail label="Base Salary" value={`₹${(selectedStaff.base_salary || 0).toLocaleString()}`} />
                <Detail label="Emergency Contact" value={selectedStaff.emergency_contact || "—"} />
              </div>
              <div><Detail label="Address" value={selectedStaff.address || "—"} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setShowStaffProfile(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advance Dialog */}
      <Dialog open={showAdvanceDialog} onOpenChange={setShowAdvanceDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Salary Advance</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Staff</Label>
              <Select value={advanceForm.staff_id} onValueChange={(v) => setAdvanceForm({ ...advanceForm, staff_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.employee_id})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Amount (₹)</Label><Input type="number" value={advanceForm.amount} onChange={(e) => setAdvanceForm({ ...advanceForm, amount: +e.target.value })} /></div>
            <div><Label>Repayment Months</Label><Input type="number" value={advanceForm.repayment_months} onChange={(e) => setAdvanceForm({ ...advanceForm, repayment_months: +e.target.value })} /></div>
            <div><Label>Reason</Label><Textarea value={advanceForm.reason} onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })} rows={2} /></div>
            {advanceForm.amount > 0 && advanceForm.repayment_months > 0 && (
              <p className="text-sm text-muted-foreground">Monthly deduction: ₹{Math.ceil(advanceForm.amount / advanceForm.repayment_months)}</p>
            )}
          </div>
          <DialogFooter><Button onClick={handleRequestAdvance} disabled={createAdvanceMut.isPending}>Submit Request</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apply Leave</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Staff</Label>
              <Select value={leaveForm.staff_id} onValueChange={(v) => setLeaveForm({ ...leaveForm, staff_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.employee_id})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Leave Type</Label>
              <Select value={leaveForm.leave_type} onValueChange={(v) => setLeaveForm({ ...leaveForm, leave_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{leaveTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>From</Label><Input type="date" value={leaveForm.from_date} onChange={(e) => setLeaveForm({ ...leaveForm, from_date: e.target.value })} /></div>
              <div><Label>To</Label><Input type="date" value={leaveForm.to_date} onChange={(e) => setLeaveForm({ ...leaveForm, to_date: e.target.value })} /></div>
            </div>
            <div><Label>Reason</Label><Textarea value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={handleApplyLeave} disabled={createLeaveMut.isPending}>Submit</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Attendance Dialog */}
      <Dialog open={showMarkAttendance} onOpenChange={setShowMarkAttendance}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /> Mark Daily Attendance — {attendanceDate}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">Select staff members and mark their attendance.</p>
          <div className="space-y-2 mt-2">
            {staff.filter((s) => s.status === "Active" && !attendance.find((a) => a.staff_id === s.id)).map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    {s.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground">{s.role} • {s.department}</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="text-xs h-7 text-success border-success/30 hover:bg-success/10" onClick={() => handleMarkPresent(s)}>
                    <CheckCircle className="h-3 w-3 mr-1" /> Present
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-7 text-warning border-warning/30 hover:bg-warning/10" onClick={() => handleMarkHalfDay(s)}>
                    Half Day
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-7 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleMarkAbsent(s)}>
                    <XCircle className="h-3 w-3 mr-1" /> Absent
                  </Button>
                </div>
              </div>
            ))}
            {staff.filter((s) => s.status === "Active" && !attendance.find((a) => a.staff_id === s.id)).length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-success" />
                <p>All staff attendance has been marked for {attendanceDate}!</p>
              </div>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowMarkAttendance(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SCard = ({ label, value, icon, accent }: { label: string; value: string | number; icon: React.ReactNode; accent: string }) => (
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

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    <p className="text-sm text-foreground">{value}</p>
  </div>
);

export default StaffPayroll;
