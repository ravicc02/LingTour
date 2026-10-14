"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { PastoralPageMotion } from "@/components/ui/PastoralPageMotion";
import { Price } from "@/components/ui/Price";
import { ProfileCalendar } from "@/components/profile/ProfileCalendar";
import { ServiceRequestDashboard } from "@/components/account/ServiceRequestDashboard";
import {
  clearStoredAuth,
  confirmCurrentUserEmailChange,
  readStoredUser,
  refreshCurrentUserProfile,
  requestCurrentUserEmailChange,
  updateCurrentUserProfile,
  uploadCurrentUserAvatar,
  type LocalUser,
  type ProfileVisibility,
} from "@/lib/auth-client";
import { readCart, type CartItem } from "@/lib/cart";
import {
  fetchSavedCommunityPosts,
  fetchStoreProducts,
  fetchTravelerInterpretingBookings,
  type CommunityFeedPost,
  type TravelerInterpretingBooking,
} from "@/lib/api-data";
import type { StoreProduct } from "@/data/store";
import { countryName, countryOptions, normalizeCountryCode } from "@/lib/country-list";
import { useLocale } from "@/lib/locale-context";

type ProfileTab = "notes" | "calendar" | "routes" | "collection" | "bookings" | "settings";
type FavoriteItem = { id: string; type: string; title: string };

const PROFILE_TABS: Array<{ key: ProfileTab; labelKey: string }> = [
  { key: "notes", labelKey: "account.profile.tabs.notes" },
  { key: "calendar", labelKey: "account.profile.tabs.calendar" },
  { key: "routes", labelKey: "account.profile.tabs.routes" },
  { key: "collection", labelKey: "account.profile.tabs.collection" },
  { key: "bookings", labelKey: "account.profile.tabs.bookings" },
  { key: "settings", labelKey: "account.profile.tabs.settings" },
];

const PROFILE_FIELD_CLASS =
  "mt-2 min-h-[50px] w-full border border-[var(--line)] bg-[var(--background)] px-4 py-3 text-base leading-6 text-[var(--river-deep)] outline-none transition focus:border-[var(--river-deep)] focus:shadow-[0_0_0_3px_rgba(20,52,61,0.08)]";

const PROFILE_LABEL_CLASS =
  "text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]";

const ARCHIVE_ACTION_CLASS =
  "btn-outline flex min-h-12 w-full items-center justify-center text-[12px] leading-none sm:inline-flex sm:w-auto";

function readFavorites(): FavoriteItem[] {
  try {
    const raw = window.localStorage.getItem("culvoy-favorites");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.id === "string" && typeof item.title === "string")
      : [];
  } catch {
    return [];
  }
}

function favoriteHref(item: FavoriteItem) {
  if (item.type === "route") return `/routes/${item.id}`;
  if (item.type === "city" || item.type === "culture") return `/culture/${item.id}`;
  if (item.type === "product") return `/shop/products/${item.id}`;
  return "/routes";
}

function profileCompletion(user: LocalUser) {
  const values = [user.avatarUrl, user.country, user.homeBase, user.travelStyle, user.bio];
  return Math.round((values.filter((value) => Boolean(value?.trim())).length / values.length) * 100);
}

function formatBookingDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date);
}

function EmptyArchive({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <section data-pastoral-card className="mx-auto max-w-3xl border-y border-[var(--line)] px-1 py-9 sm:py-12">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--cinnabar)]">Culvoy field archive</p>
      <h2 className="mt-4 max-w-[20ch] font-[family:var(--font-display)] text-3xl leading-[1.02] text-[var(--river-deep)] sm:text-4xl">{title}</h2>
      <p className="mt-4 max-w-xl handwritten text-sm leading-7 text-[var(--muted)] sm:text-base">{body}</p>
      <Link
        href={href}
        className={`${ARCHIVE_ACTION_CLASS} mt-7`}
      >
        {cta}
      </Link>
    </section>
  );
}

