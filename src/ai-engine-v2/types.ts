/* AI Engine V2 — Phase 1 types.
 * Intentionally standalone: no imports from /ai-core, /modules, /lib helpers
 * tied to the existing scanner. */

export type UploadPhase =
  | "queued"
  | "uploading"
  | "done"
  | "error";

export type UploadFile = {
  id: string;
  file: File;
  name: string;
  size: number;
  mime: string;
  previewUrl?: string;       // object URL for images (revoked on remove/reset)
  status: UploadPhase;
  progress: number;          // 0..1
  errorMessage?: string;
  storageKey?: string;       // path inside the bucket once uploaded
  signedUrl?: string;        // 1-hour signed URL for downstream phases
  uploadedAt?: string;
};

export type UploadResult = {
  id: string;
  name: string;
  size: number;
  mime: string;
  storageKey: string;
  signedUrl: string;
  uploadedAt: string;
};

export type MobileUploadEngineProps = {
  open: boolean;
  onClose: () => void;
  /** Fires only after every queued file is either `done` or `error`. */
  onComplete?: (results: UploadResult[]) => void;
  accept?: string;           // default: "image/*,application/pdf"
  multiple?: boolean;        // default: true
  maxFiles?: number;         // default: 10
  folder?: string;           // bucket subfolder, default: "v2"
  title?: string;
  subtitle?: string;
};