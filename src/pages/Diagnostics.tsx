import { useState, useMemo, useEffect } from "react";
import { flushSync } from "react-dom";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { supabase } from "@/integrations/supabase/client";
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
  Upload, FileImage, FileText, Download, X, Plus, Trash2, Settings2, Edit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveLabReportBlob } from "@/lib/labReports";
import { generateLabReportPdfAsync } from "@/lib/labReportPdf";

import { loadLabReportConfig } from "@/lib/labReportConfig";
import { useHospitalProfile } from "@/modules/diagnostics/useHospitalProfile";
import { labCategoryColors } from "@/data/mockDiagnosticsData";
import {
  useLabTestCatalog, useLabOrders,
  useUpdateLabOrderStatus, useUpdateLabOrderPayment, useSaveLabResults,
  useCreateTestCatalogItem, useUpdateTestCatalogItem, useDeleteTestCatalogItem,
} from "@/modules/diagnostics/hooks";
import type { LabTestCatalogItem } from "@/modules/diagnostics/types";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const statusColors: Record<string, string> = {
  Ordered: "bg-warning/10 text-warning border-warning/20",
  "Sample Collected": "bg-info/10 text-info border-info/20",
  "In Progress": "bg-primary/10 text-primary border-primary/20",
  Completed: "bg-success/10 text-success border-success/20",
};

// Map DB lab order (snake_case via snakeToCamel) to display format
interface DisplayLabOrder {
  id: string;
  testName: string;
  category: string;
  priority: "Routine" | "Urgent";
  status: "Ordered" | "Sample Collected" | "In Progress" | "Completed";
  price: number;
  paymentStatus?: string;
  paymentMode?: string | null;
  clinicalNotes?: string;
  orderedBy: string;
  orderedAt: string;
  patientName: string;
  patientRegNo: string;
  sampleCollectedAt?: string | null;
  completedAt?: string | null;
  results?: { parameter: string; value: string; unit: string; normalRange: string; isAbnormal: boolean }[];
  reportNotes?: string;
  reportFileUrl?: string;
  reportFileName?: string;
}

function mapDbOrder(o: any): DisplayLabOrder {
  return {
    id: o.id,
    testName: o.testName,
    category: o.category,
    priority: o.priority,
    status: o.status,
    price: o.price,
    paymentStatus: o.paymentStatus,
    paymentMode: o.paymentMode,
    clinicalNotes: o.clinicalNotes,
    orderedBy: o.orderedBy,
    orderedAt: o.orderedAt ? new Date(o.orderedAt).toLocaleTimeString() : "",
    patientName: o.patientName,
    patientRegNo: o.patientRegNo,
    sampleCollectedAt: o.sampleCollectedAt ? new Date(o.sampleCollectedAt).toLocaleTimeString() : null,
    completedAt: o.completedAt ? new Date(o.completedAt).toLocaleTimeString() : null,
    results: (o.results || []).map((r: any) => ({
      parameter: r.parameter,
      value: r.value || "",
      unit: r.unit || "",
      normalRange: r.normalRange || "",
      isAbnormal: r.isAbnormal || false,
    })),
    reportNotes: o.reportNotes,
    reportFileUrl: o.reportFileUrl || "",
    reportFileName: o.reportFileName || "",
  };
}

