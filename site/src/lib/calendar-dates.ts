export const CALENDAR_TIME_ZONE = "Asia/Shanghai";

export function shanghaiDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CALENDAR_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function dateParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month: month - 1, day };
}

export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function monthRange(year: number, month: number) {
  return { startDate: dateKey(year, month, 1), endDate: dateKey(year, month, new Date(Date.UTC(year, month + 1, 0)).getUTCDate()) };
}

export function calendarDays(year: number, month: number): Array<number | null> {
  const range = monthRange(year, month);
  const offset = new Date(`${range.startDate}T00:00:00Z`).getUTCDay();
  const days: Array<number | null> = Array(offset).fill(null);
  for (let day = 1; day <= dateParts(range.endDate).day; day++) days.push(day);
  while (days.length % 7) days.push(null);
  return days;
}

export function shiftMonth(year: number, month: number, offset: number) {
  const date = new Date(Date.UTC(year, month + offset, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

/** Shanghai has no daylight saving; compute the next local midnight in UTC. */
export function millisecondsToShanghaiMidnight(now = new Date()): number {
  const day = shanghaiDate(now);
  const midnight = Date.parse(`${day}T00:00:00+08:00`);
  return Math.max(1, midnight + 86400000 - now.getTime());
}

export function overlapsDate(event: { date: string; endDate?: string | null }, date: string): boolean {
  return event.date <= date && (event.endDate || event.date) >= date;
}
