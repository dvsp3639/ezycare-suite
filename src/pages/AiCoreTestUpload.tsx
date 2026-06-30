import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadEngine } from "@/ai-core";
import type { UploadItem } from "@/ai-core";

export default function AiCoreTestUpload() {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<UploadItem[]>([]);
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <Card>
        <CardHeader><CardTitle>AI Core · Layer 1 — Universal Upload Engine</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Verify uploads on real Android + desktop. Files land in the private
            <code> ai-core-uploads </code> bucket under your user folder. No AI runs in this layer.
          </p>
          <Button onClick={() => setOpen(true)}>Open Uploader</Button>
        </CardContent>
      </Card>
      {last.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Last session</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {last.map((i) => (
              <div key={i.id} className="rounded border p-2">
                <div className="font-medium truncate">{i.file.name} — {i.status}</div>
                {i.storageKey && <div className="text-xs text-muted-foreground break-all">key: {i.storageKey}</div>}
                {i.signedUrl && (
                  <a className="text-xs text-primary underline break-all" href={i.signedUrl} target="_blank" rel="noreferrer">
                    Open signed URL
                  </a>
                )}
                {i.errorMessage && <div className="text-xs text-destructive">{i.errorMessage}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <UploadEngine
        open={open}
        onClose={() => setOpen(false)}
        onComplete={(items) => setLast(items)}
        folder="test"
        title="AI Core Upload Test"
        subtitle="Layer 1 verification — pick or capture a few files."
      />
    </div>
  );
}