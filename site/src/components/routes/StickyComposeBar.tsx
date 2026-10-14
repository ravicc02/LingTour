"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FieldKit } from "@/components/community/FieldKit";
import { readStoredUser, type LocalUser } from "@/lib/auth-client";
import { AUTH_PROMPTS } from "@/lib/auth-prompts";
import {
  createCommunityPost,
  type CommunityFeedPost,
  type CommunityPostMedia,
  type RouteCommunityPost,
} from "@/lib/api-data";
import {
  appendSyncedCommunityPost,
  mergeCommunityPosts,
  readSyncedCommunityPosts,
  subscribeSyncedCommunityPosts,
} from "@/lib/community-sync";

type RouteStopTarget = { index: number; time: string; name: string };

type Props = {
  routeSlug: string;
  routeTitle: string;
  routeCity: string;
  initialPosts: RouteCommunityPost[];
  composeTarget?: RouteStopTarget | null;
  onClearTarget?: () => void;
};

const routeChannels = ["All", "Field Notes", "Food Map", "Hidden Stop", "Culture Desk"] as const;

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "just now";
  const diffSec = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function StickyComposeBar({
  routeSlug,
  routeTitle,
  routeCity,
  initialPosts,
  composeTarget,
  onClearTarget,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<LocalUser | null>(null);
  const [syncedPosts, setSyncedPosts] = useState<CommunityFeedPost[]>([]);
  const isLoggedIn = Boolean(user);
  const loginPath = `/login?next=${encodeURIComponent(`/routes/${routeSlug}`)}`;

  useEffect(() => {
    const sync = () => setUser(readStoredUser());
    sync();
    window.addEventListener("culvoy-auth", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("culvoy-auth", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const routeTargets = [routeSlug, routeTitle]
      .filter(Boolean)
      .map((value) => value.toLowerCase().trim());

    const selectRoutePosts = (posts: CommunityFeedPost[]) =>
      posts.filter((post) =>
        routeTargets.includes(post.route.toLowerCase().trim()),
      );

    setSyncedPosts(selectRoutePosts(readSyncedCommunityPosts()));
    return subscribeSyncedCommunityPosts((posts) =>
      setSyncedPosts(selectRoutePosts(posts)),
    );
  }, [routeSlug, routeTitle]);

  useEffect(() => {
    if (composeTarget && isLoggedIn) {
      setOpen(true);
      setError(null);
    } else if (composeTarget && !isLoggedIn) {
      setOpen(false);
      router.push(loginPath);
    }
  }, [composeTarget, isLoggedIn, loginPath, router]);

  const postingContext = composeTarget
    ? `${routeTitle} · Stop ${composeTarget.index + 1} · ${composeTarget.name}`
    : routeTitle;

  const handlePublish = async (draft: {
    title: string;
    note: string;
    channel: string;
    media?: CommunityPostMedia[];
  }) => {
    const title = draft.title.trim();
    const note = draft.note.trim();
    const body = [title, note].filter(Boolean).join("\n");
    if (submitting) return;
    if (!isLoggedIn || !user) {
      const message = AUTH_PROMPTS.connectGoogleToRoutePublish;
      setError(message);
      throw new Error(message);
    }
    if (!body) {
      const message = "Add a title or note before posting on this route.";
      setError(message);
      throw new Error(message);
    }

    setSubmitting(true);
    setError(null);

    try {
      const created = await createCommunityPost({
        body,
        routeSlug,
        routeTitle,
        routeCity,
        stop: composeTarget,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          handle: user.email?.split("@")[0],
          avatar: user.avatarUrl,
        },
      });

      appendSyncedCommunityPost({
        ...created,
        date: new Date(created.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        readTime: "1 min",
        likes: 0,
        saves: 0,
        prompt: composeTarget
          ? `Track: Stop ${composeTarget.index + 1} · ${composeTarget.name}`
          : `Filed from ${routeCity}.`,
      });
      setOpen(false);
      onClearTarget?.();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to publish your note. Please try again.";
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const posts = useMemo(() => {
    const routePosts = syncedPosts.map(
      ({ date: _date, readTime: _readTime, likes: _likes, saves: _saves, prompt: _prompt, ...post }) => {
        void _date;
        void _readTime;
        void _likes;
        void _saves;
        void _prompt;
        return post;
      },
    );
    return mergeCommunityPosts<RouteCommunityPost>([...routePosts, ...initialPosts]);
  }, [initialPosts, syncedPosts]);

  const latestPost = posts[0];

  return (
    <>
      <div aria-hidden className="h-16 bg-[var(--background)] bg-grain" />

      <FieldKit
        isOpen={open}
        onClose={() => {
          if (!submitting) {
            setOpen(false);
            setError(null);
            onClearTarget?.();
          }
        }}
        isLoggedIn={isLoggedIn}
        onRequireLogin={() =>
          setError(AUTH_PROMPTS.connectGoogleToRoutePublish)
        }
        onPublish={handlePublish}
        initialBrief={{
          title: routeTitle,
          channel: "Field Notes",
          prompt: `Posting on: ${postingContext}. Add a field note others can use on this route.`,
        }}
        channels={routeChannels}
        compact
      />

      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--line)] bg-[var(--background)] pb-[env(safe-area-inset-bottom)] shadow-panel"
        role="region"
        aria-label="Leave a field note on this route"
      >
        <button
          type="button"
          onClick={() => {
            if (!isLoggedIn) {
              router.push(loginPath);
              return;
            }
            setOpen(true);
          }}
          className="site-container flex w-full items-center justify-between gap-4 py-3.5 text-left transition hover:bg-[var(--paper-deep)]/40"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--cinnabar)]" />
            <span className="font-mono text-[12px] font-bold uppercase tracking-[0.32em] text-[var(--cinnabar)]">
              Field Drop
            </span>
            <span className="hidden truncate text-[13px] italic text-[var(--muted)] sm:inline">
              {composeTarget
                ? `Add note for Stop ${composeTarget.index + 1}: ${composeTarget.name}`
                : latestPost
                  ? `${latestPost.user.name} · ${formatRelativeTime(latestPost.createdAt)}`
                  : "Add a field note to this route"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]/80">
              {posts.length} {posts.length === 1 ? "note" : "notes"}
            </span>
            <span className="inline-flex items-center gap-2 bg-[var(--cinnabar)] px-3.5 py-1.5 font-mono text-[12px] font-bold uppercase tracking-[0.26em] text-white">
              {isLoggedIn ? "Leave Note" : "Log in to note"}
              <span aria-hidden>↗</span>
            </span>
          </div>
        </button>

        {error ? (
          <div className="border-t border-[var(--line)] bg-[var(--paper-deep)]/95">
            <div className="site-container py-2">
              <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-[var(--cinnabar)]">
                {error}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
