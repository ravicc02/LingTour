"use client";

import { useEffect, useRef, useState } from "react";
import type { HomeVideo } from "@/types/content";
import { gsap, motionDuration, motionEase, motionMedia, motionScrub, useGSAP } from "@/lib/motion";

type HomeVideoChapterProps = {
  video?: HomeVideo;
};

export function HomeVideoChapter({ video }: HomeVideoChapterProps) {
  const scope = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const [wantsManualPlayback, setWantsManualPlayback] = useState(false);
  const [paused, setPaused] = useState(true);
  const filmUrl = video?.url?.trim() || "";
  const poster = video?.poster;
  const shouldLoadVideo =
    (hasEnteredViewport && !reduceMotion && !saveData) || wantsManualPlayback;
  const shouldAutoPlay = hasEnteredViewport && !reduceMotion && !saveData;

  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean };
    }).connection;
    const sync = () => {
      setReduceMotion(still.matches);
      setSaveData(Boolean(connection?.saveData));
    };

    sync();
    still.addEventListener("change", sync);
    return () => still.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const section = scope.current;
    if (!section || !('IntersectionObserver' in window)) {
      setHasEnteredViewport(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setHasEnteredViewport(true);
      observer.disconnect();
    });
    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (shouldAutoPlay || wantsManualPlayback) {
      void videoRef.current?.play().catch(() => undefined);
    }
  }, [shouldAutoPlay, wantsManualPlayback]);

  const togglePlayback = () => {
    const element = videoRef.current;
    if (!element) return;

    if (!shouldLoadVideo) {
      setWantsManualPlayback(true);
      element.src = filmUrl;
      element.load();
      void element.play().catch(() => undefined);
      return;
    }

    if (element.paused) {
      void element.play();
    } else {
      element.pause();
    }
  };

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add(
        {
          animate: "(prefers-reduced-motion: no-preference)",
          desktop: motionMedia.tablet,
        },
        (context) => {
          if (!context.conditions?.animate || !scope.current) return;
          const film = scope.current.querySelector<HTMLElement>("[data-home-film]");
          if (!film) return;

          gsap.fromTo(
            film,
            { autoAlpha: 0, clipPath: "inset(12% 0 12% 0)" },
            {
              autoAlpha: 1,
              clipPath: "inset(0% 0 0% 0)",
              duration: motionDuration.cinematic,
              ease: motionEase.enter,
              clearProps: "clipPath",
              scrollTrigger: {
                trigger: scope.current,
                start: "top 88%",
                once: true,
              },
            },
          );

          if (context.conditions?.desktop) {
            gsap.fromTo(
              film,
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

  if (!filmUrl) return null;

  return (
    <section
      ref={scope}
      aria-label={video?.title || "Guangdong film"}
      className="pb-6 pt-8 sm:pb-8 sm:pt-10 lg:pb-10 lg:pt-0"
    >
      <div className="relative w-full border-[0.4rem] border-[var(--paper-deep)] bg-[var(--paper-deep)] shadow-panel sm:border-[0.7rem]">
        <div className="relative aspect-[4/3] overflow-hidden bg-[var(--night)] sm:aspect-video">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[22%] bg-[linear-gradient(180deg,#ece9e2_0%,rgba(236,233,226,0.82)_30%,rgba(236,233,226,0)_100%)]"
          />
          <video
            ref={videoRef}
            data-home-film
            src={shouldLoadVideo ? filmUrl : undefined}
            poster={poster}
            autoPlay={shouldAutoPlay}
            muted
            loop
            playsInline
            preload={shouldLoadVideo ? "metadata" : "none"}
            onPlay={() => setPaused(false)}
            onPause={() => setPaused(true)}
            aria-label={video?.title || "Guangdong film"}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[18%] bg-[linear-gradient(180deg,rgba(236,233,226,0)_0%,rgba(236,233,226,0.58)_68%,#ece9e2_100%)]"
          />
          <button
            type="button"
            onClick={togglePlayback}
            aria-label={`${paused ? "Play" : "Pause"} ${video?.title || "Guangdong film"}`}
            aria-pressed={!paused}
            className="absolute bottom-4 right-4 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/45 bg-[var(--night)]/58 text-white shadow-lift backdrop-blur-md transition duration-300 hover:scale-105 hover:bg-[var(--night)]/78 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:bottom-6 sm:right-6 sm:h-12 sm:w-12"
          >
            <span aria-hidden className="text-sm font-bold leading-none">
              {paused ? "▶" : "Ⅱ"}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
