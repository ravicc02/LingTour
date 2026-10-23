import { describe, expect, it } from "vitest";
import { formatInterpretingPrice } from "../interpreting-price";
import { formatCurrency } from "../region-currency";

describe("interpreting dollar display", () => {
  it.each([
    ["From SGD 160 / half day", "$160 / half day"],
    ["From USD 280 / day", "$280 / day"],
    ["CNY 1,480 / day", "$1,480 / day"],
    ["RMB 680", "$680"],
    ["US$240.50 / day", "$240.50 / day"],
    ["S$160", "$160"],
    ["¥980", "$980"],
    ["$160 / half day", "$160 / half day"],
    ["  240 / day  ", "$240 / day"],
    ["On request", "On request"],
  ])("preserves the amount and suffix of %s", (input, expected) => {
    expect(formatInterpretingPrice(input)).toBe(expected);
  });

  it("uses the dollar sign for USD without relabeling other product currencies", () => {
    expect(formatCurrency(305, "USD")).toBe("$305.00");
    expect(formatCurrency(32, "SGD")).toBe("S$32.00");
    expect(formatCurrency(680, "CNY")).toBe("¥680.00");
  });
});
