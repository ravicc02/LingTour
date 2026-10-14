"use client";

import { useEffect, useMemo, useState } from "react";
import type { CommunityFeedPost } from "@/lib/api-data";
import {
  toggleCommunityPostLike,
  toggleCommunityPostSave,
} from "@/lib/api-data";
import { Avatar } from "@/components/ui/Avatar";

type PostCardProps = {
  post: CommunityFeedPost;
  index: number;
  variant?: "image" | "feature" | "text";
  onOpen?: (post: CommunityFeedPost) => void;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
  onEngagementChange?: (post: CommunityFeedPost) => void;
};

export function PostCard({
  post,
  variant = "image",
  onOpen,
  isLoggedIn = false,
  onRequireLogin,
  onEngagementChange,
}: PostCardProps) {
  const [liked, setLiked] = useState(Boolean(post.liked));
  const [saved, setSaved] = useState(Boolean(post.saved));
  const [likeCount, setLikeCount] = useState(post.likes);
  const [saveCount, setSaveCount] = useState(post.saves);
  const cover = post.media[0] ?? (post.image ? { type: "image" as const, url: post.image } : null);
  const hasImage = Boolean(cover);
  const hasText = Boolean(post.excerpt.trim());
  const isPendingReview = post.status === "pending_review";

  useEffect(() => {
    setLiked(Boolean(post.liked));
    setSaved(Boolean(post.saved));
    setLikeCount(post.likes);
    setSaveCount(post.saves);
  }, [post.id, post.liked, post.likes, post.saved, post.saves]);

  const variantClasses = useMemo(() => {
    if (variant === "text") {
      return "border border-[var(--line)] bg-[var(--paper)]/95 rotate-[-0.8deg]";
    }
    if (variant === "feature") {
      return "overflow-hidden border border-[var(--line)] bg-[var(--paper)]";
    }
    return "journal-paper";
  }, [variant]);

  const publishEngagement = (changes: Partial<CommunityFeedPost>) => {
    onEngagementChange?.({
      ...post,
      liked,
      saved,
      likes: likeCount,
      saves: saveCount,
      ...changes,
    });
  };

  const handleLike = async () => {
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
      setLiked(liked);
      setLikeCount(likeCount);
      publishEngagement({ liked, likes: likeCount });
      console.error("Failed to toggle community post like", error);
    }
  };

  const handleSave = async () => {
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
      setSaved(saved);
      setSaveCount(saveCount);
      publishEngagement({ saved, saves: saveCount });
      console.error("Failed to toggle community post save", error);
    }
  };

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-md)] scrapbook-shadow transition-[transform,box-shadow] duration-500 hover:-translate-y-0.5 ${variantClasses}`}
    >
      <a
        href={`/community?post=${post.id}`}
        data-community-post-link={post.id}
        onClick={(event) => {
          event.preventDefault();
          onOpen?.(post);
          // Keep the URL shareable without a navigation round-trip; a cold
          // load of this URL resolves the id into the open dialog.
          if (typeof window !== "undefined") {
            window.history.replaceState({}, "", `/community?post=${post.id}`);
          }
        }}
        className="flex min-h-0 w-full flex-1 flex-col text-left"
      >
        {hasImage && cover ? (
          <div
            className={`relative shrink-0 overflow-hidden ${
              variant === "feature"
                ? "aspect-[1.12] border-b border-[var(--line)]"
                : "aspect-[1.1]"
            }`}
          >
            {cover.type === "live" ? (
              <video
                src={cover.url}
                poster={cover.poster || undefined}
                muted
                loop
                playsInline
                preload="metadata"
                className={`absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105 ${
                  variant === "image" ? "grayscale-[0.12]" : "grayscale-[0.04]"
                }`}
              />
            ) : (
              <img
                src={cover.url}
                alt={post.title}
                loading="lazy"
                decoding="async"
                className={`absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105 ${
                  variant === "image" ? "grayscale-[0.12]" : "grayscale-[0.04]"
                }`}
              />
            )}
            <div
              className={`absolute inset-0 ${
                variant === "feature"
                  ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(17,25,35,0.18))]"
                  : "bg-gradient-to-t from-black/36 to-transparent"
              }`}
            />
            <span
              className={`absolute right-3 top-3 px-3 py-1 text-[12px] font-bold uppercase tracking-[0.18em] ${
                variant === "feature"
                  ? "rounded-full border border-[var(--line)] bg-[var(--paper)]/88 text-[var(--cinnabar)] backdrop-blur-md"
                  : "handwritten rotate-[2deg] bg-[var(--paper)]/85 text-[var(--river-deep)] shadow-sm backdrop-blur-sm"
              }`}
            >
              {post.channel}
            </span>
            {variant === "feature" ? (
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="font-[family:var(--font-display)] text-3xl leading-[0.95] text-white [text-shadow:0_2px_16px_rgba(17,25,35,0.45)]">
                  {post.title}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="relative overflow-hidden px-6 pb-2 pt-8 sm:px-7">
            <div className="max-w-[13rem]">
              <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-[var(--cinnabar)]">{post.channel}</p>
            </div>
          </div>
        )}

        <div className={`flex flex-1 flex-col ${variant === "feature" ? "p-5" : variant === "text" ? "p-6 sm:p-7" : "p-5"}`}>
          <div className="flex items-center gap-2">
            <Avatar
              src={post.user.avatar}
              name={post.user.name}
              seed={post.user.handle ?? post.user.name}
              size={32}
              ringClassName={
                variant === "feature"
                  ? "border border-[var(--paper)]/70 ring-2 ring-white/50"
                  : "border border-white/40 ring-2 ring-[var(--paper-deep)]"
              }
            />
            <span className={`text-sm ${variant === "image" ? "handwritten" : "font-medium"} text-[var(--river-deep)]`}>
              {post.user.name}
            </span>
            {isPendingReview ? (
              <span
                className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--gold)]/45 bg-[var(--gold)]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--river-deep)]"
                title="Visible only to you while an editor reviews it"
              >
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-current" aria-hidden="true">
                  <path d="M6 1a5 5 0 100 10A5 5 0 006 1zm.5 2v3.2l2.1 1.25-.5.85L5.5 6.7V3h1z" />
                </svg>
                Pending review
              </span>
            ) : null}
          </div>

          {variant !== "feature" ? (
            <h2
              className={`mt-4 font-[family:var(--font-display)] leading-tight ${
                variant === "text"
                  ? "text-3xl text-[var(--river-deep)]"
                  : "text-2xl text-[var(--river-deep)] underline decoration-[var(--gold)]/30 decoration-2 underline-offset-4"
              }`}
            >
              {post.title}
            </h2>
          ) : null}

          {hasText ? (
            <p
              className={`mt-4 ${
                variant === "feature"
                  ? "text-sm leading-7 text-[var(--river-deep)]/76"
                  : variant === "text"
                    ? "handwritten text-base leading-8 text-[var(--river-deep)]/80"
                    : "line-clamp-3 text-sm italic leading-relaxed text-[var(--muted)]"
              }`}
            >
              {post.excerpt}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {post.route ? (
              <span className="rounded-full bg-[var(--paper-deep)] px-2.5 py-1 text-[12px] text-[var(--cinnabar)]">#{post.route}</span>
            ) : null}
            {post.location ? (
              <span className="rounded-full bg-[var(--paper-deep)] px-2.5 py-1 text-[12px] text-[var(--cinnabar)]">@{post.location}</span>
            ) : null}
          </div>
        </div>
      </a>

      <div className={`flex items-center justify-between border-t border-[var(--line)] py-2 text-[var(--river-deep)] ${variant === "text" ? "px-4 sm:px-5" : "px-5"}`}>
        <button
          type="button"
          onClick={handleLike}
          aria-pressed={liked}
          className={`min-h-11 px-2 text-xs transition-colors active:scale-[0.97] ${
            liked ? "text-[var(--cinnabar)]" : "text-[var(--muted)] hover:text-[var(--cinnabar)]"
          } ${isLoggedIn ? "" : "opacity-60"}`}
        >
          Like {likeCount}
        </button>
        <button
          type="button"
          onClick={handleSave}
          aria-pressed={saved}
          className={`min-h-11 px-2 text-xs transition-colors active:scale-[0.97] ${
            saved ? "text-[var(--gold)]" : "text-[var(--muted)] hover:text-[var(--gold)]"
          } ${isLoggedIn ? "" : "opacity-60"}`}
        >
          Save {saveCount}
        </button>
      </div>
    </article>
  );
}
