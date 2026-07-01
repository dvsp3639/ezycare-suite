/* Verify screen: Purchase Invoice.
 * Editable table → on Approve calls the existing `import_purchase_invoice` RPC
 * which handles inventory upsert, purchase_bill + items insert, and audit
 * fields. Same downstream path used before the sprint. */
import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { UploadResult } from "../types";

type Item = {
  name: string;
  brandName?: string;
  genericName?: string;
  strength?: string;
  batchNo?: string;
  expiryDate?: string;
  quantity: number;
  freeQuantity: number;
  purchaseRate: number;
  mrp: number;
  sellingRate?: number;
  gstPercent: number;
  hsnCode?: string;
  amount: number;
  packSize?: string;
  manufacturer?: string;
};

export default function InvoiceVerify({
  data, uploads, onCancel, onDone,
}: {
  data: any;
  uploads: UploadResult[];
  onCancel: () => void;
  onDone: (id?: string) => void;
}) {
  const [supplier, setSupplier] = useState(() => ({
    name: data?.supplier?.name || "",
    gst: data?.supplier?.gst || "",
    address: data?.supplier?.address || "",
    contact: data?.supplier?.contact || "",
  }));
  const [invoice, setInvoice] = useState(() => ({
    invoiceNo: data?.invoice?.invoiceNo || "",
    invoiceDate: data?.invoice?.invoiceDate || "",
    subtotal: Number(data?.invoice?.subtotal) || 0,
    gstAmount: Number(data?.invoice?.gstAmount) || 0,
    discount: Number(data?.invoice?.discount) || 0,
    roundOff: Number(data?.invoice?.roundOff) || 0,
    totalAmount: Number(data?.invoice?.totalAmount) || 0,
    netPayable: Number(data?.invoice?.netPayable) || Number(data?.invoice?.totalAmount) || 0,
  }));
  const [items, setItems] = useState<Item[]>(() =>
    (Array.isArray(data?.items) ? data.items : []).map((r: any) => ({
      name: r?.name || "",
      brandName: r?.brandName || "",
      genericName: r?.genericName || "",
      strength: r?.strength || "",
      batchNo: r?.batchNo || "",
      expiryDate: r?.expiryDate || "",
      quantity: Number(r?.quantity) || 0,
      freeQuantity: Number(r?.freeQuantity) || 0,
      purchaseRate: Number(r?.purchaseRate) || 0,
      mrp: Number(r?.mrp) || 0,
      sellingRate: r?.sellingRate != null ? Number(r.sellingRate) : undefined,
      gstPercent: Number(r?.gstPercent) || 12,
      hsnCode: r?.hsnCode || "",
      amount: Number(r?.amount) || Number(r?.quantity) * Number(r?.purchaseRate) || 0,
      packSize: r?.packSize || "",
      manufacturer: r?.manufacturer || "",
    })),
  );
  const [saving, setSaving] = useState(false);

  const totalLines = items.length;
  const totalQty = useMemo(() => items.reduce((a, b) => a + (Number(b.quantity) || 0), 0), [items]);

  const updateItem = (i: number, patch: Partial<Item>) =>
    setItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const addRow = () =>
    setItems((cur) => [...cur, {
      name: "", quantity: 0, freeQuantity: 0, purchaseRate: 0, mrp: 0, gstPercent: 12, amount: 0,
    }]);

  const removeRow = (i: number) => setItems((cur) => cur.filter((_, idx) => idx !== i));

  const canApprove = supplier.name.trim() && invoice.invoiceNo.trim() && items.some((r) => r.name.trim());

  const approve = async () => {
    if (!canApprove) { toast.error("Supplier name, invoice number and at least one medicine are required"); return; }
    setSaving(true);
    try {
      const payload = {
        _supplier: supplier,
        _invoice: {
          ...invoice,
          fileUrl: uploads[0]?.signedUrl || "",
        },
        _items: items.filter((r) => r.name.trim()),
        _audit: {
          notes: "Imported via AI Scanner v2",
          source_files: uploads.map((u) => ({ storageKey: u.storageKey, name: u.name, size: u.size })),
        },
      };
      const { data: res, error } = await supabase.rpc("import_purchase_invoice", payload as any);
      if (error) throw error;
      const billId = (res as any)?.bill_id;
      toast.success("Invoice imported. Inventory updated.");
      onDone(billId);
    } catch (e: any) {
      toast.error(e?.message || "Import failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Supplier name</Label>
          <Input value={supplier.name} onChange={(e) => setSupplier((s) => ({ ...s, name: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>GST No.</Label>
          <Input value={supplier.gst} onChange={(e) => setSupplier((s) => ({ ...s, gst: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Invoice No.</Label>
          <Input value={invoice.invoiceNo} onChange={(e) => setInvoice((v) => ({ ...v, invoiceNo: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Invoice Date</Label>
          <Input type="date" value={invoice.invoiceDate}
                 onChange={(e) => setInvoice((v) => ({ ...v, invoiceDate: e.target.value }))} />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold">Line items ({totalLines})</h3>
            <p className="text-xs text-muted-foreground">Total qty: {totalQty}</p>
          </div>
          <Button size="sm" variant="outline" onClick={addRow}>
            <Plus className="h-4 w-4 mr-1" /> Add row
          </Button>
        </div>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-2 min-w-[180px]">Medicine</th>
                <th className="p-2">Batch</th>
                <th className="p-2">Expiry</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-right">Free</th>
                <th className="p-2 text-right">Rate</th>
                <th className="p-2 text-right">MRP</th>
                <th className="p-2 text-right">GST%</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t">
                  <td className="p-1"><Input className="h-8 text-xs" value={it.name} onChange={(e) => updateItem(i, { name: e.target.value })} /></td>
                  <td className="p-1"><Input className="h-8 text-xs" value={it.batchNo || ""} onChange={(e) => updateItem(i, { batchNo: e.target.value })} /></td>
                  <td className="p-1"><Input className="h-8 text-xs" type="date" value={it.expiryDate || ""} onChange={(e) => updateItem(i, { expiryDate: e.target.value })} /></td>
                  <td className="p-1"><Input className="h-8 text-xs text-right" type="number" value={it.quantity} onChange={(e) => updateItem(i, { quantity: +e.target.value })} /></td>
                  <td className="p-1"><Input className="h-8 text-xs text-right" type="number" value={it.freeQuantity} onChange={(e) => updateItem(i, { freeQuantity: +e.target.value })} /></td>
                  <td className="p-1"><Input className="h-8 text-xs text-right" type="number" step="0.01" value={it.purchaseRate} onChange={(e) => updateItem(i, { purchaseRate: +e.target.value })} /></td>
                  <td className="p-1"><Input className="h-8 text-xs text-right" type="number" step="0.01" value={it.mrp} onChange={(e) => updateItem(i, { mrp: +e.target.value })} /></td>
                  <td className="p-1"><Input className="h-8 text-xs text-right" type="number" step="0.01" value={it.gstPercent} onChange={(e) => updateItem(i, { gstPercent: +e.target.value })} /></td>
                  <td className="p-1"><Input className="h-8 text-xs text-right" type="number" step="0.01" value={it.amount} onChange={(e) => updateItem(i, { amount: +e.target.value })} /></td>
                  <td className="p-1 text-right">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeRow(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">No line items detected. Click "Add row".</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <div>
          <Label>Subtotal</Label>
          <Input type="number" step="0.01" value={invoice.subtotal} onChange={(e) => setInvoice((v) => ({ ...v, subtotal: +e.target.value }))} />
        </div>
        <div>
          <Label>GST</Label>
          <Input type="number" step="0.01" value={invoice.gstAmount} onChange={(e) => setInvoice((v) => ({ ...v, gstAmount: +e.target.value }))} />
        </div>
        <div>
          <Label>Discount</Label>
          <Input type="number" step="0.01" value={invoice.discount} onChange={(e) => setInvoice((v) => ({ ...v, discount: +e.target.value }))} />
        </div>
        <div>
          <Label>Net Payable</Label>
          <Input type="number" step="0.01" value={invoice.netPayable} onChange={(e) => setInvoice((v) => ({ ...v, netPayable: +e.target.value }))} />
        </div>
      </section>

      <div className="flex items-center justify-end gap-2 border-t pt-4 sticky bottom-0 bg-background">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={approve} disabled={!canApprove || saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
          Approve & import
        </Button>
      </div>
    </div>
  );
}