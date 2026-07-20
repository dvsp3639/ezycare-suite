import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";

const PLANS = ["trial", "basic", "professional", "enterprise"];
const STATUSES = ["trialing", "active", "past_due", "suspended", "cancelled"];

interface Row {
  id: string;
  hospital_id: string;
  hospital_name?: string;
  plan: string;
  status: string;
  billing_cycle: string;
  amount: number;
  currency: string;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  max_users?: number | null;
  max_patients_per_month?: number | null;
  notes?: string | null;
}

export function SubscriptionsTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [subsRes, hospRes] = await Promise.all([
      (supabase.from("hospital_subscriptions" as any) as any).select("*").order("created_at", { ascending: false }),
      supabase.from("hospitals").select("id, name"),
    ]);
    const nameMap = new Map<string, string>((hospRes.data || []).map((h: any) => [h.id, h.name]));
    setRows(((subsRes.data as any) || []).map((r: any) => ({ ...r, hospital_name: nameMap.get(r.hospital_id) })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      const { error } = await (supabase.from("hospital_subscriptions" as any) as any)
        .update({
          plan: edit.plan,
          status: edit.status,
          billing_cycle: edit.billing_cycle,
          amount: edit.amount,
          currency: edit.currency,
          trial_ends_at: edit.trial_ends_at || null,
          current_period_end: edit.current_period_end || null,
          max_users: edit.max_users,
          max_patients_per_month: edit.max_patients_per_month,
          notes: edit.notes,
        }).eq("id", edit.id);
      if (error) throw error;
      toast.success("Subscription updated");
      setEdit(null);
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const statusColor = (s: string): any =>
    s === "active" ? "default" : s === "trialing" ? "secondary" : s === "past_due" ? "destructive" : "outline";

  return (
    <div className="border border-border rounded-lg bg-card">
      {loading ? (
        <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="p-8 text-center text-muted-foreground">No subscriptions yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hospital</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Renewal</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.hospital_name || r.hospital_id.slice(0, 8)}</TableCell>
                <TableCell><Badge variant="outline">{r.plan}</Badge></TableCell>
                <TableCell><Badge variant={statusColor(r.status)}>{r.status.replace("_", " ")}</Badge></TableCell>
                <TableCell>{r.currency} {r.amount} / {r.billing_cycle}</TableCell>
                <TableCell className="text-xs">
                  {r.status === "trialing" && r.trial_ends_at
                    ? `Trial ends ${new Date(r.trial_ends_at).toLocaleDateString()}`
                    : r.current_period_end
                      ? new Date(r.current_period_end).toLocaleDateString()
                      : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEdit(r)}><Pencil className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Subscription — {edit?.hospital_name}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Plan</Label>
                <Select value={edit.plan} onValueChange={(v) => setEdit({ ...edit, plan: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={edit.status} onValueChange={(v) => setEdit({ ...edit, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Billing Cycle</Label>
                <Select value={edit.billing_cycle} onValueChange={(v) => setEdit({ ...edit, billing_cycle: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount</Label>
                <Input type="number" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: parseFloat(e.target.value || "0") })} />
              </div>
              <div>
                <Label>Trial Ends</Label>
                <Input type="date" value={edit.trial_ends_at?.slice(0, 10) || ""} onChange={(e) => setEdit({ ...edit, trial_ends_at: e.target.value || null })} />
              </div>
              <div>
                <Label>Renewal Date</Label>
                <Input type="date" value={edit.current_period_end?.slice(0, 10) || ""} onChange={(e) => setEdit({ ...edit, current_period_end: e.target.value || null })} />
              </div>
              <div>
                <Label>Max Users</Label>
                <Input type="number" value={edit.max_users ?? ""} onChange={(e) => setEdit({ ...edit, max_users: e.target.value ? parseInt(e.target.value) : null })} />
              </div>
              <div>
                <Label>Max Patients / mo</Label>
                <Input type="number" value={edit.max_patients_per_month ?? ""} onChange={(e) => setEdit({ ...edit, max_patients_per_month: e.target.value ? parseInt(e.target.value) : null })} />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea rows={2} value={edit.notes || ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}