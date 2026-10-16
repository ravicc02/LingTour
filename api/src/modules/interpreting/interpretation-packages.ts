/** Approved public interpretation prices, in USD cents. No FX conversion. */
export const INTERPRETATION_PACKAGES = [
  { id: 'fixed-4h', hours: 4, routeType: 'fixed', priceCents: 30500 },
  { id: 'custom-4h', hours: 4, routeType: 'custom', priceCents: 40000 },
  { id: 'fixed-5h', hours: 5, routeType: 'fixed', priceCents: 37500 },
  { id: 'custom-5h', hours: 5, routeType: 'custom', priceCents: 50000 },
  { id: 'fixed-7h', hours: 7, routeType: 'fixed', priceCents: 52500 },
  { id: 'custom-7h', hours: 7, routeType: 'custom', priceCents: 70000 },
].map((item) => ({
  ...item,
  currency: 'USD' as const,
  title: `${item.hours}-hour interpretation — ${item.routeType === 'fixed' ? 'Fixed route' : 'Custom route'}`,
}));

export type InterpretationPackage = (typeof INTERPRETATION_PACKAGES)[number];
