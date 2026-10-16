import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Interpretation Services | Culvoy Guangdong",
  description:
    "English-speaking interpreters for Guangdong's markets, temples, and tea tables — half-day city walks, full-day routes, group trips, and remote support.",
  openGraph: {
    title: "Interpretation Services | Culvoy Guangdong",
    description:
      "Interpreters for Guangdong's markets, temples, and tea tables — in person or remote.",
  },
};

export default function InterpretingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
