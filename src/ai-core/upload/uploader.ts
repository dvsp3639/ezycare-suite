/* AI Core uploader — talks only to the `ai-core-uploads` private bucket.
 * Path: {userId}/{folder}/{yyyy-mm-dd}/{uuid}.{ext}
 * Retries transient failures; surfaces progress via callback. */
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "ai-core-uploads";

function extFor(file: File): string {
  const m = /\.([a-z0-9]+)$/i.exec(file.name);
  if (m) return m[1].toLowerCase();
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/heic" || file.type === "image/heif") return "heic";
  return "jpg";
}

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type UploadOneResult = { storageKey: string; signedUrl: string };

export async function uploadOne(
  file: File,
  opts: { folder?: string; onProgress?: (pct: number) => void } = {},
): Promise<UploadOneResult> {
  const { folder = "misc", onProgress } = opts;
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) throw new Error("Not authenticated");
  const userId = userRes.user.id;

  const id =
    (globalThis.crypto && "randomUUID" in globalThis.crypto)
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const key = `${userId}/${folder}/${todayStamp()}/${id}.${extFor(file)}`;

  onProgress?.(0.05);

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { error } = await supabase.storage.from(BUCKET).upload(key, file, {
        upsert: false,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      });
      if (error) throw error;
      onProgress?.(0.85);
      const { data: signed, error: sErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(key, 60 * 60);
      if (sErr || !signed?.signedUrl) throw sErr ?? new Error("signed-url-failed");
      onProgress?.(1);
      return { storageKey: key, signedUrl: signed.signedUrl };
    } catch (e) {
      lastErr = e;
      console.warn(`[ai-core:upload] attempt ${attempt} failed`, e);
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Upload failed");
}