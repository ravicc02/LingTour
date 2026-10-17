"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { MediaFrame } from "@/components/ui/MediaFrame";
import { gsap, motionEase, useGSAP } from "@/lib/motion";
import type { MediaAsset } from "@/types/media";
import {
  dedupeMedia,
  mediaAlt,
  mediaPoster,
  resolveMediaGallery,
  resolvePrimaryMedia,
} from "@/types/media";

type Stop = {
  time: string;
  stop: string;
  plan?: string;
  story: string;
  details: string[];
  culturalStory: string;
  image?: string;
  primaryMedia?: MediaAsset | null;
  images?: string[];
  media?: MediaAsset[];
  meal?: string;
  hotel?: string;
  transit?: string;
  placeDetail?: string;
  isFeatured?: boolean;
  lat?: number | null;
  lng?: number | null;
};

export type RouteStopTarget = { index: number; time: string; name: string };

type Props = {
  stops: Stop[];
  routeStory: string;
  routeTitle: string;
  routeMap?: ReactNode;
  onAddStopNote?: (stop: Stop, index: number) => void;
};

function mediaFor(stop: Stop): MediaAsset[] {
  const primary = resolvePrimaryMedia(stop.primaryMedia, stop.image);
  return dedupeMedia([
    ...(primary ? [primary] : []),
    ...resolveMediaGallery(stop.media),
    ...resolveMediaGallery(undefined, stop.images ?? []),
  ]);
}

function experienceFor(stop: Stop): string {
  return stop.plan?.trim() || stop.story.trim();
}

function remainingStoryFor(stop: Stop): string {
  const story = stop.story.trim();
  return story !== experienceFor(stop) ? story : "";
}

function practicalFor(stop: Stop) {
  return [
    { label: "Place", value: stop.placeDetail },
    { label: "Eat", value: stop.meal },
    { label: "Move", value: stop.transit },
    { label: "Stay", value: stop.hotel },
  ].filter((item) => item.value?.trim());
}

