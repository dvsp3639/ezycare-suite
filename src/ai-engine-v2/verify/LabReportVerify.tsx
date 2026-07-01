/* Verify screen: Lab Report.
 * Sprint 1: light — captures classification and pointer to the uploaded
 * file. Deep parameter extraction/attachment happens in the Diagnostics
 * module (out of scope here). */
import { useState } from "react";
import { Loader2, ShieldCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { UploadResult } from "../types";

export default function LabReportVerify({
  data, uploads, onCancel, onDone,
}: {
  data: any;
  uploads: UploadResult[];
  onCancel: () => void;
  onDone: (id?: string) => void;
}) {
  const [patientName, setPatientName] = useState(data?.patient?.name || "");
  const [labName, setLabName] = useState(data?.labName || "");
  const [reportDate, setReportDate] = useState(data?.reportDate || "");
  const [saving, setSaving] = useState(false);
  const tests: any[] = Array.isArray(data?.tests) ? data.tests : [];

  const approve = async () => {
    if (!patientName.trim()) { toast.error("Patient name is required"); return; }
    setSaving(true);
    try {
      toast.success("Lab report captured. Attach it to a diagnostic order from Diagnostics.");
      onDone(uploads[0]?.storageKey);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="rounded-md border p-3 bg-muted/30 flex items-center gap-2 text-sm">
        <FileText className="h-4 w-4" />
        <span className="truncate">{uploads[0]?.name || "Uploaded report"}</span>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Patient</Label>
          <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Lab</Label>
          <Input value={labName} onChange={(e) => setLabName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Report date</Label>
          <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Parameters ({tests.length})</h3>
        <div className="rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left">
              <tr><th className="p-2">Test</th><th className="p-2">Value</th><th className="p-2">Unit</th><th className="p-2">Reference</th></tr>
            </thead>
            <tbody>
              {tests.map((t, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{t?.name || "—"}</td>
                  <td className="p-2">{t?.value || "—"}</td>
                  <td className="p-2">{t?.unit || "—"}</td>
                  <td className="p-2">{t?.reference || "—"}</td>
                </tr>
              ))}
              {tests.length === 0 && (
                <tr><td className="p-3 text-center text-muted-foreground" colSpan={4}>No parameters detected.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-center justify-end gap-2 border-t pt-4 sticky bottom-0 bg-background">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={approve} disabled={saving || !patientName.trim()}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
          Save
        </Button>
      </div>
    </div>
  );
}