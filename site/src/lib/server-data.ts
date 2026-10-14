/**
 * Server-side data fetching for the home page.
 *
 * This module is imported ONLY by Server Components.
 * It mirrors the client-side `fetchHomeData` from `api-data.ts` but uses
 * the server-compatible `serverGet` helper instead of `window`-dependent `apiGet`.
 *
 * Returns the same `HomeData` shape so the client component can consume it directly.
 */

import { serverGet, ServerApiError } from "./server-api";
import type { EventData, InterpretingData } from "./api-data";
import type { CityCulture } from "@/data/culture";
import type {
  Region,
  RegionSlug,
  CultureFeature,
  Testimonial,
  TrustMetric,
  HomeHero,
  HomeHeroStat,
  HomeEntryCard,
} from "@/types/content";
import type { StoryRoute } from "@/data/routes";
import type { StoreCollection, StoreProduct } from "@/data/store";
import type { MediaAsset } from "@/types/media";
import {
  mediaPoster,
  resolveMediaGallery,
  resolvePrimaryMedia,
} from "@/types/media";
import { SEED_IMAGES } from "./seed-images";
import { placeholderFor } from "./placeholders";
import {
  hasVisibleCityContent,
  hasVisibleRegionContent,
  sanitizeCityCulture,
  sanitizeRegion,
} from "./content-cleaners";

// 鈹€鈹€ Shared helpers (duplicated from api-data.ts to avoid importing client code) 鈹€鈹€

// 鈹€鈹€ API response types (subset needed for home page) 鈹€鈹€

interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

interface ApiRouteStop {
  isFeatured?: boolean;
  id: string;
  sortOrder: number;
  time: string;
  stopName: string;
  plan?: string;
  story: string;
  culturalStory: string;
  details: string[];
  image: string;
  primaryMedia?: MediaAsset | null;
  lat: number | null;
  lng: number | null;
  meal: string | null;
  hotel: string | null;
  transit: string | null;
  placeDetail?: string;
  images?: string[];
  media?: MediaAsset[];
}

interface ApiStoryRoute {
  id: string;
  slug: string;
  title: string;
  cultureTag: string;
  cityName: string;
  duration: string;
  audience: string;
  summary: string;
  story: string;
  coverImage: string;
  routeRegionKey?: string | null;
  stops: ApiRouteStop[];
  routeCityLinks?: { citySlug: string }[];
}

interface ApiCitySection {
  id: string;
  title: string;
  body: string;
  image: string;
  primaryMedia?: MediaAsset | null;
  images?: string[];
  media?: MediaAsset[];
  statLabel: string | null;
  statValue: string | null;
  breathImage: string | null;
  breathQuote: string | null;
  sortOrder: number;
}

interface ApiCity {
  contentMarkdown: string;
  publishedAt: string | null;
  id: string;
  slug: string;
  name: string;
  regionLabel: string;
  heroImage: string;
  heroMedia?: MediaAsset | null;
  heroNarrative: string;
  tags: string[];
  editorIntro: string;
  galleryImages: string[];
  galleryMedia?: MediaAsset[];
  foodTitle: string;
  foodDescription: string;
  foodImages: string[];
  adcode?: number;
  sections: ApiCitySection[];
  routes?: { slug: string }[];
  relatedCitySlugs?: string[];
}

interface ApiHomeConfig {
  hero?: {
    image?: string;
    caption?: string;
    ctaImage?: string;
    badge?: { value?: string; label?: string };
    interpretingLabel?: string;
    interpretingImage?: string;
    video?: {
      url?: string;
      poster?: string;
      title?: string;
      description?: string;
      duration?: string;
      resolution?: string;
    };
    stats?: Array<{ title: string; description: string }>;
  };
  heroStats?: Array<{ title: string; description: string }>;
  trustMetrics?: Array<{ value: string; label: string }>;
  entryCards?: Array<{
    id: string;
    title: string;
    body: string;
    href: string;
    image?: string;
  }>;
  cultureHighlights?: Array<{
    slug: string;
    title: string;
    body: string;
    href?: string;
    image?: string;
  }>;
  testimonials?: Array<{ quote: string; name: string }>;
  featuredRouteSlugs?: string[];
  routeRegions?: Array<{
    key: string;
    title: string;
    note: string;
    adcodes: number[];
  }>;
}

