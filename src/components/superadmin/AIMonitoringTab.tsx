import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, Activity, AlertTriangle, Percent } from "lucide-react";
import { toast } from "sonner";

interface Hospital {
  id: string;
  name: string;
  ai_enabled: boolean;
  is_active: boolean;
}

interface UsageAgg {
  hospital_id: string;
  total: number;
  errors: number;
  corrections: number;
  avg_confidence: number;
  avg_latency: number;
}

export function AIMonitoringTab() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [usage, setUsage] = useState<Record<string, UsageAgg>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [hRes, uRes] = await Promise.all([
      supabase.from("hospitals").select("id, name, ai_enabled, is_active").order("name"),
      (supabase.from("ai_usage_events" as any) as any)
        .select("hospital_id, status, was_corrected, confidence_score, latency_ms")
        .gte("created_at", since),
    ]);
    setHospitals((hRes.data as any) || []);
    const agg: Record<string, UsageAgg> = {};
    ((uRes.data as any[]) || []).forEach((e: any) => {
      const k = e.hospital_id;
      if (!k) return;
      const a = agg[k] || { hospital_id: k, total: 0, errors: 0, corrections: 0, avg_confidence: 0, avg_latency: 0 };
      a.total += 1;
      if (e.status === "error") a.errors += 1;
      if (e.was_corrected) a.corrections += 1;
      if (typeof e.confidence_score === "number") a.avg_confidence += e.confidence_score;
      if (typeof e.latency_ms === "number") a.avg_latency += e.latency_ms;
      agg[k] = a;
    });
    Object.values(agg).forEach((a) => {
      if (a.total) { a.avg_confidence = a.avg_confidence / a.total; a.avg_latency = a.avg_latency / a.total; }
    });
    setUsage(agg);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleAI = async (h: Hospital) => {
    const { error } = await supabase.from("hospitals").update({ ai_enabled: !h.ai_enabled }).eq("id", h.id);
    if (error) return toast.error(error.message);
    toast.success(`AI ${!h.ai_enabled ? "enabled" : "disabled"} for ${h.name}`);
    load();
  };

  const totals = useMemo(() => {
    const arr = Object.values(usage);
    const total = arr.reduce((s, a) => s + a.total, 0);
    const errors = arr.reduce((s, a) => s + a.errors, 0);
    const corrections = arr.reduce((s, a) => s + a.corrections, 0);
    const avgConf = total ? arr.reduce((s, a) => s + a.avg_confidence * a.total, 0) / total : 0;
    return { total, errors, corrections, avgConf, accuracy: total ? ((total - corrections) / total) * 100 : 0 };
  }, [usage]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Sparkles className="h-3 w-3" /> AI Calls (30d)</div>
          <p className="text-2xl font-semibold">{totals.total}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Percent className="h-3 w-3" /> Accuracy</div>
          <p className="text-2xl font-semibold">{totals.accuracy.toFixed(1)}%</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Activity className="h-3 w-3" /> Avg Confidence</div>
          <p className="text-2xl font-semibold">{(totals.avgConf).toFixed(1)}%</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><AlertTriangle className="h-3 w-3" /> Errors</div>
          <p className="text-2xl font-semibold text-destructive">{totals.errors}</p>
        </Card>
      </div>

      <Card>
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hospital</TableHead>
                <TableHead>AI Feature</TableHead>
                <TableHead>Calls (30d)</TableHead>
                <TableHead>Errors</TableHead>
                <TableHead>Corrections</TableHead>
                <TableHead>Avg Confidence</TableHead>
                <TableHead>Avg Latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hospitals.map((h) => {
                const a = usage[h.id];
                return (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={h.ai_enabled} onCheckedChange={() => toggleAI(h)} />
                        <Badge variant={h.ai_enabled ? "default" : "secondary"}>{h.ai_enabled ? "On" : "Off"}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>{a?.total ?? 0}</TableCell>
                    <TableCell className={a?.errors ? "text-destructive" : ""}>{a?.errors ?? 0}</TableCell>
                    <TableCell>{a?.corrections ?? 0}</TableCell>
                    <TableCell>{a?.total ? `${a.avg_confidence.toFixed(1)}%` : "—"}</TableCell>
                    <TableCell>{a?.total ? `${Math.round(a.avg_latency)}ms` : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}