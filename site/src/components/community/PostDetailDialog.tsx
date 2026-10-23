"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CommunityFeedPost, CommunityPostMedia } from "@/lib/api-data";
import {
  toggleCommunityPostLike,
  toggleCommunityPostSave,
} from "@/lib/api-data";
import { Avatar } from "@/components/ui/Avatar";
import { useLocale } from "@/lib/locale-context";

type Identity = {
  name: string;
  handle?: string;
  avatar?: string;
};

type Props = {
  post: CommunityFeedPost | null;
  onClose: () => void;
  currentUser?: Identity | null;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
  onEngagementChange?: (post: CommunityFeedPost) => void;
};

/**
 * A single live photo (实况图): the clip's first frame is the resting view and
 * a tap toggles muted playback. Playback is user-initiated, so reduced-motion
 * users simply never press play.
 */
function LiveMediaFrame({
  url,
  poster,
  title,
}: {
  url: string;
  poster?: string;
  title: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  };

  return (
    <button
      type="button"
      onClick={togglePlayback}
      aria-label={playing ? `Pause live moment: ${title}` : `Play live moment: ${title}`}
      className="group relative block w-full cursor-pointer"
    >
      <video
        ref={videoRef}
        src={url}
        poster={poster || undefined}
        muted
        loop
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className={`w-full object-cover ${
          playing ? "" : "grayscale-[0.04]"
        }`}
      />
      </button>
  );
}

