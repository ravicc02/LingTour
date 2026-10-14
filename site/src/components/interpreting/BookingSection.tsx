"use client";

import { useCallback, useState } from "react";
import { MultiStepForm, type RequestFormState } from "@/components/interpreting/MultiStepForm";
import { serviceTypeLabels, type ServiceType } from "@/lib/service-requests";

type Props = { prefillNeeds?: string; preferredInterpreterId?: string; serviceType?: ServiceType; anchorId?: string };
const steps = [
  { title: "Trip details", body: "City, date and group" },
  { title: "Requirements", body: "Route, package and preferences" },
  { title: "Contact & review", body: "Contact details and request summary" },
];
export function BookingSection({ prefillNeeds, preferredInterpreterId, serviceType = "interpretation", anchorId = "interpreting-booking" }: Props) {
  const [bookingStep, setBookingStep] = useState(0);
  const [form, setForm] = useState<RequestFormState | null>(null);
  const handleState = useCallback((state: RequestFormState) => setForm(state), []);
  const handleStep = useCallback((step: number) => setBookingStep(step), []);
  return <section id={anchorId} className="site-container order-1 scroll-mt-24 pb-28 md:pb-20 lg:pb-28">
    <div className="mb-10 border-b border-[var(--line)] pb-8 lg:mb-14">
      <h2 className="font-[family:var(--font-display)] text-4xl leading-[1.05] tracking-[-0.03em] text-[var(--river-deep)] sm:text-5xl">{serviceTypeLabels[form?.serviceType ?? serviceType]}</h2>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">Share your trip and requirements. Follow confirmations, quotes and private messages in Profile.</p>
    </div>
    <div className="relative border-y border-[var(--line)] bg-[var(--paper)]/62 py-6 sm:p-6 lg:p-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(15rem,0.66fr)_minmax(0,1.34fr)] lg:gap-10 xl:gap-14">
        <aside className="min-w-0 lg:border-r lg:border-[var(--line)] lg:pr-10">
          <p className="text-sm font-semibold text-[var(--river-deep)]">Request summary</p>
          <p className="mt-5 break-words border-y border-[var(--line)] py-4 text-sm leading-7 text-[var(--muted)]">{form?.citySlug || "City pending"} / {form?.date || "Date pending"}</p>
          <nav aria-label="Request steps" className="mt-6 grid grid-cols-3 gap-1 lg:block lg:space-y-1">
            {steps.map((item, index) => <button key={item.title} type="button" onClick={() => setBookingStep(index)} disabled={index > bookingStep} aria-current={bookingStep === index ? "step" : undefined} className={`flex min-h-14 min-w-0 flex-col justify-center border-b px-1.5 py-3 text-center lg:w-full lg:items-start lg:px-4 lg:py-4 lg:text-left ${bookingStep === index ? "border-[var(--cinnabar)] bg-white/80" : "border-transparent disabled:opacity-50"}`}><span className="text-sm font-semibold leading-5 text-[var(--river-deep)] lg:font-[family:var(--font-display)] lg:text-xl lg:font-normal">{item.title}</span><span className="mt-2 hidden text-sm leading-5 text-[var(--muted)] lg:block">{item.body}</span></button>)}
          </nav>
        </aside>
        <div className="min-w-0"><MultiStepForm serviceType={serviceType} prefillNeeds={prefillNeeds} preferredInterpreterId={preferredInterpreterId} requestedStep={bookingStep} onStepChange={handleStep} onStateChange={handleState} /></div>
      </div>
    </div>
  </section>;
}
