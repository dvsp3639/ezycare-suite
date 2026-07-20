import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Plus, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { TicketThread, type Ticket } from "@/components/support/TicketThread";

const PRIORITIES = ["low", "medium", "high", "urgent"];
const CATEGORIES = ["bug", "feature", "billing", "ai", "training", "other"];

export default function Support() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [dlg, setDlg] = useState(false);
  const [form, setForm] = useState({ subject: "", description: "", category: "other", priority: "medium" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from("support_tickets" as any) as any)
      .select("*")
      .order("last_message_at", { ascending: false });
    setTickets((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("hospital-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const create = async () => {
    if (!form.subject.trim()) return toast.error("Subject required");
    setSaving(true);
    try {
      const { data, error } = await (supabase.from("support_tickets" as any) as any)
        .insert({
          subject: form.subject.trim(),
          description: form.description.trim() || null,
          category: form.category,
          priority: form.priority,
          created_by: user!.id,
        }).select().single();
      if (error) throw error;
      toast.success(`Ticket ${(data as any).ticket_no} created`);
      setDlg(false);
      setForm({ subject: "", description: "", category: "other", priority: "medium" });
      load();
      setSelected(data as any);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Support</h1>
            <p className="text-sm text-muted-foreground">Raise tickets and chat with Ezy OP support</p>
          </div>
        </div>
        <Button onClick={() => setDlg(true)}><Plus className="h-4 w-4 mr-1" /> New Ticket</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 h-[calc(100vh-220px)]">
        <Card className="overflow-y-auto">
          {loading ? (
            <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : tickets.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No tickets yet. Click "New Ticket" to create one.</p>
          ) : tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className={`w-full text-left p-3 border-b border-border hover:bg-muted transition-colors ${selected?.id === t.id ? "bg-muted" : ""}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">{t.ticket_no}</span>
                <Badge variant="outline" className="text-[10px]">{t.status.replace("_"," ")}</Badge>
              </div>
              <p className="font-medium text-sm truncate">{t.subject}</p>
              <div className="flex gap-1 mt-1">
                <Badge variant="secondary" className="text-[10px]">{t.priority}</Badge>
                <Badge variant="secondary" className="text-[10px]">{t.category}</Badge>
              </div>
            </button>
          ))}
        </Card>

        <Card className="flex flex-col overflow-hidden">
          {selected ? (
            <TicketThread ticket={selected} onChange={load} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a ticket to view the conversation
            </div>
          )}
        </Card>
      </div>

      <Dialog open={dlg} onOpenChange={setDlg}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Support Ticket</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Subject *</Label><Input value={form.subject} onChange={(e) => setForm({...form, subject: e.target.value})} /></div>
            <div><Label>Description</Label><Textarea rows={4} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({...form, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({...form, priority: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}