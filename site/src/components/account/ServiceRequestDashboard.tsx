"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiRequestError } from "@/lib/api-client";
import { formatCurrency } from "@/lib/region-currency";
import {
  acceptRequestQuote, fetchRequestMessages, fetchServiceRequest, fetchServiceRequests,
  markRequestMessagesRead, newRequestKey, paymentLabels, processLabels, sendRequestMessage, serviceTypeLabels,
  type RequestMessage, type ServiceRequest,
} from "@/lib/service-requests";

const errorText = (cause: unknown) => cause instanceof ApiRequestError && cause.statusCode === 401
  ? "Your session has expired. Sign in again to access private requests."
  : cause instanceof Error ? String(cause.message) : "The request failed. Please retry.";
const isUnauthorized = (cause: unknown) => cause instanceof ApiRequestError && (cause.statusCode === 401 || cause.statusCode === 403 || cause.statusCode === 404);
const controlClass = "min-h-11 border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--river-deep)] disabled:opacity-50";

/** Profile mounts with the authenticated server identity. No email-based ownership queries. */
export function ServiceRequestDashboard({ userId }: { userId: string }) {
  return userId ? <DashboardSession key={userId} userId={userId} /> : null;
}
function DashboardSession({ userId }: { userId: string }) {
  const query = useSearchParams();
  const requestedId = query.get("requestId") || "";
  const [items, setItems] = useState<ServiceRequest[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { setSelectedId(requestedId); }, [requestedId]);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setItems([]); setLoading(true); setError("");
    fetchServiceRequests(page, controller.signal).then((result) => { if (active) { setItems(result.data); setTotal(result.total); } }).catch((cause) => { if (active) { setError(errorText(cause)); if (isUnauthorized(cause)) setSelectedId(""); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [page, refresh, userId]);
  return <section className="min-w-0" aria-label="Service requests">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><h2 className="font-[family:var(--font-display)] text-3xl text-[var(--river-deep)]">Service requests</h2><button type="button" className={controlClass} onClick={() => setRefresh((value) => value + 1)}>Refresh requests</button></div>
    <p className="mb-6 max-w-2xl text-base leading-7 text-[var(--muted)]">Free-route bookings, planning quotes and interpretation are separate requests. Conversations are private to you and authorized staff.</p>
    {loading ? <p role="status">Loading your requests...</p> : error ? <div role="alert"><p>{error}</p><Link href="/login?next=%2Fprofile%3Ftab%3Dbookings" className="inline-flex min-h-11 items-center underline">Sign in</Link><button type="button" className={`${controlClass} ml-3`} onClick={() => setRefresh((value) => value + 1)}>Retry</button></div> : !items.length ? <div className="border border-[var(--line)] bg-[var(--paper)] p-6"><p>No service requests yet.</p><Link href="/routes/#route-request" className="mt-3 inline-flex min-h-11 items-center underline">Plan a route</Link></div> : <ul className="space-y-3">{items.map((request) => <li key={request.id}><button type="button" aria-expanded={selectedId === request.id} onClick={() => setSelectedId(selectedId === request.id ? "" : request.id)} className="flex min-h-11 w-full min-w-0 flex-wrap items-center justify-between gap-4 border border-[var(--line)] bg-white/80 p-5 text-left"><span className="min-w-0"><span className="block font-[family:var(--font-display)] text-xl text-[var(--river-deep)]">{serviceTypeLabels[request.serviceType]}</span><span className="mt-2 block text-sm text-[var(--muted)]">{request.citySlug} / {request.date}</span></span><span className="text-sm leading-6">{processLabels[request.processStatus]}<br />{paymentLabels[request.paymentStatus]}{request.unreadCount ? <span className="block font-semibold">{request.unreadCount} unread messages</span> : null}</span></button></li>)}</ul>}
    {total > 20 ? <nav aria-label="Request pages" className="mt-5 flex flex-wrap items-center gap-3"><button type="button" className={controlClass} disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {Math.ceil(total / 20)}</span><button type="button" className={controlClass} disabled={page * 20 >= total || loading} onClick={() => setPage((value) => value + 1)}>Next</button></nav> : null}
    {selectedId ? <RequestDetail key={`${userId}:${selectedId}`} id={selectedId} onUpdated={() => setRefresh((value) => value + 1)} /> : null}
  </section>;
}
function RequestDetail({ id, onUpdated }: { id: string; onUpdated: () => void }) {
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const active = useRef(true);
  const acceptLock = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    let current = true; const controller = new AbortController();
    setRequest(null); setLoading(true); setError("");
    fetchServiceRequest(id, controller.signal).then((result) => { if (current) setRequest(result); }).catch((cause) => { if (current) setError(errorText(cause)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [id, refresh]);
  const accept = async () => {
    if (!request?.quote || acceptLock.current) return;
    acceptLock.current = true; setBusy(true); setError("");
    try { const result = await acceptRequestQuote(id, request.quote); if (active.current) { setRequest(result); onUpdated(); } }
    catch (cause) { if (active.current) { if (isUnauthorized(cause)) setRequest(null); setError(errorText(cause)); if (cause instanceof ApiRequestError && cause.statusCode === 409) setRefresh((value) => value + 1); } }
    finally { acceptLock.current = false; if (active.current) setBusy(false); }
  };
  return <article className="mt-8 min-w-0 border-t border-[var(--line)] pt-8" aria-label="Request detail">
    {loading ? <p role="status">Loading request details...</p> : null}
    {error ? <div role="alert"><p className="text-[var(--cinnabar-deep)]">{error}</p><button type="button" className={`${controlClass} mt-3`} onClick={() => setRefresh((value) => value + 1)}>Refresh detail</button></div> : null}
    {request ? <>
      <h3 className="font-[family:var(--font-display)] text-3xl text-[var(--river-deep)]">{serviceTypeLabels[request.serviceType]}</h3>
      <dl className="mt-5 grid min-w-0 gap-4 text-base leading-7 sm:grid-cols-2">{[
        ["Processing", processLabels[request.processStatus]], ["Payment", paymentLabels[request.paymentStatus]],
        ["Service amount", request.priceSnapshot.amountCents === null ? "Quote pending (not free)" : formatCurrency(request.priceSnapshot.amountCents / 100, "USD")],
        ["Trip", `${request.citySlug} / ${request.date} / ${request.groupSize} travellers`],
        ["Preferred interpreter", request.preferredInterpreterId ? "Preference received, not an assignment" : "No preference"],
        ["Interpreter", request.assignedInterpreterId ? "Assigned" : "Not yet assigned"], ["Planner", request.assignedPlannerId ? "Assigned" : "Not yet assigned"],
        ["Contact", `${request.name}: ${request.contact}`],
        ["Requirements", request.requirements.preferences?.notes || "No additional notes"],
      ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-sm text-[var(--muted)]">{label}</dt><dd className="break-words whitespace-pre-wrap">{value}</dd></div>)}</dl>
      {request.linkedRequestId ? <p className="mt-4 text-sm text-[var(--muted)]">This interpretation request is linked to a separate route request. Route and interpretation fees are not bundled.</p> : null}
      {request.serviceType === "free_route" ? <p className="mt-5 text-sm leading-6">USD 0.00 route fee. No payment required. Food, accommodation, transport and tickets are third-party costs.</p> : <p className="mt-5 text-sm leading-6">Payment policy pending. No deposit is assumed. Paid checkout is not available.</p>}
      {request.quote ? <section className="mt-6 border border-[var(--line)] bg-[var(--paper)] p-5" aria-label="Planning quote"><h4 className="font-[family:var(--font-display)] text-2xl">Quote revision {request.quote.revision}</h4><p className="mt-3 font-semibold">{formatCurrency(request.quote.amountCents / 100, "USD")}</p><p className="mt-3 break-words whitespace-pre-wrap text-base leading-7">{request.quote.scope}</p><p className="mt-3 text-sm">{request.quote.status === "accepted" ? "Quote accepted. Payment policy still pending." : request.quote.status === "superseded" ? "This quote has been replaced. Refresh to view the current quote." : "Review this scope and amount before accepting."}</p>{request.quote.status === "offered" && request.processStatus !== "cancelled" ? <button type="button" className={`${controlClass} mt-4`} disabled={busy} onClick={() => void accept()}>{busy ? "Accepting..." : `Accept revision ${request.quote.revision}`}</button> : null}</section> : null}
      <RequestConversation key={id} requestId={id} closed={request.processStatus === "completed" || request.processStatus === "cancelled"} onRead={onUpdated} onDenied={() => { setRequest(null); setError("This private request is no longer available to your session."); }} />
    </> : null}
  </article>;
}
export function RequestConversation({ requestId, closed = false, onRead, onDenied }: { requestId: string; closed?: boolean; onRead?: () => void; onDenied?: () => void }) {
  const [messages, setMessages] = useState<RequestMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [readError, setReadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [denied, setDenied] = useState(false);
  const onDeniedRef = useRef(onDenied); onDeniedRef.current = onDenied;
  const [refresh, setRefresh] = useState(0);
  const active = useRef(true);
  const sendLock = useRef(false);
  const key = useRef<string | null>(null);
  const onReadRef = useRef(onRead); onReadRef.current = onRead;
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController(); let current = true;
    setMessages([]); setCursor(null); setHasMore(false); setLoading(true); setError(""); setReadError("");
    fetchRequestMessages(requestId, undefined, controller.signal).then((result) => { if (current) { setMessages(result.data); setDenied(false); setCursor(result.nextCursor); setHasMore(result.hasMore); } }).catch((cause) => { if (current) { setError(errorText(cause)); if (isUnauthorized(cause)) { setDenied(true); setBody(""); onDeniedRef.current?.(); } } }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [requestId, refresh]);
  const markRead = async (messageId: string) => {
    setReadError("");
    try { await markRequestMessagesRead(requestId, messageId); if (active.current) onReadRef.current?.(); }
    catch (cause) { if (active.current) { setReadError(errorText(cause)); if (isUnauthorized(cause)) { setMessages([]); setBody(""); setDenied(true); onDeniedRef.current?.(); } } }
  };
  useEffect(() => {
    const last = messages.at(-1);
    if (last && document.visibilityState === "visible") void markRead(last.id);
    // Mark only the loaded segment. Never claim unseen later messages have been read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);
  const more = async () => {
    if (!cursor || loading) return;
    setLoading(true); setError("");
    try { const result = await fetchRequestMessages(requestId, cursor); if (active.current) { setMessages((prev) => [...prev, ...result.data.filter((item) => !prev.some((existing) => existing.id === item.id))]); setCursor(result.nextCursor); setHasMore(result.hasMore); } }
    catch (cause) { if (active.current) { setError(errorText(cause)); if (isUnauthorized(cause)) { setMessages([]); setBody(""); setDenied(true); onDeniedRef.current?.(); } } }
    finally { if (active.current) setLoading(false); }
  };
  const send = async () => {
    if (denied || closed || !body.trim() || body.trim().length > 4000 || sendLock.current) return;
    sendLock.current = true; setSending(true); setError("");
    try {
      key.current ??= newRequestKey();
      await sendRequestMessage(requestId, body.trim(), key.current);
      if (active.current) { setBody(""); key.current = null; setRefresh((value) => value + 1); }
    } catch (cause) { if (active.current) { setError(errorText(cause)); if (isUnauthorized(cause)) { setMessages([]); setBody(""); setDenied(true); onDeniedRef.current?.(); } } }
    finally { sendLock.current = false; if (active.current) setSending(false); }
  };
  return <section className="mt-8 border-t border-[var(--line)] pt-6" aria-label="Private conversation">
    <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-[family:var(--font-display)] text-2xl">Private conversation</h4><button type="button" className={controlClass} onClick={() => setRefresh((value) => value + 1)} disabled={loading || sending}>Refresh messages</button></div>
    {error ? <p role="alert" className="mt-4 text-sm text-[var(--cinnabar-deep)]">{error}</p> : null}
    {loading ? <p role="status" className="mt-4">Loading messages...</p> : null}
    {!loading && !messages.length && !error ? <p className="mt-4 text-base text-[var(--muted)]">No messages yet. Ask a question about this request.</p> : null}
    <ol className="mt-5 space-y-4">{messages.map((message) => <li key={message.id} className="min-w-0 border border-[var(--line)] bg-white/80 p-4"><p className="text-sm font-semibold text-[var(--river-deep)]">{message.senderType === "owner" ? "You" : "Culvoy staff"} <time dateTime={message.createdAt} className="ml-2 font-normal text-[var(--muted)]">{new Date(message.createdAt).toLocaleString("en-GB")}</time></p><p className="mt-2 break-words whitespace-pre-wrap text-base leading-7">{message.body}</p></li>)}</ol>
    {hasMore ? <button type="button" className={`${controlClass} mt-4`} onClick={() => void more()} disabled={loading}>Load later messages</button> : null}
    {readError ? <div role="alert" className="mt-4"><p className="text-sm">Read status could not be saved: {readError}</p><button type="button" className={`${controlClass} mt-3`} onClick={() => { const last = messages.at(-1); if (last) void markRead(last.id); }}>Retry read status</button></div> : null}
    {denied ? <p className="mt-6 text-sm">Private conversation unavailable. Sign in again to verify access.</p> : closed ? <p className="mt-6 text-sm leading-6 text-[var(--muted)]">This request is closed. Your conversation remains available to read.</p> : <form className="mt-6" onSubmit={(event) => { event.preventDefault(); void send(); }}><label htmlFor={`message-${requestId}`} className="block text-sm font-semibold text-[var(--river-deep)]">Your message</label><textarea id={`message-${requestId}`} rows={4} maxLength={4000} required disabled={sending} value={body} onChange={(event) => { setBody(event.target.value); key.current = null; }} className="mt-2 w-full min-w-0 border border-[var(--line)] bg-white p-4 text-base leading-7 text-[var(--ink)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--river-deep)]" aria-describedby={`message-help-${requestId}`} /><p id={`message-help-${requestId}`} className="mt-2 text-sm text-[var(--muted)]">Text only, up to 4,000 characters. Failed sends can be retried without changing the message.</p><button type="submit" disabled={sending || !body.trim()} className="btn-primary mt-4 min-h-11 disabled:opacity-50">{sending ? "Sending..." : "Send message"}</button></form>}
  </section>;
}
