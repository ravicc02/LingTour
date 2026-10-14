"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { fetchInterpreting, type ApiInterpretingFaq, type ApiInterpretingMode, type ApiInterpreterProfile, type InterpretingData } from "@/lib/api-data";
import { useApiQuery, LoadingSpinner, ErrorState } from "@/lib/use-api-query";
import { Reveal } from "@/components/ui/Reveal";
import { InterpreterShowcase, type InterpreterProfile } from "@/components/interpreting/InterpreterShowcase";
import { BookingSection } from "@/components/interpreting/BookingSection";
import { MobileStickyActions } from "@/components/layout/MobileStickyActions";
import { SEED_IMAGES } from "@/lib/seed-images";
import { placeholderFor } from "@/lib/placeholders";
import { PastoralPageMotion } from "@/components/ui/PastoralPageMotion";
import { usePreviewBridge } from "@/lib/preview";
import { fetchServicePackages, type ServicePackage } from "@/lib/service-requests";
import { formatCurrency } from "@/lib/region-currency";

const serviceImagePool = [SEED_IMAGES.interpretingHero, SEED_IMAGES.interpretingShowcase, SEED_IMAGES.ambientLandscape];
export default function InterpretingPageClient({ initialInterpretingData }: { initialInterpretingData: InterpretingData | null }) {
  const { t } = useLocale();
  const { previewData: previewService } = usePreviewBridge<ApiInterpretingMode>("service");
  const { previewData: previewInterpreter } = usePreviewBridge<ApiInterpreterProfile>("interpreter");
  const { previewData: previewFaq } = usePreviewBridge<ApiInterpretingFaq>("faq");
  const { data, loading, error, refetch } = useApiQuery(() => fetchInterpreting(), [], { initialData: initialInterpretingData, revalidateOnMount: false });
  const [preferredInterpreterId, setPreferredInterpreterId] = useState<string>();
  const [prefillNeeds, setPrefillNeeds] = useState<string>();
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [packageError, setPackageError] = useState("");
  const [packageLoading, setPackageLoading] = useState(true);
  const [packageReload, setPackageReload] = useState(0);
  useEffect(() => {
    let active = true;
    setPackageLoading(true); setPackageError("");
    fetchServicePackages().then((result) => { if (active) setPackages(result.packages.filter((item) => item.enabled && item.currency === "USD")); }).catch(() => { if (active) setPackageError("Packages are unavailable. Please retry before choosing a service."); }).finally(() => { if (active) setPackageLoading(false); });
    return () => { active = false; };
  }, [packageReload]);
  const selectGuide = useCallback((profile: InterpreterProfile) => { setPreferredInterpreterId(profile.id); setPrefillNeeds(profile.needsPrefill); }, []);
  const effective = useMemo(() => {
    const base = data ?? initialInterpretingData ?? { serviceModes: [], profiles: [], faqs: [] };
    const prepend = <T extends { id: string }>(preview: T | null, items: T[]) => preview ? [preview, ...items.filter((item) => item.id !== preview.id)] : items;
    return { serviceModes: prepend(previewService, base.serviceModes), profiles: prepend(previewInterpreter, base.profiles), faqs: prepend(previewFaq, base.faqs) };
  }, [data, initialInterpretingData, previewService, previewInterpreter, previewFaq]);
  const profiles = useMemo<InterpreterProfile[]>(() => effective.profiles.map((profile) => ({
    id: profile.id, name: profile.name, specialty: profile.focus, languages: profile.language,
    image: profile.avatar || placeholderFor("portrait"), needsPrefill: profile.focus, bestFor: profile.helps?.join(" / "),
  })), [effective.profiles]);
  useEffect(() => {
    if (window.location.hash !== "#interpreting-booking") return;
    const frame = requestAnimationFrame(() => document.getElementById("interpreting-booking")?.scrollIntoView({ block: "start", behavior: "auto" }));
    return () => cancelAnimationFrame(frame);
  }, [loading]);
  if (loading && !initialInterpretingData) return <LoadingSpinner text="Loading interpretation services..." />;
  if (error && !initialInterpretingData) return <ErrorState title="Interpretation unavailable" message="We cannot load the catalogue. Please retry." onRetry={refetch} />;
  return <PastoralPageMotion className="min-h-screen bg-[var(--paper-deep)] bg-grain text-[var(--river-deep)]" motionKey={profiles.map((profile) => profile.id).join("|")}>
    <section className="relative overflow-hidden pb-16 pt-14 sm:pb-20 sm:pt-16 lg:min-h-[calc(100dvh-var(--site-header-height))] lg:pb-20 lg:pt-20">
      <div className="site-container relative w-full"><div className="grid grid-cols-1 items-start gap-8 sm:grid-cols-[minmax(0,1.35fr)_minmax(12rem,0.75fr)] sm:items-center sm:gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="min-w-0 max-w-4xl lg:col-span-7"><Reveal>
          <h1 className="mb-6 font-[family:var(--font-display)] text-[clamp(1.8rem,7vw,6rem)] leading-[1.05] tracking-[-0.04em] text-[var(--river-deep)] sm:mb-8"><span className="block overflow-hidden pb-1"><span data-pastoral-title className="block">{t("interpreting.atlas.titlePrimary")}</span></span><span className="block overflow-hidden pb-3"><span data-pastoral-title className="block italic text-[var(--gold)]">{t("interpreting.atlas.titleItalic")}</span></span></h1>
          <p data-pastoral-subtitle className="max-w-[34rem] text-base leading-7 text-[var(--river-deep)]/85">{t("interpreting.hero.subtitle")}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><a href="#interpreting-booking" className="btn-primary inline-flex min-h-11 items-center justify-center">Request interpretation</a><a href="#interpreting-pricing" className="btn-paper inline-flex min-h-11 items-center justify-center">View packages</a></div>
        </Reveal></div>
        <div className="w-full min-w-0 self-center lg:col-span-5"><Reveal delay={240}><div className="relative mx-auto aspect-[3/4] w-full max-w-[20rem] overflow-hidden rotate-[1.5deg] border-[0.35rem] border-white scrapbook-shadow sm:mx-0 sm:aspect-[4/5] sm:max-w-[28rem] sm:border-[0.75rem] lg:max-w-[30rem] lg:border-[0.9rem]"><div data-pastoral-hero-media className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${SEED_IMAGES.interpretingShowcase ?? placeholderFor("portrait")})` }} /></div></Reveal></div>
      </div></div>
    </section>
    {effective.serviceModes.length ? <section id="service-types" className="site-container py-beat"><h2 className="font-[family:var(--font-display)] text-3xl sm:text-4xl">{t("interpreting.atlas.chooseShape")}</h2>
      <div className="scroll-fade-x-lg scrollbar-hide -mx-4 mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-8 lg:overflow-visible lg:px-0">{effective.serviceModes.map((mode, index) => <Reveal key={mode.id} delay={index * 100} className="h-full w-[82vw] max-w-[24rem] shrink-0 snap-start lg:w-auto lg:max-w-none lg:shrink"><article className="flex h-full flex-col border border-[var(--line)] bg-white p-6 sm:p-8">
        <img src={serviceImagePool[index % serviceImagePool.length]} alt="" className="mb-6 aspect-[16/10] w-full object-cover" />
        <h3 className="font-[family:var(--font-display)] text-3xl leading-tight">{mode.title}</h3><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{mode.bestFor}</p><p className="mt-5 text-base leading-7 text-[var(--muted)]">{mode.body}</p>
        {mode.includes?.length ? <ul className="mt-6 space-y-2 text-sm leading-6">{mode.includes.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      </article></Reveal>)}</div>
    </section> : null}
    {profiles.length ? <InterpreterShowcase profiles={profiles} onSelectGuide={selectGuide} /> : null}
    <section id="interpreting-pricing" className="site-container scroll-mt-24 py-16 pb-28 lg:py-24 lg:pb-32">
      <h2 className="mb-6 font-[family:var(--font-display)] text-4xl sm:text-5xl">Interpretation Packages</h2>
      <p className="mb-8 max-w-2xl text-base leading-7 text-[var(--muted)]">Fixed USD prices, independent of your location. Interpretation does not include custom-route planning fees or third-party travel costs.</p>
      {packageLoading ? <p role="status">Loading packages...</p> : packageError ? <div role="alert"><p>{packageError}</p><button type="button" onClick={() => setPackageReload((value) => value + 1)} className="btn-outline mt-4 min-h-11">Retry packages</button></div> : !packages.length ? <p>No packages are currently available.</p> : <div className="grid gap-8 md:grid-cols-2">{(["fixed", "custom"] as const).map((type) => <div key={type} className="border border-[var(--line)] bg-white/88 p-5 sm:p-8"><h3 className="font-[family:var(--font-display)] text-2xl">{type === "fixed" ? "Fixed-route interpretation" : "Custom-route interpretation"}</h3><dl className="mt-5 space-y-4">{packages.filter((pkg) => pkg.routeType === type).sort((a, b) => a.hours - b.hours).map((pkg) => <div key={pkg.id} className="flex flex-wrap items-baseline justify-between gap-3"><dt className="text-base">{pkg.hours} hours</dt><dd className="font-[family:var(--font-display)] text-2xl">{formatCurrency(pkg.amountCents / 100, "USD")}</dd></div>)}</dl></div>)}</div>}
      <p className="mt-6 text-sm leading-6 text-[var(--muted)]">Payment policy pending. No deposit amount is assumed and new checkout is not available.</p>
    </section>
    <BookingSection preferredInterpreterId={preferredInterpreterId} prefillNeeds={prefillNeeds} />
    {effective.faqs.length ? <section id="interpreting-faq" className="site-container scroll-mt-24 pb-24 lg:pb-32"><div className="grid gap-10 border-t border-[var(--line)] pt-12 lg:grid-cols-[minmax(14rem,0.7fr)_minmax(0,1.3fr)] lg:gap-16"><h2 className="font-[family:var(--font-display)] text-4xl sm:text-5xl">Q&amp;A</h2><div className="divide-y divide-[var(--line)]">{effective.faqs.map((faq) => <article key={faq.id}><h3><button type="button" aria-expanded={openFaqId === faq.id} aria-controls={`faq-answer-${faq.id}`} onClick={() => setOpenFaqId(openFaqId === faq.id ? null : faq.id)} className="flex min-h-11 w-full items-start justify-between gap-6 py-6 text-left"><span className="font-[family:var(--font-display)] text-xl sm:text-2xl">{faq.question}</span><span aria-hidden>{openFaqId === faq.id ? "-" : "+"}</span></button></h3><div id={`faq-answer-${faq.id}`} hidden={openFaqId !== faq.id}><p className="pb-7 text-base leading-7 text-[var(--muted)]">{faq.answer}</p></div></article>)}</div></div></section> : null}
    <MobileStickyActions actions={[{ label: "Request", href: "#interpreting-booking", variant: "primary" }, { label: "Packages", href: "#interpreting-pricing", variant: "secondary" }]} />
  </PastoralPageMotion>;
}