const Diagnostics = () => {
  const { data: labTestCatalog = [], isLoading: catalogLoading } = useLabTestCatalog();
  const { data: rawLabOrders = [], isLoading: ordersLoading, refetch: refetchOrders } = useLabOrders();
  const { data: hospitalProfile } = useHospitalProfile();

  const updateStatusMutation = useUpdateLabOrderStatus();
  const updatePaymentMutation = useUpdateLabOrderPayment();
  const saveResultsMutation = useSaveLabResults();
  const createTestMutation = useCreateTestCatalogItem();
  const updateTestMutation = useUpdateTestCatalogItem();
  const deleteTestMutation = useDeleteTestCatalogItem();

  const allLabOrders = useMemo(() => rawLabOrders.map(mapDbOrder), [rawLabOrders]);

  const defaultCategories = ["Blood", "Urine", "Radiology", "Serology"];
  const categoryEmojis: Record<string, string> = { Blood: "🩸", Urine: "🧪", Radiology: "📷", Serology: "🔬" };
  const allCategories = useMemo(() => {
    const fromCatalog = labTestCatalog.map((t: any) => t.category || t.category);
    const fromOrders = rawLabOrders.map((o: any) => o.category);
    const all = new Set([...defaultCategories, ...fromCatalog, ...fromOrders]);
    return Array.from(all).filter(Boolean);
  }, [labTestCatalog, rawLabOrders]);

  const [activeTab, setActiveTab] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Result entry dialog
  const [resultOrder, setResultOrder] = useState<DisplayLabOrder | null>(null);
  const [reportNotes, setReportNotes] = useState("");
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  // Manual parameter values entered by the lab technician (non-radiology)
  const [resultValues, setResultValues] = useState<
    { parameter: string; value: string; unit: string; normalRange: string; isAbnormal: boolean }[]
  >([]);

  // Report view dialog
  const [viewOrder, setViewOrder] = useState<DisplayLabOrder | null>(null);
  const [printOrder, setPrintOrder] = useState<DisplayLabOrder | null>(null);
  const [reportPreview, setReportPreview] = useState<{ url: string; fileName: string; mimeType: string; blob: Blob } | null>(null);
  const [reportPreviewLoading, setReportPreviewLoading] = useState(false);

  // Payment dialog
  const [paymentOrder, setPaymentOrder] = useState<DisplayLabOrder | null>(null);
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Credit">("Cash");

  // Test catalog management
  const [catalogTab, setCatalogTab] = useState<string>("all");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [showAddTest, setShowAddTest] = useState(false);
  const [editTest, setEditTest] = useState<LabTestCatalogItem | null>(null);
  const [testForm, setTestForm] = useState({ name: "", category: "Blood" as string, price: "" });
  const [testParams, setTestParams] = useState<{ name: string; unit: string; ranges: { normalRange: string; sex: string; minAge: number | null; maxAge: string | null }[] }[]>([]);

  const pendingOrders = useMemo(() =>
    allLabOrders.filter((o) => o.status !== "Completed"), [allLabOrders]
  );

  const completedOrders = useMemo(() =>
    allLabOrders.filter((o) => o.status === "Completed"), [allLabOrders]
  );

  const filterOrders = (orders: DisplayLabOrder[]) =>
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
  const handleAcceptOrder = (order: DisplayLabOrder) => {
    if (order.paymentStatus === "Paid") {
      updateStatusMutation.mutate({ id: order.id, status: "Sample Collected" }, {
        onSuccess: () => { toast.success(`Sample collected for ${order.testName} — ${order.patientName}`); refetchOrders(); },
      });
    } else {
      setPaymentOrder(order);
      setPaymentMode("Cash");
    }
  };

  const handleConfirmPayment = () => {
    if (!paymentOrder) return;
    updatePaymentMutation.mutate({ id: paymentOrder.id, paymentMode }, {
      onSuccess: () => {
        toast.success(`Payment ₹${paymentOrder.price} received via ${paymentMode}`);
        updateStatusMutation.mutate({ id: paymentOrder.id, status: "Sample Collected" }, {
          onSuccess: () => { toast.success(`Sample collected for ${paymentOrder.testName}`); refetchOrders(); },
        });
      },
    });
    setPaymentOrder(null);
  };

  const handleStartProcessing = (order: DisplayLabOrder) => {
    updateStatusMutation.mutate({ id: order.id, status: "In Progress" }, {
      onSuccess: () => { toast.success(`Processing started for ${order.testName}`); refetchOrders(); },
    });
  };

  const handleOpenResultEntry = (order: DisplayLabOrder) => {
    setResultOrder(order);
    setReportNotes("");
    setReportFile(null);
    // Pre-fill parameter rows from the test catalog (skip for Radiology — file upload only)
    if (order.category !== "Radiology") {
      const match = (labTestCatalog as any[]).find(
        (t) => t.name?.toLowerCase() === order.testName.toLowerCase()
      );
      const params = (match?.parameters || []) as any[];
      setResultValues(
        params.length
          ? params.map((p) => ({
              parameter: p.name,
              value: "",
              unit: p.unit || "",
              normalRange: p.ranges?.[0]?.normalRange || p.ranges?.[0]?.normal_range || "",
              isAbnormal: false,
            }))
          : [{ parameter: "", value: "", unit: "", normalRange: "", isAbnormal: false }]
      );
    } else {
      setResultValues([]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setReportFile(file);
    e.target.value = "";
  };

  const handleSaveResults = async () => {
    if (!resultOrder) return;
    const isRadiology = resultOrder.category === "Radiology";

    if (isRadiology && !reportFile) {
      toast.error("Please upload a report file");
      return;
    }

    const filledResults = resultValues.filter((r) => r.parameter.trim() && r.value.trim());
    if (!isRadiology && filledResults.length === 0 && !reportFile) {
      toast.error("Enter at least one parameter value or upload a report file");
      return;
    }

    setUploading(true);
    try {
      // Upload to private storage; path begins with lab order id so the
      // storage RLS policy can join lab_orders to enforce hospital isolation.
      let filePath: string | undefined;
      let fileLabel: string | undefined;

      if (reportFile) {
        const safeName = reportFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        filePath = `${resultOrder.id}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("lab-reports")
          .upload(filePath, reportFile);
        if (uploadError) throw uploadError;
        fileLabel = reportFile.name;
      } else if (!isRadiology && filledResults.length > 0) {
        // Auto-generate a PDF report from the entered parameter values
        const pdfBlob = await generateLabReportPdfAsync({
          testName: resultOrder.testName,
          category: resultOrder.category,
          hospital: hospitalProfile,
          config: loadLabReportConfig(),
          patientName: resultOrder.patientName,
          patientRegNo: resultOrder.patientRegNo,
          uhid: resultOrder.patientRegNo,
          reportId: resultOrder.id,
          orderedBy: resultOrder.orderedBy,
          priority: resultOrder.priority,
          orderedAt: resultOrder.orderedAt,
          completedAt: new Date().toLocaleString(),
          price: resultOrder.price,
          paymentStatus: resultOrder.paymentStatus,
          paymentMode: resultOrder.paymentMode,
          department: resultOrder.category,
          reportNotes,
          clinicalNotes: resultOrder.clinicalNotes,
          results: filledResults,
        });
        const fileName = `lab-report-${resultOrder.patientRegNo || resultOrder.id}-${Date.now()}.pdf`;
        filePath = `${resultOrder.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from("lab-reports")
          .upload(filePath, pdfBlob, { contentType: "application/pdf" });
        if (uploadError) throw uploadError;
        fileLabel = fileName;
      }

      // Persist the storage path (not a public URL); viewers create
      // short-lived signed URLs on demand.
      const resultRows = isRadiology
        ? []
        : filledResults.map((r) => ({
            parameter: r.parameter,
            value: r.value,
            unit: r.unit,
            normal_range: r.normalRange,
            is_abnormal: r.isAbnormal,
          }));

      saveResultsMutation.mutate({
        labOrderId: resultOrder.id,
        results: resultRows as any,
        reportNotes: reportNotes ?? "",
        reportFileUrl: filePath,
        reportFileName: fileLabel,
      }, {
        onSuccess: () => {
          toast.success(`Report completed for ${resultOrder.testName} — ${resultOrder.patientName}`);
          setResultOrder(null);
          refetchOrders();
        },
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload report file");
    } finally {
      setUploading(false);
    }
  };

  const handlePrintReport = (order: DisplayLabOrder) => {
    if ((!order.results || order.results.length === 0) && !order.reportNotes) {
      toast.error("No printable lab results available");
      return;
    }

    const clearPrintReport = () => setPrintOrder(null);
    window.addEventListener("afterprint", clearPrintReport, { once: true });

    try {
      flushSync(() => setPrintOrder(order));
      window.print();
    } catch (err: any) {
      window.removeEventListener("afterprint", clearPrintReport);
      clearPrintReport();
      toast.error(err.message || "Unable to open print preview");
    }
  };

  useEffect(() => {
    if (!viewOrder?.reportFileUrl) {
      setReportPreview(null);
      setReportPreviewLoading(false);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    setReportPreview(null);
    setReportPreviewLoading(true);

    resolveLabReportBlob(viewOrder.reportFileUrl)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setReportPreview({
          url: objectUrl,
          fileName: viewOrder.reportFileName || "lab-report.pdf",
          mimeType: blob.type || "application/octet-stream",
          blob,
        });
      })
      .catch((err: any) => {
        if (active) toast.error(err.message || "Unable to load report");
      })
      .finally(() => {
        if (active) setReportPreviewLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [viewOrder?.id, viewOrder?.reportFileUrl, viewOrder?.reportFileName]);

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <FileImage className="h-4 w-4 text-info" />;
    return <FileText className="h-4 w-4 text-warning" />;
  };

  // ─── Test Catalog CRUD ───
  const filteredCatalog = labTestCatalog.filter((t: any) => {
    const matchCat = catalogTab === "all" || t.category === catalogTab;
    const matchSearch = !catalogSearch || t.name.toLowerCase().includes(catalogSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  const openAddTest = () => {
    setTestForm({ name: "", category: "Blood", price: "" });
    setTestParams([{ name: "", unit: "", ranges: [{ normalRange: "", sex: "any", minAge: null, maxAge: null }] }]);
    setEditTest(null);
    setShowAddTest(true);
  };

  const openEditTest = (test: LabTestCatalogItem) => {
    setTestForm({ name: test.name, category: test.category, price: String(test.price) });
    setTestParams(
      (test.parameters || []).length > 0
        ? (test.parameters || []).map((p: any) => ({
            name: p.name, unit: p.unit || "",
            ranges: (p.ranges || []).map((r: any) => ({
              normalRange: r.normalRange || r.normal_range || "", sex: r.sex || "any", minAge: r.minAge ?? null, maxAge: r.maxAge ?? null,
            })),
          }))
        : [{ name: "", unit: "", ranges: [{ normalRange: "", sex: "any", minAge: null, maxAge: null }] }]
    );
    setEditTest(test);
    setShowAddTest(true);
  };

  const addParamRow = () => setTestParams((prev) => [...prev, { name: "", unit: "", ranges: [{ normalRange: "", sex: "any", minAge: null, maxAge: null }] }]);
  const removeParamRow = (idx: number) => setTestParams((prev) => prev.filter((_, i) => i !== idx));
  const updateParamRow = (idx: number, field: string, value: string) => {
    setTestParams((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const handleSaveTest = () => {
    if (!testForm.name.trim()) { toast.error("Test name is required"); return; }
    if (!testForm.price || Number(testForm.price) <= 0) { toast.error("Valid price is required"); return; }
    const validParams = testParams.filter((p) => p.name.trim());
    const paramsSave = validParams.map((p) => ({
      name: p.name, unit: p.unit,
      ranges: p.ranges.filter((r) => r.normalRange.trim()).map((r) => ({
        normal_range: r.normalRange, sex: r.sex || "any", min_age: r.minAge ?? null, max_age: r.maxAge ?? null,
      })),
    }));

    if (editTest) {
      updateTestMutation.mutate({
        id: editTest.id,
        updates: { name: testForm.name, category: testForm.category as any, price: Number(testForm.price) },
        parameters: paramsSave,
      }, {
        onSuccess: () => { toast.success(`Test "${testForm.name}" updated`); setShowAddTest(false); },
        onError: (err: any) => toast.error(err.message || "Failed to update test"),
      });
    } else {
      createTestMutation.mutate({
        item: { name: testForm.name, category: testForm.category as any, price: Number(testForm.price) },
        parameters: paramsSave,
      }, {
        onSuccess: () => { toast.success(`Test "${testForm.name}" added to catalog`); setShowAddTest(false); },
        onError: (err: any) => toast.error(err.message || "Failed to add test"),
      });
    }
  };

  const handleDeleteTest = (test: LabTestCatalogItem) => {
    if (!confirm(`Delete "${test.name}" from catalog?`)) return;
    deleteTestMutation.mutate(test.id, {
      onSuccess: () => toast.success(`"${test.name}" deleted`),
      onError: (err: any) => toast.error(err.message || "Failed to delete test"),
    });
  };

  if (ordersLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto animate-fade-in">
        <div className="text-center py-16 text-muted-foreground">
          <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-30 animate-pulse" />
          <p className="text-sm">Loading diagnostics data...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    {printOrder && <PrintableLabReport order={printOrder} />}
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
            {allCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>{categoryEmojis[cat] ? `${categoryEmojis[cat]} ` : ""}{cat}</SelectItem>
            ))}
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
          <TabsTrigger value="catalog"><Settings2 className="h-4 w-4 mr-1.5" /> Test Catalog ({labTestCatalog.length})</TabsTrigger>
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

        {/* ─── Test Catalog Management ─── */}
        <TabsContent value="catalog">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} placeholder="Search tests..." className="pl-9 h-10" />
            </div>
            <Select value={catalogTab} onValueChange={setCatalogTab}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {allCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{categoryEmojis[cat] ? `${categoryEmojis[cat]} ` : ""}{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={openAddTest}><Plus className="h-3.5 w-3.5 mr-1" /> Add Test</Button>
          </div>

          {catalogLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading catalog...</div>
          ) : filteredCatalog.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No tests in catalog</p>
              <p className="text-xs mt-1">Add tests to make them available for ordering in consultations</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price (₹)</TableHead>
                    <TableHead>Parameters</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCatalog.map((test: any) => (
                    <TableRow key={test.id}>
                      <TableCell className="font-medium text-foreground">{test.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px]", labCategoryColors[test.category])}>{test.category}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">₹{test.price}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(test.parameters || []).length > 0
                          ? (test.parameters || []).map((p: any) => p.name).join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => openEditTest(test)}>
                          <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteTest(test)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
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

              {/* File Upload Section */}
              <div className="space-y-3 border border-border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Upload className="h-4 w-4" /> {resultOrder.category === "Radiology" ? "Upload Report File" : "Upload Report File (optional)"}
                  </Label>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <Button size="sm" variant="outline" asChild>
                      <span><Upload className="h-3.5 w-3.5 mr-1" /> Choose File</span>
                    </Button>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">Accepts PDF, DOC, DOCX, JPG, PNG, WEBP</p>
                {reportFile && (
                  <div className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {getFileIcon(reportFile.type)}
                      <span className="text-sm text-foreground truncate">{reportFile.name}</span>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setReportFile(null)}>
                      <X className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Manual parameter entry (skipped for Radiology) */}
              {resultOrder.category !== "Radiology" && (
                <div className="space-y-2 border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Beaker className="h-4 w-4" /> Test Parameters
                    </Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setResultValues((prev) => [
                          ...prev,
                          { parameter: "", value: "", unit: "", normalRange: "", isAbnormal: false },
                        ])
                      }
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Enter values manually — a PDF report will be generated automatically on save.
                  </p>
                  <div className="grid grid-cols-[1fr_90px_70px_110px_70px_24px] gap-1.5 text-[10px] font-medium text-muted-foreground px-1">
                    <span>Parameter</span><span>Value</span><span>Unit</span><span>Normal Range</span><span>Abnormal</span><span></span>
                  </div>
                  <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                    {resultValues.map((r, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_90px_70px_110px_70px_24px] gap-1.5 items-center">
                        <Input
                          className="h-8 text-xs"
                          placeholder="Parameter"
                          value={r.parameter}
                          onChange={(e) =>
                            setResultValues((prev) => prev.map((p, i) => (i === idx ? { ...p, parameter: e.target.value } : p)))
                          }
                        />
                        <Input
                          className="h-8 text-xs"
                          placeholder="Value"
                          value={r.value}
                          onChange={(e) =>
                            setResultValues((prev) => prev.map((p, i) => (i === idx ? { ...p, value: e.target.value } : p)))
                          }
                        />
                        <Input
                          className="h-8 text-xs"
                          placeholder="Unit"
                          value={r.unit}
                          onChange={(e) =>
                            setResultValues((prev) => prev.map((p, i) => (i === idx ? { ...p, unit: e.target.value } : p)))
                          }
                        />
                        <Input
                          className="h-8 text-xs"
                          placeholder="e.g. 12-17"
                          value={r.normalRange}
                          onChange={(e) =>
                            setResultValues((prev) => prev.map((p, i) => (i === idx ? { ...p, normalRange: e.target.value } : p)))
                          }
                        />
                        <div className="flex items-center justify-center">
                          <Switch
                            checked={r.isAbnormal}
                            onCheckedChange={(v) =>
                              setResultValues((prev) => prev.map((p, i) => (i === idx ? { ...p, isAbnormal: v } : p)))
                            }
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setResultValues((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-destructive/60 hover:text-destructive"
                          aria-label="Remove parameter"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                <Button onClick={handleSaveResults} disabled={saveResultsMutation.isPending || uploading}>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> {uploading ? "Uploading..." : "Save & Complete Report"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Report View Dialog */}
      <Dialog open={!!viewOrder} onOpenChange={(v) => !v && setViewOrder(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          {viewOrder && (
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

              {viewOrder.reportFileUrl && (
                <div className="border border-border rounded-lg p-3 bg-card">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Report File</p>
                    {reportPreview && (
                      <a
                        href={reportPreview.url}
                        download={reportPreview.fileName}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </a>
                    )}
                  </div>

                  {reportPreviewLoading ? (
                    <div className="h-40 rounded-md border border-border bg-muted/40 grid place-items-center text-xs text-muted-foreground">
                      Loading report preview...
                    </div>
                  ) : reportPreview ? (
                    reportPreview.mimeType.includes("pdf") || reportPreview.fileName.toLowerCase().endsWith(".pdf") ? (
                      <PdfBlobPreview blob={reportPreview.blob} />
                    ) : reportPreview.mimeType.startsWith("image/") ? (
                      <img
                        src={reportPreview.url}
                        alt="Lab report preview"
                        className="max-h-[420px] w-full rounded-md border border-border object-contain bg-background"
                      />
                    ) : (
                      <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                        Preview is not available for this file type. Use Download to save the report.
                      </div>
                    )
                  ) : (
                    <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                      Report preview is unavailable.
                    </div>
                  )}
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
                <Button variant="outline" onClick={() => setViewOrder(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Add/Edit Test Dialog ─── */}
      <Dialog open={showAddTest} onOpenChange={setShowAddTest}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              {editTest ? "Edit Test" : "Add New Test"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Test Name *</Label>
              <Input value={testForm.name} onChange={(e) => setTestForm({ ...testForm, name: e.target.value })} placeholder="e.g. Complete Blood Count (CBC)" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Category *</Label>
                <Select value={testForm.category} onValueChange={(v) => setTestForm({ ...testForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{categoryEmojis[cat] ? `${categoryEmojis[cat]} ` : ""}{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Price (₹) *</Label>
                <Input type="number" value={testForm.price} onChange={(e) => setTestForm({ ...testForm, price: e.target.value })} placeholder="350" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Parameters</Label>
                <Button size="sm" variant="outline" onClick={addParamRow}><Plus className="h-3.5 w-3.5 mr-1" /> Add</Button>
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {testParams.map((p, idx) => (
                  <div key={idx} className="border border-border rounded-md p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={p.name} onChange={(e) => updateParamRow(idx, "name", e.target.value)} placeholder="Parameter name" className="text-sm flex-1" />
                      <Input value={p.unit} onChange={(e) => updateParamRow(idx, "unit", e.target.value)} placeholder="Unit" className="text-sm w-20" />
                      {testParams.length > 1 && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeParamRow(idx)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="pl-2 border-l-2 border-primary/20 space-y-1">
                      <div className="grid grid-cols-[1fr_70px_55px_55px_24px] gap-1 text-[10px] font-medium text-muted-foreground">
                        <span>Normal Range</span><span>Sex</span><span>Min Age</span><span>Max Age</span><span></span>
                      </div>
                      {p.ranges.map((r, ri) => (
                        <div key={ri} className="grid grid-cols-[1fr_70px_55px_55px_24px] gap-1 items-center">
                          <Input className="h-6 text-xs" placeholder="e.g. 12-17" value={r.normalRange} onChange={(e) => {
                            const next = [...testParams]; const ranges = [...next[idx].ranges]; ranges[ri] = { ...ranges[ri], normalRange: e.target.value }; next[idx] = { ...next[idx], ranges }; setTestParams(next);
                          }} />
                          <select className="h-6 text-xs border border-input rounded bg-background px-1" value={r.sex} onChange={(e) => {
                            const next = [...testParams]; const ranges = [...next[idx].ranges]; ranges[ri] = { ...ranges[ri], sex: e.target.value }; next[idx] = { ...next[idx], ranges }; setTestParams(next);
                          }}>
                            <option value="any">Any</option><option value="male">Male</option><option value="female">Female</option>
                          </select>
                          <Input className="h-6 text-xs" type="number" placeholder="Min" value={r.minAge ?? ""} onChange={(e) => {
                            const next = [...testParams]; const ranges = [...next[idx].ranges]; ranges[ri] = { ...ranges[ri], minAge: e.target.value ? Number(e.target.value) : null }; next[idx] = { ...next[idx], ranges }; setTestParams(next);
                          }} />
                          <Input className="h-6 text-xs" placeholder="Max" value={r.maxAge ?? ""} onChange={(e) => {
                            const next = [...testParams]; const ranges = [...next[idx].ranges]; ranges[ri] = { ...ranges[ri], maxAge: e.target.value || null }; next[idx] = { ...next[idx], ranges }; setTestParams(next);
                          }} />
                          {p.ranges.length > 1 && (
                            <button type="button" onClick={() => { const next = [...testParams]; next[idx] = { ...next[idx], ranges: next[idx].ranges.filter((_, j) => j !== ri) }; setTestParams(next); }} className="text-destructive/60 hover:text-destructive"><X className="h-3 w-3" /></button>
                          )}
                        </div>
                      ))}
                      <button type="button" className="text-[10px] text-primary hover:underline" onClick={() => {
                        const next = [...testParams]; next[idx] = { ...next[idx], ranges: [...next[idx].ranges, { normalRange: "", sex: "any", minAge: null, maxAge: null }] }; setTestParams(next);
                      }}>+ Add Range</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTest(false)}>Cancel</Button>
            <Button onClick={handleSaveTest} disabled={createTestMutation.isPending || updateTestMutation.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> {editTest ? "Update Test" : "Add Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
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

const PdfBlobPreview = ({ blob }: { blob: Blob }) => {
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const renderedUrls: string[] = [];

    const renderPdf = async () => {
      setLoading(true);
      setError(null);
      setPages([]);

      try {
        const data = await blob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        const nextPages: string[] = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) return;

          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.45 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          if (!context) throw new Error("Unable to render report preview");

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);

          await page.render({ canvas, canvasContext: context, viewport }).promise;

          const imageBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
          if (!imageBlob) throw new Error("Unable to render report preview");

          const pageUrl = URL.createObjectURL(imageBlob);
          renderedUrls.push(pageUrl);
          nextPages.push(pageUrl);
          if (!cancelled) setPages([...nextPages]);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Unable to render report preview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    renderPdf();

    return () => {
      cancelled = true;
      renderedUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [blob]);

  if (loading && pages.length === 0) {
    return (
      <div className="h-40 rounded-md border border-border bg-muted/40 grid place-items-center text-xs text-muted-foreground">
        Rendering PDF preview...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        {error}. Use Download to save the report.
      </div>
    );
  }

  return (
    <div className="max-h-[520px] overflow-y-auto rounded-md border border-border bg-muted/40 p-3 space-y-3">
      {pages.map((pageUrl, index) => (
        <img
          key={pageUrl}
          src={pageUrl}
          alt={`Lab report page ${index + 1}`}
          loading="lazy"
          className="mx-auto w-full max-w-[760px] rounded-sm border border-border bg-background shadow-sm"
        />
      ))}
      {loading && <p className="text-center text-xs text-muted-foreground">Rendering remaining pages...</p>}
    </div>
  );
};

const PrintableLabReport = ({ order }: { order: DisplayLabOrder }) => (
  <section className="diagnostics-print-root" aria-hidden="true">
    <header className="diagnostics-print-header">
      <h1>EzyOp Diagnostics</h1>
      <p>Laboratory Report</p>
    </header>

    <div className="diagnostics-print-meta">
      <div><span>Patient</span><strong>{order.patientName}</strong></div>
      <div><span>Reg No</span><strong>{order.patientRegNo}</strong></div>
      <div><span>Test</span><strong>{order.testName}</strong></div>
      <div><span>Category</span><strong>{order.category}</strong></div>
      <div><span>Ordered By</span><strong>{order.orderedBy}</strong></div>
      <div><span>Priority</span><strong>{order.priority}</strong></div>
      <div><span>Ordered At</span><strong>{order.orderedAt || "—"}</strong></div>
      <div><span>Completed At</span><strong>{order.completedAt || "—"}</strong></div>
      <div><span>Amount</span><strong>₹{order.price}</strong></div>
      <div><span>Payment</span><strong>{order.paymentStatus || "—"}{order.paymentMode ? ` (${order.paymentMode})` : ""}</strong></div>
    </div>

    {order.results && order.results.length > 0 && (
      <table className="diagnostics-print-table">
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Value</th>
            <th>Unit</th>
            <th>Normal Range</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {order.results.map((result, index) => (
            <tr key={`${result.parameter}-${index}`}>
              <td>{result.parameter}</td>
              <td className={result.isAbnormal ? "diagnostics-print-abnormal" : undefined}>{result.value}</td>
              <td>{result.unit || "—"}</td>
              <td>{result.normalRange || "—"}</td>
              <td className={result.isAbnormal ? "diagnostics-print-abnormal" : undefined}>{result.isAbnormal ? "ABNORMAL" : "Normal"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}

    {order.reportNotes && (
      <div className="diagnostics-print-note">
        <h2>Remarks</h2>
        <p>{order.reportNotes}</p>
      </div>
    )}

    {order.clinicalNotes && (
      <div className="diagnostics-print-note">
        <h2>Clinical Notes</h2>
        <p>{order.clinicalNotes}</p>
      </div>
    )}

    <footer className="diagnostics-print-footer">
      <span>Lab Technician: ___________________</span>
      <span>Date: {new Date().toLocaleDateString("en-GB")}</span>
    </footer>
  </section>
);

export default Diagnostics;
