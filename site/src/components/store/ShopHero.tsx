"use client";

import { Reveal } from "@/components/ui/Reveal";
import { SEED_IMAGES } from "@/lib/seed-images";
import { placeholderFor } from "@/lib/placeholders";

export function ShopHero() {
  const heroImage = SEED_IMAGES.shopHero ?? placeholderFor("hero");

  return (
    <section className="relative flex min-h-[60svh] items-center overflow-hidden bg-[var(--night)] text-white">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(17,25,35,0.7),rgba(17,25,35,0.4)_50%,rgba(17,25,35,0.95))]" />

      <div className="site-container relative z-10 py-20">
        <div className="max-w-4xl">
          <Reveal>

            <h1 className="mt-8 font-[family:var(--font-display)] text-[4rem] leading-[0.92] sm:text-7xl md:text-8xl lg:text-[9.5rem]">
              Local <br className="hidden sm:block" /> Products
            </h1>
            <div className="mt-12 flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-20">

              <div className="hidden h-px w-20 bg-white/20 lg:mt-4 lg:block" />

            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
