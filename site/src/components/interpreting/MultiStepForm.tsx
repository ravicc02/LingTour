"use client";

import { memo, useEffect, useRef, useState } from "react";

import {
  createInterpretingDepositCheckout,
  fetchCities,
  type InterpretingDepositCheckout,
} from "@/lib/api-data";
import { getCalendarDateKey, getLocalDateKey } from "@/lib/calendar-date";
import { formatCurrency } from "@/lib/region-currency";
import { useLocale } from "@/lib/locale-context";

type FormData = {
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
  prefillCity?: string;
  requestedStep?: number;
  onStateChange?: (state: FormData) => void;
  onStepChange?: (step: number, fastTrack: boolean) => void;
  onFastTrackChange?: (fastTrack: boolean) => void;
};

const serviceModes = [
  { value: "City companion support", labelKey: "interpreting.flow.mode.city" },
  { value: "Story-led route support", labelKey: "interpreting.flow.mode.route" },
  { value: "Group or study visit support", labelKey: "interpreting.flow.mode.group" },
];

const inputClass =
  "min-h-[54px] rounded-sm border border-[var(--line)] bg-white px-4 py-3.5 text-base leading-6 text-[var(--ink)] outline-none transition focus:border-[var(--gold)] focus:bg-[var(--paper)] md:text-[15px]";

