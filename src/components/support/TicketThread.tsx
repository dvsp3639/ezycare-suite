import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Send, Lock } from "lucide-react";
import { toast } from "sonner";

export interface Ticket {
  id: string;
  ticket_no: string;
  subject: string;
  description?: string | null;
  status: string;
  priority: string;
  category: string;
  hospital_id: string;
  created_at: string;
  sla_due_at?: string | null;
  assigned_to?: string | null;
}

interface Message {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: string;
  body: string;
  internal_note: boolean;
  created_at: string;
}

export function TicketThread({ ticket, onChange }: { ticket: Ticket; onChange?: () => void }) {
  const { user, isSuperAdmin } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from("support_ticket_messages" as any) as any)
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    setMessages((data as any) || []);
    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`ticket-${ticket.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_ticket_messages", filter: `ticket_id=eq.${ticket.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ticket.id]);

  const send = async () => {
    if (!body.trim() || !user) return;
    setSending(true);
    try {
      const { error } = await (supabase.from("support_ticket_messages" as any) as any).insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        sender_role: isSuperAdmin ? "super_admin" : "hospital",
        body: body.trim(),
        internal_note: isSuperAdmin ? internal : false,
      });
      if (error) throw error;
      setBody("");
      setInternal(false);
      onChange?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const statusUpdate = async (status: string) => {
    const patch: any = { status };
    if (status === "resolved") patch.resolved_at = new Date().toISOString();
    if (status === "closed") patch.closed_at = new Date().toISOString();
    const { error } = await (supabase.from("support_tickets" as any) as any)
      .update(patch).eq("id", ticket.id);
    if (error) return toast.error(error.message);
    toast.success(`Ticket ${status}`);
    onChange?.();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{ticket.ticket_no}</p>
          <h3 className="font-semibold">{ticket.subject}</h3>
          <div className="flex gap-1 mt-1">
            <Badge variant="outline">{ticket.priority}</Badge>
            <Badge variant="outline">{ticket.category}</Badge>
            <Badge>{ticket.status.replace("_", " ")}</Badge>
          </div>
        </div>
        {isSuperAdmin && (
          <div className="flex gap-1">
            {ticket.status !== "resolved" && ticket.status !== "closed" && (
              <Button size="sm" variant="outline" onClick={() => statusUpdate("resolved")}>Resolve</Button>
            )}
            {ticket.status !== "closed" && (
              <Button size="sm" variant="ghost" onClick={() => statusUpdate("closed")}>Close</Button>
            )}
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
        {ticket.description && (
          <div className="rounded-lg bg-card border border-border p-3 text-sm whitespace-pre-wrap">
            {ticket.description}
          </div>
        )}
        {loading ? (
          <div className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground">No replies yet</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg p-3 text-sm ${
                  m.internal_note
                    ? "bg-warning/10 border border-warning/40 text-warning-foreground"
                    : mine ? "bg-primary text-primary-foreground" : "bg-card border border-border"
                }`}>
                  <div className="flex items-center gap-1 text-[10px] opacity-70 mb-1">
                    {m.internal_note && <Lock className="h-3 w-3" />}
                    <span>{m.sender_role === "super_admin" ? "Support" : "Hospital"}</span>
                    <span>· {new Date(m.created_at).toLocaleString()}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {ticket.status !== "closed" && (
        <div className="border-t border-border p-3 space-y-2 bg-background">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Type your reply…" />
          <div className="flex items-center justify-between">
            {isSuperAdmin ? (
              <label className="flex items-center gap-2 text-xs">
                <Checkbox checked={internal} onCheckedChange={(v) => setInternal(!!v)} />
                Internal note (hidden from hospital)
              </label>
            ) : <span />}
            <Button size="sm" onClick={send} disabled={sending || !body.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="ml-1">Send</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}