"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { MediaAsset } from "@/types/media";
import { mediaPoster } from "@/types/media";

type MediaFrameMode = "image" | "preview" | "ambient" | "interactive";

type MediaFrameProps = {
  asset?: MediaAsset | null;
  fallbackSrc?: string;
  alt: string;
  mode?: MediaFrameMode;
  className?: string;
  mediaClassName?: string;
  eager?: boolean;
  controls?: boolean;
  overlay?: ReactNode;
};

function useMediaPreferences() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [saveData, setSaveData] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReduceMotion(query.matches);
    updateMotion();
    query.addEventListener("change", updateMotion);

    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    setSaveData(Boolean(connection?.saveData));

    return () => query.removeEventListener("change", updateMotion);
  }, []);

  return { reduceMotion, saveData };
}

export function MediaFrame({
  asset,
  fallbackSrc = "",
  alt,
  mode = "image",
  className = "",
  mediaClassName = "object-cover",
  eager = false,
  controls,
  overlay,
}: MediaFrameProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { reduceMotion, saveData } = useMediaPreferences();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
    const frame = window.requestAnimationFrame(() => {
      const image = imageRef.current;
      if (image?.complete && image.naturalWidth > 0) {
        setLoaded(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [asset?.type, asset?.url, fallbackSrc]);

  const poster = mediaPoster(asset, fallbackSrc);
  const isVideo = asset?.type === "video" && Boolean(asset.url.trim());
  const isInteractive = mode === "interactive";
  const showPosterOnly =
    !isVideo ||
    mode === "image" ||
    failed ||
    ((reduceMotion || saveData) && !isInteractive);
  const shouldControl = controls ?? isInteractive;
  const shouldAutoplay = mode === "ambient" && !reduceMotion && !saveData;

  const resolvedImage = useMemo(() => {
    if (asset?.type === "image" && asset.url.trim()) {
      if (!failed) return asset.url;
      return fallbackSrc && fallbackSrc !== asset.url ? fallbackSrc : "";
    }
    if (!asset && failed) return "";
    return poster;
  }, [asset, failed, fallbackSrc, poster]);

  const playPreview = () => {
    if (mode !== "preview" || reduceMotion || saveData) return;
    void videoRef.current?.play().catch(() => undefined);
  };

  const pausePreview = () => {
    if (mode !== "preview") return;
    videoRef.current?.pause();
    if (videoRef.current) videoRef.current.currentTime = 0;
  };

  const hasLoadableMedia =
    (showPosterOnly && Boolean(resolvedImage)) || (!showPosterOnly && isVideo);

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      onMouseEnter={playPreview}
      onMouseLeave={pausePreview}
      onFocusCapture={playPreview}
      onBlurCapture={pausePreview}
    >
      {hasLoadableMedia ? (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 z-10 grid place-items-center bg-[linear-gradient(135deg,var(--paper),var(--paper-deep),var(--paper))] px-5 text-center transition-opacity duration-500 ${
            loaded ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="grid justify-items-center gap-3">
            <span aria-hidden="true" className="h-px w-14 animate-pulse bg-[var(--gold)]/55" />

          </div>
        </div>
      ) : null}
      {showPosterOnly ? (
        resolvedImage ? (
          <img
            ref={imageRef}
            src={resolvedImage}
            alt={alt}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : "auto"}
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`h-full w-full ${mediaClassName}`}
          />
        ) : (
          <div
            role="img"
            aria-label={alt}
            className="grid h-full w-full place-items-center bg-[var(--paper)] px-6 text-center text-xs uppercase tracking-[0.18em] text-[var(--muted)]"
          >
            Media pending
          </div>
        )
      ) : (
        <video
          ref={videoRef}
          src={asset.url}
          poster={poster || undefined}
          aria-label={alt}
          controls={shouldControl}
          autoPlay={shouldAutoplay}
          muted={mode !== "interactive"}
          loop={mode === "ambient" || mode === "preview"}
          playsInline
          preload={shouldAutoplay ? "auto" : "metadata"}
          onLoadedData={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`h-full w-full ${mediaClassName}`}
        />
      )}
      {asset?.type === "video" && showPosterOnly && poster ? (
        <span className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-black/68 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
          <span aria-hidden className="text-[11px]">▶</span>
          Video
        </span>
      ) : null}
      {overlay}
    </div>
  );
}
