const DAY_MS = 24 * 60 * 60 * 1000;

/** Normalizes a date to UTC midnight, discarding time-of-day. */
export function toDayKey(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Returns the Monday..Sunday week (as UTC-midnight dates) containing `date`. */
export function getWeekRange(date: Date): { start: Date; end: Date; days: Date[] } {
  const day = toDayKey(date);
  const weekday = day.getUTCDay(); // 0 = Sunday
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const start = new Date(day.getTime() + mondayOffset * DAY_MS);
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY_MS));
  const end = days[6];
  return { start, end, days };
}

export function addWeeks(date: Date, weeks: number): Date {
  return new Date(date.getTime() + weeks * 7 * DAY_MS);
}

export function formatISODate(date: Date): string {
  return toDayKey(date).toISOString().slice(0, 10);
}

export function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatRangeLabel(start: Date, end: Date): string {
  const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${startLabel} – ${endLabel}`;
}
