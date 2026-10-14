import "./globals.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { ScrollProgress } from "@/components/layout/ScrollProgress";
import { LocaleProvider } from "@/lib/locale-context";
import { translate } from "@/translations";

export const metadata: Metadata = {
  metadataBase: new URL("https://culvoy.com"),
  title: "Culvoy Guangdong — Story Routes, Culture & Local Interpreters",
  description:
    "Story routes through Guangdong's three cultures — a crater lake in Zhanjiang, gongfu tea in Chaozhou, morning dim sum in Guangzhou — with a local interpreter at your side.",
  // culvoy.com and the legacy lingfengtranstour.cn family serve the same copy
  // during the domain migration; without this the engines see duplicate content.
  // Detail pages override it with their own path.
  alternates: {
    canonical: "./",
  },
  openGraph: {
    type: "website",
    siteName: "Culvoy",
    url: "/",
    title: "Culvoy Guangdong",
    description:
      "Story routes through Guangdong's three cultures — a crater lake in Zhanjiang, gongfu tea in Chaozhou, morning dim sum in Guangzhou — with a local interpreter at your side.",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The single light ground, declared so mobile browser chrome matches the page
  // instead of guessing. Mirrors `color-scheme: light` in base.css.
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ece9e2" }],
};

/**
 * Site-wide Organization record. The detail pages (routes, objects, cities) are
 * added by their own schemas; this is the entity every one of them hangs off.
 */
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Culvoy",
  url: "https://culvoy.com",
  logo: "https://culvoy.com/opengraph-image.png",
  email: "hello@culvoy.com",
  description:
    "Story routes through Guangdong's three cultures — a crater lake in Zhanjiang, gongfu tea in Chaozhou, morning dim sum in Guangzhou — with a local interpreter at your side.",
  areaServed: {
    "@type": "Place",
    name: "Guangdong, China",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      style={{ backgroundColor: "#ece9e2" }}
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
          <Script
            src="https://accounts.google.com/gsi/client"
            strategy="lazyOnload"
          />
        )}
        <LocaleProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-full focus:bg-[var(--river-deep)] focus:px-5 focus:py-3 focus:text-sm focus:font-bold focus:text-white"
          >
            {translate("common.aria.skipToContent")}
          </a>
          <div className="min-h-screen text-[var(--ink)]">
            <ScrollProgress />
            <SiteHeader />
            <main id="main" tabIndex={-1}>
              <PageTransition>{children}</PageTransition>
            </main>
            <SiteFooter />
          </div>
        </LocaleProvider>
      </body>
    </html>
  );
}
