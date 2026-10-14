"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiPost } from "@/lib/api-client";
import { fetchStoreProductBySlug, fetchStoreProducts } from "@/lib/api-data";
import { useLocale } from "@/lib/locale-context";
import { readStoredUser } from "@/lib/auth-client";
import {
  readCart,
  rememberCheckoutItems,
  removeCartItem,
  setCartItemQuantity,
  setCartItemSelected,
} from "@/lib/cart";
import { formatCurrency } from "@/lib/region-currency";
import { countryName } from "@/lib/country-list";
import type { StoreProduct } from "@/data/store";

type CheckoutItem = StoreProduct & {
  quantity: number;
  selected: boolean;
};

type CheckoutForm = {
  email: string;
  recipientName: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  note: string;
  paymentMethod: string;
};

type CheckoutResponse = {
  orderId: string;
  orderNo: string;
  totalAmount: number;
  status: string;
  paymentMethod: "paypal";
  paypalOrderId?: string | null;
  paypalApprovalUrl?: string | null;
  publicStatusToken: string;
};

const INITIAL_FORM: CheckoutForm = {
  email: "",
  recipientName: "",
  street: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  phone: "",
  note: "",
  // PayPal-only checkout: the storefront exposes PayPal as the sole payment
  // method end to end (API included).
  paymentMethod: "paypal",
};

const CHECKOUT_FIELD_CLASS =
  "min-h-12 w-full border-0 border-b border-[var(--line)] bg-transparent px-0 py-3 text-base text-[var(--river-deep)] outline-none transition focus:border-[var(--cinnabar)] lg:text-sm";

const CHECKOUT_PANEL_CLASS =
  "min-w-0 border-t border-[var(--line)] py-7 sm:py-9";

function formatStorePrice(price: number, currency = "CNY") {
  return formatCurrency(price, currency);
}

function fillTemplate(
  template: string,
  replacements: Record<string, string | number>,
) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    replacements[key] === undefined ? `{${key}}` : String(replacements[key]),
  );
}

