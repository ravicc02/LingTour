"use client";

import Link from "next/link";
import { useRef } from "react";
import { useLocale } from "@/lib/locale-context";
import type { CultureFeature } from "@/types/content";
import { placeholderFor } from "@/lib/placeholders";
import { gsap, motionEase, motionMedia, useGSAP } from "@/lib/motion";

interface Props {
  highlights?: CultureFeature[];
}

const frameRatios = [
  "aspect-[4/5]",
  "aspect-[3/2]",
  "aspect-square",
  "aspect-[5/4]",
  "aspect-[4/5]",
] as const;

export function CultureGallery({ highlights = [] }: Props) {
  const { t } = useLocale();
  const scope = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add(
        {
          animate: "(prefers-reduced-motion: no-preference)",
          desktop: motionMedia.tablet,
        },
        (context) => {
          const tiles = gsap.utils.toArray<HTMLElement>("[data-culture-tile]", scope.current);
          if (!context.conditions?.animate || !context.conditions?.desktop) {
            gsap.set(tiles, { clearProps: "all" });
            return;
          }

          tiles.forEach((tile, index) => {
            gsap.fromTo(
              tile,
              { autoAlpha: 0, y: 44 + (index % 3) * 10 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.82,
                delay: (index % 3) * 0.06,
                ease: motionEase.enter,
                scrollTrigger: {
                  trigger: tile,
                  start: "top 88%",
                  once: true,
                },
              },
            );
          });
        },
      );

      return () => media.revert();
    },
    { scope },
  );

  if (!highlights.length) {
    return (
      <div className="scrapbook-shadow mx-auto max-w-2xl rotate-1 border border-[var(--line)] bg-white/70 p-10">

        <h3 className="mt-4 font-[family:var(--font-display)] text-3xl text-[var(--river-deep)]">
          {t("culture.atlas.empty.title")}
        </h3>
        <p className="handwritten mt-4 text-lg leading-relaxed text-[var(--muted)]">
          {t("culture.atlas.empty.body")}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scope}
      className="scroll-fade-x flex snap-x snap-mandatory gap-7 overflow-x-auto pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:block md:columns-2 md:gap-10 md:overflow-visible md:pb-0 lg:columns-3 lg:gap-12"
    >
      {highlights.map((item, idx) => {
        const image = item.image || placeholderFor("hero");
        const place = item.place || item.title || "Lingnan culture";
        const ratio = frameRatios[idx % frameRatios.length];
        const desktopOffset = idx % 3 === 1 ? "lg:pt-20" : idx % 3 === 2 ? "lg:pt-8" : "";

        return (
          <div
            data-culture-tile
            key={item.slug}
            className={`w-[82vw] max-w-[24rem] shrink-0 snap-start break-inside-avoid pb-3 md:mb-16 md:w-auto md:max-w-none md:pb-0 ${desktopOffset}`}
          >
            <Link
              href={item.href ?? `/culture/${item.slug}`}
              className={`group block transition-transform duration-500 hover:-translate-y-1.5 ${
                idx % 2 === 0 ? "md:-rotate-[0.7deg]" : "md:rotate-[0.7deg]"
              }`}
            >
              <div className={`relative ${ratio} tape-effect`}>
                <div className="scrapbook-shadow absolute inset-0 overflow-hidden border-[0.65rem] border-white bg-white sm:border-[0.75rem]">
                  <img
                    src={image}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-[1.055]"
                  />
                  <div className="absolute inset-0 bg-black/[0.035] transition-opacity duration-500 group-hover:opacity-0" />
                </div>
              </div>

              <div className="mt-6 px-1 sm:mt-7">
                <div className="flex items-center gap-3">
                  <div className="h-px w-6 bg-[var(--gold)]" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">
                    {place}
                  </p>
                </div>
                <h3 className="mt-3 font-[family:var(--font-display)] text-3xl leading-tight text-[var(--river-deep)] transition-colors group-hover:text-[var(--cinnabar)] sm:text-4xl">
                  {item.title}
                </h3>
                <div className="mt-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[var(--cinnabar)]">
                  <span>{t("culture.atlas.openArchive")}</span>
                  <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </div>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
