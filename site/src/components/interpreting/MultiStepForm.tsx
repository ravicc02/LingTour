"use client";

import Link from "next/link";
import { Suspense, useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet, ApiRequestError } from "@/lib/api-client";
import { fetchCities, fetchRoutes } from "@/lib/api-data";
import type { CityCulture } from "@/data/culture";
import type { StoryRoute } from "@/data/routes";
import { getLocalDateKey } from "@/lib/calendar-date";
import { formatCurrency } from "@/lib/region-currency";
import {
  createServiceRequest, fetchServicePackages, isUuid, newRequestKey, requestLoginHref,
  serviceTypeLabels, type CreateServiceRequest, type ServicePackage, type ServiceRequest, type ServiceType,
} from "@/lib/service-requests";

export type RequestFormState = {
  serviceType: ServiceType; citySlug: string; routeId: string; date: string; groupSize: string;
  packageId: string; preferredInterpreterId: string; languagePair: string; name: string; contact: string;
  days: string; interests: string; foodPreferences: string; accommodation: string;
  budgetAmount: string; budgetCurrency: "USD" | "CNY" | "SGD"; serviceContext: string; notes: string;
};
type Props = {
  serviceType?: ServiceType; prefillNeeds?: string; preferredInterpreterId?: string;
  linkedRequest?: ServiceRequest; requestedStep?: number;
  onStateChange?: (state: RequestFormState) => void; onStepChange?: (step: number) => void;
};
const emptyForm = (serviceType: ServiceType): RequestFormState => ({
  serviceType, citySlug: "", routeId: "", date: "", groupSize: "", packageId: "", preferredInterpreterId: "",
  languagePair: "", name: "", contact: "", days: "", interests: "", foodPreferences: "", accommodation: "",
  budgetAmount: "", budgetCurrency: "USD", serviceContext: "", notes: "",
});
const inputClass = "min-h-[54px] w-full min-w-0 rounded-sm border border-[var(--line)] bg-white px-4 py-3.5 text-base leading-6 text-[var(--ink)] transition focus:border-[var(--river-deep)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--river-deep)] md:text-[15px]";
const draftKey = "culvoy-service-trip-draft";
function storePublicTrip(form: RequestFormState) {
  try { sessionStorage.setItem(draftKey, JSON.stringify({ pathname: window.location.pathname, savedAt: Date.now(), citySlug: form.citySlug, routeId: form.routeId, date: form.date, groupSize: form.groupSize, packageId: form.packageId, preferredInterpreterId: form.preferredInterpreterId })); } catch { /* Storage is optional. */ }
}
const steps = ["Trip details", "Requirements", "Contact & review"];

