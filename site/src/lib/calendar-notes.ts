import { apiClient } from "@/lib/api-client";

export type CalendarNote = {
  id: string;
  userId: string;
  date: string;
  title: string;
  body: string;
  citySlug: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CalendarNoteInput = Pick<CalendarNote, "date" | "title" | "body"> & { citySlug?: string | null };
export type CalendarNoteUpdate = Partial<CalendarNoteInput>;

const endpoint = "/account/calendar-notes";

function editableFields(input: CalendarNoteUpdate): CalendarNoteUpdate {
  return {
    ...(input.date !== undefined ? { date: input.date } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.body !== undefined ? { body: input.body } : {}),
    ...(input.citySlug !== undefined ? { citySlug: input.citySlug } : {}),
  };
}

export function fetchCalendarNotes(month: string, signal?: AbortSignal) {
  return apiClient<CalendarNote[]>(endpoint, { method: "GET", params: { month }, cache: "no-store", signal });
}

export function fetchCalendarNote(id: string) {
  return apiClient<CalendarNote>(`${endpoint}/${encodeURIComponent(id)}`, { method: "GET", cache: "no-store" });
}

export function createCalendarNote(input: CalendarNoteInput) {
  return apiClient<CalendarNote>(endpoint, { method: "POST", body: editableFields(input) });
}

export function updateCalendarNote(id: string, input: CalendarNoteUpdate) {
  return apiClient<CalendarNote>(`${endpoint}/${encodeURIComponent(id)}`, { method: "PATCH", body: editableFields(input) });
}

export async function deleteCalendarNote(id: string): Promise<void> {
  await apiClient(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function calendarToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01" || value > "9999-12-31") return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function calendarMonthDays(month: string): Array<string | null> {
  const first = new Date(`${month}-01T00:00:00.000Z`);
  if (!Number.isFinite(first.getTime())) return [];
  const last = new Date(first);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  // Monday first. Blank cells are non-interactive, not dates from adjacent months.
  const offset = (first.getUTCDay() + 6) % 7;
  return [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: last.getUTCDate() }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`),
  ];
}

export function shiftCalendarMonth(month: string, direction: -1 | 1): string {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + direction);
  const result = date.toISOString().slice(0, 7);
  return /^(?!0000)\d{4}-\d{2}$/.test(result) ? result : month;
}

export function calendarDateLabel(date: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00.000Z`));
}

export function calendarMonthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00.000Z`));
}
