import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calendarDateLabel, calendarMonthDays, calendarToday, createCalendarNote,
  deleteCalendarNote, fetchCalendarNotes, shiftCalendarMonth, updateCalendarNote,
} from "@/lib/calendar-notes";

const api = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ apiClient: api.call }));
beforeEach(() => api.call.mockReset().mockResolvedValue([]));
afterEach(() => vi.restoreAllMocks());

describe("Private calendar dates and API contract", () => {
  it("uses Asia/Shanghai at the UTC date boundary", () => {
    expect(calendarToday(new Date("2026-10-07T16:00:00Z"))).toBe("2026-10-08");
    expect(calendarToday(new Date("2026-10-07T15:59:59Z"))).toBe("2026-10-07");
  });

  it("handles leap days, Monday-first offset and year navigation without host timezone", () => {
    const days = calendarMonthDays("2024-02");
    expect(days.slice(0, 4)).toEqual([null, null, null, "2024-02-01"]);
    expect(days.at(-1)).toBe("2024-02-29");
    expect(shiftCalendarMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftCalendarMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftCalendarMonth("0001-01", -1)).toBe("0001-01");
    expect(calendarDateLabel("2026-10-08")).toBe("8 October 2026");
  });

  it("uses a private monthly no-store read and never accepts client ownership on writes", async () => {
    const controller = new AbortController();
    await fetchCalendarNotes("2026-10", controller.signal);
    expect(api.call).toHaveBeenLastCalledWith("/account/calendar-notes", { method: "GET", params: { month: "2026-10" }, cache: "no-store", signal: controller.signal });
    await createCalendarNote({ date: "2026-10-08", title: "Plan", body: "", userId: "attacker", id: "injected" } as never);
    expect(api.call).toHaveBeenLastCalledWith("/account/calendar-notes", { method: "POST", body: { date: "2026-10-08", title: "Plan", body: "" } });
    await updateCalendarNote("note/id", { title: "New", citySlug: null, userId: "attacker" } as never);
    expect(api.call).toHaveBeenLastCalledWith("/account/calendar-notes/note%2Fid", { method: "PATCH", body: { title: "New", citySlug: null } });
    await deleteCalendarNote("note/id");
    expect(api.call).toHaveBeenLastCalledWith("/account/calendar-notes/note%2Fid", { method: "DELETE" });
  });
});
