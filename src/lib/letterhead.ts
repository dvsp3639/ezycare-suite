import type { HospitalProfile } from "@/modules/diagnostics/useHospitalProfile";
import { escapeHtml } from "@/lib/escapeHtml";

/** Document families that can carry their own letterhead overrides. */
export type LetterheadModule =
  | "opd"
  | "diagnostics"
  | "pharmacy"
  | "ipd"
  | "daycare"
  | "accounts";

export const LETTERHEAD_MODULES: { key: LetterheadModule; label: string; hint: string }[] = [
  { key: "opd", label: "OP / Prescriptions", hint: "Consultation prescriptions & OP receipts" },
  { key: "diagnostics", label: "Diagnostics", hint: "Lab & radiology reports" },
  { key: "pharmacy", label: "Pharmacy", hint: "Pharmacy bills, receipts & returns" },
  { key: "ipd", label: "IPD", hint: "Admission & discharge summaries" },
  { key: "daycare", label: "Day Care", hint: "Day care session bills" },
  { key: "accounts", label: "Accounts", hint: "Financial statements & reports" },
];

export interface LetterheadModuleConfig {
  showHeader?: boolean;
  showFooter?: boolean;
  footerNote?: string;
  accentColor?: string;
  titleOverride?: string;
}

/**
 * Builds a branded HTML header + footer + shared print styles based on the
 * hospital profile. If the admin has uploaded a letterhead image, it is used
 * as the header (edge-to-edge). Otherwise, a textual header composed from the
 * logo, hospital name, tagline and contact details is rendered.
 *
 * Per-module overrides (configured in Hospital Profile → Branding) let admins
 * tune the header/footer independently for OP, Diagnostics, Pharmacy, IPD, etc.
 *
 * Consumed by receipts / prescriptions / discharge summaries across modules.
 */
export function buildLetterhead(
  profile: HospitalProfile | null | undefined,
  opts: { title?: string; showFooter?: boolean; module?: LetterheadModule } = {}
) {
  const e = escapeHtml;
  const mod: LetterheadModuleConfig =
    (opts.module && profile?.letterheadModules?.[opts.module]) || {};
  const accent = mod.accentColor || profile?.accentColor || "#0d9488";
  const showHeader = mod.showHeader ?? profile?.showLetterheadHeader !== false;
  const showFooter =
    opts.showFooter !== false && (mod.showFooter ?? profile?.showLetterheadFooter !== false);

  const styles = `
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; }
    .lh-doc { max-width: 780px; margin: 0 auto; padding: 24px 32px; }
    .lh-header { border-bottom: 3px solid ${accent}; padding-bottom: 14px; margin-bottom: 20px; }
    .lh-header-img { width: 100%; display: block; }
    .lh-header-text { display:flex; align-items:center; gap:16px; }
    .lh-header-text img { height:56px; object-contain; }
    .lh-header-text .lh-name { font-size: 20px; font-weight: 800; color: ${accent}; margin:0; }
    .lh-header-text .lh-tag { font-size: 12px; color: #555; margin:2px 0; }
    .lh-header-text .lh-meta { font-size: 11px; color: #666; }
    .lh-title { text-align:center; font-size:15px; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin: 8px 0 18px; color:#333; }
    .lh-footer { margin-top: 28px; padding-top: 10px; border-top: 1px dashed #bbb; text-align: center; font-size: 11px; color: #666; }
    @media print { .lh-doc { padding: 12px 16px; } }
  `;

  let header = "";
  if (showHeader) {
    if (profile?.letterheadUrl) {
      header = `<div class="lh-header"><img src="${e(profile.letterheadUrl)}" class="lh-header-img" alt="Letterhead"/></div>`;
    } else if (profile) {
      const contactLine = [profile.address, profile.city, profile.state].filter(Boolean).map(e).join(", ");
      const commLine = [profile.phone ? `Tel: ${e(profile.phone)}` : "", profile.email ? e(profile.email) : "", profile.website ? e(profile.website) : ""].filter(Boolean).join(" • ");
      header = `
        <div class="lh-header lh-header-text">
          ${profile.logoUrl ? `<img src="${e(profile.logoUrl)}" alt="Logo"/>` : ""}
          <div>
            <p class="lh-name">${e(profile.name || "")}</p>
            ${profile.tagline ? `<p class="lh-tag">${e(profile.tagline)}</p>` : ""}
            ${contactLine ? `<p class="lh-meta">${contactLine}</p>` : ""}
            ${commLine ? `<p class="lh-meta">${commLine}</p>` : ""}
          </div>
        </div>`;
    }
  }

  const titleText = mod.titleOverride?.trim() || opts.title;
  const title = titleText ? `<div class="lh-title">${e(titleText)}</div>` : "";

  const footerNoteRaw = (mod.footerNote?.trim() || profile?.footerNote?.trim()) || "";
  const legal = [
    profile?.licenseNumber ? `Lic: ${e(profile.licenseNumber)}` : "",
    profile?.gstin ? `GSTIN: ${e(profile.gstin)}` : "",
  ].filter(Boolean).join(" • ");
  const footer = showFooter
    ? `<div class="lh-footer">${footerNoteRaw ? `<p>${e(footerNoteRaw)}</p>` : ""}${legal ? `<p>${legal}</p>` : ""}${!footerNoteRaw && !legal ? "<p>This is a computer-generated document.</p>" : ""}</div>`
    : "";

  return { styles, header: header + title, footer };
}