import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const favorites = vi.hoisted(() => ({
  items: [] as Array<{ id: string; type: string; title: string }>,
}));

vi.mock("@/lib/favorites", () => ({
  FAVORITES_EVENT: "favorites-updated",
  readFavorites: () => favorites.items,
  writeFavorites: (items: typeof favorites.items) => {
    favorites.items = items;
    window.dispatchEvent(new Event("favorites-updated"));
  },
  pushFavorite: vi.fn().mockResolvedValue(undefined),
}));

import { FavoriteButton } from "./FavoriteButton";

describe("FavoriteButton", () => {
  beforeEach(() => {
    favorites.items = [];
  });

  it("keeps the icon-only mobile action named in both saved states", async () => {
    render(<FavoriteButton id="shaoguan" type="city" title="Shaoguan" />);

    const button = screen.getByRole("button", { name: "Save Shaoguan" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.getByRole("button", { name: "Remove Shaoguan from saved items" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
