"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
import {
  fetchEvents,
  fetchHomeData,
  fetchStoreProducts,
  fetchRoutes,
  type EventData,
} from "@/lib/api-data";
import type { HomeData } from "@/lib/server-data";
import { useApiQuery, LoadingSpinner, ErrorState } from "@/lib/use-api-query";
import { CultureGallery } from "@/components/home/CultureGallery";
import { GuangdongMapSection } from "@/components/home/GuangdongMapSection";
import { GuangdongEventCalendar } from "@/components/home/GuangdongEventCalendar";
import { HomeVideoChapter } from "@/components/home/HomeVideoChapter";
import { Reveal } from "@/components/ui/Reveal";
import { placeholderFor } from "@/lib/placeholders";
import { SEED_IMAGES } from "@/lib/seed-images";
import type { StoryRoute } from "@/data/routes";
import type { StoreProduct } from "@/data/store";
import { HomeAtlasHero } from "@/components/home/HomeAtlasHero";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { usePreviewBridge } from "@/lib/preview";
import { CityTicket } from "@/components/home/CityTicket";
import "./styles/home.css";

interface HomeClientProps {
  initialHomeData: HomeData | null;
  initialProducts: StoreProduct[] | null;
  initialRoutes: StoryRoute[] | null;
  initialEvents: EventData[] | null;
}

