import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchScopedRoutePosts } from "../community-server-api";

const get = vi.hoisted(() => vi.fn());
vi.mock("../server-api", () => ({ serverGet: get }));

beforeEach(() => { get.mockReset(); });

describe("server-rendered route community", () => {
  it("does not query a global feed when the route UUID is missing", async () => {
    expect(await fetchScopedRoutePosts()).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
  it("sends the exact UUID to the server filter", async () => {
    get.mockResolvedValue({ data: [] });
    expect(await fetchScopedRoutePosts("route-uuid")).toEqual([]);
    expect(get).toHaveBeenCalledWith("/public/community/posts", { routeId: "route-uuid", limit: 12, sort: "latest" });
  });
  it("does not replace a failed scoped feed with another route's posts", async () => {
    get.mockRejectedValue(new Error("API unavailable"));
    expect(await fetchScopedRoutePosts("route-uuid")).toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
