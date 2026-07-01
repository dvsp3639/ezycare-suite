/* Verify screen: Doctor Prescription.
 * Editable form → on Approve creates a pharmacy_workspace_scans row and
 * navigates to /pharmacy where the existing PharmacyWorkspace handles
 * billing, stock deduction, patient history, and audit. */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { workspaceService } from "@/modules/pharmacy/workspace";
import type { UploadResult } from "../types";

type Item = {
  name: string;
  brandName?: string;
  genericName?: string;
  strength?: string;
  dosageForm?: string;
  quantity: number;
  frequency?: string;
  duration?: string;
  instructions?: string;
};

export default function PrescriptionVerify({
  data, uploads, onCancel, onDone,
}: {
  data: any;
  uploads: UploadResult[];
  onCancel: () => void;
  onDone: (id?: string) => void;
}) {
  const navigate = useNavigate();
  const [patient, setPatient] = useState(() => ({
    name: data?.patient?.name || "",
    age: String(data?.patient?.age || ""),
    gender: data?.patient?.gender || "",
    mobile: data?.patient?.mobile || "",
  }));
  const [doctor, setDoctor] = useState(() => ({
    name: data?.doctor?.name || "",
    registrationNo: data?.doctor?.registrationNo || "",
    clinic: data?.doctor?.clinic || "",
  }));
  const [items, setItems] = useState<Item[]>(() =>
    (Array.isArray(data?.items) ? data.items : []).map((r: any) => ({
      name: r?.name || r?.brandName || r?.genericName || "",
      brandName: r?.brandName || "",
      genericName: r?.genericName || "",
      strength: r?.strength || "",
      dosageForm: r?.dosageForm || "",
      quantity: Number(r?.quantity) || 1,
      frequency: r?.frequency || "",
      duration: r?.duration || "",
      instructions: r?.instructions || "",
    })),
  );
  const [saving, setSaving] = useState(false);

  const update = (i: number, patch: Partial<Item>) =>
    setItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addRow = () => setItems((cur) => [...cur, { name: "", quantity: 1 }]);
  const removeRow = (i: number) => setItems((cur) => cur.filter((_, idx) => idx !== i));

  const canApprove = patient.name.trim() && items.some((r) => r.name.trim());

  const approve = async () => {
    if (!canApprove) { toast.error("Patient name and at least one medicine are required"); return; }
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) throw new Error("Not signed in");

      const created = await workspaceService.createScan(uid, {
        stage: "inventory_match",
        sale_type: "OP Sale",
        patient_json: patient as any,
        doctor_json: doctor as any,
        items_json: items.map((it) => ({
          name: it.name,
          brandName: it.brandName,
          genericName: it.genericName,
          strength: it.strength,
          dosageForm: it.dosageForm,
          quantity: Number(it.quantity) || 1,
          frequency: it.frequency,
          duration: it.duration,
          instructions: it.instructions,
          mrp: 0,
          gstPercent: 12,
          matchStatus: "pending",
        })) as any,
        source_files: uploads.map((u) => ({
          storageKey: u.storageKey,
          name: u.name,
          size: u.size,
          mime: u.mime,
          signedUrl: u.signedUrl,
        })) as any,
        page_count: uploads.length,
      });
      toast.success("Prescription queued in Pharmacy Workspace");
      onDone(created.id);
      navigate("/pharmacy");
    } catch (e: any) {
      toast.error(e?.message || "Failed to queue prescription");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <section className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Patient name</Label>
          <Input value={patient.name} onChange={(e) => setPatient((s) => ({ ...s, name: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Age</Label>
          <Input value={patient.age} onChange={(e) => setPatient((s) => ({ ...s, age: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Gender</Label>
          <Input value={patient.gender} onChange={(e) => setPatient((s) => ({ ...s, gender: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Mobile</Label>
          <Input value={patient.mobile} onChange={(e) => setPatient((s) => ({ ...s, mobile: e.target.value }))} />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Doctor</Label>
          <Input value={doctor.name} onChange={(e) => setDoctor((s) => ({ ...s, name: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Registration No.</Label>
          <Input value={doctor.registrationNo} onChange={(e) => setDoctor((s) => ({ ...s, registrationNo: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Clinic / Hospital</Label>
          <Input value={doctor.clinic} onChange={(e) => setDoctor((s) => ({ ...s, clinic: e.target.value }))} />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Medicines ({items.length})</h3>
          <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-4 w-4 mr-1" />Add</Button>
        </div>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-md border p-2 grid gap-2 sm:grid-cols-12">
              <Input className="sm:col-span-4 h-9" placeholder="Medicine name" value={it.name} onChange={(e) => update(i, { name: e.target.value })} />
              <Input className="sm:col-span-2 h-9" placeholder="Strength" value={it.strength || ""} onChange={(e) => update(i, { strength: e.target.value })} />
              <Input className="sm:col-span-1 h-9" placeholder="Qty" type="number" value={it.quantity} onChange={(e) => update(i, { quantity: +e.target.value })} />
              <Input className="sm:col-span-2 h-9" placeholder="Frequency" value={it.frequency || ""} onChange={(e) => update(i, { frequency: e.target.value })} />
              <Input className="sm:col-span-2 h-9" placeholder="Duration" value={it.duration || ""} onChange={(e) => update(i, { duration: e.target.value })} />
              <Button size="icon" variant="ghost" className="h-9 w-9 sm:col-span-1" onClick={() => removeRow(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {items.length === 0 && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No medicines detected. Click "Add" to enter manually.
            </div>
          )}
        </div>
      </section>

      <div className="flex items-center justify-end gap-2 border-t pt-4 sticky bottom-0 bg-background">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={approve} disabled={!canApprove || saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
          Approve & send to Pharmacy
        </Button>
      </div>
    </div>
  );
}