interface ApiStoreProduct {
  id: string;
  slug: string;
  price: number;
  currency: string;
  image: string;
  primaryMedia?: MediaAsset | null;
  gallery: string[];
  galleryMedia?: MediaAsset[];
  collection: { slug: string; title: string } | null;
  product: { name: string; tag: string };
  materialNotes: string | null;
  story: string;
}

interface ApiStoreCollection {
  id: string;
  slug: string;
  title: string;
  routeName: string;
  routeSlug: string;
  image: string;
  body: string;
}

interface ApiEvent {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description?: string;
  city: string;
  citySlug: string;
  date: string;
  endDate?: string | null;
  tags: string[];
  image: string | null;
  status: string;
  relatedRouteSlugs: string[];
}

// 鈹€鈹€ Mappers (subset needed for home page) 鈹€鈹€

function mapRoute(apiRoute: ApiStoryRoute): StoryRoute {
  const routeFallbackImage =
    apiRoute.slug === "southern-sea-table"
      ? "/editorial/guangdong-coast-hero.jpg"
      : apiRoute.slug === "chaoshan-tea-culture"
        ? "/editorial/pottery-painting.jpg"
        : SEED_IMAGES.routesHero ?? placeholderFor("hero");

  return {
    slug: apiRoute.slug,
    title: apiRoute.title,
    culture: apiRoute.cultureTag as StoryRoute["culture"],
    city: apiRoute.cityName,
    duration: apiRoute.duration,
    audience: apiRoute.audience,
    summary: apiRoute.summary,
    story: apiRoute.story,
    image: apiRoute.coverImage || routeFallbackImage,
    citySlugs: apiRoute.routeCityLinks?.map((l) => l.citySlug) ?? [],
    routeRegionKey: apiRoute.routeRegionKey ?? undefined,
    mapViewBox: "0 0 900 600",
    itinerary: (apiRoute.stops ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => {
        const primaryMedia = resolvePrimaryMedia(
          s.primaryMedia,
          s.image || routeFallbackImage,
        );
        const media = resolveMediaGallery(s.media, s.images ?? []);
        const images = [
          mediaPoster(primaryMedia),
          ...media.map((asset) => mediaPoster(asset)),
          routeFallbackImage,
        ].filter((image): image is string => Boolean(image?.trim()));

        return {
          time: s.time,
          isFeatured: s.isFeatured,
          stop: s.stopName,
          plan: s.plan ?? "",
          story: s.story ?? "",
          culturalStory: s.culturalStory ?? "",
          details: s.details ?? [],
          image: mediaPoster(primaryMedia, images[0] || routeFallbackImage),
          primaryMedia,
          images,
          media,
          lat: s.lat ?? null,
          lng: s.lng ?? null,
          meal: s.meal ?? undefined,
          hotel: s.hotel ?? undefined,
          transit: s.transit ?? undefined,
          placeDetail: s.placeDetail ?? undefined,
        };
      }),
  };
}

function mapProduct(p: ApiStoreProduct): StoreProduct {
  const primaryMedia = resolvePrimaryMedia(p.primaryMedia, p.image);
  const galleryMedia = resolveMediaGallery(p.galleryMedia, p.gallery ?? []);
  return {
    id: p.id,
    slug: p.slug,
    name: p.product.name,
    tag: p.product.tag,
    price: p.price,
    currency: (p.currency as StoreProduct["currency"]) ?? "CNY",
    image: mediaPoster(primaryMedia, p.image),
    primaryMedia,
    gallery: galleryMedia.map((asset) => mediaPoster(asset)).filter(Boolean),
    galleryMedia,
    collection: p.collection?.title ?? "",
    materialNotes: p.materialNotes ?? undefined,
    story: p.story,
  };
}

function mapCollection(c: ApiStoreCollection): StoreCollection {
  return {
    title: c.title,
    route: c.routeName,
    href: `/routes/${c.routeSlug}`,
    image: c.image,
    body: c.body,
  };
}

// EventData is imported from "./api-data" (see top of file)

