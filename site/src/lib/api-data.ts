/**
 * API Data Module
 *
 * Bridges backend API responses 鈫?frontend TypeScript types.
 * Each function:
 *  1. Calls the backend via apiClient
 *  2. Maps the response shape to the consumer type expected
 *  3. Returns a clean result (or throws on failure)
 *
 * The storefront is English-only; no locale is negotiated.
 */

import { apiGet, apiPost, ApiRequestError } from "./api-client";
import type {
  Region,
  RegionSlug,
  FeaturedRoute,
  CultureFeature,
  Testimonial,
  TrustMetric,
  HomeEntryCard,
  HomeHero,
  HomeHeroStat,
} from "@/types/content";
import type { CityCulture } from "@/data/culture";
import type { StoryRoute } from "@/data/routes";
import type { StoreCollection, StoreProduct } from "@/data/store";
import type { MediaAsset, MediaType } from "@/types/media";
import {
  mediaPoster,
  resolveMediaGallery,
  resolvePrimaryMedia,
} from "@/types/media";
import { SEED_IMAGES } from "@/lib/seed-images";
import { placeholderFor } from "@/lib/placeholders";
import {
  DEFAULT_ROUTE_REGIONS,
  type RouteRegion,
} from "@/lib/route-regions";
import {
  hasVisibleCityContent,
  hasVisibleRegionContent,
  sanitizeCityCulture,
  sanitizeRegion,
} from "@/lib/content-cleaners";


// In-memory data cache

const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 15_000; // 15 seconds

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data as T;
  cache.delete(key);
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/** Clear all cached API data. Useful after mutations or for manual invalidation. */
export function clearCache(): void {
  cache.clear();
}
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ Internal API response types 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

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

