"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MultiStepForm } from "@/components/interpreting/MultiStepForm";

type BookingFormSnapshot = {
  name: string;
  contact: string;
  city: string;
  date: string;
  mode: string;
  groupSize: string;
  needs: string;
};

type Props = {
  prefillNeeds?: string;
};

export function BookingSection({ prefillNeeds }: Props) {
  const [bookingStep, setBookingStep] = useState(0);
  const [bookingFastTrack, setBookingFastTrack] = useState(false);
  const stepTrackRef = useRef<HTMLDivElement | null>(null);
  const stepButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [bookingForm, setBookingForm] = useState<BookingFormSnapshot>({
    name: "",
    contact: "",
    city: "Zhanjiang",
    date: "",
    mode: "Story-led route support",
    groupSize: "",
    needs: "",
  });

  const handleBookingStepChange = useCallback((step: number, fastTrack: boolean) => {
    setBookingStep(step);
    setBookingFastTrack(fastTrack);
  }, []);

  const handleBookingFastTrackChange = useCallback((fastTrack: boolean) => {
    setBookingFastTrack(fastTrack);
    setBookingStep(0);
  }, []);

  const handleBookingStateChange = useCallback((state: BookingFormSnapshot) => {
    setBookingForm(state);
  }, []);

  const bookingSummary = useMemo(
    () => [
      bookingForm.city || "City pending",
      bookingForm.date || "Date pending",
      bookingForm.mode || "Mode pending",
    ],
    [bookingForm.city, bookingForm.date, bookingForm.mode],
  );

  const bookingSteps = useMemo(
    () =>
      bookingFastTrack
        ? [
            {
              title: "Details",
              body: "Name · Contact · City",
            },
            {
              title: "Deposit",
              body: "Deposit · Matching",
            },
          ]
        : [
            {
              title: "Details",
              body: "Name · Contact · City · Date",
            },
            {
              title: "Support",
              body: "Mode · Group · Route",
            },
            {
              title: "Review",
              body: "Request Summary",
            },
            {
              title: "Deposit",
              body: "Deposit · Matching",
            },
          ],
    [bookingFastTrack],
  );

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    const stepTrack = stepTrackRef.current;
    const activeButton = stepButtonRefs.current[bookingStep];
    if (!stepTrack || !activeButton || typeof stepTrack.scrollTo !== "function") {
      return;
    }
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    stepTrack.scrollTo({
      left:
        activeButton.offsetLeft -
        (stepTrack.clientWidth - activeButton.offsetWidth) / 2,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [bookingStep, bookingFastTrack]);

  return (
    <section id="interpreting-booking" className="site-container order-1 scroll-mt-24 pb-28 md:pb-20 lg:pb-28">
      <div className="mb-10 grid gap-5 border-b border-[var(--line)] pb-8 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,0.55fr)] sm:items-end lg:mb-14">
        <div>
          <h2 className="font-[family:var(--font-display)] text-4xl leading-[0.98] tracking-[-0.03em] text-[var(--river-deep)] sm:text-5xl lg:text-6xl">
            {"Request support"}
          </h2>
        </div>
        <p className="max-w-md handwritten text-sm leading-7 text-[var(--muted)] sm:justify-self-end">
          {"Share a few details; we’ll match the right interpreter."}
        </p>
      </div>

      <div className="relative border-y border-[var(--line)] bg-[var(--paper)]/62 py-6 sm:p-6 lg:p-8">
        <span className="absolute -top-3 left-8 hidden h-6 w-28 rotate-[-1deg] bg-[rgba(236,229,214,0.9)] shadow-sm sm:block" aria-hidden="true" />

        <div className="grid gap-8 lg:grid-cols-[minmax(15rem,0.66fr)_minmax(0,1.34fr)] lg:gap-10 xl:gap-14">
          <aside className="min-w-0 lg:border-r lg:border-[var(--line)] lg:pr-10">
            <div className="px-1 sm:px-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--cinnabar)]">
                  {"Request summary"}
                </p>
                <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--gold)] animate-pulse" />
                  {bookingFastTrack ? "Fast track" : `${String(bookingStep + 1).padStart(2, "0")} / 04`}
                </span>
              </div>

              <div className="mt-5 flex min-w-0 items-center overflow-hidden border-y border-[var(--line)] py-4 lg:flex-wrap lg:gap-x-4 lg:gap-y-2">
                {bookingSummary.map((item, index) => (
                  <span key={`${index}-${item}`} className="flex min-w-0 items-center handwritten text-[12px] italic leading-5 text-[var(--river-deep)]">
                    {index > 0 ? <span className="mx-2 text-[var(--gold)]" aria-hidden="true">/</span> : null}
                    <span className="truncate">{item}</span>
                  </span>
                ))}
              </div>
            </div>

            <nav
              ref={stepTrackRef}
              aria-label="Booking steps"
              className="scrollbar-hide mt-6 grid auto-cols-[7.5rem] grid-flow-col overflow-x-auto border-y border-[var(--line)] lg:block lg:mt-6 lg:space-y-1 lg:overflow-visible lg:border-y-0 lg:pb-0"
            >
              {bookingSteps.map((item, index) => {
                const isActive = bookingStep === index;
                const isLocked = index > bookingStep;
                return (
                  <button
                    key={item.title}
                    ref={(element) => {
                      stepButtonRefs.current[index] = element;
                    }}
                    type="button"
                    onClick={() => setBookingStep(index)}
                    disabled={isLocked}
                    aria-current={isActive ? "step" : undefined}
                    aria-label={`${String(index + 1).padStart(2, "0")}. ${item.title}. ${item.body}`}
                    className={`group flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 border-b-2 px-1.5 py-2 text-center transition-[background-color,border-color,opacity,transform] duration-300 disabled:cursor-not-allowed lg:min-h-0 lg:w-full lg:flex-row lg:items-start lg:justify-start lg:gap-3 lg:border-b-0 lg:border-l-2 lg:px-4 lg:py-4 lg:text-left ${
                      isActive
                        ? "border-[var(--cinnabar)] bg-white/80 opacity-100 lg:translate-x-1"
                        : isLocked
                          ? "border-transparent opacity-35"
                          : "border-transparent opacity-45 hover:border-[var(--gold)]/45 hover:bg-white/40 hover:opacity-100"
                    }`}
                  >
                    <span className={`font-[family:var(--font-display)] text-[11px] lg:pt-0.5 lg:text-sm ${isActive ? "text-[var(--cinnabar)]" : "text-[var(--muted)]"}`}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-bold uppercase leading-tight tracking-[0.08em] text-[var(--river-deep)] sm:text-[11px] lg:font-[family:var(--font-display)] lg:text-xl lg:font-normal lg:normal-case lg:leading-none lg:tracking-normal">
                        {item.title}
                      </span>
                      <span className="mt-2 hidden handwritten text-[11px] italic leading-5 text-[var(--muted)] lg:block">
                        {item.body}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0">
            <div className="mb-6 flex items-end justify-between gap-4 px-1 sm:px-0">
              <div>
                <h3 className="font-[family:var(--font-display)] text-3xl italic leading-none text-[var(--river-deep)] sm:text-4xl">
                  {"Your request"}
                </h3>
              </div>
              <span className="hidden text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)] sm:block">
                {"About 3 minutes"}
              </span>
            </div>

            <MultiStepForm
              prefillNeeds={prefillNeeds}
              requestedStep={bookingStep}
              onStepChange={handleBookingStepChange}
              onFastTrackChange={handleBookingFastTrackChange}
              onStateChange={handleBookingStateChange}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
