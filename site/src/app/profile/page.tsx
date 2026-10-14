import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfilePageClient } from "./ProfilePageClient";
import { requireTraveler, toServerLocalUser } from "@/lib/server-session";

export const metadata: Metadata = {
  title: "Traveler Profile | Culvoy Guangdong",
  description: "Your Culvoy field notes, saved routes, collection, bookings, and traveler settings.",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") params.set(key, value);
  }
  const search = params.size ? `?${params.toString()}` : "";
  const user = await requireTraveler("/profile", search);
  const initialUser = toServerLocalUser(user);

  return (
    <Suspense fallback={null}>
      <ProfilePageClient initialUser={initialUser} />
    </Suspense>
  );
}
