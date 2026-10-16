"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { siteNavigation } from "@/data/navigation";
import { AccountNavLink } from "@/components/layout/AccountNavLink";
import { RoutesMegaMenu } from "@/components/layout/RoutesMegaMenu";
import { Container } from "@/components/ui/Container";

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const { t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [homeScrolled, setHomeScrolled] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobilePanelRef = useRef<HTMLDivElement | null>(null);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const isHome = pathname === "/";

  useEffect(() => {
    if (!isHome) {
      setHomeScrolled(false);
      return;
    }

    const handleScroll = () => setHomeScrolled(window.scrollY > 28);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHome]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      mobilePanelRef.current?.querySelector<HTMLElement>("a[href], button:not([disabled])")?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Tab" || !headerRef.current) return;

      const focusable = Array.from(
        headerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeMenu, isOpen]);

  // The admin area renders its own chrome — don't double up the public header.
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  const leftNavigation = siteNavigation.filter((item) =>
    ["/", "/culture", "/routes", "/interpreting"].includes(item.href),
  );
  const rightNavigation = siteNavigation.filter((item) => ["/shop", "/community"].includes(item.href));

  return (
    <header
      ref={headerRef}
      data-home-header={isHome ? "true" : undefined}
      className={[
        "z-50 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500",
        isHome
          ? "fixed inset-x-0 top-0"
          : "sticky top-0 border-[var(--line)] bg-[var(--paper-deep)]/85 bg-grain backdrop-blur-xl",
        isHome && homeScrolled
          ? "border-[var(--line)] bg-[var(--paper-deep)]/92 bg-grain shadow-lift backdrop-blur-xl"
          : isHome
            ? "border-white/25 bg-[var(--paper-deep)]/48 backdrop-blur-sm"
            : "",
      ].filter(Boolean).join(" ")}
    >
      <Container className="grid h-[calc(var(--site-header-height)-1px)] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 min-[1440px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] min-[1440px]:gap-5">
        <nav className="hidden items-center justify-start gap-1 min-[1440px]:flex" aria-label="Primary navigation">
          {leftNavigation.map((item) => {
            const active = isActivePath(pathname, item.href);

            if (item.href === "/routes") {
              return <RoutesMegaMenu key={item.href} active={active} />;
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex min-h-11 shrink-0 items-center px-2 py-3 text-sm transition min-[1440px]:px-3 ${
                  active
                    ? "text-[var(--cinnabar)]"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link href="/" className="justify-self-start text-center leading-none min-[1440px]:justify-self-center" onClick={() => setIsOpen(false)}>
          <p className="font-[family:var(--font-sans)] text-2xl font-medium tracking-[0.08em] text-[var(--river-deep)]">
            Culvoy
          </p>
          <p className="mt-1 text-center text-[0.62rem] uppercase tracking-[0.3em] text-[var(--muted)]">
            Guangdong
          </p>
        </Link>

        <div className="hidden min-w-0 shrink-0 items-center justify-end gap-1 min-[1440px]:flex">
          <nav className="flex items-center gap-1" aria-label="Secondary navigation">
            {rightNavigation.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex min-h-11 shrink-0 items-center px-2 py-3 text-sm transition min-[1440px]:px-3 ${
                    active
                      ? "text-[var(--cinnabar)]"
                      : "text-[var(--muted)] hover:text-[var(--ink)]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <AccountNavLink />
          <Link
            href="/interpreting#interpreting-booking"
            className="ml-1 inline-flex min-h-11 min-w-[5.8rem] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[var(--river-deep)] px-3 py-2 text-[12px] font-bold uppercase leading-5 tracking-[0.14em] text-white transition-colors hover:bg-[var(--cinnabar)] min-[1440px]:px-4 min-[1440px]:tracking-[0.2em]"
          >
            {"BOOK"}
          </Link>
        </div>

        <div className="flex items-center min-[1440px]:hidden">
          <AccountNavLink onNavigate={() => setIsOpen(false)} />
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          className="grid h-11 w-11 place-items-center border border-[var(--line)] bg-white/60 min-[1440px]:hidden"
          aria-label={isOpen ? t("common.aria.closeMenu") : t("common.aria.openMenu")}
          aria-expanded={isOpen}
          aria-controls="site-mobile-navigation"
          onClick={() => setIsOpen((open) => !open)}
        >
          <span className="grid gap-1.5">
            <span className={`h-px w-5 bg-[var(--ink)] transition ${isOpen ? "translate-y-[7px] rotate-45" : ""}`} />
            <span className={`h-px w-5 bg-[var(--ink)] transition ${isOpen ? "opacity-0" : ""}`} />
            <span className={`h-px w-5 bg-[var(--ink)] transition ${isOpen ? "-translate-y-[7px] -rotate-45" : ""}`} />
          </span>
        </button>
      </Container>

      {isOpen ? (
        <div aria-hidden="true" className="fixed inset-0 top-[var(--site-header-height)] z-40 bg-black/30 min-[1440px]:hidden" onClick={closeMenu} />
      ) : null}

      {isOpen ? (
        <div
          ref={mobilePanelRef}
          id="site-mobile-navigation"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className="relative z-50 max-h-[calc(100svh-var(--site-header-height))] overflow-y-auto border-t border-[var(--line)] bg-[var(--paper-deep)] bg-grain min-[1440px]:hidden"
        >
          <Container className="grid gap-4 py-4">
            <div className="grid gap-2">
              <p className="px-1 text-[12px] font-bold uppercase tracking-[0.3em] text-[var(--muted)]">
                {t("common.nav.mobile.explore")}
              </p>
              {siteNavigation.map((item) => {
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-3 text-sm transition ${
                      active
                        ? "bg-[var(--river-deep)] text-white shadow-lg"
                        : "border border-[var(--line)] bg-white/40 text-[var(--ink)]"
                    }`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setIsOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-2 border-t border-[var(--line)] pt-4">
              <Link
                href="/interpreting#interpreting-booking"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--river-deep)] px-4 py-3 text-center text-[12px] font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-[var(--cinnabar)]"
                onClick={() => setIsOpen(false)}
              >
                {"BOOK"}
              </Link>
            </div>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
