// Premium Laboratory Report — configurable template engine
// Every hospital can override these without code changes (localStorage scope:
// `ezyop:lab-report-config`). UI surfaces can write into the same key.

export interface LabReportConfig {
  accentColor: string;            // hex e.g. "#0ea5e9"
  paperSize: "a4" | "letter";
  showClinicalInterpretation: boolean;
  showTrend: boolean;
  showWatermark: boolean;
  watermarkText: string;
  showQrCode: boolean;
  showAccreditation: boolean;
  accreditation: string[];        // e.g. ["NABL", "NABH"]
  preparedByLabel: string;
  verifiedByLabel: string;
  pathologistName: string;
  pathologistReg: string;
  digitalSignatureUrl?: string;
  logoUrl?: string;
  confidentialityNotice: string;
  customerSupport: string;
  turnaroundTime: string;
  verifyBaseUrl: string;          // public URL used for QR verification
  language: "en" | "te" | "hi";
}

export const DEFAULT_LAB_REPORT_CONFIG: LabReportConfig = {
  accentColor: "#0d9488",
  paperSize: "a4",
  showClinicalInterpretation: true,
  showTrend: true,
  showWatermark: false,
  watermarkText: "ORIGINAL",
  showQrCode: true,
  showAccreditation: true,
  accreditation: ["NABL"],
  preparedByLabel: "Prepared By",
  verifiedByLabel: "Verified By",
  pathologistName: "",
  pathologistReg: "",
  confidentialityNotice:
    "This report is confidential and intended solely for the named patient and the referring clinician. Test results should always be correlated clinically.",
  customerSupport: "support@ezyop.in",
  turnaroundTime: "Routine: 24h • STAT: 2h",
  verifyBaseUrl: typeof window !== "undefined" ? window.location.origin : "https://ezyop.in",
  language: "en",
};

const STORAGE_KEY = "ezyop:lab-report-config";

export function loadLabReportConfig(): LabReportConfig {
  if (typeof window === "undefined") return DEFAULT_LAB_REPORT_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAB_REPORT_CONFIG;
    return { ...DEFAULT_LAB_REPORT_CONFIG, ...(JSON.parse(raw) as Partial<LabReportConfig>) };
  } catch {
    return DEFAULT_LAB_REPORT_CONFIG;
  }
}

export function saveLabReportConfig(patch: Partial<LabReportConfig>) {
  if (typeof window === "undefined") return;
  const current = loadLabReportConfig();
  const next = { ...current, ...patch };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

// ─── Result classification (Normal / Borderline / Critical / High / Low) ───
export type ResultStatus = "normal" | "borderline" | "critical" | "high" | "low";

export interface ResultClassification {
  status: ResultStatus;
  label: string;          // e.g. "Normal", "↑ High", "🔴 Critical"
  isAbnormal: boolean;
  delta?: "up" | "down" | "flat";
}

/**
 * Parse a "normal range" string into [low, high]. Supports formats like
 * "70-100", "< 200", "> 40", "0.4-4.0". Returns null when the range can't be
 * parsed (e.g. textual ranges like "Non-Reactive" / "Negative").
 */
function parseRange(range: string): { low: number | null; high: number | null } | null {
  if (!range) return null;
  const cleaned = range.replace(/[,\s]/g, "").replace(/–|—/g, "-");
  const lt = cleaned.match(/^<=?(-?\d+(\.\d+)?)$/);
  if (lt) return { low: null, high: Number(lt[1]) };
  const gt = cleaned.match(/^>=?(-?\d+(\.\d+)?)$/);
  if (gt) return { low: Number(gt[1]), high: null };
  const between = cleaned.match(/^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/);
  if (between) return { low: Number(between[1]), high: Number(between[2]) };
  return null;
}

export function classifyResult(
  value: string,
  normalRange: string,
  fallbackAbnormal = false,
): ResultClassification {
  const numeric = Number(String(value).replace(/[^\d.\-]/g, ""));
  const range = parseRange(normalRange);
  if (!range || Number.isNaN(numeric) || value.trim() === "") {
    return fallbackAbnormal
      ? { status: "critical", label: "🔴 Abnormal", isAbnormal: true }
      : { status: "normal", label: "🟢 Normal", isAbnormal: false };
  }
  const { low, high } = range;

  // Critical thresholds = 25% beyond the reference window.
  const span = (high ?? 0) - (low ?? 0);
  const margin = Math.max(Math.abs(span) * 0.25, Math.abs(high ?? low ?? 1) * 0.1);

  if (low !== null && numeric < low) {
    if (numeric < low - margin) return { status: "critical", label: "🔴 Critical Low", isAbnormal: true };
    return { status: "low", label: "↓ Low", isAbnormal: true };
  }
  if (high !== null && numeric > high) {
    if (numeric > high + margin) return { status: "critical", label: "🔴 Critical High", isAbnormal: true };
    return { status: "high", label: "↑ High", isAbnormal: true };
  }
  // Borderline if within 5% of either edge of a two-sided range.
  if (low !== null && high !== null) {
    const edge = Math.abs(high - low) * 0.05;
    if (numeric <= low + edge || numeric >= high - edge) {
      return { status: "borderline", label: "🟡 Borderline", isAbnormal: false };
    }
  }
  return { status: "normal", label: "🟢 Normal", isAbnormal: false };
}

export function statusRgb(status: ResultStatus): [number, number, number] {
  switch (status) {
    case "critical": return [220, 38, 38];
    case "high":
    case "low": return [217, 119, 6];
    case "borderline": return [202, 138, 4];
    default: return [22, 163, 74];
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return [13, 148, 136];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}