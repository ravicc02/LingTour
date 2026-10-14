import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCalendarMonth } from "../calendar-api";
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({ apiClient: request }));
beforeEach(() => request.mockReset());
describe("Calendar month API contract", () => {
  it("consumes raw paginated controller responses until the month is complete", async () => {
    request.mockResolvedValueOnce({ data: [{ id: "b", date: "2026-09-30", endDate: "2026-10-02", displayOrder: 2 }], total: 2, page: 1, pageSize: 1 })
      .mockResolvedValueOnce({ data: [{ id: "a", date: "2026-10-08", displayOrder: 1 }], total: 2, page: 2, pageSize: 1 });
    const events = await fetchCalendarMonth(2026, 9);
    expect(events.map(event => event.id)).toEqual(["a", "b"]);
    expect(request.mock.calls[0][1].params).toEqual({ startDate: "2026-10-01", endDate: "2026-10-31", page: 1, limit: 100 });
    expect(request.mock.calls[1][1].params.page).toBe(2);
    expect(request.mock.calls[0][1].cache).toBe("no-store");
  });
  it("never silently treats a partial failed page as an empty month", async () => {
    request.mockResolvedValueOnce({ data: [{ id: "a", displayOrder: 0 }], total: 2, page: 1, pageSize: 1 }).mockRejectedValueOnce(new Error("Network"));
    await expect(fetchCalendarMonth(2026, 9)).rejects.toThrow("Network");
  });
});
