import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MobileUploadEngine, type UploadResult } from "@/ai-engine-v2";

export default function AiEngineV2Test() {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<UploadResult[]>([]);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>AI Engine V2 · Phase 1 — MobileUploadEngine</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Completely standalone uploader. No OCR, no AI, no Pharmacy/Inventory/Billing
            coupling. Verify on a real Android phone, iPhone Safari, and desktop browsers.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>Camera capture</li>
            <li>Single &amp; multiple image gallery picks</li>
            <li>Single &amp; multiple PDF picks</li>
            <li>Progress, retry on failure</li>
            <li>Picker cancel must NOT close the overlay</li>
            <li>File select must NOT navigate away</li>
          </ul>
          <Button onClick={() => setOpen(true)}>Open Mobile Uploader</Button>
        </CardContent>
      </Card>

      {last.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Last completed session</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {last.map((r) => (
              <div key={r.id} className="rounded border p-2">
                <div className="font-medium truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.mime} · {(r.size / 1024).toFixed(0)} KB
                </div>
                <div className="text-[11px] text-muted-foreground break-all">key: {r.storageKey}</div>
                <a className="text-xs text-primary underline break-all" href={r.signedUrl} target="_blank" rel="noreferrer">
                  Open signed URL
                </a>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <MobileUploadEngine
        open={open}
        onClose={() => setOpen(false)}
        onComplete={(results) => setLast(results)}
        folder="phase1-test"
        title="AI Engine V2 · Upload"
        subtitle="Phase 1 verification. Multi-file, mobile-first."
      />
    </div>
  );
}