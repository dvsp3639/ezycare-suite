/* AI Engine V2 — standalone uploader.
 * Talks only to the private `ai-core-uploads` bucket. No image manipulation,
 * no compression, no AI. The file is uploaded exactly as picked. */
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "ai-core-uploads";
const MAX_ATTEMPTS = 3;

function extOf(file: File): string {
  const m = /\.([a-z0-9]+)$/i.exec(file.name);
  if (m) return m[1].toLowerCase();
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/heic" || file.type === "image/heif") return "heic";
  return "jpg";
}

function ymd(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function uuid(): string {
  return (globalThis.crypto && "randomUUID" in globalThis.crypto)
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export type UploadOneOpts = {
  folder?: string;
  onProgress?: (pct: number) => void;
};

export type UploadOneResult = {
  storageKey: string;
  signedUrl: string;
  uploadedAt: string;
};

export async function uploadFile(file: File, opts: UploadOneOpts = {}): Promise<UploadOneResult> {
  const { folder = "v2", onProgress } = opts;
  const { data: ures, error: uerr } = await supabase.auth.getUser();
  if (uerr || !ures?.user) throw new Error("Not signed in");
  const userId = ures.user.id;
  const key = `${userId}/${folder}/${ymd()}/${uuid()}.${extOf(file)}`;

  onProgress?.(0.05);

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { error } = await supabase.storage.from(BUCKET).upload(key, file, {
        upsert: false,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      });
      if (error) throw error;
      onProgress?.(0.85);
      const { data: signed, error: serr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(key, 60 * 60);
      if (serr || !signed?.signedUrl) throw serr ?? new Error("signed-url-failed");
      onProgress?.(1);
      return { storageKey: key, signedUrl: signed.signedUrl, uploadedAt: new Date().toISOString() };
    } catch (e) {
      lastErr = e;
      // eslint-disable-next-line no-console
      console.warn(`[ai-engine-v2:upload] attempt ${attempt} failed`, e);
      if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Upload failed");
}