interface ApiStoreCollection {
  id: string;
  slug: string;
  title: string;
  routeName: string;
  routeSlug: string;
  image: string;
  body: string;
  productCount?: number;
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
  collection: {
    slug: string;
    title: string;
  } | null;
  product: {
    name: string;
    tag: string;
  };
  materialNotes: string | null;
  story: string;
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

interface PaginatedResponse<T> {
  data: T[];
  total: number;
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

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ Mappers 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function mapRoute(apiRoute: ApiStoryRoute): StoryRoute {
  const routeFallbackImage =
    apiRoute.slug === "southern-sea-table"
      ? "/editorial/guangdong-coast-hero.jpg"
      : apiRoute.slug === "chaoshan-tea-culture"
        ? "/editorial/pottery-painting.jpg"
        : SEED_IMAGES.routesHero ?? placeholderFor("hero");
  const southernSeaTableStopImages =
    apiRoute.slug === "southern-sea-table"
      ? [
          [SEED_IMAGES.routeHuguangyan, SEED_IMAGES.routeVolcanicLandscape1200, SEED_IMAGES.routeVolcanicLandscape800],
          [SEED_IMAGES.routeDongfeng, SEED_IMAGES.routeSeafoodDishes800, SEED_IMAGES.routeSouthernCoast1200],
          [SEED_IMAGES.routeXiashan, SEED_IMAGES.routeSouthernCoast1400, SEED_IMAGES.routeSouthernCoast1200],
          [SEED_IMAGES.routeJinsha, SEED_IMAGES.routeSouthernCoast1400, SEED_IMAGES.routeSeafoodDishes800],
        ]
      : [];

  return {
    slug: apiRoute.slug,
    title: apiRoute.title,
    culture: apiRoute.cultureTag as StoryRoute["culture"],
    city: apiRoute.cityName,
    citySlugs: apiRoute.routeCityLinks?.map((l) => l.citySlug) ?? [],
    duration: apiRoute.duration,
    audience: apiRoute.audience,
    summary: apiRoute.summary,
    story: apiRoute.story,
    image: apiRoute.coverImage || routeFallbackImage,
    routeRegionKey: apiRoute.routeRegionKey ?? undefined,
    mapViewBox: "0 0 900 600",
    itinerary: (apiRoute.stops ?? []).map((s, index) => {
      const fallbackImages = southernSeaTableStopImages[index] ?? [];
      const primaryMedia = resolvePrimaryMedia(
        s.primaryMedia,
        s.image || fallbackImages[0] || routeFallbackImage,
      );
      const media = resolveMediaGallery(s.media, s.images ?? []);
      const images = [
        mediaPoster(primaryMedia),
        ...media.map((asset) => mediaPoster(asset)),
        ...fallbackImages,
        routeFallbackImage,
      ].filter((frame): frame is string => Boolean(frame?.trim()));
      const uniqueImages = Array.from(new Set(images)).slice(0, 3);

      return {
        time: s.time,
        isFeatured: s.isFeatured,
        stop: s.stopName,
        plan: s.plan ?? "",
        story: s.story ?? "",
        details: s.details ?? [],
        culturalStory: s.culturalStory ?? "",
        lat: s.lat ?? null,
        lng: s.lng ?? null,
        placeDetail: s.placeDetail,
        meal: s.meal ?? undefined,
        hotel: s.hotel ?? undefined,
        transit: s.transit ?? undefined,
        image: mediaPoster(primaryMedia, uniqueImages[0] ?? routeFallbackImage),
        primaryMedia,
        images: uniqueImages.length > 1 ? uniqueImages : undefined,
        media,
      };
    }),
  };
}

function mapCity(apiCity: ApiCity): CityCulture {
  const cityFallbackImage =
    apiCity.slug === "chaozhou"
      ? "/editorial/pottery-workshop.jpg"
      : apiCity.slug === "zhanjiang"
        ? "/editorial/guangdong-coast-boat.jpg"
        : "/editorial/guangdong-coast-rocky.jpg";
  const primaryMedia = resolvePrimaryMedia(apiCity.heroMedia, apiCity.heroImage);
  const galleryMedia = resolveMediaGallery(
    apiCity.galleryMedia,
    apiCity.galleryImages ?? [],
  );
  const gallery = [
    ...galleryMedia.map((asset) => mediaPoster(asset)),
    mediaPoster(primaryMedia),
    cityFallbackImage,
  ].filter((image): image is string => Boolean(image?.trim()));

  return sanitizeCityCulture({
    slug: apiCity.slug,
    name: apiCity.name,
    adcode: apiCity.adcode ?? 0,
    label: apiCity.regionLabel,
    summary: apiCity.editorIntro ?? "",
    contentMarkdown: apiCity.contentMarkdown ?? "",
    publishedAt: apiCity.publishedAt,
    narrative: apiCity.heroNarrative,
    image: mediaPoster(primaryMedia, gallery[0] || cityFallbackImage),
    primaryMedia,
    gallery,
    galleryMedia,
    tags: apiCity.tags ?? [],
    food: apiCity.foodTitle,
    foodDescription: apiCity.foodDescription ?? "",
    routeSlugs: apiCity.routes?.map((r) => r.slug) ?? [],
    relatedCitySlugs: apiCity.relatedCitySlugs ?? [],
    foodImages: apiCity.foodImages ?? [],
    sections:
      apiCity.sections?.map((s) => {
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
            [s.statLabel, s.statValue].filter(Boolean).join(" / ") || undefined,
          breathImage: s.breathImage ?? mediaPoster(sectionMedia, cityFallbackImage),
          breathQuote: s.breathQuote ?? undefined,
        };
      }) ?? [],
  });
}

function mapProduct(apiProduct: ApiStoreProduct): StoreProduct {
  const primaryMedia = resolvePrimaryMedia(apiProduct.primaryMedia, apiProduct.image);
  const galleryMedia = resolveMediaGallery(
    apiProduct.galleryMedia,
    apiProduct.gallery ?? [],
  );
  return {
    id: apiProduct.id,
    slug: apiProduct.slug,
    name: apiProduct.product.name,
    collection: apiProduct.collection?.title ?? "",
    price: Number(apiProduct.price),
    currency: (apiProduct.currency as StoreProduct["currency"]) ?? "CNY",
    tag: apiProduct.product.tag,
    image: mediaPoster(primaryMedia, apiProduct.image),
    primaryMedia,
    materialNotes: apiProduct.materialNotes ?? undefined,
    story: apiProduct.story,
    gallery: galleryMedia.map((asset) => mediaPoster(asset)).filter(Boolean),
    galleryMedia,
  };
}

function mapCollection(apiCol: ApiStoreCollection): StoreCollection {
  return {
    title: apiCol.title,
    route: apiCol.routeName,
    href: `/routes/${apiCol.routeSlug}`,
    image: apiCol.image,
    body: apiCol.body,
  };
}

export type EventData = {
  id: string;
  slug: string;
  title: string;
  date: string;
  city: string;
  citySlug: string;
  tags: string[];
  summary: string;
  description: string;
  relatedRouteSlugs: string[];
  image: string;
};

function mapEvent(apiEvent: ApiEvent): EventData {
  const eventFallbackImage =
    apiEvent.citySlug === "chaozhou"
      ? "/editorial/pottery-painting.jpg"
      : apiEvent.citySlug === "zhanjiang"
        ? "/editorial/guangdong-coast-hero.jpg"
        : "/editorial/guangdong-coast-rocky.jpg";

  return {
    id: apiEvent.id,
    slug: apiEvent.slug,
    title: apiEvent.title,
    date: apiEvent.date,
    city: apiEvent.city,
    citySlug: apiEvent.citySlug,
    tags: apiEvent.tags ?? [],
    summary: apiEvent.summary,
    description: apiEvent.description ?? "",
    relatedRouteSlugs: apiEvent.relatedRouteSlugs ?? [],
    image: apiEvent.image || eventFallbackImage,
  };
}

export interface ApiInterpretingMode {
  id: string;
  sortOrder: number;
  title: string;
  price: string;
  bestFor: string;
  body: string;
  includes: string[];
  accent: "light" | "dark";
  featured: boolean;
}

export interface ApiInterpreterProfile {
  id: string;
  sortOrder: number;
  name: string;
  language: string;
  focus: string;
  helps: string[];
  avatar?: string;
}

export interface ApiInterpretingFaq {
  id: string;
  sortOrder: number;
  question: string;
  answer: string;
}

export interface InterpretingData {
  serviceModes: ApiInterpretingMode[];
  profiles: ApiInterpreterProfile[];
  faqs: ApiInterpretingFaq[];
}

export type InterpretingBookingPayload = {
  name: string;
  contact: string;
  city: string;
  serviceDate: string;
  supportMode: string;
  groupSize?: string;
  routeOrNeed?: string;
  fastTrack?: boolean;
};

export type InterpretingDepositCheckout = {
  bookingId: string;
  created_at: string;
  status: string;
  message: string;
  deposit: {
    orderNo: string;
    amount: number;
    currency: string;
    status: string;
    paymentLabel: string;
    paypalOrderId: string;
    paypalApprovalUrl: string | null;
    publicStatusToken: string;
  };
};

export type TravelerInterpretingBooking = {
  id: string;
  city: string;
  serviceDate: string;
  supportMode: string;
  groupSize: string | null;
  routeOrNeed: string | null;
  status: string;
  assignedInterpreterName: string | null;
  createdAt: string;
  updatedAt: string;
};

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ Public API data hooks 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export async function fetchInterpreting(
): Promise<InterpretingData> {
  const res = await apiGet<{
    service_modes: ApiInterpretingMode[];
    profiles: ApiInterpreterProfile[];
    faqs: ApiInterpretingFaq[];
  }>("/public/interpreting", {
  });
  return {
    serviceModes: res.service_modes ?? [],
    profiles: res.profiles ?? [],
    faqs: res.faqs ?? [],
  };
}

export async function createInterpretingDepositCheckout(
  payload: InterpretingBookingPayload,
  idempotencyKey?: string,
): Promise<InterpretingDepositCheckout> {
  return apiPost<InterpretingDepositCheckout>(
    "/public/bookings/checkout",
    payload,
    idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {},
  );
}

export async function fetchTravelerInterpretingBookings(): Promise<
  TravelerInterpretingBooking[]
> {
  const response = await apiGet<{
    items: TravelerInterpretingBooking[];
    total: number;
  }>("/account/interpreting/bookings", { page: 1, pageSize: 50 });
  return response.items ?? [];
}

export async function fetchRoutes(): Promise<StoryRoute[]> {
  const key = "routes";
  const cached = getCached<StoryRoute[]>(key);
  if (cached) return cached;
  const res = await apiGet<PaginatedResponse<ApiStoryRoute>>("/public/routes", {
    page: 1,
    limit: 50,
  });
  const result = res.data.map(mapRoute);
  setCache(key, result);
  return result;
}

export async function fetchRouteBySlug(
  slug: string,
): Promise<StoryRoute | null> {
  try {
    const res = await apiGet<ApiStoryRoute>(`/public/routes/${slug}`, {
    });
    return mapRoute(res);
  } catch {
    return null;
  }
}

export async function fetchCities(): Promise<CityCulture[]> {
  const res = await apiGet<PaginatedResponse<ApiCity>>("/public/cities", {
    page: 1,
    limit: 50,
  });
  return res.data.map(mapCity).filter(hasVisibleCityContent);
}

export async function fetchCityBySlug(
  slug: string,
): Promise<CityCulture | null> {
  try {
    const res = await apiGet<ApiCity>(`/public/cities/${slug}`, {
    });
    return mapCity(res);
  } catch (error) {
    if (error instanceof ApiRequestError && error.statusCode === 404) return null;
    throw error;
  }
}

export async function fetchStoreCollections(
): Promise<StoreCollection[]> {
  const res = await apiGet<{ data: ApiStoreCollection[] }>(
    "/public/shop/collections",
    {
    },
  );
  return (res.data ?? []).map(mapCollection);
}

export async function fetchStoreProducts(
  collectionSlug?: string,
): Promise<StoreProduct[]> {
  const key = `products:${collectionSlug ?? ""}`;
  const cached = getCached<StoreProduct[]>(key);
  if (cached) return cached;
  const params: Record<string, string | number | undefined> = {
    page: 1,
    limit: 50,
  };
  if (collectionSlug) params.collection = collectionSlug;
  const res = await apiGet<{ data: ApiStoreProduct[] }>(
    "/public/shop/products",
    params,
  );
  const result = (res.data ?? []).map(mapProduct);
  setCache(key, result);
  return result;
}

export async function fetchStoreProductBySlug(
  slug: string,
): Promise<StoreProduct | null> {
  try {
    const res = await apiGet<{ product: ApiStoreProduct }>(
      `/public/shop/products/${slug}`,
    );
    return res.product ? mapProduct(res.product) : null;
  } catch {
    return null;
  }
}

export async function fetchEvents(): Promise<EventData[]> {
  const key = "events";
  const cached = getCached<EventData[]>(key);
  if (cached) return cached;
  const res = await apiGet<{ data: ApiEvent[] }>("/public/events", {
    page: 1,
    limit: 50,
  });
  const result = (res.data ?? []).map((item) => mapEvent(item));
  setCache(key, result);
  return result;
}

export async function fetchEventBySlug(
  slug: string,
): Promise<EventData | null> {
  try {
    const res = await apiGet<ApiEvent>(`/public/events/${slug}`);
    return mapEvent(res);
  } catch {
    return null;
  }
}

export async function fetchRelatedProducts(
  product: StoreProduct,
  allProducts: StoreProduct[],
): Promise<StoreProduct[]> {
  const getCollectionTitle = (p: StoreProduct) => p.collection ?? "";

  const targetTitle = getCollectionTitle(product);
  return allProducts.filter(
    (p) => p.slug !== product.slug && getCollectionTitle(p) === targetTitle,
  );
}

export interface HomeData {
  hero: HomeHero;
  heroStats: HomeHeroStat[];
  regionShowcase: Region[];
  featuredRoutes: FeaturedRoute[];
  cultureHighlights: CultureFeature[];
  testimonials: Testimonial[];
  trustMetrics: TrustMetric[];
  homeEntryCards: HomeEntryCard[];
  routeRegions: RouteRegion[];
}

export async function fetchRouteRegions(): Promise<RouteRegion[]> {
  try {
    const homeConfig = await apiGet<ApiHomeConfig>("/public/home");
    if (!homeConfig.routeRegions?.length) return DEFAULT_ROUTE_REGIONS;
    return homeConfig.routeRegions.map((region) => ({
      key: region.key,
      title: region.title,
      note: region.note,
      adcodes: Array.isArray(region.adcodes) ? region.adcodes : [],
    }));
  } catch {
    return DEFAULT_ROUTE_REGIONS;
  }
}

export async function fetchHomeData(): Promise<HomeData> {
  const [routesResult, citiesResult, homeConfigResult] =
    await Promise.allSettled([
      fetchRoutes(),
      fetchCities(),
      apiGet<ApiHomeConfig>("/public/home"),
    ]);

  const routes = routesResult.status === "fulfilled" ? routesResult.value : [];
  const cities = citiesResult.status === "fulfilled" ? citiesResult.value : [];
  const homeConfig =
    homeConfigResult.status === "fulfilled"
      ? homeConfigResult.value
      : ({} as ApiHomeConfig);

  const featured =
    routes.find((r) => homeConfig.featuredRouteSlugs?.includes(r.slug)) ??
    routes[0];

  const regionShowcase: Region[] = cities
    .map((c) =>
      sanitizeRegion({
        slug: c.slug as RegionSlug,
        adcode: c.adcode,
        name: c.name,
        label: c.label,
        summary: c.summary,
        narrative: c.narrative,
        tags: c.tags,
        food: c.food,
        routeSlugs: c.routeSlugs,
        serviceLabel: `Book ${c.name} Support`,
        serviceHref: "/interpreting",
        image: c.image,
        gallery: c.gallery,
      }),
    )
    .filter(hasVisibleRegionContent);

  const featuredRoutes: FeaturedRoute[] = featured
    ? [
        {
          slug: featured.slug,
          title: featured.title,
          theme: featured.culture,
          duration: featured.duration,
          audience: featured.audience,
          description: featured.summary,
        },
      ]
    : [];

  const cityBySlug = new Map(regionShowcase.map((city) => [city.slug, city]));

  const cultureHighlightsFromApi = (homeConfig.cultureHighlights ?? []).map(
    (item) => {
      const linkedSlug =
        (typeof item.slug === "string" && item.slug.trim()) ||
        (typeof (item as { citySlug?: string }).citySlug === "string" &&
        (item as { citySlug?: string }).citySlug?.trim()) ||
        "";
      const linkedCity = linkedSlug
        ? cityBySlug.get(linkedSlug as (typeof regionShowcase)[number]["slug"])
        : undefined;

      return {
        slug: linkedSlug || item.slug,
        title:
          item.title ||
          linkedCity?.label ||
          linkedCity?.name ||
          "",
        body:
          item.body || linkedCity?.summary || "",
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
      : regionShowcase.map((city) => ({
          slug: city.slug,
          title: city.label,
          body: city.summary,
          href: `/culture/${city.slug}`,
          image: city.image || city.gallery?.[0] || undefined,
        }));

  // Map the editorial hero block. All fields fall through to undefined,
  // letting the page render Journal placeholders cleanly.
  const heroSrc = homeConfig.hero ?? {};
  const hero: HomeHero = {
    image: heroSrc.image || undefined,
    caption: heroSrc.caption || undefined,
    ctaImage: heroSrc.ctaImage || undefined,
    interpretingImage: heroSrc.interpretingImage || undefined,
    video: heroSrc.video?.url
      ? {
          url: heroSrc.video.url,
          poster: heroSrc.video.poster || undefined,
          title: heroSrc.video.title || undefined,
          description: heroSrc.video.description
            ? heroSrc.video.description
            : undefined,
          duration: heroSrc.video.duration || undefined,
          resolution: heroSrc.video.resolution || undefined,
        }
      : undefined,
    interpretingLabel: heroSrc.interpretingLabel
      ? heroSrc.interpretingLabel
      : undefined,
    badge: heroSrc.badge
      ? {
          value: heroSrc.badge.value ?? "",
          label: heroSrc.badge.label
            ? heroSrc.badge.label
            : "",
        }
      : undefined,
  };

  const routeRegions =
    homeConfig.routeRegions?.length
      ? homeConfig.routeRegions.map((region) => ({
          key: region.key,
          title: region.title,
          note: region.note,
          adcodes: Array.isArray(region.adcodes) ? region.adcodes : [],
        }))
      : DEFAULT_ROUTE_REGIONS;

  // heroStats: admin stores these as hero.stats (nested) or heroStats (top-level)
  const rawHeroStats = homeConfig.hero?.stats ?? homeConfig.heroStats ?? [];
  const heroStats: HomeHeroStat[] = rawHeroStats.map((s) => ({
    title: s.title,
    body: s.description,
  }));

  // Testimonials: CMS-only. When the admin has not authored any, return an
  // empty list — the home client renders an honest empty state. Never fall
  // back to invented traveller quotes.
  const cmsTestimonials = (homeConfig.testimonials ?? [])
    .map((item) => ({
      quote: item.quote,
      name: item.name,
    }))
    .filter((item) => item.quote && item.name);

  const homeData: HomeData = {
    hero,
    heroStats,
    regionShowcase,
    featuredRoutes,
    cultureHighlights,
    testimonials: cmsTestimonials,
    trustMetrics: homeConfig.trustMetrics?.map((item) => ({
      value: item.value,
      label: item.label,
    })) ?? [
      {
        value: String(cities.length || 1),
        label: "Featured city",
      },
      {
        value: String(routes.length || 1),
        label: "Story route",
      },
      {
        value: "1",
        label: "Cultural collection",
      },
    ],
    homeEntryCards:
      homeConfig.entryCards?.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        href: item.href,
        image: item.image || undefined,
      })) ?? [],
    routeRegions,
  };
  return homeData;
}

// Re-export useApiQuery for convenience
export { useApiQuery, type AsyncState } from "./use-api-query";

// ───────────────── Community posts (route detail page) ─────────────────

/**
 * 帖子媒体项。社区媒体只有这两种，不存在"视频"。
 * image 为普通图片；live 为 live 实况图——与图片走同一个上传端点，url 指向
 * 收下的文件，展示层以首帧作为静态画面、点击播放。
 *
 * 形状复用全局 MediaAsset 契约（poster / alt 一致），但类型上锁死为非 video，
 * 因为社区的媒体契约里没有视频这一档。
 */
export type CommunityPostMedia = Omit<MediaAsset, "type"> & {
  type: Extract<MediaType, "image" | "live">;
};

export type CommunityFeedPost = {
  id: string;
  title: string;
  excerpt: string;
  channel: string;
  user: { name: string; handle?: string; avatar?: string };
  image: string;
  media: CommunityPostMedia[];
  location: string;
  route: string;
  createdAt: string;
  date: string;
  readTime: string;
  mood: string;
  tags: string[];
  likes: number;
  saves: number;
  liked?: boolean;
  saved?: boolean;
  prompt: string;
  status: string;
};

export type RouteCommunityPost = Omit<
  CommunityFeedPost,
  "date" | "readTime" | "likes" | "saves" | "prompt"
>;

interface ApiCommunityPost {
  id: string;
  channel: string;
  status: string;
  user: Record<string, unknown>;
  title: string;
  excerpt: string;
  tags?: string[];
  image: string | null;
  media?: { type: string; url: string; poster?: string; alt?: string }[] | null;
  location: string;
  route: string;
  mood: string;
  likes?: number;
  saves?: number;
  liked?: boolean;
  saved?: boolean;
  createdAt: string;
}

/**
 * Normalize the API media array (or the legacy single image column) into a
 * media list. Older posts only carry `image`, so it becomes a single image
 * item and the presentation layer can rely on `media` alone.
 */
function mapCommunityMedia(
  api: Pick<ApiCommunityPost, "media" | "image">,
): CommunityPostMedia[] {
  const items: CommunityPostMedia[] = [];
  for (const item of api.media ?? []) {
    if (!item?.url) continue;
    // The community contract has no video kind: anything else is dropped here
    // rather than rendered as a type the feed cannot present.
    if (item.type !== "image" && item.type !== "live") continue;
    items.push({
      type: item.type,
      url: item.url,
      ...(item.poster ? { poster: item.poster } : {}),
      ...(item.alt ? { alt: item.alt } : {}),
    });
  }
  if (items.length > 0) return items;
  if (api.image) return [{ type: "image", url: api.image }];
  return [];
}

function formatPostDate(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Content is authored once in English, but some legacy/local rows still hold
 * a `{ en, zh }` object inside the jsonb column. Accept strings verbatim and
 * unwrap objects to their English value so the presentation layer can rely
 * on plain strings.
 */
function readContentString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.en === "string") return record.en;
    if (typeof record.EN === "string") return record.EN;
  }
  return "";
}