function MultiStepFormInner({
  prefillNeeds,
  prefillCity,
  requestedStep,
  onStateChange,
  onStepChange,
  onFastTrackChange,
}: Props) {
  const { t } = useLocale();
  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const [cities, setCities] = useState<string[]>(["Zhanjiang"]);
  const [step, setStep] = useState(0);
  const [fastTrack, setFastTrack] = useState(false);
  const [form, setForm] = useState<FormData>({
    name: "",
    contact: "",
    city: "Zhanjiang",
    date: "",
    mode: "Story-led route support",
    groupSize: "",
    needs: "",
  });
  const [depositSession, setDepositSession] = useState<InterpretingDepositCheckout | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const calendarRef = useRef<HTMLDivElement | null>(null);
  const calendarTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    fetchCities()
      .then((data) => setCities(data.map((c) => c.name)))
      .catch(() => {
        // Keep the fallback city list when the request fails.
      });
  }, []);

  const update = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    if (prefillNeeds) {
      update("needs", prefillNeeds);
    }
    if (prefillCity) {
      update("city", prefillCity);
    }
  }, [prefillNeeds, prefillCity]);

  useEffect(() => {
    if (!showCalendar) return;
    const handler = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setShowCalendar(false);
      calendarTriggerRef.current?.focus();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showCalendar]);

  useEffect(() => {
    onStateChange?.(form);
  }, [form, onStateChange]);

  useEffect(() => {
    if (typeof requestedStep !== "number") return;
    const maxStep = fastTrack ? 1 : depositSession ? 3 : 2;
    const clamped = Math.max(0, Math.min(maxStep, requestedStep));
    if (clamped !== step) {
      setStep(clamped);
    }
  }, [depositSession, fastTrack, requestedStep, step]);

  const totalSteps = fastTrack ? 2 : 4;
  const canNext = (): boolean => {
    if (fastTrack) {
      return !!form.name && !!form.contact && !!form.city;
    }
    if (step === 0) return !!form.name && !!form.contact && !!form.city && !!form.date;
    if (step === 1) return !!form.mode && !!form.groupSize && !!form.needs;
    return true;
  };

  const canOpenDeposit = fastTrack ? canNext() : step === 2;
  const completionHint = (() => {
    if (canNext()) return null;
    if (fastTrack) {
      return "Add your name and contact details to continue.";
    }
    if (step === 0) {
      return "Add your name, contact details, and service date to continue.";
    }
    if (step === 1) {
      return "Add your group size and what you need to continue.";
    }
    return null;
  })();

  const openDepositCheckout = async () => {
    if (!canOpenDeposit || submitting) return;

    setSubmitting(true);
    setErrorMessage("");

    try {
      const payload = {
        name: form.name,
        contact: form.contact,
        city: form.city,
        serviceDate: form.date || getLocalDateKey(),
        supportMode: form.mode || "City companion support",
        groupSize: form.groupSize || undefined,
        routeOrNeed: form.needs || undefined,
        fastTrack,
      };

      const idempotencyKey =
        idempotencyKeyRef.current ??
        (idempotencyKeyRef.current =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const session = await createInterpretingDepositCheckout(payload, idempotencyKey);
      setDepositSession(session);
      setStep(fastTrack ? 1 : 3);
      onStepChange?.(fastTrack ? 1 : 3, fastTrack);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not create the deposit checkout right now.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const handleCalendarSelect = (day: number) => {
    update(
      "date",
      getCalendarDateKey(calendarMonth.getFullYear(), calendarMonth.getMonth(), day),
    );
    setShowCalendar(false);
  };

  const formatDate = (iso: string) => {
    if (!iso) return "";
    const d = new Date(`${iso}T00:00:00`);
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  };

  const modeLabel = (value: string) =>
    t(serviceModes.find((mode) => mode.value === value)?.labelKey ?? "interpreting.flow.mode.route");

  return (
    <div className="overflow-visible border-y border-[var(--line)] bg-white/92 sm:border-x">
      <div className="border-b border-[var(--line)] bg-[rgba(248,244,236,0.48)] px-5 py-4 sm:px-7">
        <label className="flex min-h-11 cursor-pointer items-start gap-3 border-l-2 border-transparent bg-white/62 px-3 py-3 transition-colors hover:border-[var(--gold)] sm:items-center sm:px-4">
          <input
            type="checkbox"
            checked={fastTrack}
            onChange={(e) => {
              const checked = e.target.checked;
              setFastTrack(checked);
              setStep(0);
              onFastTrackChange?.(checked);
              onStepChange?.(0, checked);
            }}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--cinnabar)] sm:mt-0"
          />
          <span className="min-w-0 sm:flex sm:items-baseline sm:gap-2">
            <span className="block text-[15px] font-medium leading-5 text-[var(--ink)]">{t("interpreting.flow.fastTrack")}</span>
            <span className="mt-0.5 block text-[12px] leading-5 text-[var(--muted)] sm:mt-0 sm:text-[13px]">{t("interpreting.flow.fastTrackHint")}</span>
          </span>
        </label>
      </div>

      <div className="border-b border-[var(--line)] bg-[rgba(248,244,236,0.48)] px-5 py-4 sm:px-7">
        <div className="flex items-center justify-end">
          <p className="text-label text-[var(--gold)]">
            {t("interpreting.flow.step")
              .replace("{current}", String(step + 1))
              .replace("{total}", String(totalSteps))}
          </p>
        </div>
        <div
          className="mt-3 flex h-1.5 gap-1.5"
          role="progressbar"
          aria-label={t("interpreting.flow.progress")}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-valuenow={step + 1}
        >
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className={`flex-1 rounded-full ${i <= step ? "bg-[var(--gold)]" : "bg-[var(--line)]"}`}
            />
          ))}
        </div>
      </div>

      <div className="px-5 py-6 sm:px-7 sm:py-8">
        {errorMessage ? (
          <div role="alert" className="mb-5 rounded-sm border border-[var(--cinnabar)]/20 bg-[var(--cinnabar)]/6 px-4 py-3 text-sm text-[var(--cinnabar-deep)]">
            {errorMessage}
          </div>
        ) : null}

        {fastTrack && step === 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{t("interpreting.flow.name")}</span>
              <input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder={t("interpreting.flow.namePlaceholder")} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{t("interpreting.flow.contact")}</span>
              <input value={form.contact} onChange={(e) => update("contact", e.target.value)} placeholder={t("interpreting.flow.contactPlaceholder")} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 md:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{t("interpreting.flow.city")}</span>
              <select value={form.city} onChange={(e) => update("city", e.target.value)} className={inputClass}>
                {cities.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
        )}

        {!fastTrack && step === 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{t("interpreting.flow.name")}</span>
              <input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder={t("interpreting.flow.namePlaceholder")} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{t("interpreting.flow.contact")}</span>
              <input value={form.contact} onChange={(e) => update("contact", e.target.value)} placeholder={t("interpreting.flow.contactPlaceholder")} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{t("interpreting.flow.city")}</span>
              <select value={form.city} onChange={(e) => update("city", e.target.value)} className={inputClass}>
                {cities.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <div className="flex flex-col gap-1.5">
              <span id="interpreting-service-date-label" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{t("interpreting.flow.serviceDate")}</span>
              <div className="relative" ref={calendarRef}>
                <button
                  type="button"
                  onClick={() => setShowCalendar(!showCalendar)}
                  aria-labelledby="interpreting-service-date-label"
                  aria-haspopup="dialog"
                  aria-expanded={showCalendar}
                  aria-controls="interpreting-service-calendar"
                  ref={calendarTriggerRef}
                  className={`${inputClass} flex w-full items-center justify-between hover:border-[var(--gold)] hover:bg-[var(--paper)]`}
                >
                  <span className={form.date ? "text-[var(--ink)]" : "text-[var(--muted)]"}>
                    {form.date ? formatDate(form.date) : t("interpreting.flow.chooseDate")}
                  </span>
                  <svg className="h-4 w-4 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M3 10h18" strokeLinecap="round" />
                    <path d="M8 2v4M16 2v4" strokeLinecap="round" />
                  </svg>
                </button>

                {showCalendar && (
                  <div id="interpreting-service-calendar" role="dialog" aria-label={t("interpreting.flow.calendarLabel")} className="absolute left-0 right-0 top-full z-30 mt-2 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-4 shadow-rest sm:left-auto sm:right-0 sm:w-80 sm:max-w-[calc(100vw-3rem)]">
                    <div className="mb-3 flex items-center justify-between">
                      <button
                        type="button"
                        aria-label={t("interpreting.flow.previousMonth")}
                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                        className="grid h-11 w-11 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--paper)] hover:text-[var(--ink)]"
                      >
                        &lt;
                      </button>
                      <p className="text-sm font-medium text-[var(--ink)]">
                        {new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(calendarMonth)}
                      </p>
                      <button
                        type="button"
                        aria-label={t("interpreting.flow.nextMonth")}
                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                        className="grid h-11 w-11 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--paper)] hover:text-[var(--ink)]"
                      >
                        &gt;
                      </button>
                    </div>

                    <div className="mb-1 grid grid-cols-7 gap-0.5">
                      {weekdays.map((d) => (
                        <p key={d} className="text-center text-[12px] uppercase tracking-[0.12em] text-[var(--muted)]">{d}</p>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-0.5">
                      {Array.from({ length: firstDayOfMonth(calendarMonth) }).map((_, i) => <div key={`empty-${i}`} />)}
                      {Array.from({ length: daysInMonth(calendarMonth) }).map((_, i) => {
                        const day = i + 1;
                        const dateStr = getCalendarDateKey(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
                        const isSelected = form.date === dateStr;
                        const isToday = getLocalDateKey() === dateStr;
                        return (
                          <button
                            key={day}
                            type="button"
                            aria-label={formatDate(dateStr)}
                            aria-pressed={isSelected}
                            onClick={() => handleCalendarSelect(day)}
                            className={`grid min-h-11 w-full min-w-0 place-items-center rounded-full text-xs transition ${
                              isSelected
                                ? "bg-[var(--cinnabar)] text-white"
                                : isToday
                                  ? "border border-[var(--cinnabar)] text-[var(--cinnabar)]"
                                  : "text-[var(--ink)] hover:bg-[var(--paper-deep)]"
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!fastTrack && step === 1 && (
          <div className="grid gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{t("interpreting.flow.supportMode")}</span>
              <select value={form.mode} onChange={(e) => update("mode", e.target.value)} className={inputClass}>
                {serviceModes.map((mode) => <option key={mode.value} value={mode.value}>{t(mode.labelKey)}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{t("interpreting.flow.groupSize")}</span>
              <input value={form.groupSize} onChange={(e) => update("groupSize", e.target.value)} placeholder={t("interpreting.flow.groupSizePlaceholder")} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{t("interpreting.flow.needs")}</span>
              <textarea
                value={form.needs}
                onChange={(e) => update("needs", e.target.value)}
                rows={5}
                placeholder={t("interpreting.flow.needsPlaceholder")}
                className="min-h-[140px] rounded-sm border border-[var(--line)] bg-white px-4 py-3.5 text-base text-[var(--ink)] outline-none transition focus:border-[var(--gold)] focus:bg-[var(--paper)] md:text-sm"
              />
            </label>
          </div>
        )}

        {!fastTrack && step === 2 && (
          <div className="grid gap-4">
            <div className="rounded-sm border border-[var(--line)] bg-[var(--paper)]/72 p-5">
              <p className="text-label text-[var(--gold)]">{t("interpreting.flow.reviewTitle")}</p>
              <div className="mt-4 grid gap-3 text-[15px] leading-7">
                {[
                  [t("interpreting.flow.name"), form.name],
                  [t("interpreting.flow.contactShort"), form.contact],
                  [t("interpreting.flow.city"), form.city],
                  [t("interpreting.flow.dateShort"), form.date ? formatDate(form.date) : ""],
                  [t("interpreting.flow.modeShort"), modeLabel(form.mode)],
                  [t("interpreting.flow.groupSize"), form.groupSize],
                  [t("interpreting.flow.needsShort"), form.needs],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-1 border-b border-[var(--line)] pb-2 last:border-0 sm:flex-row sm:items-baseline sm:gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] sm:w-24 sm:shrink-0">{label}</span>
                    <span className={value ? "text-[var(--ink)]" : "italic text-[var(--muted)]"}>{value || t("interpreting.flow.notProvided")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {((fastTrack && step === 1) || (!fastTrack && step === 3)) && (
          <div className="grid gap-5">
            {depositSession ? (
              <div className="rounded-sm border border-[var(--gold)]/28 bg-white/95 p-5 shadow-rest">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-label text-[var(--gold)]">{t("interpreting.flow.depositReady")}</p>
                    <h4 className="mt-3 font-[family:var(--font-display)] text-2xl leading-tight text-[var(--river-deep)]">
                      {t("interpreting.flow.depositTitle")}
                    </h4>
                  </div>
                  <div className="rounded-full border border-[var(--gold)]/24 bg-white px-4 py-2 text-sm font-semibold text-[var(--river-deep)]">
                    {formatCurrency(depositSession.deposit.amount, depositSession.deposit.currency)}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 rounded-sm border border-[var(--line)] bg-white/80 p-4 text-sm text-[var(--muted)] md:grid-cols-2">
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{t("interpreting.flow.depositFor")}</p>
                    <p className="mt-1 text-[var(--ink)]">{depositSession.deposit.paymentLabel}</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{t("interpreting.flow.orderNo")}</p>
                    <p className="mt-1 text-[var(--ink)]">{depositSession.deposit.orderNo}</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{t("interpreting.flow.contactShort")}</p>
                    <p className="mt-1 text-[var(--ink)]">{form.contact}</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{t("interpreting.flow.serviceDate")}</p>
                    <p className="mt-1 text-[var(--ink)]">{formatDate(form.date || getLocalDateKey())}</p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-sm leading-7 text-[var(--muted)]">
                    {t("interpreting.flow.paypalBody")}
                  </p>
                  {depositSession.deposit.paypalApprovalUrl ? (
                    <a
                      href={depositSession.deposit.paypalApprovalUrl}
                      className="mt-4 flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--cinnabar)] px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-[var(--cinnabar-deep)] sm:w-auto"
                    >
                      {t("interpreting.flow.paypalContinue")}
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="mt-4 w-full cursor-not-allowed rounded-full bg-[var(--line)] px-6 py-3 text-[14px] font-semibold text-[var(--muted)] sm:w-auto"
                    >
                      {t("interpreting.flow.paypalContinue")}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-sm border border-dashed border-[var(--line)] bg-[var(--paper)]/56 p-5 text-sm leading-7 text-[var(--muted)]">
                {t("interpreting.flow.depositEmpty")}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-[var(--line)] bg-[rgba(248,244,236,0.48)] px-5 py-5 sm:px-7">
        {completionHint ? (
          <p
            id="interpreting-next-requirements"
            aria-live="polite"
            className="mb-3 text-[12px] leading-5 text-[var(--muted)] sm:max-w-[20rem]"
          >
            {completionHint}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => {
            const next = Math.max(0, step - 1);
            setStep(next);
            onStepChange?.(next, fastTrack);
          }}
          className={`flex min-h-11 w-full items-center text-left text-[14px] transition sm:w-auto ${step === 0 ? "cursor-not-allowed text-[var(--muted)]/40" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
          disabled={step === 0}
        >
          {t("interpreting.flow.back")}
        </button>

        {((fastTrack && step === 1) || (!fastTrack && step === 3)) ? (
          depositSession ? null : (
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-full bg-[var(--line)] px-6 py-3 text-[14px] font-semibold text-[var(--muted)] sm:w-auto"
            >
              {t("interpreting.flow.payDeposit")}
            </button>
          )
        ) : fastTrack ? (
          <button
            type="button"
            onClick={openDepositCheckout}
            disabled={!canNext() || submitting}
            aria-describedby={completionHint ? "interpreting-next-requirements" : undefined}
            className={`w-full rounded-full px-6 py-3 text-[14px] font-semibold transition-all sm:w-auto ${
              canNext() && !submitting
                ? "bg-[var(--cinnabar)] text-white shadow-[0_12px_30px_rgba(140,58,44,0.18)] hover:bg-[var(--cinnabar-deep)]"
                : "cursor-not-allowed bg-[var(--line)] text-[var(--muted)]"
            }`}
          >
            {submitting ? t("interpreting.flow.openingDeposit") : t("interpreting.flow.reserveDeposit")}
          </button>
        ) : step < 2 ? (
          <button
            type="button"
            onClick={() => {
              const next = Math.min(2, step + 1);
              setStep(next);
              onStepChange?.(next, fastTrack);
            }}
            disabled={!canNext()}
            aria-describedby={completionHint ? "interpreting-next-requirements" : undefined}
            className={`w-full rounded-full px-6 py-3 text-[14px] font-semibold transition-all sm:w-auto ${
              canNext()
                ? "bg-[var(--gold)] text-[var(--night)] shadow-[0_12px_30px_rgba(197,160,57,0.18)] hover:bg-[var(--gold)]/90"
                : "cursor-not-allowed bg-[var(--line)] text-[var(--muted)]"
            }`}
          >
            {t("interpreting.flow.continue")}
          </button>
        ) : (
          <button
            type="button"
            onClick={openDepositCheckout}
            disabled={submitting}
            className={`w-full rounded-full px-6 py-3 text-[14px] font-semibold transition sm:w-auto ${
              submitting
                ? "cursor-not-allowed bg-[var(--line)] text-[var(--muted)]"
                : "bg-[var(--cinnabar)] text-white shadow-[0_12px_30px_rgba(140,58,44,0.18)] hover:bg-[var(--cinnabar-deep)]"
            }`}
          >
            {submitting ? t("interpreting.flow.openingDeposit") : t("interpreting.flow.sendAndContinue")}
          </button>
        )}

        </div>
      </div>
    </div>
  );
}

export const MultiStepForm = memo(MultiStepFormInner);
MultiStepForm.displayName = "MultiStepForm";
