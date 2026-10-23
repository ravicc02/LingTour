/** Display authored interpreting rates in dollars without changing their amounts. */
export function formatInterpretingPrice(value: string): string {
  const price = value.trim().replace(/^from\s+/i, "");
  return price.replace(
    /^(?:(?:USD|SGD|CNY|RMB|US\$|S\$|[¥￥$])\s*)?(?=\d)/i,
    "$",
  );
}