function normalizeCommunityChannel(channel: string): string {
  const normalized = channel.trim().toLowerCase();
  if (normalized === "field-notes") return "Field Notes";
  if (normalized === "food-map") return "Food Map";
  if (normalized === "hidden-stop") return "Hidden Stop";
  if (normalized === "culture-desk") return "Culture Desk";
  return channel;
}

function mapCommunityPost(
  api: ApiCommunityPost,
): CommunityFeedPost {
  const userObj = (api.user ?? {}) as Record<string, unknown>;
  const location = api.location ?? "";
  const route = api.route ?? "";
  const tags = api.tags ?? [];
  return {
    id: api.id,
    title: readContentString(api.title),
    excerpt: readContentString(api.excerpt),
    channel: normalizeCommunityChannel(api.channel),
    user: {
      name: typeof userObj.name === "string" ? userObj.name : "Field Agent",
      handle: typeof userObj.handle === "string" ? userObj.handle : undefined,
      avatar: typeof userObj.avatar === "string" ? userObj.avatar : undefined,
    },
    image: api.image ?? "",
    media: mapCommunityMedia(api),
    location,
    route,
    createdAt: api.createdAt,
    date: formatPostDate(api.createdAt),
    readTime: "1 min",
    mood: api.mood ?? "",
    tags,
    likes: api.likes ?? 0,
    saves: api.saves ?? 0,
    liked: api.liked ?? false,
    saved: api.saved ?? false,
    prompt:
      tags.length > 0
        ? `Track: ${tags.join(" · ")}`
        : `Filed from ${location || route || "Guangdong"}.`,
    status: api.status,
  };
}

