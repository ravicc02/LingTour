import { Suspense } from "react";
import type { Metadata } from "next";
import { fetchRoutesServer } from "@/lib/server-data";
import RoutesPageClient from "./RoutesPageClient";

export const metadata: Metadata = {
  title: "Route Planning | Culvoy Guangdong",
  description: "Browse Guangdong's fixed routes, book without a route fee, or request paid custom route planning.",
  alternates: { canonical: "/routes/" },
};

export const revalidate = 60;

export default async function RoutesPage() {
  const routes = await fetchRoutesServer().catch(() => null);

  return <Suspense fallback={null}><RoutesPageClient initialRoutes={routes} /></Suspense>;
}
