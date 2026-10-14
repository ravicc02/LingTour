"use client";

import Link from "next/link";
import { useRef } from "react";
import { gsap, motionEase, motionMedia, motionScrub, useGSAP } from "@/lib/motion";
import { useLocale } from "@/lib/locale-context";

export function HomeAtlasHero({ image }: { image: string }) {
  const scope = useRef<HTMLElement | null>(null);
  const { t } = useLocale();

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add({ animate: "(prefers-reduced-motion: no-preference)", desktop: motionMedia.desktop }, (context) => {
      if (!context.conditions?.animate || !scope.current) return;
      const root = scope.current;
      // Sequence identity before destinations; the default markup stays visible.
      gsap.fromTo(root.querySelectorAll("[data-home-copy] > *"), { autoAlpha: 0, y: 18 }, {
        autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.09, ease: motionEase.enter,
        clearProps: "opacity,visibility,transform",
      });
      if (context.conditions.desktop) {
        gsap.fromTo(root.querySelector("[data-home-media]"), { scale: 1.02, yPercent: -3 }, {
          scale: 1.06, yPercent: 0, ease: "none",
          scrollTrigger: { trigger: root, start: "top top", end: "bottom top", scrub: motionScrub },
        });
      }
    });
    return () => media.revert();
  }, { scope });

  return (
    <section ref={scope} className="home-hero home-brand-hero">
      <div className="home-brand-photo" aria-hidden="true">
        <img data-home-media src={image} alt="" fetchPriority="high" className="h-full w-full object-cover" />
      </div>
      <div className="home-brand-wash" aria-hidden="true" />
      <div className="site-container home-brand-copy" data-home-copy>
        <h1 className="home-brand-wordmark">{t("home.hero.title")}</h1>
        <nav className="home-brand-links" aria-label="Explore Culvoy">
          <Link href="/culture">{t("common.nav.culture")}</Link>
          <Link href="/routes">{t("common.nav.routes")}</Link>
          <Link href="/interpreting">{t("common.nav.interpreting")}</Link>
        </nav>
      </div>
    </section>
  );
}
