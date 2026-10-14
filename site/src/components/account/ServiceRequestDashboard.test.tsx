import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceRequestDashboard, RequestConversation } from "./ServiceRequestDashboard";
import { ApiRequestError } from "@/lib/api-client";
const mocks = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), messages: vi.fn(), read: vi.fn(), send: vi.fn(), accept: vi.fn(), query: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(mocks.query) }));
vi.mock("@/lib/service-requests", async (original) => ({ ...await original<typeof import("@/lib/service-requests")>(), fetchServiceRequests: mocks.list, fetchServiceRequest: mocks.detail, fetchRequestMessages: mocks.messages, markRequestMessagesRead: mocks.read, sendRequestMessage: mocks.send, acceptRequestQuote: mocks.accept }));
const id = "bc6c5f81-5e66-47c9-a552-50c729c36ac2";
const request = { id, serviceType: "custom_route", citySlug: "zhanjiang", date: "2099-10-20", groupSize: 2, name: "Owner", contact: "private@example.test", requirements: { preferences: { notes: "Private requirements" } }, preferredInterpreterId: "preferred", assignedInterpreterId: null, assignedPlannerId: null, processStatus: "quoted", paymentStatus: "quote_required", priceSnapshot: { currency: "USD", amountCents: null, source: "quote_required" }, quote: { id: "quote-id", revision: 3, amountCents: 45000, currency: "USD", scope: "Three days of route planning", status: "offered" }, unreadCount: 1, checkoutEnabled: false, paymentPolicy: "not_configured" };
const message = { id: "message-one", body: "Private staff message", senderType: "staff", createdAt: "2026-10-14T12:00:00.000Z" };
beforeEach(() => {
  vi.clearAllMocks(); mocks.query = "";
  mocks.list.mockResolvedValue({ data: [request], total: 1, page: 1, size: 20 }); mocks.detail.mockResolvedValue(request);
  mocks.messages.mockResolvedValue({ data: [message], hasMore: false, nextCursor: message.id, unreadCount: 1 }); mocks.read.mockResolvedValue({ ok: true }); mocks.send.mockResolvedValue({ ...message, body: "Owner message", senderType: "owner" });
  mocks.accept.mockResolvedValue({ ...request, processStatus: "confirmed", paymentStatus: "confirmation_required", priceSnapshot: { currency: "USD", amountCents: 45000, source: "quote" }, quote: { ...request.quote, status: "accepted" } });
});
afterEach(cleanup);
describe("Service request dashboard", () => {
  it("displays independent process/payment status and exact quote revision acceptance without checkout", async () => {
    mocks.query = `requestId=${id}`; render(<ServiceRequestDashboard userId="owner-one" />);
    await screen.findByText("Quote revision 3"); expect(screen.getByText("Quote pending (not free)")).toBeInTheDocument(); expect(screen.getByText("Preference received, not an assignment")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Accept revision 3" })); await screen.findByText("Quote accepted. Payment policy still pending.");
    expect(mocks.accept).toHaveBeenCalledWith(id, expect.objectContaining({ id: "quote-id", revision: 3 })); expect(screen.queryByText(/PayPal/)).not.toBeInTheDocument();
    expect(screen.getByText("Payment policy pending. No deposit is assumed. Paid checkout is not available.")).toBeInTheDocument();
  });
  it("clears another account's late request fetch and resets private detail on identity change", async () => {
    let resolveFirst!: (result: unknown) => void; mocks.list.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
    const { rerender } = render(<ServiceRequestDashboard userId="owner-one" />); mocks.list.mockResolvedValue({ data: [], total: 0, page: 1, size: 20 });
    rerender(<ServiceRequestDashboard userId="owner-two" />); await screen.findByText("No service requests yet.");
    resolveFirst({ data: [request], total: 1, page: 1, size: 20 }); await waitFor(() => expect(screen.queryByText("Custom Route Request")).not.toBeInTheDocument());
    expect(screen.queryByText("private@example.test")).not.toBeInTheDocument();
  });
  it("never shows private detail when API ownership is denied", async () => {
    mocks.query = `requestId=${id}`; mocks.detail.mockRejectedValue(new ApiRequestError({ statusCode: 404, message: "Request not found" }));
    render(<ServiceRequestDashboard userId="other-owner" />); await screen.findByText("Request not found"); expect(screen.queryByText("Private requirements")).not.toBeInTheDocument(); expect(mocks.messages).not.toHaveBeenCalled();
  });
});
describe("Private request conversations", () => {
  it("reads only loaded messages and pages through later text", async () => {
    mocks.messages.mockResolvedValueOnce({ data: [message], hasMore: true, nextCursor: message.id, unreadCount: 2 }).mockResolvedValueOnce({ data: [{ ...message, id: "message-two", body: "Later message" }], hasMore: false, nextCursor: "message-two", unreadCount: 1 });
    render(<RequestConversation requestId={id} />); await screen.findByText("Private staff message"); await waitFor(() => expect(mocks.read).toHaveBeenCalledWith(id, message.id));
    fireEvent.click(screen.getByRole("button", { name: "Load later messages" })); await screen.findByText("Later message");
    expect(mocks.messages).toHaveBeenCalledWith(id, message.id); expect(mocks.read).toHaveBeenCalledWith(id, "message-two");
  });
  it("retries a failed send using the same key and renders text rather than HTML", async () => {
    mocks.send.mockRejectedValueOnce(new Error("Send failed")).mockResolvedValueOnce(message);
    render(<RequestConversation requestId={id} />); await screen.findByText("Private staff message");
    fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "<script>private text</script>" } }); fireEvent.click(screen.getByRole("button", { name: "Send message" })); await screen.findByText("Send failed");
    fireEvent.click(screen.getByRole("button", { name: "Send message" })); await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2)); expect(mocks.send.mock.calls[0][2]).toBe(mocks.send.mock.calls[1][2]); expect(mocks.send.mock.calls[0][1]).toBe("<script>private text</script>");
    expect(document.querySelector("script")).toBeNull();
  });
  it("provides read failure retry and hides sending for closed requests", async () => {
    mocks.read.mockRejectedValueOnce(new Error("Read failed")).mockResolvedValueOnce({ ok: true });
    render(<RequestConversation requestId={id} closed />); await screen.findByRole("button", { name: "Retry read status" }); fireEvent.click(screen.getByRole("button", { name: "Retry read status" })); await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: "Send message" })).not.toBeInTheDocument(); expect(screen.getByText("This request is closed. Your conversation remains available to read.")).toBeInTheDocument();
  });
});
