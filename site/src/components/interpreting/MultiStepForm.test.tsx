import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MultiStepForm } from "./MultiStepForm";
import { ApiRequestError } from "@/lib/api-client";

const mocks = vi.hoisted(() => ({ query: "", create: vi.fn(), auth: vi.fn(), cities: vi.fn(), routes: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(mocks.query) }));
vi.mock("@/lib/api-client", async (original) => ({ ...await original<typeof import("@/lib/api-client")>(), apiGet: mocks.auth }));
vi.mock("@/lib/api-data", () => ({ fetchCities: mocks.cities, fetchRoutes: mocks.routes }));
vi.mock("@/lib/service-requests", async (original) => ({ ...await original<typeof import("@/lib/service-requests")>(), createServiceRequest: mocks.create, fetchServicePackages: () => Promise.resolve({ packages: packages, checkoutEnabled: false, paymentPolicy: "not_configured" }) }));
const routeId = "6c5b6703-86f2-4ebf-9e10-e08f6cbfab12";
const packages = [
  ["fixed4", 4, "fixed", 30500], ["fixed5", 5, "fixed", 37500], ["fixed7", 7, "fixed", 52500],
  ["custom4", 4, "custom", 40000], ["custom5", 5, "custom", 50000], ["custom7", 7, "custom", 70000],
].map(([id, hours, routeType, amountCents]) => ({ id, hours, routeType, amountCents, currency: "USD", enabled: true, paymentPolicy: "not_configured", depositCents: null }));
const change = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });
async function trip() {
  await screen.findByRole("option", { name: "Zhanjiang" });
  change("City (required)", "zhanjiang"); change("Service date (required)", "2099-10-20"); change("Group size (required)", "2");
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}
async function contact() {
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  change("Name (required)", "Traveller"); change("Email / WhatsApp (required)", "traveller@example.test");
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.query = ""; sessionStorage.clear();
  mocks.auth.mockResolvedValue({ id: "owner" });
  mocks.cities.mockResolvedValue([{ name: "Zhanjiang", slug: "zhanjiang" }]);
  mocks.routes.mockResolvedValue([{ id: routeId, title: "Southern sea", citySlugs: ["zhanjiang"] }]);
  mocks.create.mockResolvedValue({ id: routeId, serviceType: "free_route", citySlug: "zhanjiang", date: "2099-10-20", groupSize: 2 });
});
afterEach(cleanup);

