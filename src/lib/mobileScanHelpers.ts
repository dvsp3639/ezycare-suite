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
 * file if it's already small or not an image. PDFs untouched. */
export async function compressImageFile(file: File, maxDim = 1600, quality = 0.78): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size < 350 * 1024) return file; // already small enough
  try {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * ratio);
    const h = Math.round(img.naturalHeight * ratio);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", quality));
    if (blob.size >= file.size) return file; // compression didn't help
    return new File([blob], file.name.replace(/\.(png|webp|heic)$/i, ".jpg"), { type: "image/jpeg" });
  } catch { return file; }
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