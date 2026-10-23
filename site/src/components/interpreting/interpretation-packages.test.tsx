import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MultiStepForm } from "./MultiStepForm";
import { createInterpretingDepositCheckout } from "@/lib/api-data";

vi.mock("@/lib/api-data", () => ({
  fetchCities: vi.fn().mockResolvedValue([{ name: "Guangzhou" }]),
  createInterpretingDepositCheckout: vi.fn(),
}));
const packages = [{ id: "custom-5h", hours: 5, routeType: "custom" as const,
  currency: "USD" as const, priceCents: 50000, title: "5-hour interpretation — Custom route" }];

describe("interpretation package booking", () => {
  beforeEach(() => vi.clearAllMocks());
  it("submits only the selected package ID and separates its total from the server deposit", async () => {
    vi.mocked(createInterpretingDepositCheckout).mockResolvedValue({
      bookingId: "test-booking", created_at: "2026-10-17", status: "deposit_pending", message: "Received",
      package: packages[0], deposit: { amount: 90, currency: "USD", orderNo: "TEST-USD",
        status: "pending", paymentLabel: "Interpretation deposit", paypalOrderId: "test",
        paypalApprovalUrl: null, publicStatusToken: "test-token" },
    });
    render(<MultiStepForm packages={packages} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Fast Track/i }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Test Guest" } });
    fireEvent.change(screen.getByLabelText("Email / WhatsApp"), { target: { value: "guest@example.com" } });
    const submit = screen.getByRole("button", { name: "Submit request" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Interpretation package"), { target: { value: "custom-5h" } });
    expect(screen.getByText("Package total: $500.00")).toBeInTheDocument();
    fireEvent.click(submit);
    await waitFor(() => expect(createInterpretingDepositCheckout).toHaveBeenCalledOnce());
    const payload = vi.mocked(createInterpretingDepositCheckout).mock.calls[0][0];
    expect(payload.packageId).toBe("custom-5h");
    expect(payload).not.toHaveProperty("amount");
    expect(payload).not.toHaveProperty("currency");
    expect(await screen.findByText("$90.00")).toBeInTheDocument();
    expect(screen.getByText("Package total: $500.00")).toBeInTheDocument();
  });
});