/**
 * Fetch community posts attached to a route. The backend `route` field is
 * a free-form string (the route title). We fetch a generous page and filter
 * client-side because the API has no native route-slug filter.
 */
export async function fetchRouteCommunityPosts(
  options: {
    routeSlug: string;
    routeTitle?: string;
    stopName?: string;
  },
): Promise<RouteCommunityPost[]> {
  const { routeSlug, routeTitle, stopName } = options;
  try {
    const res = await apiGet<{ data: ApiCommunityPost[] }>(
      "/public/community/posts",
      {
        route: routeSlug,
        location: stopName,
        limit: 50,
      },
    );
    const routeTargets = [routeSlug, routeTitle].filter(Boolean).map((value) =>
      String(value).toLowerCase().trim(),
    );
    const stopTarget = stopName?.toLowerCase().trim();

    return (res.data ?? [])
      .map((p) => mapCommunityPost(p))
      .filter((p) => {
        const route = p.route.toLowerCase().trim();
        const location = p.location.toLowerCase().trim();
        const routeMatches = routeTargets.length === 0 || routeTargets.includes(route);
        const stopMatches = !stopTarget || location === stopTarget;
        return routeMatches && stopMatches;
      })
      .map(({ date: _date, readTime: _readTime, likes: _likes, saves: _saves, prompt: _prompt, ...post }) => {
        void _date;
        void _readTime;
        void _likes;
        void _saves;
        void _prompt;
        return post;
      })
      .slice(0, 12);
  } catch {
    return [];
  }
}

