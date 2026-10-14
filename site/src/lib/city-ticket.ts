import type { PublishedCityChoice } from "./city-discovery";

export const TICKET_SIZE = { width: 2400, height: 1500 } as const;
export const TICKET_LIMITS = { nickname: 40, quote: 140 } as const;
export type TicketInput = { nickname: string; date: string; quote: string };
export type TicketCity = Pick<PublishedCityChoice, "slug" | "name">;
export const isCitySlug = (slug: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80;

export function cityTicketUrl(slug: string): string {
  if (!isCitySlug(slug)) throw new Error("Choose a published city.");
  // Canonical public destination, never a nickname, private note or request ID.
  return `https://culvoy.com/culture/${slug}/`;
}
export function ticketMediaUrl(slug: string) {
  if (!isCitySlug(slug)) throw new Error("Choose a published city.");
  return `/city-ticket/media?citySlug=${encodeURIComponent(slug)}`;
}
export function validateTicketInput(input: TicketInput): TicketInput {
  const nickname = input.nickname.trim();
  const quote = input.quote.trim();
  if (nickname.length > TICKET_LIMITS.nickname) throw new Error("Keep your nickname to 40 characters.");
  if (quote.length > TICKET_LIMITS.quote) throw new Error("Keep your short quote to 140 characters.");
  if (input.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Enter a valid date.");
    const date = new Date(`${input.date}T12:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.date) throw new Error("Enter a valid date.");
  }
  return { nickname, quote, date: input.date };
}

/** Fit long words and non-Latin input without painting outside the ticket. */
export function wrapTicketText(text: string, measure: (text: string) => number, width: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    for (const char of Array.from(`${line ? " " : ""}${word}`)) {
      if (measure(line + char) > width && line) { lines.push(line.trim()); line = ""; }
      line += char;
    }
  }
  if (line.trim()) lines.push(line.trim());
  if (lines.length <= maxLines) return lines;
  const result = lines.slice(0, maxLines);
  let last = result[maxLines - 1];
  while (last && measure(`${last}…`) > width) last = Array.from(last).slice(0, -1).join("");
  result[maxLines - 1] = `${last.trim()}…`;
  return result;
}
