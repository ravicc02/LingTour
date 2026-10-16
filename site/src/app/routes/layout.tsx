import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Route Planning | Culvoy Guangdong",
  description:
    "Walked and timed Guangdong routes — from Huguangyan's crater lake to a Zhanjiang seafood table, or Chaozhou's tea streets — with honest itineraries, not checklists.",
  openGraph: {
    title: "Route Planning | Culvoy Guangdong",
    description:
      "Timed, walked Guangdong routes — Huguangyan's crater lake, Zhanjiang's seafood table, Chaozhou's tea streets.",
  },
};

export default function RoutesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
