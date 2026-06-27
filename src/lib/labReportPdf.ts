import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import QRCode from "qrcode";
import type { HospitalProfile } from "@/modules/diagnostics/useHospitalProfile";
import {
  DEFAULT_LAB_REPORT_CONFIG,
  classifyResult,
  hexToRgb,
  statusRgb,
  type LabReportConfig,
} from "./labReportConfig";

export interface LabReportResultInput {
  parameter: string;
  value: string;
  unit: string;
  normalRange: string;
  isAbnormal: boolean;
  previousValue?: string;        // for trend comparison
}

export interface LabReportPdfInput {
  hospital?: Partial<HospitalProfile>;
  config?: Partial<LabReportConfig>;
  testName: string;
  category: string;
  patientName: string;
  patientRegNo: string;
  patientAge?: string;
  patientGender?: string;
  patientMobile?: string;
  patientAddress?: string;
  uhid?: string;
  labId?: string;
  sampleId?: string;
  opIpNumber?: string;
  ward?: string;
  department?: string;
  sampleType?: string;
  sampleCollectedAt?: string;
  sampleReceivedAt?: string;
  orderedBy: string;
  priority: string;
  orderedAt: string;
  completedAt?: string;
  price: number;
  paymentStatus?: string;
  paymentMode?: string | null;
  reportNotes?: string;
  clinicalNotes?: string;
  clinicalInterpretation?: string;
  results: LabReportResultInput[];
  autoPrint?: boolean;
  reportId?: string;             // used to build the verification URL
}

/**
 * Premium A4/Letter lab report — header w/ branding, patient panel, sample
 * tracing, classified result table, optional clinical interpretation + trend,
 * verification block, footer w/ page numbers.
 *
 * Synchronous wrapper kept for callers that don't pass a logo/QR code.
 */
export function generateLabReportPdf(input: LabReportPdfInput): Blob {
  const doc = buildDoc(input, null, null);
  if (input.autoPrint) doc.autoPrint();
  return doc.output("blob");
}

/**
 * Async generator — fetches the QR code (and logo, if provided) before
 * rendering. Prefer this in the app; falls back gracefully if the network is
 * offline or the logo URL is invalid.
 */
export async function generateLabReportPdfAsync(input: LabReportPdfInput): Promise<Blob> {
  const config = { ...DEFAULT_LAB_REPORT_CONFIG, ...(input.config || {}) };
  let qrDataUrl: string | null = null;
  if (config.showQrCode) {
    const verifyUrl = `${config.verifyBaseUrl}/verify/lab/${input.reportId || input.patientRegNo || "report"}`;
    try {
      qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 256 });
    } catch {
      qrDataUrl = null;
    }
  }
  let logoDataUrl: string | null = null;
  if (config.logoUrl) {
    try {
      logoDataUrl = await loadImageAsDataUrl(config.logoUrl);
    } catch {
      logoDataUrl = null;
    }
  }
  const doc = buildDoc(input, logoDataUrl, qrDataUrl);
  if (input.autoPrint) doc.autoPrint();
  return doc.output("blob");
}