export type CreateCommunityPostInput = {
  body: string;
  routeSlug: string;
  routeTitle: string;
  routeCity: string;
  stop?: { index: number; time: string; name: string } | null;
  user: {
    id?: string;
    email?: string;
    name: string;
    handle?: string;
    avatar?: string;
  };
};

/**
 * Create a community post tied to the current route. Backend forces
 * `status: pending_review` for public posts, so the new post will not
 * immediately show up in fetchRouteCommunityPosts — the caller should
 * insert the response optimistically into its local state.
 */
export async function createCommunityPost(
  input: CreateCommunityPostInput,
): Promise<RouteCommunityPost> {
  // Trim and split the body into a short title (first sentence/line, max 80)
  // and an excerpt (the rest, capped at 280). Both fields are required by the API.
  const trimmed = input.body.trim();
  const firstLineEnd = trimmed.search(/[\n\.\!\?。！？]/);
  const titleSrc =
    firstLineEnd > 0 ? trimmed.slice(0, firstLineEnd).trim() : trimmed;
  const title =
    titleSrc.length > 80
      ? `${titleSrc.slice(0, 77)}...`
      : titleSrc || "Field Note";
  const excerpt =
    trimmed.length > 280 ? `${trimmed.slice(0, 277)}...` : trimmed;

  const payload = {
    channel: "Field Notes",
    user: input.user as Record<string, unknown>,
    userId: input.user.id,
    userEmail: input.user.email,
    title,
    excerpt,
    location: input.stop?.name ?? input.routeCity,
    route: input.routeSlug,
    mood: input.stop
      ? `${input.stop.time} · Stop ${input.stop.index + 1}`
      : "route field note",
    tags: [
      "field-note",
      `route:${input.routeSlug}`,
      input.stop ? `stop-index:${input.stop.index}` : null,
      input.stop ? `stop:${input.stop.name}` : null,
    ].filter((tag): tag is string => Boolean(tag)),
  };

  const created = await apiPost<ApiCommunityPost>(
    "/public/community/posts",
    payload,
  );
  const {
    date: _date,
    readTime: _readTime,
    likes: _likes,
    saves: _saves,
    prompt: _prompt,
    ...post
  } =
    mapCommunityPost(created);
  void _date;
  void _readTime;
  void _likes;
  void _saves;
  void _prompt;
  return post;
}

