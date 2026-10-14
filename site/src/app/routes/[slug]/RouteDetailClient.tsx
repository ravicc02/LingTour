"use client";

import { useRef, useState } from "react";
import { notFound } from "next/navigation";
import { fetchRouteBySlug, fetchRouteCommunityPosts } from "@/lib/api-data";
import { usePreviewBridge } from "@/lib/preview";
import { ErrorState, LoadingSpinner, useApiQuery } from "@/lib/use-api-query";
import { RouteMap } from "@/components/routes/RouteMap";
import { RouteBrief } from "@/components/routes/RouteBrief";
import { TimeAxisItinerary, type RouteStopTarget } from "@/components/routes/TimeAxisItinerary";
import { StickyComposeBar } from "@/components/routes/StickyComposeBar";
import type { StoryRoute } from "@/data/routes";

export function RouteDetailClient({
  slug,
  initialRoute,
}: {
  slug: string;
  initialRoute: StoryRoute | null;
}) {
  const { previewData, previewEnabled } = usePreviewBridge<StoryRoute>("route");
  const [composeTarget, setComposeTarget] = useState<RouteStopTarget | null>(null);

  const { data: route, loading, error } = useApiQuery(
    () => fetchRouteBySlug(slug),
    [slug],
    { initialData: initialRoute, revalidateOnMount: false },
  );

  const lastRouteRef = useRef<StoryRoute | null>(null);
  if (route) {
    lastRouteRef.current = route;
  }

  const activeRoute = previewData ?? route ?? lastRouteRef.current;

  const { data: liveCommunityPosts } = useApiQuery(
    () =>
      activeRoute
        ? fetchRouteCommunityPosts({
            routeSlug: activeRoute.slug,
            routeTitle: activeRoute.title,
          })
        : Promise.resolve([]),
    [activeRoute?.slug, activeRoute?.title],
  );

  if (previewEnabled && !activeRoute) return <LoadingSpinner text="Loading preview..." />;
  if (loading && !activeRoute) return <LoadingSpinner text="Opening the route..." />;

  if (error && !activeRoute) {
    return (
      <ErrorState
        title="Route file unavailable"
        message="This route's archive can't be reached right now. Please try again shortly."
      />
    );
  }

  if (!activeRoute) {
    notFound();
  }

  return (
    <>
      <div className="route-detail-shell relative min-h-screen w-full bg-[var(--background)] bg-grain">
        {/* Section A - Route Brief: marquee title, live position, thumb stack */}
        <RouteBrief route={activeRoute} />

        {/* Section B - Time-Axis Itinerary: continuous reader, no cards, no modal */}
        <TimeAxisItinerary
          stops={activeRoute.itinerary}
          routeStory={activeRoute.story}
          routeTitle={activeRoute.title}
          routeMap={<RouteMap stops={activeRoute.itinerary} routeTitle={activeRoute.title} />}
          onAddStopNote={(stop, index) =>
            setComposeTarget({ index, time: stop.time, name: stop.stop })
          }
        />
      </div>

      {/* Section C - Sticky Compose Bar: pinned to viewport bottom. Kept as a
          sibling of the shell (not inside) so its `position: fixed` container
          isn't accidentally caught by any `main > div` style rules and forced
          to full viewport height. */}
      <StickyComposeBar
        routeSlug={activeRoute.slug}
        routeTitle={activeRoute.title}
        routeCity={activeRoute.city}
        initialPosts={liveCommunityPosts ?? []}
        composeTarget={composeTarget}
        onClearTarget={() => setComposeTarget(null)}
      />
    </>
  );
}
