"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
import { fetchStoreCollections, fetchStoreProducts } from "@/lib/api-data";
import { useApiQuery, LoadingSpinner, ErrorState } from "@/lib/use-api-query";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { Reveal } from "@/components/ui/Reveal";
import { placeholderFor } from "@/lib/placeholders";
import { SEED_IMAGES } from "@/lib/seed-images";
import type { StoreCollection, StoreProduct } from "@/data/store";
import { PastoralPageMotion } from "@/components/ui/PastoralPageMotion";
import { usePreviewBridge } from "@/lib/preview";

interface ShopPageClientProps {
  initialCollections: StoreCollection[] | null;
  initialProducts: StoreProduct[] | null;
}

export default function ShopPageClient({
  initialCollections,
  initialProducts,
}: ShopPageClientProps) {
  const { t } = useLocale();
  const { previewData: previewCollection } =
    usePreviewBridge<StoreCollection>("collection");

  const {
    data: storeCollections,
    loading: colsLoading,
    error: colsError,
    refetch: refetchCollections,
  } = useApiQuery(() => fetchStoreCollections(), [], {
    initialData: initialCollections,
    revalidateOnMount: false,
  });

  const {
    data: storeProducts,
    loading: prodLoading,
    error: prodError,
    refetch: refetchProducts,
  } = useApiQuery(() => fetchStoreProducts(), [], {
    initialData: initialProducts,
    revalidateOnMount: false,
  });

  if (colsLoading && prodLoading && !initialCollections && !initialProducts) {
    return <LoadingSpinner text="Opening the shelf..." />;
  }

  if ((colsError || prodError) && !initialCollections && !initialProducts) {
    return (
      <ErrorState
        title="Store unavailable"
        message="We can't load the shop right now. Please try again shortly."
        onRetry={() => {
          void refetchCollections();
          void refetchProducts();
        }}
      />
    );
  }

  const baseCollections = storeCollections ?? initialCollections ?? [];
  const collections = previewCollection
    ? [
        previewCollection,
        ...baseCollections.filter(
          (collection) =>
            collection.href !== previewCollection.href &&
            collection.title !== previewCollection.title,
        ),
      ]
    : baseCollections;
  const products = storeProducts ?? initialProducts ?? [];
  const heroImage = SEED_IMAGES.shopHero ?? placeholderFor("square");

  return (
    <PastoralPageMotion
      className="min-h-screen bg-[var(--paper-deep)] bg-grain"
      motionKey={`${collections.map((collection) => collection.title).join("|")}:${products
        .map((product) => product.slug)
        .join("|")}`}
    >
      <section data-site-hero="shop" className="relative overflow-hidden pb-16 pt-16 sm:pb-20 sm:pt-20">
        <div className="site-container">
          <div className="grid grid-cols-1 items-center gap-8 sm:grid-cols-[minmax(0,1.35fr)_minmax(12rem,0.75fr)] sm:gap-8 lg:grid-cols-12 lg:gap-16">
            <div className="min-w-0 max-w-3xl lg:col-span-8">
              <Reveal>
                <h1 className="font-[family:var(--font-display)] text-[clamp(2.25rem,7vw,8rem)] leading-[0.92] tracking-[-0.03em] text-[var(--river-deep)]">
                  <span className="block overflow-hidden pb-1"><span data-pastoral-title className="block">{t("shop.atlas.titlePrimary")}</span></span>
                  <span className="block overflow-hidden pb-3"><span data-pastoral-title className="block italic text-[var(--gold)]">{t("shop.atlas.titleItalic")}</span></span>
                </h1>
                <p data-pastoral-subtitle className="handwritten mt-5 max-w-xl text-[13px] leading-6 text-[var(--muted)] sm:mt-8 sm:text-base sm:leading-relaxed lg:mt-12 lg:text-lg">
                  {t("shop.atlas.lede")}
                </p>
              </Reveal>
            </div>

            <div className="relative w-full min-w-0 self-end lg:col-span-4 lg:max-w-none lg:self-center">
              <Reveal delay={200}>
                {/* Shop hero: a catalogue plate of the shelf — square, flat,
                    and captioned like an archive record, distinct from the
                    polaroid gesture the culture pages own. */}
                <figure className="relative border border-[var(--line)] bg-white p-2 scrapbook-shadow sm:p-2.5">
                  <span aria-hidden className="absolute -left-1 -top-1 h-4 w-4 border-l-2 border-t-2 border-[var(--gold)]" />
                  <span aria-hidden className="absolute -right-1 -top-1 h-4 w-4 border-r-2 border-t-2 border-[var(--gold)]" />
                  <span aria-hidden className="absolute -bottom-1 -left-1 h-4 w-4 border-b-2 border-l-2 border-[var(--gold)]" />
                  <span aria-hidden className="absolute -bottom-1 -right-1 h-4 w-4 border-b-2 border-r-2 border-[var(--gold)]" />
                  <div className="relative aspect-[4/3] overflow-hidden bg-[var(--parchment-deep)] sm:aspect-[16/10]">
                    {/* React 19 hoists this into <head> for an early hero fetch. */}
                    <link rel="preload" as="image" href={heroImage} />
                    <div
                      data-pastoral-hero-media
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${heroImage})` }}
                      role="img"
                      aria-label="Work on a Lingnan ceramic object"
                    />
                  </div>
                  <figcaption className="flex items-center justify-between px-1 pb-1 pt-2.5">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--river-deep)]/60">
                      The Lingnan shelf
                    </span>
                    <span className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
                      Plate 01
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <section className="site-container py-tight">
        <Reveal>
          <h2 className="font-[family:var(--font-display)] text-3xl text-[var(--river-deep)] md:text-4xl">
            {t("shop.atlas.collectionsTitle")}
          </h2>
        </Reveal>

        {collections.length === 0 ? (
          <div className="mt-10 scrapbook-shadow max-w-2xl rotate-1 border border-[var(--line)] bg-white/70 p-10">
            <h3 className="font-[family:var(--font-display)] text-3xl text-[var(--river-deep)]">
              {t("shop.atlas.empty.collections.title")}
            </h3>
            <p className="handwritten mt-4 text-lg leading-relaxed text-[var(--muted)]">
              {t("shop.atlas.empty.collections.body")}
            </p>
          </div>
        ) : (
          <div className="scroll-fade-x scrollbar-hide -mx-4 mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-8 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
            {collections.map((collection, i) => {
              const cardImage = collection.image || placeholderFor("portrait");
              return (
                <Reveal key={collection.title} delay={i * 100} className="w-[82vw] max-w-[24rem] shrink-0 snap-start md:w-auto md:max-w-none md:shrink md:snap-none">
                  <Link href={collection.href} className="group block">
                    <article className="relative flex h-full flex-col transition-all duration-500 hover:-translate-y-1.5">
                      <div className="relative aspect-[16/10] overflow-hidden border-[0.7rem] border-white bg-white scrapbook-shadow lg:aspect-[3/4] lg:border-[0.9rem]">
                        <div
                          className="absolute inset-0 bg-cover bg-center transition duration-1000 group-hover:scale-105"
                          style={{ backgroundImage: `url(${cardImage})` }}
                        />
                        <div className="absolute inset-0 bg-black/5" />
                        <div className="absolute left-4 top-4 bg-[var(--gold)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white shadow-lg">
                          {collection.route}
                        </div>
                      </div>
                      <div className="mt-6 border border-[var(--line)] bg-white/72 p-6 scrapbook-shadow">
                        <h3 className="font-[family:var(--font-display)] text-3xl leading-tight text-[var(--river-deep)] transition-colors group-hover:text-[var(--cinnabar)]">
                          {collection.title}
                        </h3>

                        <div className="mt-6 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.22em] text-[var(--river-deep)]">
                          <span>{t("common.btn.enter")}</span>
                          <div className="h-px w-8 bg-[var(--gold)] transition-all duration-300 group-hover:w-12" />
                        </div>
                      </div>
                    </article>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        )}
      </section>

      <section className="site-container py-tight">
        <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-[family:var(--font-display)] text-3xl text-[var(--river-deep)] md:text-4xl">
              {t("shop.atlas.featuredTitle")}
            </h2>
          </div>
          <Link
            href="/shop/products"
            className="inline-flex min-h-11 items-center text-xs font-bold uppercase tracking-widest text-[var(--cinnabar)] transition-colors hover:text-[var(--cinnabar-deep)]"
          >
            {t("shop.atlas.viewAll")}
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="scrapbook-shadow max-w-2xl rotate-1 border border-[var(--line)] bg-white/70 p-10">
            <h3 className="font-[family:var(--font-display)] text-3xl text-[var(--river-deep)]">
              {t("shop.atlas.empty.products.title")}
            </h3>
            <p className="handwritten mt-4 text-lg leading-relaxed text-[var(--muted)]">
              {t("shop.atlas.empty.products.body")}
            </p>
          </div>
        ) : (
          <div className="scroll-fade-x scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-8 md:mx-0 md:grid md:grid-cols-2 md:gap-8 md:overflow-visible md:px-0 lg:grid-cols-3">
            {products.slice(0, 3).map((product, i) => (
              <div key={product.slug} className="w-[82vw] max-w-[24rem] shrink-0 snap-start md:w-auto md:max-w-none md:shrink md:snap-none">
                <StoreProductCard product={product} index={i} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="pb-20 lg:pb-24">
        <div className="site-container">
          <div className="relative overflow-hidden bg-[var(--night)] px-8 py-16 text-center text-white scrapbook-shadow lg:px-20 lg:py-24">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(185,138,70,0.08),transparent_60%)]" />
            <div className="relative z-10 mx-auto max-w-2xl">
              <Reveal>
                <h2 className="font-[family:var(--font-display)] text-3xl leading-tight md:text-5xl">
                  {t("shop.cta.title")}
                </h2>
                <div className="mt-8">
                  <Link
                    href="/shop/products"
                    className="inline-block bg-[var(--gold-light)] px-10 py-5 text-xs font-bold uppercase tracking-[0.2em] text-[var(--night)] transition-all hover:bg-white"
                  >
                    {t("shop.cta.button")}
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
    </PastoralPageMotion>
  );
}
