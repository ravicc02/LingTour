"use client";

import Link from "next/link";
import { useMemo, useRef } from "react";
import { MediaFrame } from "@/components/ui/MediaFrame";
import type { StoryRoute } from "@/data/routes";
import { gsap, motionEase, useGSAP } from "@/lib/motion";

type Props = { route: StoryRoute };

function truncate(value: string, max = 190): string {
  const clean = value.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}...`;
}

export function RouteBrief({ route }: Props) {
  const briefRef = useRef<HTMLElement | null>(null);
  const summary = useMemo(
    () => truncate(route.summary || route.story || route.title),
    [route.story, route.summary, route.title],
  );
  const facts = [route.city, route.culture, route.duration].filter(Boolean);

  useGSAP(
    () => {
      if (!briefRef.current) return;
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const timeline = gsap.timeline({ defaults: { ease: motionEase.enter } });
        timeline
          .from("[data-route-brief-media]", { autoAlpha: 0, y: 22, rotation: -1.2, duration: 0.8 })
          .from("[data-route-brief-title]", { autoAlpha: 0, y: 30, duration: 0.76 }, "-=0.52")
          .from("[data-route-brief-summary]", { autoAlpha: 0, y: 18, duration: 0.58 }, "-=0.4")
          .from("[data-route-brief-facts]", { autoAlpha: 0, y: 12, duration: 0.45 }, "-=0.28")
          .from("[data-route-brief-actions]", { autoAlpha: 0, y: 12, duration: 0.45 }, "-=0.25");
      });
      return () => media.revert();
    },
    { scope: briefRef, dependencies: [route.slug], revertOnUpdate: true },
  );

  return (
    <section ref={briefRef} className="relative border-b border-[var(--line)] bg-[var(--background)] bg-grain">
      <div className="site-container py-tight">
        <div className="grid min-w-0 items-center gap-6 min-[620px]:grid-cols-[minmax(13rem,0.78fr)_minmax(0,1.1fr)] min-[620px]:gap-10 lg:grid-cols-[minmax(20rem,0.84fr)_minmax(0,1.16fr)] lg:gap-16">
          <figure
            data-route-brief-media
            className="relative order-1 aspect-[4/3] min-w-0 overflow-hidden border-[0.55rem] border-white bg-[var(--paper)] scrapbook-shadow sm:border-[0.75rem] min-[620px]:order-none lg:aspect-[4/5] lg:border-[0.9rem]"
          >
            <MediaFrame
              asset={route.image ? { type: "image", url: route.image } : undefined}
              fallbackSrc={route.image}
              alt={route.title ? `${route.title} route` : "Route landscape"}
              eager
              mediaClassName="object-cover"
            />
          </figure>

          <div className="relative z-10 order-2 mx-2 -mt-8 min-w-0 max-w-3xl border border-[var(--line)] bg-[var(--background)] p-4 scrapbook-shadow sm:mx-3 sm:-mt-12 sm:p-5 min-[620px]:order-none min-[620px]:mx-0 min-[620px]:mt-0 min-[620px]:border-0 min-[620px]:bg-transparent min-[620px]:p-0 min-[620px]:shadow-none lg:max-w-none">
            <h1
              data-route-brief-title
              className="text-pretty font-[family:var(--font-display)] text-4xl leading-[1.02] tracking-[-0.04em] text-[var(--river-deep)] sm:text-5xl md:text-6xl lg:text-[clamp(2.75rem,4.3vw,4rem)]"
            >
              {route.title}
            </h1>
            <p
              data-route-brief-summary
              className="mt-5 max-w-[60ch] text-pretty text-base leading-8 text-[var(--muted)] lg:mt-6 lg:text-lg"
            >
              {summary}
            </p>

            {facts.length ? (
              <dl data-route-brief-facts className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--river-deep)] sm:gap-x-7 lg:mt-8 lg:text-base">
                {facts.map((fact) => (
                  <div key={fact}>
                    <dt className="sr-only">Route fact</dt>
                    <dd>{fact}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <div data-route-brief-actions className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 lg:mt-10">
              <Link
                href="/interpreting/#interpreting-booking"
                className="group inline-flex min-h-12 items-center justify-center gap-3 bg-[var(--cinnabar)] px-7 py-3.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-[var(--river-deep)] active:scale-[0.98]"
              >
                <span>Book this route</span>
                <span aria-hidden className="transition-transform group-hover:translate-x-1">-&gt;</span>
              </Link>
              <Link
                href="#itinerary"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--river-deep)] underline decoration-[var(--line)] underline-offset-4 transition-colors hover:decoration-[var(--river-deep)] active:opacity-70"
              >
                Read the day
              </Link>
              <Link
                href={route.citySlugs[0] ? `/culture/${route.citySlugs[0]}` : "/culture"}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--river-deep)] underline decoration-[var(--line)] underline-offset-4 transition-colors hover:decoration-[var(--river-deep)] active:opacity-70"
              >
                Open city file
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
