import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteBrief } from "./RouteBrief";
import type { StoryRoute } from "@/data/routes";
vi.mock("@/lib/motion", () => ({ useGSAP: () => undefined, gsap: {}, motionEase: {} }));
vi.mock("@/components/ui/MediaFrame", () => ({ MediaFrame: () => null }));
const route = { id: "76c8977d-82ec-47a0-9d19-7e36708ee7da", slug: "southern-sea", title: "Southern sea", summary: "Real route", citySlugs: ["zhanjiang"], city: "Zhanjiang", culture: "Coastal", duration: "One day" } as StoryRoute;
afterEach(cleanup);
describe("Free-route entry", () => {
  it("links to existing route request anchor using a published route UUID and city", () => {
    render(<RouteBrief route={route} />);
    expect(screen.getByRole("link", { name: "Book free route" })).toHaveAttribute("href", `/routes?type=free_route&routeId=${route.id}&citySlug=zhanjiang#route-request`);
  });
  it("does not pretend a slug-only historical route has a request UUID", () => {
    render(<RouteBrief route={{ ...route, id: undefined }} />);
    expect(screen.queryByRole("link", { name: "Book free route" })).not.toBeInTheDocument();
    expect(screen.getByText("Booking unavailable for this route.")).toBeInTheDocument();
  });
});
