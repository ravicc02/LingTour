"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import {
  fetchInterpreting,
  type ApiInterpretingFaq,
  type ApiInterpretingMode,
  type ApiInterpreterProfile,
  type InterpretingData,
} from "@/lib/api-data";
import { useApiQuery, LoadingSpinner, ErrorState } from "@/lib/use-api-query";
import { Reveal } from "@/components/ui/Reveal";
import {
  InterpreterShowcase,
  type InterpreterProfile,
} from "@/components/interpreting/InterpreterShowcase";
import { BookingSection } from "@/components/interpreting/BookingSection";
import { MobileStickyActions } from "@/components/layout/MobileStickyActions";
import { SEED_IMAGES } from "@/lib/seed-images";
import { placeholderFor } from "@/lib/placeholders";
import { PastoralPageMotion } from "@/components/ui/PastoralPageMotion";
import { formatCurrency } from "@/lib/region-currency";
import { usePreviewBridge } from "@/lib/preview";

interface InterpretingPageClientProps {
  initialInterpretingData: InterpretingData | null;
}

export default function InterpretingPageClient({
  initialInterpretingData,
}: InterpretingPageClientProps) {
  const { t } = useLocale();
  const { previewData: previewService } =
    usePreviewBridge<ApiInterpretingMode>("service");
  const { previewData: previewInterpreter } =
    usePreviewBridge<ApiInterpreterProfile>("interpreter");
  const { previewData: previewFaq } =
    usePreviewBridge<ApiInterpretingFaq>("faq");

  const {
    data: interpretingData,
    loading,
    error,
    refetch,
  } = useApiQuery(() => fetchInterpreting(), [], {
    initialData: initialInterpretingData,
    revalidateOnMount: false,
  });

  const [prefillNeeds, setPrefillNeeds] = useState<string | undefined>(
    undefined,
  );
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  const handleSelectGuide = useCallback((needsText: string) => {
    setPrefillNeeds(needsText);
  }, []);

  const baseInterpretingData = useMemo(() => interpretingData ?? initialInterpretingData ?? {
    serviceModes: [], profiles: [], faqs: [], packages: [],
  }, [interpretingData, initialInterpretingData]);
  const effectiveInterpretingData = useMemo<InterpretingData>(() => {
    const prependPreview = <T extends { id: string }>(
      preview: T | null,
      items: T[],
    ) =>
      preview
        ? [preview, ...items.filter((item) => item.id !== preview.id)]
        : items;

    return {
      packages: baseInterpretingData.packages ?? [],
      serviceModes: prependPreview(
        previewService,
        baseInterpretingData.serviceModes,
      ),
      profiles: prependPreview(
        previewInterpreter,
        baseInterpretingData.profiles,
      ),
      faqs: prependPreview(previewFaq, baseInterpretingData.faqs),
    };
  }, [
    baseInterpretingData,
    previewFaq,
    previewInterpreter,
    previewService,
  ]);

  const showcaseProfiles = useMemo<InterpreterProfile[]>(() => {
    const profiles = effectiveInterpretingData.profiles ?? [];
    return profiles.map((profile) => {
      const profileAvatar =
        "avatar" in profile && typeof profile.avatar === "string"
          ? profile.avatar
          : undefined;
      return {
        id: profile.id,
        level: "",
        levelZh: "",
        name: profile.name,
        specialty: profile.focus,
        languages: profile.language,
        image: profileAvatar || placeholderFor("portrait"),
        needsPrefill: profile.focus,
        bestFor: profile.helps?.join(" / "),
      };
    });
  }, [
    effectiveInterpretingData.profiles,
  ]);

  const hasRestoredBookingHash = useRef(false);
  const bookingHashRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (
      hasRestoredBookingHash.current ||
      window.location.hash !== "#interpreting-booking"
    ) {
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Wait until the anchor stops moving (images, fonts, late layout)
    // before scrolling, so the scroll is not interrupted mid-flight.
    const settleAndScroll = () => {
      const bookingSection = document.getElementById("interpreting-booking");
      if (!bookingSection) return;

      let lastTop = bookingSection.getBoundingClientRect().top;
      let settledFrames = 0;
      let elapsedFrames = 0;

      const settle = () => {
        const top = bookingSection.getBoundingClientRect().top;
        elapsedFrames += 1;
        if (Math.abs(top - lastTop) < 1) {
          settledFrames += 1;
        } else {
          settledFrames = 0;
          lastTop = top;
        }

        if (settledFrames >= 4 || elapsedFrames >= 240) {
          bookingSection.scrollIntoView({
            behavior: reduceMotion ? "auto" : "smooth",
            block: "start",
          });
          hasRestoredBookingHash.current = true;
          return;
        }
        bookingHashRafRef.current = window.requestAnimationFrame(settle);
      };

      bookingHashRafRef.current = window.requestAnimationFrame(settle);
    };

    const frame = window.requestAnimationFrame(settleAndScroll);
    bookingHashRafRef.current = frame;

    return () => {
      if (bookingHashRafRef.current !== null) {
        window.cancelAnimationFrame(bookingHashRafRef.current);
        bookingHashRafRef.current = null;
      }
    };
  }, [
    loading,
    effectiveInterpretingData.faqs.length,
    effectiveInterpretingData.profiles.length,
    effectiveInterpretingData.serviceModes.length,
  ]);

  if (loading && !initialInterpretingData) {
    return <LoadingSpinner text="Loading interpretation services…" />;
  }

  if (error && !initialInterpretingData) {
    return (
      <ErrorState
        title="Interpretation unavailable"
        message="Please try again."
        onRetry={refetch}
      />
    );
  }

  const packages = effectiveInterpretingData.packages ?? [];
  const cinematicImage =
    SEED_IMAGES.interpretingShowcase ?? placeholderFor("portrait");

  return (
    <PastoralPageMotion
      className="min-h-screen bg-[var(--paper-deep)] bg-grain text-[var(--river-deep)]"
      motionKey={`${packages.map((item) => item.id).join("|")}:${showcaseProfiles
        .map((profile) => profile.id)
        .join("|")}`}
    >
      <section className="relative overflow-hidden pb-16 pt-14 sm:pb-20 sm:pt-16 lg:min-h-[calc(100dvh-var(--site-header-height))] lg:pb-20 lg:pt-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(185,138,70,0.1),transparent_40%)]" />

        <div className="site-container relative w-full">
          <div className="grid grid-cols-1 items-start gap-8 sm:grid-cols-[minmax(0,1.35fr)_minmax(12rem,0.75fr)] sm:items-center sm:gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="min-w-0 max-w-4xl lg:col-span-7">
              <Reveal>
                <h1 className="mb-6 font-[family:var(--font-display)] text-[clamp(1.8rem,7vw,6rem)] leading-[0.94] tracking-[-0.04em] text-[var(--river-deep)] sm:mb-8">
                  <span className="block overflow-hidden pb-1"><span data-pastoral-title className="block">{t("interpreting.atlas.titlePrimary")}</span></span>
                  <span className="block overflow-hidden pb-3"><span data-pastoral-title className="block italic text-[var(--gold)]">{t("interpreting.atlas.titleItalic")}</span></span>
                </h1>

                <div className="grid grid-cols-1 items-end gap-5 border-t border-[var(--line)] pt-5 sm:gap-6 lg:gap-8 lg:pt-7">


                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3 lg:gap-4">
                    <a
                      href="#interpreting-booking"
                      className="btn-primary inline-flex w-full items-center justify-center px-6 py-4 text-xs leading-none active:scale-95 sm:w-auto sm:px-10 sm:py-5"
                    >
                      {"Book interpretation"}
                    </a>
                    <a
                      href="#service-types"
                      className="btn-paper inline-flex w-full items-center justify-center px-6 py-4 text-xs leading-none sm:w-auto sm:px-10 sm:py-5"
                    >
                      {"View packages"}
                    </a>
                  </div>
                </div>
              </Reveal>
            </div>

            <div className="w-full min-w-0 self-center lg:col-span-5 lg:max-w-none">
              <Reveal delay={240} className="w-full sm:justify-self-end">
                <div className="relative mx-auto aspect-[3/4] w-full max-w-[20rem] overflow-hidden rotate-[1.5deg] border-[0.35rem] border-white scrapbook-shadow sm:mx-0 sm:aspect-[4/5] sm:max-w-[28rem] sm:border-[0.75rem] lg:max-w-[30rem] lg:border-[0.9rem]">
                  <div
                    data-pastoral-hero-media
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 motion-safe:hover:scale-[1.03]"
                    style={{ backgroundImage: `url(${cinematicImage})` }}
                  />
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <section id="service-types" className="site-container scroll-mt-24 py-beat">
        <span id="interpreting-pricing" className="scroll-mt-24" />
        <h2 className="mb-8 font-[family:var(--font-display)] text-3xl text-[var(--river-deep)] sm:text-4xl">
          Interpretation Packages
        </h2>
        {packages.length ? (
          <div className="overflow-x-auto border border-[var(--line)] bg-white">
            <table className="w-full text-left text-sm sm:text-base">
              <caption className="sr-only">Interpretation package prices in US dollars</caption>
              <thead className="border-b border-[var(--line)]">
                <tr>
                  <th scope="col" className="p-4 sm:p-6">Duration</th>
                  <th scope="col" className="p-4 sm:p-6">Fixed route</th>
                  <th scope="col" className="p-4 sm:p-6">Custom route</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(new Set(packages.map((item) => item.hours))).map((hours) => (
                  <tr key={hours} className="border-b border-[var(--line)] last:border-0">
                    <th scope="row" className="p-4 font-medium sm:p-6">{hours} hours</th>
                    {(["fixed", "custom"] as const).map((routeType) => {
                      const item = packages.find((entry) => entry.hours === hours && entry.routeType === routeType);
                      return <td key={routeType} className="whitespace-nowrap p-4 sm:p-6">{item ? formatCurrency(item.priceCents / 100, item.currency) : "Unavailable"}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p role="status">Package prices are unavailable. Please try again.</p>}
      </section>

      {showcaseProfiles.length ? (
        <InterpreterShowcase
          profiles={showcaseProfiles}
          onSelectGuide={handleSelectGuide}
        />
      ) : null}

      <div className="flex flex-col">
      {effectiveInterpretingData.faqs.length ? (
        <section id="interpreting-faq" className="site-container order-2 scroll-mt-24 pb-24 lg:pb-32">
          <div className="grid gap-10 border-t border-[var(--line)] pt-12 lg:grid-cols-[minmax(14rem,0.7fr)_minmax(0,1.3fr)] lg:gap-16">
            <Reveal>
              <div className="lg:sticky lg:top-28">
                <h2 className="max-w-[9ch] font-[family:var(--font-display)] text-4xl leading-[0.98] tracking-[-0.03em] text-[var(--river-deep)] sm:text-5xl">
                  {"FAQs"}
                </h2>
              </div>
            </Reveal>

            <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {effectiveInterpretingData.faqs.map((faq, index) => {
                const isOpen = openFaqId === faq.id;
                return (
                  <Reveal key={faq.id} delay={Math.min(index * 55, 220)}>
                    <article>
                      <h3>
                        <button
                          type="button"
                          className="flex w-full items-start justify-between gap-6 py-6 text-left sm:py-7"
                          aria-expanded={isOpen}
                          aria-controls={`faq-answer-${faq.id}`}
                          onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                        >
                          <span className="font-[family:var(--font-display)] text-xl leading-snug text-[var(--river-deep)] sm:text-2xl">
                            {faq.question}
                          </span>
                          <span
                            aria-hidden="true"
                            className={`mt-1 grid h-8 w-8 shrink-0 place-items-center border border-[var(--line)] text-lg text-[var(--cinnabar)] transition-transform duration-300 ${
                              isOpen ? "rotate-45" : ""
                            }`}
                          >
                            +
                          </span>
                        </button>
                      </h3>
                      <div
                        id={`faq-answer-${faq.id}`}
                        className={`grid transition-[grid-template-rows,opacity] duration-300 ${
                          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                        }`}
                      >
                        <div className="overflow-hidden">
                          <p className="max-w-2xl pb-7 pr-10 handwritten text-sm leading-7 text-[var(--muted)] sm:text-base">
                            {faq.answer}
                          </p>
                        </div>
                      </div>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <BookingSection prefillNeeds={prefillNeeds} packages={packages} />
      </div>

      <MobileStickyActions
        actions={[
          {
            label: "Book",
            href: "#interpreting-booking",
            variant: "primary",
          },
          {
            label: "Packages",
            href: "#interpreting-pricing",
            variant: "secondary",
          },
        ]}
      />
    </PastoralPageMotion>
  );
}
