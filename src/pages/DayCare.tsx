import { useState, useMemo, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Sun, Search, Plus, Play, CheckCircle, Clock, User, Phone, Stethoscope,
  Receipt, Trash2, Edit, Eye, TrendingUp, IndianRupee, Users, Activity,
  BarChart3, PieChart,
} from "lucide-react";
import { format } from "date-fns";
import {
  dayCareCategories,
  type DayCarePatient, type DayCareTreatment, type DayCareBillingItem, type DayCareBill,
} from "@/data/mockDayCareData";
import { useDayCareSessions, useDayCareTreatments } from "@/modules/daycare/hooks";
import { daycareService } from "@/modules/daycare/services";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";

const statusColor = (s: DayCarePatient["status"]) => {
  if (s === "In Progress") return "bg-info/10 text-info border-info/30";
  if (s === "Completed") return "bg-success/10 text-success border-success/30";
  return "bg-muted text-muted-foreground border-border";
};

const treatmentStatusColor = (s: string) => {
  if (s === "In Progress") return "bg-info/10 text-info border-info/30";
  if (s === "Completed") return "bg-success/10 text-success border-success/30";
  return "bg-warning/10 text-warning border-warning/30";
};

const paymentColor = (s: string) => {
  if (s === "Paid") return "bg-success/10 text-success border-success/30";
  if (s === "Partial") return "bg-warning/10 text-warning border-warning/30";
  return "bg-destructive/10 text-destructive border-destructive/30";
};

const CHART_COLORS = [
  "hsl(270, 50%, 45%)", "hsl(210, 80%, 52%)", "hsl(152, 60%, 40%)",
  "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)", "hsl(270, 50%, 65%)",
  "hsl(210, 60%, 70%)", "hsl(152, 40%, 60%)",
];

