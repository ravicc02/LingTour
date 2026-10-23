"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { Price } from "@/components/ui/Price";
import type { StoreProduct } from "@/data/store";
import { Reveal } from "@/components/ui/Reveal";
import { MediaFrame } from "@/components/ui/MediaFrame";

type StoreProductCardProps = {
  product: StoreProduct;
  index?: number;
};

export function StoreProductCard({ product, index = 0 }: StoreProductCardProps) {
  const { t } = useLocale();
  const fallbackImage = product.gallery?.find((image) => image?.trim());
  return (
    <Reveal delay={index * 80} className="min-w-0">
      <article data-polish-card="product"
        className={[
          "group relative min-w-0 overflow-hidden bg-white shadow-2xl transition-all duration-700 md:aspect-[4/5] md:overflow-visible",
          index % 2 === 0 ? "md:rotate-[-1deg]" : "md:rotate-[1deg]",
          "md:hover:-translate-y-1.5 md:hover:rotate-0"
        ].join(" ")}
      >
        {/* Physical Tag Attachment */}
        <div className="absolute -top-6 left-1/2 z-0 hidden h-12 w-px -translate-x-1/2 bg-[var(--river-deep)]/20 md:block" />
        <div className="absolute -top-8 left-1/2 z-0 hidden h-3 w-3 -translate-x-1/2 rounded-full border border-[var(--river-deep)]/20 bg-[var(--paper-deep)] md:block" />

        <Link href={`/shop/products/${product.slug}`} className="relative z-10 block overflow-hidden md:absolute md:inset-0 md:h-full md:w-full">
          <div className="relative aspect-[16/11] bg-[var(--paper)] md:aspect-auto md:h-full md:w-full md:bg-transparent">
            <MediaFrame
              asset={product.primaryMedia}
              fallbackSrc={product.image || fallbackImage}
              alt={product.name}
              mode="preview"
              className="bg-[var(--paper)]"
              mediaClassName="object-cover object-center transition-transform duration-1000 group-hover:scale-105 sm:group-hover:scale-110"
            />
            {/* Subtle Glass Overlay for depth */}
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.1),transparent)] transition-opacity group-hover:opacity-0" />
          </div>
        </Link>

        {/* The Interactive "Specimen Tag" */}
        <div className="relative z-20 min-w-0 border-t border-[var(--line)] bg-[var(--paper)] p-3 shadow-xl transition-transform duration-500 md:absolute md:bottom-4 md:left-4 md:right-4 md:border md:shadow-none lg:-bottom-10 lg:-right-4 lg:left-auto lg:w-40 lg:origin-bottom-right lg:rotate-3 lg:p-4 lg:shadow-xl lg:group-hover:rotate-0">
          {/* String loop hole */}
          <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-[var(--paper-deep)] border border-[var(--line)]" />

          <div className="space-y-3 pt-2">
            <div className="flex justify-end">
              <FavoriteButton id={product.slug} type="product" title={product.name} variant="dark" />
            </div>

            <h3 className="min-w-0 break-words font-[family:var(--font-display)] text-base leading-tight text-[var(--river-deep)] md:text-lg">
              {product.name}
            </h3>

            <div className="h-px bg-[var(--line)] w-full" />

            <div className="flex min-w-0 flex-col items-start gap-3">
              <div className="min-w-0 space-y-1 break-words">

                <p className="text-[12px] font-bold text-[var(--river-deep)]">
                  <Price amount={product.price} currency={product.currency} />
                </p>
              </div>

              <Link
                href={`/shop/products/${product.slug}`}
                className="lt-action-primary inline-flex min-h-11 shrink-0 items-center gap-2 border border-[var(--river-deep)] px-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors"
              >
                {t("common.btn.enter")}
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Hover Highlight (Light Leak) */}
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000 bg-[radial-gradient(circle_at_top_right,rgba(185,138,70,0.1),transparent_70%)]" />
      </article>
    </Reveal>
  );
}
