"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { renderCityTicket } from "@/lib/city-ticket-export";
import { TICKET_LIMITS, TICKET_SIZE, type TicketCity, type TicketInput } from "@/lib/city-ticket";

export function CityTicket({ cities }: { cities: TicketCity[] }) {
  const [slug, setSlug] = useState("");
  const [input, setInput] = useState<TicketInput>({ nickname: "", date: "", quote: "" });
  const [preview, setPreview] = useState<{ url: string; slug: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef<AbortController | null>(null);
  const previewUrl = useRef<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => { operation.current?.abort(); if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);

  function invalidate() {
    operation.current?.abort(); operation.current = null;
    setBusy(false); setError(""); setPreview(null);
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
  }
  function update(field: keyof TicketInput, value: string) { invalidate(); setInput((previous) => ({ ...previous, [field]: value })); }
  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const city = cities.find((item) => item.slug === slug);
    if (!city) { setError("Choose a published city to make your ticket."); return; }
    const controller = new AbortController(); operation.current = controller;
    setError(""); setBusy(true);
    try {
      const blob = await renderCityTicket(city, input, controller.signal);
      if (operation.current !== controller || controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = url;
      setPreview({ url, slug: city.slug });
      requestAnimationFrame(() => previewRef.current?.focus({ preventScroll: true }));
    } catch (failure) {
      if (operation.current === controller && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Ticket generation failed. Please try again.");
    } finally { if (operation.current === controller) { setBusy(false); operation.current = null; } }
  }

  return (
    <section id="home-ticket" className="site-container py-beat city-ticket" aria-labelledby="city-ticket-title">
      <h2 id="city-ticket-title">Make your city ticket</h2>
      <p className="city-ticket-intro">A city souvenir, made here in your browser. No account required.</p>
      {cities.length ? <div className="city-ticket-layout">
        <form onSubmit={generate} aria-busy={busy} className="city-ticket-form">
          <label htmlFor="ticket-city">City</label>
          <select id="ticket-city" required value={slug} aria-describedby="ticket-privacy" onChange={(event) => { invalidate(); setSlug(event.target.value); }}>
            <option value="" disabled>Choose a city</option>
            {cities.map((city) => <option key={city.slug} value={city.slug}>{city.name}</option>)}
          </select>
          <label htmlFor="ticket-nickname">Nickname <span>(optional)</span></label>
          <input id="ticket-nickname" value={input.nickname} maxLength={TICKET_LIMITS.nickname} autoComplete="off" onChange={(event) => update("nickname", event.target.value)} />
          <label htmlFor="ticket-date">Date <span>(optional)</span></label>
          <input id="ticket-date" type="date" value={input.date} onChange={(event) => update("date", event.target.value)} />
          <label htmlFor="ticket-quote">Short quote <span>(optional)</span></label>
          <textarea id="ticket-quote" rows={3} maxLength={TICKET_LIMITS.quote} value={input.quote} onChange={(event) => update("quote", event.target.value)} aria-describedby="ticket-quote-length" />
          <p id="ticket-quote-length" className="city-ticket-help">{input.quote.length} / {TICKET_LIMITS.quote} characters</p>
          <p id="ticket-privacy" className="city-ticket-help">Your text is not saved or sent to our server. The QR opens the public city page, without your personal details.</p>
          {error ? <p role="alert" className="city-ticket-error">{error}</p> : null}
          <button type="submit" className="city-ticket-generate" disabled={busy}>{busy ? "Preparing your ticket…" : "Preview ticket"}</button>
          <p className="city-ticket-status" role="status">{busy ? "Loading the city photograph and preparing your PNG." : preview ? "Your ticket is ready to download." : "Choose a city, then preview your ticket."}</p>
        </form>
        <div ref={previewRef} tabIndex={-1} className="city-ticket-preview" aria-label="City ticket preview">
          {preview ? <>
            <img src={preview.url} width={TICKET_SIZE.width} height={TICKET_SIZE.height} alt={`Your ${cities.find((city) => city.slug === preview.slug)?.name || "city"} souvenir ticket with a QR code to its public city page`} />
            <a href={preview.url} download={`culvoy-${preview.slug}-ticket.png`} className="city-ticket-download">Download PNG <span aria-hidden="true">↓</span></a>
            <p className="city-ticket-help">2400 × 1500 pixels. A souvenir, not an admission ticket or proof of a visit.</p>
          </> : <div className="city-ticket-awaiting"><p>Your ticket preview will appear here.</p><p>Real city photography, your words and a link back to the city.</p></div>}
        </div>
      </div> : <p role="status" className="city-ticket-empty">No published cities are available right now. Please return when city content is available.</p>}
    </section>
  );
}