async function loadImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function buildDoc(input: LabReportPdfInput, logoDataUrl: string | null, qrDataUrl: string | null): jsPDF {
  const config = { ...DEFAULT_LAB_REPORT_CONFIG, ...(input.config || {}) };
  const hospital = input.hospital || {};
  const accent = hexToRgb(config.accentColor);

  const doc = new jsPDF({ unit: "pt", format: config.paperSize === "letter" ? "letter" : "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const M = 34; // 12mm-ish

  // ─── Optional watermark ───
  if (config.showWatermark && config.watermarkText) {
    (doc as any).saveGraphicsState?.();
    (doc as any).setGState?.(new (doc as any).GState({ opacity: 0.06 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(96);
    doc.setTextColor(120);
    doc.text(config.watermarkText, pageWidth / 2, pageHeight / 2, { align: "center", angle: 30 });
    (doc as any).restoreGraphicsState?.();
    doc.setTextColor(0);
  }

  // ─── HEADER ───
  let y = M;
  // Accent bar
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 0, pageWidth, 6, "F");
  y += 4;

  // Logo (left)
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", M, y, 56, 56);
    } catch {/* ignore */}
  }

  // Hospital name + contact (centre/left of logo)
  const headerLeft = logoDataUrl ? M + 66 : M;
  const headerRight = qrDataUrl ? pageWidth - M - 64 : pageWidth - M;
  const headerWidth = headerRight - headerLeft;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text(hospital.name || "EzyOp Diagnostics", headerLeft, y + 14, { maxWidth: headerWidth });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(85, 85, 85);
  const contactLines: string[] = [];
  const addressLine = [hospital.address, hospital.city, hospital.state].filter(Boolean).join(", ");
  if (addressLine) contactLines.push(addressLine);
  const contact1 = [hospital.phone && `Tel: ${hospital.phone}`, hospital.email && `Email: ${hospital.email}`].filter(Boolean).join("  •  ");
  if (contact1) contactLines.push(contact1);
  if (hospital.licenseNumber) contactLines.push(`License: ${hospital.licenseNumber}`);
  contactLines.forEach((line, i) => doc.text(line, headerLeft, y + 28 + i * 11, { maxWidth: headerWidth }));

  // Accreditation chips
  if (config.showAccreditation && config.accreditation.length) {
    const chipY = y + 28 + contactLines.length * 11 + 4;
    let chipX = headerLeft;
    doc.setFontSize(8);
    config.accreditation.forEach((label) => {
      const w = doc.getTextWidth(label) + 12;
      doc.setDrawColor(accent[0], accent[1], accent[2]);
      doc.setFillColor(accent[0], accent[1], accent[2]);
      doc.roundedRect(chipX, chipY - 8, w, 12, 2, 2, "S");
      doc.setTextColor(accent[0], accent[1], accent[2]);
      doc.text(label, chipX + 6, chipY);
      chipX += w + 4;
    });
    doc.setTextColor(0);
  }

  // QR (right)
  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, "PNG", pageWidth - M - 56, y, 56, 56);
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text("Scan to verify", pageWidth - M - 28, y + 64, { align: "center" });
    } catch {/* ignore */}
  }

  // Title strip
  y = Math.max(y + 72, y + 72);
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(M, y, pageWidth - 2 * M, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("LABORATORY REPORT", M + 10, y + 15);
  doc.setFontSize(9);
  doc.text(`Priority: ${input.priority || "Routine"}`, pageWidth - M - 10, y + 15, { align: "right" });
  doc.setTextColor(0);
  y += 32;

  // ─── PATIENT PANEL (2-col) ───
  const colW = (pageWidth - 2 * M - 12) / 2;
  const leftRows: [string, string][] = [
    ["Patient", input.patientName || "—"],
    ["UHID", input.uhid || input.patientRegNo || "—"],
    ["Age / Gender", [input.patientAge, input.patientGender].filter(Boolean).join(" / ") || "—"],
    ["Mobile", input.patientMobile || "—"],
    ["Address", input.patientAddress || "—"],
  ];
  const rightRows: [string, string][] = [
    ["Lab ID", input.labId || input.reportId || "—"],
    ["Sample ID", input.sampleId || "—"],
    ["OP / IP No.", input.opIpNumber || "—"],
    ["Referring Doctor", input.orderedBy || "—"],
    ["Department", input.department || input.category || "—"],
    ...(input.ward ? ([["Ward / Bed", input.ward]] as [string, string][]) : []),
  ];
  y = drawInfoPanel(doc, M, y, colW, leftRows, rightRows, accent);
  y += 8;

  // ─── INVESTIGATION DETAILS ───
  const investRows: [string, string][] = [
    ["Test", input.testName],
    ["Sample Type", input.sampleType || defaultSampleType(input.category)],
    ["Collected", input.sampleCollectedAt || input.orderedAt || "—"],
    ["Received", input.sampleReceivedAt || input.orderedAt || "—"],
    ["Reported", input.completedAt || format(new Date(), "dd/MM/yyyy HH:mm")],
  ];
  y = drawCompactStrip(doc, M, y, pageWidth - 2 * M, investRows, accent);
  y += 8;

  // ─── RESULTS TABLE ───
  const hasTrend = config.showTrend && input.results.some((r) => r.previousValue);
  const head = hasTrend
    ? [["Test", "Result", "Previous", "Unit", "Reference Range", "Status"]]
    : [["Test", "Result", "Unit", "Reference Range", "Status"]];

  const body = input.results.map((r) => {
    const cls = classifyResult(r.value, r.normalRange, r.isAbnormal);
    const resultCell = cls.isAbnormal
      ? `${r.value}  ${cls.status === "high" ? "↑" : cls.status === "low" ? "↓" : ""}`.trim()
      : r.value;
    const row = [
      r.parameter,
      resultCell,
      ...(hasTrend ? [r.previousValue || "—"] : []),
      r.unit || "—",
      r.normalRange || "—",
      cls.label,
    ];
    return row;
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: "grid",
    headStyles: { fillColor: accent, textColor: 255, fontSize: 9.5, fontStyle: "bold" },
    bodyStyles: { fontSize: 9.5, textColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { cellPadding: 6, lineColor: [226, 232, 240], lineWidth: 0.4 },
    margin: { left: M, right: M },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const r = input.results[data.row.index];
      if (!r) return;
      const cls = classifyResult(r.value, r.normalRange, r.isAbnormal);
      const resultColIdx = 1;
      const statusColIdx = hasTrend ? 5 : 4;
      if (cls.isAbnormal && data.column.index === resultColIdx) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = statusRgb(cls.status);
      }
      if (data.column.index === statusColIdx) {
        data.cell.styles.textColor = statusRgb(cls.status);
        if (cls.isAbnormal) data.cell.styles.fontStyle = "bold";
      }
    },
  });
  let cursorY = ((doc as any).lastAutoTable?.finalY ?? y) + 14;

  // ─── Clinical interpretation + remarks ───
  const writeBlock = (title: string, body: string, accentColor?: [number, number, number]) => {
    if (!body) return;
    if (cursorY > pageHeight - 130) { doc.addPage(); cursorY = M; }
    doc.setFillColor(248, 250, 252);
    doc.rect(M, cursorY, pageWidth - 2 * M, 18, "F");
    if (accentColor) {
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.rect(M, cursorY, 3, 18, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text(title, M + 8, cursorY + 12);
    cursorY += 22;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(body, pageWidth - 2 * M - 8);
    doc.text(lines, M + 4, cursorY);
    cursorY += lines.length * 12 + 10;
  };

  if (config.showClinicalInterpretation && input.clinicalInterpretation) {
    writeBlock("Clinical Interpretation", input.clinicalInterpretation, accent);
  }
  if (input.reportNotes) writeBlock("Remarks", input.reportNotes);
  if (input.clinicalNotes) writeBlock("Clinical Notes (Referring Doctor)", input.clinicalNotes);

  // ─── Verification block ───
  if (cursorY > pageHeight - 130) { doc.addPage(); cursorY = M; }
  cursorY += 6;
  doc.setDrawColor(226, 232, 240);
  doc.line(M, cursorY, pageWidth - M, cursorY);
  cursorY += 14;
  const sigColW = (pageWidth - 2 * M) / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(config.preparedByLabel, M, cursorY);
  doc.text(config.verifiedByLabel, M + sigColW, cursorY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text("Lab Technician", M, cursorY + 36);
  doc.text(config.pathologistName || "Consultant Pathologist", M + sigColW, cursorY + 24);
  if (config.pathologistReg) {
    doc.text(`Reg No: ${config.pathologistReg}`, M + sigColW, cursorY + 36);
  }
  doc.text(`Verified: ${input.completedAt || format(new Date(), "dd/MM/yyyy HH:mm")}`, M + sigColW, cursorY + 48);

  // ─── Footer (every page) — confidentiality + page numbers ───
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const fy = pageHeight - 30;
    doc.setDrawColor(226, 232, 240);
    doc.line(M, fy - 10, pageWidth - M, fy - 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    const noticeLines = doc.splitTextToSize(config.confidentialityNotice, pageWidth - 2 * M - 120);
    doc.text(noticeLines, M, fy - 2);
    doc.text(`TAT: ${config.turnaroundTime}`, M, pageHeight - 12);
    doc.text(`Support: ${config.customerSupport}`, pageWidth / 2, pageHeight - 12, { align: "center" });
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - M, pageHeight - 12, { align: "right" });
  }

  return doc;
}

function drawInfoPanel(
  doc: jsPDF,
  x: number,
  y: number,
  colW: number,
  leftRows: [string, string][],
  rightRows: [string, string][],
  accent: [number, number, number],
): number {
  const rows = Math.max(leftRows.length, rightRows.length);
  const rowH = 16;
  const h = rows * rowH + 12;

  doc.setFillColor(249, 250, 251);
  doc.roundedRect(x, y, colW * 2 + 12, h, 4, 4, "F");
  doc.setDrawColor(accent[0], accent[1], accent[2]);
  doc.setLineWidth(0.6);
  doc.line(x, y, x + colW * 2 + 12, y);
  doc.setLineWidth(0.2);

  const renderCol = (rows: [string, string][], colX: number) => {
    rows.forEach((r, i) => {
      const yy = y + 14 + i * rowH;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(95, 95, 95);
      doc.text(r[0].toUpperCase(), colX + 8, yy);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(20, 20, 20);
      doc.text(String(r[1] ?? "—"), colX + 8 + 90, yy, { maxWidth: colW - 100 });
    });
  };
  renderCol(leftRows, x);
  renderCol(rightRows, x + colW + 12);
  return y + h;
}

function drawCompactStrip(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  rows: [string, string][],
  accent: [number, number, number],
): number {
  const h = 36;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(accent[0], accent[1], accent[2]);
  doc.roundedRect(x, y, w, h, 4, 4, "S");
  const cellW = w / rows.length;
  rows.forEach((r, i) => {
    const cx = x + i * cellW;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(r[0].toUpperCase(), cx + 8, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 20);
    doc.text(String(r[1] ?? "—"), cx + 8, y + 28, { maxWidth: cellW - 16 });
    if (i < rows.length - 1) {
      doc.setDrawColor(229, 231, 235);
      doc.line(cx + cellW, y + 4, cx + cellW, y + h - 4);
    }
  });
  return y + h;
}

function defaultSampleType(category: string): string {
  switch ((category || "").toLowerCase()) {
    case "blood": return "Whole Blood / Serum";
    case "urine": return "Urine";
    case "serology": return "Serum";
    case "radiology": return "Imaging";
    default: return "—";
  }
}