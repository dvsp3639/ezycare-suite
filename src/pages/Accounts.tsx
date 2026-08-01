import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import {
  useRevenue,
  useExpenses,
  useCreateOperatingExpense,
  useCreatePurchaseBill,
  useDeleteOperatingExpense,
  useDeletePurchaseBill,
  useOperatingExpenses,
  usePurchaseBills,
} from "@/modules/accounts/hooks";
import { EXPENSE_CATEGORIES, PAYMENT_MODES } from "@/modules/accounts/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area,
} from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, Receipt, FileText, Download, Plus,
  IndianRupee, ArrowUpRight, ArrowDownRight, Trash2, Printer, Activity,
} from "lucide-react";
import { toast } from "sonner";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO } from "date-fns";

const COLORS = [
  "hsl(152, 60%, 40%)", "hsl(210, 80%, 52%)", "hsl(38, 92%, 50%)",
  "hsl(270, 50%, 45%)", "hsl(0, 72%, 51%)", "hsl(180, 60%, 40%)",
];

const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

type Preset = "today" | "week" | "month" | "year" | "custom";

const Accounts = () => {
  const { roles } = useAuth();
  const hospitalId = roles?.[0]?.hospital_id || "";

  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const applyPreset = (p: Preset) => {
    setPreset(p);
    const today = new Date();
    if (p === "today") { setFrom(format(today, "yyyy-MM-dd")); setTo(format(today, "yyyy-MM-dd")); }
    else if (p === "week") { setFrom(format(subDays(today, 6), "yyyy-MM-dd")); setTo(format(today, "yyyy-MM-dd")); }
    else if (p === "month") { setFrom(format(startOfMonth(today), "yyyy-MM-dd")); setTo(format(endOfMonth(today), "yyyy-MM-dd")); }
    else if (p === "year") { setFrom(format(startOfYear(today), "yyyy-MM-dd")); setTo(format(endOfYear(today), "yyyy-MM-dd")); }
  };

  const { data: revenue = [], isLoading: loadingRev } = useRevenue(from, to);
  const { data: expenses = [], isLoading: loadingExp } = useExpenses(from, to);
  const { data: ops = [] } = useOperatingExpenses();
  const { data: purchases = [] } = usePurchaseBills();

  // ─── Aggregations ───
  const totals = useMemo(() => {
    const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
    const totalGst = revenue.reduce((s, r) => s + r.gst, 0);
    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
    const profit = totalRevenue - totalExpense;
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
    const outstanding = revenue.filter((r) => r.paymentStatus === "Pending").reduce((s, r) => s + r.amount, 0);
    return { totalRevenue, totalGst, totalExpense, profit, margin, outstanding };
  }, [revenue, expenses]);

  const bySource = useMemo(() => {
    const map: Record<string, number> = {};
    revenue.forEach((r) => { map[r.source] = (map[r.source] || 0) + r.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [revenue]);

  const byPaymentMode = useMemo(() => {
    const map: Record<string, number> = {};
    revenue.filter(r => r.paymentStatus !== "Pending").forEach((r) => {
      const m = r.paymentMode || "Cash";
      map[m] = (map[m] || 0) + r.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [revenue]);

  const byDoctor = useMemo(() => {
    const map: Record<string, number> = {};
    revenue.filter((r) => r.doctor).forEach((r) => {
      map[r.doctor!] = (map[r.doctor!] || 0) + r.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [revenue]);

  const dailyTrend = useMemo(() => {
    const map: Record<string, { date: string; revenue: number; expense: number }> = {};
    revenue.forEach((r) => {
      const d = r.date.slice(0, 10);
      map[d] = map[d] || { date: d, revenue: 0, expense: 0 };
      map[d].revenue += r.amount;
    });
    expenses.forEach((e) => {
      const d = e.date.slice(0, 10);
      map[d] = map[d] || { date: d, revenue: 0, expense: 0 };
      map[d].expense += e.amount;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({
      ...d,
      label: format(parseISO(d.date), "dd MMM"),
      profit: d.revenue - d.expense,
    }));
  }, [revenue, expenses]);

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => { map[e.source] = (map[e.source] || 0) + e.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  // ─── Forms ───
  const createOp = useCreateOperatingExpense();
  const createPur = useCreatePurchaseBill();
  const delOp = useDeleteOperatingExpense();
  const delPur = useDeletePurchaseBill();

  const [opOpen, setOpOpen] = useState(false);
  const [opForm, setOpForm] = useState({
    expenseDate: format(new Date(), "yyyy-MM-dd"),
    category: "Rent", description: "", amount: 0, paymentMode: "Cash", vendor: "", referenceNo: "", notes: "",
  });

  const [purOpen, setPurOpen] = useState(false);
  const [purForm, setPurForm] = useState({
    billDate: format(new Date(), "yyyy-MM-dd"),
    billType: "Pharmacy" as "Pharmacy" | "Inventory",
    vendor: "", invoiceNo: "", subtotal: 0, gstAmount: 0, discount: 0,
    paymentMode: "Cash", paymentStatus: "Paid" as "Paid" | "Pending" | "Partial", notes: "",
  });

  const submitExpense = async () => {
    if (!opForm.description || opForm.amount <= 0) return toast.error("Enter description and amount");
    await createOp.mutateAsync({ ...opForm, hospitalId } as any);
    toast.success("Expense recorded");
    setOpOpen(false);
    setOpForm({ ...opForm, description: "", amount: 0, vendor: "", referenceNo: "", notes: "" });
  };

  const submitPurchase = async () => {
    if (!purForm.vendor || purForm.subtotal <= 0) return toast.error("Enter vendor and amount");
    const total = (purForm.subtotal + purForm.gstAmount) - purForm.discount;
    await createPur.mutateAsync({ ...purForm, totalAmount: total, hospitalId } as any);
    toast.success("Purchase bill recorded");
    setPurOpen(false);
    setPurForm({ ...purForm, vendor: "", invoiceNo: "", subtotal: 0, gstAmount: 0, discount: 0, notes: "" });
  };

  // ─── CSV Export ───
  const exportCsv = (rows: any[], filename: string) => {
    if (!rows.length) return toast.error("Nothing to export");
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold flex items-center gap-2">
            <Wallet className="h-7 w-7 text-success" /> Accounts & Revenue
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time financial overview, P&L analytics and GST tracking</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={preset} onValueChange={(v) => applyPreset(v as Preset)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }} className="w-40" />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset("custom"); }} className="w-40" />
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Revenue" value={totals.totalRevenue} icon={<TrendingUp className="h-5 w-5" />} accent="success" loading={loadingRev} />
        <KpiCard label="Total Expenses" value={totals.totalExpense} icon={<TrendingDown className="h-5 w-5" />} accent="destructive" loading={loadingExp} />
        <KpiCard label="Net Profit" value={totals.profit} icon={<Activity className="h-5 w-5" />} accent={totals.profit >= 0 ? "success" : "destructive"} subtitle={`${totals.margin.toFixed(1)}% margin`} loading={loadingRev || loadingExp} />
        <KpiCard label="Outstanding" value={totals.outstanding} icon={<Receipt className="h-5 w-5" />} accent="warning" subtitle="Pending receivables" loading={loadingRev} />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="pl">P&L</TabsTrigger>
          <TabsTrigger value="gst">GST</TabsTrigger>
        </TabsList>

        {/* ─── OVERVIEW ─── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Revenue vs Expenses Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={dailyTrend}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(152,60%,40%)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(152,60%,40%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(0,72%,51%)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(0,72%,51%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: any) => fmt(v)} />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(152,60%,40%)" fill="url(#rev)" strokeWidth={2} />
                    <Area type="monotone" dataKey="expense" stroke="hsl(0,72%,51%)" fill="url(#exp)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Revenue by Source</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={bySource} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: any) => `${e.name}: ${((e.percent || 0) * 100).toFixed(0)}%`}>
                      {bySource.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Top Earning Doctors</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byDoctor} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                    <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="value" fill="hsl(210,80%,52%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Payment Mode Mix</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={byPaymentMode} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} label={(e: any) => e.name}>
                      {byPaymentMode.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── REVENUE ─── */}
        <TabsContent value="revenue" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Revenue Transactions</CardTitle>
                <CardDescription>{revenue.length} transactions · Total {fmt(totals.totalRevenue)}</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => exportCsv(revenue, `revenue-${from}-to-${to}.csv`)}>
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {loadingRev ? <Skeleton className="h-64 w-full" /> : (
                <div className="rounded-md border max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead>Patient</TableHead>
                        <TableHead>Reg No</TableHead><TableHead>Doctor</TableHead><TableHead>Mode</TableHead>
                        <TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenue.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No transactions in this period</TableCell></TableRow>
                      ) : revenue.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm">{r.date}</TableCell>
                          <TableCell><Badge variant="secondary">{r.source}</Badge></TableCell>
                          <TableCell>{r.patient}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.reference}</TableCell>
                          <TableCell className="text-sm">{r.doctor || "—"}</TableCell>
                          <TableCell className="text-sm">{r.paymentMode}</TableCell>
                          <TableCell><Badge variant={r.paymentStatus === "Paid" ? "default" : "outline"}>{r.paymentStatus}</Badge></TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{fmt(r.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── EXPENSES ─── */}
        <TabsContent value="expenses" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">Total: <span className="font-semibold text-foreground">{fmt(totals.totalExpense)}</span></div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => exportCsv(expenses, `expenses-${from}-to-${to}.csv`)}>
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
              <Dialog open={opOpen} onOpenChange={setOpOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Expense</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Record Operating Expense</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Date</Label><Input type="date" value={opForm.expenseDate} onChange={(e) => setOpForm({ ...opForm, expenseDate: e.target.value })} /></div>
                    <div><Label>Category</Label>
                      <Select value={opForm.category} onValueChange={(v) => setOpForm({ ...opForm, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2"><Label>Description *</Label><Input value={opForm.description} onChange={(e) => setOpForm({ ...opForm, description: e.target.value })} placeholder="e.g. October electricity bill" /></div>
                    <div><Label>Amount (₹) *</Label><Input type="number" value={opForm.amount} onChange={(e) => setOpForm({ ...opForm, amount: Number(e.target.value) })} /></div>
                    <div><Label>Payment Mode</Label>
                      <Select value={opForm.paymentMode} onValueChange={(v) => setOpForm({ ...opForm, paymentMode: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Vendor / Payee</Label><Input value={opForm.vendor} onChange={(e) => setOpForm({ ...opForm, vendor: e.target.value })} /></div>
                    <div><Label>Reference No</Label><Input value={opForm.referenceNo} onChange={(e) => setOpForm({ ...opForm, referenceNo: e.target.value })} /></div>
                    <div className="col-span-2"><Label>Notes</Label><Textarea value={opForm.notes} onChange={(e) => setOpForm({ ...opForm, notes: e.target.value })} rows={2} /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpOpen(false)}>Cancel</Button>
                    <Button onClick={submitExpense} disabled={createOp.isPending}>Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">All Expenses</CardTitle></CardHeader>
              <CardContent>
                {loadingExp ? <Skeleton className="h-64 w-full" /> : (
                  <div className="rounded-md border max-h-[500px] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead>Mode</TableHead><TableHead className="text-right">Amount</TableHead><TableHead></TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {expenses.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No expenses recorded</TableCell></TableRow>
                        ) : expenses.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="text-sm">{e.date}</TableCell>
                            <TableCell><Badge variant="outline">{e.source}</Badge></TableCell>
                            <TableCell className="text-sm">{e.category}</TableCell>
                            <TableCell className="text-sm">{e.description}</TableCell>
                            <TableCell className="text-sm">{e.paymentMode}</TableCell>
                            <TableCell className="text-right font-medium tabular-nums">{fmt(e.amount)}</TableCell>
                            <TableCell>
                              {e.source === "Operating" && (
                                <Button size="icon" variant="ghost" onClick={() => { delOp.mutate(e.id.replace("op-", "")); toast.success("Deleted"); }}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Expense Breakdown</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => e.name}>
                      {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── PURCHASES ─── */}
        <TabsContent value="purchases" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">{purchases.length} bills · Total {fmt(purchases.reduce((s, p) => s + p.totalAmount, 0))}</div>
            <Dialog open={purOpen} onOpenChange={setPurOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Purchase Bill</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Record Purchase Bill</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Bill Date</Label><Input type="date" value={purForm.billDate} onChange={(e) => setPurForm({ ...purForm, billDate: e.target.value })} /></div>
                  <div><Label>Type</Label>
                    <Select value={purForm.billType} onValueChange={(v: any) => setPurForm({ ...purForm, billType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Pharmacy">Pharmacy</SelectItem><SelectItem value="Inventory">Inventory</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Vendor *</Label><Input value={purForm.vendor} onChange={(e) => setPurForm({ ...purForm, vendor: e.target.value })} /></div>
                  <div><Label>Invoice No</Label><Input value={purForm.invoiceNo} onChange={(e) => setPurForm({ ...purForm, invoiceNo: e.target.value })} /></div>
                  <div><Label>Subtotal *</Label><Input type="number" value={purForm.subtotal} onChange={(e) => setPurForm({ ...purForm, subtotal: Number(e.target.value) })} /></div>
                  <div><Label>GST</Label><Input type="number" value={purForm.gstAmount} onChange={(e) => setPurForm({ ...purForm, gstAmount: Number(e.target.value) })} /></div>
                  <div><Label>Discount</Label><Input type="number" value={purForm.discount} onChange={(e) => setPurForm({ ...purForm, discount: Number(e.target.value) })} /></div>
                  <div><Label>Payment Mode</Label>
                    <Select value={purForm.paymentMode} onValueChange={(v) => setPurForm({ ...purForm, paymentMode: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Status</Label>
                    <Select value={purForm.paymentStatus} onValueChange={(v: any) => setPurForm({ ...purForm, paymentStatus: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Paid">Paid</SelectItem><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Partial">Partial</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 text-sm text-muted-foreground">Total: <span className="font-semibold text-foreground">{fmt(purForm.subtotal + purForm.gstAmount - purForm.discount)}</span></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPurOpen(false)}>Cancel</Button>
                  <Button onClick={submitPurchase} disabled={createPur.isPending}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="rounded-md border max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Vendor</TableHead><TableHead>Invoice</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No purchase bills yet</TableCell></TableRow>
                    ) : purchases.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{p.billDate}</TableCell>
                        <TableCell><Badge variant="secondary">{p.billType}</Badge></TableCell>
                        <TableCell>{p.vendor}</TableCell>
                        <TableCell className="text-sm">{p.invoiceNo || "—"}</TableCell>
                        <TableCell><Badge variant={p.paymentStatus === "Paid" ? "default" : "outline"}>{p.paymentStatus}</Badge></TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{fmt(p.totalAmount)}</TableCell>
                        <TableCell><Button size="icon" variant="ghost" onClick={() => { delPur.mutate(p.id); toast.success("Deleted"); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── P&L ─── */}
        <TabsContent value="pl" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Profit & Loss Statement</CardTitle>
                <CardDescription>{from} to {to}</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-w-2xl">
                <div>
                  <h3 className="font-semibold text-success mb-2 flex items-center gap-2"><ArrowUpRight className="h-4 w-4" /> INCOME</h3>
                  <div className="space-y-1 pl-4">
                    {bySource.map((s) => (
                      <div key={s.name} className="flex justify-between text-sm py-1 border-b border-dashed">
                        <span>{s.name}</span><span className="tabular-nums">{fmt(s.value)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold pt-2 border-t">
                      <span>Total Revenue</span><span className="text-success tabular-nums">{fmt(totals.totalRevenue)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-destructive mb-2 flex items-center gap-2"><ArrowDownRight className="h-4 w-4" /> EXPENSES</h3>
                  <div className="space-y-1 pl-4">
                    {expenseByCategory.map((s) => (
                      <div key={s.name} className="flex justify-between text-sm py-1 border-b border-dashed">
                        <span>{s.name}</span><span className="tabular-nums">{fmt(s.value)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold pt-2 border-t">
                      <span>Total Expenses</span><span className="text-destructive tabular-nums">{fmt(totals.totalExpense)}</span>
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-lg ${totals.profit >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm text-muted-foreground">Net Profit / (Loss)</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Margin: {totals.margin.toFixed(2)}%</div>
                    </div>
                    <div className={`text-2xl font-bold tabular-nums ${totals.profit >= 0 ? "text-success" : "text-destructive"}`}>
                      {fmt(totals.profit)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── GST ─── */}
        <TabsContent value="gst" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">GST Summary</CardTitle><CardDescription>Tax collected from billable sales in this period</CardDescription></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-muted/40 rounded-lg">
                  <div className="text-xs text-muted-foreground">Total GST Collected</div>
                  <div className="text-2xl font-bold mt-1 tabular-nums">{fmt(totals.totalGst)}</div>
                </div>
                <div className="p-4 bg-muted/40 rounded-lg">
                  <div className="text-xs text-muted-foreground">CGST (50%)</div>
                  <div className="text-2xl font-bold mt-1 tabular-nums">{fmt(totals.totalGst / 2)}</div>
                </div>
                <div className="p-4 bg-muted/40 rounded-lg">
                  <div className="text-xs text-muted-foreground">SGST (50%)</div>
                  <div className="text-2xl font-bold mt-1 tabular-nums">{fmt(totals.totalGst / 2)}</div>
                </div>
              </div>
              <div className="rounded-md border max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow><TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead>Patient</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">GST</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenue.filter(r => r.gst > 0).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No GST collected in this period</TableCell></TableRow>
                    ) : revenue.filter(r => r.gst > 0).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">{r.date}</TableCell>
                        <TableCell><Badge variant="secondary">{r.source}</Badge></TableCell>
                        <TableCell>{r.patient}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(r.amount - r.gst)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{fmt(r.gst)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const KpiCard = ({ label, value, icon, accent, subtitle, loading }: { label: string; value: number; icon: React.ReactNode; accent: "success" | "destructive" | "warning"; subtitle?: string; loading?: boolean }) => {
  const colorClass = accent === "success" ? "text-success bg-success/10" : accent === "destructive" ? "text-destructive bg-destructive/10" : "text-warning bg-warning/10";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
            {loading ? <Skeleton className="h-8 w-28 mt-2" /> : (
              <div className="text-2xl font-bold mt-1 tabular-nums flex items-center">
                <IndianRupee className="h-5 w-5" />{value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </div>
            )}
            {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
          </div>
          <div className={`p-2 rounded-lg ${colorClass}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Accounts;
