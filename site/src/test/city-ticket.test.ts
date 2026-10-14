import { describe, expect, it, vi, afterEach } from "vitest";
import QRCode from "qrcode";
import { cityTicketUrl, ticketMediaUrl, validateTicketInput, wrapTicketText, TICKET_SIZE } from "./../lib/city-ticket";
import { resolveTicketImageSource, ticketImageTypeAllowed, boundedImageBytes, serveCityTicketMedia, TICKET_MEDIA_MAX_BYTES } from "./../lib/city-ticket-media";
import { filterPublishedCities, cityDestinations } from "./../lib/city-discovery";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("anonymous city souvenir constraints", () => {
  it("uses canonical public QR destinations without input or private IDs", () => {
    expect(cityTicketUrl("chaozhou")).toBe("https://culvoy.com/culture/chaozhou/");
    expect(ticketMediaUrl("chaozhou")).toBe("/city-ticket/media?citySlug=chaozhou");
    expect(() => cityTicketUrl("../../profile?nickname=secret")).toThrow();
    const qr = QRCode.create(cityTicketUrl("chaozhou"), { errorCorrectionLevel: "M" });
    expect(qr.modules.size).toBeGreaterThan(20);
    expect(qr.segments.map((segment) => typeof segment.data === "string" ? segment.data : new TextDecoder().decode(segment.data)).join("")).toBe(cityTicketUrl("chaozhou"));
    expect(TICKET_SIZE).toEqual({ width: 2400, height: 1500 });
  });
  it("keeps optional fields blank and enforces date and length limits", () => {
    expect(validateTicketInput({ nickname: "", date: "", quote: "" })).toEqual({ nickname: "", date: "", quote: "" });
    expect(() => validateTicketInput({ nickname: "a".repeat(41), date: "", quote: "" })).toThrow("40");
    expect(() => validateTicketInput({ nickname: "", date: "", quote: "a".repeat(141) })).toThrow("140");
    expect(() => validateTicketInput({ nickname: "", date: "2026-02-30", quote: "" })).toThrow("valid date");
    expect(validateTicketInput({ nickname: " <b>My name</b> ", date: "2026-10-14", quote: " hello " }).nickname).toBe("<b>My name</b>");
  });
  it("constrains long unbroken and non-Latin text to the available area", () => {
    const lines = wrapTicketText("界".repeat(140), (text) => Array.from(text).length * 10, 100, 3);
    expect(lines).toHaveLength(3);
    expect(lines.every((line) => Array.from(line).length <= 10)).toBe(true);
    expect(lines[2]).toContain("…");
  });
});
describe("published catalogue only", () => {
  const cities = [{ slug: "chaozhou", name: "Chaozhou" }, { slug: "zhanjiang", name: "Zhanjiang" }];
  it("searches names/slugs and never invents a fallback", () => {
    expect(filterPublishedCities(cities, " CHAO ")).toEqual([cities[0]]);
    expect(filterPublishedCities(cities, "Beijing")).toEqual([]);
    expect(filterPublishedCities([], "")).toEqual([]);
  });
  it("keeps citySlug context in separate service links", () => {
    expect(cityDestinations("chaozhou")).toEqual({ culture: "/culture/chaozhou", routes: "/routes?citySlug=chaozhou", interpretation: "/interpreting?citySlug=chaozhou" });
  });
});
describe("same-origin photo relay", () => {
  const base = new URL("http://api:8000/api/v1");
  it("allows only known service uploads and raster images", () => {
    expect(resolveTicketImageSource("/uploads/cities/chaozhou-hero.jpg", base)?.href).toBe("http://api:8000/uploads/cities/chaozhou-hero.jpg");
    expect(resolveTicketImageSource("https://api.culvoy.com/uploads/real.jpg", base)).not.toBeNull();
    for (const url of ["http://169.254.169.254/uploads/a.jpg", "https://evil.test/uploads/a.jpg", "https://api.culvoy.com@evil.test/uploads/a.jpg", "/uploads/../private.jpg", "/uploads/%2e%2e/a.jpg", "/uploads/a.svg", "/uploads/a.jpg?url=secret", "file:///uploads/a.jpg"]) expect(resolveTicketImageSource(url, base)).toBeNull();
    expect(ticketImageTypeAllowed("image/svg+xml")).toBe(false);
    expect(ticketImageTypeAllowed("text/html")).toBe(false);
  });
  it("rejects URL injection without making network calls", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect((await serveCityTicketMedia(new Request("https://culvoy.com/city-ticket/media?citySlug=chaozhou&url=http://evil.test"))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not fetch images for unpublished or mismatched records", async () => {
    vi.stubEnv("INTERNAL_API_ORIGIN", "http://api:8000/api/v1");
    const fetch = vi.fn().mockResolvedValue(Response.json({ slug: "chaozhou", published: false, heroImage: "/uploads/real.jpg" })); vi.stubGlobal("fetch", fetch);
    expect((await serveCityTicketMedia(new Request("https://culvoy.com/city-ticket/media?citySlug=chaozhou"))).status).toBe(404);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("relays exactly the published primary image with redirects disabled", async () => {
    vi.stubEnv("INTERNAL_API_ORIGIN", "http://api:8000/api/v1");
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ slug: "chaozhou", published: true, heroImage: "/uploads/real.jpg" })).mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } })); vi.stubGlobal("fetch", fetch);
    const response = await serveCityTicketMedia(new Request("https://culvoy.com/city-ticket/media?citySlug=chaozhou"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(fetch.mock.calls[1][0].href).toBe("http://api:8000/uploads/real.jpg");
    expect(fetch.mock.calls[1][1].redirect).toBe("error");
  });
  it("caps response bytes even without a trusted Content-Length", async () => {
    await expect(boundedImageBytes(new Response(new Uint8Array(TICKET_MEDIA_MAX_BYTES + 1)))).rejects.toThrow("too large");
    await expect(boundedImageBytes(new Response("", { headers: { "content-length": String(TICKET_MEDIA_MAX_BYTES + 1) } }))).rejects.toThrow("too large");
  });
});
