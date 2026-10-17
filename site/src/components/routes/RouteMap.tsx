"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { buildRouteGeometry, validRouteCoordinates, type RouteMapStop } from "./route-map-geometry";

const RouteMapCanvas = dynamic(() => import("./RouteMapCanvas"), {
  ssr: false,
  loading: () => null,
});

type Props = { stops: RouteMapStop[]; routeTitle: string };

// Chunk/render failures receive the same textual fallback as map/network errors.
class MapBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function RouteMap({ stops, routeTitle }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const captionId = useId();
  const [nearViewport, setNearViewport] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const geometry = useMemo(() => buildRouteGeometry(stops), [stops]);
  const ready = useCallback(() => setState("ready"), []);
  const failed = useCallback(() => setState("error"), []);
  const hasLocations = geometry.points.length > 0;
  const mapVisible = hasLocations && nearViewport && state === "ready";

  useEffect(() => {
    if (!root.current || !hasLocations) return;
    // Old browsers retain the useful list and an explicit load button instead.
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setNearViewport(true);
      observer.disconnect();
    }, { rootMargin: "240px" });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [hasLocations]);

  useEffect(() => {
    if (!nearViewport || !hasLocations || state !== "loading") return;
    // Also bound a stalled JavaScript chunk, before MapLibre can start its timer.
    const timeout = setTimeout(failed, 20000);
    return () => clearTimeout(timeout);
  }, [nearViewport, hasLocations, state, attempt, failed]);

  const retry = () => {
    setState("loading");
    setAttempt((value) => value + 1);
    setNearViewport(true);
  };

  return (
    <figure
      ref={root}
      aria-labelledby={titleId}
      aria-describedby={captionId}
      data-route-map
      className="flex h-[480px] min-w-0 flex-col overflow-hidden bg-[var(--paper)] text-[var(--river-deep)]"
    >
      <header className="shrink-0 px-5 pb-3 pt-5 lg:px-6">
        <h3 id={titleId} className="font-[family:var(--font-display)] text-2xl leading-tight">Route sketch</h3>
        <p className="mt-1 text-sm leading-5 text-[var(--muted)]">
          {geometry.points.length === stops.length
            ? "Route map"
            : `${geometry.points.length} of ${stops.length} stops are located.`}
        </p>
      </header>
      <div className="relative min-h-0 flex-1">
        {hasLocations && nearViewport && state !== "error" ? (
          <MapBoundary key={attempt} onError={failed}>
            <RouteMapCanvas geometry={geometry} routeTitle={routeTitle} onReady={ready} onError={failed} />
          </MapBoundary>
        ) : null}
        <div
          className={mapVisible
            ? "sr-only"
            : "absolute inset-0 flex flex-col overflow-y-auto bg-[var(--paper)] px-5 py-3 lg:px-6"}
        >
          <p role="status" className="text-sm leading-6">
            {!hasLocations
              ? "Map locations are not available for this itinerary."
              : state === "error"
                ? "The map could not load. Recorded locations are listed below."
                : nearViewport && state === "loading"
                  ? "Loading map. Recorded locations are listed below."
                  : "Recorded locations for this itinerary."}
          </p>
          {hasLocations && (state === "error" || !nearViewport) ? (
            <button
              type="button"
              onClick={retry}
              className="mt-3 min-h-11 self-start border border-[var(--river-deep)] px-4 text-sm text-[var(--river-deep)] hover:bg-[var(--river-deep)] hover:text-[var(--paper)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--river-deep)]"
            >
              {state === "error" ? "Retry map" : "Load map"}
            </button>
          ) : null}
          <ol aria-label={`${routeTitle}: stop locations`} className="mt-4 space-y-3 pb-3 text-sm">
            {stops.map((stop, index) => {
              const coordinates = validRouteCoordinates(stop);
              return (
                <li key={index} value={index + 1} className="grid grid-cols-[1.5rem_1fr] gap-2">
                  <span aria-hidden="true" className="font-mono">{index + 1}.</span>
                  <div className="min-w-0 break-words">
                    <span className="font-bold">{stop.stop}</span>
                    {stop.time ? <span> ({stop.time})</span> : null}
                    {!coordinates ? (
                      <span className="block text-xs leading-5 text-[var(--muted)]">Coordinates unavailable</span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <figcaption id={captionId} className="shrink-0 border-t border-[var(--line)] px-5 py-3 text-xs leading-5 text-[var(--muted)] lg:px-6">
        A visual reading of the route, not turn-by-turn navigation.
        {geometry.missingCount > 0 ? " Stops without a recorded location remain off the line." : ""}
      </figcaption>
    </figure>
  );
}

export default RouteMap;
