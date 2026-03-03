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
  Users, Search, Plus, User, Phone, Edit, Eye, Trash2, CheckCircle, XCircle,
  Clock, IndianRupee, Calendar, FileText, ClipboardList, BadgeCheck,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  mockStaff, mockSalaryRecords, mockAdvances, mockAttendance, mockLeaveRequests,
  staffRoles, leaveTypes, roleColors,
  type StaffMember, type StaffRole, type SalaryRecord, type SalaryAdvance,
  type AttendanceRecord, type AttendanceStatus, type LeaveRequest, type LeaveStatus,
} from "@/data/mockStaffData";

const attendanceColors: Record<AttendanceStatus, string> = {
  Present: "bg-success/10 text-success border-success/30",
  Absent: "bg-destructive/10 text-destructive border-destructive/30",
  "Half Day": "bg-warning/10 text-warning border-warning/30",
  "On Leave": "bg-info/10 text-info border-info/30",
  Holiday: "bg-muted text-muted-foreground border-border",
};

const leaveStatusColors: Record<LeaveStatus, string> = {
  Pending: "bg-warning/10 text-warning border-warning/30",
  Approved: "bg-success/10 text-success border-success/30",
  Rejected: "bg-destructive/10 text-destructive border-destructive/30",
};

const StaffPayroll = () => {
  const [activeTab, setActiveTab] = useState("staff");
  const [staff, setStaff] = useState<StaffMember[]>(mockStaff);
  const [salaries, setSalaries] = useState<SalaryRecord[]>(mockSalaryRecords);
  const [advances, setAdvances] = useState<SalaryAdvance[]>(mockAdvances);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(mockAttendance);
  const [leaves, setLeaves] = useState<LeaveRequest[]>(mockLeaveRequests);

  // Filters
  const [staffSearch, setStaffSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  // Dialogs
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showStaffProfile, setShowStaffProfile] = useState(false);
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Forms
  const [staffForm, setStaffForm] = useState<Partial<StaffMember>>({});
  const [advanceForm, setAdvanceForm] = useState({ staffId: "", amount: 0, reason: "", repaymentMonths: 3 });
  const [leaveForm, setLeaveForm] = useState({ staffId: "", leaveType: "Casual" as string, fromDate: "", toDate: "", reason: "" });

  // Computed
  const filteredStaff = useMemo(() => staff.filter((s) => {
    const matchSearch = !staffSearch || s.name.toLowerCase().includes(staffSearch.toLowerCase()) || s.employeeId.toLowerCase().includes(staffSearch.toLowerCase());
    const matchRole = roleFilter === "all" || s.role === roleFilter;
    return matchSearch && matchRole;
  }), [staff, staffSearch, roleFilter]);

  const totalStaff = staff.length;
  const activeStaff = staff.filter((s) => s.status === "Active").length;
  const totalSalaryBill = salaries.filter((s) => s.month === "2026-03").reduce((sum, s) => sum + s.netSalary, 0);
  const pendingLeaves = leaves.filter((l) => l.status === "Pending").length;

  // Handlers
  const handleAddStaff = () => {
    if (!staffForm.name || !staffForm.employeeId) { toast.error("Name and Employee ID required"); return; }
    const newStaff: StaffMember = {
      id: `s-${Date.now()}`, employeeId: staffForm.employeeId || "", name: staffForm.name || "",
      role: (staffForm.role as StaffRole) || "Admin", department: staffForm.department || "",
      designation: staffForm.designation || "", employmentType: staffForm.employmentType || "Full-Time",
      joiningDate: staffForm.joiningDate || new Date().toISOString().split("T")[0],
      phone: staffForm.phone || "", email: staffForm.email || "", address: staffForm.address || "",
      emergencyContact: staffForm.emergencyContact || "", bloodGroup: staffForm.bloodGroup || "",
      qualification: staffForm.qualification || "", specialization: staffForm.specialization,
      aadharNo: staffForm.aadharNo || "", panNo: staffForm.panNo || "",
      bankAccount: staffForm.bankAccount || "", bankName: staffForm.bankName || "", ifscCode: staffForm.ifscCode || "",
      baseSalary: staffForm.baseSalary || 0, status: "Active",
    };
    setStaff((prev) => [...prev, newStaff]);
    toast.success(`${newStaff.name} added`);
    setShowAddStaff(false);
    setStaffForm({});
  };

  const handleRequestAdvance = () => {
    if (!advanceForm.staffId || advanceForm.amount <= 0) { toast.error("Select staff and enter amount"); return; }
    const s = staff.find((x) => x.id === advanceForm.staffId);
    const adv: SalaryAdvance = {
      id: `adv-${Date.now()}`, staffId: advanceForm.staffId, staffName: s?.name || "",
      amount: advanceForm.amount, requestDate: new Date().toISOString().split("T")[0],
      reason: advanceForm.reason, status: "Pending", repaymentMonths: advanceForm.repaymentMonths,
      monthlyDeduction: Math.ceil(advanceForm.amount / advanceForm.repaymentMonths),
    };
    setAdvances((prev) => [adv, ...prev]);
    toast.success("Advance request submitted");
    setShowAdvanceDialog(false);
    setAdvanceForm({ staffId: "", amount: 0, reason: "", repaymentMonths: 3 });
  };

  const handleApproveAdvance = (id: string) => {
    setAdvances((prev) => prev.map((a) => a.id === id ? { ...a, status: "Approved" as const, approvedBy: "Admin" } : a));
    toast.success("Advance approved");
  };

  const handleRejectAdvance = (id: string) => {
    setAdvances((prev) => prev.map((a) => a.id === id ? { ...a, status: "Rejected" as const } : a));
    toast.info("Advance rejected");
  };

  const handleApplyLeave = () => {
    if (!leaveForm.staffId || !leaveForm.fromDate || !leaveForm.toDate) { toast.error("Fill all fields"); return; }
    const s = staff.find((x) => x.id === leaveForm.staffId);
    const from = new Date(leaveForm.fromDate);
    const to = new Date(leaveForm.toDate);
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const lv: LeaveRequest = {
      id: `lv-${Date.now()}`, staffId: leaveForm.staffId, staffName: s?.name || "",
      leaveType: leaveForm.leaveType as any, fromDate: leaveForm.fromDate, toDate: leaveForm.toDate,
      days, reason: leaveForm.reason, status: "Pending", appliedDate: new Date().toISOString().split("T")[0],
    };
    setLeaves((prev) => [lv, ...prev]);
    toast.success("Leave request submitted");
    setShowLeaveDialog(false);
    setLeaveForm({ staffId: "", leaveType: "Casual", fromDate: "", toDate: "", reason: "" });
  };

  const handleApproveLeave = (id: string) => {
    setLeaves((prev) => prev.map((l) => l.id === id ? { ...l, status: "Approved" as const, approvedBy: "Admin" } : l));
    toast.success("Leave approved");
  };

  const handleRejectLeave = (id: string) => {
    setLeaves((prev) => prev.map((l) => l.id === id ? { ...l, status: "Rejected" as const } : l));
    toast.info("Leave rejected");
  };

  const handleProcessSalary = (id: string) => {
    setSalaries((prev) => prev.map((s) => s.id === id ? { ...s, status: "Processed" as const } : s));
    toast.success("Salary processed");
  };

  const handlePaySalary = (id: string) => {
    setSalaries((prev) => prev.map((s) => s.id === id ? { ...s, status: "Paid" as const, paidDate: new Date().toISOString().split("T")[0] } : s));
    toast.success("Salary marked as paid");
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Staff Attendance & Payroll
          </h1>
          <p className="text-sm text-muted-foreground">Staff profiles, attendance, leaves & salary management</p>
        </div>
        <Button size="sm" onClick={() => { setShowAddStaff(true); setStaffForm({ role: "Nurse", employmentType: "Full-Time" }); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Staff
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SCard label="Total Staff" value={totalStaff} icon={<Users className="h-4 w-4" />} accent="text-primary" />
        <SCard label="Active" value={activeStaff} icon={<BadgeCheck className="h-4 w-4" />} accent="text-success" />
        <SCard label="Salary Bill (Mar)" value={`₹${(totalSalaryBill / 1000).toFixed(0)}K`} icon={<IndianRupee className="h-4 w-4" />} accent="text-info" />
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
                    <TableCell className="text-xs text-muted-foreground">{s.employeeId}</TableCell>
                    <TableCell><Badge variant="outline" className={cn("text-xs", roleColors[s.role])}>{s.role}</Badge></TableCell>
                    <TableCell className="text-sm">{s.department}</TableCell>
                    <TableCell className="text-xs">{s.phone}</TableCell>
                    <TableCell className="text-xs">{s.employmentType}</TableCell>
                    <TableCell className="text-sm font-medium">₹{s.baseSalary.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedStaff(s); setShowStaffProfile(true); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ════════ ATTENDANCE TAB ════════ */}
        <TabsContent value="attendance">
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Staff</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.staffName}</TableCell>
                    <TableCell className="text-sm">{a.date}</TableCell>
                    <TableCell className="text-sm">{a.checkIn || "—"}</TableCell>
                    <TableCell className="text-sm">{a.checkOut || "—"}</TableCell>
                    <TableCell className="text-sm">{a.hoursWorked ? `${a.hoursWorked}h` : "—"}</TableCell>
                    <TableCell><Badge variant="outline" className={cn("text-xs", attendanceColors[a.status])}>{a.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
                    <TableCell className="font-medium">{l.staffName}</TableCell>
                    <TableCell className="text-sm">{l.leaveType}</TableCell>
                    <TableCell className="text-xs">{l.fromDate}</TableCell>
                    <TableCell className="text-xs">{l.toDate}</TableCell>
                    <TableCell className="text-sm">{l.days}</TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">{l.reason}</TableCell>
                    <TableCell><Badge variant="outline" className={cn("text-xs", leaveStatusColors[l.status])}>{l.status}</Badge></TableCell>
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
                  const allowances = s.hra + s.da + s.specialAllowance + s.overtime;
                  const deductions = s.deductions + s.pf + s.esi + s.tax + s.advance;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.staffName}</TableCell>
                      <TableCell className="text-sm">{s.month}</TableCell>
                      <TableCell className="text-sm">₹{s.baseSalary.toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-success">+₹{allowances.toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-destructive">-₹{deductions.toLocaleString()}</TableCell>
                      <TableCell className="text-sm font-bold">₹{s.netSalary.toLocaleString()}</TableCell>
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
                    <TableCell className="font-medium">{a.staffName}</TableCell>
                    <TableCell className="text-sm font-bold">₹{a.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{a.requestDate}</TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">{a.reason}</TableCell>
                    <TableCell className="text-xs">{a.repaymentMonths ? `${a.repaymentMonths} months (₹${a.monthlyDeduction}/mo)` : "—"}</TableCell>
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
              <div><Label>Employee ID</Label><Input value={staffForm.employeeId || ""} onChange={(e) => setStaffForm({ ...staffForm, employeeId: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Role</Label>
                <Select value={staffForm.role || "Nurse"} onValueChange={(v) => setStaffForm({ ...staffForm, role: v as StaffRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{staffRoles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Department</Label><Input value={staffForm.department || ""} onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Designation</Label><Input value={staffForm.designation || ""} onChange={(e) => setStaffForm({ ...staffForm, designation: e.target.value })} /></div>
              <div><Label>Employment Type</Label>
                <Select value={staffForm.employmentType || "Full-Time"} onValueChange={(v) => setStaffForm({ ...staffForm, employmentType: v as any })}>
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
              <div><Label>Blood Group</Label><Input value={staffForm.bloodGroup || ""} onChange={(e) => setStaffForm({ ...staffForm, bloodGroup: e.target.value })} /></div>
              <div><Label>Aadhar No</Label><Input value={staffForm.aadharNo || ""} onChange={(e) => setStaffForm({ ...staffForm, aadharNo: e.target.value })} /></div>
              <div><Label>PAN No</Label><Input value={staffForm.panNo || ""} onChange={(e) => setStaffForm({ ...staffForm, panNo: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Bank Account</Label><Input value={staffForm.bankAccount || ""} onChange={(e) => setStaffForm({ ...staffForm, bankAccount: e.target.value })} /></div>
              <div><Label>Bank Name</Label><Input value={staffForm.bankName || ""} onChange={(e) => setStaffForm({ ...staffForm, bankName: e.target.value })} /></div>
              <div><Label>IFSC Code</Label><Input value={staffForm.ifscCode || ""} onChange={(e) => setStaffForm({ ...staffForm, ifscCode: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Emergency Contact</Label><Input value={staffForm.emergencyContact || ""} onChange={(e) => setStaffForm({ ...staffForm, emergencyContact: e.target.value })} /></div>
              <div><Label>Base Salary (₹)</Label><Input type="number" value={staffForm.baseSalary || 0} onChange={(e) => setStaffForm({ ...staffForm, baseSalary: +e.target.value })} /></div>
            </div>
            <div><Label>Joining Date</Label><Input type="date" value={staffForm.joiningDate || ""} onChange={(e) => setStaffForm({ ...staffForm, joiningDate: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleAddStaff}>Add Staff</Button></DialogFooter>
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
                  <Badge variant="outline" className={cn("text-xs", roleColors[selectedStaff.role])}>{selectedStaff.role}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Detail label="Employee ID" value={selectedStaff.employeeId} />
                <Detail label="Employment" value={selectedStaff.employmentType} />
                <Detail label="Phone" value={selectedStaff.phone} />
                <Detail label="Email" value={selectedStaff.email} />
                <Detail label="Joining Date" value={selectedStaff.joiningDate} />
                <Detail label="Blood Group" value={selectedStaff.bloodGroup} />
                <Detail label="Qualification" value={selectedStaff.qualification} />
                <Detail label="Specialization" value={selectedStaff.specialization || "—"} />
                <Detail label="Aadhar" value={selectedStaff.aadharNo} />
                <Detail label="PAN" value={selectedStaff.panNo} />
                <Detail label="Bank" value={`${selectedStaff.bankName} (${selectedStaff.ifscCode})`} />
                <Detail label="Account" value={selectedStaff.bankAccount} />
                <Detail label="Base Salary" value={`₹${selectedStaff.baseSalary.toLocaleString()}`} />
                <Detail label="Emergency Contact" value={selectedStaff.emergencyContact} />
              </div>
              <div><Detail label="Address" value={selectedStaff.address} /></div>
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
              <Select value={advanceForm.staffId} onValueChange={(v) => setAdvanceForm({ ...advanceForm, staffId: v })}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.employeeId})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Amount (₹)</Label><Input type="number" value={advanceForm.amount} onChange={(e) => setAdvanceForm({ ...advanceForm, amount: +e.target.value })} /></div>
            <div><Label>Repayment Months</Label><Input type="number" value={advanceForm.repaymentMonths} onChange={(e) => setAdvanceForm({ ...advanceForm, repaymentMonths: +e.target.value })} /></div>
            <div><Label>Reason</Label><Textarea value={advanceForm.reason} onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })} rows={2} /></div>
            {advanceForm.amount > 0 && advanceForm.repaymentMonths > 0 && (
              <p className="text-sm text-muted-foreground">Monthly deduction: ₹{Math.ceil(advanceForm.amount / advanceForm.repaymentMonths)}</p>
            )}
          </div>
          <DialogFooter><Button onClick={handleRequestAdvance}>Submit Request</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apply Leave</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Staff</Label>
              <Select value={leaveForm.staffId} onValueChange={(v) => setLeaveForm({ ...leaveForm, staffId: v })}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.employeeId})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Leave Type</Label>
              <Select value={leaveForm.leaveType} onValueChange={(v) => setLeaveForm({ ...leaveForm, leaveType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{leaveTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>From</Label><Input type="date" value={leaveForm.fromDate} onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value })} /></div>
              <div><Label>To</Label><Input type="date" value={leaveForm.toDate} onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })} /></div>
            </div>
            <div><Label>Reason</Label><Textarea value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={handleApplyLeave}>Submit</Button></DialogFooter>
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
