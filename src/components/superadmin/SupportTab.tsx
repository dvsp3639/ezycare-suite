import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";
import { TicketThread, type Ticket } from "@/components/support/TicketThread";

export function SupportTab() {
  const [tickets, setTickets] = useState<(Ticket & { hospital_name?: string })[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const [tRes, hRes] = await Promise.all([
      (supabase.from("support_tickets" as any) as any).select("*").order("last_message_at", { ascending: false }),
      supabase.from("hospitals").select("id, name"),
    ]);
    const nameMap = new Map<string, string>((hRes.data || []).map((h: any) => [h.id, h.name]));
    setTickets(((tRes.data as any) || []).map((t: any) => ({ ...t, hospital_name: nameMap.get(t.hospital_id) })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => tickets.filter(t => {
    if (status !== "all" && t.status !== status) return false;
    if (q && !`${t.ticket_no} ${t.subject} ${t.hospital_name}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [tickets, q, status]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4 h-[calc(100vh-260px)]">
      <Card className="flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-8 h-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="waiting_customer">Waiting on customer</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No tickets</p>
          ) : filtered.map((t) => (
            <button key={t.id} onClick={() => setSelected(t)}
              className={`w-full text-left p-3 border-b border-border hover:bg-muted transition-colors ${selected?.id === t.id ? "bg-muted" : ""}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">{t.ticket_no}</span>
                <Badge variant="outline" className="text-[10px]">{t.status.replace("_"," ")}</Badge>
              </div>
              <p className="font-medium text-sm truncate">{t.subject}</p>
              <p className="text-xs text-muted-foreground truncate">{t.hospital_name}</p>
              <div className="flex gap-1 mt-1">
                <Badge variant="secondary" className="text-[10px]">{t.priority}</Badge>
                <Badge variant="secondary" className="text-[10px]">{t.category}</Badge>
              </div>
            </button>
          ))}
        </div>
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
  );
}