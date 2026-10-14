"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
import {
  fetchEvents,
  fetchHomeData,
  fetchInterpreting,
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

  // The interpreter line under the CTA states the real roster size and the
  // languages actually listed on published profiles — never a padded count.
  // It renders nothing until the API answers, so a failed request can't be
  // replaced by a made-up number.
  const { data: interpretingData } = useApiQuery(() => fetchInterpreting(), []);
  const interpreterProfiles = interpretingData?.profiles ?? [];
  const interpreterCount = interpreterProfiles.length;
  const interpreterLanguages = Array.from(
    new Set(
      interpreterProfiles
        .flatMap((profile) => profile.language.split(/[,/·]+/))
        .map((lang) => lang.replace(/\s+support$/i, "").trim())
        .filter(Boolean),
    ),
  ).slice(0, 4);

  // Only show loading spinner if we have NO initial data at all
  // (e.g., SSR failed AND client fetch is still pending).
  // In normal operation, initialHomeData is always available from SSR.
  if (homeLoading && !initialHomeData)
    return <LoadingSpinner text="Opening the field journal…" />;
  if (!homeData && !initialHomeData)
    return (
      <ErrorState
        title="Home stories unavailable"
        message="We can't reach the editorial archive right now. Please try again in a moment."
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
  const ctaImage =
    hero.ctaImage ?? SEED_IMAGES.homeCta ?? placeholderFor("hero");
  const interpretingImage =
    hero.interpretingImage ??
    SEED_IMAGES.homeInterpreting ??
    placeholderFor("hero");


  return (
    <div className="bg-[var(--paper-deep)] bg-grain min-h-screen text-[var(--river-deep)]">
      <HomeAtlasHero
        image={heroImage}
        eyebrow={t("home.hero.eyebrow")}
        titleLine1={t("home.hero.headingLine1")}
        accent={t("home.hero.headingAccent")}
        titleLine3={t("home.hero.headingLine3")}
        body={t("home.hero.body")}
        primaryLabel={t("home.hero.primaryCta")}
        secondaryLabel={t("home.hero.secondaryCta")}
        tags={[
          t("home.hero.tag.storyRoutes"),
          t("home.hero.tag.cultureContext"),
          t("home.hero.tag.languageSupport"),
        ]}
      />

      <div className="relative z-10">
        <HomeVideoChapter video={hero.video} />

        {/* 2. MAP PILLAR */}
        <GuangdongMapSection cities={regionShowcase} events={liveEvents} />

        {/* Divider */}
        <div className="site-container">
          <div className="h-px bg-[var(--line)]" />
        </div>

        {/* 3. CALENDAR & ROUTE PILLAR */}
        <GuangdongEventCalendar events={liveEvents} routes={storyRoutes} />

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

        {/* 5. INTERPRETING: THE FIELD NOTES */}
        <section className="site-container py-beat">
          <div className="grid grid-cols-1 gap-10 min-[620px]:grid-cols-[minmax(0,1.15fr)_minmax(13rem,0.85fr)] min-[620px]:items-start min-[620px]:gap-7 lg:grid-cols-12 lg:items-center lg:gap-16">
            <div className="min-w-0 max-w-2xl lg:col-span-5">
              <Reveal>
                <h2 className="mb-6 font-[family:var(--font-display)] text-[clamp(2.5rem,8vw,3.5rem)] leading-[0.92] text-[var(--river-deep)] sm:mb-10 lg:mb-12 lg:text-7xl">
                  {t("home.interpreting.title")}
                </h2>
                <div className="mt-10 sm:mt-16">
                  <Link
                    href="/interpreting"
                    className="btn-primary kinetic-link inline-flex w-full items-center justify-center gap-4 px-8 py-5 text-xs sm:w-auto sm:px-12"
                  >
                    <span className="relative z-10">{t("home.interpreting.cta")}</span>
                    <span aria-hidden className="relative z-10 text-base">→</span>
                  </Link>
                  {interpreterCount > 0 ? (
                    <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
                      {interpreterCount === 1
                        ? "1 local interpreter on the roster"
                        : `${interpreterCount} local interpreters on the roster`}
                      {interpreterLanguages.length > 0
                        ? ` · ${interpreterLanguages.join(" / ")}`
                        : ""}
                    </p>
                  ) : null}
                </div>
              </Reveal>
            </div>

            <div className="relative mx-auto w-full max-w-[32rem] self-start min-[620px]:mt-10 lg:col-span-7 lg:mt-0 lg:max-w-none lg:self-center">
              <Reveal delay={300}>
                <div className="group relative aspect-[6/5] overflow-hidden border border-white/70 bg-[var(--night)] shadow-panel min-[620px]:aspect-[3/4] lg:aspect-[16/10]">
                  <img
                    src={interpretingImage}
                    alt="Professional interpreting service in Guangdong"
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-[1.035]"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,18,24,0.04),rgba(8,18,24,0.62))]" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-end gap-5 p-6 text-white sm:p-8">
                    <span className="grid h-11 w-11 shrink-0 place-items-center border border-white/30 bg-white/10 text-lg backdrop-blur-md" aria-hidden>
                      →
                    </span>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* 6. CULTURE: THE GALLERY ARCHIVE */}
        <section id="home-culture" className="site-container pb-16 sm:pb-20 lg:pb-28">
          <div className="border-t border-black/5 pt-16 sm:pt-20 lg:pt-28">
            <CultureGallery highlights={cultureHighlights} />
          </div>
        </section>

        {/* FINAL CTA: THE DEPARTURE LOG */}
        <section className="relative overflow-hidden bg-[var(--night)] pb-20 pt-16 text-white sm:pb-24 sm:pt-20 lg:pb-28 lg:pt-24">
          <img
            src={ctaImage}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover opacity-20 grayscale"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,18,24,0.97),rgba(8,18,24,0.78)_58%,rgba(8,18,24,0.42))]" />

          <div className="site-container relative z-10">
            <div className="max-w-4xl">
              <Reveal>
                <div className="mb-10 flex items-center gap-4 opacity-70">
                  <span className="h-px w-10 bg-[var(--gold-light)]" />
                  <p className="text-[12px] font-bold uppercase tracking-[0.4em] text-[var(--gold-light)]">
                    {t("home.cta.eyebrow")}
                  </p>
                </div>
                <h2 className="mb-10 font-[family:var(--font-display)] text-4xl leading-[0.98] tracking-[-0.04em] sm:text-5xl md:mb-12 md:text-7xl lg:text-8xl">
                  {t("home.cta.title.primary")}{" "}
                  <span className="italic text-[var(--gold-light)]">
                    {t("home.cta.title.italic")}
                  </span>
                </h2>
                <div className="mt-12 flex flex-wrap gap-4 sm:gap-6 md:mt-16">
                  <Link
                    href="/routes"
                    className="btn-gold inline-flex w-full items-center justify-center px-8 py-4 text-xs sm:w-auto sm:px-12 sm:py-5"
                  >
                    {t("home.cta.startLog")}
                  </Link>
                  <Link
                    href="/interpreting"
                    className="btn-ghost-dark inline-flex w-full items-center justify-center px-8 py-4 text-xs sm:w-auto sm:px-12 sm:py-5"
                  >
                    {t("home.cta.bookCoordination")}
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
