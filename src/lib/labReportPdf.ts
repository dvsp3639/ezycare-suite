import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export interface LabReportPdfInput {
  hospitalName?: string;
  testName: string;
  category: string;
  patientName: string;
  patientRegNo: string;
  orderedBy: string;
  priority: string;
  orderedAt: string;
  completedAt?: string;
  price: number;
  paymentStatus?: string;
  paymentMode?: string | null;
  reportNotes?: string;
  clinicalNotes?: string;
  results: { parameter: string; value: string; unit: string; normalRange: string; isAbnormal: boolean }[];
  autoPrint?: boolean;
}

/**
 * Build a Blob containing a formatted PDF lab report.
 * Used for non-radiology lab orders where the technician enters values manually.
 */
export function generateLabReportPdf(input: LabReportPdfInput): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(input.hospitalName || "EzyOp Diagnostics", pageWidth / 2, 50, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Laboratory Report", pageWidth / 2, 66, { align: "center" });
  doc.setDrawColor(180);
  doc.line(40, 76, pageWidth - 40, 76);

  // Patient info grid
  const rows: [string, string][] = [
    ["Patient", input.patientName],
    ["Reg No", input.patientRegNo],
    ["Test", input.testName],
    ["Category", input.category],
    ["Ordered By", input.orderedBy],
    ["Priority", input.priority],
    ["Ordered At", input.orderedAt || "—"],
    ["Completed At", input.completedAt || "—"],
    ["Amount", `INR ${input.price}`],
    ["Payment", `${input.paymentStatus || "—"}${input.paymentMode ? ` (${input.paymentMode})` : ""}`],
  ];
  doc.setFontSize(10);
  let y = 92;
  const colWidth = (pageWidth - 80) / 2;
  rows.forEach((r, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 40 + col * colWidth;
    const yy = y + row * 16;
    doc.setFont("helvetica", "bold");
    doc.text(`${r[0]}:`, x, yy);
    doc.setFont("helvetica", "normal");
    doc.text(String(r[1] ?? ""), x + 70, yy);
  });
  y = y + Math.ceil(rows.length / 2) * 16 + 8;

  // Results table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Test Results", 40, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [["Parameter", "Value", "Unit", "Normal Range", "Status"]],
    body: input.results.map((r) => [
      r.parameter,
      r.value,
      r.unit,
      r.normalRange,
      r.isAbnormal ? "ABNORMAL" : "Normal",
    ]),
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const txt = String(data.cell.raw || "");
        if (txt === "ABNORMAL") {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
      }
      if (data.section === "body" && data.column.index === 1) {
        const status = String(input.results[data.row.index]?.isAbnormal);
        if (status === "true") {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: 40, right: 40 },
  });

  // @ts-expect-error – autotable attaches lastAutoTable
  let cursorY = (doc.lastAutoTable?.finalY ?? y) + 20;

  const writeBlock = (title: string, body: string) => {
    if (!body) return;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, 40, cursorY);
    cursorY += 12;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(body, pageWidth - 80);
    doc.text(lines, 40, cursorY);
    cursorY += lines.length * 12 + 8;
  };

  writeBlock("Remarks", input.reportNotes || "");
  writeBlock("Clinical Notes (by Doctor)", input.clinicalNotes || "");

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 40;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Lab Technician: ___________________", 40, footerY);
  doc.text(`Date: ${format(new Date(), "dd/MM/yyyy")}`, pageWidth - 40, footerY, { align: "right" });

  if (input.autoPrint) {
    doc.autoPrint();
  }
  return doc.output("blob");
}