export async function fetchCommunityFeed(
  options?: { channel?: string; q?: string; limit?: number },
): Promise<CommunityFeedPost[]> {
  const res = await apiGet<{ data: ApiCommunityPost[] }>(
    "/public/community/posts",
    {
      channel:
        options?.channel && options.channel !== "All"
          ? options.channel
          : undefined,
      q: options?.q?.trim() || undefined,
      limit: options?.limit ?? 50,
    },
  );
  return (res.data ?? []).map((item) => mapCommunityPost(item));
}

export type CommunityReactionSummary = {
  likedPostIds: string[];
  savedPostIds: string[];
};

export async function fetchCommunityReactionSummary(): Promise<CommunityReactionSummary> {
  return apiGet<CommunityReactionSummary>("/public/community/me/reactions");
}

export async function fetchSavedCommunityPosts(
  limit = 12,
): Promise<CommunityFeedPost[]> {
  const posts = await apiGet<ApiCommunityPost[]>("/public/community/me/saves", {
    limit,
  });
  return posts.map((post) => mapCommunityPost(post));
}

export async function toggleCommunityPostLike(postId: string) {
  return apiPost<{ liked: boolean; likes: number }>(
    `/public/community/posts/${postId}/like`,
  );
}

export async function toggleCommunityPostSave(postId: string) {
  return apiPost<{ saved: boolean; saves: number }>(
    `/public/community/posts/${postId}/save`,
  );
}

