export const SERVICE_TYPES = ['free_route', 'custom_route', 'interpretation'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];
export const PROCESS_STATUSES = ['received', 'assigned', 'in_progress', 'quoted', 'confirmed', 'completed', 'cancelled'] as const;
export type ProcessStatus = (typeof PROCESS_STATUSES)[number];
export type RequestPaymentStatus = 'not_required' | 'quote_required' | 'confirmation_required';
export interface ServicePackage {
  id: string;
  hours: 4 | 5 | 7;
  routeType: 'fixed' | 'custom';
  currency: 'USD';
  amountCents: number;
  enabled: boolean;
  paymentPolicy: 'not_configured';
  depositCents: null;
}
// Confirmed USD prices, not exchange-rate conversions. No deposit/payment policy
// has been approved; this registry never supplies a guessed checkout amount.
export const SERVICE_PACKAGES: readonly Readonly<ServicePackage>[] = Object.freeze([
  ['fixed4', 4, 'fixed', 30500], ['fixed5', 5, 'fixed', 37500], ['fixed7', 7, 'fixed', 52500],
  ['custom4', 4, 'custom', 40000], ['custom5', 5, 'custom', 50000], ['custom7', 7, 'custom', 70000],
].map(([id, hours, routeType, amountCents]) => Object.freeze({
  id, hours, routeType, amountCents, currency: 'USD', enabled: true,
  paymentPolicy: 'not_configured', depositCents: null,
} as ServicePackage)));
export interface PriceSnapshot {
  currency: 'USD';
  amountCents: number | null;
  source: 'free' | 'package' | 'quote_required' | 'quote';
}
export interface RequestPreferences {
  days?: number; interests?: string[]; foodPreferences?: string;
  accommodation?: string; budget?: string; budgetAmount?: string;
  budgetCurrency?: 'USD' | 'CNY' | 'SGD'; serviceContext?: string; notes?: string;
}
export interface RequestRequirements {
  languagePair?: string;
  preferences: RequestPreferences;
}
