import { cityTicketUrl, ticketMediaUrl, TICKET_SIZE, validateTicketInput, wrapTicketText, type TicketCity, type TicketInput } from "./city-ticket";

export function withTicketTimeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), milliseconds);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

function loadPhoto(slug: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); image.onload = null; image.onerror = null; };
    const abort = () => { finish(); image.src = ""; reject(new Error("Photo loading cancelled. Please try again.")); };
    const timer = setTimeout(abort, 14000);
    signal.addEventListener("abort", abort, { once: true });
    image.onload = () => {
      finish();
      if (!image.naturalWidth || !image.naturalHeight) reject(new Error("City photograph unavailable."));
      else resolve(image);
    };
    image.onerror = () => { finish(); reject(new Error("The city photograph could not be loaded. Please try again.")); };
    // Same-origin relay; no third-party image can taint the canvas.
    image.src = ticketMediaUrl(slug);
    if (signal.aborted) abort();
  });
}

export async function renderCityTicket(city: TicketCity, values: TicketInput, signal: AbortSignal): Promise<Blob> {
  const input = validateTicketInput(values);
  const url = cityTicketUrl(city.slug);
  await withTicketTimeout(document.fonts?.ready ?? Promise.resolve(), 5000, "Fonts are taking too long to load. Please try again.");
  const [photo, QRCode] = await withTicketTimeout(Promise.all([loadPhoto(city.slug, signal), import("qrcode")]), 16000, "Ticket resources could not be loaded. Please try again.");
  if (signal.aborted) throw new Error("Ticket generation cancelled.");
  const canvas = document.createElement("canvas");
  canvas.width = TICKET_SIZE.width;
  canvas.height = TICKET_SIZE.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser cannot create this ticket.");
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, url, { width: 390, margin: 4, errorCorrectionLevel: "M", color: { dark: "#14343d", light: "#ffffff" } });
  ctx.fillStyle = "#f4f2ee";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#14343d";
  ctx.fillRect(0, 0, 26, canvas.height);
  ctx.strokeStyle = "#14343d";
  ctx.lineWidth = 2;
  ctx.strokeRect(55, 55, 2290, 1390);
  ctx.setLineDash([12, 14]);
  ctx.beginPath(); ctx.moveTo(1590, 55); ctx.lineTo(1590, 1445); ctx.stroke(); ctx.setLineDash([]);
  // Cover crop of the real city primary photograph, independent of source ratio.
  const scale = Math.max(1440 / photo.naturalWidth, 970 / photo.naturalHeight);
  ctx.save(); ctx.beginPath(); ctx.rect(100, 100, 1440, 970); ctx.clip();
  ctx.drawImage(photo, 100 + (1440 - photo.naturalWidth * scale) / 2, 100 + (970 - photo.naturalHeight * scale) / 2, photo.naturalWidth * scale, photo.naturalHeight * scale);
  ctx.restore();
  ctx.fillStyle = "#14343d";
  ctx.font = "116px Georgia, 'Times New Roman', serif";
  let size = 116;
  while (ctx.measureText(city.name).width > 1400 && size > 42) { size -= 2; ctx.font = `${size}px Georgia, 'Times New Roman', serif`; }
  ctx.fillText(city.name, 100, 1210);
  ctx.font = "34px 'Trebuchet MS', 'Segoe UI', sans-serif";
  if (input.quote) wrapTicketText(input.quote, (text) => ctx.measureText(text).width, 1400, 3).forEach((line, index) => ctx.fillText(line, 100, 1290 + index * 46));
  ctx.font = "72px Georgia, 'Times New Roman', serif";
  ctx.fillText("Culvoy", 1660, 190);
  ctx.font = "24px 'Trebuchet MS', 'Segoe UI', sans-serif";
  ctx.fillText("CITY SOUVENIR", 1660, 245);
  ctx.font = "34px 'Trebuchet MS', 'Segoe UI', sans-serif";
  if (input.nickname) wrapTicketText(input.nickname, (text) => ctx.measureText(text).width, 590, 2).forEach((line, index) => ctx.fillText(line, 1660, 360 + index * 45));
  if (input.date) ctx.fillText(input.date, 1660, 490);
  ctx.drawImage(qr, 1740, 590, 390, 390);
  ctx.font = "28px 'Trebuchet MS', 'Segoe UI', sans-serif";
  ctx.fillText("Explore this city", 1780, 1035);
  ctx.font = "23px 'Trebuchet MS', 'Segoe UI', sans-serif";
  ctx.fillText(`culvoy.com/culture/${city.slug}`, 1660, 1110);
  ctx.font = "25px 'Trebuchet MS', 'Segoe UI', sans-serif";
  ctx.fillText("A souvenir, not an admission ticket.", 1660, 1320);
  ctx.fillText("No booking or visit certification.", 1660, 1370);
  if (signal.aborted) throw new Error("Ticket generation cancelled.");
  return withTicketTimeout(new Promise<Blob>((resolve, reject) => {
    try { canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG export failed. Please try again.")), "image/png"); }
    catch { reject(new Error("Your browser could not export the city photograph.")); }
  }), 10000, "PNG export is taking too long. Please try again.");
}
