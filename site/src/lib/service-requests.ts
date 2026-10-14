import { apiClient, apiGet, apiPost } from "@/lib/api-client";

/** Agreed with the service-request API. Amounts are integer cents, never locale prices. */
export type ServiceType = "free_route" | "custom_route" | "interpretation";
export type ServicePackage = {
  id: "fixed4" | "fixed5" | "fixed7" | "custom4" | "custom5" | "custom7";
  hours: 4 | 5 | 7;
  routeType: "fixed" | "custom";
  currency: "USD";
  amountCents: number;
  enabled: boolean;
  paymentPolicy: "not_configured";
  depositCents: number | null;
};
export type ServicePreferences = {
  days?: number;
  interests?: string[];
  foodPreferences?: string;
  accommodation?: string;
  budget?: string;
  budgetAmount?: string;
  budgetCurrency?: "USD" | "CNY" | "SGD";
  serviceContext?: string;
  notes?: string;
};
export type CreateServiceRequest = {
  serviceType: ServiceType;
  citySlug: string;
  routeId?: string;
  date: string;
  groupSize: number;
  name: string;
  contact: string;
  packageId?: ServicePackage["id"];
  preferredInterpreterId?: string;
  linkedRequestId?: string;
  languagePair?: string;
  preferences?: ServicePreferences;
};
export type ServiceQuote = {
  id: string;
  revision: number;
  amountCents: number;
  currency: "USD";
  scope: string;
  status: "offered" | "accepted" | "superseded";
  createdAt: string;
  acceptedAt: string | null;
};
export type ServiceRequest = Omit<CreateServiceRequest, "packageId" | "languagePair" | "preferences"> & {
  id: string;
  linkedRequestId: string | null;
  preferredInterpreterId: string | null;
  assignedInterpreterId: string | null;
  assignedPlannerId: string | null;
  requirements: { languagePair?: string; preferences?: ServicePreferences };
  packageSnapshot: ServicePackage | null;
  priceSnapshot: { currency: "USD"; amountCents: number | null; source: "free" | "package" | "quote_required" | "quote" };
  processStatus: "received" | "assigned" | "in_progress" | "quoted" | "confirmed" | "completed" | "cancelled";
  paymentStatus: "not_required" | "quote_required" | "confirmation_required";
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  quote: ServiceQuote | null;
  checkoutEnabled: false;
  paymentPolicy: "not_configured";
};
export type RequestMessage = { id: string; body: string; senderType: "owner" | "staff"; createdAt: string };
export const serviceTypeLabels: Record<ServiceType, string> = {
  free_route: "Free Route Booking",
  custom_route: "Custom Route Request",
  interpretation: "Interpretation Request",
};
export const processLabels: Record<ServiceRequest["processStatus"], string> = {
  received: "Received", assigned: "Assigned", in_progress: "In progress", quoted: "Quoted",
  confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled",
};
export const paymentLabels: Record<ServiceRequest["paymentStatus"], string> = {
  not_required: "No payment required", quote_required: "Quote pending", confirmation_required: "Payment policy pending",
};
export function isUuid(value: string | undefined | null): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function newRequestKey() { return crypto.randomUUID(); }
export function fetchServicePackages() {
  return apiGet<{ packages: ServicePackage[]; paymentPolicy: "not_configured"; checkoutEnabled: false }>("/public/service-packages");
}
export function createServiceRequest(input: CreateServiceRequest, key: string) {
  return apiPost<ServiceRequest>("/account/service-requests", input, { headers: { "Idempotency-Key": key } });
}
export function fetchServiceRequests(page = 1, signal?: AbortSignal) {
  return apiClient<{ data: ServiceRequest[]; total: number; page: number; size: number }>("/account/service-requests", { params: { page, size: 20 }, signal, cache: "no-store" });
}
export function fetchServiceRequest(id: string, signal?: AbortSignal) {
  return apiClient<ServiceRequest>(`/account/service-requests/${encodeURIComponent(id)}`, { signal, cache: "no-store" });
}
export function fetchRequestMessages(id: string, after?: string, signal?: AbortSignal) {
  return apiClient<{ data: RequestMessage[]; unreadCount: number; hasMore: boolean; nextCursor: string | null }>(`/account/service-requests/${encodeURIComponent(id)}/messages`, { params: { after, size: 50 }, signal, cache: "no-store" });
}
export function sendRequestMessage(id: string, body: string, key: string) {
  return apiPost<RequestMessage>(`/account/service-requests/${encodeURIComponent(id)}/messages`, { body }, { headers: { "Idempotency-Key": key } });
}
export function markRequestMessagesRead(id: string, messageId: string) {
  return apiClient<{ ok: true }>(`/account/service-requests/${encodeURIComponent(id)}/messages/read`, { method: "PUT", body: { messageId } });
}
export function acceptRequestQuote(id: string, quote: ServiceQuote) {
  return apiPost<ServiceRequest>(`/account/service-requests/${encodeURIComponent(id)}/quote/accept`, { quoteId: quote.id, revision: quote.revision });
}

/** Only public context is carried in a login return URL. Never include contact or requirements. */
export function requestLoginHref(pathname: string, input: Pick<CreateServiceRequest, "serviceType" | "citySlug" | "routeId" | "preferredInterpreterId">) {
  const query = new URLSearchParams({ type: input.serviceType });
  if (input.citySlug) query.set("citySlug", input.citySlug);
  if (isUuid(input.routeId)) query.set("routeId", input.routeId);
  if (isUuid(input.preferredInterpreterId)) query.set("interpreterId", input.preferredInterpreterId);
  const next = `${pathname}?${query}#${pathname.includes("interpreting") ? "interpreting-booking" : "route-request"}`;
  return `/login?next=${encodeURIComponent(next)}`;
}
