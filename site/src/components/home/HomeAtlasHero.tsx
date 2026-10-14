"use client";

import Link from "next/link";
import { useRef } from "react";
import { gsap, motionEase, motionMedia, motionScrub, useGSAP } from "@/lib/motion";

type HomeAtlasHeroProps = {
  image: string;
  eyebrow: string;
  titleLine1: string;
  accent: string;
  titleLine3: string;
  body: string;
  primaryLabel: string;
  secondaryLabel: string;
  tags: string[];
};

export function HomeAtlasHero({
  image,
  eyebrow,
  titleLine1,
  accent,
  titleLine3,
  body,
  primaryLabel,
  secondaryLabel,
  tags,
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
          const copyItems = gsap.utils.toArray<HTMLElement>("[data-home-copy] > *", root);
          const heroMedia = root.querySelector<HTMLElement>("[data-home-media]");
          const timeline = gsap.timeline({ defaults: { ease: motionEase.enter } });
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
      className="home-hero relative isolate flex min-h-[100dvh] overflow-hidden bg-[var(--paper-deep)] text-[var(--river-deep)]"
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
      {/* Desktop keeps the photo visible to the very bottom edge, so it used to
          butt straight into the paper background below. Fade the last slice of
          the image into --paper-deep instead, matching the section that follows. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[32vh] bg-[linear-gradient(180deg,rgba(236,233,226,0)_0%,rgba(236,233,226,0.24)_42%,rgba(236,233,226,0.72)_76%,#ece9e2_100%)] max-lg:hidden"
      />

      <div className="site-container home-hero-container relative z-10 flex w-full flex-col justify-end pb-10 pt-36 sm:pb-12 lg:justify-center lg:pb-28 lg:pt-32 max-lg:pb-7 max-lg:pt-[36svh]">
        <div data-home-copy className="max-w-[46rem] lg:max-w-[53rem]">
          <p className="font-mono text-[12px] font-bold uppercase tracking-[0.3em] text-[var(--cinnabar)]">
            {eyebrow}
          </p>
          <h1 className="home-hero-title mt-7 max-w-[8.5ch] font-[family:var(--font-sans)] text-[clamp(3.1rem,8.6vw,8.4rem)] font-medium leading-[0.86] max-lg:mt-5">
            {titleLine1}
            <span className="mt-1 block italic text-[var(--gold)]">{accent}</span>
            <span className="block">{titleLine3}</span>
          </h1>
          <p className="mt-8 max-w-[38rem] text-sm leading-7 text-[var(--muted)] sm:text-base lg:mt-10 max-lg:mt-5 max-lg:max-w-[25rem] max-lg:text-[0.86rem] max-lg:leading-6">
            {body}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row max-lg:mt-6">
            <Link href="/interpreting#interpreting-booking" className="lt-action lt-action-gold min-w-[12rem]">
              {primaryLabel} <span aria-hidden>→</span>
            </Link>
            <Link href="/routes" className="lt-action lt-action-secondary min-w-[12rem]">
              {secondaryLabel}
            </Link>
          </div>
        </div>

        <div className="mt-12 grid gap-5 border-t border-[var(--line)] pt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end lg:absolute lg:bottom-10 lg:left-[var(--space-gutter)] lg:right-[var(--space-gutter)] lg:mt-0 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center max-lg:mt-8 max-lg:gap-3 max-lg:pt-4">
          <div className="flex max-w-[95%] flex-wrap gap-x-7 gap-y-2 lg:col-start-2 lg:max-w-none lg:flex-nowrap lg:justify-self-center max-lg:gap-x-5 max-lg:gap-y-1.5">
            {tags.map((label) => (
              <span key={label} className="font-mono text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                {label}
              </span>
            ))}
          </div>
          <span className="hidden items-center gap-3 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)] sm:flex lg:col-start-3 lg:justify-self-end">
            <span className="h-8 w-px bg-[var(--gold)]" />
            Scroll to explore
          </span>
        </div>
      </div>
    </section>
  );
}
