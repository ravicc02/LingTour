import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MultiStepForm } from "./MultiStepForm";

vi.mock("@/lib/locale-context", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/api-data", () => ({
  fetchCities: vi.fn().mockResolvedValue([{ name: "Zhanjiang" }]),
  createInterpretingDepositCheckout: vi.fn(),
}));

afterEach(cleanup);

describe("Interpreting date control alignment", () => {
  it("uses the same sizing utilities as its adjacent fields", async () => {
    render(<MultiStepForm />);
    const name = await screen.findByRole("textbox", { name: "interpreting.flow.name" });
    const date = screen.getByRole("button", { name: "interpreting.flow.serviceDate" });
    for (const control of [name, date]) {
      expect(control).toHaveClass("min-h-[54px]", "leading-6", "py-3.5", "md:text-[15px]");
    }
  });

  it("fits days to their grid tracks and keeps weekday centers on the same grid", async () => {
    render(<MultiStepForm />);
    const trigger = await screen.findByRole("button", { name: "interpreting.flow.serviceDate" });
    fireEvent.click(trigger);
    const calendar = screen.getByRole("dialog", { name: "interpreting.flow.calendarLabel" });
    const weekdayGrid = within(calendar).getByText("Su").parentElement;
    const dayButtons = within(calendar).getAllByRole("button").filter((button) => button.hasAttribute("aria-pressed"));
    expect(dayButtons.length).toBeGreaterThanOrEqual(28);
    expect(weekdayGrid).toHaveClass("grid-cols-7", "gap-0.5");
    expect(dayButtons[0].parentElement).toHaveClass("grid-cols-7", "gap-0.5");
    for (const day of dayButtons) {
      expect(day).toHaveClass("w-full", "min-w-0");
      expect(day).not.toHaveClass("w-10");
    }
    fireEvent.click(dayButtons[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).not.toHaveTextContent("interpreting.flow.chooseDate");
  });
});
