/**
 * India Standard Time (Asia/Kolkata) helpers.
 *
 * The whole application is used by Indian hospitals, so "today", timestamps and
 * printed dates must always resolve in IST regardless of the browser/server
 * timezone. Never use `new Date().toISOString().slice(0,10)` for a business
 * date — use `istDateStr()` instead.
 */
export const IST_TZ = "Asia/Kolkata";

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: IST_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Current (or given) instant as an IST calendar date: `yyyy-MM-dd`. */
export function istDateStr(d: Date | string | number = new Date()): string {
  return dateFmt.format(new Date(d));
}

/** Current (or given) instant as IST wall-clock time: `HH:mm`. */
export function istTimeStr(d: Date | string | number = new Date()): string {
  return timeFmt.format(new Date(d));
}

/** `dd/MM/yyyy` display string in IST. */
export function istDisplayDate(d: Date | string | number = new Date()): string {
  const [y, m, day] = istDateStr(d).split("-");
  return `${day}/${m}/${y}`;
}

/** `dd/MM/yyyy HH:mm` display string in IST. */
export function istDisplayDateTime(d: Date | string | number = new Date()): string {
  return `${istDisplayDate(d)} ${istTimeStr(d)}`;
}

/**
 * A Date object shifted so that its *local* fields match IST wall-clock time.
 * Useful for calendar/date-picker components that read local getters.
 */
export function istNow(): Date {
  const [y, m, d] = istDateStr().split("-").map(Number);
  const [hh, mm] = istTimeStr().split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}
