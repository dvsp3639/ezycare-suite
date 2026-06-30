/* Image enhancement — thin wrapper over existing docScan helpers.
 * No AI here. Pure browser-side prep before upload. */
import { enhanceFile } from "@/lib/docScan";
import { compressImageFile } from "@/lib/mobileScanHelpers";

/** Prepare a file for upload: enhance + compress for images, passthrough for PDFs.
 * Never throws — on error returns the original file. */
export async function prepareForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    // Enhance (grayscale, shadow-remove, contrast) only for sizeable photos.
    const shouldEnhance = file.size > 600 * 1024;
    let working: File = file;
    if (shouldEnhance) {
      try {
        const blob = await enhanceFile(file, { grayscale: false, shadowRemoval: true, brightness: 4, contrast: 12 });
        working = new File([blob], file.name.replace(/\.(png|webp|heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
      } catch (e) {
        console.warn("[ai-core:enhance] enhanceFile failed, skipping", e);
      }
    }
    return await compressImageFile(working, 1600, 0.78);
  } catch (e) {
    console.warn("[ai-core:enhance] prepare failed, using original", e);
    return file;
  }
}