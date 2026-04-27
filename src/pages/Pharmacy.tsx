import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Pill, Search, ShoppingCart, Plus, Minus, Trash2, CreditCard,
  Banknote, FileText, User, Package, Printer, CheckCircle2, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type ClinicPatient } from "@/data/mockClinicData";
import {
  sampleDoctorPrescriptions,
  type Medicine, type PharmacyOrderItem,
} from "@/data/mockPharmacyData";
import { usePatients } from "@/modules/patients/hooks";
import { useMedicines } from "@/modules/pharmacy/hooks";
import { pharmacyService } from "@/modules/pharmacy/services";
import { useAuth } from "@/contexts/AuthContext";

type IssueType = "Direct Sale" | "IP Sale" | "IP Return" | "OP Sale" | "OP Return";
type OrderSource = "doctor" | "manual" | null;

const Pharmacy = () => {
  const { roles } = useAuth();
  const hospitalId = roles?.[0]?.hospital_id || "";
  const { data: dbPatients } = usePatients();
  const { data: dbMedicines, refetch: refetchMedicines } = useMedicines();

  const allPatients: ClinicPatient[] = useMemo(() =>
    (dbPatients || []).map((p: any) => ({
      id: p.id, registrationNumber: p.registrationNumber, name: p.name,
      mobile: p.mobile, gender: p.gender || "Male",
      age: p.dob ? Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0,
      lastVisit: "", totalVisits: 0, doctor: "", diagnosis: "", visitHistory: [],
    })),
  [dbPatients]);

  const allMedicines: Medicine[] = useMemo(() =>
    (dbMedicines || []).map((m: any) => ({
      id: m.id, name: m.name, genericName: m.genericName || "",
      category: m.category || "", manufacturer: m.manufacturer || "",
      batchNo: m.batchNo || "", expiryDate: m.expiryDate || "",
      mrp: m.mrp || 0, stock: m.stock || 0, unit: m.unit || "",
      hsnCode: m.hsnCode || "", gstPercent: m.gstPercent ?? 12,
    })),
  [dbMedicines]);

  const [issueType, setIssueType] = useState<IssueType>("OP Sale");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<ClinicPatient | null>(null);
  const [orderSource, setOrderSource] = useState<OrderSource>(null);
  const [orderItems, setOrderItems] = useState<PharmacyOrderItem[]>([]);
  const [medicineSearch, setMedicineSearch] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Credit" | "">("");
  const [orderCompleted, setOrderCompleted] = useState(false);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [directCustomer, setDirectCustomer] = useState({ name: "", mobile: "" });

  // Search patients
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allPatients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.registrationNumber.toLowerCase().includes(q) ||
        p.mobile.includes(q)
    );
  }, [searchQuery, allPatients]);

  // Doctor prescription for selected patient
  const doctorPrescription = useMemo(() => {
    if (!selectedPatient) return null;
    return sampleDoctorPrescriptions.find(
      (p) => p.patientRegNo === selectedPatient.registrationNumber
    ) ?? null;
  }, [selectedPatient]);

  // Filtered medicines for manual add
  const filteredMedicines = useMemo(() => {
    if (!medicineSearch.trim()) return allMedicines;
    const q = medicineSearch.toLowerCase();
    return allMedicines.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.genericName || "").toLowerCase().includes(q) ||
        (m.category || "").toLowerCase().includes(q)
    );
  }, [medicineSearch, allMedicines]);

  // Calculations
  const isReturn = issueType.includes("Return");
  const isIP = issueType.startsWith("IP");
  const isDirectSale = issueType === "Direct Sale";
  const activeCustomerName = isDirectSale ? directCustomer.name.trim() || "Walk-in Customer" : selectedPatient?.name || "";
  const activeCustomerMobile = isDirectSale ? directCustomer.mobile.trim() : selectedPatient?.mobile || "";
  const activeRegistration = isDirectSale ? "Direct Sale" : selectedPatient?.registrationNumber || "";

  const subtotal = orderItems.reduce((s, i) => s + i.amount, 0);
  const gstAmount = orderItems.reduce(
    (s, i) => s + (i.amount * i.gstPercent) / 100,
    0
  );
  const discountAmount = (subtotal * globalDiscount) / 100;
  const netAmount = subtotal + gstAmount - discountAmount;

  const handleSelectPatient = (patient: ClinicPatient) => {
    setSelectedPatient(patient);
    setSearchQuery("");
    setOrderSource(null);
    setOrderItems([]);
    setShowPayment(false);
    setOrderCompleted(false);
    setPaymentMode("");
    setGlobalDiscount(0);
  };

  const handleLoadDoctorOrder = () => {
    if (!doctorPrescription) return;
    const items: PharmacyOrderItem[] = doctorPrescription.items.map((pi) => {
      const med = allMedicines.find((m) => m.name === pi.medicineName);
      return {
        medicineId: med?.id ?? "",
        medicineName: pi.medicineName,
        batchNo: med?.batchNo ?? "",
        quantity: pi.quantity,
        mrp: med?.mrp ?? 0,
        discount: 0,
        gstPercent: med?.gstPercent ?? 12,
        amount: (med?.mrp ?? 0) * pi.quantity,
      };
    });
    setOrderItems(items);
    setOrderSource("doctor");
    toast.success("Doctor's prescription loaded");
  };

  const handleNewOrder = () => {
    setOrderItems([]);
    setOrderSource("manual");
  };

  const handleStartDirectSale = () => {
    setSelectedPatient(null);
    setSearchQuery("");
    setOrderItems([]);
    setOrderSource("manual");
    setShowPayment(false);
    setOrderCompleted(false);
    setPaymentMode("Cash");
    setGlobalDiscount(0);
    setDirectCustomer({ name: "", mobile: "" });
  };

  const addMedicine = (med: Medicine) => {
    const existing = orderItems.find((i) => i.medicineId === med.id);
    if (existing) {
      setOrderItems((prev) =>
        prev.map((i) =>
          i.medicineId === med.id
            ? { ...i, quantity: i.quantity + 1, amount: i.mrp * (i.quantity + 1) }
            : i
        )
      );
    } else {
      setOrderItems((prev) => [
        ...prev,
        {
          medicineId: med.id,
          medicineName: med.name,
          batchNo: med.batchNo,
          quantity: 1,
          mrp: med.mrp,
          discount: 0,
          gstPercent: med.gstPercent,
          amount: med.mrp,
        },
      ]);
    }
  };

  const updateItemQty = (medId: string, delta: number) => {
    setOrderItems((prev) =>
      prev
        .map((i) =>
          i.medicineId === medId
            ? { ...i, quantity: Math.max(0, i.quantity + delta), amount: i.mrp * Math.max(0, i.quantity + delta) }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (medId: string) => {
    setOrderItems((prev) => prev.filter((i) => i.medicineId !== medId));
  };

  const handleProceedToPayment = () => {
    if (isDirectSale && !directCustomer.name.trim()) {
      toast.error("Please enter customer name");
      return;
    }
    if (orderItems.length === 0) {
      toast.error("Add at least one medicine");
      return;
    }
    setShowPayment(true);
  };

  const handleCompleteOrder = async () => {
    if (isDirectSale && !directCustomer.name.trim()) {
      toast.error("Please enter customer name");
      return;
    }
    if ((isIP || isDirectSale) && !paymentMode) {
      toast.error("Please select a payment mode");
      return;
    }
    const finalPaymentMode = isIP || isDirectSale ? paymentMode : "Cash";
    const customerName = isDirectSale ? directCustomer.name.trim() : selectedPatient?.name || "";
    try {
      await pharmacyService.completeSale(
        {
          patient_name: customerName, registration_number: selectedPatient?.registrationNumber || "",
          customer_name: customerName, customer_mobile: isDirectSale ? directCustomer.mobile.trim() : selectedPatient?.mobile || "",
          sale_channel: isDirectSale ? "Direct" : "Patient",
          doctor_name: doctorPrescription?.doctorName || "", issue_type: isDirectSale ? "OP Sale" : issueType, issue_date: new Date().toISOString().split("T")[0],
          age: selectedPatient?.age || null, gender: selectedPatient?.gender || "", mobile: isDirectSale ? directCustomer.mobile.trim() : selectedPatient?.mobile || "",
          total_amount: subtotal, discount: discountAmount, gst_amount: gstAmount, net_amount: netAmount,
          payment_mode: finalPaymentMode, status: "Completed",
        } as any,
        orderItems.map((i) => ({
          medicine_id: i.medicineId || null, medicine_name: i.medicineName, batch_no: i.batchNo,
          quantity: i.quantity, mrp: i.mrp, discount: i.discount, gst_percent: i.gstPercent, amount: i.amount,
          hospital_id: hospitalId,
        } as any))
      );
      await refetchMedicines();
      setOrderCompleted(true);
      toast.success(
        isReturn
          ? `${issueType} processed — ₹${netAmount.toFixed(2)} refunded`
          : `${issueType} completed — ₹${netAmount.toFixed(2)} (${finalPaymentMode})`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to complete order");
    }
  };

  const handleNewTransaction = () => {
    setSelectedPatient(null);
    setOrderSource(null);
    setOrderItems([]);
    setShowPayment(false);
    setOrderCompleted(false);
    setPaymentMode("");
    setSearchQuery("");
    setGlobalDiscount(0);
    setDirectCustomer({ name: "", mobile: "" });
  };

  const handlePrintReceipt = () => {
    const pw = window.open("", "_blank");
    if (!pw) return;
    pw.document.write(`
      <html><head><title>${issueType} Receipt – ${selectedPatient.name}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; max-width: 700px; margin: auto; font-size: 13px; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 16px; }
        .header h1 { font-size: 18px; margin: 0; } .header p { margin: 2px 0; color: #666; font-size: 11px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #f5f5f5; font-size: 12px; }
        .totals { text-align: right; margin-top: 12px; } .totals p { margin: 4px 0; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #888; }
        @media print { body { padding: 16px; } }
      </style></head><body>
      <div class="header"><h1>EzyOp Pharmacy</h1><p>${issueType} Receipt</p></div>
      <div class="info-row">
        <div><strong>Customer:</strong> ${activeCustomerName}<br/><strong>Ref:</strong> ${activeRegistration}<br/><strong>Mobile:</strong> ${activeCustomerMobile || "—"}</div>
        <div><strong>Date:</strong> ${format(new Date(), "dd/MM/yyyy HH:mm")}<br/><strong>Doctor:</strong> ${selectedPatient?.doctor || "—"}<br/><strong>Age/Gender:</strong> ${selectedPatient ? `${selectedPatient.age}/${selectedPatient.gender}` : "—"}</div>
      </div>
      <table><thead><tr><th>#</th><th>Medicine</th><th>Batch</th><th>Qty</th><th>MRP (₹)</th><th>GST%</th><th>Amount (₹)</th></tr></thead>
      <tbody>${orderItems.map((i, idx) => `<tr><td>${idx + 1}</td><td>${i.medicineName}</td><td>${i.batchNo}</td><td>${i.quantity}</td><td>${i.mrp.toFixed(2)}</td><td>${i.gstPercent}%</td><td>${i.amount.toFixed(2)}</td></tr>`).join("")}</tbody></table>
      <div class="totals">
        <p>Subtotal: ₹${subtotal.toFixed(2)}</p>
        <p>GST: ₹${gstAmount.toFixed(2)}</p>
        ${globalDiscount > 0 ? `<p>Discount (${globalDiscount}%): -₹${discountAmount.toFixed(2)}</p>` : ""}
        <p><strong>Net Amount: ₹${netAmount.toFixed(2)}</strong></p>
        <p>Payment: ${isIP || isDirectSale ? paymentMode : "Cash"}</p>
      </div>
      <div class="footer"><p>Thank you – Get well soon!</p></div>
      </body></html>
    `);
    pw.document.close();
    pw.print();
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
          <Pill className="h-5 w-5 text-primary" /> Pharmacy
        </h1>
        <p className="text-sm text-muted-foreground">Issue medicines, process prescriptions & manage returns</p>
      </div>

      {/* Issue Type Selector */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {(["Direct Sale", "IP Sale", "IP Return", "OP Sale", "OP Return"] as IssueType[]).map((type) => {
          const isActive = issueType === type;
          const isReturnType = type.includes("Return");
          const isDirectType = type === "Direct Sale";
          return (
            <button
              key={type}
              onClick={() => { setIssueType(type); type === "Direct Sale" ? handleStartDirectSale() : handleNewTransaction(); }}
              className={cn(
                "rounded-xl border-2 p-4 text-center transition-all font-medium text-sm min-h-28",
                isActive
                  ? isDirectType
                    ? "border-success bg-success/5 text-success"
                    : isReturnType
                    ? "border-destructive bg-destructive/5 text-destructive"
                    : "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
              )}
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                {isReturnType ? <Package className="h-4 w-4" /> : isDirectType ? <Banknote className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                {type}
              </div>
              <p className="text-xs opacity-70">
                {type === "Direct Sale" && "Walk-in pharmacy counter sale"}
                {type === "IP Sale" && "In-Patient Medicine Issue"}
                {type === "IP Return" && "In-Patient Medicine Return"}
                {type === "OP Sale" && "Out-Patient Medicine Issue"}
                {type === "OP Return" && "Out-Patient Medicine Return"}
              </p>
            </button>
          );
        })}
      </div>

      {isDirectSale && !orderCompleted && (
        <div className="bg-card rounded-xl border border-border p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Banknote className="h-4 w-4 text-success" />
            <h2 className="font-semibold text-sm text-foreground">Direct Counter Sale</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm mb-2 block">Customer Name</Label>
              <Input value={directCustomer.name} onChange={(e) => setDirectCustomer((prev) => ({ ...prev, name: e.target.value }))} placeholder="Enter customer name" required maxLength={100} />
            </div>
            <div>
              <Label className="text-sm mb-2 block">Mobile (optional)</Label>
              <Input value={directCustomer.mobile} onChange={(e) => setDirectCustomer((prev) => ({ ...prev, mobile: e.target.value }))} placeholder="Customer mobile" />
            </div>
          </div>
        </div>
      )}

      {/* Patient Search */}
      {!selectedPatient && !isDirectSale && (
        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <Label className="text-sm font-medium text-foreground mb-2 block">Search Patient</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by mobile, registration no, or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 border border-border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectPatient(p)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left border-b border-border last:border-b-0"
                >
                  <div>
                    <p className="font-medium text-sm text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.registrationNumber} · {p.mobile}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-xs">{p.gender}, {p.age}y</Badge>
                    <p className="text-xs text-muted-foreground mt-1">Dr. {p.doctor.replace("Dr. ", "")}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {searchQuery.length >= 2 && searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground mt-3 text-center py-4">No patients found</p>
          )}
        </div>
      )}

      {/* Patient Header */}
      {(selectedPatient || isDirectSale) && !orderCompleted && (
        <>
          {selectedPatient && <div className="bg-card rounded-xl border border-border p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground text-sm">Patient Details</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleNewTransaction} className="text-xs">Change Patient</Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: "Reg No", value: selectedPatient.registrationNumber },
                { label: "Name", value: selectedPatient.name },
                { label: "Age", value: `${selectedPatient.age} yrs` },
                { label: "Gender", value: selectedPatient.gender },
                { label: "Issue Date", value: format(new Date(), "dd/MM/yyyy") },
                { label: "Mobile", value: selectedPatient.mobile },
                { label: "Doctor", value: selectedPatient.doctor },
              ].map((f) => (
                <div key={f.label}>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{f.label}</p>
                  <p className="text-sm font-medium text-foreground truncate">{f.value}</p>
                </div>
              ))}
            </div>
          </div>}

          {/* Order Source Selection */}
          {orderSource === null && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <h3 className="font-medium text-foreground text-sm mb-4">How would you like to create the order?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={handleLoadDoctorOrder}
                  disabled={!doctorPrescription}
                  className={cn(
                    "rounded-xl border-2 p-5 text-left transition-all",
                    doctorPrescription
                      ? "border-primary/30 hover:border-primary bg-primary/5 cursor-pointer"
                      : "border-border bg-muted/30 cursor-not-allowed opacity-50"
                  )}
                >
                  <ClipboardList className="h-5 w-5 text-primary mb-2" />
                  <p className="font-medium text-sm text-foreground">Load Doctor's Prescription</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {doctorPrescription
                      ? `${doctorPrescription.items.length} items prescribed by ${doctorPrescription.doctorName}`
                      : "No prescription available for this patient"}
                  </p>
                </button>
                <button
                  onClick={handleNewOrder}
                  className="rounded-xl border-2 border-info/30 hover:border-info bg-info/5 p-5 text-left transition-all cursor-pointer"
                >
                  <Plus className="h-5 w-5 text-info mb-2" />
                  <p className="font-medium text-sm text-foreground">Create New Order</p>
                  <p className="text-xs text-muted-foreground mt-1">Manually select medicines from inventory</p>
                </button>
              </div>
            </div>
          )}

          {/* Order Items */}
          {orderSource !== null && !showPayment && (
            <div className="space-y-4 mb-6">
              {/* Medicine Selector */}
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium text-foreground">Add Medicines</Label>
                  {orderSource === "doctor" && (
                    <Badge variant="outline" className="text-xs">Loaded from prescription</Badge>
                  )}
                </div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search medicines by name, generic name, or category..."
                    value={medicineSearch}
                    onChange={(e) => setMedicineSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {medicineSearch.trim() && (
                  <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
                    {filteredMedicines.map((med) => {
                      const inCart = orderItems.find((i) => i.medicineId === med.id);
                      return (
                        <button
                          key={med.id}
                          onClick={() => addMedicine(med)}
                          className="w-full flex items-center justify-between p-2.5 hover:bg-muted/50 transition-colors text-left border-b border-border last:border-b-0"
                        >
                          <div>
                            <p className="text-sm font-medium text-foreground">{med.name}</p>
                            <p className="text-xs text-muted-foreground">{med.genericName} · {med.category} · Batch: {med.batchNo}</p>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground">₹{med.mrp}</p>
                              <p className="text-xs text-muted-foreground">Stock: {med.stock}</p>
                            </div>
                            {inCart ? (
                              <Badge className="bg-primary/10 text-primary border-primary/20">{inCart.quantity} added</Badge>
                            ) : (
                              <Plus className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                    {filteredMedicines.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No medicines found</p>
                    )}
                  </div>
                )}
              </div>

              {/* Cart Table */}
              {orderItems.length > 0 && (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <h3 className="font-medium text-foreground text-sm flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" /> Order Items ({orderItems.length})
                    </h3>
                    {isReturn && <Badge variant="outline" className="text-destructive border-destructive/20">Return</Badge>}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Medicine</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">MRP (₹)</TableHead>
                        <TableHead className="text-right">GST%</TableHead>
                        <TableHead className="text-right">Amount (₹)</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItems.map((item, idx) => (
                        <TableRow key={item.medicineId}>
                          <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                          <TableCell className="font-medium text-sm">{item.medicineName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.batchNo}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateItemQty(item.medicineId, -1)}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateItemQty(item.medicineId, 1)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm">₹{item.mrp.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs">{item.gstPercent}%</TableCell>
                          <TableCell className="text-right font-semibold text-sm">₹{item.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeItem(item.medicineId)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Totals */}
                  <div className="border-t border-border p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <Label className="text-sm">Discount %</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={globalDiscount}
                          onChange={(e) => setGlobalDiscount(Number(e.target.value))}
                          className="w-20 h-8 text-sm"
                        />
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-sm text-muted-foreground">Subtotal: <span className="text-foreground font-medium">₹{subtotal.toFixed(2)}</span></p>
                        <p className="text-sm text-muted-foreground">GST: <span className="text-foreground font-medium">₹{gstAmount.toFixed(2)}</span></p>
                        {globalDiscount > 0 && (
                          <p className="text-sm text-success">Discount ({globalDiscount}%): <span className="font-medium">-₹{discountAmount.toFixed(2)}</span></p>
                        )}
                        <p className="text-base font-bold text-foreground border-t border-border pt-1 mt-1">
                          {isReturn ? "Refund" : "Net"}: ₹{netAmount.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button onClick={handleProceedToPayment} className="gap-2">
                        <CreditCard className="h-4 w-4" /> Proceed to {isReturn ? "Refund" : "Payment"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment Dialog */}
          <Dialog open={showPayment && !orderCompleted} onOpenChange={(open) => { if (!open) setShowPayment(false); }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  {isReturn ? "Process Refund" : "Payment"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{isDirectSale ? "Customer" : "Patient"}</span>
                    <span className="font-medium text-foreground">{activeCustomerName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Items</span>
                    <span className="font-medium text-foreground">{orderItems.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">GST</span>
                    <span className="text-foreground">₹{gstAmount.toFixed(2)}</span>
                  </div>
                  {globalDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-success">-₹{discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold border-t border-border pt-2 mt-2">
                    <span>{isReturn ? "Refund Amount" : "Total"}</span>
                    <span className="text-primary">₹{netAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment Mode */}
                {isIP || isDirectSale ? (
                  <div>
                    <Label className="text-sm mb-2 block">Payment Mode</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setPaymentMode("Cash")}
                        className={cn(
                          "rounded-lg border-2 p-4 text-center transition-all",
                          paymentMode === "Cash"
                            ? "border-success bg-success/5 text-success"
                            : "border-border hover:border-muted-foreground/40"
                        )}
                      >
                        <Banknote className="h-5 w-5 mx-auto mb-1" />
                        <p className="text-sm font-medium">Cash</p>
                      </button>
                      <button
                        onClick={() => setPaymentMode("Credit")}
                        className={cn(
                          "rounded-lg border-2 p-4 text-center transition-all",
                          paymentMode === "Credit"
                            ? "border-info bg-info/5 text-info"
                            : "border-border hover:border-muted-foreground/40"
                        )}
                      >
                        <CreditCard className="h-5 w-5 mx-auto mb-1" />
                        <p className="text-sm font-medium">Credit</p>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-success/5 border border-success/20 rounded-lg p-3 flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-success" />
                    <span className="text-sm text-foreground">OP transactions are processed as <strong>Cash</strong></span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
                <Button onClick={handleCompleteOrder} disabled={isIP && !paymentMode} className="gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {isReturn ? "Process Refund" : "Complete Payment"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Order Completed */}
      {orderCompleted && (selectedPatient || isDirectSale) && (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-1">
            {isReturn ? "Return Processed" : "Payment Successful"}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {issueType} for {activeCustomerName} ({activeRegistration})
          </p>
          <div className="inline-block bg-muted/50 rounded-lg px-6 py-3 mb-6">
            <p className="text-2xl font-bold text-primary">₹{netAmount.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{isIP || isDirectSale ? paymentMode : "Cash"} · {orderItems.length} items</p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={handlePrintReceipt} className="gap-2">
              <Printer className="h-4 w-4" /> Print Receipt
            </Button>
            <Button onClick={handleNewTransaction} className="gap-2">
              <Plus className="h-4 w-4" /> New Transaction
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pharmacy;
