"use client";

import type { ApiInterpretingMode } from "@/lib/api-data";
import { formatInterpretingPrice } from "@/lib/interpreting-price";
import { useLocale } from "@/lib/locale-context";
import { Reveal } from "@/components/ui/Reveal";

type Props = {
  services: ApiInterpretingMode[];
  onSelectSupport: (title: string) => void;
};

export function ServiceSupportSection({ services, onSelectSupport }: Props) {
  const { t } = useLocale();

  return (
    <section id="interpreting-support" aria-labelledby="interpreting-support-title" className="site-container scroll-mt-24 pb-12 pt-4 sm:pb-16 sm:pt-6">
      <span id="service-types" aria-hidden="true" className="block scroll-mt-24" />
      <Reveal>
        <h2 id="interpreting-support-title" className="mb-8 font-[family:var(--font-display)] text-3xl leading-[1.05] tracking-[-0.02em] text-[var(--river-deep)] sm:text-4xl">
          {t("interpreting.atlas.chooseShape")}
        </h2>
      </Reveal>
      {services.length ? (
        <div data-support-cards className="scroll-fade-x-lg scrollbar-hide -mx-4 flex snap-x snap-mandatory items-stretch gap-6 overflow-x-auto px-4 pb-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-8 lg:overflow-visible lg:px-0">
          {services.map((service, index) => (
            <Reveal key={service.id} delay={index * 100} className="w-[82vw] max-w-[24rem] shrink-0 snap-start lg:w-auto lg:max-w-none lg:shrink lg:snap-none">
              <article data-polish-card="support" data-support-service={service.id} className={`relative flex h-full flex-col border border-[var(--line)] bg-white p-6 scrapbook-shadow sm:p-8 ${index % 2 === 0 ? "lg:rotate-1" : "lg:-rotate-1"}`}>
                <span aria-hidden="true" className="pointer-events-none absolute right-6 top-4 select-none font-[family:var(--font-display)] text-8xl text-[var(--gold)]/10">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="relative mb-6 border-b border-[var(--line)] pb-6">
                  <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--cinnabar)]">
                    {t("interpreting.atlas.from")}
                  </p>
                  <p data-support-price className="mt-2 font-[family:var(--font-display)] text-3xl leading-tight text-[var(--river-deep)] sm:text-4xl">
                    {formatInterpretingPrice(service.price)}
                  </p>
                </div>
                <div className="relative flex-1">
                  <h3 className="mb-3 font-[family:var(--font-display)] text-2xl leading-tight text-[var(--river-deep)] sm:text-3xl">
                    {service.title}
                  </h3>
                  {service.bestFor ? (
                    <p className="mb-5 text-xs font-bold uppercase italic leading-relaxed tracking-wider text-[var(--gold)]">
                      {service.bestFor}
                    </p>
                  ) : null}
                  <p className="handwritten mb-7 text-sm leading-relaxed text-[var(--muted)]">{service.body}</p>
                </div>
                <div className="relative">
                  {service.includes.length ? (
                    <>
                      <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                        {t("interpreting.atlas.includes")}
                      </p>
                      <ul className="flex flex-wrap gap-2">
                        {service.includes.map((item, itemIndex) => (
                          <li key={`${itemIndex}-${item}`} className="border border-[var(--line)] bg-[var(--paper-deep)]/30 px-3 py-1.5 text-[11px] font-bold uppercase leading-relaxed text-[var(--river-deep)]">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  <a href="#interpreting-booking" aria-label={`Request support: ${service.title}`} onClick={() => onSelectSupport(service.title)} className="btn-outline mt-6 flex min-h-11 w-full items-center justify-center py-4 text-center text-[12px] leading-none">
                    Request support
                  </a>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      ) : (
        <p role="status" className="border-y border-[var(--line)] py-6 text-[var(--muted)]">
          Service options are unavailable. Please try again later.
        </p>
      )}
    </section>
  );
}
