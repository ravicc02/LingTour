import { serveCityTicketMedia } from "@/lib/city-ticket-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Outside /api: the site's catch-all /api proxy belongs to Nest.
export const GET = serveCityTicketMedia;