function mapEvent(raw: ApiEvent): EventData {
  const eventFallbackImage =
    raw.citySlug === "chaozhou"
      ? "/editorial/pottery-painting.jpg"
      : raw.citySlug === "zhanjiang"
        ? "/editorial/guangdong-coast-hero.jpg"
        : "/editorial/guangdong-coast-rocky.jpg";

  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    date: raw.date,
    city: raw.city,
    citySlug: raw.citySlug,
    tags: raw.tags ?? [],
    summary: raw.summary,
    description: raw.description
      ? raw.description
      : "",
    relatedRouteSlugs: raw.relatedRouteSlugs ?? [],
    image: raw.image || eventFallbackImage,
  };
}

// Re-export EventData for consumers (type-only import, no runtime dependency)
export type { EventData } from "./api-data";

// 鈹€鈹€ Public data types (same as HomeData from api-data.ts) 鈹€鈹€

export interface HomeData {
  hero: HomeHero;
  heroStats: HomeHeroStat[];
  regionShowcase: Region[];
  cultureHighlights: CultureFeature[];
  testimonials: Testimonial[];
  trustMetrics: TrustMetric[];
  homeEntryCards: HomeEntryCard[];
}

// 鈹€鈹€ Server-side fetch functions 鈹€鈹€

export async function fetchRoutesServer(): Promise<StoryRoute[]> {
  const res = await serverGet<PaginatedResponse<ApiStoryRoute>>(
    "/public/routes",
    { page: 1, limit: 50 },
  );
  return res.data.map(mapRoute);
}

export async function fetchRouteBySlugServer(
  slug: string,
): Promise<StoryRoute | null> {
  try {
    const res = await serverGet<ApiStoryRoute>(`/public/routes/${slug}`, {});
    return res?.slug ? mapRoute(res) : null;
  } catch {
    return null;
  }
}

export async function fetchCitiesServer(): Promise<Region[]> {
  const res = await serverGet<PaginatedResponse<ApiCity>>(
    "/public/cities",
    { page: 1, limit: 50 },
  );
  return res.data
    .map((c) => {
      const cityFallbackImage =
        c.slug === "chaozhou"
          ? "/editorial/pottery-workshop.jpg"
          : c.slug === "zhanjiang"
            ? "/editorial/guangdong-coast-boat.jpg"
            : "/editorial/guangdong-coast-rocky.jpg";
      const primaryMedia = resolvePrimaryMedia(c.heroMedia, c.heroImage);
      const galleryMedia = resolveMediaGallery(c.galleryMedia, c.galleryImages ?? []);
      const gallery = [
        ...galleryMedia.map((asset) => mediaPoster(asset)),
        mediaPoster(primaryMedia),
        cityFallbackImage,
      ].filter((image): image is string => Boolean(image?.trim()));

      return sanitizeRegion({
        slug: c.slug as RegionSlug,
        adcode: c.adcode ?? 0,
        name: c.name,
        label: c.regionLabel,
        summary: c.heroNarrative,
        narrative: c.editorIntro,
        tags: c.tags,
        food: c.foodDescription ?? "",
        routeSlugs: c.routes?.map((r) => r.slug) ?? [],
        image: mediaPoster(primaryMedia, gallery[0] || cityFallbackImage),
        gallery,
        serviceLabel: "",
        serviceHref: "/interpreting",
      });
    })
    .filter(hasVisibleRegionContent);
}