export type CreateCommunityFeedInput = {
  title: string;
  note: string;
  route: string;
  location: string;
  mood: string;
  channel: string;
  image?: string;
  media?: CommunityPostMedia[];
  user: {
    id?: string;
    email?: string;
    name: string;
    handle?: string;
    avatar?: string;
  };
};

export async function createCommunityFeedPost(
  input: CreateCommunityFeedInput,
): Promise<CommunityFeedPost> {
  const safeTitle =
    input.title.trim() ||
    input.note.trim().split(/[\n.!?]/)[0]?.trim() ||
    `${input.channel} signal`;
  const hasVisual = Boolean(input.media?.length) || Boolean(input.image);
  const safeExcerpt =
    input.note.trim() ||
    (hasVisual ? "Shared as a visual signal from the field." : safeTitle);

  const payload = {
    channel: input.channel,
    user: input.user as Record<string, unknown>,
    userId: input.user.id,
    userEmail: input.user.email,
    title: safeTitle,
    excerpt: safeExcerpt,
    location: input.location,
    route: input.route,
    mood: input.mood,
    tags: [input.channel, input.location, input.route].filter(Boolean),
    image: input.image ?? null,
    media: input.media ?? [],
  };

  const created = await apiPost<ApiCommunityPost>(
    "/public/community/posts",
    payload,
  );
  return mapCommunityPost(created);
}

