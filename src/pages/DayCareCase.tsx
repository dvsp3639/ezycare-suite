import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateInput } from "@/components/ui/date-input";
import { SearchSelect } from "@/components/daycare/SearchSelect";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Trash2, Plus, Play, Receipt, LogOut, Printer, Download, CheckCircle2, Clock,
} from "lucide-react";
import { istDisplayDate, istDisplayDateTime, istTimeStr } from "@/lib/datetime";
import { escapeHtml } from "@/lib/escapeHtml";
import { buildLetterhead } from "@/lib/letterhead";
import { useHospitalProfile } from "@/modules/diagnostics/useHospitalProfile";
import { useDayCareCase, useDayCareCaseMutations, useDayCareTreatments } from "@/modules/daycare/hooks";
import { daycareCaseService } from "@/modules/daycare/services";
import { useMedicines } from "@/modules/pharmacy/hooks";
import { pharmacyService } from "@/modules/pharmacy/services";
import { useInventoryItems } from "@/modules/inventory/hooks";
import { inventoryService } from "@/modules/inventory/services";
import { useLabTestCatalog } from "@/modules/diagnostics/hooks";
import { statusBadge } from "./DayCare";

const num = (v: any) => Number(v || 0);

const DayCareCase = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: caseData, isLoading } = useDayCareCase(id);
  const { addItem, deleteItem, updateCase, logEvent, invalidate } = useDayCareCaseMutations(id);
  const { data: hospitalProfile } = useHospitalProfile();

  const { data: procedures = [] } = useDayCareTreatments();
  const { data: medicines = [] } = useMedicines();
  const { data: inventory = [] } = useInventoryItems();
  const { data: labTests = [] } = useLabTestCatalog();

  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState(false);

  const items = (caseData?.items || []) as any[];
  const byType = (t: string) => items.filter((i) => i.item_type === t);

  const consumables = useMemo(
    () => (inventory as any[]).filter((i) => ["Consumables", "Surgical Items"].includes(i.category)),
    [inventory],
  );

  /* ── Overview state ── */
  const [vitals, setVitals] = useState<any>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const v = vitals ?? (caseData?.vitals || {});
  const notesVal = notes ?? (caseData?.notes || "");
  const diagVal = diagnosis ?? (caseData?.diagnosis || "");

  /* ── Billing state ── */
  const [discount, setDiscount] = useState<number | null>(null);
  const [tax, setTax] = useState<number | null>(null);
  const [doctorCharge, setDoctorCharge] = useState<number | null>(null);
  const [nursingCharge, setNursingCharge] = useState<number | null>(null);
  const [paymentMode, setPaymentMode] = useState("Cash");

  const discountVal = discount ?? num(caseData?.bill?.discount);
  const taxVal = tax ?? num(caseData?.bill?.tax);
  const docChargeVal = doctorCharge ?? num((caseData as any)?.doctor_charge);
  const nurseChargeVal = nursingCharge ?? num((caseData as any)?.nursing_charge);

  const billLines = useMemo(() => {
    const lines = items.map((i) => ({
      description: i.name,
      category:
        i.item_type === "procedure" ? "Treatment"
        : i.item_type === "medicine" ? "Medicine"
        : i.item_type === "consumable" ? "Consumable" : "Investigation",
      qty: num(i.qty) || 1,
      unit_price: num(i.unit_price),
      total: num(i.total),
    }));
    if (docChargeVal > 0) lines.push({ description: "Doctor Charges", category: "Other", qty: 1, unit_price: docChargeVal, total: docChargeVal });
    if (nurseChargeVal > 0) lines.push({ description: "Nursing Charges", category: "Other", qty: 1, unit_price: nurseChargeVal, total: nurseChargeVal });
    return lines;
  }, [items, docChargeVal, nurseChargeVal]);

  const subtotal = billLines.reduce((s, l) => s + l.total, 0);
  const grandTotal = Math.max(0, subtotal - discountVal + taxVal);

  /* ── Discharge state ── */
  const [dis, setDis] = useState<any>(null);
  const d = dis ?? {
    final_diagnosis: (caseData as any)?.final_diagnosis || "",
    doctor_advice: (caseData as any)?.doctor_advice || "",
    discharge_medicines: (caseData as any)?.discharge_medicines || "",
    followup_date: (caseData as any)?.followup_date || "",
    discharge_instructions: (caseData as any)?.discharge_instructions || "",
  };

  /* ── Item add forms ── */
  const [proc, setProc] = useState({ id: "", name: "", qty: 1, price: 0, doctor: "", status: "Pending" });
  const [med, setMed] = useState({ id: "", name: "", qty: 1, price: 0, dosage: "", frequency: "", duration: "" });
  const [con, setCon] = useState({ id: "", name: "", qty: 1, price: 0 });
  const [inv, setInv] = useState({ id: "", name: "", qty: 1, price: 0 });

  const guard = async (fn: () => Promise<void>, okMsg?: string) => {
    setBusy(true);
    try {
      await fn();
      if (okMsg) toast({ title: okMsg });
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading case…</p>;
  if (!caseData) return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => navigate("/day-care")}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
      <p className="text-sm text-muted-foreground">Case not found.</p>
    </div>
  );

  const status = caseData.status === "In Progress" ? "Under Treatment" : caseData.status;
  const billed = caseData.bill?.payment_status === "Paid";

  const collectPayment = () => guard(async () => {
    await daycareCaseService.saveBill(id, {
      subtotal, discount: discountVal, tax: taxVal, grand_total: grandTotal,
      payment_status: "Paid", payment_mode: paymentMode,
    }, billLines);
    // Auto-deduct stock once payment is confirmed
    for (const m of byType("medicine")) {
      if (m.ref_id) await pharmacyService.updateMedicineStock(m.ref_id, -num(m.qty)).catch(() => {});
    }
    for (const c of byType("consumable")) {
      if (!c.ref_id) continue;
      const src = (inventory as any[]).find((i) => i.id === c.ref_id);
      if (src) await inventoryService.updateItem(c.ref_id, { stock: Math.max(0, num(src.stock) - num(c.qty)) } as any).catch(() => {});
    }
    await updateCase(
      { doctor_charge: docChargeVal, nursing_charge: nurseChargeVal, status: "Completed" },
      "Payment Collected", `₹${grandTotal.toFixed(2)} • ${paymentMode}`,
    );
  }, "Payment collected and stock updated");

  const printDoc = (title: string, body: string) => {
    const pw = window.open("", "_blank");
    if (!pw) return;
    const lh = buildLetterhead(hospitalProfile as any, { title, module: "daycare" });
    pw.document.write(`<html><head><title>${escapeHtml(title)}</title><style>${lh.styles}
      table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
      th{background:#f5f5f5;font-size:12px}
      .info{display:flex;justify-content:space-between;font-size:13px;margin-bottom:10px}
      .tot{text-align:right;font-size:13px}.tot p{margin:4px 0}
      h4{margin:12px 0 4px;font-size:13px}
      </style></head><body><div class="lh-doc">${lh.header}${body}${lh.footer}</div></body></html>`);
    pw.document.close();
    pw.print();
  };

  const patientBlock = `<div class="info">
    <div><strong>Patient:</strong> ${escapeHtml(caseData.patient_name)}<br/><strong>UHID:</strong> ${escapeHtml(caseData.registration_number)}<br/><strong>Age/Gender:</strong> ${caseData.age ?? "—"}/${escapeHtml(caseData.gender || "—")}</div>
    <div><strong>Doctor:</strong> ${escapeHtml(caseData.doctor_name || "—")}<br/><strong>Date:</strong> ${istDisplayDate(caseData.session_date)}<br/><strong>Admission:</strong> ${escapeHtml(caseData.admission_time || "—")}</div>
  </div>`;

  const printBill = () => printDoc("Day Care Bill", `${patientBlock}
    <table><thead><tr><th>#</th><th>Description</th><th>Category</th><th>Qty</th><th>Rate (₹)</th><th>Amount (₹)</th></tr></thead>
    <tbody>${billLines.map((l, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(l.description)}</td><td>${escapeHtml(l.category)}</td><td>${l.qty}</td><td>${l.unit_price.toFixed(2)}</td><td>${l.total.toFixed(2)}</td></tr>`).join("")}</tbody></table>
    <div class="tot"><p>Subtotal: ₹${subtotal.toFixed(2)}</p><p>Discount: -₹${discountVal.toFixed(2)}</p><p>Tax: ₹${taxVal.toFixed(2)}</p><p><strong>Grand Total: ₹${grandTotal.toFixed(2)}</strong></p></div>`);

  const printSummary = () => printDoc("Day Care Discharge Summary", `${patientBlock}
    <h4>Final Diagnosis</h4><p>${escapeHtml(d.final_diagnosis || "—")}</p>
    <h4>Procedures / Treatment Given</h4><p>${byType("procedure").map((p) => escapeHtml(p.name)).join(", ") || "—"}</p>
    <h4>Doctor's Advice</h4><p>${escapeHtml(d.doctor_advice || "—")}</p>
    <h4>Medicines on Discharge</h4><p>${escapeHtml(d.discharge_medicines || "—")}</p>
    <h4>Follow-up Date</h4><p>${d.followup_date ? istDisplayDate(d.followup_date) : "—"}</p>
    <h4>Instructions</h4><p>${escapeHtml(d.discharge_instructions || "—")}</p>`);

  const ItemTable = ({ type, cols, rows }: any) => (
    <Table>
      <TableHeader><TableRow>{cols.map((c: string) => <TableHead key={c}>{c}</TableHead>)}<TableHead className="w-10" /></TableRow></TableHeader>
      <TableBody>
        {rows.length === 0 && <TableRow><TableCell colSpan={cols.length + 1} className="text-center text-sm text-muted-foreground py-6">Nothing added yet</TableCell></TableRow>}
        {rows.map((r: any) => (
          <TableRow key={r.id}>
            {r.cells.map((c: any, i: number) => <TableCell key={i} className={i === 0 ? "font-medium" : ""}>{c}</TableCell>)}
            <TableCell>
              <Button variant="ghost" size="icon" disabled={busy} onClick={() => guard(() => deleteItem(r.id, r.name), "Removed")}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/day-care")}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold truncate">{caseData.patient_name}</h1>
            <p className="text-xs text-muted-foreground font-mono">{caseData.registration_number} • {caseData.doctor_name}</p>
          </div>
        </div>
        <Badge variant="outline" className={statusBadge(caseData.status)}>{status}</Badge>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full overflow-x-auto justify-start">
          {["overview", "procedures", "medicines", "consumables", "investigations", "billing", "timeline", "discharge"].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize whitespace-nowrap">{t}</TabsTrigger>
          ))}
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3"><CardTitle className="text-base">Patient & Case Details</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
                {[["Patient", caseData.patient_name], ["UHID", caseData.registration_number],
                  ["Age / Gender", `${caseData.age ?? "—"} / ${caseData.gender || "—"}`], ["Mobile", caseData.mobile || "—"],
                  ["Doctor", caseData.doctor_name], ["Department", (caseData as any).department || "—"],
                  ["Admission Time", caseData.admission_time || "—"], ["Chief Complaint", (caseData as any).chief_complaint || "—"]].map(([k, val]) => (
                  <div key={k as string}>
                    <p className="text-xs text-muted-foreground">{k}</p>
                    <p className="font-medium">{val as string}</p>
                  </div>
                ))}
                <div className="sm:col-span-2 space-y-2">
                  <Label className="text-xs">Diagnosis</Label>
                  <Input value={diagVal} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Working diagnosis" />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label className="text-xs">Notes</Label>
                  <Textarea rows={3} value={notesVal} onChange={(e) => setNotes(e.target.value)} placeholder="Clinical notes" />
                </div>
                <div className="sm:col-span-2">
                  <Button size="sm" disabled={busy} onClick={() => guard(() => updateCase({ diagnosis: diagVal, notes: notesVal, vitals: v }, "Case Updated"), "Saved")}>
                    Save Details
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Vital Signs</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  {[["bp", "BP"], ["pulse", "Pulse"], ["temp", "Temp (°F)"], ["spo2", "SpO₂ %"], ["rr", "Resp. Rate"], ["weight", "Weight (kg)"]].map(([k, label]) => (
                    <div key={k}>
                      <Label className="text-xs">{label}</Label>
                      <Input value={v[k] || ""} onChange={(e) => setVitals({ ...v, [k]: e.target.value })} />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full gap-2" variant="outline" disabled={busy}
                    onClick={() => guard(() => updateCase({ status: "Under Treatment" }, "Treatment Started"), "Treatment started")}>
                    <Play className="h-4 w-4" /> Start Treatment
                  </Button>
                  <Button className="w-full gap-2" variant="outline" disabled={busy}
                    onClick={() => guard(() => updateCase({ status: "Ready for Billing" }, "Ready for Billing"), "Marked ready for billing")}>
                    <Receipt className="h-4 w-4" /> Ready for Billing
                  </Button>
                  <Button className="w-full gap-2" variant="outline" disabled={busy}
                    onClick={() => guard(() => updateCase({ status: "Discharged" }, "Discharged"), "Patient discharged")}>
                    <LogOut className="h-4 w-4" /> Discharge Patient
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* PROCEDURES */}
        <TabsContent value="procedures">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Procedures</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-12 items-end">
                <div className="sm:col-span-4">
                  <Label className="text-xs">Procedure</Label>
                  <SearchSelect allowCustom
                    options={(procedures as any[]).map((p) => ({ id: p.id, name: p.name, price: p.price, meta: p.category }))}
                    value={proc.id} placeholder="Search procedure"
                    onSelect={(o) => setProc({ ...proc, id: o.id, name: o.name, price: num(o.price) })} />
                </div>
                <div className="sm:col-span-1"><Label className="text-xs">Qty</Label>
                  <Input type="number" min={1} value={proc.qty} onChange={(e) => setProc({ ...proc, qty: Number(e.target.value) })} /></div>
                <div className="sm:col-span-2"><Label className="text-xs">Doctor</Label>
                  <Input value={proc.doctor} placeholder={caseData.doctor_name} onChange={(e) => setProc({ ...proc, doctor: e.target.value })} /></div>
                <div className="sm:col-span-2"><Label className="text-xs">Unit Price</Label>
                  <Input type="number" value={proc.price} onChange={(e) => setProc({ ...proc, price: Number(e.target.value) })} /></div>
                <div className="sm:col-span-2"><Label className="text-xs">Status</Label>
                  <Select value={proc.status} onValueChange={(s) => setProc({ ...proc, status: s })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["Pending", "In Progress", "Completed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="sm:col-span-1">
                  <Button className="w-full" disabled={busy || !proc.name} onClick={() => guard(async () => {
                    await addItem({
                      item_type: "procedure", ref_id: proc.id.startsWith("custom:") ? null : proc.id, name: proc.name,
                      qty: proc.qty, unit_price: proc.price, total: proc.qty * proc.price,
                      doctor_name: proc.doctor || caseData.doctor_name, status: proc.status,
                    }, "Procedure Added");
                    setProc({ id: "", name: "", qty: 1, price: 0, doctor: "", status: "Pending" });
                  })}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
              <ItemTable cols={["Procedure", "Qty", "Doctor", "Unit Price", "Total", "Status"]}
                rows={byType("procedure").map((p) => ({ id: p.id, name: p.name, cells: [p.name, p.qty, p.doctor_name || "—", `₹${num(p.unit_price).toFixed(2)}`, `₹${num(p.total).toFixed(2)}`, <Badge key="s" variant="outline">{p.status}</Badge>] }))} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* MEDICINES */}
        <TabsContent value="medicines">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Medicines <span className="text-xs font-normal text-muted-foreground">(from Pharmacy master)</span></CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-12 items-end">
                <div className="sm:col-span-3"><Label className="text-xs">Medicine</Label>
                  <SearchSelect options={(medicines as any[]).map((m) => ({ id: m.id, name: m.name, price: m.mrp, meta: `Stock ${m.stock}` }))}
                    value={med.id} placeholder="Search medicine"
                    onSelect={(o) => setMed({ ...med, id: o.id, name: o.name, price: num(o.price) })} /></div>
                <div className="sm:col-span-1"><Label className="text-xs">Qty</Label>
                  <Input type="number" min={1} value={med.qty} onChange={(e) => setMed({ ...med, qty: Number(e.target.value) })} /></div>
                <div className="sm:col-span-2"><Label className="text-xs">Dosage</Label>
                  <Input value={med.dosage} onChange={(e) => setMed({ ...med, dosage: e.target.value })} placeholder="1 tab" /></div>
                <div className="sm:col-span-2"><Label className="text-xs">Frequency</Label>
                  <Input value={med.frequency} onChange={(e) => setMed({ ...med, frequency: e.target.value })} placeholder="1-0-1" /></div>
                <div className="sm:col-span-2"><Label className="text-xs">Duration</Label>
                  <Input value={med.duration} onChange={(e) => setMed({ ...med, duration: e.target.value })} placeholder="3 days" /></div>
                <div className="sm:col-span-1"><Label className="text-xs">Price</Label>
                  <Input type="number" value={med.price} onChange={(e) => setMed({ ...med, price: Number(e.target.value) })} /></div>
                <div className="sm:col-span-1">
                  <Button className="w-full" disabled={busy || !med.name} onClick={() => guard(async () => {
                    await addItem({
                      item_type: "medicine", ref_id: med.id, name: med.name, qty: med.qty,
                      unit_price: med.price, total: med.qty * med.price,
                      dosage: med.dosage, frequency: med.frequency, duration: med.duration,
                    }, "Medicine Added");
                    setMed({ id: "", name: "", qty: 1, price: 0, dosage: "", frequency: "", duration: "" });
                  })}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
              <ItemTable cols={["Medicine", "Qty", "Dosage", "Frequency", "Duration", "Amount"]}
                rows={byType("medicine").map((m) => ({ id: m.id, name: m.name, cells: [m.name, m.qty, m.dosage || "—", m.frequency || "—", m.duration || "—", `₹${num(m.total).toFixed(2)}`] }))} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONSUMABLES */}
        <TabsContent value="consumables">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Consumables <span className="text-xs font-normal text-muted-foreground">(from Inventory master — auto-deducted after payment)</span></CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-12 items-end">
                <div className="sm:col-span-6"><Label className="text-xs">Item</Label>
                  <SearchSelect options={consumables.map((c: any) => ({ id: c.id, name: c.name, price: c.selling_price || c.unit_price, meta: `Stock ${c.stock} ${c.unit || ""}` }))}
                    value={con.id} placeholder="Search consumable (cannula, gloves, syringe…)"
                    onSelect={(o) => setCon({ id: o.id, name: o.name, qty: 1, price: num(o.price) })} /></div>
                <div className="sm:col-span-2"><Label className="text-xs">Qty</Label>
                  <Input type="number" min={1} value={con.qty} onChange={(e) => setCon({ ...con, qty: Number(e.target.value) })} /></div>
                <div className="sm:col-span-3"><Label className="text-xs">Unit Price</Label>
                  <Input type="number" value={con.price} onChange={(e) => setCon({ ...con, price: Number(e.target.value) })} /></div>
                <div className="sm:col-span-1">
                  <Button className="w-full" disabled={busy || !con.name} onClick={() => guard(async () => {
                    await addItem({ item_type: "consumable", ref_id: con.id, name: con.name, qty: con.qty, unit_price: con.price, total: con.qty * con.price }, "Consumable Added");
                    setCon({ id: "", name: "", qty: 1, price: 0 });
                  })}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
              <ItemTable cols={["Item", "Qty", "Unit Price", "Amount"]}
                rows={byType("consumable").map((c) => ({ id: c.id, name: c.name, cells: [c.name, c.qty, `₹${num(c.unit_price).toFixed(2)}`, `₹${num(c.total).toFixed(2)}`] }))} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* INVESTIGATIONS */}
        <TabsContent value="investigations">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Investigations <span className="text-xs font-normal text-muted-foreground">(from Diagnostics catalog)</span></CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-12 items-end">
                <div className="sm:col-span-8"><Label className="text-xs">Investigation</Label>
                  <SearchSelect options={(labTests as any[]).map((t) => ({ id: t.id, name: t.name, price: t.price, meta: t.category }))}
                    value={inv.id} placeholder="Search test (CBC, ECG, X-Ray…)"
                    onSelect={(o) => setInv({ id: o.id, name: o.name, qty: 1, price: num(o.price) })} /></div>
                <div className="sm:col-span-3"><Label className="text-xs">Price</Label>
                  <Input type="number" value={inv.price} onChange={(e) => setInv({ ...inv, price: Number(e.target.value) })} /></div>
                <div className="sm:col-span-1">
                  <Button className="w-full" disabled={busy || !inv.name} onClick={() => guard(async () => {
                    await addItem({ item_type: "investigation", ref_id: inv.id, name: inv.name, qty: 1, unit_price: inv.price, total: inv.price }, "Investigation Ordered");
                    setInv({ id: "", name: "", qty: 1, price: 0 });
                  })}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
              <ItemTable cols={["Investigation", "Amount"]}
                rows={byType("investigation").map((t) => ({ id: t.id, name: t.name, cells: [t.name, `₹${num(t.total).toFixed(2)}`] }))} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* BILLING */}
        <TabsContent value="billing">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Auto-generated Bill</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Category</TableHead><TableHead>Qty</TableHead><TableHead>Rate</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {billLines.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Add procedures, medicines, consumables or investigations</TableCell></TableRow>}
                  {billLines.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{l.description}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[11px]">{l.category}</Badge></TableCell>
                      <TableCell>{l.qty}</TableCell>
                      <TableCell>₹{l.unit_price.toFixed(2)}</TableCell>
                      <TableCell className="text-right">₹{l.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Doctor Charges</Label>
                    <Input type="number" value={docChargeVal} onChange={(e) => setDoctorCharge(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Nursing Charges (optional)</Label>
                    <Input type="number" value={nurseChargeVal} onChange={(e) => setNursingCharge(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Discount (₹)</Label>
                    <Input type="number" value={discountVal} onChange={(e) => setDiscount(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Tax (₹)</Label>
                    <Input type="number" value={taxVal} onChange={(e) => setTax(Number(e.target.value))} /></div>
                  <div className="col-span-2"><Label className="text-xs">Payment Mode</Label>
                    <Select value={paymentMode} onValueChange={setPaymentMode}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["Cash", "Card", "UPI", "Insurance"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select></div>
                </div>
                <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>-₹{discountVal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>₹{taxVal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-base font-bold border-t border-border pt-2"><span>Grand Total</span><span>₹{grandTotal.toFixed(2)}</span></div>
                  {caseData.bill && <Badge variant="outline" className="mt-1">{caseData.bill.payment_status}{caseData.bill.payment_mode ? ` • ${caseData.bill.payment_mode}` : ""}</Badge>}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={busy || billLines.length === 0} onClick={() => guard(async () => {
                  await daycareCaseService.saveBill(id, { subtotal, discount: discountVal, tax: taxVal, grand_total: grandTotal, payment_status: "Pending", payment_mode: null }, billLines);
                  await updateCase({ doctor_charge: docChargeVal, nursing_charge: nurseChargeVal }, "Bill Generated", `₹${grandTotal.toFixed(2)}`);
                }, "Bill saved as pending")}>Save Pending</Button>
                <Button disabled={busy || billLines.length === 0 || billed} onClick={collectPayment}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />{billed ? "Payment Collected" : "Collect Payment"}
                </Button>
                <Button variant="outline" onClick={printBill}><Printer className="h-4 w-4 mr-2" />Print Bill</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TIMELINE */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Case Timeline <span className="text-xs font-normal text-muted-foreground">(automatic audit trail)</span></CardTitle></CardHeader>
            <CardContent>
              {(caseData.timeline || []).length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
              <div className="relative space-y-4 pl-6">
                {(caseData.timeline || []).map((t: any) => (
                  <div key={t.id} className="relative">
                    <span className="absolute -left-6 top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                    <span className="absolute -left-[19px] top-4 h-full w-px bg-border" />
                    <p className="text-sm font-medium">{t.event}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3 w-3" />{istDisplayDateTime(t.created_at)}{t.details ? ` • ${t.details}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DISCHARGE */}
        <TabsContent value="discharge">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Discharge</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label className="text-xs">Final Diagnosis</Label>
                <Textarea rows={2} value={d.final_diagnosis} onChange={(e) => setDis({ ...d, final_diagnosis: e.target.value })} /></div>
              <div><Label className="text-xs">Doctor Advice</Label>
                <Textarea rows={2} value={d.doctor_advice} onChange={(e) => setDis({ ...d, doctor_advice: e.target.value })} /></div>
              <div><Label className="text-xs">Medicines</Label>
                <Textarea rows={3} value={d.discharge_medicines} onChange={(e) => setDis({ ...d, discharge_medicines: e.target.value })}
                  placeholder="Medicine • dosage • frequency • duration" /></div>
              <div className="max-w-xs"><Label className="text-xs">Follow-up Date</Label>
                <DateInput value={d.followup_date || ""} onChange={(val: string) => setDis({ ...d, followup_date: val })} /></div>
              <div><Label className="text-xs">Instructions</Label>
                <Textarea rows={2} value={d.discharge_instructions} onChange={(e) => setDis({ ...d, discharge_instructions: e.target.value })} /></div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="outline" onClick={printSummary}><Printer className="h-4 w-4 mr-2" />Print Summary</Button>
                <Button variant="outline" onClick={printSummary}><Download className="h-4 w-4 mr-2" />Download PDF</Button>
                <Button disabled={busy} onClick={() => guard(async () => {
                  await updateCase({ ...d, followup_date: d.followup_date || null, status: "Discharged" }, "Discharged", d.final_diagnosis || "");
                  await logEvent("Case Closed");
                  invalidate();
                }, "Case completed")}>Complete Case</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DayCareCase;