export function PostDetailDialog({
  post,
  onClose,
  isLoggedIn = false,
  onRequireLogin,
  onEngagementChange,
}: Props) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // Read through a ref inside the lifecycle effect so a fresh `onClose`
  // identity from the parent does not re-subscribe the trap and re-run its
  // focus restore while the dialog is still open.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [saveCount, setSaveCount] = useState(0);

  const media: CommunityPostMedia[] = useMemo(() => post?.media ?? [], [post]);
  const mediaCount = media.length;

  const scrollTrackTo = (index: number, smooth = true) => {
    const track = trackRef.current;
    if (!track) return;
    const left = index * track.clientWidth;
    // jsdom (and some older browsers) lack Element.scrollTo.
    if (typeof track.scrollTo === "function") {
      track.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
    } else {
      track.scrollLeft = left;
    }
  };

  // Reset carousel and engagement state whenever another post is opened.
  useEffect(() => {
    setActiveIndex(0);
    scrollTrackTo(0, false);
    setLiked(Boolean(post?.liked));
    setSaved(Boolean(post?.saved));
    setLikeCount(post?.likes ?? 0);
    setSaveCount(post?.saves ?? 0);
    // scrollTrackTo is stable for the lifetime of the component.
  }, [post]);

  // Dialog lifecycle: scroll lock, Escape, the focus trap and the initial
  // focus. Deliberately independent of activeIndex — switching media must not
  // re-run the trap and yank focus back to the close button mid-browse.
  useEffect(() => {
    if (!post) return;
    const postId = post.id;
    const previous = document.body.style.overflow;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !containerRef.current) return;

      const focusable = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!containerRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    const focusFrame = window.requestAnimationFrame(() =>
      closeButtonRef.current?.focus(),
    );
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKeyDown);
      window.cancelAnimationFrame(focusFrame);
      // The feed re-renders while the dialog is open — that is exactly what
      // replaces the opener node — so the restore has to wait for the DOM to
      // settle. Focusing a card React is about to swap out blurs straight to
      // <body>, which is the bug this replaces.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const card = document.querySelector<HTMLElement>(
            `[data-community-post-link="${postId}"]`,
          );
          if (card) {
            card.focus();
          } else if (previouslyFocused && document.contains(previouslyFocused)) {
            previouslyFocused.focus();
          }
        });
      });
    };
    // Focus ownership follows the open post alone: a new `onClose` identity or
    // a media switch must not re-run the restore and yank focus away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id]);

  // Left/right arrow media navigation. It never moves focus, so keyboard
  // browsing stays wherever the reader left it.
  useEffect(() => {
    if (!post || mediaCount <= 1) return;
    const handleArrowKeys = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      setActiveIndex((current) => {
        const next = Math.min(Math.max(current + delta, 0), mediaCount - 1);
        scrollTrackTo(next);
        return next;
      });
    };
    window.addEventListener("keydown", handleArrowKeys);
    return () => window.removeEventListener("keydown", handleArrowKeys);
    // scrollTrackTo is stable for the lifetime of the component.
  }, [post, mediaCount]);

  const metaLine = useMemo(() => {
    if (!post) return "";
    return [post.channel, post.location, post.route, post.mood]
      .filter(Boolean)
      .join(" / ");
  }, [post]);

  const handleTrackScroll = () => {
    const track = trackRef.current;
    if (!track || media.length <= 1) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    setActiveIndex(Math.min(Math.max(index, 0), media.length - 1));
  };

  const scrollToMedia = (index: number) => {
    const next = Math.min(Math.max(index, 0), media.length - 1);
    setActiveIndex(next);
    scrollTrackTo(next);
  };

  const publishEngagement = (changes: Partial<CommunityFeedPost>) => {
    if (post) {
      onEngagementChange?.({ ...post, ...changes });
    }
  };

  const handleLike = async () => {
    if (!post) return;
    if (!isLoggedIn) {
      onRequireLogin?.();
      return;
    }
    const nextLiked = !liked;
    const optimisticLikes = Math.max(0, likeCount + (nextLiked ? 1 : -1));
    setLiked(nextLiked);
    setLikeCount(optimisticLikes);
    publishEngagement({ liked: nextLiked, likes: optimisticLikes });
    try {
      const result = await toggleCommunityPostLike(post.id);
      setLiked(result.liked);
      setLikeCount(result.likes);
      publishEngagement({ liked: result.liked, likes: result.likes });
    } catch (error) {
      setLiked(!nextLiked);
      setLikeCount(likeCount);
      publishEngagement({ liked: !nextLiked, likes: likeCount });
      console.error("Failed to toggle community post like", error);
    }
  };

  const handleSave = async () => {
    if (!post) return;
    if (!isLoggedIn) {
      onRequireLogin?.();
      return;
    }
    const nextSaved = !saved;
    const optimisticSaves = Math.max(0, saveCount + (nextSaved ? 1 : -1));
    setSaved(nextSaved);
    setSaveCount(optimisticSaves);
    publishEngagement({ saved: nextSaved, saves: optimisticSaves });
    try {
      const result = await toggleCommunityPostSave(post.id);
      setSaved(result.saved);
      setSaveCount(result.saves);
      publishEngagement({ saved: result.saved, saves: result.saves });
    } catch (error) {
      setSaved(!nextSaved);
      setSaveCount(saveCount);
      publishEngagement({ saved: !nextSaved, saves: saveCount });
      console.error("Failed to toggle community post save", error);
    }
  };

  if (!post) return null;

  const hasMedia = media.length > 0;
  const hasText = Boolean(post.excerpt.trim());

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close post detail"
        className="absolute inset-0 bg-[var(--night)]/42 backdrop-blur-[3px]"
        onClick={onClose}
      />

      <div
        data-polish-dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-post-title"
        className="relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--paper-deep)] bg-grain shadow-panel sm:max-h-[88vh]"
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4 sm:px-8">
          <div>
            <p className="font-mono text-[12px] uppercase tracking-[0.24em] text-[var(--cinnabar)]">
              Post
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">{metaLine}</p>
          </div>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] text-xl text-[var(--muted)] transition hover:text-[var(--cinnabar)]"
            aria-label="Close post detail"
          >
            ×
          </button>
        </div>

        <div className="scrollbar-hide grid flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1.1fr)_22rem]">
          <div className="px-5 py-5 sm:px-8 sm:py-7">
            {hasMedia ? (
              <div>
                <div
                  ref={trackRef}
                  onScroll={handleTrackScroll}
                  className="scrollbar-hide -mx-1 flex snap-x snap-mandatory overflow-x-auto scroll-smooth px-1"
                  aria-roledescription="carousel"
                  aria-label="Post media"
                >
                  {media.map((item, index) => (
                    <div
                      key={`${item.url}-${index}`}
                      id={`community-media-panel-${index}`}
                      role="tabpanel"
                      aria-label={`Media ${index + 1} of ${media.length}`}
                      className={`w-full shrink-0 snap-center pr-1 ${
                        hasText ? "max-h-[28rem]" : "max-h-[34rem]"
                      }`}
                    >
                      <div className="flex h-full items-center justify-center overflow-hidden rounded-[var(--radius-lg)] border-[10px] border-white bg-white scrapbook-shadow">
                        {item.type === "live" ? (
                          <LiveMediaFrame
                            url={item.url}
                            poster={item.poster}
                            title={post.title}
                          />
                        ) : (
                          <img
                            src={item.url}
                            alt={`${post.title} — media ${index + 1}`}
                            className={`w-full object-cover ${
                              hasText ? "max-h-[25rem]" : "max-h-[31rem]"
                            }`}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {media.length > 1 ? (
                  <div className="mt-4 flex items-center justify-center gap-4">
                    <button
                      type="button"
                      onClick={() => scrollToMedia(activeIndex - 1)}
                      disabled={activeIndex === 0}
                      aria-label="Previous media"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] text-[var(--river-deep)] transition hover:border-[var(--river-deep)] disabled:opacity-30"
                    >
                      ‹
                    </button>
                    <div className="flex items-center gap-2" role="tablist" aria-label="Media position">
                      {media.map((item, index) => (
                        <button
                          key={`dot-${item.url}-${index}`}
                          type="button"
                          role="tab"
                          id={`community-media-tab-${index}`}
                          aria-selected={index === activeIndex}
                          aria-controls={`community-media-panel-${index}`}
                          aria-label={`Go to media ${index + 1}`}
                          onClick={() => scrollToMedia(index)}
                          className={`h-2.5 w-2.5 rounded-full border border-[var(--river-deep)]/45 transition-colors ${
                            index === activeIndex
                              ? "bg-[var(--river-deep)]"
                              : "bg-transparent hover:bg-[var(--river-deep)]/25"
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => scrollToMedia(activeIndex + 1)}
                      disabled={activeIndex === media.length - 1}
                      aria-label="Next media"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] text-[var(--river-deep)] transition hover:border-[var(--river-deep)] disabled:opacity-30"
                    >
                      ›
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className={hasMedia ? "mt-6" : ""}>
              <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-[var(--cinnabar)]">
                {hasMedia && hasText
                  ? t("community.post.illustratedNote")
                  : hasMedia
                    ? t("community.post.photoSignal")
                    : t("community.post.textDispatch")}
              </p>
              <h2 id="community-post-title" className="mt-3 font-[family:var(--font-display)] text-3xl leading-[1] text-[var(--river-deep)] sm:text-5xl">
                {post.title}
              </h2>
              {hasText ? (
                <p className="mt-5 max-w-3xl text-[16px] leading-8 text-[var(--river-deep)]/82 handwritten sm:text-[18px]">
                  {post.excerpt}
                </p>
              ) : (
                <p className="mt-4 text-sm italic text-[var(--muted)]">
                  Shared as a photo without text.
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 text-xs font-semibold text-[var(--river-deep)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <aside className="border-t border-[var(--line)] bg-white/45 px-5 py-5 lg:border-l lg:border-t-0">
            <div className="space-y-5">
              <div>
                <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-[var(--cinnabar)]">
                  Filed by
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <Avatar
                    src={post.user.avatar}
                    name={post.user.name}
                    seed={post.user.handle ?? post.user.name}
                    size={48}
                    ringClassName="border border-white/60 ring-2 ring-[var(--paper-deep)]"
                  />
                  <div>
                    <p className="font-[family:var(--font-display)] text-2xl text-[var(--river-deep)]">
                      {post.user.name}
                    </p>
                    {post.user.handle ? (
                      <p className="text-sm text-[var(--muted)]">
                        {post.user.handle}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--paper)] p-4">
                <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-[var(--cinnabar)]">
                  Prompt trail
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--river-deep)]/82">
                  {post.prompt}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleLike}
                  aria-pressed={liked}
                  className={`min-h-11 rounded-[var(--radius-lg)] border px-4 py-3 text-left transition-colors ${
                    liked
                      ? "border-[var(--cinnabar)]/45 bg-[var(--cinnabar)]/10"
                      : "border-[var(--line)] bg-[var(--paper)]/70 hover:border-[var(--cinnabar)]/40"
                  } ${isLoggedIn ? "" : "opacity-70"}`}
                >
                  <span className="flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-[0.18em] text-[var(--muted)]">
                    <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 ${liked ? "fill-[var(--cinnabar)]" : "fill-current"}`} aria-hidden="true">
                      <path d="M10 18s-7-4.35-7-9.5A4.5 4.5 0 0 1 10 5a4.5 4.5 0 0 1 7 3.5C17 13.65 10 18 10 18z" />
                    </svg>
                    Likes
                  </span>
                  <span className={`mt-1 block text-2xl font-[family:var(--font-display)] ${liked ? "text-[var(--cinnabar)]" : "text-[var(--river-deep)]"}`}>
                    {likeCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  aria-pressed={saved}
                  className={`min-h-11 rounded-[var(--radius-lg)] border px-4 py-3 text-left transition-colors ${
                    saved
                      ? "border-[var(--gold)]/45 bg-[var(--gold)]/10"
                      : "border-[var(--line)] bg-[var(--paper)]/70 hover:border-[var(--gold)]/40"
                  } ${isLoggedIn ? "" : "opacity-70"}`}
                >
                  <span className="flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-[0.18em] text-[var(--muted)]">
                    <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 ${saved ? "fill-[var(--gold)]" : "fill-current"}`} aria-hidden="true">
                      <path d="M5 3h10a1 1 0 0 1 1 1v13l-6-4-6 4V4a1 1 0 0 1 1-1z" />
                    </svg>
                    Saved
                  </span>
                  <span className={`mt-1 block text-2xl font-[family:var(--font-display)] ${saved ? "text-[var(--gold)]" : "text-[var(--river-deep)]"}`}>
                    {saveCount}
                  </span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