export function ProfilePageClient({ initialUser }: { initialUser: LocalUser }) {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") as ProfileTab | null;
  const activeTab = PROFILE_TABS.some((tab) => tab.key === requestedTab) ? requestedTab! : "notes";
  const profilePath = `/profile${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const tabRefs = useRef<Partial<Record<ProfileTab, HTMLButtonElement | null>>>({});
  const [user, setUser] = useState<LocalUser | null>(initialUser);
  const [ready, setReady] = useState(true);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [savedNotes, setSavedNotes] = useState<CommunityFeedPost[]>([]);
  const [bookings, setBookings] = useState<TravelerInterpretingBooking[]>([]);
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [bookingsReady, setBookingsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error" | "">("");
  const [fieldError, setFieldError] = useState<"name" | "email" | null>(null);
  // Code-confirmed email change: step 1 mails a code to the new address,
  // step 2 confirms it. Kept apart from the profile form, which no longer
  // touches the email at all.
  const [emailChange, setEmailChange] = useState({
    newEmail: "",
    code: "",
    codeSent: false,
    sending: false,
    confirming: false,
    error: "",
    notice: "",
  });
  const [form, setForm] = useState({
    name: "",
    email: "",
    country: "",
    homeBase: "",
    travelStyle: "",
    bio: "",
    profileVisibility: "public" as ProfileVisibility,
  });
  const countries = useMemo(() => countryOptions(), []);
  const savedRoutes = favorites.filter((item) => item.type !== "product");
  const savedProducts = favorites.filter((item) => item.type === "product");
  const productBySlug = new Map(storeProducts.map((product) => [product.slug, product]));
  const savedCollectionItems: CartItem[] = savedProducts.map((item) => {
    const product = productBySlug.get(item.id);
    return {
      productId: product?.id,
      slug: item.id,
      name: product?.name || item.title,
      quantity: 1,
      price: product?.price || 0,
      currency: product?.currency || "CNY",
      image: product?.image,
      selected: false,
    };
  });
  const collectionItems = Array.from(
    new Map<string, CartItem>(
      [...cart, ...savedCollectionItems].map((item) => [item.slug, item]),
    ).values(),
  );

  function hydrateProfile(nextUser: LocalUser | null) {
    setUser(nextUser);
    if (!nextUser) return;
    setForm({
      name: nextUser.name || "",
      email: nextUser.email || "",
      country: normalizeCountryCode(nextUser.country),
      homeBase: nextUser.homeBase || "",
      travelStyle: nextUser.travelStyle || "",
      bio: nextUser.bio || "",
      profileVisibility: nextUser.profileVisibility || "public",
    });
  }

  useEffect(() => {
    let cancelled = false;
    setBookingsReady(false);
    setFavorites(readFavorites());
    setCart(readCart());
    void Promise.allSettled([
      refreshCurrentUserProfile(),
      fetchSavedCommunityPosts(24),
      fetchTravelerInterpretingBookings(),
      fetchStoreProducts(),
    ]).then(([profileResult, notesResult, bookingsResult, productsResult]) => {
      if (cancelled) return;
      if (profileResult.status === "rejected") {
        clearStoredAuth();
        router.replace(`/login?next=${encodeURIComponent(profilePath)}`);
        return;
      }
      hydrateProfile(profileResult.value);
      if (notesResult.status === "fulfilled") setSavedNotes(notesResult.value);
      if (bookingsResult.status === "fulfilled") setBookings(bookingsResult.value);
      if (productsResult.status === "fulfilled") setStoreProducts(productsResult.value);
      setBookingsReady(true);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [profilePath, router]);

  useEffect(() => {
    if (!ready) return;
    const activeTabElement = tabRefs.current[activeTab];
    if (typeof activeTabElement?.scrollIntoView !== "function") return;
    activeTabElement.scrollIntoView({
      behavior:
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeTab, ready]);

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % PROFILE_TABS.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + PROFILE_TABS.length) % PROFILE_TABS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = PROFILE_TABS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = PROFILE_TABS[nextIndex].key;
    selectTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  }

  function selectTab(tab: ProfileTab) {
    router.replace(`/profile?tab=${tab}`, { scroll: false });
  }

  async function startEmailChange() {
    const newEmail = emailChange.newEmail.trim();
    if (!newEmail) return;
    setEmailChange((current) => ({
      ...current,
      sending: true,
      error: "",
      notice: "",
    }));
    try {
      await requestCurrentUserEmailChange(newEmail);
      setEmailChange((current) => ({
        ...current,
        sending: false,
        codeSent: true,
        notice: `Verification code sent to ${newEmail}. Enter it below to finish the change.`,
      }));
    } catch (error) {
      setEmailChange((current) => ({
        ...current,
        sending: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not send the verification code.",
      }));
    }
  }

  async function confirmEmailChange() {
    const newEmail = emailChange.newEmail.trim();
    const code = emailChange.code.trim();
    if (!newEmail || code.length !== 6) return;
    setEmailChange((current) => ({
      ...current,
      confirming: true,
      error: "",
      notice: "",
    }));
    try {
      const nextUser = await confirmCurrentUserEmailChange(newEmail, code);
      if (nextUser) hydrateProfile(nextUser);
      setEmailChange({
        newEmail: "",
        code: "",
        codeSent: false,
        sending: false,
        confirming: false,
        error: "",
        notice: "Email address updated.",
      });
      setMessageKind("success");
      setMessage(t("account.profile.saved"));
    } catch (error) {
      setEmailChange((current) => ({
        ...current,
        confirming: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not confirm the email change.",
      }));
    }
  }

  async function saveProfile() {
    if (!form.name.trim()) {
      setFieldError("name");
      setMessageKind("error");
      setMessage(t("account.profile.nameRequired"));
      return;
    }
    setSaving(true);
    setFieldError(null);
    setMessageKind("");
    setMessage("");
    try {
      // The email is deliberately absent from this payload: changing an
      // address is a code-confirmed two-step flow (`/auth/me/email/...`), and
      // the API rejects a plain email patch with a 400.
      const nextUser = await updateCurrentUserProfile({
        name: form.name.trim(),
        country: form.country,
        homeBase: form.homeBase.trim(),
        travelStyle: form.travelStyle.trim(),
        bio: form.bio.trim(),
        profileVisibility: form.profileVisibility,
      });
      hydrateProfile(nextUser);
      setMessageKind("success");
      setMessage(t("account.profile.saved"));
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : t("account.profile.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file?: File) {
    if (!file) return;
    setUploading(true);
    setMessageKind("");
    setMessage("");
    try {
      await uploadCurrentUserAvatar(file);
      hydrateProfile(readStoredUser());
      setMessageKind("success");
      setMessage(t("account.profile.avatarSaved"));
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : t("account.profile.avatarFailed"));
    } finally {
      setUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  function logout() {
    clearStoredAuth();
    router.replace("/");
    router.refresh();
  }

  if (!ready) return <div className="min-h-[60vh] bg-[var(--paper-deep)]" />;

  if (!user) return null;

  return (
    <PastoralPageMotion
      className="min-h-[100dvh] bg-[var(--background)] bg-grain pb-28 text-[var(--river-deep)] sm:pb-20"
      motionKey={`${activeTab}:${collectionItems.length}:${savedNotes.length}`}
    >
      <header className="border-b border-[var(--line)] bg-[var(--paper-deep)] bg-grain py-10 sm:py-beat">
        <div className="site-container grid min-w-0 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(15rem,20rem)] md:items-end md:gap-12 lg:gap-16">
          <div className="flex min-w-0 flex-col gap-7 sm:flex-row sm:items-center">
            <button type="button" onClick={() => avatarInputRef.current?.click()} className="group relative w-fit shrink-0 rounded-full" aria-label={t("account.profile.changeAvatar")}>
              <Avatar
                src={user.avatarUrl}
                name={user.name}
                seed={user.accountId}
                size={112}
                shape="round"
                ringClassName="border-2 border-[var(--paper)]"
              />
              <span className="absolute -bottom-3 -right-3 bg-[var(--gold)] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition-transform group-hover:-translate-y-1.5">
                {uploading ? t("account.profile.uploading") : t("account.profile.editPhoto")}
              </span>
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void uploadAvatar(event.target.files?.[0])} />
            <div className="min-w-0">
              <h1 className="mt-3 min-w-0 break-words font-[family:var(--font-display)] text-[clamp(2.8rem,7vw,5.5rem)] leading-[0.98] tracking-[-0.04em]">
                <span className="block overflow-hidden pb-1"><span data-pastoral-title className="block">{user.name}</span></span>
              </h1>
              <p data-pastoral-subtitle className="mt-4 max-w-xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                {user.bio || t("account.profile.bioFallback")}
              </p>
              <button
                type="button"
                onClick={() => selectTab("settings")}
                className="mt-5 inline-flex min-h-11 items-center gap-3 border border-[var(--line)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--river-deep)] transition-colors hover:border-[var(--cinnabar)] hover:text-[var(--cinnabar)]"
              >
                {t("account.profile.edit")}
                <span aria-hidden>→</span>
              </button>
              {message && activeTab !== "settings" ? (
                <p
                  className={`mt-4 text-sm ${
                    messageKind === "success"
                      ? "text-[var(--river-deep)]"
                      : "text-[var(--cinnabar)]"
                  }`}
                  role={messageKind === "error" ? "alert" : "status"}
                >
                  {message}
                </p>
              ) : null}
            </div>
          </div>
          <div data-pastoral-stamp className="min-w-0 border-t border-[var(--line)] pt-5 text-sm text-[var(--muted)] md:border md:p-5">
            <p>{countryName(user.country) || t("account.profile.locationUnset")}</p>
            <p className="mt-2">{user.homeBase || user.email}</p>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">
              {t("account.profile.completion").replace("{number}", String(profileCompletion(user)))}
            </p>
            <button
              type="button"
              onClick={logout}
              className="mt-5 flex w-full items-center justify-between border-t border-[var(--line)] pt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--river-deep)] transition-colors hover:text-[var(--cinnabar)]"
            >
              {t("common.nav.logout")}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
      </header>

      <div className="sticky top-[var(--site-header-height)] z-30 border-b border-[var(--line)] bg-[var(--paper-deep)] bg-grain">
        <nav
          className="site-container scrollbar-hide flex gap-2 overflow-x-auto py-3"
          aria-label={t("account.profile.tabLabel")}
          role="tablist"
        >
          {PROFILE_TABS.map((tab, index) => (
            <button
              key={tab.key}
              ref={(node) => {
                tabRefs.current[tab.key] = node;
              }}
              type="button"
              onClick={() => selectTab(tab.key)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              id={`profile-tab-${tab.key}`}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls="profile-panel"
              tabIndex={activeTab === tab.key ? 0 : -1}
              className={`min-h-11 shrink-0 border-b-2 px-3 pb-2 pt-3 text-[11px] font-bold uppercase tracking-[0.16em] transition ${
                activeTab === tab.key
                  ? "border-[var(--cinnabar)] text-[var(--river-deep)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--river-deep)]"
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </nav>
      </div>

      <div className="site-container min-w-0 py-beat">
        <div
          id="profile-panel"
          role="tabpanel"
          aria-labelledby={`profile-tab-${activeTab}`}
          tabIndex={0}
          className="min-h-0 bg-transparent focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-[var(--gold)]"
        >
        {activeTab === "calendar" ? <ProfileCalendar key={user.id} userId={user.id} /> : null}

        {activeTab === "notes" ? (
          savedNotes.length ? (
            <section className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {savedNotes.map((note) => (
                <Link data-pastoral-card key={note.id} href={`/community?post=${note.id}`} className="group block min-w-0 overflow-hidden border-t border-[var(--line)] pb-5 pt-3 transition hover:-translate-y-1.5">
                  {note.image ? <img src={note.image} alt="" className="aspect-[4/3] w-full bg-[var(--paper)] object-cover" /> : null}
                  <div className="pt-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">{note.channel}</p>
                  <h2 className="mt-3 font-[family:var(--font-display)] text-2xl leading-tight transition-colors group-hover:text-[var(--cinnabar)]">{note.title}</h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-7 text-[var(--muted)]">{note.excerpt}</p>
                  </div>
                </Link>
              ))}
            </section>
          ) : (
            <EmptyArchive title={t("account.profile.notesEmpty")} body={t("account.profile.notesEmptyBody")} href="/community" cta={t("account.profile.notesCta")} />
          )
        ) : null}

        {activeTab === "routes" ? (
          savedRoutes.length ? (
            <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {savedRoutes.map((item) => (
                <Link data-pastoral-card key={`${item.type}-${item.id}`} href={favoriteHref(item)} className="group min-w-0 border-t border-[var(--line)] py-6 transition hover:-translate-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">{item.type}</p>
                  <h2 className="mt-3 font-[family:var(--font-display)] text-2xl transition-colors group-hover:text-[var(--cinnabar)]">{item.title}</h2>
                  <span className="mt-6 inline-flex text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--cinnabar)]">{t("account.profile.openRecord")} →</span>
                </Link>
              ))}
            </section>
          ) : (
            <EmptyArchive title={t("account.profile.routesEmpty")} body={t("account.profile.routesEmptyBody")} href="/routes" cta={t("account.profile.routesCta")} />
          )
        ) : null}

        {activeTab === "collection" ? (
          collectionItems.length ? (
            <section className="grid items-start gap-7 lg:grid-cols-2">
              {collectionItems.map((item, index) => (
                <Link
                  data-pastoral-card
                  key={`${item.slug}-${index}`}
                  href={`/shop/products/${item.slug}`}
                  className="group grid min-w-0 grid-cols-[minmax(6rem,7.5rem)_minmax(0,1fr)] border border-[var(--line)] bg-[var(--background)] p-3 transition-transform duration-500 hover:-translate-y-1.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:p-4"
                >
                  <div className="relative aspect-square overflow-hidden bg-[var(--paper)]">
                    {item.image ? (
                      <img src={item.image} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                    ) : (
                      <div className="grid h-full place-items-center border border-dashed border-[var(--line)] bg-[var(--paper)] font-[family:var(--font-display)] text-5xl italic text-[var(--gold)]/55">L</div>
                    )}
                    <span className="absolute left-2 top-2 bg-[var(--paper)] px-2 py-1 text-[11px] font-bold tracking-[0.16em] text-[var(--river-deep)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-col justify-between px-4 py-2 sm:px-5 sm:py-3">
                    <div>
                      <h2 className="mt-3 font-[family:var(--font-display)] text-xl leading-[1.05] transition-colors group-hover:text-[var(--cinnabar)] sm:text-2xl">{item.name}</h2>
                      <p className="mt-2 handwritten text-xs italic text-[var(--muted)]">{t("account.profile.quantity")} {item.quantity}</p>
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-3 border-t border-[var(--line)] pt-3">
                      <span className="text-sm text-[var(--gold)]">
                        {item.price > 0 ? <Price amount={item.price * item.quantity} currency={item.currency} /> : t("account.profile.openRecord")}
                      </span>
                      <span className="text-base text-[var(--cinnabar)] transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
                    </div>
                  </div>
                </Link>
              ))}
            </section>
          ) : (
            <EmptyArchive title={t("account.profile.collectionEmpty")} body={t("account.profile.collectionEmptyBody")} href="/shop" cta={t("account.profile.collectionCta")} />
          )
        ) : null}

        {activeTab === "bookings" ? <ServiceRequestDashboard key={user.id} userId={user.id} /> : null}

        {activeTab === "bookings" ? (
          !bookingsReady ? (
            <p className="py-14 text-center text-sm text-[var(--muted)]" role="status">
              {t("account.profile.bookingsLoading")}
            </p>
          ) : bookings.length ? (
            <section aria-label={t("account.profile.bookingsLabel")}>
              <div className="grid gap-4 lg:grid-cols-2">
                {bookings.map((booking) => (
                  <article data-pastoral-card key={booking.id} className="border-t border-[var(--line)] py-6 sm:py-8">
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-5">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">
                          {t(`account.profile.bookingStatus.${booking.status}`)}
                        </p>
                        <h2 className="mt-3 font-[family:var(--font-display)] text-3xl leading-none text-[var(--river-deep)]">
                          {booking.city}
                        </h2>
                      </div>
                      <time className="text-xs text-[var(--muted)]" dateTime={booking.serviceDate}>
                        {formatBookingDate(booking.serviceDate)}
                      </time>
                    </div>
                    <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{t("account.profile.bookingMode")}</dt>
                        <dd className="mt-2 text-[var(--ink)]">{booking.supportMode}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{t("account.profile.bookingGroup")}</dt>
                        <dd className="mt-2 text-[var(--ink)]">{booking.groupSize || t("account.profile.bookingPending")}</dd>
                      </div>
                      {booking.assignedInterpreterName ? (
                        <div className="sm:col-span-2">
                          <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{t("account.profile.bookingInterpreter")}</dt>
                          <dd className="mt-2 text-[var(--ink)]">{booking.assignedInterpreterName}</dd>
                        </div>
                      ) : null}
                    </dl>
                    {booking.routeOrNeed ? <p className="mt-5 border-t border-[var(--line)] pt-5 text-sm leading-6 text-[var(--muted)]">{booking.routeOrNeed}</p> : null}
                  </article>
                ))}
              </div>
              <Link href="/interpreting#interpreting-booking" className={`${ARCHIVE_ACTION_CLASS} mt-8`}>
                {t("account.profile.bookingsCta")}
              </Link>
            </section>
          ) : (
            <EmptyArchive title={t("account.profile.bookingsEmpty")} body={t("account.profile.bookingsEmptyBody")} href="/interpreting#interpreting-booking" cta={t("account.profile.bookingsCta")} />
          )
        ) : null}

        {activeTab === "settings" ? (
          <section className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:gap-16">
            <div className="grid min-w-0 gap-5 border-t border-[var(--line)] pt-6 sm:pt-7">
              <label className="block">
                <span className={PROFILE_LABEL_CLASS}>{t("account.profile.name")}</span>
                <input value={form.name} onChange={(event) => { setFieldError(null); setMessage(""); setMessageKind(""); setForm((current) => ({ ...current, name: event.target.value })); }} className={`${PROFILE_FIELD_CLASS} text-lg`} aria-invalid={fieldError === "name"} aria-describedby={fieldError === "name" ? "profile-name-error" : undefined} />
                {fieldError === "name" ? <span id="profile-name-error" className="mt-2 block text-sm text-[var(--cinnabar)]">{message}</span> : null}
              </label>
              <label className="block">
                <span className={PROFILE_LABEL_CLASS}>{t("account.profile.email")}</span>
                <input
                  type="email"
                  value={form.email}
                  readOnly
                  aria-readonly="true"
                  aria-describedby="profile-email-note"
                  className={`${PROFILE_FIELD_CLASS} cursor-not-allowed opacity-70`}
                  autoComplete="email"
                />
                <span id="profile-email-note" className="mt-2 block text-sm text-[var(--muted)]">
                  Address changes are confirmed with a code sent to the new one.
                </span>
              </label>

              <div className="border-t border-[var(--line)] pt-5">
                <details>
                  <summary className="min-h-11 cursor-pointer text-sm font-semibold text-[var(--cinnabar)] underline decoration-[var(--cinnabar)]/45 underline-offset-4">
                    Change email address
                  </summary>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <label className="block">
                      <span className={PROFILE_LABEL_CLASS}>New email address</span>
                      <input
                        type="email"
                        value={emailChange.newEmail}
                        onChange={(event) =>
                          setEmailChange((current) => ({
                            ...current,
                            newEmail: event.target.value,
                            error: "",
                            notice: "",
                          }))
                        }
                        className={PROFILE_FIELD_CLASS}
                        autoComplete="email"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={emailChange.sending || !emailChange.newEmail.trim()}
                      onClick={() => void startEmailChange()}
                      className="min-h-[50px] self-end border border-[var(--line)] px-4 py-2 text-[12px] leading-6 font-bold uppercase tracking-[0.14em] text-[var(--river-deep)] transition-colors hover:border-[var(--river-deep)] disabled:opacity-40"
                    >
                      {emailChange.sending ? "Sending…" : "Send code"}
                    </button>
                  </div>

                  {emailChange.codeSent ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <label className="block">
                        <span className={PROFILE_LABEL_CLASS}>Verification code</span>
                        <input
                          inputMode="numeric"
                          maxLength={6}
                          value={emailChange.code}
                          onChange={(event) =>
                            setEmailChange((current) => ({
                              ...current,
                              code: event.target.value,
                              error: "",
                              notice: "",
                            }))
                          }
                          className={PROFILE_FIELD_CLASS}
                          autoComplete="one-time-code"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={
                          emailChange.confirming ||
                          emailChange.code.trim().length !== 6
                        }
                        onClick={() => void confirmEmailChange()}
                        className="min-h-[50px] self-end bg-[var(--river-deep)] px-4 py-2 text-[12px] leading-6 font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[var(--cinnabar)] disabled:opacity-40"
                      >
                        {emailChange.confirming ? "Confirming…" : "Confirm change"}
                      </button>
                    </div>
                  ) : null}

                  {emailChange.notice ? (
                    <p className="mt-3 text-sm text-[var(--muted)]" role="status">
                      {emailChange.notice}
                    </p>
                  ) : null}
                  {emailChange.error ? (
                    <p className="mt-3 text-sm text-[var(--cinnabar)]" role="alert">
                      {emailChange.error}
                    </p>
                  ) : null}
                </details>
              </div>
              <label className="block">
                <span className={PROFILE_LABEL_CLASS}>{t("account.profile.country")}</span>
                <select value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} className={PROFILE_FIELD_CLASS}>
                  <option value="">{t("account.profile.countryPlaceholder")}</option>
                  {countries.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}
                </select>
              </label>
              <div className="grid gap-7 sm:grid-cols-2">
                <label className="block">
                  <span className={PROFILE_LABEL_CLASS}>{t("account.profile.homeBase")}</span>
                  <input value={form.homeBase} onChange={(event) => setForm((current) => ({ ...current, homeBase: event.target.value }))} className={PROFILE_FIELD_CLASS} />
                </label>
                <label className="block">
                  <span className={PROFILE_LABEL_CLASS}>{t("account.profile.travelStyle")}</span>
                  <input value={form.travelStyle} onChange={(event) => setForm((current) => ({ ...current, travelStyle: event.target.value }))} className={PROFILE_FIELD_CLASS} />
                </label>
              </div>
              <label className="block">
                <span className={PROFILE_LABEL_CLASS}>{t("account.profile.bio")}</span>
                <textarea value={form.bio} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} rows={5} className={`${PROFILE_FIELD_CLASS} min-h-32 resize-y leading-relaxed`} />
              </label>
              <label className="block">
                <span className={PROFILE_LABEL_CLASS}>{t("account.profile.visibility")}</span>
                <select value={form.profileVisibility} onChange={(event) => setForm((current) => ({ ...current, profileVisibility: event.target.value as ProfileVisibility }))} className={PROFILE_FIELD_CLASS}>
                  <option value="public">{t("account.profile.visibilityPublic")}</option>
                  <option value="community">{t("account.profile.visibilityCommunity")}</option>
                  <option value="private">{t("account.profile.visibilityPrivate")}</option>
                </select>
              </label>
              {message && !fieldError ? <p className={`text-sm ${messageKind === "success" ? "text-[var(--river-deep)]" : "text-[var(--cinnabar)]"}`} role={messageKind === "error" ? "alert" : "status"}>{message}</p> : null}
              <button type="button" onClick={() => void saveProfile()} disabled={saving} className="inline-flex min-h-12 items-center justify-center bg-[var(--river-deep)] px-8 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white transition hover:bg-[var(--cinnabar)] disabled:opacity-50">
                {saving ? t("account.profile.saving") : t("account.profile.save")}
              </button>
            </div>
            <aside className="border-t border-[var(--line)] pt-6 lg:pt-7">
              <p className="font-[family:var(--font-display)] text-2xl italic">{t("account.profile.settingsNoteTitle")}</p>
              <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">{t("account.profile.settingsNoteBody")}</p>
              <p className="mt-7 text-xs text-[var(--muted)]">{user.email}</p>
            </aside>
          </section>
        ) : null}
        </div>
      </div>

      {activeTab !== "settings" ? (
        <button type="button" onClick={() => selectTab("settings")} className="fixed bottom-4 left-4 right-4 z-40 min-h-12 bg-[var(--river-deep)] px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-lift sm:hidden">
          {t("account.profile.edit")}
        </button>
      ) : null}
    </PastoralPageMotion>
  );
}