const DayCare = () => {
  const { toast } = useToast();
  const { roles } = useAuth();
  const hospitalId = roles?.[0]?.hospital_id || "";
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: dbSessions, refetch: refetchSessions } = useDayCareSessions(today);
  const { data: dbTreatments } = useDayCareTreatments();

  const [patients, setPatients] = useState<DayCarePatient[]>([]);
  const [treatments, setTreatments] = useState<DayCareTreatment[]>([]);

  useEffect(() => {
    if (dbSessions) {
      setPatients(dbSessions.map((s: any) => ({
        id: s.id, patientName: s.patientName, registrationNumber: s.registrationNumber,
        age: s.age || 0, gender: s.gender || "Male", mobile: s.mobile || "",
        doctorName: s.doctorName, admissionTime: s.admissionTime || "", status: s.status,
        diagnosis: s.diagnosis || "", date: s.sessionDate,
        treatments: (s.treatments || []).map((t: any) => ({
          treatmentId: t.treatmentId || t.id, treatmentName: t.treatmentName,
          status: t.status, startTime: t.startTime, endTime: t.endTime, notes: t.notes,
        })),
        bill: s.bill ? {
          id: s.bill.id, patientId: s.id,
          items: (s.bill.items || []).map((i: any) => ({
            id: i.id, description: i.description, category: i.category || "Other",
            qty: i.qty || 1, unitPrice: i.unitPrice || 0, total: i.total || 0,
          })),
          subtotal: s.bill.subtotal || 0, discount: s.bill.discount || 0,
          tax: s.bill.tax || 0, grandTotal: s.bill.grandTotal || 0,
          paymentStatus: s.bill.paymentStatus || "Pending",
          paymentMode: s.bill.paymentMode, createdAt: s.bill.createdAt || "",
        } : undefined,
      })));
    }
  }, [dbSessions]);

  useEffect(() => {
    if (dbTreatments) {
      setTreatments(dbTreatments.map((t: any) => ({
        id: t.id, name: t.name, category: t.category,
        duration: t.duration || "", price: t.price || 0, description: t.description || "",
      })));
    }
  }, [dbTreatments]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("patients");

  // Add Treatment Dialog
  const [showAddTreatment, setShowAddTreatment] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [treatmentNameInput, setTreatmentNameInput] = useState("");

  // Billing Dialog
  const [showBilling, setShowBilling] = useState(false);
  const [billingPatientId, setBillingPatientId] = useState<string | null>(null);
  const [billingItems, setBillingItems] = useState<DayCareBillingItem[]>([]);
  const [billingDiscount, setBillingDiscount] = useState(0);
  const [billingTax, setBillingTax] = useState(0);
  const [billingPaymentMode, setBillingPaymentMode] = useState<"Cash" | "Card" | "UPI" | "Insurance">("Cash");
  const [newBillingItem, setNewBillingItem] = useState({ description: "", category: "Treatment" as DayCareBillingItem["category"], qty: 1, unitPrice: 0 });

  // View Details Dialog
  const [showDetails, setShowDetails] = useState(false);
  const [detailsPatient, setDetailsPatient] = useState<DayCarePatient | null>(null);

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchSearch = !search || p.patientName.toLowerCase().includes(search.toLowerCase()) || p.registrationNumber.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [patients, search, statusFilter]);

  const todayPatients = patients.filter((p) => p.date === today);
  const inProgress = todayPatients.filter((p) => p.status === "In Progress").length;
  const completed = todayPatients.filter((p) => p.status === "Completed").length;
  const totalRevenue = patients.reduce((sum, p) => sum + (p.bill?.grandTotal || 0), 0);

  // ---- Treatment Actions ----
  const handleAddTreatment = async () => {
    if (!selectedPatientId || !treatmentNameInput.trim()) return;
    try {
      await daycareService.addSessionTreatment({
        session_id: selectedPatientId,
        treatment_name: treatmentNameInput.trim(),
        status: "Scheduled",
        notes: "",
        hospital_id: hospitalId,
      } as any);
      await refetchSessions();
      toast({ title: "Treatment Added", description: `${treatmentNameInput} added for patient` });
      setShowAddTreatment(false);
      setTreatmentNameInput("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to add treatment", variant: "destructive" });
    }
  };

  const startTreatment = (patientId: string, treatmentId: string) => {
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId
          ? { ...p, treatments: p.treatments.map((t) => t.treatmentId === treatmentId && t.status === "Scheduled" ? { ...t, status: "In Progress" as const, startTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }) } : t) }
          : p
      )
    );
  };

  const completeTreatment = (patientId: string, treatmentId: string) => {
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId
          ? { ...p, treatments: p.treatments.map((t) => t.treatmentId === treatmentId && t.status === "In Progress" ? { ...t, status: "Completed" as const, endTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }) } : t) }
          : p
      )
    );
  };

  // ---- Billing Actions ----
  const openBilling = (patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) return;
    // Pre-fill with completed treatments
    const items: DayCareBillingItem[] = patient.treatments
      .filter((t) => t.status === "Completed")
      .map((t, i) => {
        const treat = treatments.find((tr) => tr.id === t.treatmentId);
        return { id: `bi-${Date.now()}-${i}`, description: t.treatmentName, category: "Treatment" as const, qty: 1, unitPrice: treat?.price || 0, total: treat?.price || 0 };
      });
    if (patient.bill) {
      setBillingItems(patient.bill.items);
      setBillingDiscount(patient.bill.discount);
      setBillingTax(patient.bill.tax);
    } else {
      setBillingItems(items);
      setBillingDiscount(0);
      setBillingTax(0);
    }
    setBillingPatientId(patientId);
    setShowBilling(true);
  };

  const addBillingItem = () => {
    if (!newBillingItem.description) return;
    const total = newBillingItem.qty * newBillingItem.unitPrice;
    setBillingItems((prev) => [...prev, { id: `bi-${Date.now()}`, ...newBillingItem, total }]);
    setNewBillingItem({ description: "", category: "Treatment", qty: 1, unitPrice: 0 });
  };

  const removeBillingItem = (id: string) => {
    setBillingItems((prev) => prev.filter((i) => i.id !== id));
  };

  const billingSubtotal = billingItems.reduce((s, i) => s + i.total, 0);
  const billingGrandTotal = billingSubtotal - billingDiscount + billingTax;

  const saveBill = (paymentStatus: "Pending" | "Paid") => {
    if (!billingPatientId) return;
    const bill: DayCareBill = {
      id: `bill-${Date.now()}`, patientId: billingPatientId, items: billingItems,
      subtotal: billingSubtotal, discount: billingDiscount, tax: billingTax, grandTotal: billingGrandTotal,
      paymentStatus, paymentMode: paymentStatus === "Paid" ? billingPaymentMode : undefined,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }),
    };
    setPatients((prev) => prev.map((p) => p.id === billingPatientId ? { ...p, bill, status: "Completed" as const } : p));
    toast({ title: paymentStatus === "Paid" ? "Bill Paid" : "Bill Saved", description: `₹${billingGrandTotal.toLocaleString()}` });
    setShowBilling(false);
  };

  // ---- Analytics ----
  const treatmentBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    patients.forEach((p) => p.treatments.forEach((t) => { map[t.treatmentName] = (map[t.treatmentName] || 0) + 1; }));
    return Object.entries(map).map(([name, count]) => ({ name: name.length > 20 ? name.slice(0, 18) + "…" : name, count })).sort((a, b) => b.count - a.count);
  }, [patients]);

  const revenueByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    patients.forEach((p) => p.bill?.items.forEach((i) => { map[i.category] = (map[i.category] || 0) + i.total; }));
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [patients]);

  const dailyPatientCount = useMemo(() => {
    const map: Record<string, number> = {};
    patients.forEach((p) => { map[p.date] = (map[p.date] || 0) + 1; });
    return Object.entries(map).sort().slice(-7).map(([date, count]) => ({ date, count }));
  }, [patients]);

  const statusDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    patients.forEach((p) => { map[p.status] = (map[p.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [patients]);

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
          <Sun className="h-5 w-5 text-warning" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Day Care Services</h1>
          <p className="text-sm text-muted-foreground">Manage day care patients, treatments & billing</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center"><Users className="h-5 w-5 text-info" /></div>
          <div><p className="text-xs text-muted-foreground">Today's Patients</p><p className="text-xl font-bold text-foreground">{todayPatients.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center"><Activity className="h-5 w-5 text-warning" /></div>
          <div><p className="text-xs text-muted-foreground">In Progress</p><p className="text-xl font-bold text-foreground">{inProgress}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center"><CheckCircle className="h-5 w-5 text-success" /></div>
          <div><p className="text-xs text-muted-foreground">Completed</p><p className="text-xl font-bold text-foreground">{completed}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><IndianRupee className="h-5 w-5 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Total Revenue</p><p className="text-xl font-bold text-foreground">₹{totalRevenue.toLocaleString()}</p></div>
        </CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="patients"><Users className="h-4 w-4 mr-1" />Patients</TabsTrigger>
          <TabsTrigger value="billing"><Receipt className="h-4 w-4 mr-1" />Billing</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="h-4 w-4 mr-1" />Analytics</TabsTrigger>
        </TabsList>

        {/* ========== PATIENTS TAB ========== */}
        <TabsContent value="patients" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search patient name or reg no…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Discharged">Discharged</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {filteredPatients.length === 0 && <p className="text-center text-muted-foreground py-8">No patients found</p>}
            {filteredPatients.map((p) => (
              <Card key={p.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{p.patientName}</span>
                        <Badge variant="outline" className="text-xs">{p.registrationNumber}</Badge>
                        <Badge className={`text-xs ${statusColor(p.status)}`}>{p.status}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{p.age}y / {p.gender}</span>
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.mobile}</span>
                        <span className="flex items-center gap-1"><Stethoscope className="h-3 w-3" />{p.doctorName}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Admitted: {p.admissionTime}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Dx: {p.diagnosis}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => { setDetailsPatient(p); setShowDetails(true); }}>
                        <Eye className="h-3.5 w-3.5 mr-1" />View
                      </Button>
                      {p.status === "In Progress" && (
                        <Button size="sm" onClick={() => { setSelectedPatientId(p.id); setShowAddTreatment(true); }}>
                          <Plus className="h-3.5 w-3.5 mr-1" />Add Treatment
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openBilling(p.id)}>
                        <Receipt className="h-3.5 w-3.5 mr-1" />Bill
                      </Button>
                    </div>
                  </div>

                  {/* Treatment chips */}
                  {p.treatments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {p.treatments.map((t, i) => (
                        <div key={i} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${treatmentStatusColor(t.status)}`}>
                          <span>{t.treatmentName}</span>
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">{t.status}</Badge>
                          {t.status === "Scheduled" && p.status === "In Progress" && (
                            <button onClick={() => startTreatment(p.id, t.treatmentId)} className="ml-1 hover:opacity-80"><Play className="h-3 w-3" /></button>
                          )}
                          {t.status === "In Progress" && (
                            <button onClick={() => completeTreatment(p.id, t.treatmentId)} className="ml-1 hover:opacity-80"><CheckCircle className="h-3 w-3" /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ========== BILLING TAB ========== */}
        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Patient Bills</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Reg No</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.filter((p) => p.bill).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.patientName}</TableCell>
                      <TableCell>{p.registrationNumber}</TableCell>
                      <TableCell>{p.bill!.items.length}</TableCell>
                      <TableCell className="text-right font-semibold">₹{p.bill!.grandTotal.toLocaleString()}</TableCell>
                      <TableCell><Badge className={`text-xs ${paymentColor(p.bill!.paymentStatus)}`}>{p.bill!.paymentStatus}</Badge></TableCell>
                      <TableCell>{p.bill!.paymentMode || "—"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => openBilling(p.id)}><Edit className="h-3.5 w-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!patients.some((p) => p.bill) && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No bills generated yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== ANALYTICS TAB ========== */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Treatment Breakdown</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={treatmentBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(270, 50%, 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Revenue by Category</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <RePieChart>
                    <Pie data={revenueByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ₹${value}`}>
                      {revenueByCategory.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                  </RePieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Daily Patient Count</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={dailyPatientCount}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="hsl(210, 80%, 52%)" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Patient Status Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <RePieChart>
                    <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {statusDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== ADD TREATMENT DIALOG ===== */}
      <Dialog open={showAddTreatment} onOpenChange={setShowAddTreatment}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Treatment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Notes</Label>
              <Textarea value={treatmentNameInput} onChange={(e) => setTreatmentNameInput(e.target.value)} placeholder="Enter treatment notes…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTreatment(false)}>Cancel</Button>
            <Button onClick={handleAddTreatment} disabled={!treatmentNameInput.trim()}>Add Treatment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== BILLING DIALOG ===== */}
      <Dialog open={showBilling} onOpenChange={setShowBilling}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Billing — {patients.find((p) => p.id === billingPatientId)?.patientName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Add new item */}
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4">
                <Label className="text-xs">Description</Label>
                <Input value={newBillingItem.description} onChange={(e) => setNewBillingItem((p) => ({ ...p, description: e.target.value }))} placeholder="Item" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Category</Label>
                <Select value={newBillingItem.category} onValueChange={(v) => setNewBillingItem((p) => ({ ...p, category: v as DayCareBillingItem["category"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Treatment", "Medicine", "Consumable", "Investigation", "Other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1">
                <Label className="text-xs">Qty</Label>
                <Input type="number" min={1} value={newBillingItem.qty} onChange={(e) => setNewBillingItem((p) => ({ ...p, qty: +e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Unit Price</Label>
                <Input type="number" min={0} value={newBillingItem.unitPrice} onChange={(e) => setNewBillingItem((p) => ({ ...p, unitPrice: +e.target.value }))} />
              </div>
              <div className="col-span-1">
                <Label className="text-xs">Total</Label>
                <p className="text-sm font-medium pt-2">₹{(newBillingItem.qty * newBillingItem.unitPrice).toLocaleString()}</p>
              </div>
              <div className="col-span-2">
                <Button size="sm" onClick={addBillingItem} disabled={!newBillingItem.description} className="w-full"><Plus className="h-3.5 w-3.5 mr-1" />Add</Button>
              </div>
            </div>

            {/* Items table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billingItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{item.category}</Badge></TableCell>
                    <TableCell className="text-center">{item.qty}</TableCell>
                    <TableCell className="text-right">₹{item.unitPrice.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">₹{item.total.toLocaleString()}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => removeBillingItem(item.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Totals */}
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex gap-8"><span className="text-muted-foreground">Subtotal:</span><span className="font-medium">₹{billingSubtotal.toLocaleString()}</span></div>
              <div className="flex gap-4 items-center">
                <span className="text-muted-foreground">Discount:</span>
                <Input type="number" min={0} className="w-24 h-7 text-sm" value={billingDiscount} onChange={(e) => setBillingDiscount(+e.target.value)} />
              </div>
              <div className="flex gap-4 items-center">
                <span className="text-muted-foreground">Tax:</span>
                <Input type="number" min={0} className="w-24 h-7 text-sm" value={billingTax} onChange={(e) => setBillingTax(+e.target.value)} />
              </div>
              <div className="flex gap-8 text-base font-bold border-t border-border pt-1 mt-1">
                <span>Grand Total:</span><span>₹{billingGrandTotal.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <Label>Payment Mode</Label>
              <Select value={billingPaymentMode} onValueChange={(v) => setBillingPaymentMode(v as typeof billingPaymentMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Cash", "Card", "UPI", "Insurance"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => saveBill("Pending")}>Save as Pending</Button>
            <Button onClick={() => saveBill("Paid")}>Mark Paid & Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== VIEW DETAILS DIALOG ===== */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Patient Details</DialogTitle></DialogHeader>
          {detailsPatient && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{detailsPatient.patientName}</span></div>
                <div><span className="text-muted-foreground">Reg No:</span> <span className="font-medium">{detailsPatient.registrationNumber}</span></div>
                <div><span className="text-muted-foreground">Age/Gender:</span> <span className="font-medium">{detailsPatient.age}y / {detailsPatient.gender}</span></div>
                <div><span className="text-muted-foreground">Mobile:</span> <span className="font-medium">{detailsPatient.mobile}</span></div>
                <div><span className="text-muted-foreground">Doctor:</span> <span className="font-medium">{detailsPatient.doctorName}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge className={`text-xs ${statusColor(detailsPatient.status)}`}>{detailsPatient.status}</Badge></div>
                <div className="col-span-2"><span className="text-muted-foreground">Diagnosis:</span> <span className="font-medium">{detailsPatient.diagnosis}</span></div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Treatments</h4>
                <div className="space-y-2">
                  {detailsPatient.treatments.map((t, i) => (
                    <div key={i} className={`p-2 rounded-lg border text-xs ${treatmentStatusColor(t.status)}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{t.treatmentName}</span>
                        <Badge variant="secondary" className="text-[10px]">{t.status}</Badge>
                      </div>
                      {(t.startTime || t.endTime) && (
                        <p className="mt-1 text-muted-foreground">{t.startTime && `Start: ${t.startTime}`} {t.endTime && `• End: ${t.endTime}`}</p>
                      )}
                      {t.notes && <p className="mt-1">{t.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {detailsPatient.bill && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Bill Summary</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Items:</span><span>{detailsPatient.bill.items.length}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span>₹{detailsPatient.bill.subtotal.toLocaleString()}</span></div>
                    {detailsPatient.bill.discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount:</span><span>-₹{detailsPatient.bill.discount.toLocaleString()}</span></div>}
                    <div className="flex justify-between font-bold border-t border-border pt-1"><span>Grand Total:</span><span>₹{detailsPatient.bill.grandTotal.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Payment:</span><Badge className={`text-xs ${paymentColor(detailsPatient.bill.paymentStatus)}`}>{detailsPatient.bill.paymentStatus}</Badge></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DayCare;
