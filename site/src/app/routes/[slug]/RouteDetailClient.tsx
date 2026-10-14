"use client";

import { useRef, useState } from "react";
import { notFound } from "next/navigation";
import { fetchRouteBySlug, type RouteCommunityPost } from "@/lib/api-data";
import { fetchScopedRoutePosts } from "@/lib/community-api";
import { RelatedCommunityPosts } from "@/components/community/RelatedCommunityPosts";
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
  initialPosts,
}: {
  slug: string;
  initialRoute: StoryRoute | null;
  initialPosts?: RouteCommunityPost[];
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
      activeRoute?.id && !previewEnabled
        ? fetchScopedRoutePosts(activeRoute.id)
        : Promise.resolve([]),
    [activeRoute?.id, previewEnabled],
    { initialData: initialPosts ?? null, revalidateOnMount: true, keepPreviousData: false },
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
        {activeRoute.id && !previewEnabled ? (
          <div className="site-container pb-28 pt-10">
            <RelatedCommunityPosts routeId={activeRoute.id} title="Route posts" location={activeRoute.city} />
          </div>
        ) : null}
      </div>

      {/* Section C - Sticky Compose Bar: pinned to viewport bottom. Kept as a
          sibling of the shell (not inside) so its `position: fixed` container
          isn't accidentally caught by any `main > div` style rules and forced
          to full viewport height. */}
      <StickyComposeBar
        routeSlug={activeRoute.slug}
        routeId={previewEnabled ? undefined : activeRoute.id}
        routeCitySlug={activeRoute.citySlugs[0]}
        routeTitle={activeRoute.title}
        routeCity={activeRoute.city}
        initialPosts={liveCommunityPosts ?? []}
        composeTarget={composeTarget}
        onClearTarget={() => setComposeTarget(null)}
      />
    </>
  );
}
