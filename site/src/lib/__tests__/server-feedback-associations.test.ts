import { describe, expect, it, vi } from "vitest";
import { fetchRoutesServer } from "../server-data";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../server-api", () => ({ serverGet: mocks.get, ServerApiError: class extends Error {} }));

describe("server route identity", () => {
  it("retains the database UUID in server-rendered routes", async () => {
    mocks.get.mockResolvedValue({ data: [{
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", slug: "public-route", title: "Published route",
      cultureTag: "Guangfu", cityName: "Guangzhou", duration: "5 hours", audience: "Travelers",
      summary: "", story: "", coverImage: "/uploads/route.jpg", stops: [], routeCityLinks: [{ citySlug: "guangzhou" }],
    }] });
    const [route] = await fetchRoutesServer();
    expect(route.id).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(route.slug).toBe("public-route");
  });
});
