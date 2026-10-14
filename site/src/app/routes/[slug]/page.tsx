import { cache, Suspense } from "react";
import type { Metadata } from "next";
import { fetchRouteBySlugServer, fetchRoutesServer } from "@/lib/server-data";

const SEEDED_ROUTE_SLUGS = ["southern-sea-table"];
const getRoute = cache(fetchRouteBySlugServer);

export const revalidate = 60;

export async function generateStaticParams() {
  const slugSet = new Set(SEEDED_ROUTE_SLUGS);

  try {
    // Server fetcher so the build-time call does not depend on window
    // (report P2-K).
    const routes = await fetchRoutesServer();
    for (const route of routes) {
      slugSet.add(route.slug);
    }
  } catch {
    // Keep build coverage from seeded route slugs when the API is not reachable.
  }

  return Array.from(slugSet).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const route = await getRoute(slug);
  if (!route) return {};

  const title = `${route.title} | Culvoy Guangdong`;
  const description =
    route.summary?.trim() ||
    `A ${route.duration} story route through ${route.city}, guided stop by stop.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: route.image ? [{ url: route.image }] : undefined,
    },
  };
}

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const initialRoute = await getRoute(slug);
  const { RouteDetailClient } = await import("./RouteDetailClient");
  return (
    <Suspense fallback={null}>
      <RouteDetailClient slug={slug} initialRoute={initialRoute} />
    </Suspense>
  );
}
