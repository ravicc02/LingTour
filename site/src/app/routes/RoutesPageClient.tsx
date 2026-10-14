"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { fetchRoutes } from "@/lib/api-data";
import { useApiQuery, LoadingSpinner, ErrorState } from "@/lib/use-api-query";
import { Reveal } from "@/components/ui/Reveal";
import { placeholderFor } from "@/lib/placeholders";
import { SEED_IMAGES } from "@/lib/seed-images";
import type { StoryRoute } from "@/data/routes";
import { ArchiveFilterBar } from "@/components/ui/ArchiveFilterBar";
import { PastoralPageMotion } from "@/components/ui/PastoralPageMotion";

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  );
}

interface RoutesPageClientProps {
  initialRoutes: StoryRoute[] | null;
}

export default function RoutesPageClient({
  initialRoutes,
}: RoutesPageClientProps) {
  const { t } = useLocale();
  const [search, setSearch] = useState("");
  const [culture, setCulture] = useState("");
  const [duration, setDuration] = useState("");
  const [audience, setAudience] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const { data, loading, error, refetch } = useApiQuery(
    () => fetchRoutes(),
    [],
    { initialData: initialRoutes, revalidateOnMount: false },
  );

  useEffect(() => {
    setSearch("");
    setCulture("");
    setDuration("");
    setAudience("");
  }, []);

  if (loading && !initialRoutes) {
    return <LoadingSpinner text="Drawing the routes..." />;
  }

  if (error && !initialRoutes) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  const storyRoutes = data ?? initialRoutes ?? [];
  const cultureOptions = uniqueValues(storyRoutes.map((route) => route.culture));
  const durationOptions = uniqueValues(storyRoutes.map((route) => route.duration));
  const audienceOptions = uniqueValues(storyRoutes.map((route) => route.audience));
  const filteredRoutes = storyRoutes.filter((route) => {
    const searchable = [route.title, route.city, route.culture, route.duration, route.audience, route.summary]
      .join(" ")
      .toLowerCase();
    return (
      (!deferredSearch || searchable.includes(deferredSearch)) &&
      (!culture || route.culture === culture) &&
      (!duration || route.duration === duration) &&
      (!audience || route.audience === audience)
    );
  });
  const ctaImage = SEED_IMAGES.routesCta ?? placeholderFor("hero");
  const manifestCities = uniqueValues(storyRoutes.map((route) => route.city));
  const manifestDurations = uniqueValues(storyRoutes.map((route) => route.duration));

  return (
    <PastoralPageMotion
      className="min-h-screen bg-[var(--paper-deep)] bg-grain"
      motionKey={filteredRoutes.map((route) => route.slug).join("|")}
    >
      <section className="relative overflow-hidden pb-12 pt-16 sm:pb-16 sm:pt-20 lg:pb-24 lg:pt-32">
        <div className="site-container relative">
          <div className="grid grid-cols-1 items-center gap-10 sm:gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="z-10 min-w-0 max-w-3xl lg:col-span-7">
              <Reveal>
                <p data-pastoral-kicker className="mb-6 text-[12px] font-bold uppercase tracking-[0.32em] text-[var(--cinnabar)] sm:mb-8">
                  {t("routes.atlas.eyebrow")}
                </p>
                <h1 className="font-[family:var(--font-display)] text-[clamp(2.25rem,7vw,6rem)] leading-[0.92] tracking-[-0.04em] text-[var(--river-deep)]">
                  <span className="block overflow-hidden pb-1">
                    <span data-pastoral-title className="block">{t("routes.atlas.titlePrimary")}</span>
                  </span>
                  <span className="block overflow-hidden pb-3">
                    <span data-pastoral-title className="block italic text-[var(--gold)]">{t("routes.atlas.titleItalic")}</span>
                  </span>
                </h1>
                <p data-pastoral-subtitle className="handwritten mt-5 max-w-xl text-[13px] leading-6 text-[var(--muted)] sm:mt-8 sm:text-base sm:leading-relaxed lg:mt-12 lg:text-lg">
                  {t("routes.atlas.lede")}
                </p>
              </Reveal>
            </div>

            <div className="relative w-full min-w-0 lg:col-span-5">
              <Reveal delay={200}>
                {/* Routes hero: an itinerary ticket, not another polaroid. The
                    rows are computed from the live route list, so the sheet
                    always states what is actually on file. */}
                <div className="relative border border-[var(--line)] bg-[var(--paper)] scrapbook-shadow">
                  <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--river-deep)]/70">
                      Route manifest
                    </p>
                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--cinnabar)]">
                      GD-{String(storyRoutes.length).padStart(2, "0")}
                    </p>
                  </div>

                  <div className="relative px-5" aria-hidden="true">
                    <div className="border-t border-dashed border-[var(--river-deep)]/25" />
                    <span className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-[var(--line)] bg-[var(--paper-deep)]" />
                    <span className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-[var(--line)] bg-[var(--paper-deep)]" />
                  </div>

                  <dl className="px-5">
                    <div className="flex items-baseline justify-between gap-6 border-b border-[var(--line)] py-4">
                      <dt className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
                        Routes on file
                      </dt>
                      <dd className="text-right font-[family:var(--font-display)] text-2xl leading-none text-[var(--river-deep)]">
                        {storyRoutes.length}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-6 border-b border-[var(--line)] py-4">
                      <dt className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
                        Ground covered
                      </dt>
                      <dd className="min-w-0 text-right font-[family:var(--font-display)] text-lg leading-snug text-[var(--river-deep)]">
                        {manifestCities.length > 0 ? manifestCities.join(" · ") : "—"}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-6 py-4">
                      <dt className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
                        Time on the road
                      </dt>
                      <dd className="min-w-0 text-right font-[family:var(--font-display)] text-lg leading-snug text-[var(--river-deep)]">
                        {manifestDurations.length > 0 ? manifestDurations.join(" · ") : "—"}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex items-center justify-between border-t border-[var(--line)] px-5 py-4">
                    <div
                      aria-hidden="true"
                      className="h-7 w-24 bg-[repeating-linear-gradient(90deg,var(--river-deep)_0_2px,transparent_2px_5px,var(--river-deep)_5px_8px,transparent_8px_11px)] opacity-70"
                    />
                    <div
                      data-pastoral-stamp
                      className="grid h-16 w-16 rotate-6 place-items-center rounded-full border-2 border-[var(--cinnabar)]/60 text-center"
                    >
                      <span className="px-1 font-mono text-[11px] font-bold uppercase leading-[1.5] tracking-[0.14em] text-[var(--cinnabar)]">
                        Guangdong
                        <br />
                        field transit
                      </span>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <section className="site-container py-10 sm:py-12 lg:py-20">
        {storyRoutes.length > 0 ? (
          <ArchiveFilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchLabel={t("routes.filter.searchLabel")}
            searchPlaceholder={t("routes.filter.searchPlaceholder")}
            countLabel={t("routes.filter.count")
              .replace("{visible}", String(filteredRoutes.length))
              .replace("{total}", String(storyRoutes.length))}
            filterLabel={t("routes.filter.open")}
            allLabel={t("routes.filter.all")}
            clearLabel={t("routes.filter.clear")}
            groups={[
              {
                label: t("routes.filter.culture"),
                value: culture,
                options: cultureOptions.map((value) => ({ value, label: value })),
                onChange: setCulture,
              },
              {
                label: t("routes.filter.duration"),
                value: duration,
                options: durationOptions.map((value) => ({ value, label: value })),
                onChange: setDuration,
              },
              {
                label: t("routes.filter.audience"),
                value: audience,
                options: audienceOptions.map((value) => ({ value, label: value })),
                onChange: setAudience,
              },
            ]}
            onClear={() => {
              setSearch("");
              setCulture("");
              setDuration("");
              setAudience("");
            }}
          />
        ) : null}
        {storyRoutes.length === 0 ? (
          <div className="mx-auto max-w-2xl border border-[var(--line)] bg-white/70 p-8 sm:p-10">
            <h2 className="font-[family:var(--font-display)] text-3xl text-[var(--river-deep)]">
              {t("routes.atlas.empty.title")}
            </h2>
            <p className="mt-4 max-w-[55ch] text-base leading-7 text-[var(--muted)]">
              {t("routes.atlas.empty.body")}
            </p>
          </div>
        ) : filteredRoutes.length === 0 ? (
          <div className="mx-auto max-w-xl py-16 text-center">
            <h2 className="font-[family:var(--font-display)] text-3xl text-[var(--river-deep)]">
              {t("routes.filter.emptyTitle")}
            </h2>
            <p className="mt-4 text-base leading-7 text-[var(--muted)]">
              {t("routes.filter.emptyBody")}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCulture("");
                setDuration("");
                setAudience("");
              }}
              className="mt-7 min-h-11 text-sm font-semibold text-[var(--river-deep)] underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--river-deep)]"
            >
              {t("routes.filter.clear")}
            </button>
          </div>
        ) : (
          <div className="scroll-fade-x scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-8 md:mx-0 md:grid md:grid-cols-2 md:gap-x-10 md:gap-y-14 md:overflow-visible md:px-0 lg:grid-cols-3 lg:gap-x-10 lg:gap-y-14">
            {filteredRoutes.map((route, index) => {
                const cardImage = route.image || placeholderFor("hero");
                return (
                  <div key={route.slug} className="h-full min-w-0 w-[82vw] max-w-[24rem] shrink-0 snap-start md:h-auto md:w-auto md:max-w-none md:shrink md:snap-none">
                    <Link href={`/routes/${route.slug}`} className="group block h-full" data-pastoral-card>
                      <article className={`flex h-full flex-col transition-transform duration-500 motion-reduce:transform-none hover:-translate-y-1.5 ${index % 2 === 0 ? "sm:rotate-[0.7deg]" : "sm:-rotate-[0.7deg]"}`}>
                        <div className="relative aspect-[16/10] overflow-hidden border-[0.55rem] border-white bg-white scrapbook-shadow sm:border-[0.85rem]">
                          <div
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 motion-reduce:transform-none group-hover:scale-105"
                            style={{ backgroundImage: `url(${cardImage})` }}
                            role="img"
                            aria-label={`${route.title} route`}
                          />
                        </div>

                        <div className="flex flex-1 flex-col px-1 pb-1 pt-6 sm:px-4 sm:pt-8">
                          <h2 className="text-balance font-[family:var(--font-display)] text-3xl leading-[1.03] text-[var(--river-deep)] transition-colors group-hover:text-[var(--cinnabar)] sm:text-4xl lg:text-3xl">
                            {route.title}
                          </h2>
                          <p className="mt-4 max-w-[37ch] text-pretty text-sm leading-7 text-[var(--muted)] line-clamp-3 sm:text-base sm:line-clamp-none">
                            {route.summary}
                          </p>
                          <dl className="mt-auto grid grid-cols-2 gap-x-6 gap-y-2 border-t border-[var(--line)] pt-5 text-sm leading-6 text-[var(--river-deep)]">
                            <div>
                              <dt className="sr-only">City</dt>
                              <dd>{route.city}</dd>
                            </div>
                            <div>
                              <dt className="sr-only">Duration</dt>
                              <dd>{route.duration}</dd>
                            </div>
                            <div className="col-span-2">
                              <dt className="sr-only">Culture</dt>
                              <dd>{route.culture}</dd>
                            </div>
                          </dl>
                        </div>
                      </article>
                    </Link>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      <section className="pb-20 lg:pb-32">
        <div className="site-container">
          <div className="relative overflow-hidden bg-[var(--river-deep)] bg-grain px-6 py-16 text-white scrapbook-shadow sm:px-8 sm:py-20 lg:px-20 lg:py-28">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-10 grayscale"
              style={{ backgroundImage: `url(${ctaImage})` }}
            />
            <div className="relative z-10 mx-auto max-w-2xl text-center">
              <Reveal>
                <h2 className="font-[family:var(--font-display)] text-3xl leading-tight sm:text-4xl md:text-6xl">
                  {t("routes.cta.localVoice.title")}
                </h2>
                <div className="mt-10">
                  <Link
                    href="/interpreting"
                    className="btn-gold inline-flex w-full justify-center px-8 py-4 text-xs sm:w-auto sm:px-12 sm:py-5"
                  >
                    {t("routes.cta.localVoice.button")}
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
    </PastoralPageMotion>
  );
}
