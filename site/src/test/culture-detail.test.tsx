import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CityCulture } from "@/data/culture";
import { CultureDetailClient } from "@/app/culture/[slug]/CultureDetailClient";

const mocks = vi.hoisted(() => ({
  preview: { previewEnabled: false, previewData: null as CityCulture | null },
  query: vi.fn(),
}));
vi.mock("@/lib/locale-context", () => ({ useLocale: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/preview", () => ({ usePreviewBridge: () => mocks.preview }));
vi.mock("@/lib/motion", () => ({
  gsap: { matchMedia: () => ({ add: () => {}, revert: () => {} }) },
  motionEase: { enter: "power3.out" },
  useGSAP: () => {},
}));
vi.mock("@/lib/use-api-query", () => ({
  useApiQuery: mocks.query,
  LoadingSpinner: ({ text }: { text: string }) => <p>{text}</p>,
  ErrorState: () => <p>Error</p>,
}));
vi.mock("@/lib/api-data", () => ({ fetchCityBySlug: vi.fn(), fetchCities: vi.fn(), fetchRoutes: vi.fn() }));
vi.mock("@/components/culture/RelatedCitiesHub", () => ({ RelatedCitiesHub: () => null }));
vi.mock("@/components/culture/RelatedRouteHub", () => ({ RelatedRouteHub: () => null }));
vi.mock("@/components/ui/MediaFrame", () => ({ MediaFrame: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} /> }));

const city: CityCulture = {
  slug: "preview-city", name: "Published City", adcode: 440200, label: "Northern Guangdong",
  summary: "", narrative: "", contentMarkdown: "## Published article\n\nReal content.",
  image: "", gallery: [], tags: [], food: "", foodDescription: "", routeSlugs: [], relatedCitySlugs: [], foodImages: [], sections: [],
};

beforeEach(() => {
  mocks.preview = { previewEnabled: false, previewData: null };
  mocks.query.mockReset();
  mocks.query.mockImplementation((_fetcher, _deps, options) => ({ data: options.initialData, loading: false, error: null }));
});
afterEach(cleanup);

describe("Culture detail publication and preview boundaries", () => {
  it("renders a published business slug even when named preview-city", () => {
    render(<CultureDetailClient slug="preview-city" initialCity={city} initialCityCultures={[city]} initialRoutes={[]} />);
    expect(screen.getByRole("heading", { name: "Published article" })).toBeInTheDocument();
    expect(mocks.query.mock.calls[0][2].enabled).toBe(true);
  });

  it("pairs the culture masthead image with the route-style field media label", () => {
    const cityWithMedia = {
      ...city,
      image: "/editorial/city.jpg",
    };
    render(<CultureDetailClient slug="preview-city" initialCity={cityWithMedia} initialCityCultures={[cityWithMedia]} initialRoutes={[]} />);
    expect(screen.getByText("Opening field media")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: cityWithMedia.name })).toBeInTheDocument();
  });

  it("keeps next-only city navigation at the trailing edge", () => {
    const nextCity = { ...city, slug: "next-city", name: "Next City" };
    render(<CultureDetailClient slug={city.slug} initialCity={city} initialCityCultures={[city, nextCity]} initialRoutes={[]} />);
    expect(screen.queryByRole("link", { name: /Previous:/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next: Next City" })).toHaveClass("ml-auto");
  });

  it("waits for the trusted draft payload in the explicit preview shell", () => {
    render(<CultureDetailClient previewOnly slug="preview-city" initialCity={null} initialCityCultures={[]} initialRoutes={[]} />);
    expect(screen.getByText("Loading preview...")).toBeInTheDocument();
    expect(mocks.query.mock.calls[0][2].enabled).toBe(false);
    expect(mocks.query.mock.calls[1][2].revalidateOnMount).toBe(true);
    expect(mocks.query.mock.calls[2][2].revalidateOnMount).toBe(true);
  });

  it("renders unsaved Markdown through the same renderer as published content", () => {
    mocks.preview = { previewEnabled: true, previewData: { ...city, contentMarkdown: "## Unsaved draft\n\n<u>Underlined</u>" } };
    render(<CultureDetailClient previewOnly slug="preview-city" initialCity={null} initialCityCultures={[]} initialRoutes={[]} />);
    expect(screen.getByRole("heading", { name: "Unsaved draft" })).toBeInTheDocument();
    expect(screen.getByText("Underlined").tagName).toBe("U");
    expect(screen.queryByRole("heading", { name: "Published article" })).not.toBeInTheDocument();
  });
});
