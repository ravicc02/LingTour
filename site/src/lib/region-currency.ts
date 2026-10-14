export type RegionCurrency = {
  code: "CNY" | "SGD";
  symbol: string;
  name: string;
};

export const REGION_CURRENCY_MAP = {
  guangdong: { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  singapore: { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
} as const satisfies Record<string, RegionCurrency>;

export type ServiceRegion = keyof typeof REGION_CURRENCY_MAP;

export const DEFAULT_SERVICE_REGION: ServiceRegion = "guangdong";

export function getCurrencyForRegion(region?: string | null): RegionCurrency {
  if (region && region in REGION_CURRENCY_MAP) {
    return REGION_CURRENCY_MAP[region as ServiceRegion];
  }
  return REGION_CURRENCY_MAP[DEFAULT_SERVICE_REGION];
}

export function currencySymbol(code?: string | null): string {
  if (code === "SGD") return "S$";
  if (code === "CNY" || !code) return "¥";
  return code;
}

export function formatCurrency(amount: number, currencyCode?: string | null): string {
  const symbol = currencySymbol(currencyCode);
  return `${symbol}${amount.toFixed(2)}`;
}
