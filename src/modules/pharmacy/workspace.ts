/* ──────────────────────────────────────────────────────────────────────
 * Pharmacy Workspace — per-user, realtime synced prescription pipeline
 * Stages: scan → ai_extraction → inventory_match → review → billing
 *         → payment → deducted → audit
 * ────────────────────────────────────────────────────────────────────── */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Medicine } from "@/modules/pharmacy/types";

export type WorkspaceStage =
  | "scan"
  | "ai_extraction"
  | "inventory_match"
  | "review"
  | "billing"
  | "payment"
  | "deducted"
  | "audit";

export const STAGE_LABEL: Record<WorkspaceStage, string> = {
  scan: "Scan",
  ai_extraction: "AI Extraction",
  inventory_match: "Inventory Match",
  review: "Pharmacist Review",
  billing: "Billing",
  payment: "Payment",
  deducted: "Inventory Deduction",
  audit: "Audit Trail",
};

export const STAGE_ORDER: WorkspaceStage[] = [
  "scan", "ai_extraction", "inventory_match", "review",
  "billing", "payment", "deducted", "audit",
];

export type SaleType = "OP Sale" | "IP Sale" | "Direct Sale" | "OP Return" | "IP Return";

export interface WorkspacePatient {
  name?: string;
  mobile?: string;
  age?: string | number;
  gender?: string;
  patientId?: string;
  registrationNumber?: string;
}

export interface WorkspaceDoctor {
  name?: string;
  qualification?: string;
  registration?: string;
}

export interface WorkspaceItem {
  aiText?: string;
  name: string;
  strength?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  quantity: number;
  /** matched medicine */
  medicineId?: string | null;
  medicineName?: string;
  batchNo?: string;
  mrp: number;
  gstPercent: number;
  discount?: number;
  /** inventory state */
  availableStock?: number;
  matchStatus?: "available" | "low" | "out" | "unmatched";
  confidence?: number;
}

export interface WorkspaceTotals {
  subtotal: number;
  gstAmount: number;
  discountPercent: number;
  discountAmount: number;
  netAmount: number;
}

export interface WorkspacePayment {
  mode?: "Cash" | "UPI" | "Card" | "Credit";
  amountTendered?: number;
  change?: number;
  invoiceNo?: string;
}

export interface WorkspaceScan {
  id: string;
  hospital_id: string;
  owner_user_id: string;
  stage: WorkspaceStage;
  verification_status: "pending" | "verified" | "rejected";
  billing_status: "pending" | "billed" | "paid" | "voided";
  sale_type: SaleType;
  patient_json: WorkspacePatient;
  doctor_json: WorkspaceDoctor;
  items_json: WorkspaceItem[];
  totals_json: WorkspaceTotals;
  payment_json: WorkspacePayment;
  ai_confidence: number | null;
  page_count: number;
  source_files: string[];
  notes: string | null;
  linked_order_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
}

const TABLE = "pharmacy_workspace_scans";

