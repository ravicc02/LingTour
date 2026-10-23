"use client";

import { useMemo, useRef, useState } from "react";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import type { StoreProduct } from "@/data/store";
import { gsap, motionEase, useGSAP } from "@/lib/motion";

type AllProductsClientProps = {
  products: StoreProduct[];
  collections: string[];
  tags: string[];
};

export function AllProductsClient({ products, collections, tags }: AllProductsClientProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("All collections");
  const [tag, setTag] = useState("All types");

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return products.filter((product) => {
      const productCollection = product.collection ?? "";
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [product.name, productCollection, product.tag, product.story]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesCollection = collection === "All collections" || productCollection === collection;
      const matchesTag = tag === "All types" || product.tag === tag;

      return matchesQuery && matchesCollection && matchesTag;
    });
  }, [collection, products, query, tag]);

  const filteredKey = filteredProducts.map((product) => product.slug).join("|");

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const timeline = gsap.timeline({ defaults: { ease: motionEase.enter } });
        timeline
          .from("[data-registry-board]", { autoAlpha: 0, y: 24, rotation: -1.4, duration: 0.72 })
          .from("[data-registry-summary]", { autoAlpha: 0, y: 12, duration: 0.45 }, "-=0.32");
      });
      return () => media.revert();
    },
    { scope: rootRef },
  );

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const cards = gsap.utils.toArray<HTMLElement>("[data-registry-card]", root);
        cards.forEach((card, index) => {
          gsap.from(card, {
            autoAlpha: 0,
            y: 26,
            rotation: index % 2 === 0 ? -0.55 : 0.55,
            duration: 0.62,
            delay: Math.min(index, 5) * 0.04,
            ease: motionEase.enter,
            scrollTrigger: {
              trigger: card,
              start: "top 91%",
              once: true,
            },
          });
        });
      });
      return () => media.revert();
    },
    { scope: rootRef, dependencies: [filteredKey], revertOnUpdate: true },
  );

  return (
    <div data-polish-form ref={rootRef}>
      <div data-registry-board className="mb-12 rotate-[-0.5deg] border border-[var(--line)] bg-[var(--paper)] bg-grain p-5 scrapbook-shadow sm:mb-16 sm:p-6 lg:p-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_14rem_12rem]">
          <label className="block">
            <span className="text-[12px] font-bold uppercase tracking-widest text-[var(--muted)] mb-2 block">Search products</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Product, route, or story..."
              className="w-full border-b border-[var(--line)] bg-transparent py-3 text-sm text-[var(--river-deep)] outline-none transition focus:border-[var(--cinnabar)] handwritten"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-bold uppercase tracking-widest text-[var(--muted)] mb-2 block">Collection</span>
            <select
              value={collection}
              onChange={(event) => setCollection(event.target.value)}
              className="w-full border-b border-[var(--line)] bg-transparent py-3 text-sm text-[var(--river-deep)] outline-none transition focus:border-[var(--cinnabar)] appearance-none"
            >
              <option>All collections</option>
              {collections.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-bold uppercase tracking-widest text-[var(--muted)] mb-2 block">Type</span>
            <select
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              className="w-full border-b border-[var(--line)] bg-transparent py-3 text-sm text-[var(--river-deep)] outline-none transition focus:border-[var(--cinnabar)] appearance-none"
            >
              <option>All types</option>
              {tags.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div data-registry-summary className="mb-10 flex flex-wrap items-center justify-between gap-4 text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--muted)] sm:mb-12">
        <p>
          Showing {filteredProducts.length} <span className="text-[var(--gold)]">/</span> {products.length} Products
        </p>
        {(query || collection !== "All collections" || tag !== "All types") && (
          <button
            type="button"
            className="text-[var(--cinnabar)] hover:underline"
            onClick={() => {
              setQuery("");
              setCollection("All collections");
              setTag("All types");
            }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Two columns from the smallest width up. A single column put roughly
          446px of page height behind every product, so a catalogue of 18 ran
          past 8000px on a phone and grew without bound as stock was added. */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-8 min-[560px]:gap-x-6 min-[560px]:gap-y-14 md:gap-x-12 md:gap-y-20 lg:grid-cols-3">
        {filteredProducts.map((product, index) => (
          <div key={product.slug} data-registry-card>
            <StoreProductCard product={product} index={index} />
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="mt-24 text-center py-20 border border-[var(--line)] bg-white/30 scrapbook-shadow rotate-1">
          <p className="font-[family:var(--font-display)] text-4xl text-[var(--river-deep)] italic">
            No products found.
          </p>
          <p className="mt-4 text-sm text-[var(--muted)] handwritten">Try another search.</p>
          <button
            type="button"
            onClick={() => { setQuery(""); setCollection("All collections"); setTag("All types"); }}
            className="mt-8 btn-outline px-8 py-3"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