function StopContext({ stop }: { stop: Stop }) {
  const story = remainingStoryFor(stop);
  const culture = stop.culturalStory.trim();
  const practical = practicalFor(stop);

  return (
    <div data-route-context className="grid gap-6 text-sm leading-7 text-[var(--ink)]">
      {story ? <p className="whitespace-pre-line">{story}</p> : null}
      {culture ? <p className="whitespace-pre-line">{culture}</p> : null}
      {stop.details?.length ? (
        <ul className="grid gap-2 border-t border-[var(--line)] pt-4">
          {stop.details.map((detail, index) => (
            <li key={index} className="grid grid-cols-[0.5rem_minmax(0,1fr)] gap-3 whitespace-pre-line">
              <span aria-hidden="true" className="mt-[0.58rem] h-1.5 w-1.5 rounded-full bg-[var(--jade)]" />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {practical.length ? (
        <dl className="grid gap-3 border-t border-[var(--line)] pt-4">
          {practical.map(({ label, value }) => (
            <div key={label} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
              <dt className="text-[var(--muted)]">{label}</dt>
              <dd className="whitespace-pre-line">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function ImagePlate({ stop, compact = false, className = "" }: { stop: Stop; compact?: boolean; className?: string }) {
  const frames = mediaFor(stop);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const previousKey = useRef<string | null>(null);
  const mediaId = useId();
  const keyFor = (frame: MediaAsset) => `${frame.type}:${frame.url}`;
  // A removed selection falls back immediately without an effect-driven render.
  const activeIndex = Math.max(0, frames.findIndex((frame) => keyFor(frame) === activeKey));
  const leadFrame = frames[activeIndex];
  const selectedKey = leadFrame ? keyFor(leadFrame) : null;

  useGSAP(
    () => {
      const changed = previousKey.current !== null && previousKey.current !== selectedKey;
      previousKey.current = selectedKey;
      if (!changed || !mediaRef.current) return;

      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        // A small transition confirms a user-selected frame, never a scroll reveal.
        gsap.fromTo(
          mediaRef.current,
          { opacity: 0.85, x: 6 },
          {
            opacity: 1,
            x: 0,
            duration: 0.24,
            ease: motionEase.enter,
            clearProps: "transform,opacity",
          },
        );
      });
      return () => media.revert();
    },
    { scope: mediaRef, dependencies: [selectedKey], revertOnUpdate: true },
  );

  if (!leadFrame) return null;

  const cycle = (direction: number) => {
    const next = (activeIndex + direction + frames.length) % frames.length;
    setActiveKey(keyFor(frames[next]));
  };

  return (
    <figure data-route-image-plate aria-label={`Media for ${stop.stop}`} className={`min-w-0 ${className}`}>
      <div id={mediaId} className={`relative overflow-hidden bg-[var(--paper)] ${compact ? "aspect-[2/1] lg:aspect-[5/2]" : "aspect-[16/10]"}`}>
        <div ref={mediaRef} className="absolute inset-0">
          <MediaFrame
            key={selectedKey}
            asset={leadFrame}
            fallbackSrc={mediaPoster(leadFrame, stop.image ?? "")}
            alt={mediaAlt(leadFrame, stop.stop)}
            mode={leadFrame.type === "video" ? "interactive" : "image"}
            mediaClassName="object-cover"
          />
        </div>
      </div>
      {frames.length > 1 ? (
        <div className="mt-1 flex items-center justify-end gap-1">
          <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            Media {activeIndex + 1} of {frames.length} for {stop.stop}
          </span>
          <button
            type="button"
            onClick={() => cycle(-1)}
            aria-label={`Show previous media for ${stop.stop}`}
            aria-controls={mediaId}
            className="grid min-h-11 min-w-11 place-items-center text-[var(--river-deep)] hover:bg-[var(--paper)] active:opacity-70"
          >
            <span aria-hidden="true">&larr;</span>
          </button>
          <button
            type="button"
            onClick={() => cycle(1)}
            aria-label={`Show next media for ${stop.stop}`}
            aria-controls={mediaId}
            className="grid min-h-11 min-w-11 place-items-center text-[var(--river-deep)] hover:bg-[var(--paper)] active:opacity-70"
          >
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      ) : null}
    </figure>
  );
}

function StopNoteButton({ onClick }: { onClick?: () => void }) {
  if (!onClick) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 min-w-11 items-center justify-self-start text-sm text-[var(--river-deep)] underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--river-deep)] active:opacity-70"
    >
      Note this stop
    </button>
  );
}

function RouteEpilogue({
  stop,
  routeTitle,
  routeMap,
}: {
  stop: Stop;
  routeTitle: string;
  routeMap?: ReactNode;
}) {
  const leadFrame = mediaFor(stop)[0];

  return (
    <section
      data-route-epilogue
      aria-label="Route overview"
      className="mt-12 grid overflow-hidden border border-[var(--line)] bg-[var(--paper)] lg:mt-16 lg:h-[30rem] lg:grid-cols-2"
    >
      <figure className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto]">
        <div className="relative min-h-64 bg-[var(--paper-deep)] lg:min-h-0">
          {leadFrame ? (
            <div className="absolute inset-0">
              <MediaFrame
                asset={leadFrame}
                fallbackSrc={mediaPoster(leadFrame, stop.image ?? "")}
                alt={mediaAlt(leadFrame, stop.stop)}
                mode={leadFrame.type === "video" ? "interactive" : "image"}
                mediaClassName="object-cover"
              />
            </div>
          ) : null}
        </div>
        <figcaption className="p-6 lg:p-7">
          <h3 className="font-[family:var(--font-display)] text-3xl leading-[1.15] text-[var(--river-deep)] [overflow-wrap:anywhere]">
            {routeTitle}
          </h3>
        </figcaption>
      </figure>
      <div
        data-route-map-slot
        className="relative min-h-[22rem] min-w-0 border-t border-[var(--line)] lg:h-full lg:min-h-0 lg:border-l lg:border-t-0"
      >
        {routeMap}
      </div>
    </section>
  );
}

function StopNode({
  stop,
  index,
  featured,
  onAddStopNote,
}: {
  stop: Stop;
  index: number;
  featured: boolean;
  onAddStopNote?: (stop: Stop, index: number) => void;
}) {
  const headingId = useId();
  const alternate = index % 2 === 1;
  const experience = experienceFor(stop);
  const hasContext = Boolean(
    remainingStoryFor(stop) || stop.culturalStory.trim() || stop.details?.length || practicalFor(stop).length,
  );

  return (
    <article
      data-route-stop
      data-featured={featured}
      id={`stop-${index}`}
      aria-labelledby={headingId}
      className={`relative grid min-w-0 scroll-mt-28 gap-y-4 pl-7 last:pb-0 lg:grid-cols-2 lg:gap-x-20 lg:pl-0 ${featured ? "border-b border-[var(--line)] pb-12 lg:pb-16" : "pb-8 lg:pb-10"}`}
    >
      <span
        data-route-dot
        aria-hidden="true"
        className="pointer-events-none absolute left-px top-2 h-1.5 w-1.5 rounded-full bg-[var(--muted)] lg:left-1/2 lg:-translate-x-1/2"
      />
      {/* DOM order stays time, place, media, experience on both desktop sides. */}
      <header className={`min-w-0 lg:row-start-1 ${alternate ? "lg:col-start-2" : "lg:col-start-1"}`}>
        <p data-route-time className="font-mono text-sm font-semibold text-[var(--cinnabar)]">
          {stop.time}
        </p>
        <h3 id={headingId} className={`mt-2 font-[family:var(--font-display)] leading-[1.15] text-[var(--river-deep)] [overflow-wrap:anywhere] ${featured ? "text-3xl lg:text-4xl" : "text-2xl lg:text-3xl"}`}>
          {stop.stop}
        </h3>
      </header>
      <ImagePlate
        stop={stop}
        compact={!featured}
        className={`self-start lg:row-start-2 ${alternate ? "lg:col-start-2" : "lg:col-start-1"}`}
      />
      <div
        data-route-reading
        className={`grid min-w-0 content-start gap-5 [overflow-wrap:anywhere] lg:row-start-2 ${alternate ? "lg:col-start-1" : "lg:col-start-2"}`}
      >
        {experience ? (
          <p data-route-experience className="whitespace-pre-line text-base leading-[1.8] text-[var(--river-deep)] lg:text-lg">
            {experience}
          </p>
        ) : null}
        {hasContext ? (
          featured ? (
            <StopContext stop={stop} />
          ) : (
            <details data-route-additional className="border-t border-[var(--line)]">
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-[var(--river-deep)] underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--river-deep)]">
                More from this place<span className="sr-only">: {stop.stop}</span>
              </summary>
              <div className="pb-2 pt-3">
                <StopContext stop={stop} />
              </div>
            </details>
          )
        ) : null}
        <StopNoteButton onClick={onAddStopNote ? () => onAddStopNote(stop, index) : undefined} />
      </div>
    </article>
  );
}

export function TimeAxisItinerary({ stops, routeStory, routeTitle, routeMap, onAddStopNote }: Props) {
  if (stops.length === 0) return null;

  const briefStory = routeStory.trim();
  // Explicit false is an editorial choice too; only legacy routes use the fallback.
  const hasFeaturedFlags = stops.some((stop) => typeof stop.isFeatured === "boolean");
  const lastStop = stops[stops.length - 1];

  return (
    <section id="itinerary" className="relative py-beat">
      <div className="site-container">
        <div className="mx-auto max-w-6xl">
          <header data-route-header className="mb-10 max-w-3xl text-left lg:mb-12">
            <h2 className="text-balance font-[family:var(--font-display)] text-4xl leading-[1.08] text-[var(--river-deep)] lg:text-5xl">
              Itinerary Overview
            </h2>
            {briefStory ? <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{briefStory}</p> : null}

          </header>
          <div className="relative">
            <div
              data-route-spine
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 left-1 top-2 w-px bg-[var(--line)] lg:left-1/2 lg:-translate-x-1/2"
            />
            {stops.map((stop, index) => (
              <StopNode
                key={`stop-${index}`}
                stop={stop}
                index={index}
                featured={hasFeaturedFlags ? stop.isFeatured === true : index === 0}
                onAddStopNote={onAddStopNote}
              />
            ))}
          </div>
          <RouteEpilogue stop={lastStop} routeTitle={routeTitle} routeMap={routeMap} />
        </div>
      </div>
    </section>
  );
}
