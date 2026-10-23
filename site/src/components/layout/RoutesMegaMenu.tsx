"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocale } from "@/lib/locale-context";
import {
  getMapFeatures,
  buildProjection,
  featureToPath,
} from "@/lib/map-projection";
import { fetchRouteRegions, fetchRoutes } from "@/lib/api-data";
import type { StoryRoute } from "@/data/routes";
import {
  DEFAULT_ROUTE_REGIONS,
  type RouteRegion,
} from "@/lib/route-regions";

const initialFeatures = getMapFeatures();

export function RoutesMegaMenu({ active }: { active: boolean }) {
  const { t } = useLocale();
    const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [routes, setRoutes] = useState<StoryRoute[]>([]);
  const [routeRegions, setRouteRegions] =
    useState<RouteRegion[]>(DEFAULT_ROUTE_REGIONS);
  const [routesReady, setRoutesReady] = useState(false);
  const hasLoadedRef = useRef(false);

  const loadMenuData = useCallback(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    void Promise.allSettled([fetchRoutes(), fetchRouteRegions()]).then(
      ([routesResult, regionsResult]) => {
        if (routesResult.status === "fulfilled") {
          setRoutes(routesResult.value);
        }
        if (regionsResult.status === "fulfilled") {
          setRouteRegions(
            regionsResult.value.length
              ? regionsResult.value
              : DEFAULT_ROUTE_REGIONS,
          );
        }
        setRoutesReady(true);
      },
    );
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadMenuData();
    }
  }, [isOpen, loadMenuData]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsOpen(false);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  const mapPaths = useMemo(() => {
    if (!initialFeatures.length) {
      return null;
    }

    const projection = buildProjection(initialFeatures, 150, 88, 8);

    return {
      width: projection.width,
      height: projection.height,
      paths: initialFeatures.map((feature) => ({
        adcode: feature.properties.adcode,
        path: featureToPath(feature, projection.point),
      })),
    };
  }, []);

  function closeMenu() {
    setIsOpen(false);
    setActiveRegion(null);
  }

  return (
    <div
      ref={rootRef}
      className="relative flex items-center"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => closeMenu()}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          closeMenu();
        }
      }}
    >
      <Link
        data-header-route-link
        href="/routes"
        className={`inline-flex min-h-11 shrink-0 items-center px-2 py-3 text-sm transition xl:px-3 ${
          active
            ? "text-[var(--cinnabar)]"
            : "text-[var(--muted)] hover:text-[var(--ink)]"
        }`}
        aria-current={active ? "page" : undefined}
        onFocus={() => {
          setIsOpen(true);
          loadMenuData();
        }}
        onClick={closeMenu}
      >
        {t("common.nav.routes")}
      </Link>
      {isOpen ? (
        <div
          aria-busy={!routesReady}
          className="fixed inset-x-0 top-[var(--site-header-height)] z-40 max-h-[calc(100dvh-var(--site-header-height))] overflow-y-auto overscroll-contain border-y border-black/5 bg-[var(--paper-deep)] bg-grain shadow-panel backdrop-blur-xl"
        >
          <div className="site-container py-8 lg:py-12">
            <div className="mb-8 flex items-center justify-between gap-8 border-b border-black/5 pb-7 lg:mb-12 lg:pb-10">

              <Link
                href="/routes"
                className="inline-flex min-h-11 shrink-0 items-center px-5 py-3 text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--river-deep)] transition-colors hover:bg-[var(--river-deep)] hover:text-white"
                onClick={closeMenu}
              >
                {t("common.nav.routesMega.viewAll")}
              </Link>
            </div>

            <div className="grid gap-x-10 gap-y-12 md:grid-cols-3 xl:grid-cols-5">
              {routeRegions.map((region) => {
                const regionRoutes = routes.filter(
                  (route) => route.routeRegionKey === region.key,
                );
                const regionTitle = region.title;
                const regionNote = region.note;

                return (
                  <div
                    key={region.key}
                    className={`group/region min-w-0 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                      activeRegion === region.key ? "scale-[1.015]" : "scale-100"
                    } ${activeRegion && activeRegion !== region.key ? "opacity-[0.58]" : "opacity-100"}`}
                    onMouseEnter={() => setActiveRegion(region.key)}
                    onMouseLeave={() => setActiveRegion(null)}
                    onFocusCapture={() => setActiveRegion(region.key)}
                    onBlurCapture={(event) => {
                      if (
                        !event.currentTarget.contains(
                          event.relatedTarget as Node | null,
                        )
                      ) {
                        setActiveRegion(null);
                      }
                    }}
                  >
                    <Link
                      href={`/routes?region=${region.key}`}
                      className="block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold)]"
                      onClick={closeMenu}
                    >
                      <div className="relative h-32 overflow-hidden border border-black/10 bg-white scrapbook-shadow transition group-hover/region:-translate-y-1">
                        {mapPaths ? (
                          <svg
                            viewBox={`0 0 ${mapPaths.width} ${mapPaths.height}`}
                            className="h-full w-full scale-110 grayscale-[0.2] opacity-80 transition-all duration-500 group-hover/region:grayscale-0 group-hover/region:opacity-100"
                            role="img"
                            aria-label={`${regionTitle} highlighted on Guangdong map`}
                          >
                            <title>{regionTitle}</title>
                            {mapPaths.paths.map((city) => (
                              <path
                                key={city.adcode}
                                d={city.path}
                                fill={
                                  region.adcodes.includes(city.adcode)
                                    ? "#b64235"
                                    : "#8a968d"
                                }
                                stroke="#fff"
                                strokeWidth={
                                  region.adcodes.includes(city.adcode) ? 2 : 1.2
                                }
                                opacity={1}
                              />
                            ))}
                          </svg>
                        ) : (
                          <div className="grid h-full place-items-center text-xs text-[var(--muted)] handwritten">
                            {t("common.nav.routesMega.loadingMap")}
                          </div>
                        )}
                      </div>
                      <h3 className="mt-5 text-lg font-bold text-[var(--river-deep)] transition group-hover/region:text-[var(--cinnabar)]">
                        {regionTitle}
                      </h3>
                      <p className="mt-2 text-[12px] font-bold uppercase tracking-widest text-[var(--muted)]">
                        {regionNote}
                      </p>
                    </Link>
                    <div className="mt-6 space-y-3 border-t border-black/5 pt-4">
                      {regionRoutes.length ? (
                        regionRoutes.slice(0, 3).map((route) => (
                          <Link
                            key={route.slug}
                            href={`/routes/${route.slug}`}
                            className="group/link flex min-h-11 items-center gap-2 text-sm text-[var(--muted)] transition-all hover:translate-x-1 hover:text-[var(--cinnabar)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
                            onClick={closeMenu}
                          >
                            <span className="h-1 w-1 rounded-full bg-[var(--gold)]/40 group-hover/link:bg-[var(--cinnabar)]" />
                            <span className="handwritten overflow-hidden text-ellipsis whitespace-nowrap">
                              {route.title}
                            </span>
                          </Link>
                        ))
                      ) : (
                        <p className="text-sm text-[var(--muted)] handwritten">
                          {t("common.nav.routesMega.comingSoon")}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