function mapCityCulture(c: ApiCity): CityCulture {
  const cityFallbackImage =
    c.slug === "chaozhou"
      ? "/editorial/pottery-workshop.jpg"
      : c.slug === "zhanjiang"
        ? "/editorial/guangdong-coast-boat.jpg"
        : "/editorial/guangdong-coast-rocky.jpg";
  const primaryMedia = resolvePrimaryMedia(c.heroMedia, c.heroImage);
  const galleryMedia = resolveMediaGallery(c.galleryMedia, c.galleryImages ?? []);
  const gallery = [
    ...galleryMedia.map((asset) => mediaPoster(asset)),
    mediaPoster(primaryMedia),
    cityFallbackImage,
  ].filter((image): image is string => Boolean(image?.trim()));

  return sanitizeCityCulture({
    slug: c.slug,
    name: c.name,
    adcode: c.adcode ?? 0,
    label: c.regionLabel,
    summary: c.editorIntro ?? "",
    contentMarkdown: c.contentMarkdown ?? "",
    publishedAt: c.publishedAt,
    narrative: c.heroNarrative,
    image: mediaPoster(primaryMedia, gallery[0] || cityFallbackImage),
    primaryMedia,
    gallery,
    galleryMedia,
    tags: c.tags ?? [],
    food: c.foodTitle,
    foodDescription: c.foodDescription ?? "",
    routeSlugs: c.routes?.map((r) => r.slug) ?? [],
    relatedCitySlugs: c.relatedCitySlugs ?? [],
    foodImages: c.foodImages ?? [],
    sections:
      c.sections?.map((s) => {
        const sectionMedia = resolvePrimaryMedia(s.primaryMedia, s.image);
        const media = resolveMediaGallery(s.media, s.images ?? []);
        const images = [
          ...media.map((asset) => mediaPoster(asset)),
          mediaPoster(sectionMedia),
          s.breathImage,
          cityFallbackImage,
        ].filter((image): image is string => Boolean(image?.trim()));

        return {
          title: s.title,
          body: s.body,
          image: mediaPoster(sectionMedia, images[0] || cityFallbackImage),
          primaryMedia: sectionMedia,
          images,
          media,
          stat:
            [s.statLabel, s.statValue].filter(Boolean).join(" / ") ||
            undefined,
          breathImage: s.breathImage ?? mediaPoster(sectionMedia, cityFallbackImage),
          breathQuote: s.breathQuote ?? undefined,
        };
      }) ?? [],
  });
}

export async function fetchCityCulturesServer(
): Promise<CityCulture[]> {
  const res = await serverGet<PaginatedResponse<ApiCity>>(
    "/public/cities",
    { page: 1, limit: 50 },
  );

  return res.data.map(mapCityCulture).filter(hasVisibleCityContent);
}

export async function fetchCityCultureBySlugServer(
  slug: string,
): Promise<CityCulture | null> {
  try {
    const res = await serverGet<ApiCity>(`/public/cities/${slug}`, {});
    if (!res?.slug) return null;
    const city = mapCityCulture(res);
    return hasVisibleCityContent(city) ? city : null;
  } catch (error) {
    if (error instanceof ServerApiError && error.statusCode === 404) return null;
    throw error;
  }
}

/**
 * Server-side home data fetch 鈥?mirrors fetchHomeData from api-data.ts
 * but uses serverGet instead of the window-dependent apiGet.
 */
