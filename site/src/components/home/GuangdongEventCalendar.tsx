"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
import type { EventData } from "@/lib/api-data";
import type { StoryRoute } from "@/data/routes";
import { Reveal } from "@/components/ui/Reveal";
import { MediaFrame } from "@/components/ui/MediaFrame";
import { MarkdownRenderer } from "@/components/culture/MarkdownRenderer";
import { resolveMediaGallery } from "@/types/media";
import { fetchCalendarMonth, type CalendarEvent } from "@/lib/calendar-api";
import { calendarDays, dateKey, dateParts, millisecondsToShanghaiMidnight, overlapsDate, shanghaiDate, shiftMonth } from "@/lib/calendar-dates";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const control = "min-h-11 min-w-11 border border-[var(--line)] px-4 text-sm text-[var(--river-deep)] hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--river-deep)]";

type PreviewEvent = EventData & Partial<Pick<CalendarEvent, "endDate" | "media" | "slogan" | "extraInfo" | "displayOrder">>;
type Props = { events?: EventData[]; routes?: StoryRoute[]; previewEvent?: PreviewEvent | null };

function CalendarEventContent({ event, routes }: { event: CalendarEvent; routes: StoryRoute[] }) {
  const media = resolveMediaGallery(event.media, [event.image]);
  const [mediaIndex, setMediaIndex] = useState(0);
  const asset = media[mediaIndex];
  const relatedRoutes = routes.filter(route => event.relatedRouteSlugs.includes(route.slug));
  return (
    <article className="min-w-0 border-t border-[var(--line)] pt-6">
      {asset ? <div className="aspect-[4/3] overflow-hidden border-[8px] border-white">
        <MediaFrame key={asset.url} asset={asset} fallbackSrc={event.image || ""} alt={asset.alt || event.title} mode="interactive" controls />
      </div> : null}
      {media.length > 1 ? <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={`Media for ${event.title}`}>
        {media.map((item, index) => <button type="button" key={`${item.type}:${item.url}`} aria-pressed={mediaIndex === index}
          aria-label={`${item.type === "video" ? "Video" : "Image"} ${index + 1} for ${event.title}`} className={control}
          onClick={() => setMediaIndex(index)}>{item.type === "video" ? "Video" : "Image"} {index + 1}</button>)}
      </div> : null}
      <div className="mt-5 space-y-3">
        {event.city ? <p className="text-sm text-[var(--muted)]">{event.city}</p> : null}
        <h4 className="break-words font-[family:var(--font-display)] text-2xl leading-tight text-[var(--river-deep)] sm:text-3xl">{event.title}</h4>
        {event.slogan ? <p className="text-base italic leading-relaxed text-[var(--river-deep)]">{event.slogan}</p> : null}
        {event.summary ? <MarkdownRenderer content={event.summary} /> : null}
        {event.description || event.extraInfo || relatedRoutes.length ? <details className="border-t border-[var(--line)] pt-2">
          <summary className="min-h-11 cursor-pointer py-3 font-bold text-[var(--cinnabar)] focus-visible:outline-2 focus-visible:outline-offset-4">Know more</summary>
          <div className="space-y-5 pb-4">
            {event.description ? <MarkdownRenderer content={event.description} /> : null}
            {event.extraInfo ? <div><h5 className="mb-2 font-bold text-[var(--river-deep)]">Additional information</h5><MarkdownRenderer content={event.extraInfo} /></div> : null}
            {relatedRoutes.length ? <ul className="space-y-2">{relatedRoutes.map(route => <li key={route.slug}><Link className="inline-flex min-h-11 items-center underline underline-offset-4" href={`/routes/${route.slug}`}>{route.title}</Link></li>)}</ul> : null}
          </div>
        </details> : null}
      </div>
    </article>
  );
}

