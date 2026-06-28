import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";

/** Singleton reader to avoid re-init churn. */
let _reader: BrowserMultiFormatReader | null = null;
function reader() { return (_reader ||= new BrowserMultiFormatReader()); }

export async function listVideoDevices() {
  try { return await BrowserMultiFormatReader.listVideoInputDevices(); }
  catch { return []; }
}

export async function decodeFromVideo(
  video: HTMLVideoElement,
  onResult: (text: string) => void,
  onError?: (err: unknown) => void,
): Promise<IScannerControls> {
  return await reader().decodeFromVideoDevice(undefined, video, (result, err, controls) => {
    if (result) {
      try { onResult(result.getText()); } catch (e) { onError?.(e); }
    } else if (err && err.name !== "NotFoundException") {
      onError?.(err);
    }
  });
}

export async function decodeFromImage(file: File | Blob): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const res = await reader().decodeFromImageElement(img);
    return res?.getText() ?? null;
  } catch { return null; }
  finally { URL.revokeObjectURL(url); }
}