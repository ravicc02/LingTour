"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
import type { EventData } from "@/lib/api-data";
import type { StoryRoute } from "@/data/routes";
import { Reveal } from "@/components/ui/Reveal";

const DAY_NAMES_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function dateKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

type Props = {
  events?: EventData[];
  routes?: StoryRoute[];
};

export function GuangdongEventCalendar({ events = [], routes = [] }: Props) {
  const { t } = useLocale();
  const dayNames = DAY_NAMES_EN;
  const monthNames = MONTH_NAMES_EN;

  const eventsByDate = useMemo(() => {
    const map: Record<string, EventData[]> = {};
    for (const event of events) {
      if (!map[event.date]) map[event.date] = [];
      map[event.date].push(event);
    }
    return map;
  }, [events]);

  const initialDate =
    events.length > 0 ? new Date(`${events[0].date}T00:00:00`) : new Date();
  const [year, setYear] = useState(initialDate.getFullYear());
  const [month, setMonth] = useState(initialDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(
    events[0]?.date ?? null,
  );

  useEffect(() => {
    if (!events.length) return;

    const eventDates = new Set(events.map((event) => event.date));
    const nextSelectedDate =
      selectedDate && eventDates.has(selectedDate) ? selectedDate : events[0].date;

    if (!nextSelectedDate) return;

    const nextDate = new Date(`${nextSelectedDate}T00:00:00`);
    setSelectedDate(nextSelectedDate);
    setYear(nextDate.getFullYear());
    setMonth(nextDate.getMonth());
  }, [events, selectedDate]);

  const activeEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : [];
  const activeEvent = activeEvents[0] ?? null;

  const relatedRoute = useMemo(() => {
    if (!activeEvent?.relatedRouteSlugs.length) return null;
    return (
      routes.find((route) => route.slug === activeEvent.relatedRouteSlugs[0]) ??
      null
    );
  }, [activeEvent, routes]);

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((value) => value - 1);
      return;
    }
    setMonth((value) => value - 1);
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((value) => value + 1);
      return;
    }
    setMonth((value) => value + 1);
  }

  const totalDays = daysInMonth(year, month);
  const startDow = firstDayOfMonth(year, month);
  const today = new Date();
  const todayStr = dateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const weeks: Array<Array<number | null>> = [];
  let currentWeek: Array<number | null> = [];

  for (let i = 0; i < startDow; i += 1) currentWeek.push(null);
  for (let day = 1; day <= totalDays; day += 1) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return (
    <section className="site-container py-16 sm:py-20 lg:py-40">
      <div className="grid items-start gap-10 lg:grid-cols-[1fr_420px] lg:gap-20">
        {/* The route card is sticky, but it only has as much travel as this
            column is taller than the card. The extra lg bottom space gives the
            card a real pin while the month and notes scroll past. */}
        <div className="flex flex-col lg:pb-56">
          <Reveal>
            <div className="mb-12 flex flex-wrap items-center justify-between gap-6 sm:mb-16">
              <h2 className="font-[family:var(--font-display)] text-4xl leading-[0.94] tracking-[-0.03em] text-[var(--river-deep)] sm:text-5xl md:text-7xl">
                {t("home.calendar.title")}
              </h2>
              <div className="flex shrink-0 gap-4">
                <button
                  onClick={prevMonth}
                  aria-label="Previous month"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] transition-all hover:bg-[var(--river-deep)] hover:text-white"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      d="M15 19l-7-7 7-7"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  onClick={nextMonth}
                  aria-label="Next month"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] transition-all hover:bg-[var(--river-deep)] hover:text-white"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      d="M9 5l7 7-7 7"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </Reveal>

          <div className="mb-8 border-b border-[var(--line)] pb-6 sm:mb-10 sm:pb-8">
            <h3 className="font-[family:var(--font-display)] text-[2.2rem] italic leading-none text-[var(--river-deep)] sm:text-4xl">
              {monthNames[month]}{" "}
              <span className="ml-2 not-italic text-[var(--gold)]">{year}</span>
            </h3>
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {dayNames.map((name) => (
              <div
                key={name}
                className="py-4 text-center text-[12px] font-bold uppercase tracking-widest text-[var(--muted)] opacity-40"
              >
                {name}
              </div>
            ))}
            {weeks.flat().map((day, index) => {
              if (day === null)
                return (
                  <div key={`empty-${index}`} className="aspect-square min-h-11" />
                );

              const key = dateKey(year, month, day);
              const hasEvent = Boolean(eventsByDate[key]?.length);
              const isSelected = key === selectedDate;
              const isToday = key === todayStr;

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  className={`group relative flex aspect-square min-h-11 flex-col items-center justify-center transition-all duration-500 ${
                    isSelected
                      ? "text-[var(--cinnabar)]"
                      : "text-[var(--river-deep)] hover:bg-white/40"
                  }`}
                >
                  <span
                    className={`font-[family:var(--font-display)] text-2xl transition-all md:text-3xl ${
                      isSelected
                        ? "scale-125 font-bold"
                        : "opacity-30 group-hover:opacity-60"
                    }`}
                  >
                    {day}
                  </span>

                  {isToday ? (
                    <div className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--cinnabar)]" />
                  ) : null}
                  {hasEvent ? (
                    <div
                      aria-hidden="true"
                      className={`mt-1 h-1 w-1 rounded-full ${isSelected ? "animate-pulse bg-[var(--cinnabar)]" : "bg-[var(--gold)]"}`}
                    />
                  ) : null}
                  {isSelected ? (
                    <div className="scrapbook-shadow absolute inset-0 -z-10 rotate-3 border-2 border-[var(--cinnabar)]/20" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-12 space-y-6 sm:mt-16">
            {activeEvents.length > 0 ? (
              activeEvents.map((event) => (
                <div
                  key={event.id}
                  className="relative border-l border-[var(--gold)]/30 pl-8"
                >
                  <div className="absolute -left-1.5 top-0 h-3 w-3 rounded-full bg-[var(--gold)]" />
                  <h4 className="mb-3 font-[family:var(--font-display)] text-xl text-[var(--river-deep)] sm:text-2xl">
                    {event.title}
                  </h4>
                  <p className="handwritten max-w-lg text-sm leading-relaxed text-[var(--muted)]">
                    {event.summary || t("home.calendar.eventFallbackEn")}
                  </p>
                </div>
              ))
            ) : (
              <div className="relative border-l border-[var(--line)]/60 pl-8">
                <div className="absolute -left-1.5 top-0 h-3 w-3 rounded-full bg-[var(--line)]" />
                <p className="handwritten text-sm text-[var(--muted)]">
                  {t("home.calendar.noEvents")}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-32">
          {relatedRoute ? (
            <Reveal delay={200}>
              <Link
                href={`/routes/${relatedRoute.slug}`}
                className="group relative block"
              >
                    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 border border-[var(--line)] bg-white p-3 scrapbook-shadow transition-all duration-700 group-hover:scale-[1.02] lg:block lg:-rotate-2 lg:p-6 lg:group-hover:rotate-0">
                  <div className="relative aspect-square overflow-hidden lg:mb-8 lg:aspect-[3/4]">
                    <img
                      src={relatedRoute.image}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-1000 group-hover:scale-110"
                    />
                    <div className="absolute left-1/2 top-[-0.5rem] z-20 h-8 w-24 -translate-x-1/2 -rotate-3 bg-[var(--paper)]/60 backdrop-blur-sm" />
                  </div>

                  <div className="min-w-0 space-y-3 lg:space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="border border-[var(--gold)] px-3 py-1 text-[11px] font-bold uppercase text-[var(--gold)]">
                        {t("home.calendar.verifiedRoute")}
                      </span>
                      <span className="text-[12px] font-bold uppercase tracking-widest text-[var(--muted)]">
                        {relatedRoute.duration}
                      </span>
                    </div>
                    <h4 className="font-[family:var(--font-display)] text-xl leading-tight text-[var(--river-deep)] lg:text-3xl">
                      {relatedRoute.title}
                    </h4>
                    <p className="hidden line-clamp-2 text-sm leading-relaxed text-[var(--muted)] lg:block">
                      {relatedRoute.summary}
                    </p>
                    <div className="flex items-center justify-between border-t border-[var(--line)] pt-3 text-[var(--cinnabar)] lg:pt-6">
                      <span className="text-[12px] font-bold uppercase tracking-widest">
                        {t("home.calendar.exploreRoute")}
                      </span>
                      <svg
                        className="h-5 w-5 transition-transform group-hover:translate-x-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          d="M17 8l4 4m0 0l-4 4m4-4H3"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

              </Link>
            </Reveal>
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center border-2 border-dashed border-[var(--line)] p-8 text-center sm:aspect-[3/4] sm:rotate-1 sm:p-12">
              <p className="handwritten text-sm text-[var(--muted)] opacity-40">
                {t("home.calendar.selectDate")}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
