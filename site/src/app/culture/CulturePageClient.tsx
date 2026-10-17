"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { fetchCities } from "@/lib/api-data";
import { useApiQuery, LoadingSpinner, ErrorState } from "@/lib/use-api-query";
import { Reveal } from "@/components/ui/Reveal";
import { placeholderFor } from "@/lib/placeholders";
import { SEED_IMAGES } from "@/lib/seed-images";
import type { CityCulture } from "@/data/culture";
import { ArchiveFilterBar } from "@/components/ui/ArchiveFilterBar";
import { PastoralPageMotion } from "@/components/ui/PastoralPageMotion";

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  );
}

interface CulturePageClientProps {
  initialCityCultures: CityCulture[];
}

export default function CulturePageClient({
  initialCityCultures,
}: CulturePageClientProps) {
  const { t } = useLocale();
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [tag, setTag] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const { data: cityCultures, loading, error, refetch } = useApiQuery(
    () => fetchCities(),
    [],
    { initialData: initialCityCultures, revalidateOnMount: false },
  );

  useEffect(() => {
    setSearch("");
    setRegion("");
    setTag("");
  }, []);

  if (loading && initialCityCultures.length === 0) {
    return <LoadingSpinner text="Opening the city atlas..." />;
  }

  if (error && initialCityCultures.length === 0) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  const cultures = cityCultures ?? initialCityCultures;
  const regionOptions = uniqueValues(cultures.map((city) => city.label));
  const tagOptions = uniqueValues(cultures.flatMap((city) => city.tags));
  const filteredCultures = cultures.filter((city) => {
    const searchable = [city.name, city.label, city.summary, city.narrative, ...city.tags]
      .join(" ")
      .toLowerCase();
    return (
      (!deferredSearch || searchable.includes(deferredSearch)) &&
      (!region || city.label === region) &&
      (!tag || city.tags.includes(tag))
    );
  });
  const heroImage = SEED_IMAGES.cultureHero ?? placeholderFor("portrait");
  const ctaImage = SEED_IMAGES.cultureCta ?? placeholderFor("hero");

  return (
    <>
      <PastoralPageMotion
        className="min-h-screen bg-[var(--paper-deep)] bg-grain"
        motionKey={filteredCultures.map((city) => city.slug).join("|")}
      >
      <section className="relative overflow-hidden pb-12 pt-16 sm:pb-16 sm:pt-20 lg:pb-24 lg:pt-32">
        <div className="site-container">
          <div className="grid grid-cols-1 items-start gap-8 sm:grid-cols-[minmax(0,1.35fr)_minmax(12rem,0.75fr)] sm:items-center sm:gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="z-10 min-w-0 max-w-3xl lg:col-span-7">
              <Reveal>

                <h1 className="font-[family:var(--font-display)] text-[clamp(1.8rem,7vw,6rem)] leading-[0.94] tracking-[-0.04em] text-[var(--river-deep)]">
                  <span className="block overflow-hidden pb-1"><span data-pastoral-title className="block">{t("culture.atlas.titlePrimary")}</span></span>
                  <span className="block overflow-hidden pb-3"><span data-pastoral-title className="block italic text-[var(--gold)]">{t("culture.atlas.titleItalic")}</span></span>
                </h1>

              </Reveal>
            </div>

            <div className="relative w-full min-w-0 self-start sm:self-end lg:col-span-5 lg:max-w-none lg:self-center">
              <Reveal delay={200}>
                <div className="relative ml-auto aspect-[4/3] w-full overflow-hidden border-[0.35rem] border-white bg-[var(--parchment-deep)] scrapbook-shadow rotate-2 sm:aspect-[3/4] sm:border-8 lg:aspect-[4/5]">
                  {/* React 19 hoists this into <head>, so the hero photo starts
                      loading with the document instead of after CSS/paint. */}
                  <link rel="preload" as="image" href={heroImage} />
                  <div
                    data-pastoral-hero-media
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url(${heroImage})` }}
                  />
                  <div className="absolute inset-0 bg-black/10" />
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <section className="site-container py-tight">
        {cultures.length > 0 ? (
          <ArchiveFilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchLabel={t("culture.filter.searchLabel")}
            searchPlaceholder={t("culture.filter.searchPlaceholder")}
            countLabel={t("culture.filter.count")
              .replace("{visible}", String(filteredCultures.length))
              .replace("{total}", String(cultures.length))}
            filterLabel={t("culture.filter.open")}
            allLabel={t("culture.filter.all")}
            clearLabel={t("culture.filter.clear")}
            groups={[
              {
                label: t("culture.filter.region"),
                value: region,
                options: regionOptions.map((value) => ({ value, label: value })),
                onChange: setRegion,
              },
              {
                label: t("culture.filter.tags"),
                value: tag,
                options: tagOptions.map((value) => ({ value, label: value })),
                onChange: setTag,
              },
            ]}
            onClear={() => {
              setSearch("");
              setRegion("");
              setTag("");
            }}
          />
        ) : null}
        {cultures.length === 0 ? (
          <div className="scrapbook-shadow mx-auto max-w-2xl rotate-1 border border-[var(--line)] bg-white/70 p-10">

            <h3 className="mt-4 font-[family:var(--font-display)] text-3xl text-[var(--river-deep)]">
              {t("culture.atlas.empty.title")}
            </h3>
            <p className="handwritten mt-4 text-lg leading-relaxed text-[var(--muted)]">
              {t("culture.atlas.empty.body")}
            </p>
          </div>
        ) : filteredCultures.length === 0 ? (
          <div className="mx-auto max-w-xl py-16 text-center">
            <h3 className="font-[family:var(--font-display)] text-3xl text-[var(--river-deep)]">
              {t("culture.filter.emptyTitle")}
            </h3>
            <p className="handwritten mt-4 text-base text-[var(--muted)]">
              {t("culture.filter.emptyBody")}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setRegion("");
                setTag("");
              }}
              className="mt-7 text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--cinnabar)] underline underline-offset-4"
            >
              {t("culture.filter.clear")}
            </button>
          </div>
        ) : (
          <div className="scroll-fade-x scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-8 md:mx-0 md:grid md:grid-cols-2 md:gap-x-14 md:gap-y-16 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3 lg:gap-x-12 lg:gap-y-14">
            {filteredCultures.map((city, idx) => {
                const cardImage = city.image || placeholderFor("square");
                return (
                  <div
                    key={city.slug}
                    className={`h-full w-[82vw] max-w-[24rem] shrink-0 snap-start md:h-auto md:w-auto md:max-w-none md:shrink md:snap-none ${idx % 2 === 1 ? "md:pt-16" : ""}`}
                  >
                    <Link href={`/culture/${city.slug}`} className="group block h-full" data-pastoral-card>
                      <article className="flex h-full min-w-0 flex-col">
                        <div className="relative aspect-[4/3] overflow-hidden border-[0.55rem] border-white bg-white scrapbook-shadow sm:border-[0.75rem]">
                          <div
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-[1.04]"
                            style={{ backgroundImage: `url(${cardImage})` }}
                          />
                          <div className="absolute inset-0 bg-black/[0.07]" />
                        </div>

                        <div className="mt-5 flex min-w-0 flex-1 flex-col border-t border-[var(--line)] pt-4 sm:mt-6 sm:pt-5">
                          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">
                            {city.label}
                          </p>
                          <h2 className="mt-2 font-[family:var(--font-display)] text-3xl leading-[0.98] text-[var(--river-deep)] transition-colors group-hover:text-[var(--cinnabar)] sm:text-4xl lg:text-3xl">
                            {city.name}
                          </h2>

                          <div className="mt-5 flex items-end justify-between gap-4">

                            <span className="shrink-0 text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--cinnabar)] underline decoration-[var(--cinnabar)]/45 underline-offset-4">
                              Read city
                            </span>
                          </div>
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
          <div className="relative overflow-hidden bg-[var(--river-deep)] bg-grain px-6 py-16 text-center text-white scrapbook-shadow sm:px-8 sm:py-20 lg:px-20 lg:py-28">
            <div
              className="absolute inset-0 opacity-10 bg-cover bg-center grayscale"
              style={{ backgroundImage: `url(${ctaImage})` }}
            />
            <div className="relative z-10 mx-auto max-w-2xl">
              <Reveal>

                <h2 className="mt-8 font-[family:var(--font-display)] text-3xl leading-tight sm:text-4xl md:text-6xl">
                  {t("culture.cta.title")}
                </h2>
                <div className="mt-12">
                  <Link
                    href="/routes"
                    className="btn-gold inline-flex w-full justify-center px-8 py-4 text-xs sm:w-auto sm:px-12 sm:py-5"
                  >
                    {t("culture.cta.button")}
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
      </PastoralPageMotion>
    </>
  );
}