export function validateRequestForm(form: RequestFormState, packages: ServicePackage[], routes: StoryRoute[], cities: CityCulture[], step: number) {
  const errors: Partial<Record<keyof RequestFormState, string>> = {};
  if (step === 0 || step === 2) {
    if (!cities.some((city) => city.slug === form.citySlug)) errors.citySlug = "Choose a published city.";
    const date = new Date(`${form.date}T00:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || Number.isNaN(date.getTime()) || getLocalDateKey(date) !== form.date || form.date < getLocalDateKey()) errors.date = "Choose a valid date, today or later.";
    if (!/^\d+$/.test(form.groupSize) || Number(form.groupSize) < 1 || Number(form.groupSize) > 100) errors.groupSize = "Enter a group size from 1 to 100.";
  }
  if (step === 1 || step === 2) {
    const pkg = packages.find((item) => item.id === form.packageId && item.enabled);
    const routeRequired = form.serviceType === "free_route" || (form.serviceType === "interpretation" && pkg?.routeType === "fixed");
    if ((routeRequired || form.routeId) && !routes.some((route) => isUuid(route.id) && route.id === form.routeId && route.citySlugs.includes(form.citySlug))) errors.routeId = "Choose a published route in this city.";
    if (form.serviceType === "interpretation") {
      if (!pkg) errors.packageId = "Choose an available interpretation package.";
      if (!form.languagePair.trim()) errors.languagePair = "Enter the languages you need.";
      if (form.preferredInterpreterId && !isUuid(form.preferredInterpreterId)) errors.preferredInterpreterId = "This interpreter link is invalid. Clear the preference and choose again.";
    }
    if (form.serviceType === "custom_route") {
      if (!/^\d+$/.test(form.days) || Number(form.days) < 1 || Number(form.days) > 60) errors.days = "Enter 1 to 60 days.";
      if (!/^(0|[1-9]\d{0,6})(\.\d{1,2})?$/.test(form.budgetAmount)) errors.budgetAmount = "Enter a budget amount with up to two decimal places.";
      if (form.interests.split(",").some((item) => item.trim().length > 200)) errors.interests = "Each interest must be no more than 200 characters.";
      if (form.interests.split(",").filter((item) => item.trim()).length > 20) errors.interests = "Use no more than 20 interests.";
    }
  }
  if (step === 2) {
    if (!form.name.trim()) errors.name = "Enter your name.";
    if (!form.contact.trim()) errors.contact = "Enter an email address or other contact method.";
  }
  return errors;
}

function MultiStepFormInner({ serviceType = "interpretation", prefillNeeds, preferredInterpreterId, linkedRequest, requestedStep, onStateChange, onStepChange }: Props) {
  const query = useSearchParams();
  const id = useId();
  const [form, setForm] = useState(() => emptyForm(serviceType));
  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState<{ cities: CityCulture[]; routes: StoryRoute[]; packages: ServicePackage[] }>({ cities: [], routes: [], packages: [] });
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [reload, setReload] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<keyof RequestFormState, string>>>({});
  const [error, setError] = useState("");
  const [loginHref, setLoginHref] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<ServiceRequest | null>(null);
  const [addInterpretation, setAddInterpretation] = useState(false);
  const retry = useRef<{ signature: string; key: string } | null>(null);
  const submitLock = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const initialQuery = query.toString();

  useEffect(() => {
    const params = new URLSearchParams(initialQuery);
    const restored: Partial<RequestFormState> = {};
    try {
      const draft = JSON.parse(sessionStorage.getItem(draftKey) || "null");
      if (draft && Date.now() - draft.savedAt < 30 * 60 * 1000 && draft.pathname === window.location.pathname) {
        // Explicit allowlist: no name, contact, free text, budget or private conversation.
        for (const field of ["citySlug", "routeId", "date", "groupSize", "packageId", "preferredInterpreterId"] as const) {
          if (typeof draft[field] === "string" && draft[field].length <= 100) restored[field] = draft[field];
        }
      }
    } catch { /* Storage is optional. */ }
    const type = params.get("type");
    setForm((prev) => ({ ...prev, ...restored,
      serviceType: linkedRequest ? "interpretation" : type === "free_route" || type === "custom_route" || type === "interpretation" ? type : serviceType,
      citySlug: linkedRequest?.citySlug ?? params.get("citySlug") ?? restored.citySlug ?? "",
      routeId: linkedRequest?.routeId ?? params.get("routeId") ?? restored.routeId ?? "",
      preferredInterpreterId: params.get("interpreterId") ?? restored.preferredInterpreterId ?? "",
      ...(linkedRequest ? { date: linkedRequest.date, groupSize: String(linkedRequest.groupSize), name: linkedRequest.name, contact: linkedRequest.contact } : {}),
    }));
    setStep(0); setSubmitted(null); setErrors({});
  }, [initialQuery, serviceType, linkedRequest]);
  useEffect(() => { if (preferredInterpreterId !== undefined) setForm((prev) => ({ ...prev, preferredInterpreterId })); }, [preferredInterpreterId]);
  useEffect(() => { if (prefillNeeds) setForm((prev) => ({ ...prev, serviceContext: prefillNeeds })); }, [prefillNeeds]);
  useEffect(() => {
    let active = true;
    setLoading(true); setCatalogError("");
    Promise.all([fetchCities(), fetchRoutes(), fetchServicePackages()]).then(([cities, routes, data]) => {
      if (active) setCatalog({ cities, routes, packages: data.packages.filter((pkg) => pkg.enabled && pkg.currency === "USD") });
    }).catch(() => { if (active) setCatalogError("We cannot load available cities, routes and packages. Please retry."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  useEffect(() => { onStateChange?.(form); }, [form, onStateChange]);
  useEffect(() => {
    if (requestedStep !== undefined && requestedStep < step) setStep(Math.max(0, requestedStep));
  }, [requestedStep, step]);
  const update = (field: keyof RequestFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value, ...(field === "citySlug" ? { routeId: "" } : {}) }));
    retry.current = null; setErrors({}); setError(""); setLoginHref("");
  };
  const changeType = (type: ServiceType) => {
    setForm((prev) => ({ ...emptyForm(type), citySlug: prev.citySlug, date: prev.date, groupSize: prev.groupSize, name: prev.name, contact: prev.contact }));
    retry.current = null; setStep(0); onStepChange?.(0); setErrors({}); setError("");
  };
  const goStep = (next: number) => { setStep(next); onStepChange?.(next); headingRef.current?.focus(); };
  const availablePackages = catalog.packages.filter((item) => !linkedRequest || item.routeType === (linkedRequest.serviceType === "free_route" ? "fixed" : "custom"));
  const pkg = availablePackages.find((item) => item.id === form.packageId);
  const matchingRoutes = catalog.routes.filter((route) => isUuid(route.id) && route.citySlugs.includes(form.citySlug));
  const routeRequired = form.serviceType === "free_route" || (form.serviceType === "interpretation" && pkg?.routeType === "fixed");
  const price = form.serviceType === "free_route" ? formatCurrency(0, "USD") : form.serviceType === "custom_route" ? "Planning fee: quote pending" : pkg ? formatCurrency(pkg.amountCents / 100, "USD") : "Choose a package";
  const savePublicDraft = () => {
    storePublicTrip(form);
    setLoginHref(requestLoginHref(window.location.pathname, form));
  };
  const submit = async () => {
    if (submitLock.current) return;
    const validation = validateRequestForm(form, availablePackages, catalog.routes, catalog.cities, 2);
    setErrors(validation);
    if (Object.keys(validation).length) { setError("Please correct the highlighted fields before submitting."); return; }
    submitLock.current = true; setSubmitting(true); setError("");
    try {
      await apiGet("/auth/me"); // Server session is authority, never a cached email or localStorage identity.
      const input: CreateServiceRequest = {
        serviceType: form.serviceType, citySlug: form.citySlug, routeId: form.routeId || undefined,
        date: form.date, groupSize: Number(form.groupSize), name: form.name.trim(), contact: form.contact.trim(),
        ...(form.serviceType === "interpretation" ? { packageId: pkg!.id, languagePair: form.languagePair.trim(), preferredInterpreterId: form.preferredInterpreterId || undefined, linkedRequestId: linkedRequest?.id } : {}),
        preferences: {
          ...(form.serviceType === "custom_route" ? { days: Number(form.days), interests: form.interests.split(",").map((item) => item.trim()).filter(Boolean), foodPreferences: form.foodPreferences.trim(), accommodation: form.accommodation.trim(), budgetAmount: form.budgetAmount, budgetCurrency: form.budgetCurrency } : {}),
          serviceContext: form.serviceContext.trim() || undefined, notes: form.notes.trim() || undefined,
        },
      };
      const signature = JSON.stringify(input);
      if (retry.current?.signature !== signature) retry.current = { signature, key: newRequestKey() };
      const result = await createServiceRequest(input, retry.current.key);
      setSubmitted(result);
      try { sessionStorage.removeItem(draftKey); } catch { /* Optional storage. */ }
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.statusCode === 401) { savePublicDraft(); setError("Sign in to send this private request. Your trip selections are retained; contact details are not stored."); }
      else setError(cause instanceof Error ? cause.message : "The request could not be sent. Retry without changing the form to use the same request key.");
    } finally { submitLock.current = false; setSubmitting(false); }
  };
  const field = (key: keyof RequestFormState, label: string, control: React.ReactNode) => <div className="flex min-w-0 flex-col gap-1.5"><label htmlFor={`${id}-${key}`} className="text-sm font-semibold text-[var(--river-deep)]">{label}</label>{control}{errors[key] ? <p id={`${id}-${key}-error`} className="text-sm text-[var(--cinnabar-deep)]">{errors[key]}</p> : null}</div>;
  const attrs = (key: keyof RequestFormState) => ({ id: `${id}-${key}`, "aria-invalid": !!errors[key], "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined, className: inputClass });

  if (submitted) return <div role="status" className="border border-[var(--line)] bg-white p-5 sm:p-7">
    <h3 className="font-[family:var(--font-display)] text-3xl text-[var(--river-deep)]">Request received</h3>
    <p className="mt-4 text-base leading-7 text-[var(--muted)]">{serviceTypeLabels[submitted.serviceType]} submitted. Interpreter and planner assignments are confirmed separately.</p>
    <p className="mt-3 font-semibold">{submitted.serviceType === "free_route" ? "USD 0.00 route fee. No payment required." : "Payment policy pending. No deposit or checkout is required now."}</p>
    <Link href={`/profile?tab=bookings&requestId=${submitted.id}`} className="btn-primary mt-6 inline-flex min-h-11 items-center">View request</Link>
    {submitted.serviceType !== "interpretation" ? <><p className="mt-6 text-sm leading-6 text-[var(--muted)]">Interpretation is optional and separately priced. It is not included in the route request.</p><button type="button" className="btn-outline mt-3 min-h-11" onClick={() => setAddInterpretation(true)}>Request interpretation</button>{addInterpretation ? <div className="mt-6"><MultiStepForm serviceType="interpretation" linkedRequest={submitted} /></div> : null}</> : null}
  </div>;
  return <form noValidate onSubmit={(event) => { event.preventDefault(); if (step < 2) { const result = validateRequestForm(form, availablePackages, catalog.routes, catalog.cities, step); setErrors(result); if (!Object.keys(result).length) goStep(step + 1); } else void submit(); }} className="overflow-visible border-y border-[var(--line)] bg-white/92 sm:border-x" aria-busy={loading || submitting}>
    <div className="border-b border-[var(--line)] bg-[var(--paper)] px-5 py-4 sm:px-7">
      {!linkedRequest ? field("serviceType", "Request type", <select {...attrs("serviceType")} value={form.serviceType} disabled={submitting} onChange={(event) => changeType(event.target.value as ServiceType)}>{Object.entries(serviceTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>) : <p className="font-semibold">Separate Interpretation Request</p>}
      <p className="mt-3 text-sm leading-6">{price}</p>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{form.serviceType === "free_route" ? "No route fee or mandatory deposit. Food, accommodation, transport and tickets are third-party costs, not included." : "Payment policy pending. No checkout is available and no deposit is assumed."}</p>
    </div>
    <div className="px-5 py-6 sm:px-7 sm:py-8">
      <h3 ref={headingRef} tabIndex={-1} className="mb-6 font-[family:var(--font-display)] text-3xl text-[var(--river-deep)]">{steps[step]}</h3>
      {loading ? <p role="status">Loading available services...</p> : null}
      {catalogError ? <div role="alert"><p>{catalogError}</p><button type="button" onClick={() => setReload((value) => value + 1)} className="btn-outline mt-3 min-h-11">Retry services</button></div> : null}
      {error ? <p role="alert" className="mb-5 text-sm leading-6 text-[var(--cinnabar-deep)]">{String(error)}</p> : null}
      {loginHref ? <Link className="btn-outline mb-5 inline-flex min-h-11 items-center" href={loginHref}>Sign in to submit</Link> : null}
      <fieldset disabled={submitting || loading || !!catalogError} className="min-w-0 border-0 p-0">
        {step === 0 ? <div className="grid gap-4 md:grid-cols-2">
          {field("citySlug", "City (required)", <select {...attrs("citySlug")} required value={form.citySlug} disabled={!!linkedRequest} onChange={(event) => update("citySlug", event.target.value)}><option value="">Choose a city</option>{catalog.cities.map((city) => <option key={city.slug} value={city.slug}>{city.name}</option>)}</select>)}
          {field("date", "Service date (required)", <input {...attrs("date")} type="date" required min={getLocalDateKey()} value={form.date} disabled={!!linkedRequest} onChange={(event) => update("date", event.target.value)} />)}
          {field("groupSize", "Group size (required)", <input {...attrs("groupSize")} type="number" min={1} max={100} step={1} required value={form.groupSize} disabled={!!linkedRequest} onChange={(event) => update("groupSize", event.target.value)} />)}
        </div> : null}
        {step === 1 ? <div className="grid gap-4">
          {form.serviceType === "interpretation" ? <>
            {field("packageId", "Interpretation package (required)", <select {...attrs("packageId")} required value={form.packageId} onChange={(event) => update("packageId", event.target.value)}><option value="">Choose a package</option>{availablePackages.map((item) => <option key={item.id} value={item.id}>{item.routeType === "fixed" ? "Fixed route" : "Custom route"}: {item.hours} hours - {formatCurrency(item.amountCents / 100, "USD")}</option>)}</select>)}
            {field("languagePair", "Languages needed (required)", <input {...attrs("languagePair")} maxLength={200} required value={form.languagePair} onChange={(event) => update("languagePair", event.target.value)} />)}
            {form.preferredInterpreterId ? <div><p className="text-sm">Preferred interpreter selected. Availability and assignment are not confirmed.</p><button type="button" className="min-h-11 underline" onClick={() => update("preferredInterpreterId", "")}>Clear preference</button>{errors.preferredInterpreterId ? <p role="alert">{errors.preferredInterpreterId}</p> : null}</div> : null}
          </> : null}
          {field("routeId", `Published route${routeRequired ? " (required)" : " (optional reference)"}`, <select {...attrs("routeId")} required={routeRequired} disabled={!!linkedRequest?.routeId} value={form.routeId} onChange={(event) => update("routeId", event.target.value)}><option value="">{form.citySlug ? "Choose a route" : "Choose a city first"}</option>{matchingRoutes.map((route) => <option key={route.id} value={route.id}>{route.title}</option>)}</select>)}
          {form.citySlug && !matchingRoutes.length ? <p className="text-sm text-[var(--muted)]">No published fixed routes are available for this city.</p> : null}
          {form.serviceType === "custom_route" ? <div className="grid gap-4 md:grid-cols-2">
            {field("days", "Number of days (required)", <input {...attrs("days")} type="number" min={1} max={60} required value={form.days} onChange={(event) => update("days", event.target.value)} />)}
            {field("interests", "Scenic places and interests (comma-separated)", <input {...attrs("interests")} maxLength={2000} value={form.interests} onChange={(event) => update("interests", event.target.value)} />)}
            {field("foodPreferences", "Food preferences", <textarea {...attrs("foodPreferences")} rows={3} maxLength={1000} value={form.foodPreferences} onChange={(event) => update("foodPreferences", event.target.value)} />)}
            {field("accommodation", "Accommodation requirements", <textarea {...attrs("accommodation")} rows={3} maxLength={1000} value={form.accommodation} onChange={(event) => update("accommodation", event.target.value)} />)}
            {field("budgetAmount", "Trip budget amount (required)", <input {...attrs("budgetAmount")} type="text" inputMode="decimal" required maxLength={10} value={form.budgetAmount} onChange={(event) => update("budgetAmount", event.target.value)} />)}
            {field("budgetCurrency", "Budget currency", <select {...attrs("budgetCurrency")} value={form.budgetCurrency} onChange={(event) => update("budgetCurrency", event.target.value)}>{["USD", "CNY", "SGD"].map((currency) => <option key={currency}>{currency}</option>)}</select>)}
            <p className="text-sm leading-6 text-[var(--muted)] md:col-span-2">Your trip budget is not our planning fee. Planning is a paid service with a separate quote.</p>
          </div> : null}
          {form.serviceType === "interpretation" ? field("serviceContext", "Service context", <textarea {...attrs("serviceContext")} maxLength={1000} rows={3} value={form.serviceContext} onChange={(event) => update("serviceContext", event.target.value)} />) : null}
          {field("notes", "Additional requirements", <textarea {...attrs("notes")} rows={4} maxLength={4000} value={form.notes} onChange={(event) => update("notes", event.target.value)} />)}
        </div> : null}
        {step === 2 ? <div className="grid gap-4">
          {field("name", "Name (required)", <input {...attrs("name")} autoComplete="name" required maxLength={200} value={form.name} onChange={(event) => update("name", event.target.value)} />)}
          {field("contact", "Email / WhatsApp (required)", <input {...attrs("contact")} required maxLength={300} value={form.contact} onChange={(event) => update("contact", event.target.value)} />)}
          <dl className="grid gap-3 border border-[var(--line)] bg-[var(--paper)] p-5 text-base leading-7">
            {[["Request", serviceTypeLabels[form.serviceType]], ["City", catalog.cities.find((city) => city.slug === form.citySlug)?.name], ["Route", catalog.routes.find((route) => route.id === form.routeId)?.title], ["Date", form.date], ["Group", form.groupSize], ["Service amount", price], ...(form.serviceType === "interpretation" ? [["Languages", form.languagePair], ["Context", form.serviceContext]] : []), ...(form.serviceType === "custom_route" ? [["Days", form.days], ["Interests", form.interests], ["Food", form.foodPreferences], ["Accommodation", form.accommodation], ["Trip budget", `${form.budgetCurrency} ${form.budgetAmount}`]] : []), ["Requirements", form.notes]].filter(([, value]) => value).map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-sm text-[var(--muted)]">{label}</dt><dd className="break-words whitespace-pre-wrap">{value}</dd></div>)}
          </dl>
          <p className="text-sm leading-6 text-[var(--muted)]">Sign in is required to submit and access your private conversation. No payment is collected here.</p>
        </div> : null}
      </fieldset>
    </div>
    <div className="flex flex-col-reverse gap-3 border-t border-[var(--line)] bg-[var(--paper)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
      <button type="button" disabled={step === 0 || submitting} onClick={() => goStep(step - 1)} className="btn-outline min-h-11 disabled:opacity-50">Back</button>
      <button type="submit" disabled={submitting || loading || !!catalogError} className="btn-primary min-h-11 disabled:opacity-50">{submitting ? "Sending request..." : step < 2 ? "Continue" : "Send request"}</button>
    </div>
  </form>;
}
export function MultiStepForm(props: Props) {
  return <Suspense fallback={<p role="status">Loading request form...</p>}><MultiStepFormInner {...props} /></Suspense>;
}
