import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EventData } from "@/lib/api-data";
import { GuangdongEventCalendar } from "./GuangdongEventCalendar";

vi.mock("@/components/ui/Reveal", () => ({
  Reveal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
const event: EventData = {
  id: "event-1", slug: "tea-walk", title: "Tea walk", date: "2026-11-01",
  city: "Chaozhou", citySlug: "chaozhou", tags: [], summary: "A tea-house visit.",
  description: "Meet local tea makers.", relatedRouteSlugs: [], image: "",
};
afterEach(cleanup);

describe("home event date selection", () => {
  it("keeps a date without an event selected instead of jumping back to the first event", () => {
    render(<GuangdongEventCalendar events={[event]} />);
    expect(screen.getByRole("heading", { name: "Tea walk" })).toBeInTheDocument();
    const emptyDay = screen.getByRole("button", { name: "November 2, 2026" });
    fireEvent.click(emptyDay);
    expect(emptyDay).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "November 1, 2026" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("heading", { name: "Tea walk" })).not.toBeInTheDocument();
  });
  it("initializes when events arrive and preserves a later user selection when data refreshes", () => {
    const { rerender } = render(<GuangdongEventCalendar events={[]} />);
    rerender(<GuangdongEventCalendar events={[event]} />);
    expect(screen.getByRole("button", { name: "November 1, 2026" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "November 2, 2026" }));
    rerender(<GuangdongEventCalendar events={[{ ...event, title: "Updated tea walk" }]} />);
    expect(screen.getByRole("button", { name: "November 2, 2026" })).toHaveAttribute("aria-pressed", "true");
  });
});
