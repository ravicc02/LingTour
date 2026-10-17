import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/Reveal", () => ({
  Reveal: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

import { FieldKit } from "@/components/community/FieldKit";

const channels = ["All", "Field Notes", "Food Map"] as const;

describe("FieldKit dialog", () => {
  it("moves focus into the dialog, closes on Escape, and restores focus", async () => {
    const onClose = vi.fn();
    const onPublish = vi.fn();
    const { rerender } = render(
      <>
        <button type="button">Open notes</button>
        <FieldKit
          isOpen={false}
          isLoggedIn
          onClose={onClose}
          onPublish={onPublish}
          channels={channels}
        />
      </>,
    );

    const opener = screen.getByRole("button", { name: "Open notes" });
    opener.focus();
    rerender(
      <>
        <button type="button">Open notes</button>
        <FieldKit
          isOpen
          isLoggedIn
          onClose={onClose}
          onPublish={onPublish}
          channels={channels}
        />
      </>,
    );

    const close = screen.getByRole("button", { name: "Close post editor" });
    await waitFor(() => expect(close).toHaveFocus());
    expect(screen.getByRole("dialog", { name: "Create Post" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <>
        <button type="button">Open notes</button>
        <FieldKit
          isOpen={false}
          isLoggedIn
          onClose={onClose}
          onPublish={onPublish}
          channels={channels}
        />
      </>,
    );
    await waitFor(() => expect(opener).toHaveFocus());
    expect(document.body.style.overflow).toBe("");
  });
});
