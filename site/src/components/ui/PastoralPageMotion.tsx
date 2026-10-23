"use client";

import { type ReactNode, useRef } from "react";
import { ScrollTrigger, gsap, motionDuration, motionEase, motionMedia, motionScrub, useGSAP } from "@/lib/motion";

type PastoralPageMotionProps = {
  children: ReactNode;
  className?: string;
  motionKey?: string;
};

export function PastoralPageMotion({
  children,
  className = "",
  motionKey = "default",
}: PastoralPageMotionProps) {
  const scope = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      if (!scope.current) return;

      const media = gsap.matchMedia();
      const refreshFrame = window.requestAnimationFrame(() => ScrollTrigger.refresh());

      media.add(
        {
          animate: motionMedia.allowMotion,
          desktop: motionMedia.tablet,
        },
        (context) => {
          const heroMedia = gsap.utils.toArray<HTMLElement>("[data-pastoral-hero-media]", scope.current);
          const cards = gsap.utils.toArray<HTMLElement>("[data-pastoral-card]", scope.current);
          const titles = gsap.utils.toArray<HTMLElement>("[data-pastoral-title]", scope.current);
          const introElements = gsap.utils.toArray<HTMLElement>(
            "[data-pastoral-kicker], [data-pastoral-subtitle], [data-pastoral-stamp]",
            scope.current,
          );

          if (!context.conditions?.animate) {
            // Keep authored media backgrounds when clearing entrance motion.
            gsap.set(heroMedia, { clearProps: "transform,opacity,visibility" });
            gsap.set([...cards, ...introElements, ...titles], { clearProps: "all" });
            return;
          }

          const kicker = scope.current?.querySelector<HTMLElement>("[data-pastoral-kicker]");
          const subtitle = scope.current?.querySelector<HTMLElement>("[data-pastoral-subtitle]");
          const stamp = scope.current?.querySelector<HTMLElement>("[data-pastoral-stamp]");

          if (kicker || subtitle || stamp || titles.length) {
            const intro = gsap.timeline({ defaults: { ease: motionEase.emphasized } });
            if (kicker) {
              intro.from(kicker, { autoAlpha: 0, y: 12, duration: motionDuration.medium });
            }
            if (titles.length) {
              // The hero titles have carried this hook (and, on most pages, an
              // overflow-hidden wrapper) for a line-by-line clip entrance, but
              // nothing ever queried it — the mask was dead scaffolding.
              intro.from(
                titles,
                { yPercent: 105, duration: motionDuration.slow, stagger: 0.09, ease: "power4.out" },
                kicker ? "-=0.22" : 0,
              );
            }
            if (subtitle) {
              intro.from(subtitle, { autoAlpha: 0, y: 14, duration: motionDuration.slow }, "-=0.45");
            }
            if (stamp) {
              intro.from(stamp, { autoAlpha: 0, scale: 0.72, rotation: -16, duration: motionDuration.cinematic, ease: motionEase.stamp }, "-=0.72");
            }
          }

          cards.forEach((card, index) => {
            gsap.fromTo(
              card,
              { y: context.conditions?.desktop ? 20 : 12 },
              {
                y: 0,
                duration: motionDuration.medium,
                delay: (index % 2) * 0.06,
                ease: motionEase.enter,
                clearProps: "transform",
                scrollTrigger: {
                  trigger: card,
                  start: "top 88%",
                  once: true,
                },
              },
            );
          });

          if (context.conditions?.desktop) {
            heroMedia.forEach((image) => {
              gsap.fromTo(
                image,
                { scale: 1.02, yPercent: -3 },
                {
                  scale: 1.06,
                  yPercent: 0,
                  ease: "none",
                  scrollTrigger: {
                    trigger: image.closest("section") ?? scope.current,
                    start: "top top",
                    end: "bottom top",
                    scrub: motionScrub,
                  },
                },
              );
            });
          }
        },
      );

      return () => {
        window.cancelAnimationFrame(refreshFrame);
        media.revert();
      };
    },
    { scope, dependencies: [motionKey], revertOnUpdate: true },
  );

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}
