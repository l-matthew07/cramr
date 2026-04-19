/**
 * Date/time utilities. All heatmap buckets are computed in the user's timezone.
 */

/**
 * Returns "YYYY-MM-DD" for the given instant, interpreted in the given IANA tz.
 */
export function dateInTz(date: Date, timezone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA formats as YYYY-MM-DD
  return fmt.format(date);
}

function getLocalAsUTC(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  let h = get("hour");
  if (h === 24) h = 0; // JS Date Engine edge case
  return Date.UTC(get("year"), get("month") - 1, get("day"), h, get("minute"), get("second"));
}

/**
 * Returns the Date (UTC instant) representing midnight in `timezone` on `yyyyMmDd`.
 */
export function tzMidnight(yyyyMmDd: string, timezone: string): Date {
  const [y, m, d] = yyyyMmDd.split("-").map(Number) as [number, number, number];
  const targetLocalUTC = Date.UTC(y, m - 1, d, 0, 0, 0);

  let instant = new Date(targetLocalUTC);
  for (let i = 0; i < 3; i++) {
    const currentLocalUTC = getLocalAsUTC(instant, timezone);
    const diff = targetLocalUTC - currentLocalUTC;
    if (diff === 0) break;
    instant = new Date(instant.getTime() + diff);
  }
  return instant;
}

/**
 * Split a session [start, end] into date-bucketed chunks in the user's timezone.
 * Returns a list of (date: "YYYY-MM-DD", seconds) pairs.
 */
export function splitSessionByDay(
  start: Date,
  end: Date,
  timezone: string,
): { date: string; seconds: number }[] {
  if (end <= start) return [];

  const out: { date: string; seconds: number }[] = [];
  let cursor = start;
  while (cursor < end) {
    const cursorDate = dateInTz(cursor, timezone);
    // Next midnight in tz = midnight of (cursorDate + 1 day)
    const [y, m, d] = cursorDate.split("-").map(Number) as [number, number, number];
    const nextDateStr = `${y.toString().padStart(4, "0")}-${m
      .toString()
      .padStart(2, "0")}-${(d + 1).toString().padStart(2, "0")}`;
    // Simple increment works unless last of month, so use Date math for robustness:
    const sameDay = new Date(Date.UTC(y, m - 1, d));
    const nextDay = new Date(sameDay.getTime() + 24 * 60 * 60 * 1000);
    const robustNextDateStr = [
      nextDay.getUTCFullYear(),
      String(nextDay.getUTCMonth() + 1).padStart(2, "0"),
      String(nextDay.getUTCDate()).padStart(2, "0"),
    ].join("-");
    const nextMidnight = tzMidnight(robustNextDateStr, timezone);

    const chunkEnd = end < nextMidnight ? end : nextMidnight;
    
    // Safety check to prevent infinite loops if tzmath is wildly off:
    if (chunkEnd.getTime() <= cursor.getTime()) {
      // Should never happen with correct math, but if it does, dump the rest in current date bucket
      const seconds = Math.max(0, Math.floor((end.getTime() - cursor.getTime()) / 1000));
      if (seconds > 0) out.push({ date: cursorDate, seconds });
      break;
    }

    const seconds = Math.max(0, Math.floor((chunkEnd.getTime() - cursor.getTime()) / 1000));
    if (seconds > 0) out.push({ date: cursorDate, seconds });
    cursor = chunkEnd;
    
    // Safety: avoid infinite loop
    if (out.length > 7) break;
    void nextDateStr; // unused in robust path
  }
  return out;
}

/**
 * Return "YYYY-MM-DD" for today in the given timezone.
 */
export function todayInTz(timezone: string): string {
  return dateInTz(new Date(), timezone);
}

/**
 * Day N days before `yyyyMmDd` (inclusive of yyyyMmDd, so addDays(x, -1) = prev day).
 */
export function addDays(yyyyMmDd: string, days: number): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number) as [number, number, number];
  const base = new Date(Date.UTC(y, m - 1, d));
  const shifted = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}
