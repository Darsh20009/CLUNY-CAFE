/**
 * Saudi Arabia Timezone Utilities
 * All date/day boundaries use Asia/Riyadh (UTC+3) for consistency.
 *
 * Why: The server runs on UTC. Saudi Arabia is UTC+3, so UTC midnight happens
 * at 03:00 Riyadh time. Without this correction, "today" resets at the wrong hour.
 */

const SAUDI_TZ = "Asia/Riyadh";
const SAUDI_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3

/**
 * Parse the year/month/day of a Date in Saudi timezone.
 */
function getSaudiDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SAUDI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: parseInt(parts.find((p) => p.type === "year")!.value),
    month: parseInt(parts.find((p) => p.type === "month")!.value) - 1, // 0-indexed
    day: parseInt(parts.find((p) => p.type === "day")!.value),
  };
}

/**
 * Returns the start and end of "today" in Saudi time as UTC Date objects.
 * Use these for MongoDB date range queries.
 *
 * Saudi midnight (00:00 AST) in UTC = day-1 at 21:00 UTC
 * Formula: Date.UTC(year, month, day, -3, 0, 0, 0)
 *   JS Date handles -3h by rolling back to previous day 21:00 ✓
 *
 * @param date  Optional reference date (defaults to now). Can be a Date or
 *              a "YYYY-MM-DD" string (treated as a Saudi calendar date).
 */
export function getSaudiDayBounds(date?: Date | string): { start: Date; end: Date } {
  let target: Date;

  if (typeof date === "string") {
    // Treat the string as a Saudi calendar date YYYY-MM-DD
    const [y, m, d] = date.split("-").map(Number);
    // Convert Saudi calendar date to UTC Date: Saudi midnight in UTC
    const startUTC = Date.UTC(y, m - 1, d, -3, 0, 0, 0);
    return {
      start: new Date(startUTC),
      end: new Date(startUTC + 24 * 60 * 60 * 1000),
    };
  }

  target = date || new Date();
  const { year, month, day } = getSaudiDateParts(target);

  // Saudi midnight (00:00 AST) in UTC: Date.UTC uses -3h → previous day 21:00 UTC
  const startUTC = Date.UTC(year, month, day, -3, 0, 0, 0);

  return {
    start: new Date(startUTC),
    end: new Date(startUTC + 24 * 60 * 60 * 1000),
  };
}

/**
 * Returns the UTC Date corresponding to Saudi midnight (00:00) of today.
 * Equivalent to getSaudiDayBounds().start
 */
export function getSaudiToday(): Date {
  return getSaudiDayBounds().start;
}

/**
 * Returns the UTC Date corresponding to Saudi midnight of tomorrow (= end of today).
 * Equivalent to getSaudiDayBounds().end
 */
export function getSaudiTomorrow(): Date {
  return getSaudiDayBounds().end;
}

/**
 * Returns the current date as a YYYY-MM-DD string in Saudi timezone.
 */
export function getSaudiDateString(date?: Date): string {
  const target = date || new Date();
  const { year, month, day } = getSaudiDateParts(target);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Returns the UTC Date for the start of N days ago in Saudi time.
 * @param days  Number of days to go back (positive integer).
 */
export function getSaudiDaysAgo(days: number): Date {
  const now = new Date();
  const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return getSaudiDayBounds(past).start;
}

/**
 * Returns the UTC Date for the start of the current Saudi month (day 1, 00:00 AST).
 */
export function getSaudiMonthStart(): Date {
  const now = new Date();
  const { year, month } = getSaudiDateParts(now);
  // Day 1 of the Saudi month at 00:00 AST
  const startUTC = Date.UTC(year, month, 1, -3, 0, 0, 0);
  return new Date(startUTC);
}

/**
 * Returns the UTC Date for the start of the current Saudi year (Jan 1, 00:00 AST).
 */
export function getSaudiYearStart(): Date {
  const now = new Date();
  const { year } = getSaudiDateParts(now);
  const startUTC = Date.UTC(year, 0, 1, -3, 0, 0, 0);
  return new Date(startUTC);
}