export async function fetchHomeDataServer(
  routesPromise: Promise<StoryRoute[]> = fetchRoutesServer(),
): Promise<HomeData> {
  const [routes, cities, homeConfig] = await Promise.all([
    routesPromise,
    fetchCitiesServer(),
    serverGet<ApiHomeConfig>("/public/home"),
  ]);

  const hero: HomeHero = {
    image: homeConfig.hero?.image,
    caption: homeConfig.hero?.caption,
    ctaImage: homeConfig.hero?.ctaImage,
    badge: homeConfig.hero?.badge
      ? {
          value: homeConfig.hero.badge.value ?? "",
          label: homeConfig.hero.badge.label || "",
        }
      : undefined,
    interpretingLabel: homeConfig.hero?.interpretingLabel
      ? homeConfig.hero.interpretingLabel
      : undefined,
    interpretingImage: homeConfig.hero?.interpretingImage,
    video: homeConfig.hero?.video?.url
      ? {
          url: homeConfig.hero.video.url,
          poster: homeConfig.hero.video.poster || undefined,
          title: homeConfig.hero.video.title
            ? homeConfig.hero.video.title
            : undefined,
          description: homeConfig.hero.video.description
            ? homeConfig.hero.video.description
            : undefined,
          duration: homeConfig.hero.video.duration || undefined,
          resolution: homeConfig.hero.video.resolution || undefined,
        }
      : undefined,
  };

  const regionShowcase: Region[] = cities
    .map((c) =>
      sanitizeRegion({
        ...c,
        serviceLabel: `Book ${c.name} Support`,
      }),
    )
    .filter(hasVisibleRegionContent);

  const cityBySlug = new Map(regionShowcase.map((city) => [city.slug, city]));

  const cultureHighlightsFromApi = (homeConfig.cultureHighlights ?? []).map(
    (item) => {
      const linkedSlug =
        (typeof item.slug === 'string' && item.slug.trim()) ||
        (typeof (item as { citySlug?: string }).citySlug === 'string' &&
        (item as { citySlug?: string }).citySlug?.trim()) ||
        '';
      const linkedCity = linkedSlug
        ? cityBySlug.get(linkedSlug as (typeof regionShowcase)[number]["slug"])
        : undefined;

      return {
        slug: linkedSlug || item.slug,
        title:
          item.title ||
          linkedCity?.label ||
          linkedCity?.name ||
          '',
        body:
          item.body || linkedCity?.summary || '',
        href: item.href ?? `/culture/${linkedSlug || item.slug}`,
        image:
          item.image ||
          linkedCity?.image ||
          linkedCity?.gallery?.[0] ||
          undefined,
        place: linkedCity?.label || linkedCity?.name || undefined,
      };
    },
  );

  const cultureHighlights: CultureFeature[] =
    cultureHighlightsFromApi.length > 0
      ? cultureHighlightsFromApi
      : regionShowcase.slice(0, 3).map((c) => ({
          slug: c.slug,
          title: c.name,
          body: c.summary ?? "",
          href: `/culture/${c.slug}`,
          image: c.image || c.gallery?.[0] || undefined,
        }));

  // Testimonials are CMS-only. When the admin has not authored any, render
  // nothing rather than inventing a traveller — the home client shows an
  // honest empty state instead.
  const testimonials: Testimonial[] = (homeConfig.testimonials ?? []).map(
    (t) => ({
      quote: t.quote,
      name: t.name,
    }),
  );

  const trustMetrics: TrustMetric[] = (
    homeConfig.trustMetrics ?? [
      { value: String(cities.length || 1), label: "cities" },
      {
        value: String(routes.length || 1),
        label: "story routes",
      },
    ]
  ).map((m) => ({
    value: m.value,
    label: m.label,
  }));

  // heroStats: admin stores these as hero.stats (nested) or heroStats (top-level)
  const rawHeroStats = homeConfig.hero?.stats ?? homeConfig.heroStats ?? [];
  const heroStats: HomeHeroStat[] = rawHeroStats.map((s) => ({
    title: s.title,
    body: s.description,
  }));

  // entryCards: quick-access editorial links (e.g. "Explore Routes", "Book Interpreting")
  const homeEntryCards: HomeEntryCard[] =
    homeConfig.entryCards?.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      href: item.href,
      image: item.image || undefined,
    })) ?? [];

  return { hero, heroStats, regionShowcase, cultureHighlights, testimonials, trustMetrics, homeEntryCards };
}

/**
 * Server-side store products fetch.
 */
export async function fetchStoreProductsServer(
): Promise<StoreProduct[]> {
  try {
    const res = await serverGet<{ data: ApiStoreProduct[] }>(
      "/public/shop/products",
      { page: 1, limit: 50 },
    );
    return (res.data ?? []).map(mapProduct);
  } catch {
    return [];
  }
}

export async function fetchStoreProductBySlugServer(
  slug: string,
): Promise<StoreProduct | null> {
  try {
    const res = await serverGet<{ product: ApiStoreProduct }>(
      `/public/shop/products/${slug}`,
      { },
    );
    return res.product ? mapProduct(res.product) : null;
  } catch {
    return null;
  }
}


export async function fetchStoreCollectionsServer(
): Promise<StoreCollection[]> {
  try {
    const res = await serverGet<{ data: ApiStoreCollection[] }>(
      "/public/shop/collections",
      { },
    );
    return (res.data ?? []).map(mapCollection);
  } catch {
    return [];
  }
}
/**
 * Server-side routes fetch.
 */
export async function fetchRoutesServerForHome(
): Promise<StoryRoute[]> {
  try {
    return await fetchRoutesServer();
  } catch {
    return [];
  }
}

/**
 * Server-side events fetch.
 */
export async function fetchEventsServer(): Promise<EventData[]> {
  try {
    const res = await serverGet<{ data: ApiEvent[] }>(
      "/public/events",
      { page: 1, limit: 50 },
    );
    return (res.data ?? []).map((item) => mapEvent(item));
  } catch {
    return [];
  }
}

export async function fetchInterpretingServer(): Promise<InterpretingData> {
  const res = await serverGet<{
    service_modes: InterpretingData["serviceModes"];
    profiles: InterpretingData["profiles"];
    faqs: InterpretingData["faqs"];
  }>("/public/interpreting");

  return {
    serviceModes: res.service_modes ?? [],
    profiles: res.profiles ?? [],
    faqs: res.faqs ?? [],
  };
}
