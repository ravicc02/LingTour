import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearCache, fetchRoutes, fetchSavedCommunityPosts } from "../api-data";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../api-client", () => ({
  apiGet: mocks.get,
  apiPost: mocks.post,
  ApiRequestError: class extends Error {},
}));

beforeEach(() => {
  clearCache();
  mocks.get.mockReset();
});

describe("stable feedback associations", () => {
  it("keeps the backend route UUID alongside its public slug", async () => {
    mocks.get.mockResolvedValue({ data: [{
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", slug: "real-route", title: "Route",
      cultureTag: "Coastal", cityName: "Zhanjiang", duration: "4 hours", audience: "Visitors",
      summary: "", story: "", coverImage: "/uploads/route.jpg", stops: [], routeCityLinks: [{ citySlug: "zhanjiang" }],
    }] });
    const [route] = await fetchRoutes();
    expect(route.id).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(route.slug).toBe("real-route");
    expect(route.citySlugs).toEqual(["zhanjiang"]);
  });

  it("preserves saved-post associations instead of inferring them from location", async () => {
    mocks.get.mockResolvedValue([{
      id: "post", title: "A visit", excerpt: "Experience", channel: "Culture Desk", status: "published",
      user: { name: "Visitor" }, location: "Unknown free text", route: "Legacy label", media: [],
      citySlug: "chaozhou", routeId: "route-uuid", interpreterId: "interpreter-uuid", verifiedExperience: true,
      createdAt: "2026-10-14T01:00:00Z",
    }]);
    const [post] = await fetchSavedCommunityPosts();
    expect(post).toMatchObject({citySlug: "chaozhou", routeId: "route-uuid", interpreterId: "interpreter-uuid", verifiedExperience: true});
  });
});
