import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import InterpretingPageClient from "./InterpretingPageClient";
const select = vi.hoisted(() => ({ id: "76c8977d-82ec-47a0-9d19-7e36708ee7da" }));
vi.mock("@/lib/locale-context", () => ({ useLocale: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/preview", () => ({ usePreviewBridge: () => ({ previewData: null }) }));
vi.mock("@/lib/use-api-query", () => ({ useApiQuery: (_query: unknown, _deps: unknown, options: { initialData: unknown }) => ({ data: options.initialData, loading: false }), LoadingSpinner: () => null, ErrorState: () => null }));
vi.mock("@/components/ui/Reveal", () => ({ Reveal: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/ui/PastoralPageMotion", () => ({ PastoralPageMotion: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/layout/MobileStickyActions", () => ({ MobileStickyActions: () => null }));
vi.mock("@/components/interpreting/InterpreterShowcase", () => ({ InterpreterShowcase: ({ profiles, onSelectGuide }: { profiles: { id: string; level?: string; needsPrefill: string }[]; onSelectGuide: (profile: unknown) => void }) => <button onClick={() => onSelectGuide(profiles[0])}>Select {profiles[0].level || "no synthetic level"}</button> }));
vi.mock("@/components/interpreting/BookingSection", () => ({ BookingSection: ({ preferredInterpreterId }: { preferredInterpreterId?: string }) => <p>{preferredInterpreterId}</p> }));
vi.mock("@/lib/service-requests", () => ({ fetchServicePackages: () => Promise.resolve({ packages: [["fixed4", 4, "fixed", 30500], ["fixed5", 5, "fixed", 37500], ["fixed7", 7, "fixed", 52500], ["custom4", 4, "custom", 40000], ["custom5", 5, "custom", 50000], ["custom7", 7, "custom", 70000]].map(([id, hours, routeType, amountCents]) => ({ id, hours, routeType, amountCents, currency: "USD", enabled: true })) }) }));
afterEach(cleanup);
describe("Interpretation package catalogue", () => {
  it("shows only API USD monetary values, preserves CMS descriptions and forwards real preferred IDs", async () => {
    render(<InterpretingPageClient initialInterpretingData={{ serviceModes: [{ id: "mode", sortOrder: 0, title: "Market support", price: "From SGD 680 / half day", body: "CMS service body", includes: ["Conversation support"], bestFor: "Market visits", accent: "light", featured: false }], profiles: [{ id: select.id, sortOrder: 0, name: "Interpreter", language: "English / Cantonese", focus: "Cultural context", helps: [] }], faqs: [] }} />);
    for (const amount of [305, 375, 525, 400, 500, 700]) expect(await screen.findByText(`US$${amount}.00`)).toBeInTheDocument();
    expect(screen.queryByText(/SGD 680/)).not.toBeInTheDocument(); expect(screen.queryByText(/¥680/)).not.toBeInTheDocument(); expect(screen.getByText("CMS service body")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select no synthetic level" })); await waitFor(() => expect(screen.getByText(select.id)).toBeInTheDocument());
    expect(screen.getByText("Payment policy pending. No deposit amount is assumed and new checkout is not available.")).toBeInTheDocument();
  });
});
