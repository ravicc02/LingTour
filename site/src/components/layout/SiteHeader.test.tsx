import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/components/layout/RoutesMegaMenu", () => ({
  RoutesMegaMenu: () => <span>Routes</span>,
}));

vi.mock("@/components/layout/AccountNavLink", () => ({
  AccountNavLink: () => <span>Log in</span>,
}));

vi.mock("@/components/ui/Container", () => ({
  Container: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

import { SiteHeader } from "@/components/layout/SiteHeader";

describe("SiteHeader mobile navigation", () => {
  it("focuses the menu, closes on Escape, and restores the trigger", async () => {
    render(<SiteHeader />);

    const trigger = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Mobile navigation" });
    expect(dialog).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole("link", { name: "Home" })).toHaveFocus());
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("dialog", { name: "Mobile navigation" })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
  });

  it("joins the outer menu strokes at their shared center when open", () => {
    render(<SiteHeader />);
    const trigger = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(trigger);
    const strokes = trigger.querySelectorAll("span > span");
    expect(strokes[0]).toHaveClass("translate-y-[7px]", "rotate-45");
    expect(strokes[2]).toHaveClass("-translate-y-[7px]", "-rotate-45");
  });
});
