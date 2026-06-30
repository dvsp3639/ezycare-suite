type TracePayload = Record<string, unknown>;

const TRACE_KEY = "ezyop:mobile-upload-trace";
const MAX_TRACE_ROWS = 250;

function basePayload() {
  if (typeof window === "undefined") return {};
  return {
    href: window.location.href,
    visibilityState: document.visibilityState,
    online: navigator.onLine,
    platform: navigator.platform,
    userAgent: navigator.userAgent,
  };
}

function serializeError(error: unknown) {
  if (!error) return null;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  if (typeof error === "object") {
    try { return JSON.parse(JSON.stringify(error)); } catch { return String(error); }
  }
  return String(error);
}

function persist(entry: TracePayload) {
  if (typeof window === "undefined") return;
  try {
    const previous = JSON.parse(window.localStorage.getItem(TRACE_KEY) || "[]");
    const next = Array.isArray(previous) ? [...previous, entry].slice(-MAX_TRACE_ROWS) : [entry];
    window.localStorage.setItem(TRACE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("mobile-upload-trace", { detail: entry }));
  } catch {
    // Debug logging must never break the scanner pipeline.
  }
}

export function fileDebugInfo(file: File | Blob | null | undefined) {
  if (!file) return null;
  const maybeFile = file as File;
  return {
    name: maybeFile.name || "blob",
    size: file.size,
    type: file.type || "",
    lastModified: maybeFile.lastModified || null,
    constructorName: (file as any)?.constructor?.name || typeof file,
    isFile: typeof File !== "undefined" ? file instanceof File : false,
    isBlob: typeof Blob !== "undefined" ? file instanceof Blob : false,
  };
}

export function traceUpload(step: string, payload: TracePayload = {}) {
  const entry = {
    ts: new Date().toISOString(),
    step,
    ...basePayload(),
    ...payload,
  };
  console.log(`[MOBILE-UPLOAD-TRACE] ${step}`, entry);
  persist(entry);
  return entry;
}

export function traceFailure(step: string, context: TracePayload, error: unknown) {
  const entry = {
    ts: new Date().toISOString(),
    step,
    failed: true,
    ...basePayload(),
    ...context,
    error: serializeError(error),
    stopReason: context.stopReason || "Execution stopped at this diagnostic checkpoint.",
  };
  console.error(`[MOBILE-UPLOAD-TRACE:FAIL] ${step}`, entry);
  persist(entry);
  return entry;
}

export function readUploadTrace(): TracePayload[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(TRACE_KEY) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function clearUploadTrace() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TRACE_KEY);
    window.dispatchEvent(new CustomEvent("mobile-upload-trace-cleared"));
  } catch {
    // no-op
  }
}

export function installMobileLifecycleTrace(component: string) {
  if (typeof window === "undefined") return () => {};
  const log = (eventName: string, event?: Event | PageTransitionEvent) => {
    traceUpload(`Lifecycle: ${eventName}`, {
      file: "src/lib/mobileUploadDiagnostics.ts",
      component,
      function: "installMobileLifecycleTrace",
      block: "window lifecycle event listener",
      persisted: "persisted" in (event || {}) ? Boolean((event as PageTransitionEvent).persisted) : undefined,
    });
  };
  const onVisibility = () => log(`visibilitychange:${document.visibilityState}`);
  const onPageHide = (event: PageTransitionEvent) => log("pagehide", event);
  const onPageShow = (event: PageTransitionEvent) => log("pageshow", event);
  const onFocus = () => log("focus");
  const onBlur = () => log("blur");
  const onBeforeUnload = () => log("beforeunload");

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("focus", onFocus);
  window.addEventListener("blur", onBlur);
  window.addEventListener("beforeunload", onBeforeUnload);

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("beforeunload", onBeforeUnload);
  };
}