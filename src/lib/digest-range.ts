/** Pure helpers for weekly digest windows (testable, no server imports). */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DateRange {
  periodStart: Date;
  periodEnd: Date;
}

/**
 * The rolling 7-day window ending at `now` (exclusive end = now). Used by the
 * weekly digest cron so each run summarizes the last week of changes.
 */
export function weeklyRange(now: Date = new Date()): DateRange {
  const periodEnd = now;
  const periodStart = new Date(now.getTime() - 7 * DAY_MS);
  return { periodStart, periodEnd };
}

/** Stable label for a digest period, e.g. "Jun 2 – Jun 9". */
export function formatRange({ periodStart, periodEnd }: DateRange): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${periodStart.toLocaleDateString("en-US", opts)} – ${periodEnd.toLocaleDateString("en-US", opts)}`;
}
