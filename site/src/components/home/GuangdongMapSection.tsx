"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getMapFeatures,
  buildProjection,
  featureToPath,
  type CityFeature,
  type Position,
} from "@/lib/map-projection";
import type { EventData } from "@/lib/api-data";
import type { Region } from "@/types/content";
import { Reveal } from "@/components/ui/Reveal";
import { useLocale } from "@/lib/locale-context";
import { gsap, motionDuration, motionEase, motionMedia, useGSAP } from "@/lib/motion";

const initialFeatures = getMapFeatures();

/** Guangdong's own width:height ratio, so the viewBox never letterboxes it. */
const MAP_ASPECT = 1.43;
const MAP_COMPACT_WIDTH = 420;
const MAP_WIDE_WIDTH = 700;

/**
 * Decorative route arcs anchor on real city centroids (adcode order matters)
 * and reuse the province projection, so they stay fully inside the viewBox at
 * every breakpoint instead of reusing stale pixel coordinates that clipped.
 */
const MAP_ROUTE_ANCHORS: number[][] = [
  [440800, 440900, 440700, 440300, 440500, 445100],
  [440800, 445300, 441800, 440200, 441400],
];

function buildSmoothPath(points: Position[]): string {
  if (points.length < 2) return "";
  const commands = [`M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`];
  for (let i = 0; i < points.length - 1; i += 1) {
    const previous = points[i - 1] ?? points[i];
    const start = points[i];
    const end = points[i + 1];
    const next = points[i + 2] ?? end;
    const tension = 0.18;
    const controlA: Position = [
      start[0] + (end[0] - previous[0]) * tension,
      start[1] + (end[1] - previous[1]) * tension,
    ];
    const controlB: Position = [
      end[0] - (next[0] - start[0]) * tension,
      end[1] - (next[1] - start[1]) * tension,
    ];
    commands.push(
      `C${controlA[0].toFixed(1)} ${controlA[1].toFixed(1)} ${controlB[0].toFixed(1)} ${controlB[1].toFixed(1)} ${end[0].toFixed(1)} ${end[1].toFixed(1)}`,
    );
  }
  return commands.join(" ");
}

interface Props {
  cities?: Pick<
    Region,
    | "slug"
    | "name"
    | "adcode"
    | "label"
    | "summary"
    | "image"
    | "tags"
    | "gallery"
  >[];
  events?: EventData[];
}

