import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Search, Eye, Download, FileText, ShieldCheck, Loader2, Building2, Calendar, Receipt, History,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Bill = {
  id: string;
  vendor: string;
  invoice_no: string;
  bill_date: string;
  total_amount: number;
  net_payable: number | null;
  supplier_gst: string | null;
  supplier_contact: string | null;
  supplier_address: string | null;
  invoice_file_url: string | null;
  source_files: any;
  manual_corrections: any;
  warnings: any;
  device_info: string | null;
  employee_id: string | null;
  verified_by_name: string | null;
  approved_by_name: string | null;
  imported_at: string | null;
  created_at: string;
};

type Item = {
  id: string;
  medicine_id: string | null;
  medicine_name: string;
  batch_no: string | null;
  expiry_date: string | null;
  quantity: number;
  free_quantity: number;
  purchase_rate: number;
  mrp: number;
  amount: number;
  ai_confidence: number | null;
};

export function PurchaseInvoiceRepository({ openBillId, onOpenedBillId }: { openBillId?: string | null; onOpenedBillId?: () => void }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [supplier, setSupplier] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Bill | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("purchase_bills")
      .select("id,vendor,invoice_no,bill_date,total_amount,net_payable,supplier_gst,supplier_contact,supplier_address,invoice_file_url,source_files,manual_corrections,warnings,device_info,employee_id,verified_by_name,approved_by_name,imported_at,created_at")
      .eq("bill_type", "Pharmacy")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setBills((data as Bill[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!openBillId) return;
    const found = bills.find((b) => b.id === openBillId);
    if (found) { openBill(found); onOpenedBillId?.(); }
  }, [openBillId, bills]);

  const supplierOptions = useMemo(() => Array.from(new Set(bills.map((b) => b.vendor).filter(Boolean))).sort(), [bills]);

  const filtered = useMemo(() => bills.filter((b) => {
    if (q) {
      const t = q.toLowerCase();
      if (!(b.vendor?.toLowerCase().includes(t) || b.invoice_no?.toLowerCase().includes(t))) return false;
    }
    if (supplier && b.vendor !== supplier) return false;
    if (from && b.bill_date < from) return false;
    if (to && b.bill_date > to) return false;
    return true;
  }), [bills, q, supplier, from, to]);

  async function openBill(b: Bill) {
    setSelected(b);
    setItems([]);
    setItemsLoading(true);
    const { data } = await supabase
      .from("purchase_bill_items")
      .select("id,medicine_id,medicine_name,batch_no,expiry_date,quantity,free_quantity,purchase_rate,mrp,amount,ai_confidence")
      .eq("purchase_bill_id", b.id)
      .order("medicine_name");
    setItems((data as Item[]) || []);
    setItemsLoading(false);
  }

  async function viewOriginal(b: Bill) {
    const paths: string[] = [];
    const sf = Array.isArray(b.source_files) ? b.source_files : [];
    for (const f of sf) if (f?.storage_path) paths.push(f.storage_path);
    if (b.invoice_file_url && !paths.length) paths.push(b.invoice_file_url);
    if (!paths.length) { toast.info("No original file stored for this invoice."); return; }
    for (const p of paths) {
      const { data, error } = await supabase.storage.from("purchase-invoices").createSignedUrl(p, 300);
      if (error || !data?.signedUrl) { toast.error(error?.message || "Could not open file"); continue; }
      window.open(data.signedUrl, "_blank", "noopener");
    }
  }

  async function downloadOriginal(b: Bill) {
    const sf = Array.isArray(b.source_files) ? b.source_files : [];
    for (const f of sf) {
      if (!f?.storage_path) continue;
      const { data } = await supabase.storage.from("purchase-invoices").createSignedUrl(f.storage_path, 300, { download: f.name || true });
      if (data?.signedUrl) {
        const a = document.createElement("a");
        a.href = data.signedUrl; a.download = f.name || "invoice"; a.click();
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px] max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search supplier or invoice no…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Supplier</Label>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[180px]"
            value={supplier} onChange={(e) => setSupplier(e.target.value)}>
            <option value="">All suppliers</option>
            {supplierOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[150px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[150px]" />
        </div>
        <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice No.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Net Payable</TableHead>
                <TableHead>Verified By</TableHead>
                <TableHead>Imported</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No purchase invoices found.</TableCell></TableRow>
              )}
              {filtered.map((b) => {
                const fileCount = Array.isArray(b.source_files) ? b.source_files.length : 0;
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.invoice_no}</TableCell>
                    <TableCell className="text-sm">{b.bill_date ? format(new Date(b.bill_date), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{b.vendor}</div>
                      {b.supplier_gst && <p className="text-[10px] text-muted-foreground">GST: {b.supplier_gst}</p>}
                    </TableCell>
                    <TableCell className="text-right font-medium">₹{(b.net_payable ?? b.total_amount).toFixed(2)}</TableCell>
                    <TableCell className="text-xs">{b.verified_by_name || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{b.imported_at ? format(new Date(b.imported_at), "dd/MM/yy HH:mm") : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openBill(b)} title="View details"><Eye className="h-3.5 w-3.5" /></Button>
                        {fileCount > 0 && (
                          <Button size="sm" variant="ghost" onClick={() => viewOriginal(b)} title="Open original file"><FileText className="h-3.5 w-3.5" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" />Invoice {selected.invoice_no}</DialogTitle>
                <DialogDescription>{selected.vendor} · {selected.bill_date && format(new Date(selected.bill_date), "dd MMM yyyy")}</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><p className="text-[10px] text-muted-foreground">Supplier GST</p><p>{selected.supplier_gst || "—"}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Contact</p><p>{selected.supplier_contact || "—"}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Verified by</p><p>{selected.verified_by_name || "—"}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Approved by</p><p>{selected.approved_by_name || "—"}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Employee ID</p><p>{selected.employee_id || "—"}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Imported</p><p>{selected.imported_at && format(new Date(selected.imported_at), "dd/MM/yyyy HH:mm")}</p></div>
                <div className="col-span-2"><p className="text-[10px] text-muted-foreground">Address</p><p>{selected.supplier_address || "—"}</p></div>
              </div>

              <div className="rounded-xl border bg-muted/20 p-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4" /> {Array.isArray(selected.source_files) ? selected.source_files.length : 0} original file(s) archived</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => viewOriginal(selected)}><Eye className="h-3.5 w-3.5 mr-1" /> View original</Button>
                  <Button size="sm" variant="outline" onClick={() => downloadOriginal(selected)}><Download className="h-3.5 w-3.5 mr-1" /> Download</Button>
                </div>
              </div>

              <div>
                <p className="font-semibold text-sm mb-2 flex items-center gap-2"><Calendar className="h-4 w-4" /> Imported medicines ({items.length})</p>
                <div className="rounded-xl border overflow-hidden max-h-[40vh] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[11px]">
                        <TableHead>Medicine</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Free</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">MRP</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itemsLoading && <TableRow><TableCell colSpan={8} className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>}
                      {!itemsLoading && items.map((it) => (
                        <TableRow key={it.id} className="text-xs">
                          <TableCell>
                            <p className="font-medium">{it.medicine_name}</p>
                            {it.medicine_id && <p className="text-[10px] text-muted-foreground">Linked to inventory</p>}
                          </TableCell>
                          <TableCell>{it.batch_no || "—"}</TableCell>
                          <TableCell>{it.expiry_date ? format(new Date(it.expiry_date), "MM/yyyy") : "—"}</TableCell>
                          <TableCell className="text-right">{it.quantity}</TableCell>
                          <TableCell className="text-right">{it.free_quantity}</TableCell>
                          <TableCell className="text-right">₹{it.purchase_rate}</TableCell>
                          <TableCell className="text-right">₹{it.mrp}</TableCell>
                          <TableCell className="text-right">₹{it.amount?.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="rounded-xl border bg-muted/10 p-3 space-y-2">
                <p className="font-semibold text-sm flex items-center gap-2"><History className="h-4 w-4" /> Audit trail</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Manual corrections:</span> {Array.isArray(selected.manual_corrections) ? selected.manual_corrections.length : 0}</div>
                  <div><span className="text-muted-foreground">Pre-import warnings:</span> {Array.isArray(selected.warnings) ? selected.warnings.length : 0}</div>
                  <div className="md:col-span-2 font-mono text-[10px] break-all"><span className="text-muted-foreground">Device:</span> {selected.device_info || "—"}</div>
                </div>
                {Array.isArray(selected.manual_corrections) && selected.manual_corrections.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Show {selected.manual_corrections.length} corrections</summary>
                    <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {selected.manual_corrections.map((c: any, i: number) => (
                        <li key={i} className="font-mono text-[10px] text-muted-foreground">[{c.scope}] {c.field}: {String(c.oldValue ?? "—")} → {String(c.newValue ?? "—")}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>

              <DialogFooter>
                <Badge variant="outline" className="bg-success/10 text-success mr-auto"><ShieldCheck className="h-3 w-3 mr-1" /> Permanently archived</Badge>
                <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
