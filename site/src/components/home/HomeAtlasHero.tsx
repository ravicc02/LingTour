"use client";

import Link from "next/link";
import localFont from "next/font/local";
import styles from "./home-hero-typography.module.css";
import { useRef } from "react";
import {
  gsap,
  motionEase,
  motionMedia,
  motionScrub,
  useGSAP,
} from "@/lib/motion";

const coverFont = localFont({
  src: [
    { path: "./fonts/BodoniModa-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/BodoniModa-Italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-home-cover",
  display: "swap",
  fallback: ["Bodoni MT", "Didot", "Georgia", "serif"],
  adjustFontFallback: "Times New Roman",
});

type HomeAtlasHeroProps = {
  image: string;
  titleLine1: string;
  accent: string;
  titleLine3: string;
  primaryLabel: string;
  secondaryLabel: string;
};

export function HomeAtlasHero({
  image,
  titleLine1,
  accent,
  titleLine3,
  primaryLabel,
  secondaryLabel,
}: HomeAtlasHeroProps) {
  const scope = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add(
        {
          animate: "(prefers-reduced-motion: no-preference)",
          desktop: motionMedia.desktop,
        },
        (context) => {
          if (!context.conditions?.animate) return;
          const root = scope.current;
          if (!root) return;
          const copyItems = gsap.utils.toArray<HTMLElement>(
            "[data-home-copy] > *",
            root,
          );
          const heroMedia =
            root.querySelector<HTMLElement>("[data-home-media]");
          const timeline = gsap.timeline({
            defaults: { ease: motionEase.enter },
          });
          if (copyItems.length > 0) {
            timeline.fromTo(
              copyItems,
              { autoAlpha: 0, y: 26 },
              { autoAlpha: 1, y: 0, duration: 0.76, stagger: 0.07 },
            );
          }
          if (context.conditions?.desktop && heroMedia) {
            gsap.fromTo(
              heroMedia,
              { scale: 1.02, yPercent: -3 },
              {
                scale: 1.06,
                yPercent: 0,
                ease: "none",
                scrollTrigger: {
                  trigger: scope.current,
                  start: "top top",
                  end: "bottom top",
                  scrub: motionScrub,
                },
              },
            );
          }
        },
      );

      return () => media.revert();
    },
    { scope },
  );

  return (
    <section
      ref={scope}
      className={`home-hero ${styles.hero} ${coverFont.variable} relative isolate flex min-h-[100dvh] overflow-hidden bg-[var(--paper-deep)] text-[var(--river-deep)]`}
    >
      <div className="absolute inset-0 overflow-hidden bg-[var(--paper-deep)]">
        <img
          data-home-media
          src={image}
          alt="Guangdong landscape showcasing cultural heritage and scenic beauty"
          fetchPriority="high"
          className="h-full w-full object-cover object-[62%_center]"
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(236,233,226,0.97)_0%,rgba(236,233,226,0.91)_22%,rgba(236,233,226,0.58)_43%,rgba(236,233,226,0.14)_66%,rgba(236,233,226,0.02)_84%)] max-lg:bg-[linear-gradient(180deg,rgba(236,233,226,0)_0%,rgba(236,233,226,0.02)_25%,rgba(236,233,226,0.26)_38%,rgba(236,233,226,0.94)_55%,#ece9e2_70%)]" />
      {/* A short paper edge separates the cover from the framed film. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,rgba(236,233,226,0),#ece9e2)] sm:h-20 max-lg:hidden"
      />

      <div className={`home-hero-container ${styles.container} relative z-10`}>
        <div data-home-copy className={styles.copy}>
          <h1 className={`home-hero-title ${styles.title}`}>
            <span className={styles.opening}>{titleLine1}</span>{" "}
            <span className={styles.journey}>{accent}</span>{" "}
            <span className={styles.destination}>{titleLine3}</span>
          </h1>

          <div className={styles.actions}>
            <Link
              href="/interpreting#interpreting-booking"
              className={`lt-action lt-action-gold ${styles.primaryAction}`}
            >
              {primaryLabel} <span aria-hidden>→</span>
            </Link>
            <Link
              href="/routes"
              className={`lt-action lt-action-secondary ${styles.secondaryAction}`}
            >
              {secondaryLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
