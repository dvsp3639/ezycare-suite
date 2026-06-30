import { useCallback, useEffect, useRef, useState } from "react";
import { uploadFile } from "./uploader";
import type { UploadFile, UploadResult } from "./types";

const newId = () =>
  (globalThis.crypto && "randomUUID" in globalThis.crypto)
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export type UseUploadQueueOpts = {
  folder?: string;
  maxFiles?: number;
  onComplete?: (results: UploadResult[]) => void;
};

/** Headless queue. Sequential uploads — kind to Android bandwidth/memory. */
export function useUploadQueue(opts: UseUploadQueueOpts = {}) {
  const { folder = "v2", maxFiles = 10, onComplete } = opts;
  const [items, setItems] = useState<UploadFile[]>([]);
  const itemsRef = useRef<UploadFile[]>([]);
  itemsRef.current = items;
  const runningRef = useRef(false);

  const patch = useCallback((id: string, p: Partial<UploadFile>) => {
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((cur) => {
      const it = cur.find((i) => i.id === id);
      if (it?.previewUrl) URL.revokeObjectURL(it.previewUrl);
      return cur.filter((i) => i.id !== id);
    });
  }, []);

  const reset = useCallback(() => {
    itemsRef.current.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
    setItems([]);
  }, []);

  const processOne = useCallback(async (item: UploadFile) => {
    patch(item.id, { status: "uploading", progress: 0.05 });
    try {
      const r = await uploadFile(item.file, {
        folder,
        onProgress: (pct) => patch(item.id, { progress: Math.max(0.05, pct) }),
      });
      patch(item.id, {
        status: "done",
        progress: 1,
        storageKey: r.storageKey,
        signedUrl: r.signedUrl,
        uploadedAt: r.uploadedAt,
      });
    } catch (e) {
      patch(item.id, {
        status: "error",
        errorMessage: e instanceof Error ? e.message : "Upload failed",
      });
    }
  }, [folder, patch]);

  const drain = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      while (true) {
        const next = itemsRef.current.find((i) => i.status === "queued");
        if (!next) break;
        await processOne(next);
      }
      const after = itemsRef.current;
      const allTerminal = after.length > 0 && after.every((i) => i.status === "done" || i.status === "error");
      if (allTerminal && onComplete) {
        const results: UploadResult[] = after
          .filter((i) => i.status === "done" && i.storageKey && i.signedUrl && i.uploadedAt)
          .map((i) => ({
            id: i.id,
            name: i.name,
            size: i.size,
            mime: i.mime,
            storageKey: i.storageKey!,
            signedUrl: i.signedUrl!,
            uploadedAt: i.uploadedAt!,
          }));
        onComplete(results);
      }
    } finally {
      runningRef.current = false;
    }
  }, [onComplete, processOne]);

  const addFiles = useCallback((files: File[]) => {
    if (!files.length) return;
    const room = Math.max(0, maxFiles - itemsRef.current.length);
    const accepted = files.slice(0, room);
    const queued: UploadFile[] = accepted.map((f) => ({
      id: newId(),
      file: f,
      name: f.name || "file",
      size: f.size,
      mime: f.type || "application/octet-stream",
      previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
      status: "queued",
      progress: 0,
    }));
    setItems((cur) => [...cur, ...queued]);
  }, [maxFiles]);

  const retry = useCallback((id: string) => {
    patch(id, { status: "queued", progress: 0, errorMessage: undefined });
  }, [patch]);

  // Auto-drain whenever a queued item appears.
  useEffect(() => {
    if (items.some((i) => i.status === "queued")) void drain();
  }, [items, drain]);

  return { items, addFiles, remove, retry, reset };
}