// ───────────────── Field Briefs (community brief tasks) ─────────────────

interface ApiCommunityBrief {
  id: string;
  slug: string;
  title: string | Record<string, unknown>;
  prompt: string | Record<string, unknown>;
  channel: string;
  location: string;
  route: string;
  mood: string;
  sortOrder: number;
  active: boolean;
}

export type FieldBrief = {
  id: string;
  slug: string;
  title: string;
  prompt: string;
  channel: string;
  location: string;
  route: string;
  mood: string;
};

function mapBrief(api: ApiCommunityBrief): FieldBrief {
  return {
    id: api.id,
    slug: api.slug,
    title: readContentString(api.title),
    prompt: readContentString(api.prompt),
    channel: api.channel || "Field Notes",
    location: api.location || "",
    route: api.route || "",
    mood: api.mood || "",
  };
}

/**
 * Fetch the editorial field briefs the community page surfaces as prompts.
 * Backend returns them already filtered by `active = true` and sorted by
 * `sortOrder`. If the request fails, callers get an empty array — the page
 * falls through to a neutral empty state.
 */
export async function fetchCommunityBriefs(
): Promise<FieldBrief[]> {
  try {
    const res = await apiGet<ApiCommunityBrief[]>(
      "/public/community/briefs",
    );
    return (res ?? []).map((b) => mapBrief(b));
  } catch {
    return [];
  }
}
