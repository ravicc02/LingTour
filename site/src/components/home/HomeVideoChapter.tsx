"use client";

import { useEffect, useRef, useState } from "react";
import type { HomeVideo } from "@/types/content";
import { gsap, motionMedia, motionScrub, useGSAP } from "@/lib/motion";

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
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean };
      }
    ).connection;
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
    if (!section || !("IntersectionObserver" in window)) {
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
        { animate: motionMedia.allowMotion, desktop: motionMedia.tablet },
        (context) => {
          if (
            !context.conditions?.animate ||
            !context.conditions?.desktop ||
            !scope.current
          )
            return;
          const film =
            scope.current.querySelector<HTMLElement>("[data-home-film]");
          if (!film) return;
          gsap.fromTo(
            film,
            { scale: 1 },
            {
              scale: 1.035,
              ease: "none",
              scrollTrigger: {
                trigger: scope.current,
                start: "top bottom",
                end: "bottom top",
                scrub: motionScrub,
              },
            },
          );
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
      aria-label={video?.title || "Guangzhou skyline film"}
      data-home-video-section
      className="bg-[var(--paper-deep)] bg-grain pb-8 pt-12 sm:pb-10 sm:pt-14 lg:pt-16"
    >
      <div className="site-container">
        <div data-home-video-frame
          className="relative w-full overflow-hidden">
          <div className="relative aspect-[4/3] overflow-hidden sm:aspect-video">
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
              aria-label={video?.title || "Guangzhou skyline film"}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={togglePlayback}
              aria-label={
                paused
                  ? "Play Guangzhou skyline film"
                  : "Pause Guangzhou skyline film"
              }
              aria-pressed={!paused}
              className="absolute bottom-4 right-4 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/45 bg-[var(--night)]/58 text-white shadow-lift backdrop-blur-md transition duration-300 hover:scale-105 hover:bg-[var(--night)]/78 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:bottom-6 sm:right-6 sm:h-12 sm:w-12"
            >
              <span aria-hidden className="text-sm font-bold leading-none">
                {paused ? "▶" : "Ⅱ"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