export default function HomeClient({
  initialHomeData,
  initialProducts,
  initialRoutes,
  initialEvents,
}: HomeClientProps) {
  const { t } = useLocale();
  const { previewData: previewHome } =
    usePreviewBridge<Partial<HomeData>>("home");
  const { previewData: previewEvent } =
    usePreviewBridge<EventData>("event");

  // SSR data renders immediately. Avoid duplicating the same public API requests
  // after hydration; preview updates continue to arrive through usePreviewBridge.
  const { data: homeData, loading: homeLoading } = useApiQuery(
    () => fetchHomeData(),
    [],
    { initialData: initialHomeData, revalidateOnMount: false },
  );

  const { data: products } = useApiQuery(
    () => fetchStoreProducts(),
    [],
    { initialData: initialProducts, revalidateOnMount: false },
  );

  const { data: allRoutes } = useApiQuery(
    () => fetchRoutes(),
    [],
    { initialData: initialRoutes, revalidateOnMount: false },
  );

  const { data: events } = useApiQuery(
    () => fetchEvents(),
    [],
    { initialData: initialEvents, revalidateOnMount: false },
  );

  // Only show loading spinner if we have NO initial data at all
  // (e.g., SSR failed AND client fetch is still pending).
  // In normal operation, initialHomeData is always available from SSR.
  if (homeLoading && !initialHomeData)
    return <LoadingSpinner text="Loading home…" />;
  if (!homeData && !initialHomeData)
    return (
      <ErrorState
        title="Home unavailable"
        message="Home content could not be loaded. Please try again."
      />
    );

  // Use SSR data as fallback when client fetch hasn't returned yet
  const baseHomeData = homeData ?? initialHomeData;
  if (!baseHomeData) return null;
  const effectiveHomeData: HomeData = previewHome
    ? {
        ...baseHomeData,
        ...previewHome,
        hero: {
          ...baseHomeData.hero,
          ...previewHome.hero,
        },
      }
    : baseHomeData;

  const { hero, regionShowcase, cultureHighlights } = effectiveHomeData;

  const storeProducts = products ?? initialProducts ?? [];
  const storyRoutes = allRoutes ?? initialRoutes ?? [];
  const baseEvents = events ?? initialEvents ?? [];
  const liveEvents = previewEvent
    ? [
        previewEvent,
        ...baseEvents.filter(
          (event) =>
            event.id !== previewEvent.id && event.slug !== previewEvent.slug,
        ),
      ]
    : baseEvents;

  // Image priority: live CMS field → curated backend seed image → local Journal placeholder.
  // This way admin uploads will replace seed images automatically once available.
  const heroImage =
    hero.image ?? SEED_IMAGES.homeHero ?? placeholderFor("portrait");


  return (
    <div className="bg-[var(--paper-deep)] bg-grain min-h-screen text-[var(--river-deep)]">
      <HomeAtlasHero image={heroImage} />

      <div className="relative z-10">
        <HomeVideoChapter video={hero.video} />

        {/* 2. MAP PILLAR */}
        <GuangdongMapSection cities={regionShowcase} events={liveEvents} />

        {/* Divider */}
        <div className="site-container">
          <div className="h-px bg-[var(--line)]" />
        </div>

        {/* 3. CALENDAR & ROUTE PILLAR */}
        <GuangdongEventCalendar events={liveEvents} routes={storyRoutes} previewEvent={previewEvent ?? undefined} />

        {/* Divider */}
        <div className="site-container">
          <div className="h-px bg-[var(--line)]" />
        </div>

        {/* 4. SHOP: THE COLLECTOR'S SHELF */}
        <section id="home-shop" className="site-container py-beat">
          <div className="mb-10 flex flex-col justify-between gap-6 md:mb-20 md:flex-row md:items-end md:gap-12">
            <div className="max-w-2xl">
              <Reveal>
                <div className="mb-5 flex items-center gap-4 md:mb-6">
                  <div className="w-10 h-px bg-[var(--cinnabar)]" />
                  <p className="text-[12px] font-bold uppercase tracking-[0.4em] text-[var(--cinnabar)]">
                    {t("shop.page.title")}
                  </p>
                </div>
                <h2 className="font-[family:var(--font-display)] text-[clamp(2.25rem,9.6vw,2.65rem)] leading-[0.98] text-[var(--river-deep)] md:text-7xl">
                  {t("home.shop.title")}
                </h2>
              </Reveal>
            </div>
            <Link
              href="/shop"
              className="group flex min-h-11 items-center gap-3 text-xs font-bold uppercase tracking-widest text-[var(--river-deep)]"
            >
              <span>{t("home.shop.exploreCollection")}</span>
              <div className="h-px w-16 origin-left scale-x-[0.625] bg-[var(--river-deep)]/30 transition-[transform,background-color] duration-300 group-hover:scale-x-100 group-hover:bg-[var(--cinnabar)]" />
            </Link>
          </div>

          {storeProducts.length > 0 ? (
            <div className="scroll-fade-x scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-8 md:mx-auto md:grid md:max-w-[69rem] md:grid-cols-2 md:gap-x-20 md:gap-y-20 md:overflow-visible md:px-0 md:pb-10 lg:gap-x-28 lg:pb-16">
              {storeProducts.slice(0, 6).map((product, idx) => (
                <div
                  key={product.slug}
                  className={`w-[82vw] max-w-[24rem] shrink-0 snap-start pb-2 sm:w-[64vw] md:w-auto md:max-w-none md:shrink md:snap-none md:pb-10 ${
                    idx >= 2 ? "md:hidden" : ""
                  } ${idx === 1 ? "md:pt-20 lg:pt-28" : ""}`}
                >
                  <StoreProductCard product={product} index={idx} />
                </div>
              ))}
            </div>
          ) : (
            <div className="max-w-2xl rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-strong)] p-8 shadow-lift sm:p-10">
              <p className="text-[12px] font-bold uppercase tracking-[0.3em] text-[var(--gold)]">
                {t("shop.page.title")}
              </p>
              <h3 className="mt-4 font-[family:var(--font-display)] text-3xl text-[var(--river-deep)]">
                {t("home.shop.empty.title")}
              </h3>
              <p className="mt-4 text-base leading-7 text-[var(--muted)]">
                {t("home.shop.empty.body")}
              </p>
            </div>
          )}
        </section>

        {/* Divider */}
        <div className="site-container">
          <div className="h-px bg-[var(--line)]" />
        </div>

        {/* 5. Anonymous city souvenir, replacing the former interpreting panel. */}
        <CityTicket cities={regionShowcase} />

        {/* 6. CULTURE: THE GALLERY ARCHIVE */}
        <section id="home-culture" className="site-container pb-16 sm:pb-20 lg:pb-28">
          <div className="border-t border-black/5 pt-16 sm:pt-20 lg:pt-28">
            <CultureGallery highlights={cultureHighlights} />
          </div>
        </section>


      </div>
    </div>
  );
}
