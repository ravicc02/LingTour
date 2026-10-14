import { describe, expect, it } from "vitest";
import { calendarDays, millisecondsToShanghaiMidnight, monthRange, overlapsDate, shanghaiDate, shiftMonth } from "../calendar-dates";

describe("Guangdong calendar civil dates", () => {
  it("uses Shanghai today on both sides of midnight, not the host timezone", () => {
    expect(shanghaiDate(new Date("2026-10-07T15:59:59Z"))).toBe("2026-10-07");
    expect(shanghaiDate(new Date("2026-10-07T16:00:00Z"))).toBe("2026-10-08");
    expect(millisecondsToShanghaiMidnight(new Date("2026-10-07T15:59:59.900Z"))).toBe(100);
  });
  it("handles leap years, month ends and year transitions with UTC grid arithmetic", () => {
    expect(monthRange(2028, 1)).toEqual({ startDate: "2028-02-01", endDate: "2028-02-29" });
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(calendarDays(2026, 9).slice(0, 5)).toEqual([null, null, null, null, 1]);
  });
  it("includes both ends of a cross-month interval", () => {
    const event = { date: "2026-09-30", endDate: "2026-10-02" };
    expect(overlapsDate(event, "2026-10-01")).toBe(true);
    expect(overlapsDate(event, "2026-10-02")).toBe(true);
    expect(overlapsDate(event, "2026-10-03")).toBe(false);
  });
});
