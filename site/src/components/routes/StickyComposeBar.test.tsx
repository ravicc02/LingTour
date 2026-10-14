import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StickyComposeBar } from "./StickyComposeBar";
import type { CommunityFeedPost, RouteCommunityPost } from "@/lib/api-data";

const mocks = vi.hoisted(() => ({ create: vi.fn(), append: vi.fn(), stored: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/auth-client", () => ({ readStoredUser: () => ({ id: "owner", name: "Visitor" }) }));
vi.mock("@/lib/community-api", async (original) => ({ ...await original<typeof import("@/lib/community-api")>(), createAssociatedCommunityPost: mocks.create }));
vi.mock("@/lib/community-sync", () => ({
  readSyncedCommunityPosts: mocks.stored, appendSyncedCommunityPost: mocks.append,
  mergeCommunityPosts: <T,>(items: T[]) => items, subscribeSyncedCommunityPosts: () => () => {},
}));
vi.mock("@/components/community/FieldKit", () => ({ FieldKit: ({ isOpen, onPublish }: { isOpen: boolean; onPublish: (draft: { title: string; note: string; channel: string }) => Promise<void> }) => isOpen ? <button onClick={() => void onPublish({ title: "Tea", note: "A visit", channel: "Field Notes" })}>Submit post</button> : null }));
const routeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const post = (status: string): CommunityFeedPost => ({ id: status, status, routeId, user: { name: "Visitor" }, createdAt: "2026-10-14T00:00:00Z", media: [], date: "", readTime: "", likes: 0, saves: 0, prompt: "", title: "Tea", excerpt: "A visit", channel: "Field Notes", image: "", location: "Chaozhou", route: "tea-route", mood: "", tags: [] });
beforeEach(() => { vi.clearAllMocks(); mocks.stored.mockReturnValue([]); mocks.create.mockResolvedValue(post("pending_review")); });
afterEach(cleanup);

function renderBar(initialPosts: RouteCommunityPost[] = []) {
  return render(<StickyComposeBar routeId={routeId} routeCitySlug="chaozhou" routeSlug="tea-route" routeTitle="Tea Route" routeCity="Chaozhou" initialPosts={initialPosts} />);
}

describe("route post moderation", () => {
  it("does not count cached or initial pending posts as published route feedback", () => {
    mocks.stored.mockReturnValue([post("pending_review")]);
    renderBar([post("pending_review")]);
    expect(screen.getByText("0 notes")).toBeInTheDocument();
  });
  it("announces review submission without appending it to a public local feed", async () => {
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: /Leave Note/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Submit post" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Post submitted for review"));
    expect(mocks.append).not.toHaveBeenCalled();
    expect(screen.getByText("0 notes")).toBeInTheDocument();
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ routeId, citySlug: "chaozhou" }));
  });
});
