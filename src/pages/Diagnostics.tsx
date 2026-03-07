import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  FlaskConical, Search, ClipboardList, TestTube, FileCheck, Eye, Printer,
  AlertTriangle, CheckCircle2, Clock, Beaker, ArrowRight, IndianRupee,
  Upload, FileImage, FileText, Download, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClinicData } from "@/contexts/ClinicDataContext";
import type { LabOrder, LabResult } from "@/data/mockClinicData";
import { labCategoryColors } from "@/data/mockDiagnosticsData";
import { useLabTestCatalog } from "@/modules/diagnostics/hooks";

const statusColors: Record<string, string> = {
  Ordered: "bg-warning/10 text-warning border-warning/20",
  "Sample Collected": "bg-info/10 text-info border-info/20",
  "In Progress": "bg-primary/10 text-primary border-primary/20",
  Completed: "bg-success/10 text-success border-success/20",
};

const Diagnostics = () => {
  const { allLabOrders, updateLabOrderStatus, updateLabOrderResults, updateLabOrderPayment } = useClinicData();
  const [activeTab, setActiveTab] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Result entry dialog
  const [resultOrder, setResultOrder] = useState<LabOrder | null>(null);
  const [resultValues, setResultValues] = useState<LabResult[]>([]);
  const [reportNotes, setReportNotes] = useState("");
  const [reportFiles, setReportFiles] = useState<{ name: string; url: string; type: string }[]>([]);

  // Report view dialog
  const [viewOrder, setViewOrder] = useState<LabOrder | null>(null);

  // Payment dialog
  const [paymentOrder, setPaymentOrder] = useState<LabOrder | null>(null);
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Credit">("Cash");

  const pendingOrders = useMemo(() =>
    allLabOrders.filter((o) => o.status !== "Completed"), [allLabOrders]
  );

  const completedOrders = useMemo(() =>
    allLabOrders.filter((o) => o.status === "Completed"), [allLabOrders]
  );

  const filterOrders = (orders: LabOrder[]) =>
    orders.filter((o) => {
      const matchSearch = !searchQuery ||
        o.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.patientRegNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.testName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = categoryFilter === "all" || o.category === categoryFilter;
      const matchPriority = priorityFilter === "all" || o.priority === priorityFilter;
      return matchSearch && matchCategory && matchPriority;
    });

  const filteredPending = filterOrders(pendingOrders);
  const filteredCompleted = filterOrders(completedOrders);

  const orderedCount = allLabOrders.filter((o) => o.status === "Ordered").length;
  const sampleCollectedCount = allLabOrders.filter((o) => o.status === "Sample Collected").length;
  const inProgressCount = allLabOrders.filter((o) => o.status === "In Progress").length;
  const completedCount = completedOrders.length;

  // Payment: show payment dialog before accepting (collecting sample)
  const handleAcceptOrder = (order: LabOrder) => {
    if (order.paymentStatus === "Paid") {
      // Already paid, go directly to collect sample
      updateLabOrderStatus(order.id, "Sample Collected");
      toast.success(`Sample collected for ${order.testName} — ${order.patientName}`);
    } else {
      setPaymentOrder(order);
      setPaymentMode("Cash");
    }
  };

  const handleConfirmPayment = () => {
    if (!paymentOrder) return;
    updateLabOrderPayment(paymentOrder.id, paymentMode);
    toast.success(`Payment ₹${paymentOrder.price} received via ${paymentMode}`);
    // After payment, collect sample
    setTimeout(() => {
      updateLabOrderStatus(paymentOrder.id, "Sample Collected");
      toast.success(`Sample collected for ${paymentOrder.testName}`);
    }, 300);
    setPaymentOrder(null);
  };

  const handleStartProcessing = (order: LabOrder) => {
    updateLabOrderStatus(order.id, "In Progress");
    toast.success(`Processing started for ${order.testName}`);
  };

  const handleOpenResultEntry = (order: LabOrder) => {
    setResultOrder(order);
    const testDef = labTestCatalog.find((t) => t.name === order.testName);
    if (testDef) {
      setResultValues(
        testDef.parameters.map((p) => ({
          parameter: p.name,
          value: "",
          unit: p.unit,
          normalRange: p.normalRange,
          isAbnormal: false,
        }))
      );
    } else {
      setResultValues([{ parameter: "Result", value: "", unit: "", normalRange: "", isAbnormal: false }]);
    }
    setReportNotes("");
    setReportFiles(order.reportFiles || []);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      setReportFiles((prev) => [...prev, { name: file.name, url, type: file.type }]);
    });
    e.target.value = "";
  };

  const removeFile = (idx: number) => {
    setReportFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveResults = () => {
    if (!resultOrder) return;
    const filledResults = resultValues.filter((r) => r.value.trim());
    if (filledResults.length === 0 && reportFiles.length === 0) {
      toast.error("Please enter results or upload report files");
      return;
    }
    updateLabOrderResults(resultOrder.id, filledResults, reportNotes || undefined, reportFiles.length > 0 ? reportFiles : undefined);
    toast.success(`Report saved for ${resultOrder.testName} — ${resultOrder.patientName}`);
    setResultOrder(null);
  };

  const updateResultValue = (idx: number, value: string) => {
    setResultValues((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, value } : r))
    );
  };

  const toggleAbnormal = (idx: number) => {
    setResultValues((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, isAbnormal: !r.isAbnormal } : r))
    );
  };

  const handlePrintReport = (order: LabOrder) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow || !order.results) return;
    printWindow.document.write(`
      <html><head><title>Lab Report – ${order.patientName}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: auto; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 16px; margin-bottom: 24px; }
        .header h1 { font-size: 20px; margin: 0; }
        .header p { margin: 4px 0; font-size: 12px; color: #666; }
        .patient-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; font-size: 13px; background: #f5f5f5; padding: 12px; border-radius: 6px; }
        .section { margin-bottom: 16px; }
        .section h3 { font-size: 14px; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
        .abnormal { color: #dc2626; font-weight: bold; }
        .footer { margin-top: 48px; display: flex; justify-content: space-between; font-size: 12px; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <div class="header">
        <h1>EzyOp Diagnostics</h1>
        <p>Laboratory Report</p>
      </div>
      <div class="patient-info">
        <div><strong>Patient:</strong> ${order.patientName}</div>
        <div><strong>Reg No:</strong> ${order.patientRegNo}</div>
        <div><strong>Test:</strong> ${order.testName}</div>
        <div><strong>Category:</strong> ${order.category}</div>
        <div><strong>Ordered By:</strong> ${order.orderedBy}</div>
        <div><strong>Priority:</strong> ${order.priority}</div>
        <div><strong>Ordered At:</strong> ${order.orderedAt}</div>
        <div><strong>Completed At:</strong> ${order.completedAt || "—"}</div>
        <div><strong>Amount:</strong> ₹${order.price}</div>
        <div><strong>Payment:</strong> ${order.paymentStatus || "—"} ${order.paymentMode ? `(${order.paymentMode})` : ""}</div>
      </div>
      <div class="section">
        <h3>Test Results</h3>
        <table>
          <thead><tr><th>Parameter</th><th>Value</th><th>Unit</th><th>Normal Range</th><th>Status</th></tr></thead>
          <tbody>
            ${order.results.map((r) => `
              <tr>
                <td>${r.parameter}</td>
                <td class="${r.isAbnormal ? "abnormal" : ""}">${r.value}</td>
                <td>${r.unit}</td>
                <td>${r.normalRange}</td>
                <td class="${r.isAbnormal ? "abnormal" : ""}">${r.isAbnormal ? "ABNORMAL" : "Normal"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ${order.reportNotes ? `<div class="section"><h3>Remarks</h3><p>${order.reportNotes}</p></div>` : ""}
      ${order.clinicalNotes ? `<div class="section"><h3>Clinical Notes (by Doctor)</h3><p>${order.clinicalNotes}</p></div>` : ""}
      <div class="footer">
        <span>Lab Technician: ___________________</span>
        <span>Date: ${format(new Date(), "dd/MM/yyyy")}</span>
      </div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <FileImage className="h-4 w-4 text-info" />;
    return <FileText className="h-4 w-4 text-warning" />;
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-display font-bold text-foreground">Diagnostics</h1>
        <p className="text-sm text-muted-foreground">Lab workflow — Doctor prescribes → Lab executes → Report returns</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Ordered" value={orderedCount} icon={<ClipboardList className="h-4 w-4" />} accent="text-warning" />
        <SummaryCard label="Sample Collected" value={sampleCollectedCount} icon={<TestTube className="h-4 w-4" />} accent="text-info" />
        <SummaryCard label="In Progress" value={inProgressCount} icon={<Beaker className="h-4 w-4" />} accent="text-primary" />
        <SummaryCard label="Reports Ready" value={completedCount} icon={<FileCheck className="h-4 w-4" />} accent="text-success" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search patient, reg no, test..." className="pl-9 h-10" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="Blood">🩸 Blood</SelectItem>
            <SelectItem value="Urine">🧪 Urine</SelectItem>
            <SelectItem value="Radiology">📷 Radiology</SelectItem>
            <SelectItem value="Serology">🔬 Serology</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="Routine">Routine</SelectItem>
            <SelectItem value="Urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending"><Clock className="h-4 w-4 mr-1.5" /> Pending ({pendingOrders.length})</TabsTrigger>
          <TabsTrigger value="completed"><CheckCircle2 className="h-4 w-4 mr-1.5" /> Completed ({completedOrders.length})</TabsTrigger>
        </TabsList>

        {/* Pending Orders */}
        <TabsContent value="pending">
          {filteredPending.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No pending lab orders</p>
              <p className="text-xs mt-1">Orders from doctor consultations will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPending.map((order) => (
                <div key={order.id} className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <h3 className="text-sm font-semibold text-foreground">{order.testName}</h3>
                        <Badge variant="outline" className={cn("text-[10px]", labCategoryColors[order.category])}>{order.category}</Badge>
                        {order.priority === "Urgent" && (
                          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 bg-destructive/10">
                            <AlertTriangle className="h-3 w-3 mr-0.5" /> Urgent
                          </Badge>
                        )}
                        <Badge variant="outline" className={cn("text-[10px]", statusColors[order.status])}>{order.status}</Badge>
                        <Badge variant="outline" className="text-[10px] text-foreground">
                          <IndianRupee className="h-3 w-3 mr-0.5" /> ₹{order.price}
                        </Badge>
                        {order.paymentStatus === "Paid" && (
                          <Badge variant="outline" className="text-[10px] text-success border-success/20 bg-success/10">
                            <CheckCircle2 className="h-3 w-3 mr-0.5" /> Paid ({order.paymentMode})
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span><strong className="text-foreground">Patient:</strong> {order.patientName}</span>
                        <span><strong className="text-foreground">Reg:</strong> {order.patientRegNo}</span>
                        <span><strong className="text-foreground">Doctor:</strong> {order.orderedBy}</span>
                        <span><strong className="text-foreground">Ordered:</strong> {order.orderedAt}</span>
                      </div>
                      {order.clinicalNotes && (
                        <p className="text-xs text-muted-foreground mt-1.5 bg-muted/50 rounded px-2 py-1">
                          📋 {order.clinicalNotes}
                        </p>
                      )}
                      {order.sampleCollectedAt && (
                        <p className="text-xs text-info mt-1">Sample collected at {order.sampleCollectedAt}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {order.status === "Ordered" && (
                        <Button size="sm" variant="outline" onClick={() => handleAcceptOrder(order)}>
                          <IndianRupee className="h-3.5 w-3.5 mr-1" /> Accept & Collect
                        </Button>
                      )}
                      {order.status === "Sample Collected" && (
                        <Button size="sm" variant="outline" onClick={() => handleStartProcessing(order)}>
                          <Beaker className="h-3.5 w-3.5 mr-1" /> Start Processing
                        </Button>
                      )}
                      {order.status === "In Progress" && (
                        <Button size="sm" onClick={() => handleOpenResultEntry(order)}>
                          <ArrowRight className="h-3.5 w-3.5 mr-1" /> Enter Results
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* Visual workflow stepper */}
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
                    <StepIndicator label="Ordered" active={true} done={order.status !== "Ordered"} />
                    <div className={cn("flex-1 h-0.5", order.status !== "Ordered" ? "bg-success" : "bg-border")} />
                    <StepIndicator label="Payment" active={order.paymentStatus === "Paid"} done={order.paymentStatus === "Paid"} />
                    <div className={cn("flex-1 h-0.5", order.status !== "Ordered" ? "bg-success" : "bg-border")} />
                    <StepIndicator label="Sample" active={order.status === "Sample Collected" || order.status === "In Progress"} done={order.status === "In Progress"} />
                    <div className={cn("flex-1 h-0.5", order.status === "In Progress" ? "bg-success" : "bg-border")} />
                    <StepIndicator label="Processing" active={order.status === "In Progress"} done={false} />
                    <div className="flex-1 h-0.5 bg-border" />
                    <StepIndicator label="Report" active={false} done={false} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Completed Reports */}
        <TabsContent value="completed">
          {filteredCompleted.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No completed reports yet</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Ordered By</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Abnormal</TableHead>
                    <TableHead>Files</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompleted.map((order) => {
                    const hasAbnormal = order.results?.some((r) => r.isAbnormal);
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium text-foreground text-sm">{order.testName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px]", labCategoryColors[order.category])}>{order.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-foreground">{order.patientName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{order.patientRegNo}</p>
                        </TableCell>
                        <TableCell className="text-sm">{order.orderedBy}</TableCell>
                        <TableCell className="text-sm font-medium">₹{order.price}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px]", order.priority === "Urgent" ? "text-destructive border-destructive/30" : "text-muted-foreground")}>{order.priority}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{order.completedAt}</TableCell>
                        <TableCell>
                          {hasAbnormal ? (
                            <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 bg-destructive/10">
                              <AlertTriangle className="h-3 w-3 mr-0.5" /> Yes
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-success border-success/20">Normal</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {order.reportFiles && order.reportFiles.length > 0 ? (
                            <Badge variant="outline" className="text-[10px] text-info border-info/20 bg-info/10">
                              <Upload className="h-3 w-3 mr-0.5" /> {order.reportFiles.length}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => setViewOrder(order)}>
                            <Eye className="h-3.5 w-3.5 mr-1" /> View
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handlePrintReport(order)}>
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Payment Summary Dialog */}
      <Dialog open={!!paymentOrder} onOpenChange={(v) => !v && setPaymentOrder(null)}>
        <DialogContent className="max-w-md">
          {paymentOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <IndianRupee className="h-5 w-5 text-primary" /> Payment Summary
                </DialogTitle>
              </DialogHeader>

              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Patient:</span> <strong className="text-foreground">{paymentOrder.patientName}</strong></div>
                  <div><span className="text-muted-foreground">Reg No:</span> <strong className="text-foreground font-mono">{paymentOrder.patientRegNo}</strong></div>
                  <div><span className="text-muted-foreground">Test:</span> <strong className="text-foreground">{paymentOrder.testName}</strong></div>
                  <div><span className="text-muted-foreground">Category:</span> <strong className="text-foreground">{paymentOrder.category}</strong></div>
                  <div><span className="text-muted-foreground">Priority:</span> <strong className={paymentOrder.priority === "Urgent" ? "text-destructive" : "text-foreground"}>{paymentOrder.priority}</strong></div>
                  <div><span className="text-muted-foreground">Ordered By:</span> <strong className="text-foreground">{paymentOrder.orderedBy}</strong></div>
                </div>

                <div className="border-t border-border pt-3 mt-3">
                  <div className="flex items-center justify-between text-lg font-bold">
                    <span className="text-foreground">Total Amount</span>
                    <span className="text-primary">₹{paymentOrder.price}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Payment Mode</Label>
                <div className="flex gap-3">
                  <Button
                    variant={paymentMode === "Cash" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setPaymentMode("Cash")}
                  >
                    💵 Cash
                  </Button>
                  <Button
                    variant={paymentMode === "Credit" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setPaymentMode("Credit")}
                  >
                    💳 Credit
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setPaymentOrder(null)}>Cancel</Button>
                <Button onClick={handleConfirmPayment}>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Confirm Payment & Collect Sample
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Result Entry Dialog with File Upload */}
      <Dialog open={!!resultOrder} onOpenChange={(v) => !v && setResultOrder(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          {resultOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <Beaker className="h-5 w-5 text-primary" /> Enter Results
                </DialogTitle>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{resultOrder.testName}</Badge>
                  <Badge variant="outline" className={cn("text-xs", labCategoryColors[resultOrder.category])}>{resultOrder.category}</Badge>
                  <Badge variant="outline" className="text-xs">{resultOrder.patientName}</Badge>
                  <Badge variant="outline" className="text-xs font-mono">{resultOrder.patientRegNo}</Badge>
                </div>
              </DialogHeader>

              {resultOrder.clinicalNotes && (
                <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                  <strong className="text-foreground">Doctor's Clinical Notes:</strong> {resultOrder.clinicalNotes}
                </div>
              )}

              <div className="space-y-3">
                {resultValues.map((r, idx) => (
                  <div key={idx} className="border border-border rounded-lg p-3 bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">{r.parameter}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Normal: {r.normalRange} {r.unit}</span>
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={r.isAbnormal}
                            onCheckedChange={() => toggleAbnormal(idx)}
                            className="h-4 w-8"
                          />
                          <span className={cn("text-xs font-medium", r.isAbnormal ? "text-destructive" : "text-success")}>
                            {r.isAbnormal ? "Abnormal" : "Normal"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Input
                      value={r.value}
                      onChange={(e) => updateResultValue(idx, e.target.value)}
                      placeholder={`Enter value ${r.unit ? `(${r.unit})` : ""}`}
                      className={cn("text-sm", r.isAbnormal && "border-destructive/50")}
                    />
                  </div>
                ))}
              </div>

              {/* File Upload Section */}
              <div className="space-y-3 border border-border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Upload className="h-4 w-4" /> Upload Report Files
                  </Label>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <Button size="sm" variant="outline" asChild>
                      <span><Upload className="h-3.5 w-3.5 mr-1" /> Choose Files</span>
                    </Button>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">Accepts PDF, DOC, DOCX, JPG, PNG, WEBP</p>
                {reportFiles.length > 0 && (
                  <div className="space-y-2">
                    {reportFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {getFileIcon(file.type)}
                          <span className="text-sm text-foreground truncate">{file.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <a href={file.url} target="_blank" rel="noopener noreferrer">
                            <Button size="icon" variant="ghost" className="h-7 w-7">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeFile(idx)}>
                            <X className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Report Remarks (optional)</Label>
                <Textarea
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="Additional findings, observations, recommendations..."
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setResultOrder(null)}>Cancel</Button>
                <Button onClick={handleSaveResults}>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Save & Complete Report
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Report View Dialog */}
      <Dialog open={!!viewOrder} onOpenChange={(v) => !v && setViewOrder(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          {viewOrder && viewOrder.results && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-success" /> Lab Report
                </DialogTitle>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{viewOrder.testName}</Badge>
                  <Badge variant="outline" className={cn("text-xs", labCategoryColors[viewOrder.category])}>{viewOrder.category}</Badge>
                </div>
              </DialogHeader>

              <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-muted-foreground">Patient:</span> <strong className="text-foreground">{viewOrder.patientName}</strong></div>
                <div><span className="text-muted-foreground">Reg No:</span> <strong className="text-foreground font-mono">{viewOrder.patientRegNo}</strong></div>
                <div><span className="text-muted-foreground">Ordered By:</span> <strong className="text-foreground">{viewOrder.orderedBy}</strong></div>
                <div><span className="text-muted-foreground">Priority:</span> <strong className={viewOrder.priority === "Urgent" ? "text-destructive" : "text-foreground"}>{viewOrder.priority}</strong></div>
                <div><span className="text-muted-foreground">Ordered:</span> <strong className="text-foreground">{viewOrder.orderedAt}</strong></div>
                <div><span className="text-muted-foreground">Completed:</span> <strong className="text-foreground">{viewOrder.completedAt}</strong></div>
                <div><span className="text-muted-foreground">Amount:</span> <strong className="text-foreground">₹{viewOrder.price}</strong></div>
                <div><span className="text-muted-foreground">Payment:</span> <strong className="text-success">{viewOrder.paymentStatus} ({viewOrder.paymentMode})</strong></div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parameter</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Normal Range</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewOrder.results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-medium">{r.parameter}</TableCell>
                      <TableCell className={cn("text-sm font-mono", r.isAbnormal && "text-destructive font-bold")}>{r.value}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.unit}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.normalRange}</TableCell>
                      <TableCell>
                        {r.isAbnormal ? (
                          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 bg-destructive/10">Abnormal</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-success border-success/20 bg-success/10">Normal</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Report Files visible to doctor */}
              {viewOrder.reportFiles && viewOrder.reportFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Upload className="h-4 w-4" /> Attached Report Files
                  </Label>
                  <div className="space-y-2">
                    {viewOrder.reportFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-muted/50 border border-border rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {file.type.startsWith("image/") ? <FileImage className="h-4 w-4 text-info" /> : <FileText className="h-4 w-4 text-warning" />}
                          <span className="text-sm text-foreground truncate">{file.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <a href={file.url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost" className="h-7 text-xs">
                              <Eye className="h-3.5 w-3.5 mr-1" /> View
                            </Button>
                          </a>
                          <a href={file.url} download={file.name}>
                            <Button size="sm" variant="ghost" className="h-7 text-xs">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewOrder.reportNotes && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">Report Remarks</p>
                  <p className="text-sm text-foreground">{viewOrder.reportNotes}</p>
                </div>
              )}

              {viewOrder.clinicalNotes && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">Doctor's Clinical Notes</p>
                  <p className="text-sm text-foreground">{viewOrder.clinicalNotes}</p>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => handlePrintReport(viewOrder)}>
                  <Printer className="h-4 w-4 mr-1.5" /> Print Report
                </Button>
                <Button variant="outline" onClick={() => setViewOrder(null)}>Close</Button>
              </DialogFooter>
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

const StepIndicator = ({ label, active, done }: { label: string; active: boolean; done: boolean }) => (
  <div className="flex flex-col items-center gap-0.5">
    <div className={cn(
      "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border-2 transition-all",
      done ? "bg-success border-success text-success-foreground" :
      active ? "bg-primary border-primary text-primary-foreground" :
      "bg-muted border-border text-muted-foreground"
    )}>
      {done ? "✓" : ""}
    </div>
    <span className={cn("text-[9px]", active || done ? "text-foreground font-medium" : "text-muted-foreground")}>{label}</span>
  </div>
);

export default Diagnostics;