describe("Interpreting date control alignment", () => {
  it("uses the same sizing utilities as adjacent fields in the new trip step", async () => {
    render(<MultiStepForm />);
    const city = await screen.findByLabelText("City (required)");
    const date = screen.getByLabelText("Service date (required)");
    for (const control of [city, date]) expect(control).toHaveClass("min-h-[54px]", "leading-6", "py-3.5", "md:text-[15px]");
  });
  it("replaces the seven-column custom grid with an accessible native calendar and keeps date track width", async () => {
    render(<MultiStepForm />);
    const date = await screen.findByLabelText("Service date (required)");
    expect(date).toHaveAttribute("type", "date"); expect(date).toHaveAttribute("required"); expect(date).toHaveClass("w-full", "min-w-0");
    await screen.findByRole("option", { name: "Zhanjiang" });
    expect(date).toHaveValue(""); fireEvent.change(date, { target: { value: "2099-10-20" } }); expect(date).toHaveValue("2099-10-20");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
describe("Service requests", () => {
  it("has no fabricated city/date and does not advance invalid trip details", async () => {
    render(<MultiStepForm />); await screen.findByRole("option", { name: "Zhanjiang" });
    expect(screen.getByLabelText("City (required)")).toHaveValue(""); expect(screen.getByLabelText("Service date (required)")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Choose a published city.")).toBeInTheDocument(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("submits a real fixed UUID free request without monetary payload or checkout", async () => {
    render(<MultiStepForm serviceType="free_route" />); await trip(); change("Published route (required)", routeId); await contact();
    fireEvent.click(screen.getByRole("button", { name: "Send request" })); await screen.findByText("Request received");
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ serviceType: "free_route", routeId, date: "2099-10-20", citySlug: "zhanjiang", groupSize: 2 }), expect.any(String));
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty("amountCents"); expect(mocks.create.mock.calls[0][0]).not.toHaveProperty("packageId");
    expect(screen.getByText("USD 0.00 route fee. No payment required.")).toBeInTheDocument(); expect(screen.queryByText(/PayPal/)).not.toBeInTheDocument();
  });
  it("renders all exact API USD prices and tracks preferred interpreter as unconfirmed", async () => {
    const interpreterId = "c6456a12-1c67-4c6b-86b6-5655ec3f04b2";
    mocks.query = `citySlug=zhanjiang&interpreterId=${interpreterId}`;
    render(<MultiStepForm />); await screen.findByRole("option", { name: "Zhanjiang" });
    change("Service date (required)", "2099-10-20"); change("Group size (required)", "2"); fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    for (const value of [305, 375, 525, 400, 500, 700]) expect(screen.getByRole("option", { name: new RegExp(`US\\$${value}\\.00`) })).toBeInTheDocument();
    change("Interpretation package (required)", "fixed4"); change("Published route (required)", routeId); change("Languages needed (required)", "English / Mandarin");
    expect(screen.getByText(/Availability and assignment are not confirmed/)).toBeInTheDocument(); await contact(); fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ packageId: "fixed4", preferredInterpreterId: interpreterId, languagePair: "English / Mandarin" }), expect.any(String)));
  });
  it("collects structured paid planning requirements instead of calling it free", async () => {
    render(<MultiStepForm serviceType="custom_route" />); await trip();
    change("Number of days (required)", "3"); change("Scenic places and interests (comma-separated)", "heritage, coast"); change("Food preferences", "Vegetarian"); change("Accommodation requirements", "Step-free access"); change("Trip budget amount (required)", "1500.50"); change("Budget currency", "CNY");
    await contact(); expect(screen.getAllByText("Planning fee: quote pending").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Send request" })); await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create.mock.calls[0][0].preferences).toMatchObject({ days: 3, interests: ["heritage", "coast"], foodPreferences: "Vegetarian", accommodation: "Step-free access", budgetAmount: "1500.50", budgetCurrency: "CNY" });
  });
  it("reuses the idempotency key on retry and renews it after form changes", async () => {
    mocks.create.mockRejectedValue(new Error("Network unavailable"));
    render(<MultiStepForm serviceType="free_route" />); await trip(); change("Published route (required)", routeId); await contact();
    fireEvent.click(screen.getByRole("button", { name: "Send request" })); await screen.findByText("Network unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Send request" })); await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[0][1]).toBe(mocks.create.mock.calls[1][1]);
    change("Name (required)", "Different Traveller"); fireEvent.click(screen.getByRole("button", { name: "Send request" })); await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(3));
    expect(mocks.create.mock.calls[2][1]).not.toBe(mocks.create.mock.calls[0][1]);
  });
  it("requires auth before submitting, preserves query context without storing PII", async () => {
    mocks.auth.mockRejectedValue(new ApiRequestError({ statusCode: 401, message: "Unauthorized" }));
    render(<MultiStepForm serviceType="free_route" />); await trip(); change("Published route (required)", routeId); await contact();
    fireEvent.click(screen.getByRole("button", { name: "Send request" })); const login = await screen.findByRole("link", { name: "Sign in to submit" });
    const next = decodeURIComponent(login.getAttribute("href")!);
    expect(next).toContain(`routeId=${routeId}`); expect(next).toContain("citySlug=zhanjiang"); expect(next).not.toContain("traveller@example.test");
    expect(sessionStorage.getItem("culvoy-service-trip-draft")).not.toContain("traveller@example.test"); expect(mocks.create).not.toHaveBeenCalled();
  });
});
