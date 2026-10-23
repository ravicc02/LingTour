"use client";

import Link from "next/link";
import type { StoreProduct } from "@/data/store";
import { Reveal } from "@/components/ui/Reveal";
import { MediaFrame } from "@/components/ui/MediaFrame";
import { useLocale } from "@/lib/locale-context";
import {
  dedupeMedia,
  resolveMediaGallery,
  resolvePrimaryMedia,
} from "@/types/media";

export function ProductNarrative({ product }: { product: StoreProduct }) {
  const { t } = useLocale();
  const collectionLabel = product.collection || t("shop.detail.collectionFallback");
  const materialLine = product.materialNotes || t("shop.detail.materialPending");
  const primary = resolvePrimaryMedia(product.primaryMedia, product.image);
  const media = dedupeMedia([
    ...(primary ? [primary] : []),
    ...resolveMediaGallery(product.galleryMedia, product.gallery ?? []),
  ]);
  const narrativeMedia = media[1] ?? media[0] ?? null;

  return (
    <section data-product-narrative className="border-y border-[var(--line)] bg-[var(--paper-deep)] bg-grain py-beat xl:py-32">
      <div className="site-container">
        <div data-product-story-layout className="grid min-w-0 grid-cols-1 items-stretch gap-8 min-[620px]:grid-cols-[minmax(0,1.25fr)_minmax(14rem,0.75fr)] min-[620px]:gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:gap-16">
          <Reveal className="relative z-10 order-2 -mx-1 -mt-16 border border-[var(--line)] bg-[var(--paper-deep)]/96 bg-grain p-5 scrapbook-shadow sm:p-6 min-[620px]:order-none min-[620px]:mx-0 min-[620px]:mt-0 min-[620px]:p-6 min-[620px]:shadow-none lg:p-7">
            <div data-product-story-copy className="flex h-full max-w-2xl flex-col gap-7 sm:gap-8">
              <header>
                <h2 className="text-balance font-[family:var(--font-display)] text-4xl leading-[1.02] text-[var(--river-deep)] sm:text-5xl">
                  {product.name}
                </h2>
              </header>

              <p className="max-w-[62ch] text-base leading-8 text-[var(--river-deep)]/76 sm:text-lg">
                {product.story}
              </p>

              <dl className="grid border-y border-[var(--line)] sm:grid-cols-2">
                <div className="border-b border-[var(--line)] py-5 sm:border-b-0 sm:border-r sm:pr-6">
                  <dt className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)] sm:text-[11px]">{t("shop.detail.collection")}</dt>
                  <dd className="mt-2 text-[15px] text-[var(--river-deep)] sm:text-base">{collectionLabel}</dd>
                </div>
                <div className="border-b border-[var(--line)] py-5 sm:border-b-0 sm:pl-6">
                  <dt className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)] sm:text-[11px]">{t("shop.detail.category")}</dt>
                  <dd className="mt-2 text-[15px] text-[var(--river-deep)] sm:text-base">{product.tag}</dd>
                </div>
                <div className="border-t border-[var(--line)] py-5 sm:col-span-2">
                  <dt className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)] sm:text-[11px]">{t("shop.detail.material")}</dt>
                  <dd className="mt-2 text-[15px] leading-7 text-[var(--river-deep)] sm:text-base">{materialLine}</dd>
                </div>
              </dl>

              <div className="mt-auto grid gap-3 pt-1 sm:flex sm:flex-wrap sm:gap-4">
                <Link href="/routes" className="btn-paper min-h-12 w-full px-6 py-3 text-[12px] sm:w-auto sm:text-[11px]">
                  {t("shop.detail.routesCta")}
                </Link>
                <Link href="/culture" className="btn-outline min-h-12 w-full px-6 py-3 text-[12px] sm:w-auto sm:text-[11px]">
                  {t("shop.detail.citiesCta")}
                </Link>
                <Link
                  href={`/community?compose=1&channel=Culture%20Desk&title=${encodeURIComponent(product.name)}&note=${encodeURIComponent(`Object note: ${product.name} feels worth recording because `)}`}
                  className="btn-gold min-h-12 w-full px-6 py-3 text-[12px] sm:w-auto sm:text-[11px]"
                >
                  {t("shop.detail.noteCta")}
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal delay={120} className="order-1 min-[620px]:order-none min-[620px]:h-full">
            <div data-product-story-media className="relative mx-auto aspect-[5/4] w-full max-w-xl rotate-2 border border-[var(--line)] bg-white p-4 scrapbook-shadow sm:p-6 min-[620px]:aspect-auto min-[620px]:h-full min-[620px]:min-h-[26rem] min-[620px]:max-w-none min-[620px]:rotate-0">
              <div className="absolute -top-3 right-8 z-20 h-8 w-24 rotate-12 border border-white/20 bg-white/45 backdrop-blur-sm sm:right-12" />
              <div className="relative h-full w-full overflow-hidden">
                <MediaFrame
                  asset={narrativeMedia}
                  fallbackSrc={product.image}
                  alt={`${product.name} provenance`}
                  mode={narrativeMedia?.type === "video" ? "interactive" : "image"}
                  mediaClassName="object-cover grayscale transition duration-1000 hover:scale-105 hover:grayscale-0"
                />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_46%,rgba(17,25,35,0.48))]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)] sm:text-[12px]">
                    {collectionLabel}
                  </p>

                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
