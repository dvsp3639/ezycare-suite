/* ──────────────────────────────────────────────────────────────────────
 * Mobile-scan helpers — keeps mobile (Android) scanner reliable & cheap.
 *
 *   • persistScannerOpen() — survives BFCache/tab eviction when the OS
 *     camera/file picker briefly takes over.
 *   • compressImageFile()  — resizes huge phone photos (~4–12 MP) down to
 *     ≤1600px JPEG@0.78 before they hit the AI. Cuts payload + tokens.
 *   • fileHash() + extractionCache — content-hash dedup so re-uploading
 *     the same page never spends AI credits twice in a session.
 * ────────────────────────────────────────────────────────────────────── */

export function persistScannerOpen(key: string, open: boolean) {
  try {
    if (open) sessionStorage.setItem(key, "1");
    else sessionStorage.removeItem(key);
  } catch { /* private mode / quota */ }
}

export function readScannerOpen(key: string): boolean {
  try { return sessionStorage.getItem(key) === "1"; } catch { return false; }
}

/** Compress an image File to JPEG with a max dimension. Returns the same
 * file if it's already small or not an image. PDFs untouched.
 * Uses createImageBitmap when available (works for HEIC on more Android
 * browsers than <img>.decode()), falls back to <img>. Never throws — on
 * failure it logs and returns the original file so the upload still proceeds. */
export async function compressImageFile(file: File, maxDim = 1600, quality = 0.78): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size < 350 * 1024) return file;
  const log = (...a: any[]) => console.log("[scan:compress]", file.name, ...a);
  try {
    let w = 0, h = 0;
    let drawSrc: CanvasImageSource | null = null;
    let bmp: ImageBitmap | null = null;
    let url: string | null = null;
    if (typeof createImageBitmap === "function") {
      try {
        bmp = await createImageBitmap(file);
        w = bmp.width; h = bmp.height; drawSrc = bmp;
      } catch (e) { log("createImageBitmap failed, falling back", e); }
    }
    if (!drawSrc) {
      url = URL.createObjectURL(file);
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      w = img.naturalWidth; h = img.naturalHeight; drawSrc = img;
    }
    const ratio = Math.min(1, maxDim / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * ratio));
    const ch = Math.max(1, Math.round(h * ratio));
    const c = document.createElement("canvas");
    c.width = cw; c.height = ch;
    c.getContext("2d")!.drawImage(drawSrc, 0, 0, cw, ch);
    bmp?.close?.();
    if (url) URL.revokeObjectURL(url);
    const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", quality));
    if (!blob || blob.size >= file.size) { log("no gain", { from: file.size, to: blob?.size }); return file; }
    log("ok", { fromKB: Math.round(file.size / 1024), toKB: Math.round(blob.size / 1024), w: cw, h: ch });
    return new File([blob], file.name.replace(/\.(png|webp|heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
  } catch (e) {
    console.warn("[scan:compress] failed, using original", file.name, e);
    return file;
  }
}

/** Cheap stable hash for dedup — SubtleCrypto when available, fallback FNV. */
export async function fileHash(file: File | Blob): Promise<string> {
  try {
    const buf = await file.arrayBuffer();
    const d = await crypto.subtle.digest("SHA-1", buf);
    return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    const txt = `${(file as any).name || ""}-${file.size}-${file.type}`;
    let h = 2166136261;
    for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return `fnv-${h.toString(16)}`;
  }
}

const _cache = new Map<string, any>();
export const extractionCache = {
  get(hash: string) { return _cache.get(hash); },
  set(hash: string, data: any) { if (_cache.size > 24) _cache.clear(); _cache.set(hash, data); },
  clear() { _cache.clear(); },
};