"use client";

import { useRef } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { gsap, motionEase, useGSAP } from "@/lib/motion";
import { useLocale } from "@/lib/locale-context";
import { fetchCityBySlug, fetchCities, fetchRoutes } from "@/lib/api-data";
import { usePreviewBridge } from "@/lib/preview";
import { ErrorState, LoadingSpinner, useApiQuery } from "@/lib/use-api-query";
import { MarkdownRenderer } from "@/components/culture/MarkdownRenderer";
import { MediaFrame } from "@/components/ui/MediaFrame";
import { RelatedCitiesHub } from "@/components/culture/RelatedCitiesHub";
import { RelatedRouteHub } from "@/components/culture/RelatedRouteHub";
import type { StoryRoute } from "@/data/routes";
import type { CityCulture } from "@/data/culture";
import styles from "./CultureDetail.module.css";

type CultureDetailClientProps = {
  slug: string;
  initialCity: CityCulture | null;
  initialCityCultures: CityCulture[];
  initialRoutes: StoryRoute[];
  previewOnly?: boolean;
};

export function CultureDetailClient({ slug, initialCity, initialCityCultures, initialRoutes, previewOnly = false }: CultureDetailClientProps) {
  const { t } = useLocale();
  const { previewData, previewEnabled } = usePreviewBridge<CityCulture>("city");
  const { data: city, loading, error } = useApiQuery(() => fetchCityBySlug(slug), [slug], {
    initialData: initialCity, revalidateOnMount: false, enabled: !previewOnly,
  });
  const { data: cities } = useApiQuery(() => fetchCities(), [], { initialData: initialCityCultures, revalidateOnMount: previewOnly });
  const { data: routes } = useApiQuery(() => fetchRoutes(), [], { initialData: initialRoutes, revalidateOnMount: previewOnly });
  const activeCity = previewData ?? city;
  const mastheadRef = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      if (!mastheadRef.current) return;
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const timeline = gsap.timeline({ defaults: { ease: motionEase.enter } });
        timeline
          .from("[data-culture-brief-media]", { autoAlpha: 0, y: 22, rotation: -1.2, duration: 0.8 })
          .from("[data-culture-brief-title]", { autoAlpha: 0, y: 30, duration: 0.76 }, "-=0.52")
          .from("[data-culture-brief-summary]", { autoAlpha: 0, y: 18, duration: 0.58 }, "-=0.4")
          .from("[data-culture-brief-meta]", { autoAlpha: 0, y: 12, duration: 0.45 }, "-=0.28");
      });
      return () => media.revert();
    },
    { scope: mastheadRef, dependencies: [activeCity?.slug], revertOnUpdate: true },
  );

  if (previewOnly && !previewData) return <LoadingSpinner text="Loading preview..." />;
  if (previewEnabled && !previewData) return <LoadingSpinner text="Loading preview..." />;
  if (loading && !activeCity) return <LoadingSpinner text="Opening the city..." />;
  if (error && !activeCity) return <ErrorState title="City file unavailable" message="This city cannot be reached right now. Please try again shortly." />;
  if (!activeCity) notFound();

  const relatedRoutes = (routes ?? []).filter(route => activeCity.routeSlugs.includes(route.slug));
  const index = (cities ?? []).findIndex(item => item.slug === activeCity.slug);
  const previous = index > 0 ? cities?.[index - 1] : undefined;
  const next = index >= 0 ? cities?.[index + 1] : undefined;
  const mastheadMedia = activeCity.primaryMedia ?? (
    activeCity.image.trim()
      ? { type: "image" as const, url: activeCity.image }
      : null
  );
  const briefTextClassName = mastheadMedia
    ? "relative z-10 order-2 mx-2 -mt-8 min-w-0 max-w-3xl border border-[var(--line)] bg-[var(--background)] bg-grain p-4 scrapbook-shadow sm:p-5 min-[620px]:order-none min-[620px]:mx-0 min-[620px]:mt-0 min-[620px]:p-6 min-[620px]:shadow-none lg:p-8 lg:max-w-none"
    : "relative z-10 min-w-0 max-w-3xl border border-[var(--line)] bg-[var(--background)] bg-grain p-5 sm:p-6 lg:max-w-none lg:p-8";

  return (
    <div data-city-detail className={`${styles.page} bg-grain`}>
      <header id="section-masthead" className="relative border-b border-[var(--line)] bg-[var(--background)] bg-grain">
        <div className="site-container py-tight">
          <div className="grid min-w-0 items-center gap-6 min-[620px]:grid-cols-[minmax(13rem,0.78fr)_minmax(0,1.1fr)] min-[620px]:gap-10 lg:grid-cols-[minmax(20rem,0.84fr)_minmax(0,1.16fr)] lg:gap-16">
            {mastheadMedia ? (
              <div className="relative order-1 min-w-0 min-[620px]:order-none">

                <figure
                  data-culture-brief-media
                  className="relative aspect-[4/3] min-w-0 overflow-hidden border-[0.55rem] border-white bg-[var(--paper)] scrapbook-shadow sm:border-[0.75rem] lg:aspect-[4/5] lg:border-[0.9rem]"
                >
                  <MediaFrame asset={mastheadMedia} alt={activeCity.name} mode={mastheadMedia.type === "video" ? "interactive" : "image"} eager />
                </figure>
              </div>
            ) : null}

            <div data-culture-brief-panel className={briefTextClassName}>
              <p className="text-[12px] font-bold uppercase tracking-[0.28em] text-[var(--cinnabar)]">
                {activeCity.label}
              </p>
              <h1
                data-culture-brief-title
                className="mt-3 max-w-[13ch] text-balance font-[family:var(--font-display)] text-4xl leading-[1] tracking-[-0.04em] text-[var(--river-deep)] sm:text-5xl md:text-6xl xl:text-8xl"
              >
                {activeCity.name}
              </h1>

              <div data-culture-brief-meta className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--muted)]">
                {activeCity.publishedAt ? (
                  <time dateTime={activeCity.publishedAt}>
                    {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(activeCity.publishedAt))}
                  </time>
                ) : null}
                {activeCity.tags.length > 0 ? <span>{activeCity.tags.join(" / ")}</span> : null}
                <Link href={`/community?compose=1&location=${encodeURIComponent(activeCity.name)}&channel=Culture%20Desk&title=${encodeURIComponent(activeCity.name)}&note=${encodeURIComponent(`City note from ${activeCity.name}: `)}`} className="inline-flex min-h-11 items-center text-[var(--river-deep)] underline decoration-[var(--cinnabar)]/55 underline-offset-4">
                  Post city note
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      <article
        id="section-chapters"
        aria-label={`${activeCity.name} city article`}
        className={styles.article}
      >
        <div className="relative site-container">
          <MarkdownRenderer
            key={activeCity.slug}
            content={activeCity.contentMarkdown ?? ""}
            layout="city"
          />
        </div>
      </article>

      <section id="section-cities" className={`site-container ${styles.related}`}>
        <div className="max-w-3xl">
          <h2 className="text-balance font-[family:var(--font-display)] text-3xl leading-[0.98] text-[var(--river-deep)] sm:text-4xl">
            {relatedRoutes.length ? t("culture.detail.routeLinks") : t("culture.detail.nearbyCities")}
          </h2>
        </div>
        {relatedRoutes.length ? <RelatedRouteHub routes={relatedRoutes} cityAdcode={activeCity.adcode} cityName={activeCity.name} cities={cities ?? []} /> : <RelatedCitiesHub allCities={cities ?? []} currentCity={activeCity} />}
      </section>

      {previous || next ? (
        <nav aria-label="City archives" className={`site-container flex flex-wrap justify-between gap-6 border-t border-[var(--line)] py-8 ${styles.cityNavigation}`}>
          {previous ? (
            <Link href={`/culture/${previous.slug}`} className="inline-flex min-h-11 items-center text-[var(--river-deep)] underline decoration-[var(--cinnabar)]/55 underline-offset-4">
              Previous: {previous.name}
            </Link>
          ) : null}
          {next ? (
            <Link href={`/culture/${next.slug}`} className="ml-auto inline-flex min-h-11 items-center text-[var(--river-deep)] underline decoration-[var(--cinnabar)]/55 underline-offset-4">
              Next: {next.name}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