export const workspaceService = {
  async createScan(ownerUserId: string, payload: Partial<WorkspaceScan> = {}): Promise<WorkspaceScan> {
    const insert: any = {
      owner_user_id: ownerUserId,
      stage: "scan",
      sale_type: "OP Sale",
      patient_json: {},
      doctor_json: {},
      items_json: [],
      totals_json: { subtotal: 0, gstAmount: 0, discountPercent: 0, discountAmount: 0, netAmount: 0 },
      payment_json: {},
      source_files: [],
      page_count: 0,
      ...payload,
    };
    const { data, error } = await supabase.from(TABLE as any).insert(insert).select().single();
    if (error) throw error;
    return data as any as WorkspaceScan;
  },

  async updateScan(id: string, patch: Partial<WorkspaceScan>): Promise<void> {
    const { error } = await supabase.from(TABLE as any).update(patch as any).eq("id", id);
    if (error) throw error;
  },

  async listActive(ownerUserId: string): Promise<WorkspaceScan[]> {
    const { data, error } = await supabase
      .from(TABLE as any)
      .select("*")
      .eq("owner_user_id", ownerUserId)
      .is("completed_at", null)
      .is("cancelled_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as any as WorkspaceScan[];
  },

  async getScan(id: string): Promise<WorkspaceScan | null> {
    const { data, error } = await supabase.from(TABLE as any).select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data || null) as any;
  },

  async cancel(id: string) {
    await this.updateScan(id, { cancelled_at: new Date().toISOString() as any, stage: "audit" as any });
  },

  async complete(id: string) {
    await this.updateScan(id, { completed_at: new Date().toISOString() as any });
  },

  /** Upload a page blob to the prescriptions bucket; returns the storage path. */
  async uploadPage(scanId: string, ownerUserId: string, blob: Blob, idx: number): Promise<string> {
    const path = `${ownerUserId}/${scanId}/page-${idx}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("prescriptions").upload(path, blob, {
      contentType: blob.type || "image/jpeg",
      upsert: false,
    });
    if (error) throw error;
    return path;
  },

  async signedUrl(path: string, expiresSec = 3600): Promise<string | null> {
    const { data } = await supabase.storage.from("prescriptions").createSignedUrl(path, expiresSec);
    return data?.signedUrl || null;
  },
};

/* ─── Inventory matcher ─────────────────────────────────────────────── */
export function matchInventory(items: WorkspaceItem[], stock: Medicine[]): WorkspaceItem[] {
  const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return items.map((it) => {
    if (it.medicineId) {
      const m = stock.find((x) => x.id === it.medicineId);
      if (m) return enrich(it, m);
    }
    const q = norm(`${it.name} ${it.strength || ""}`);
    if (!q) return { ...it, matchStatus: "unmatched" };
    // exact then prefix then fuzzy contains
    const exact = stock.find((m) => norm(`${m.name} ${m.strength || ""}`) === q);
    if (exact) return enrich(it, exact);
    const byName = stock.find((m) => norm(m.name) === norm(it.name));
    if (byName) return enrich(it, byName);
    const partial = stock.find((m) => norm(m.name).includes(norm(it.name)) || norm(it.name).includes(norm(m.name)));
    if (partial) return enrich(it, partial);
    return { ...it, matchStatus: "unmatched" };
  });
}

function enrich(it: WorkspaceItem, m: Medicine): WorkspaceItem {
  const stock = m.stock || 0;
  const status: WorkspaceItem["matchStatus"] =
    stock <= 0 ? "out" : stock < it.quantity ? "low" : "available";
  return {
    ...it,
    medicineId: m.id,
    medicineName: m.name,
    batchNo: m.batchNo || "",
    mrp: m.mrp || it.mrp || 0,
    gstPercent: m.gstPercent ?? it.gstPercent ?? 12,
    availableStock: stock,
    matchStatus: status,
  };
}

export function recomputeTotals(items: WorkspaceItem[], discountPercent = 0): WorkspaceTotals {
  const subtotal = items.reduce((s, i) => s + (i.mrp || 0) * (i.quantity || 0), 0);
  const gstAmount = items.reduce(
    (s, i) => s + ((i.mrp || 0) * (i.quantity || 0) * (i.gstPercent || 0)) / 100,
    0,
  );
  const discountAmount = (subtotal * (discountPercent || 0)) / 100;
  const netAmount = Math.max(0, subtotal + gstAmount - discountAmount);
  return {
    subtotal: round2(subtotal),
    gstAmount: round2(gstAmount),
    discountPercent,
    discountAmount: round2(discountAmount),
    netAmount: round2(netAmount),
  };
}
const round2 = (n: number) => Math.round(n * 100) / 100;

/* ─── Realtime hooks ────────────────────────────────────────────────── */

/** Subscribe to the active queue for a user. Live updates via postgres_changes. */
export function useWorkspaceQueue(ownerUserId: string | undefined) {
  const [scans, setScans] = useState<WorkspaceScan[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!ownerUserId) return;
    const list = await workspaceService.listActive(ownerUserId);
    setScans(list);
    setLoading(false);
  }, [ownerUserId]);

  useEffect(() => {
    if (!ownerUserId) return;
    refetch();
    const channel = supabase
      .channel(`workspace-queue:${ownerUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLE, filter: `owner_user_id=eq.${ownerUserId}` },
        (payload) => {
          setScans((prev) => {
            const row = (payload.new || payload.old) as WorkspaceScan;
            if (!row) return prev;
            if (payload.eventType === "DELETE") return prev.filter((s) => s.id !== row.id);
            const isActive = !(row.completed_at || row.cancelled_at);
            const exists = prev.find((s) => s.id === row.id);
            if (!isActive) return prev.filter((s) => s.id !== row.id);
            if (exists) return prev.map((s) => (s.id === row.id ? row : s));
            return [row, ...prev];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ownerUserId, refetch]);

  return { scans, loading, refetch };
}

/** Subscribe to a single scan row for live editing across devices. */
export function useWorkspaceScan(scanId: string | null) {
  const [scan, setScan] = useState<WorkspaceScan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scanId) { setScan(null); setLoading(false); return; }
    let active = true;
    setLoading(true);
    workspaceService.getScan(scanId).then((s) => {
      if (active) { setScan(s); setLoading(false); }
    });
    const channel = supabase
      .channel(`workspace-scan:${scanId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLE, filter: `id=eq.${scanId}` },
        (payload) => {
          if (payload.eventType === "DELETE") setScan(null);
          else setScan(payload.new as any);
        },
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [scanId]);

  return { scan, loading };
}
