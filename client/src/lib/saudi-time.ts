/**
 * Client-side Saudi (Asia/Riyadh, UTC+3) time helpers.
 * MUST stay in sync with server/utils/timezone.ts so dashboards and the
 * accounting pages agree on what "today" / "yesterday" mean — otherwise
 * users see different totals depending on which page they open.
 */

const SAUDI_TZ = "Asia/Riyadh";

function getSaudiDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SAUDI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: parseInt(parts.find(p => p.type === "year")!.value),
    month: parseInt(parts.find(p => p.type === "month")!.value) - 1,
    day: parseInt(parts.find(p => p.type === "day")!.value),
  };
}

/**
 * Start (00:00) and end (24:00) of a Saudi calendar day, expressed as UTC Dates.
 */
export function getSaudiDayBounds(reference?: Date): { start: Date; end: Date } {
  const target = reference || new Date();
  const { year, month, day } = getSaudiDateParts(target);
  const startUTC = Date.UTC(year, month, day, -3, 0, 0, 0);
  return {
    start: new Date(startUTC),
    end: new Date(startUTC + 24 * 60 * 60 * 1000),
  };
}

export function getSaudiDaysAgoBounds(daysAgo: number): { start: Date; end: Date } {
  const past = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return getSaudiDayBounds(past);
}

/**
 * "Today so far" range in Saudi time: [Saudi midnight, now].
 */
export function getSaudiTodayRange(): { start: Date; end: Date } {
  const { start } = getSaudiDayBounds();
  return { start, end: new Date() };
}

/**
 * Last N days inclusive, in Saudi time.
 *  getSaudiLastNDaysRange(7) → 7-day window ending at "now", starting at
 *  Saudi midnight 6 days ago.
 */
export function getSaudiLastNDaysRange(days: number): { start: Date; end: Date } {
  const { start } = getSaudiDaysAgoBounds(days - 1);
  return { start, end: new Date() };
}

export function getSaudiDateString(date?: Date): string {
  const { year, month, day } = getSaudiDateParts(date || new Date());
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Hour (0–23) of a Date in Saudi time.
 */
export function getSaudiHour(date: Date): number {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: SAUDI_TZ,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date).find(p => p.type === "hour")!.value;
  // Some locales return "24" for midnight — normalize to 0.
  const h = parseInt(part);
  return h === 24 ? 0 : h;
}
