"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { StoreProduct } from "@/data/store";
import { ProductActions } from "@/components/store/ProductActions";
import { Price } from "@/components/ui/Price";
import { MediaFrame } from "@/components/ui/MediaFrame";
import { gsap, motionEase, motionMedia, useGSAP } from "@/lib/motion";
import {
  dedupeMedia,
  mediaPoster,
  resolveMediaGallery,
  resolvePrimaryMedia,
} from "@/types/media";

function buildNoteWords(product: StoreProduct) {
  const words = Array.from(
    new Set(
      [product.tag, product.materialNotes]
        .filter(Boolean)
        .join(" ")
        .replace(/[^a-zA-Z\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 3),
    ),
  );

  return words.slice(0, 3);
}



export function ProductDetailHero({ product }: { product: StoreProduct }) {
  const rootRef = useRef<HTMLElement | null>(null);
  const plateRef = useRef<HTMLDivElement | null>(null);
  const media = useMemo(() => {
    const primary = resolvePrimaryMedia(product.primaryMedia, product.image);
    return dedupeMedia([
      ...(primary ? [primary] : []),
      ...resolveMediaGallery(product.galleryMedia, product.gallery ?? []),
    ]);
  }, [product.gallery, product.galleryMedia, product.image, product.primaryMedia]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [finish, setFinish] = useState("Collector finish");
  const [edition, setEdition] = useState("Single object");
  const activeMedia = media[activeIndex] ?? media[0] ?? null;
  const noteWords = buildNoteWords(product);
  const collectionLabel = product.collection || "Culvoy Goods";

  useGSAP(
    () => {
      const root = rootRef.current;
      const plate = plateRef.current;
      if (!root) return;

      const mediaQuery = gsap.matchMedia();
      mediaQuery.add(
        {
          animate: motionMedia.allowMotion,
          desktop: `${motionMedia.desktop} and ${motionMedia.finePointer}`,
        },
        (context) => {
          const { animate, desktop } = context.conditions ?? {};
          if (!animate) return;

          const intro = gsap.timeline({ defaults: { ease: motionEase.enter } });
          intro
            .from("[data-product-collection]", {
              autoAlpha: 0,
              y: 22,
              rotation: -6,
              duration: 0.7,
            })
            .from(
              "[data-product-heading]",
              { autoAlpha: 0, y: 34, duration: 0.82 },
              "-=0.38",
            )
            .from(
              "[data-product-note]",
              { autoAlpha: 0, y: 16, duration: 0.5, stagger: 0.08 },
              "-=0.42",
            )
            .from(
              "[data-product-frame]",
              {
                autoAlpha: 0,
                y: 44,
                scale: 0.96,
                rotation: -2.4,
                duration: 0.9,
                ease: motionEase.emphasized,
              },
              "-=0.72",
            )
            .from(
              "[data-product-buy]",
              { autoAlpha: 0, x: 28, rotation: 2.4, duration: 0.78 },
              "-=0.58",
            );

          if (!desktop || !plate) return;

          const moveX = gsap.quickTo(plate, "x", { duration: 0.5, ease: "power3.out" });
          const moveY = gsap.quickTo(plate, "y", { duration: 0.5, ease: "power3.out" });
          const rotate = gsap.quickTo(plate, "rotation", { duration: 0.58, ease: "power3.out" });

          const handleMove = (event: PointerEvent) => {
            const bounds = plate.getBoundingClientRect();
            const localX = (event.clientX - bounds.left) / bounds.width - 0.5;
            const localY = (event.clientY - bounds.top) / bounds.height - 0.5;
            moveX(localX * 7);
            moveY(localY * 6);
            rotate(localX * 0.9);
          };
          // A zero-duration gsap.set with a delay cannot be cancelled by the
          // next pointerenter, so returning to the card within 0.62s stripped
          // the layer hint mid-animation and never restored it.
          let willChangeCall: gsap.core.Tween | null = null;
          const handleEnter = () => {
            willChangeCall?.kill();
            willChangeCall = null;
            gsap.set(plate, { willChange: "transform" });
          };
          const handleLeave = () => {
            moveX(0);
            moveY(0);
            rotate(0);
            willChangeCall?.kill();
            willChangeCall = gsap.delayedCall(0.62, () => gsap.set(plate, { willChange: "auto" }));
          };

          plate.addEventListener("pointerenter", handleEnter);
          plate.addEventListener("pointermove", handleMove);
          plate.addEventListener("pointerleave", handleLeave);

          return () => {
            plate.removeEventListener("pointerenter", handleEnter);
            plate.removeEventListener("pointermove", handleMove);
            plate.removeEventListener("pointerleave", handleLeave);
            willChangeCall?.kill();
          };
        },
      );

      return () => mediaQuery.revert();
    },
    { scope: rootRef, dependencies: [product.slug], revertOnUpdate: true },
  );

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        "[data-product-media]",
        { autoAlpha: 0.55, scale: 0.975, rotation: activeIndex % 2 === 0 ? -0.45 : 0.45 },
        { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.58, ease: motionEase.emphasized },
      );
    },
    { scope: rootRef, dependencies: [activeIndex], revertOnUpdate: true },
  );

  const showPrevious = () => {
    if (media.length <= 1) return;
    setActiveIndex((current) => (current === 0 ? media.length - 1 : current - 1));
  };

  const showNext = () => {
    if (media.length <= 1) return;
    setActiveIndex((current) => (current + 1) % media.length);
  };

  return (
    <section
      ref={rootRef}
      className="overflow-hidden bg-[var(--paper-deep)] bg-grain pb-14 pt-6 sm:pb-16 sm:pt-8 lg:pb-20 lg:pt-12"
    >
      {/* React 19 hoists this into <head>: the lead media starts fetching with
          the document, so the object-file mount opens on parchment instead of
          a long "loading product media" beat. */}
      <link rel="preload" as="image" href={mediaPoster(activeMedia, product.image)} />
      <div className="border-y border-[rgba(20,33,47,0.1)] bg-[var(--paper-deep)] bg-grain py-4">
        <div className="site-container">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--river-deep)]/60 sm:text-[12px] sm:tracking-[0.2em]">
                Free route-linked packing for this object.
              </span>
            </div>
            <nav
              aria-label="Product breadcrumb"
              className="hidden items-center gap-2 text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--river-deep)]/40 md:flex"
            >
              <Link href="/" className="transition-colors hover:text-[var(--river-deep)]">Home</Link>
              <span>/</span>
              <Link href="/shop" className="transition-colors hover:text-[var(--river-deep)]">Store</Link>
              <span>/</span>
              <span className="max-w-48 truncate text-[var(--river-deep)]/80">{product.name}</span>
            </nav>
          </div>
        </div>
      </div>

      <div className="site-container mt-9 sm:mt-12">
        <div className="grid min-w-0 grid-cols-1 gap-6 min-[600px]:grid-cols-2 min-[600px]:gap-7 lg:grid-cols-12 lg:items-start lg:gap-8 xl:gap-12">
          <div className="contents lg:col-span-4 lg:block lg:min-w-0">
            <div className="order-1 col-span-1 space-y-5 min-[600px]:col-span-2 sm:space-y-8 lg:order-none lg:space-y-10">
              <div data-product-collection className="relative inline-block max-w-full -rotate-2 bg-[var(--river-deep)] p-5 scrapbook-shadow sm:p-6">
                <p className="handwritten text-xl text-[var(--gold-light)]">Collection</p>
                <p className="mt-2 font-[family:var(--font-display)] text-2xl leading-tight text-white">
                  {collectionLabel}
                </p>
                <div className="absolute -right-3 -top-3 grid h-14 w-14 rotate-12 place-items-center rounded-full border-2 border-dashed border-[var(--gold-light)]/50 sm:-right-4 sm:-top-4 sm:h-16 sm:w-16">
                  <span className="text-center text-[11px] font-bold uppercase tracking-widest text-[var(--gold-light)]/90 sm:text-[11px]">
                    Authentic<br />Object
                  </span>
                </div>
              </div>

              <header data-product-heading className="space-y-3 sm:space-y-4">
                <h1 className="text-balance font-[family:var(--font-display)] text-[clamp(1.875rem,6vw,5.5rem)] leading-[1.05] tracking-tight text-[var(--river-deep)]">
                  {product.name}
                </h1>

              </header>
            </div>

            <div className="order-4 col-span-1 space-y-5 min-[600px]:col-span-2 sm:space-y-8 lg:order-none lg:mt-10 lg:space-y-10">
              <div data-product-note className="space-y-3 border-t border-dashed border-[var(--river-deep)]/20 pt-6 sm:pt-8">


              </div>

              {noteWords.length ? (
                <div data-product-note className="space-y-3 border-t border-dashed border-[var(--river-deep)]/20 pt-6 sm:pt-8">
                  <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--river-deep)]/45 sm:text-[11px]">Materials</p>
                  <div className="flex flex-wrap gap-2">
                    {noteWords.map((word) => (
                      <span
                        key={word}
                        className="border border-[var(--river-deep)]/20 bg-white/50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--river-deep)] sm:text-[12px]"
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div data-product-frame className="relative order-2 min-w-0 lg:order-none lg:col-span-4">
            {/* Product hero: a flat object-file mount with a document header —
                the catalogue gesture, not a fourth polaroid. */}
            <div ref={plateRef} className="relative flex aspect-[4/5] w-full flex-col border border-[var(--line)] bg-white p-5 scrapbook-shadow transform-gpu sm:p-7 xl:p-9">
              <div className="mb-4 flex shrink-0 items-center justify-between gap-4 border-b border-[var(--river-deep)]/15 pb-3">
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--river-deep)]/55">
                  Object file
                </span>
                <span className="max-w-[11rem] truncate font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">
                  {collectionLabel}
                </span>
              </div>
              <div className="relative min-h-0 flex-1">
                <div className="flex h-full w-full items-center justify-center">
                  <div data-product-media className="h-full w-full">
                    <MediaFrame
                      asset={activeMedia}
                      fallbackSrc={product.image}
                      alt={product.name}
                      mode={activeMedia?.type === "video" ? "interactive" : "image"}
                      eager
                      mediaClassName="object-contain"
                    />
                  </div>

                {media.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={showPrevious}
                      aria-label="Show previous product media"
                      className="absolute left-2 top-1/2 z-30 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-[var(--river-deep)] text-white shadow-lg transition-transform hover:scale-110 active:scale-95 sm:-left-5 sm:h-12 sm:w-12"
                    >
                      <span aria-hidden className="-mt-0.5 pr-0.5 text-2xl">&#8249;</span>
                    </button>
                    <button
                      type="button"
                      onClick={showNext}
                      aria-label="Show next product media"
                      className="absolute right-2 top-1/2 z-30 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-[var(--river-deep)] text-white shadow-lg transition-transform hover:scale-110 active:scale-95 sm:-right-5 sm:h-12 sm:w-12"
                    >
                      <span aria-hidden className="-mt-0.5 pl-0.5 text-2xl">&#8250;</span>
                    </button>
                  </>
                ) : null}
                </div>
              </div>
              <div className="absolute bottom-3 right-4 handwritten text-lg text-[var(--gold)] sm:bottom-6 sm:right-6 sm:text-xl">
                {media.length > 0 ? `${activeIndex + 1} / ${media.length}` : "—"}
              </div>
            </div>

            {media.length > 1 ? (
              <div className="mt-8 flex flex-wrap justify-center gap-3 sm:mt-12 sm:gap-4">
                {media.map((asset, index) => (
                  <button
                    key={`${asset.type}:${asset.url}`}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-label={`Show ${asset.type} ${index + 1} of ${media.length}`}
                    aria-pressed={activeIndex === index}
                    className={`relative h-16 w-16 overflow-hidden border-4 transition-all sm:h-20 sm:w-20 ${
                      activeIndex === index
                        ? "z-10 rotate-2 scale-105 border-[var(--gold)] scrapbook-shadow sm:scale-110"
                        : "-rotate-2 border-white opacity-60 hover:opacity-100"
                    }`}
                  >
                    <MediaFrame asset={asset} alt="" mode="image" mediaClassName="object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <aside data-product-buy className="order-3 min-w-0 lg:order-none lg:col-span-4 lg:pl-4 xl:pl-8">
            <div className="-rotate-1 space-y-7 bg-white p-6 scrapbook-shadow sm:p-8 lg:space-y-8">
              <p className="font-[family:var(--font-display)] text-5xl tracking-tight text-[var(--river-deep)] sm:text-6xl">
                <Price amount={product.price} currency={product.currency} />
              </p>

              <fieldset className="space-y-4">
                <legend className="text-[12px] font-bold uppercase tracking-widest text-[var(--river-deep)]/45 italic sm:text-[11px]">Select Finish</legend>
                <div className="grid gap-2">
                  {["Collector finish", "Daily use finish"].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setFinish(option)}
                      aria-pressed={finish === option}
                      className={`group flex min-h-12 items-center justify-between border-2 px-4 py-3 text-left transition-all sm:px-5 ${
                        finish === option
                          ? "border-[var(--river-deep)] bg-[var(--river-deep)] text-white"
                          : "border-[var(--river-deep)]/10 text-[var(--river-deep)]/65 hover:border-[var(--river-deep)]/30"
                      }`}
                    >
                      <span className="text-[12px] font-bold uppercase tracking-[0.16em] sm:text-xs sm:tracking-widest">{option}</span>
                      {finish === option ? <span className="handwritten text-lg text-[var(--gold-light)]">Selected</span> : null}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-4 pt-1">
                <legend className="text-[12px] font-bold uppercase tracking-widest text-[var(--river-deep)]/45 italic sm:text-[11px]">Choose Edition</legend>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {["Single object", "Gift set"].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setEdition(option)}
                      aria-pressed={edition === option}
                      className={`min-h-12 border-2 px-2 py-3 text-[11px] font-bold uppercase tracking-[0.14em] transition-all sm:text-[12px] sm:tracking-widest ${
                        edition === option
                          ? "border-[var(--gold-light)] bg-[var(--gold-light)] text-[var(--night)]"
                          : "border-[var(--river-deep)]/10 text-[var(--river-deep)]/65 hover:border-[var(--river-deep)]/30"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </fieldset>

              <ProductActions product={product} variant="editorial" />

              <div className="grid gap-3 border-t border-dashed border-[var(--river-deep)]/18 pt-5">
                <Link
                  href="/routes"
                  className="inline-flex min-h-11 items-center font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--river-deep)] underline-offset-4 hover:text-[var(--cinnabar)] hover:underline sm:text-[12px] sm:tracking-[0.24em]"
                >
                  Trace the route behind this object
                </Link>
                <Link
                  href={`/community?compose=1&channel=Culture%20Desk&title=${encodeURIComponent(product.name)}&note=${encodeURIComponent(`Review: ${product.name}. `)}`}
                  className="inline-flex min-h-11 items-center font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)] underline-offset-4 hover:text-[var(--cinnabar)] hover:underline sm:text-[12px] sm:tracking-[0.24em]"
                >
                  Send this object to the community desk
                </Link>
              </div>

              <div className="flex items-center gap-3 pt-2 text-[11px] font-bold uppercase tracking-widest text-[var(--river-deep)]/35 italic sm:gap-4 sm:text-[12px]">
                <div className="h-px flex-1 bg-[var(--river-deep)]/10" />

                <div className="h-px flex-1 bg-[var(--river-deep)]/10" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
