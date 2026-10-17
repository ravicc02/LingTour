"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { siteNavigation } from "@/data/navigation";
import { Container } from "@/components/ui/Container";
import { useLocale } from "@/lib/locale-context";

const FOOTER_NAV_LABEL_KEY: Record<string, string> = {
  "/culture": "common.nav.culture",
  "/routes": "common.nav.routes",
  "/interpreting": "common.nav.interpreting",
  "/shop": "common.nav.shop",
  "/community": "common.nav.community",
};

export function SiteFooter() {
  const { t } = useLocale();
  const pathname = usePathname();

  // The admin area renders its own chrome — don't show the marketing footer.
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="border-t border-white/10 bg-[var(--river-deep)] bg-grain text-white overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-[var(--gold)]/20" />
      <Container className="grid items-start gap-12 py-20 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-16 relative z-10">
        <div className="space-y-8">
          <div>
            <p className="font-[family:var(--font-display)] text-4xl lg:text-5xl tracking-tight">Culvoy</p>
          </div>

        </div>

        <div className="flex flex-col gap-8">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--gold-light)]">{t("common.nav.routes")}</p>
          <div className="grid grid-cols-2 gap-x-8 text-sm font-medium text-white/70">
            {siteNavigation.slice(1).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-11 items-center transition hover:text-[var(--gold-light)]"
              >
                {t(FOOTER_NAV_LABEL_KEY[item.href] ?? "common.nav.routes")}
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-4 text-sm text-white/50">
            <a
              href="mailto:hello@culvoy.com"
              className="inline-flex min-h-11 items-center break-all text-lg leading-tight text-white transition-colors hover:text-[var(--gold-light)]"
            >
              hello@culvoy.com
            </a>
            <p className="handwritten text-white/70">{t("common.footer.locations")}</p>
          </div>
          <div className="pt-8 border-t border-white/10 text-[12px] uppercase tracking-widest text-white/60">
            {t("common.site.footer.rights").replace("{year}", String(new Date().getFullYear()))}
          </div>
        </div>
      </Container>

      {/* Abstract decorative element */}
      <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
    </footer>
  );
}
