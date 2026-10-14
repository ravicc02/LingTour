import { Suspense } from "react";
import type { Metadata } from "next";
import { fetchInterpretingServer } from "@/lib/server-data";
import InterpretingPageClient from "./InterpretingPageClient";

export const metadata: Metadata = {
  title: "Interpretation | Culvoy Guangdong",
  description: "Meet Guangdong interpreters and request a fixed USD interpretation package for your trip.",
  alternates: { canonical: "/interpreting/" },
};

export const revalidate = 60;

export default async function InterpretingPage() {
  const interpretingData = await fetchInterpretingServer().catch(() => null);

  return (
    <Suspense fallback={null}>
      <InterpretingPageClient initialInterpretingData={interpretingData} />
    </Suspense>
  );
}