export function CheckoutClient() {
  const searchParams = useSearchParams();
  const productSlug = searchParams.get("product");
  const { t } = useLocale();

  const [items, setItems] = useState<CheckoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<CheckoutResponse | null>(null);
  const [form, setForm] = useState<CheckoutForm>(INITIAL_FORM);

  useEffect(() => {
    const storedUser = readStoredUser();
    if (storedUser) {
      const displayCountry = countryName(storedUser.country);
      setForm((current) => ({
        ...current,
        email: storedUser.email || current.email,
        recipientName: storedUser.name || current.recipientName,
        city: storedUser.homeBase || displayCountry || current.city,
        state: storedUser.homeBase || current.state,
        country: displayCountry || current.country,
        phone: current.phone,
      }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const storedCart = typeof window !== "undefined" ? readCart() : [];

        if (storedCart.length > 0) {
          const products = await fetchStoreProducts();
          const itemMap = new Map(products.map((item) => [item.slug, item]));
          const cartItems = storedCart.map((cartItem) => {
            const matchedProduct = itemMap.get(cartItem.slug);
            if (matchedProduct) {
              return {
                ...matchedProduct,
                id: matchedProduct.id ?? cartItem.productId,
                quantity: cartItem.quantity,
                selected: cartItem.selected !== false,
              };
            }

            return {
              id: cartItem.productId,
              slug: cartItem.slug,
              name: cartItem.name,
              collection: "",
              price: cartItem.price,
              currency: (cartItem.currency as StoreProduct["currency"]) ?? "CNY",
              image: cartItem.image ?? "",
              story: "",
              tag: "",
              quantity: cartItem.quantity,
              selected: cartItem.selected !== false,
            };
          });

          if (!cancelled) {
            setItems(cartItems);
          }
          return;
        }

        if (productSlug) {
          const product = await fetchStoreProductBySlug(productSlug);
          if (!cancelled && product) {
            setItems([{ ...product, quantity: 1, selected: true }]);
            return;
          }
          if (!cancelled) {
            setError(t("checkout.error.productNotFound"));
          }
        }
      } catch {
        setError(t("checkout.error.loadSelection"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [productSlug, t]);

  const selectedItems = useMemo(
    () => items.filter((item) => item.selected),
    [items],
  );

  const displayCurrency = selectedItems[0]?.currency ?? items[0]?.currency;

  const totals = useMemo(() => {
    if (selectedItems.length === 0) return { subtotal: 0, handling: 0, total: 0 };
    const subtotal = selectedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const handling = subtotal > 0 ? Math.max(8, subtotal * 0.06) : 0;
    return { subtotal, handling, total: subtotal + handling };
  }, [selectedItems]);

  const canSubmit = useMemo(() => {
    return Boolean(
      selectedItems.length &&
        form.email.trim() &&
        form.recipientName.trim() &&
        form.street.trim() &&
        form.city.trim() &&
        form.state.trim() &&
        form.postalCode.trim() &&
        form.country.trim(),
    );
  }, [form, selectedItems.length]);

  const updateCartSelection = (slug: string, selected: boolean) => {
    setCartItemSelected(slug, selected);
    setItems((current) =>
      current.map((item) => (item.slug === slug ? { ...item, selected } : item)),
    );
  };

  const updateCartQuantity = (slug: string, quantity: number) => {
    setCartItemQuantity(slug, quantity);
    setItems((current) =>
      current.map((item) =>
        item.slug === slug
          ? { ...item, quantity: Math.max(1, Math.floor(quantity)) }
          : item,
      ),
    );
  };

  const deleteCartItem = (slug: string) => {
    removeCartItem(slug);
    setItems((current) => current.filter((item) => item.slug !== slug));
  };

  const updateField = (field: keyof CheckoutForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const formatOrderStatus = useCallback(
    (status: string) => {
      const statusKeyMap: Record<string, string> = {
        pending: "checkout.success.statusPending",
        confirmed: "checkout.success.statusConfirmed",
        shipped: "checkout.success.statusShipped",
        delivered: "checkout.success.statusDelivered",
        cancelled: "checkout.success.statusCancelled",
      };

      const key = statusKeyMap[status];
      return key ? t(key) : status.replace(/_/g, " ");
    },
    [t],
  );

  const submitOrder = async () => {
    if (!canSubmit || submitting) return;

    const incomplete = selectedItems.find((item) => !item.id);
    if (incomplete) {
      setError(
        fillTemplate(t("checkout.error.itemUnavailable"), {
          item: incomplete.name,
        }),
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        guestEmail: form.email.trim(),
        items: selectedItems.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
        shippingAddress: {
          recipientName: form.recipientName.trim(),
          street: form.street.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          postalCode: form.postalCode.trim(),
          country: form.country.trim(),
          phone: form.phone.trim() || undefined,
        },
        paymentMethod: form.paymentMethod,
      };

      const created = await apiPost<CheckoutResponse>("/orders/checkout", payload);
      rememberCheckoutItems(
        created.orderNo,
        selectedItems.map((item) => item.slug),
      );
      setOrderResult(created);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t("checkout.error.createOrder"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100dvh-var(--site-header-height))] bg-[var(--paper-deep)] bg-grain">
        <div className="flex min-h-[calc(100dvh-var(--site-header-height))] items-center justify-center">
          <p className="text-base text-[var(--muted)]">
            {t("checkout.empty.loading")}
          </p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[calc(100dvh-var(--site-header-height))] bg-[var(--paper-deep)] bg-grain">
        <div className="site-container flex min-h-[calc(100dvh-var(--site-header-height))] flex-col items-center justify-center gap-6 py-12 text-center">
          <h1 className="font-[family:var(--font-display)] text-3xl text-[var(--river-deep)] sm:text-4xl">
            {error
              ? t("checkout.empty.productUnavailableTitle")
              : t("checkout.empty.bagTitle")}
          </h1>
          <p className="max-w-md text-center text-sm leading-6 text-[var(--muted)]" role={error ? "alert" : undefined}>
            {error || t("checkout.empty.bagBody")}
          </p>
          <Link href="/shop" className="lt-action lt-action-secondary">
            {t("checkout.empty.returnToStore")}
          </Link>
        </div>
      </div>
    );
  }

  if (orderResult && orderResult.paymentMethod === "paypal" && orderResult.paypalApprovalUrl) {
    return (
      <div className="min-h-screen bg-[var(--paper-deep)] bg-grain px-6 py-16 text-[var(--river-deep)] lg:px-16">
        <div className="mx-auto max-w-xl border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-panel sm:p-10">
          <p className="text-[12px] font-bold uppercase tracking-[0.3em] text-[var(--cinnabar)]">
            {t("checkout.page.paymentEyebrow")}
          </p>
          <h1 className="mt-4 font-[family:var(--font-display)] text-4xl leading-[0.96] tracking-[-0.04em]">
            {t("checkout.payment.paypalTitle")}
          </h1>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
            {fillTemplate(t("checkout.payment.paypalBody"), {
              orderNo: orderResult.orderNo,
            })}
          </p>
          <div className="mt-6 mb-2 flex items-end justify-between border-b border-[var(--line)] pb-4">
            <span className="text-sm text-[var(--muted)]">{t("checkout.summary.total")}</span>
            <span className="font-[family:var(--font-display)] text-3xl text-[var(--river-deep)]">
              {formatStorePrice(orderResult.totalAmount, displayCurrency)}
            </span>
          </div>
          <a
            href={orderResult.paypalApprovalUrl}
            className="mt-8 inline-flex min-h-12 w-full items-center justify-center bg-[var(--river-deep)] px-8 py-4 text-center font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-white transition hover:bg-[var(--cinnabar)] active:scale-[0.985]"
          >
            {t("checkout.payment.paypalContinue")}
          </a>
        </div>
      </div>
    );
  }

  if (orderResult) {
    return (
      <div className="min-h-screen bg-[var(--paper-deep)] bg-grain px-6 py-16 text-[var(--river-deep)] lg:px-16">
        <div className="mx-auto max-w-3xl rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-panel sm:p-10">
          <h1 className="mt-4 font-[family:var(--font-display)] text-5xl leading-[0.94] tracking-[-0.04em]">
            {t("checkout.success.registryConfirmed")}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--muted)]">
            {t("checkout.success.orderMessage")}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-white/65 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
                {t("checkout.success.orderNo")}
              </p>
              <p className="mt-2 text-lg font-bold text-[var(--river-deep)]">
                {orderResult.orderNo}
              </p>
            </div>
            <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-white/65 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
                {t("checkout.success.status")}
              </p>
              <p className="mt-2 text-lg font-bold capitalize text-[var(--river-deep)]">
                {formatOrderStatus(orderResult.status)}
              </p>
            </div>
            <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-white/65 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
                {t("checkout.success.total")}
              </p>
              <p className="mt-2 text-lg font-bold text-[var(--river-deep)]">
                {formatStorePrice(orderResult.totalAmount, displayCurrency)}
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/shop" className="lt-action lt-action-primary">
              {t("checkout.success.continueBrowsing")}
            </Link>
            <Link href="/community" className="lt-action lt-action-secondary">
              {t("checkout.success.visitCommunity")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--paper-deep)] bg-grain py-10 text-[var(--river-deep)] sm:py-beat">
      <div className="site-container grid min-h-screen min-w-0 gap-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)] lg:gap-16 xl:gap-24">
        <section className="min-w-0">
          <div className="min-w-0">
            <div className="mb-10 sm:mb-12">
              <h1 className="font-[family:var(--font-display)] text-4xl leading-none tracking-[-0.04em] whitespace-nowrap sm:text-5xl lg:text-6xl">
                {t("checkout.page.heading")}
              </h1>
            </div>

            {error ? (
              <div className="mb-8 border-l-2 border-[var(--cinnabar)] bg-[var(--cinnabar)]/6 px-4 py-3 text-sm text-[var(--cinnabar)]" role="alert">
                {error}
              </div>
            ) : null}

            <div className="grid min-w-0">
              <section className={CHECKOUT_PANEL_CLASS}>
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--cinnabar)]">
                  {t("checkout.form.contactSection")}
                </p>
                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <label htmlFor="checkout-email" className="grid gap-2 sm:col-span-2">
                    <span className="sr-only">{t("checkout.form.email")}</span>
                    <span aria-hidden="true" className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                      {t("checkout.form.email")}
                    </span>
                    <input
                      id="checkout-email"
                      value={form.email}
                      onChange={(event) => updateField("email", event.target.value)}
                      className={CHECKOUT_FIELD_CLASS}
                      placeholder={t("checkout.form.emailPlaceholder")}
                    />
                  </label>
                  <label htmlFor="checkout-recipient-name" className="grid gap-2 sm:col-span-2">
                    <span className="sr-only">{t("checkout.form.recipientName")}</span>
                    <span aria-hidden="true" className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                      {t("checkout.form.recipientName")}
                    </span>
                    <input
                      id="checkout-recipient-name"
                      value={form.recipientName}
                      onChange={(event) => updateField("recipientName", event.target.value)}
                      className={CHECKOUT_FIELD_CLASS}
                      placeholder={t("checkout.form.namePlaceholder")}
                    />
                  </label>
                  <label htmlFor="checkout-phone" className="grid gap-2">
                    <span className="sr-only">{t("checkout.form.phone")}</span>
                    <span aria-hidden="true" className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                      {t("checkout.form.phone")}
                    </span>
                    <input
                      id="checkout-phone"
                      value={form.phone}
                      onChange={(event) => updateField("phone", event.target.value)}
                      className={CHECKOUT_FIELD_CLASS}
                      placeholder={t("checkout.form.phonePlaceholder")}
                    />
                  </label>
                  <div className="grid gap-2">
                    <span aria-hidden="true" className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                      {t("checkout.form.paymentMethod")}
                    </span>
                    <p className="flex min-h-12 items-center border-b border-[var(--line)] text-base text-[var(--river-deep)] lg:text-sm">
                      PayPal
                    </p>
                  </div>
                </div>
              </section>

              <section className={CHECKOUT_PANEL_CLASS}>
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--cinnabar)]">
                  {t("checkout.form.addressSection")}
                </p>
                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <label htmlFor="checkout-street" className="grid gap-2 sm:col-span-2">
                    <span className="sr-only">{t("checkout.form.streetAddress")}</span>
                    <span aria-hidden="true" className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                      {t("checkout.form.streetAddress")}
                    </span>
                    <input
                      id="checkout-street"
                      value={form.street}
                      onChange={(event) => updateField("street", event.target.value)}
                      className={CHECKOUT_FIELD_CLASS}
                      placeholder={t("checkout.form.addressPlaceholder")}
                    />
                  </label>
                  <label htmlFor="checkout-city" className="grid gap-2">
                    <span className="sr-only">{t("checkout.form.city")}</span>
                    <span aria-hidden="true" className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                      {t("checkout.form.city")}
                    </span>
                    <input
                      id="checkout-city"
                      value={form.city}
                      onChange={(event) => updateField("city", event.target.value)}
                      className={CHECKOUT_FIELD_CLASS}
                      placeholder={t("checkout.form.cityPlaceholder")}
                    />
                  </label>
                  <label htmlFor="checkout-state" className="grid gap-2">
                    <span className="sr-only">{t("checkout.form.state")}</span>
                    <span aria-hidden="true" className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                      {t("checkout.form.state")}
                    </span>
                    <input
                      id="checkout-state"
                      value={form.state}
                      onChange={(event) => updateField("state", event.target.value)}
                      className={CHECKOUT_FIELD_CLASS}
                      placeholder={t("checkout.form.statePlaceholder")}
                    />
                  </label>
                  <label htmlFor="checkout-postal-code" className="grid gap-2">
                    <span className="sr-only">{t("checkout.form.postalCode")}</span>
                    <span aria-hidden="true" className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                      {t("checkout.form.postalCode")}
                    </span>
                    <input
                      id="checkout-postal-code"
                      value={form.postalCode}
                      onChange={(event) => updateField("postalCode", event.target.value)}
                      className={CHECKOUT_FIELD_CLASS}
                      placeholder={t("checkout.form.postalCodePlaceholder")}
                    />
                  </label>
                  <label htmlFor="checkout-country" className="grid gap-2">
                    <span className="sr-only">{t("checkout.form.country")}</span>
                    <span aria-hidden="true" className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                      {t("checkout.form.country")}
                    </span>
                    <input
                      id="checkout-country"
                      value={form.country}
                      onChange={(event) => updateField("country", event.target.value)}
                      className={CHECKOUT_FIELD_CLASS}
                      placeholder={t("checkout.form.countryPlaceholder")}
                    />
                  </label>
                </div>
              </section>

              <section className={CHECKOUT_PANEL_CLASS}>
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--cinnabar)]">
                  {t("checkout.form.handlingNote")}
                </p>
                <label htmlFor="checkout-note" className="mt-5 block">
                  <span className="sr-only">{t("checkout.form.handlingNote")}</span>
                  <textarea
                    id="checkout-note"
                    value={form.note}
                    onChange={(event) => updateField("note", event.target.value)}
                    className="min-h-[120px] w-full resize-y border-0 border-b border-[var(--line)] bg-transparent px-0 py-4 text-base leading-7 outline-none transition focus:border-[var(--cinnabar)] lg:text-sm"
                    placeholder={t("checkout.form.notesPlaceholder")}
                  />
                </label>
              </section>
            </div>
          </div>
        </section>

        <aside className="min-w-0 border-t border-[var(--line)] pt-10 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0 xl:pl-14">
          {/* Bounded so the summary can scroll internally. Without a max
              height, a cart of four or more items pushes the submit button
              below the fold of a pinned column, where it can never be
              reached. */}
          <div className="sticky top-24 max-h-[calc(100svh-7rem)] overflow-y-auto overscroll-contain">
            <div className="border-y border-[var(--line)] py-7 sm:py-9">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
                {t("checkout.summary.title")}
              </p>
              <div className="mt-6">
                {items.map((item) => (
                  <div
                    key={item.slug}
                    className={`border-t border-[var(--line)] py-5 last:border-b ${
                      item.selected ? "" : "opacity-55"
                    }`}
                  >
                    <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:gap-4">
                      <img src={item.image} alt="" className="h-12 w-12 shrink-0 object-cover sm:h-16 sm:w-16" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--river-deep)]">
                          {item.name}
                        </p>
                        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--gold)]">
                          {formatStorePrice(item.price * item.quantity, item.currency)}
                        </p>
                      </div>
                      <label className="grid min-h-11 min-w-11 cursor-pointer place-items-center">
                        <span className="sr-only">
                          {fillTemplate(
                            t(
                              item.selected
                                ? "checkout.cart.unselectItem"
                                : "checkout.cart.selectItem",
                            ),
                            { item: item.name },
                          )}
                        </span>
                        <input
                          type="checkbox"
                          checked={item.selected}
                          aria-label={fillTemplate(
                            t(
                              item.selected
                                ? "checkout.cart.unselectItem"
                                : "checkout.cart.selectItem",
                            ),
                            { item: item.name },
                          )}
                          onChange={(event) =>
                            updateCartSelection(item.slug, event.target.checked)
                          }
                          className="h-5 w-5 accent-[var(--river-deep)]"
                        />
                      </label>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pl-[3.75rem] sm:pl-20">
                      <div className="inline-grid grid-cols-[2.75rem_auto_2.75rem] items-center border border-[var(--line)] bg-white/45">
                        <button
                          type="button"
                          onClick={() =>
                            updateCartQuantity(item.slug, item.quantity - 1)
                          }
                          disabled={item.quantity <= 1}
                          className="grid min-h-11 min-w-11 place-items-center text-lg text-[var(--river-deep)] transition hover:bg-white disabled:cursor-not-allowed disabled:text-[var(--muted)]/45"
                          aria-label={fillTemplate(t("checkout.cart.decreaseQuantity"), {
                            item: item.name,
                          })}
                        >
                          −
                        </button>
                        <span className="min-w-10 text-center text-sm font-bold text-[var(--river-deep)]" aria-label={fillTemplate(t("checkout.summary.quantity"), { count: item.quantity })}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateCartQuantity(item.slug, item.quantity + 1)
                          }
                          className="grid min-h-11 min-w-11 place-items-center text-lg text-[var(--river-deep)] transition hover:bg-white"
                          aria-label={fillTemplate(t("checkout.cart.increaseQuantity"), {
                            item: item.name,
                          })}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteCartItem(item.slug)}
                        className="min-h-11 px-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--muted)] underline decoration-[var(--line)] underline-offset-4 transition hover:text-[var(--cinnabar)]"
                        aria-label={fillTemplate(t("checkout.cart.removeItem"), {
                          item: item.name,
                        })}
                      >
                        {t("checkout.cart.remove")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {selectedItems.length === 0 ? (
                <p className="mt-5 border border-[var(--gold)]/30 bg-[var(--gold)]/8 px-4 py-3 text-xs leading-6 text-[var(--muted)]" role="status">
                  {t("checkout.cart.selectAtLeastOne")}
                </p>
              ) : null}

              <div className="mt-8 space-y-4 border-t border-[var(--line)] pt-6">
                <div className="flex items-center justify-between text-sm text-[var(--muted)]">
                  <span>{t("checkout.summary.subtotal")}</span>
                  <span className="font-semibold text-[var(--river-deep)]">
                    {formatStorePrice(totals.subtotal, displayCurrency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-[var(--muted)]">
                  <span>{t("checkout.summary.shipping")}</span>
                  <span className="font-semibold text-[var(--river-deep)]">
                    {formatStorePrice(totals.handling, displayCurrency)}
                  </span>
                </div>
                <div className="border-t border-[var(--line)] pt-5">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--cinnabar)]">
                      {t("checkout.summary.orderTotal")}
                    </p>
                    <p className="shrink-0 font-[family:var(--font-display)] text-4xl text-[var(--river-deep)]">
                      {formatStorePrice(totals.total, displayCurrency)}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {t("checkout.summary.operationsNote")}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={submitOrder}
                disabled={!canSubmit || submitting}
                className={`mt-8 min-h-[3.25rem] w-full border px-8 py-4 font-mono text-[11px] font-bold uppercase tracking-[0.2em] transition ${
                  canSubmit && !submitting
                    ? "border-[var(--river-deep)] bg-[var(--river-deep)] text-white hover:border-[var(--cinnabar)] hover:bg-[var(--cinnabar)]"
                    : "cursor-not-allowed border-[var(--line)] bg-transparent text-[var(--muted)]"
                }`}
              >
                {submitting ? t("checkout.form.creatingOrder") : t("checkout.form.placeOrder")}
              </button>

              <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
                {t("checkout.payment.nextStep")}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
