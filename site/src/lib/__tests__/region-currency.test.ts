import { describe, expect, it } from "vitest";
import { currencySymbol, formatCurrency, getCurrencyForRegion } from "../region-currency";

describe("explicit currency formatting", () => {
  it("formats USD without changing historical CNY or SGD amounts", () => {
    expect(currencySymbol("USD")).toBe("US$");
    expect(formatCurrency(305, "USD")).toBe("US$305.00");
    expect(formatCurrency(90, "SGD")).toBe("S$90.00");
    expect(formatCurrency(680, "CNY")).toBe("¥680.00");
  });

  it("does not change regional shop currency defaults", () => {
    expect(getCurrencyForRegion("guangdong").code).toBe("CNY");
    expect(getCurrencyForRegion("singapore").code).toBe("SGD");
  });
});
