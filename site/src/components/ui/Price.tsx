import { formatCurrency } from "@/lib/region-currency";

type PriceProps = {
  amount: number;
  currency?: string | null;
  className?: string;
};

export function Price({ amount, currency = "CNY", className }: PriceProps) {
  return <span className={["ui-price", className].filter(Boolean).join(" ")}>{formatCurrency(amount, currency)}</span>;
}
