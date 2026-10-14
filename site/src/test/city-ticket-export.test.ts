import { afterEach, describe, expect, it, vi } from "vitest";
import { renderCityTicket } from "@/lib/city-ticket-export";
import * as QRCode from "qrcode";

vi.mock("qrcode", () => ({ toCanvas: vi.fn(async () => undefined) }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function browserCanvas(exportFails = false) {
  const sources: string[] = [];
  class Photo {
    naturalWidth = 1200; naturalHeight = 800;
    onload: (() => void) | null = null; onerror: (() => void) | null = null;
    set src(value: string) { sources.push(value); if (value) queueMicrotask(() => this.onload?.()); }
  }
  vi.stubGlobal("Image", Photo);
  const ctx = { fillRect: vi.fn(), strokeRect: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), save: vi.fn(), rect: vi.fn(), clip: vi.fn(), drawImage: vi.fn(), restore: vi.fn(), fillText: vi.fn(), measureText: (text: string) => ({ width: text.length * 20 }), font: "", fillStyle: "", strokeStyle: "", lineWidth: 0 };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  const sizes: number[][] = [];
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (this: HTMLCanvasElement, callback) {
    sizes.push([this.width, this.height]); callback(exportFails ? null : new Blob(["png"], { type: "image/png" }));
  });
  return { sources, ctx, sizes };
}

describe("browser ticket export", () => {
  it("draws the real same-origin photo, exact QR URL and 2400x1500 PNG", async () => {
    const { sources, ctx, sizes } = browserCanvas();
    const blob = await renderCityTicket({ slug: "chaozhou", name: "Chaozhou" }, { nickname: "Private name", quote: "Personal quote", date: "2026-10-14" }, new AbortController().signal);
    expect(blob.type).toBe("image/png");
    expect(sizes).toEqual([[2400, 1500]]);
    expect(sources).toEqual(["/city-ticket/media?citySlug=chaozhou"]);
    expect(QRCode.toCanvas).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), "https://culvoy.com/culture/chaozhou/", expect.objectContaining({ margin: 4, width: 390, errorCorrectionLevel: "M" }));
    expect(ctx.fillText).toHaveBeenCalledWith("Private name", 1660, 360);
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
  });
  it("reports failed PNG encoding instead of producing an empty download", async () => {
    browserCanvas(true);
    await expect(renderCityTicket({ slug: "chaozhou", name: "Chaozhou" }, { nickname: "", quote: "", date: "" }, new AbortController().signal)).rejects.toThrow("PNG export failed");
  });
  it("never exports after cancellation", async () => {
    const { sizes } = browserCanvas();
    const operation = new AbortController(); operation.abort();
    await expect(renderCityTicket({ slug: "chaozhou", name: "Chaozhou" }, { nickname: "", quote: "", date: "" }, operation.signal)).rejects.toThrow();
    expect(sizes).toEqual([]);
  });
});