export function GuangdongEventCalendar({ routes = [], previewEvent = null }: Props) {
  const { t } = useLocale();
  // SSR and hydration render the same shell. Local date is initialized only on
  // mount, never from a limited event feed or the server's timezone/clock.
  const [today, setToday] = useState<string | null>(null);
  const [view, setView] = useState<{ year: number; month: number } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const followingToday = useRef(true);
  const [result, setResult] = useState<{ month: string; events: CalendarEvent[] } | null>(null);
  const [loadState, setLoadState] = useState<{ month: string; status: "loading" | "success" | "error" }>({ month: "", status: "loading" });
  const [refresh, setRefresh] = useState(0);
  const monthId = view ? `${view.year}-${view.month}` : "";

  useEffect(() => {
    if (!previewEvent?.date || !/^\d{4}-\d{2}-\d{2}$/.test(previewEvent.date)) return;
    followingToday.current = false;
    setView(dateParts(previewEvent.date));
    setSelectedDate(previewEvent.date);
  }, [previewEvent?.date]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const sync = () => {
      const nextToday = shanghaiDate();
      setToday(previous => previous === nextToday ? previous : nextToday);
      if (followingToday.current) {
        setSelectedDate(nextToday);
        const nextView = dateParts(nextToday);
        setView(previous => previous?.year === nextView.year && previous.month === nextView.month ? previous : nextView);
      }
      clearTimeout(timer);
      timer = setTimeout(sync, millisecondsToShanghaiMidnight() + 25);
    };
    const resume = () => { if (!document.hidden) { sync(); setRefresh(value => value + 1); } };
    sync();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => { clearTimeout(timer); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); };
  }, []);

  useEffect(() => {
    if (!view) return;
    const controller = new AbortController();
    let cancelled = false;
    setLoadState({ month: monthId, status: "loading" });
    fetchCalendarMonth(view.year, view.month, controller.signal).then(events => {
      if (cancelled) return;
      setResult({ month: monthId, events });
      setLoadState({ month: monthId, status: "success" });
    }).catch(() => { if (!cancelled) setLoadState({ month: monthId, status: "error" }); });
    return () => { cancelled = true; controller.abort(); };
  }, [view, monthId, refresh, today]);

  const publishedEvents = result?.month === monthId && loadState.status === "success" ? result.events : [];
  const events: CalendarEvent[] = previewEvent ? [{ ...previewEvent,
    eventId: previewEvent.id, publicationId: null, version: 0, source: "legacy", publishedAt: null,
    eventDate: previewEvent.date, eventEndDate: previewEvent.endDate || null,
    endDate: previewEvent.endDate || null, media: previewEvent.media ?? [],
    slogan: previewEvent.slogan ?? "", extraInfo: previewEvent.extraInfo ?? "", displayOrder: previewEvent.displayOrder ?? 0,
  }] : publishedEvents;
  const activeEvents = selectedDate ? events.filter(event => overlapsDate(event, selectedDate)) : [];
  const status = previewEvent ? "success" : loadState.month === monthId ? loadState.status : "loading";
  const dateLabel = selectedDate ? new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${selectedDate}T00:00:00Z`)) : "";

  function changeMonth(offset: number) {
    if (!view) return;
    followingToday.current = false;
    const next = shiftMonth(view.year, view.month, offset);
    setView(next);
    setSelectedDate(dateKey(next.year, next.month, 1));
  }
  function goToday() {
    followingToday.current = true;
    const date = shanghaiDate();
    setToday(date); setView(dateParts(date)); setSelectedDate(date); setRefresh(value => value + 1);
  }

  return <section className="site-container py-16 sm:py-20 lg:py-40" aria-label="Guangdong event calendar">
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-20">
      <div className="min-w-0">
        <Reveal><h2 className="mb-8 font-[family:var(--font-display)] text-4xl leading-[0.94] tracking-[-0.03em] text-[var(--river-deep)] sm:text-5xl md:text-7xl">{t("home.calendar.title")}</h2></Reveal>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-6">
          <h3 className="font-[family:var(--font-display)] text-2xl leading-tight text-[var(--river-deep)] sm:text-3xl" aria-live="polite">{view ? `${MONTHS[view.month]} ${view.year}` : "Calendar"}</h3>
          <div className="flex gap-2"><button type="button" disabled={!view} className={control} aria-label="Previous month" onClick={() => changeMonth(-1)}>‹</button>
            <button type="button" className={control} onClick={goToday}>Today</button>
            <button type="button" disabled={!view} className={control} aria-label="Next month" onClick={() => changeMonth(1)}>›</button></div>
        </div>
        {view ? <div className="overflow-x-auto"><div className="grid min-w-[308px] grid-cols-7 gap-0 sm:gap-1" role="group" aria-label={`${MONTHS[view.month]} ${view.year} dates`}>
          {DAYS.map(name => <div key={name} className="py-3 text-center text-xs font-bold text-[var(--muted)]">{name}</div>)}
          {calendarDays(view.year, view.month).map((day, index) => {
            if (day === null) return <div key={`blank-${index}`} aria-hidden="true" />;
            const key = dateKey(view.year, view.month, day);
            const count = events.filter(event => overlapsDate(event, key)).length;
            const selected = key === selectedDate;
            return <button type="button" key={key} aria-pressed={selected} aria-current={key === today ? "date" : undefined}
              aria-label={`${MONTHS[view.month]} ${day}, ${view.year}${count ? `, ${count} event${count === 1 ? "" : "s"}` : ""}`}
              onClick={() => { followingToday.current = false; setSelectedDate(key); }}
              className={`relative flex min-h-11 flex-col items-center justify-center py-3 font-[family:var(--font-display)] text-xl focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--river-deep)] sm:aspect-square sm:text-3xl ${selected ? "bg-[var(--river-deep)] text-white" : "text-[var(--river-deep)] hover:bg-white/60"}`}>
              {day}{count ? <span aria-hidden="true" className={`mt-1 h-1 w-1 rounded-full ${selected ? "bg-white" : "bg-[var(--cinnabar)]"}`} /> : null}
              {key === today ? <span aria-hidden="true" className={`absolute bottom-1 h-px w-4 ${selected ? "bg-white" : "bg-[var(--river-deep)]"}`} /> : null}
            </button>;
          })}
        </div><p className="mt-2 text-xs text-[var(--muted)] min-[360px]:hidden">Swipe to see all dates.</p></div> : <p role="status" className="py-12 text-[var(--muted)]">Opening calendar…</p>}
        {previewEvent ? <p className="mt-5 text-sm font-bold text-[var(--cinnabar)]">Unsaved preview. Not published.</p> : null}
        <p className="mt-5 text-sm text-[var(--muted)]">Dates in Guangdong (Asia/Shanghai).</p>
      </div>
      <div className="min-w-0" aria-busy={status === "loading"}>
        <h3 className="mb-5 font-[family:var(--font-display)] text-2xl text-[var(--river-deep)]">{dateLabel || "Events"}</h3>
        <p role="status" aria-live="polite" className="sr-only">{status === "success" ? `${activeEvents.length} events for ${dateLabel}` : status === "loading" ? "Loading events" : "Events unavailable"}</p>
        {status === "loading" ? <div className="min-h-52 border-t border-[var(--line)] pt-6 text-[var(--muted)]">Loading events…</div> :
          status === "error" ? <div className="space-y-4 border-t border-[var(--line)] pt-6"><p role="alert">Events could not be loaded.</p><button type="button" className={control} onClick={() => setRefresh(value => value + 1)}>Try again</button></div> :
          activeEvents.length ? <div className="space-y-8">{activeEvents.map(event => <CalendarEventContent key={`${selectedDate}:${event.id}`} event={event} routes={routes} />)}</div> :
            <div className="min-h-52 border-t border-[var(--line)] pt-6"><p className="text-[var(--muted)]">No events for this date.</p></div>}
      </div>
    </div>
  </section>;
}
