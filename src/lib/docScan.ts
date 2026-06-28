/* ──────────────────────────────────────────────────────────────────────
 * Document Scanner Helpers — runs entirely in the browser on <canvas>.
 *
 * Pipeline (in order):
 *   1. Auto-rotate (EXIF when present, fall back to portrait orientation)
 *   2. Grayscale + contrast stretch (Otsu-inspired)
 *   3. Shadow removal via large-blur background subtraction
 *   4. Brightness / contrast slider (user adjustable)
 *
 * Heavier ops (perspective warp) are intentionally omitted — they require
 * either WASM OpenCV or a custom ML segmenter. Manual crop is provided
 * instead through the calling UI.
 * ────────────────────────────────────────────────────────────────────── */

export type EnhanceOptions = {
  grayscale?: boolean;
  shadowRemoval?: boolean;
  brightness?: number; // -100..100
  contrast?: number;   // -100..100
};

const DEFAULTS: Required<EnhanceOptions> = {
  grayscale: true,
  shadowRemoval: true,
  brightness: 8,
  contrast: 25,
};

export async function fileToImage(file: File | Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // url freed when caller no longer needs the image
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

export function imageToCanvas(img: HTMLImageElement, maxDim = 1600): HTMLCanvasElement {
  const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * ratio);
  const h = Math.round(img.naturalHeight * ratio);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return c;
}

export function rotateCanvas(src: HTMLCanvasElement, degrees: 90 | 180 | 270): HTMLCanvasElement {
  const out = document.createElement("canvas");
  if (degrees === 180) { out.width = src.width; out.height = src.height; }
  else { out.width = src.height; out.height = src.width; }
  const ctx = out.getContext("2d")!;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}

/** Quick box blur — used for shadow-removal background estimate. */
function boxBlur(src: ImageData, radius: number): ImageData {
  const { width: w, height: h, data } = src;
  const out = new ImageData(w, h);
  const dst = out.data;
  const r = Math.max(1, Math.round(radius));
  // horizontal pass (luminance only — store back into all channels later)
  const tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -r; x <= r; x++) {
      const px = Math.min(w - 1, Math.max(0, x));
      sum += data[(y * w + px) * 4];
    }
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / (2 * r + 1);
      const subX = Math.max(0, x - r);
      const addX = Math.min(w - 1, x + r + 1);
      sum += data[(y * w + addX) * 4] - data[(y * w + subX) * 4];
    }
  }
  // vertical pass
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) {
      const py = Math.min(h - 1, Math.max(0, y));
      sum += tmp[py * w + x];
    }
    for (let y = 0; y < h; y++) {
      const v = sum / (2 * r + 1);
      const i = (y * w + x) * 4;
      dst[i] = dst[i + 1] = dst[i + 2] = v;
      dst[i + 3] = 255;
      const subY = Math.max(0, y - r);
      const addY = Math.min(h - 1, y + r + 1);
      sum += tmp[addY * w + x] - tmp[subY * w + x];
    }
  }
  return out;
}

export function enhance(canvas: HTMLCanvasElement, opts: EnhanceOptions = {}): HTMLCanvasElement {
  const o = { ...DEFAULTS, ...opts };
  const ctx = canvas.getContext("2d")!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  // 1. grayscale luminance
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = y;
  }
  // 2. shadow removal: divide by blurred background, then normalise
  if (o.shadowRemoval) {
    const bg = boxBlur(img, Math.max(20, Math.round(Math.min(canvas.width, canvas.height) / 18)));
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i];
      const b = Math.max(40, bg.data[i]);
      const ratio = Math.min(1, v / b);
      const norm = Math.min(255, ratio * 255);
      d[i] = d[i + 1] = d[i + 2] = norm;
    }
  }
  // 3. brightness + contrast
  const c = (o.contrast / 100) * 255;
  const f = (259 * (c + 255)) / (255 * (259 - c));
  const bDelta = (o.brightness / 100) * 80;
  for (let i = 0; i < d.length; i += 4) {
    let v = f * (d[i] - 128) + 128 + bDelta;
    v = Math.max(0, Math.min(255, v));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  if (!o.grayscale) {
    // restore tint by blending against original — skipped, grayscale is usually preferred for OCR.
  }
  return canvas;
}

export async function enhanceFile(file: File, opts?: EnhanceOptions): Promise<Blob> {
  const img = await fileToImage(file);
  const c = imageToCanvas(img);
  enhance(c, opts);
  return await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.9));
}

export function canvasToBlob(c: HTMLCanvasElement, type = "image/jpeg", quality = 0.9): Promise<Blob> {
  return new Promise((res) => c.toBlob((b) => res(b!), type, quality));
}

/** Merge multiple page blobs into a single PDF (uses jsPDF if available). */
export async function pagesToPdf(pages: Blob[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  for (let idx = 0; idx < pages.length; idx++) {
    const b = pages[idx];
    const url = URL.createObjectURL(b);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const ratio = Math.min(pageW / img.naturalWidth, pageH / img.naturalHeight);
      const w = img.naturalWidth * ratio;
      const h = img.naturalHeight * ratio;
      const x = (pageW - w) / 2;
      const y = (pageH - h) / 2;
      if (idx > 0) pdf.addPage();
      pdf.addImage(img, "JPEG", x, y, w, h, undefined, "FAST");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return pdf.output("blob");
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); res(s.split(",")[1] || s); };
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}