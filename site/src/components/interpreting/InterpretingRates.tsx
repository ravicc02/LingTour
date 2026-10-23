"use client";

import { useLocale } from "@/lib/locale-context";
import { Reveal } from "@/components/ui/Reveal";

// Service reference rates; bookable package totals come from the API.
const referenceRates = [
  { service: "city", icon: "CITY", note: "halfDay", values: ["$680", "$980", "$1,480"] },
  { service: "route", icon: "ROUTE", note: "fullDay", values: ["$980", "$1,280", "$1,880"] },
  { service: "group", icon: "GROUP", note: "byGroup", values: ["—", "$1,680", "$2,680+"] },
] as const;

export function InterpretingRates() {
  const { t } = useLocale();

  return (
    <section id="interpreting-pricing" aria-labelledby="interpreting-rates-title" className="site-container scroll-mt-24 pb-16 pt-8 sm:pb-20 sm:pt-12">
      <Reveal>
        <div className="mb-6 border-b border-[var(--line)] pb-6">
          <h2 id="interpreting-rates-title" className="font-[family:var(--font-display)] text-3xl leading-[0.98] tracking-[-0.03em] text-[var(--river-deep)] sm:text-4xl">
            Rates
          </h2>
          <p id="interpreting-rates-note" className="mt-4 text-sm leading-relaxed text-[var(--muted)]">Reference rates in US dollars.</p>
        </div>
        <div data-rates-scroll role="region" aria-label="Rates comparison" tabIndex={0} className="-mx-4 overflow-x-auto px-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--cinnabar)] sm:mx-0 sm:px-0">
          <table data-polish-table aria-describedby="interpreting-rates-note" className="w-full min-w-[40rem] table-fixed border-separate border-spacing-x-0 border-spacing-y-4 text-left">
            <caption className="sr-only">Interpretation reference rates in US dollars by service and interpreter level</caption>
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
                <th scope="col" className="w-[30%] px-5 pb-4 sm:px-6">Service</th>
                {["junior", "mid", "senior"].map((level) => (
                  <th key={level} scope="col" className="px-3 pb-4 text-center">{t(`interpreting.levels.${level}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {referenceRates.map((row) => (
                <tr key={row.service} data-reference-service={row.service} className="bg-white/90">
                  <th scope="row" className="border-y border-l border-[var(--line)] p-5 font-normal sm:p-6">
                    <div className="flex items-center gap-4">
                      <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center border border-[var(--gold)]/35 bg-[var(--paper)] text-[11px] font-bold tracking-wider text-[var(--gold)]">{row.icon}</span>
                      <span>
                        <span className="block font-[family:var(--font-display)] text-2xl leading-none text-[var(--river-deep)]">{t(`interpreting.pricing.${row.service}`)}</span>
                        <span className="mt-2 block text-xs leading-5 text-[var(--muted)]">{t(`interpreting.pricing.${row.note}`)}</span>
                      </span>
                    </div>
                  </th>
                  {row.values.map((value, index) => (
                    <td key={index} className="border-y border-l border-[var(--line)] px-3 py-6 text-center font-[family:var(--font-display)] text-2xl tabular-nums text-[var(--river-deep)] last:border-r sm:text-3xl">{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </section>
  );
}
