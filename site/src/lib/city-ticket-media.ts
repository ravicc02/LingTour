import { isCitySlug } from "./city-ticket";

export const TICKET_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
export const ticketImageTypeAllowed = (type: string) => allowedTypes.has(type.split(";")[0].trim().toLowerCase());

/** Configured API origin, never request Host or a user-supplied URL. */
export function ticketApiBase(): URL {
  const configured = process.env.INTERNAL_API_ORIGIN || "https://api.culvoy.com/api/v1";
  const url = new URL(configured);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid API origin");
  return url;
}

/** Only the published primary image on our upload service can be relayed. */
export function resolveTicketImageSource(primaryImage: string, apiBase: URL): URL | null {
  if (!primaryImage || primaryImage.includes("\\") || /%2e|%2f|%5c/i.test(primaryImage)) return null;
  if (primaryImage.split("/").some((part) => part === "." || part === "..")) return null;
  let url: URL;
  try { url = new URL(primaryImage, apiBase.origin); } catch { return null; }
  const origins = new Set([apiBase.origin, "https://api.culvoy.com", "https://api.lingfengtranstour.cn"]);
  if (!origins.has(url.origin) || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
  let pathname: string;
  try { pathname = decodeURI(url.pathname); } catch { return null; }
  if (!/^\/uploads\/[a-zA-Z0-9_./ -]+\.(?:jpe?g|png|webp|avif)$/i.test(pathname)) return null;
  return url;
}

export async function boundedImageBytes(response: Response): Promise<Uint8Array> {
  const length = Number(response.headers.get("content-length"));
  if (length > TICKET_MEDIA_MAX_BYTES) throw new Error("City photo is too large.");
  if (!response.body) throw new Error("City photo is empty.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > TICKET_MEDIA_MAX_BYTES) throw new Error("City photo is too large.");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  if (!total) throw new Error("City photo is empty.");
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

export async function serveCityTicketMedia(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const slug = params.get("citySlug") || "";
  if (!isCitySlug(slug) || [...params.keys()].some((key) => key !== "citySlug")) return Response.json({ message: "Choose a published city." }, { status: 400 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const base = ticketApiBase();
    const cityResponse = await fetch(`${base.toString().replace(/\/$/, "")}/public/cities/${slug}`, { signal: controller.signal, cache: "no-store", redirect: "error", headers: { Accept: "application/json" } });
    if (cityResponse.status === 404) return Response.json({ message: "City unavailable." }, { status: 404 });
    if (!cityResponse.ok) throw new Error("City unavailable.");
    const city = await cityResponse.json() as { slug?: string; published?: boolean; heroImage?: string; heroMedia?: { type: string; url?: string; poster?: string } | null };
    if (city.slug !== slug || city.published !== true) return Response.json({ message: "City unavailable." }, { status: 404 });
    const primaryImage = (city.heroMedia?.type === "image" ? city.heroMedia.url : city.heroMedia?.type === "video" ? city.heroMedia.poster : undefined) || city.heroImage;
    const source = resolveTicketImageSource(primaryImage || "", base);
    if (!source) return Response.json({ message: "This city has no exportable primary photograph." }, { status: 422 });
    const image = await fetch(source, { signal: controller.signal, cache: "no-store", redirect: "error", headers: { Accept: "image/jpeg,image/png,image/webp,image/avif" } });
    const contentType = image.headers.get("content-type") || "";
    if (!image.ok || !ticketImageTypeAllowed(contentType)) throw new Error("City photo unavailable.");
    const bytes = await boundedImageBytes(image);
    return new Response(bytes as BodyInit, { headers: { "Content-Type": contentType.split(";")[0], "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" } });
  } catch {
    return Response.json({ message: "The city photograph could not be loaded. Please try again." }, { status: 502 });
  } finally { clearTimeout(timer); }
}
