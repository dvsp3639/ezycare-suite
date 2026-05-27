/**
 * Escape a value for safe interpolation inside HTML markup (e.g. print windows).
 * Prevents stored XSS when patient/doctor/medication data is rendered via document.write.
 */
export const escapeHtml = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

export default escapeHtml;