export function GuangdongMapSection({ cities, events = [] }: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const showcase = useMemo(() => cities ?? [], [cities]);
  const defaultActiveCode = showcase[0]?.adcode ?? 440800;
  const focusCityByCode = useMemo(
    () => new Map(showcase.map((city) => [city.adcode, city])),
    [showcase],
  );
  const [features] = useState<CityFeature[]>(initialFeatures);
  const [activeCode, setActiveCode] = useState<number>(defaultActiveCode);
  const [slideIndex, setSlideIndex] = useState(0);
  const [isCompact, setIsCompact] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isSectionVisible, setIsSectionVisible] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const lastTouchedRef = useRef<number | null>(null);
  const mobilePanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const compact = window.matchMedia("(max-width: 767px)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setIsCompact(compact.matches);
      setReduceMotion(still.matches);
    };

    sync();
    compact.addEventListener("change", sync);
    still.addEventListener("change", sync);

    return () => {
      compact.removeEventListener("change", sync);
      still.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !('IntersectionObserver' in window)) {
      setIsSectionVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsSectionVisible(entry.isIntersecting),
      { threshold: 0.01 },
    );
    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  const eventsByCity = useMemo(() => {
    const map = new Map<number, (typeof events)[number]>();
    events.forEach((event) => {
      const city = showcase.find((item) => item.slug === event.citySlug);
      const cityCode = city?.adcode;
      if (cityCode && !map.has(cityCode)) map.set(cityCode, event);
    });
    return map;
  }, [events, showcase]);

  const fallbackCity = {
    slug: "zhanjiang",
    name: "Zhanjiang",
    label: "Southern coast",
    summary: "",
    image: "/uploads/seed/zhanjiang-hero-1200.jpg",
    tags: [],
    adcode: 440800,
    gallery: [],
  };

  const activateCity = (adcode: number) => {
    setActiveCode(adcode);
    setSlideIndex(0);
  };

  const openCity = (adcode: number) => {
    const city = focusCityByCode.get(adcode);
    if (!city) return;
    activateCity(adcode);
    router.push(`/culture/${city.slug}`);
  };

  /** On touch devices: first tap activates (like hover), second tap navigates. */
  const handleTouchTap = (adcode: number) => {
    if (lastTouchedRef.current === adcode) {
      lastTouchedRef.current = null;
      openCity(adcode);
    } else {
      lastTouchedRef.current = adcode;
      activateCity(adcode);
    }
  };

  /** Prevent 300ms tap delay on touch devices. */
  const handleTouchStart = () => {
    // Intentionally empty — onTouchStart itself triggers the fast-tap path.
  };

  const resolvedActiveCode = focusCityByCode.has(activeCode)
    ? activeCode
    : defaultActiveCode;
  const activeCity =
    focusCityByCode.get(resolvedActiveCode) ?? showcase[0] ?? fallbackCity;
  const activeGallery =
    activeCity.gallery && activeCity.gallery.length
      ? activeCity.gallery
      : [activeCity.image].filter(Boolean);
  const activeImage =
    activeGallery[slideIndex % Math.max(activeGallery.length, 1)] ??
    fallbackCity.image;

  useEffect(() => {
    if (!isSectionVisible || reduceMotion || activeGallery.length < 2) return;

    const timer = window.setInterval(() => {
      setSlideIndex((index) => index + 1);
    }, 3200);

    return () => window.clearInterval(timer);
  }, [activeGallery.length, isSectionVisible, reduceMotion]);

  // The projection preserves Guangdong's own aspect ratio, so a viewBox that
  // does not match it letterboxes the map. Each breakpoint therefore gets a
  // viewBox sized close to the real container width, which keeps one user unit
  // roughly one CSS pixel and stops dots, labels, and strokes from collapsing
  // into sub-pixel noise on phones.
  const mapData = useMemo(() => {
    if (!features.length) return null;

    const width = isCompact ? MAP_COMPACT_WIDTH : MAP_WIDE_WIDTH;
    const height = Math.round(width / MAP_ASPECT);
    const inset = isCompact ? 6 : 18;
    const projection = buildProjection(features, width, height, {
      left: inset,
      right: inset,
      top: inset,
      bottom: inset,
    });

    const centroidByAdcode = new Map(
      features
        .map((feature) => [feature.properties.adcode, feature.properties.centroid] as const)
        .filter((entry): entry is readonly [number, Position] => Boolean(entry[1])),
    );
    const routePaths = MAP_ROUTE_ANCHORS.map((anchors) =>
      buildSmoothPath(
        anchors
          .map((adcode) => centroidByAdcode.get(adcode))
          .filter((centroid): centroid is Position => Boolean(centroid))
          .map((centroid) => projection.point(centroid)),
      ),
    ).filter(Boolean);

    return {
      width: projection.width,
      height: projection.height,
      paths: features.map((feature) => ({
        adcode: feature.properties.adcode,
        path: featureToPath(feature, projection.point),
        point: feature.properties.centroid
          ? projection.point(feature.properties.centroid)
          : null,
      })),
      routePaths,
    };
  }, [features, isCompact]);

  // Marker geometry is in user units, so it has to track the viewBox in use:
  // at 420 units across a ~330px phone container one unit is ~0.8px, which
  // keeps a 4-unit dot legible and a 44px finger target ~18 units wide.
  const dotRadius = isCompact ? 4 : 3;
  const labelSize = isCompact ? 15 : 14;
  const hitRadius = isCompact ? 18 : 14;

  const panelTitle = activeCity.name;
  const panelEyebrow = activeCity.label;
  const panelLead = activeCity.summary
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/\*{1,3}(.+?)\*{1,3}/g, "$1");

  useGSAP(
    () => {
      if (!mobilePanelRef.current) return;

      const media = gsap.matchMedia();
      media.add(motionMedia.allowMotion, () => {
        gsap.fromTo(
          mobilePanelRef.current,
          { autoAlpha: 0, y: 18 },
          {
            autoAlpha: 1,
            y: 0,
            duration: motionDuration.medium,
            ease: motionEase.enter,
            clearProps: "opacity,transform,visibility",
          },
        );
      });

      return () => media.revert();
    },
    // Deliberately NOT keyed on the active city: this used to re-run on every
    // hover-driven city change, replaying a 0.5s entrance each time the pointer
    // crossed a different city on the map. The panel enters once on mount;
    // switching cities just swaps its content.
    {
      scope: mobilePanelRef,
      dependencies: [],
      revertOnUpdate: true,
    },
  );

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden pb-16 pt-12 sm:pb-20 sm:pt-14 lg:pb-40 lg:pt-24"
    >
      <div className="site-container relative z-10">
        <div className="mb-8 sm:mb-12 lg:mb-20">
          <Reveal>
            <h2 className="max-w-4xl font-[family:var(--font-display)] text-[clamp(2.5rem,11vw,3.6rem)] leading-[0.94] tracking-[-0.04em] text-[var(--river-deep)] md:text-7xl lg:text-8xl">
              {t("home.map.heading")}
            </h2>
          </Reveal>
        </div>

        <div className="relative">
          {/* At lg the card overlaps only ~15% of the province (the north-west
              hills, no showcased city), which is the intended scrapbook layer.
              At md that same overlap swallows 31% including Zhanjiang and
              Maoming, so the card stays in flow until there is room for it. */}
          <div className="scrapbook-shadow relative z-30 hidden border-white bg-white/95 backdrop-blur-sm lg:absolute lg:block lg:left-0 lg:top-0 lg:w-52 lg:border-8 lg:p-4">
            <Reveal delay={400}>
              <Link
                href={`/culture/${activeCity.slug}`}
                className="group block"
              >
                <div className="relative mb-3 aspect-[16/10] overflow-hidden md:mb-4 md:aspect-[4/3]">
                  {activeImage ? (
                    <img
                      src={activeImage}
                      alt={activeCity.name}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(20,52,61,0.14),rgba(182,66,53,0.08))]" />
                  )}
                  <div className="absolute -top-2 left-1/2 z-20 h-6 w-20 -translate-x-1/2 rotate-2 bg-white/40 backdrop-blur-sm" />
                </div>
              </Link>

              <div className="space-y-3 md:space-y-4">
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">
                    {panelEyebrow}
                  </p>
                  <h3 className="font-[family:var(--font-display)] text-[1.75rem] italic leading-none text-[var(--river-deep)] md:text-2xl">
                    {panelTitle}
                  </h3>
                </div>

                <div className="h-px bg-[var(--line)]" />

                <div className="min-h-[3.5rem] md:min-h-[4.5rem]">
                  <p className="handwritten line-clamp-4 text-sm leading-relaxed text-[var(--muted)]">
                    {panelLead}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 md:pt-2">
                  <Link
                    href={`/culture/${activeCity.slug}`}
                    className="grid min-h-11 place-items-center border border-[var(--river-deep)] py-2.5 text-center text-[11px] font-bold uppercase tracking-widest text-[var(--river-deep)] transition-all hover:bg-[var(--river-deep)] hover:text-white md:py-3"
                  >
                    Story
                  </Link>
                  <Link
                    href={`/interpreting?city=${activeCity.slug}`}
                    className="grid min-h-11 place-items-center bg-[var(--cinnabar)] py-2.5 text-center text-[11px] font-bold uppercase tracking-widest text-white shadow-lg transition-all hover:bg-[var(--cinnabar-deep)] md:py-3"
                  >
                    Book
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Taller than the map's own 1.43 ratio, with the province pinned to
              the top, so the scrapbook panel below can overlap the leftover
              strip without covering Zhanjiang in the south-west corner. */}
          <div className="relative z-10 aspect-[1.13/1] overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--background)] lg:aspect-auto lg:h-[40rem] lg:rounded-none lg:border-0 lg:bg-transparent">
            <div className="pointer-events-auto h-full w-full opacity-80 md:opacity-60">
              {mapData ? (
                <svg
                  viewBox={`0 0 ${mapData.width} ${mapData.height}`}
                  preserveAspectRatio={isCompact ? "xMidYMin meet" : "xMidYMid meet"}
                  className="h-full w-full"
                  role="group"
                  aria-label="Map of Guangdong: cities with published stories are listed below this graphic"
                >
                  <rect
                    width={mapData.width}
                    height={mapData.height}
                    fill="var(--background)"
                  />

                  <g opacity="0.6">
                    {mapData.routePaths.map((routePath, index) => (
                      <path
                        key={routePath.slice(0, 24) || index}
                        d={routePath}
                        fill="none"
                        stroke="#444b54"
                        strokeWidth="1"
                        strokeDasharray="6 6"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </g>

                  {mapData.paths.map((city) => {
                    const hasContent = focusCityByCode.has(city.adcode);
                    const hasEvent = eventsByCity.has(city.adcode);
                    const isActive = resolvedActiveCode === city.adcode;

                    return (
                      <path
                        key={city.adcode}
                        d={city.path}
                        stroke="#fff"
                        strokeWidth={isActive ? (hasEvent ? 2 : 1.5) : 1}
                        vectorEffect="non-scaling-stroke"
                        opacity={1}
                        className="transition-[fill] duration-500"
                        style={{
                          fill: isActive
                            ? hasEvent
                              ? "#b64235"
                              : "#c97a6e"
                            : hasContent || hasEvent
                              ? "rgba(182, 66, 53, 0.6)"
                              : "rgba(182, 66, 53, 0.15)",
                          cursor: hasContent ? "pointer" : "default",
                        }}
                        onMouseEnter={() => {
                          if (hasContent) activateCity(city.adcode);
                        }}
                        onTouchStart={handleTouchStart}
                        onClick={() => {
                          if (hasContent) handleTouchTap(city.adcode);
                        }}
                      />
                    );
                  })}

                  {mapData.paths.map((city) => {
                    const focusCity = focusCityByCode.get(city.adcode);
                    if (!focusCity || !city.point) return null;
                    const [x, y] = city.point;
                    const isActive = resolvedActiveCode === city.adcode;
                    const hasEvent = eventsByCity.has(city.adcode);

                    return (
                      <g
                        key={`${city.adcode}-dot`}
                        className="transition-all duration-300"
                        style={{ cursor: "pointer" }}
                        role="button"
                        tabIndex={0}
                        aria-label={`Show ${focusCity.name}`}
                        onMouseEnter={() => activateCity(city.adcode)}
                        onTouchStart={handleTouchStart}
                        onClick={() => handleTouchTap(city.adcode)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openCity(city.adcode);
                          }
                        }}
                      >
                        {hasEvent ? (
                          <circle
                            cx={x}
                            cy={y}
                            r={isActive ? 15 : 10}
                            fill="#b64235"
                            opacity="0.1"
                          >
                            {reduceMotion ? null : (
                              <animate
                                attributeName="r"
                                values={isActive ? "12;18;12" : "8;12;8"}
                                dur="3s"
                                repeatCount="indefinite"
                              />
                            )}
                          </circle>
                        ) : null}
                        {/* Transparent finger-sized target: the city polygons
                            themselves are only a few pixels wide in the Pearl
                            River Delta at phone widths. */}
                        <circle
                          cx={x}
                          cy={y}
                          r={hitRadius}
                          fill="transparent"
                          pointerEvents="all"
                        />
                        <circle
                          cx={x}
                          cy={y}
                          r={isActive ? dotRadius + 1.5 : dotRadius}
                          fill={isActive ? "#b64235" : "var(--river-deep)"}
                        />
                        <text
                          x={x + dotRadius + 5}
                          y={y + labelSize / 3}
                          className={`pointer-events-none select-none font-[family:var(--font-display)] italic transition-[opacity,transform] duration-500 ${
                            isActive
                              ? "opacity-100 translate-x-2"
                              : "opacity-0 -translate-x-2"
                          }`}
                          style={{
                            fontSize: `${labelSize}px`,
                            fill: "var(--river-deep)",
                          }}
                        >
                          {focusCity.name}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              ) : (
                <div className="handwritten flex h-full items-center justify-center text-sm text-[var(--muted)]">
                  Drawing Atlas...
                </div>
              )}
            </div>
          </div>

          <div
            ref={mobilePanelRef}
            className="relative z-30 mx-3 -mt-12 grid min-w-0 grid-cols-[5.75rem_minmax(0,1fr)] gap-3 border-[0.35rem] border-white bg-[rgba(248,246,239,0.96)] p-2.5 shadow-lift backdrop-blur-sm lg:hidden"
          >
            <Link
              href={`/culture/${activeCity.slug}`}
              className="relative aspect-square min-w-0 overflow-hidden bg-[var(--line)]"
            >
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={activeCity.name}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
            </Link>

            <div className="flex min-w-0 flex-col justify-center py-0.5">
              <p className="truncate text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">
                {panelEyebrow}
              </p>
              <div className="mt-1 flex min-w-0 items-baseline justify-between gap-2">
                <h3 className="truncate font-[family:var(--font-display)] text-[1.55rem] italic leading-none text-[var(--river-deep)]">
                  {panelTitle}
                </h3>
                <Link
                  href={`/culture/${activeCity.slug}`}
                  aria-label={`Open ${activeCity.name} story`}
                  className="-my-3 -mr-3 shrink-0 py-3 pl-4 pr-3 text-xl leading-none text-[var(--cinnabar)] transition-transform duration-300 hover:translate-x-1"
                >
                  →
                </Link>
              </div>
              <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-[var(--muted)]">
                {panelLead}
              </p>
            </div>
          </div>

          {showcase.length > 1 ? (
            <div className="scroll-fade-x-lg scrollbar-hide -mx-4 mt-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-2 lg:hidden">
              {showcase.map((city, index) => {
                const isActive = city.adcode === resolvedActiveCode;
                return (
                  <button
                    key={city.adcode}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => activateCity(city.adcode)}
                    className={`flex min-h-11 snap-start items-center whitespace-nowrap border-b pb-2 text-left transition-colors ${
                      isActive
                        ? "border-[var(--cinnabar)] text-[var(--river-deep)]"
                        : "border-[var(--line)] text-[var(--muted)]"
                    }`}
                  >
                    <span className="mr-2 text-[11px] font-bold tracking-[0.18em] text-[var(--gold)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="font-[family:var(--font-display)] text-base italic">
                      {city.name}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
