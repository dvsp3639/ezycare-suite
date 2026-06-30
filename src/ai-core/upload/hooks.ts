import { useCallback, useRef, useState } from "react";
import { prepareForUpload } from "./enhance";
import { uploadOne } from "./uploader";
import type { UploadItem } from "./types";

const newId = () =>
  (globalThis.crypto && "randomUUID" in globalThis.crypto)
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export type UseUploadEngineOptions = {
  folder?: string;
  maxFiles?: number;
  onComplete?: (items: UploadItem[]) => void;
};

/** Headless upload state machine. The UI component just renders this. */
export function useUploadEngine(opts: UseUploadEngineOptions = {}) {
  const { folder = "misc", maxFiles = 10, onComplete } = opts;
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef<UploadItem[]>([]);
  itemsRef.current = items;

  const patch = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((curr) => curr.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((curr) => {
      const item = curr.find((i) => i.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return curr.filter((i) => i.id !== id);
    });
  }, []);

  const reset = useCallback(() => {
    itemsRef.current.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
    setItems([]);
  }, []);

  const processOne = useCallback(async (item: UploadItem) => {
    try {
      patch(item.id, { status: "preparing", progress: 0.02 });
      const prepared = await prepareForUpload(item.file);
      patch(item.id, { status: "uploading", finalSize: prepared.size, progress: 0.1 });
      const { storageKey, signedUrl } = await uploadOne(prepared, {
        folder,
        onProgress: (pct) => patch(item.id, { progress: Math.max(0.1, pct) }),
      });
      patch(item.id, { status: "done", progress: 1, storageKey, signedUrl });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      console.error("[ai-core:upload]", item.file.name, msg);
      patch(item.id, { status: "error", errorMessage: msg });
    }
  }, [folder, patch]);

  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const room = Math.max(0, maxFiles - itemsRef.current.length);
    const accepted = files.slice(0, room);
    const queued: UploadItem[] = accepted.map((f) => ({
      id: newId(),
      file: f,
      originalSize: f.size,
      previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
      status: "queued",
      progress: 0,
      mime: f.type || "application/octet-stream",
    }));
    setItems((curr) => [...curr, ...queued]);
    // process sequentially to be kind to mobile bandwidth/memory
    for (const q of queued) {
      await processOne(q);
    }
    const after = itemsRef.current;
    const allTerminal = after.every((i) => i.status === "done" || i.status === "error");
    if (allTerminal && onComplete) onComplete(after);
  }, [maxFiles, onComplete, processOne]);

  const retry = useCallback((id: string) => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;
    void processOne({ ...item, status: "queued", progress: 0, errorMessage: undefined });
  }, [processOne]);

  return { items, addFiles, remove, retry, reset };
}