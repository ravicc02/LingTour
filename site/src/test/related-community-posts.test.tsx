import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RelatedCommunityPosts } from "@/components/community/RelatedCommunityPosts";

const feed = vi.hoisted(() => vi.fn());
vi.mock("@/lib/community-api", async (original) => ({
  ...await original<typeof import("@/lib/community-api")>(), fetchAssociatedCommunityPosts: feed,
}));
vi.mock("@/lib/auth-client", () => ({ readStoredUser: () => null }));
vi.mock("@/components/community/PostDetailDialog", () => ({ PostDetailDialog: () => null }));
beforeEach(() => { feed.mockReset().mockResolvedValue({ data: [], total: 0 }); });
afterEach(cleanup);

describe("related post scope", () => {
  it("uses stable city identity without requiring an exact free-text location", async () => {
    render(<RelatedCommunityPosts citySlug="chaozhou" location="Chaozhou" />);
    await waitFor(() => expect(feed).toHaveBeenCalledWith({ citySlug: "chaozhou", routeId: undefined, interpreterId: undefined, limit: 4 }));
    const view = new URL(screen.getByRole("link", { name: "View posts" }).getAttribute("href")!, "http://localhost");
    expect(view.searchParams.get("citySlug")).toBe("chaozhou");
    expect(view.searchParams.has("location")).toBe(false);
    const compose = new URL(screen.getByRole("link", { name: "Write post" }).getAttribute("href")!, "http://localhost");
    expect(compose.searchParams.get("location")).toBe("Chaozhou");
    expect(compose.searchParams.get("compose")).toBe("1");
  });
});
