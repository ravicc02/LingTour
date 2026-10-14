import { apiClient } from "@/lib/api-client";
import type { MediaAsset } from "@/types/media";
import { monthRange } from "./calendar-dates";

export type CalendarEvent = {
  id: string; eventId: string; publicationId: string | null; version: number;
  source: "publication" | "legacy"; publishedAt: string | null;
  slug: string; title: string; date: string; endDate: string | null;
  eventDate: string; eventEndDate: string | null;
  city: string; citySlug: string; tags: string[]; summary: string;
  description: string; image: string | null; media: MediaAsset[];
  slogan: string; extraInfo: string; displayOrder: number; relatedRouteSlugs: string[];
};

type Page = { data: CalendarEvent[]; total: number; page: number; pageSize: number };

function mediaUrl(path: string) {
  if (!path.startsWith("/uploads/")) return path;
  const base = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
  return `${base.replace(/\/api\/v1\/?$/, "")}${path}`;
}

function normalize(event: CalendarEvent): CalendarEvent {
  return { ...event, image: event.image ? mediaUrl(event.image) : null,
    media: (event.media ?? []).map(asset => ({ ...asset, url: mediaUrl(asset.url), poster: asset.poster ? mediaUrl(asset.poster) : undefined })),
    tags: event.tags ?? [], relatedRouteSlugs: event.relatedRouteSlugs ?? [],
    slogan: event.slogan ?? "", extraInfo: event.extraInfo ?? "" };
}

/** A month is not a limited home feed: consume every page before presenting it. */
export async function fetchCalendarMonth(year: number, month: number, signal?: AbortSignal): Promise<CalendarEvent[]> {
  const range = monthRange(year, month);
  const items: CalendarEvent[] = [];
  let page = 1;
  while (true) {
    const result = await apiClient<Page>("/public/events/calendar", {
      params: { ...range, page, limit: 100 }, signal, cache: "no-store",
    });
    if (!result || !Array.isArray(result.data) || !Number.isFinite(result.total)) throw new Error("Invalid calendar response");
    items.push(...result.data);
    if (page * result.pageSize >= result.total) break;
    if (!result.data.length || result.pageSize < 1) throw new Error("Incomplete calendar response");
    page++;
  }
  return [...new Map(items.map(item => [item.id, normalize(item)])).values()]
    .sort((a, b) => a.displayOrder - b.displayOrder || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
