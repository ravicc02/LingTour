import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GuangdongEventCalendar } from "@/components/home/GuangdongEventCalendar";
import type { CalendarEvent } from "@/lib/calendar-api";
const fetchMonth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/calendar-api", () => ({ fetchCalendarMonth: fetchMonth }));
vi.mock("@/lib/locale-context", () => ({ useLocale: () => ({ t: () => "Guangdong calendar" }) }));
vi.mock("@/components/ui/Reveal", () => ({ Reveal: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/ui/MediaFrame", () => ({ MediaFrame: ({ asset }: { asset: { type: string; url: string } }) => <div data-testid="event-media" data-type={asset.type} data-src={asset.url} /> }));
const event = (id: string, date = "2026-10-08"): CalendarEvent => ({ id, eventId: id, publicationId: id, version: 1,
  source: "publication", publishedAt: "2026-10-08T00:00:00Z", slug: id, title: `Event ${id}`, date, endDate: date,
  eventDate: date, eventEndDate: null, city: "", citySlug: "", tags: [], summary: "Summary", description: "Details", image: "/uploads/old.jpg", media: [], slogan: "", extraInfo: "", displayOrder: 0, relatedRouteSlugs: [] });
beforeEach(() => { vi.useRealTimers(); vi.setSystemTime(new Date("2026-10-08T04:00:00Z")); fetchMonth.mockReset(); fetchMonth.mockResolvedValue([event("one"), event("two")]); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Public calendar interactions", () => {
  it("defaults to Shanghai Today, not the first legacy feed date, and shows multiple events", async () => {
    render(<GuangdongEventCalendar events={[event("far", "2026-11-22") as never]} />);
    await screen.findByRole("heading", { name: "Event one" });
    expect(screen.getByRole("button", { name: /October 8, 2026/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "October 2026" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Event two" })).toBeInTheDocument();
  });
  it("keeps an empty date and manually chosen month after focus refresh", async () => {
    render(<GuangdongEventCalendar />);
    await screen.findByRole("heading", { name: "Event one" });
    fireEvent.click(screen.getByRole("button", { name: "October 9, 2026" }));
    expect(screen.getByText("No events for this date.")).toBeInTheDocument();
    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(screen.getByRole("button", { name: "October 9, 2026" })).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    await screen.findByRole("heading", { name: "November 2026" });
    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(screen.getByRole("heading", { name: "November 2026" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    await screen.findByRole("heading", { name: "October 2026" });
  });
  it("uses overlap intervals and image-only compatibility with inline Know more", async () => {
    const spanning = { ...event("range", "2026-09-30"), endDate: "2026-10-09", extraInfo: "Extra details" };
    fetchMonth.mockResolvedValue([spanning]);
    render(<GuangdongEventCalendar />);
    await screen.findByRole("heading", { name: "Event range" });
    expect(screen.getByTestId("event-media")).toHaveAttribute("data-type", "image");
    expect(screen.getByText("Know more").tagName).toBe("SUMMARY");
    expect(screen.getByText("Extra details")).toBeInTheDocument();
  });
  it("updates default Today through Shanghai midnight while preserving manual selection", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-08T15:59:59Z"));
    fetchMonth.mockResolvedValue([]);
    render(<GuangdongEventCalendar />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("button", { name: "October 8, 2026" })).toHaveAttribute("aria-current", "date");
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(screen.getByRole("button", { name: "October 9, 2026" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "October 2, 2026" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(86400000); });
    expect(screen.getByRole("button", { name: "October 2, 2026" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "October 10, 2026" })).toHaveAttribute("aria-current", "date");
  });
  it("renders only the explicitly supplied trusted unsaved preview without publishing it", async () => {
    render(<GuangdongEventCalendar previewEvent={{ ...event("draft", "2026-11-20"), slogan: "Unsaved slogan" } as never} />);
    await screen.findByRole("heading", { name: "Event draft" });
    expect(screen.getByText("Unsaved preview. Not published.")).toBeInTheDocument();
    expect(screen.getByText("Unsaved slogan")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Event one" })).not.toBeInTheDocument();
  });
  it("announces error and can retry without changing selected date", async () => {
    fetchMonth.mockRejectedValueOnce(new Error("Offline"));
    render(<GuangdongEventCalendar />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "Event one" });
    expect(screen.getByRole("button", { name: /October 8, 2026/ })).toHaveAttribute("aria-pressed", "true");
  });
});
