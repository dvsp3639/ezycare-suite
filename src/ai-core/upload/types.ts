/* AI Core — Layer 1 (Universal Upload Engine) types. */

export type UploadStatus = "queued" | "preparing" | "uploading" | "done" | "error";

export type UploadItem = {
  id: string;
  file: File;
  originalSize: number;
  finalSize?: number;
  previewUrl?: string;
  status: UploadStatus;
  progress: number;
  errorMessage?: string;
  storageKey?: string;
  signedUrl?: string;
  mime: string;
};

export type UploadEngineAccept = "image/*" | "application/pdf" | "image/*,application/pdf";

export type UploadEngineProps = {
  open: boolean;
  onClose: () => void;
  onComplete?: (items: UploadItem[]) => void;
  accept?: UploadEngineAccept;
  multiple?: boolean;
  maxFiles?: number;
  folder?: string;
  title?: string;
  subtitle?: string;
};