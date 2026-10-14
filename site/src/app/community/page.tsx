"use client";

import { useEffect, useMemo, useState } from "react";
import { AUTH_PROMPTS } from "@/lib/auth-prompts";
import {
  createCommunityFeedPost,
  fetchCommunityFeed,
  fetchCommunityReactionSummary,
  fetchCommunityBriefs,
  type CommunityFeedPost,
  type CommunityPostMedia,
  type FieldBrief,
} from "@/lib/api-data";
import {
  mergeCommunityPosts,
  readSyncedCommunityPosts,
  subscribeSyncedCommunityPosts,
  writeSyncedCommunityPosts,
} from "@/lib/community-sync";
import { useApiQuery } from "@/lib/use-api-query";
import { PostCard } from "@/components/community/PostCard";
import { PostDetailDialog } from "@/components/community/PostDetailDialog";
import { BriefCard } from "@/components/community/BriefCard";
import { DispatchCard } from "@/components/community/DispatchCard";
import { CommunityJournalMotion } from "@/components/community/CommunityJournalMotion";
import { Reveal } from "@/components/ui/Reveal";
import { FieldKit } from "@/components/community/FieldKit";
import { useLocale } from "@/lib/locale-context";
import { LocalUser, readStoredUser, signInWithGoogle } from "@/lib/auth-client";
import { getGoogleIdentityApi, requestGoogleCredential } from "@/lib/google-identity";

const channels = [
  "All",
  "Field Notes",
  "Food Map",
  "Hidden Stop",
  "Culture Desk",
] as const;
type Channel = (typeof channels)[number];
type PostChannel = Exclude<Channel, "All">;
type SortMode = "Live" | "Loved" | "Saved";

const CHANNEL_I18N: Record<Channel, string> = {
  All: "community.channel.all",
  "Field Notes": "community.channel.fieldNotes",
  "Food Map": "community.channel.foodMap",
  "Hidden Stop": "community.channel.hiddenStop",
  "Culture Desk": "community.channel.cultureDesk",
};

type Draft = {
  title: string;
  note: string;
  location: string;
  route: string;
  mood: string;
  channel: PostChannel;
  media?: CommunityPostMedia[];
};

const LOCAL_STAMPS_KEY = "culvoy-community-stamps";

/** Feed items rendered per page. */
const PAGE_SIZE = 12;

/**
 * Coerce a backend brief.channel (free-form string) to our typed `PostChannel`.
 * Falls back to "Field Notes" when the value isn't one of the known channels,
 * so a stale or misspelled brief doesn't break the page.
 */
function coerceChannel(channel: string): PostChannel {
  const allowed: readonly PostChannel[] = [
    "Field Notes",
    "Food Map",
    "Hidden Stop",
    "Culture Desk",
  ];
  return (allowed as readonly string[]).includes(channel)
    ? (channel as PostChannel)
    : "Field Notes";
}

function readLoginState() {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.localStorage.getItem("culvoy-user") ||
    window.localStorage.getItem("culvoy-token"),
  );
}

function readUser(): LocalUser | null {
  return readStoredUser();
}

function sortPosts(posts: CommunityFeedPost[], sortMode: SortMode) {
  return [...posts].sort((a, b) => {
    if (sortMode === "Loved") return b.likes - a.likes;
    if (sortMode === "Saved") return b.saves - a.saves;
    return 0;
  });
}

/**
 * A neutral default draft used when no brief is selected (e.g. the API hasn't
 * returned briefs yet, or the editorial team hasn't published any).
 */
const NEUTRAL_DRAFT: Draft = {
  title: "",
  note: "",
  location: "",
  route: "",
  mood: "",
  channel: "Field Notes",
};

const draftFromBrief = (brief: FieldBrief | null): Draft => ({
  title: "",
  note: "",
  location: brief?.location ?? "",
  route: brief?.route ?? "",
  mood: brief?.mood ?? "",
  channel: brief ? coerceChannel(brief.channel) : "Field Notes",
});

export default function CommunityPage() {
  const { t } = useLocale();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<LocalUser | null>(null);
  const [optimisticPosts, setOptimisticPosts] = useState<CommunityFeedPost[]>(
    [],
  );
  const [engagementOverrides, setEngagementOverrides] = useState<
    Record<string, Partial<Pick<CommunityFeedPost, "liked" | "likes" | "saved" | "saves">>>
  >({});
  const [activeChannel, setActiveChannel] = useState<Channel>("All");
  const [sortMode, setSortMode] = useState<SortMode>("Live");
  const [query, setQuery] = useState("");
  const [selectedBrief, setSelectedBrief] = useState<FieldBrief | null>(null);
  const [draft, setDraft] = useState<Draft>(() => NEUTRAL_DRAFT);
  const [toast, setToast] = useState<string | null>(null);
  const [stampCount, setStampCount] = useState(0);
  const [isKitOpen, setIsKitOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<CommunityFeedPost | null>(
    null,
  );
  // A deep link (/community?post=<id>) arrives before the feed does, so the id
  // is remembered here and resolved once the post is available.
  const [pendingPostId, setPendingPostId] = useState<string | null>(null);

  const {
    data: remotePosts,
    loading,
    error,
    refetch,
  } = useApiQuery(() => fetchCommunityFeed({ limit: 50 }), []);

  // Editorial briefs: independent fetch, won't block the main feed render.
  const { data: briefs } = useApiQuery(
    () => fetchCommunityBriefs(),
    [],
  );
  const fieldBriefs = useMemo(() => briefs ?? [], [briefs]);

  // When briefs arrive (and nothing has been selected yet), default to the first.
  useEffect(() => {
    if (!selectedBrief && fieldBriefs.length > 0) {
      const first = fieldBriefs[0];
      setSelectedBrief(first);
      setDraft((prev) => ({
        ...prev,
        location: first.location,
        route: first.route,
        mood: first.mood,
        channel: coerceChannel(first.channel),
      }));
    }
  }, [fieldBriefs, selectedBrief]);

  const syncAuth = () => {
    setIsLoggedIn(readLoginState());
    setUser(readUser());
  };

  useEffect(() => {
    syncAuth();
    setOptimisticPosts(readSyncedCommunityPosts());
    const storedStamps = Number(
      window.localStorage.getItem(LOCAL_STAMPS_KEY) || "0",
    );
    setStampCount(Number.isFinite(storedStamps) ? storedStamps : 0);
    window.addEventListener("culvoy-auth", syncAuth);
    const unsubscribe = subscribeSyncedCommunityPosts(setOptimisticPosts);
    return () => {
      window.removeEventListener("culvoy-auth", syncAuth);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search);
    const route = searchParams.get("route");
    const location = searchParams.get("location");
    const note = searchParams.get("note");
    const title = searchParams.get("title");
    const channel = searchParams.get("channel") as PostChannel | null;
    const compose = searchParams.get("compose");
    const postId = searchParams.get("post");

    if (postId) {
      setPendingPostId(postId);
    }

    if (!route && !location && !note && !title && !channel && compose !== "1")
      return;

    setDraft((current) => ({
      ...current,
      route: route || current.route,
      location: location || current.location,
      title: title || current.title,
      note: note || current.note,
      channel:
        channel && channels.includes(channel as Channel)
          ? channel
          : current.channel,
    }));

    if (channel && channels.includes(channel as Channel)) {
      setActiveChannel(channel);
    }

    if (compose === "1") {
      if (!readLoginState()) {
        setToast(AUTH_PROMPTS.connectGoogleToPublish);
        return;
      }
      setIsKitOpen(true);
    }
  }, []);

  const basePosts = useMemo(() => {
    return mergeCommunityPosts([...optimisticPosts, ...(remotePosts ?? [])]);
  }, [optimisticPosts, remotePosts]);

  const allPosts = useMemo(() => {
    return basePosts.map((post) => ({
      ...post,
      ...engagementOverrides[post.id],
    }));
  }, [basePosts, engagementOverrides]);

  // Resolve a deep-linked post once the feed (or the local optimistic posts)
// actually carries it.
  useEffect(() => {
    if (!pendingPostId) return;
    const target = allPosts.find((post) => post.id === pendingPostId);
    if (target) {
      setSelectedPost(target);
      setPendingPostId(null);
    }
  }, [pendingPostId, allPosts]);

  useEffect(() => {
    if (!isLoggedIn) {
      setEngagementOverrides({});
      return;
    }

    let cancelled = false;
    fetchCommunityReactionSummary()
      .then((summary) => {
        if (cancelled) return;
        const liked = new Set(summary.likedPostIds);
        const saved = new Set(summary.savedPostIds);
        setEngagementOverrides((current) => {
          const next = { ...current };
          basePosts.forEach((post) => {
            next[post.id] = {
              ...next[post.id],
              liked: liked.has(post.id),
              saved: saved.has(post.id),
            };
          });
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) setEngagementOverrides({});
      });

    return () => {
      cancelled = true;
    };
  }, [basePosts, isLoggedIn]);

  const updatePostEngagement = (updatedPost: CommunityFeedPost) => {
    setEngagementOverrides((current) => ({
      ...current,
      [updatedPost.id]: {
        liked: updatedPost.liked,
        likes: updatedPost.likes,
        saved: updatedPost.saved,
        saves: updatedPost.saves,
      },
    }));
    setSelectedPost((current) =>
      current?.id === updatedPost.id ? { ...current, ...updatedPost } : current,
    );
  };

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const byChannel =
      activeChannel === "All"
        ? allPosts
        : allPosts.filter((post) => post.channel === activeChannel);

    const bySearch = normalizedQuery
      ? byChannel.filter((post) =>
          [
            post.title,
            post.excerpt,
            post.location,
            post.route,
            post.channel,
            post.mood,
            ...post.tags,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        )
      : byChannel;

    return sortPosts(bySearch, sortMode);
  }, [activeChannel, allPosts, query, sortMode]);

  // Combine posts, briefs, and dispatch card into a single masonry array
  const masonryItems = useMemo(() => {
    type MasonryItem =
      | { type: "post"; data: CommunityFeedPost }
      | { type: "brief"; data: FieldBrief }
      | { type: "dispatch"; id: string };

    const items: MasonryItem[] = [];
    const posts = [...filteredPosts];
    const briefs = [...fieldBriefs];

    // Always insert dispatch CTA near the top
    items.push({ type: "dispatch", id: "dispatch-cta" });

    // Mix posts and briefs
    let postIndex = 0;
    let briefIndex = 0;

    // Pattern: 2 posts, 1 brief, 3 posts, 1 brief, etc.
    while (postIndex < posts.length || briefIndex < briefs.length) {
      if (postIndex < posts.length) {
        items.push({ type: "post", data: posts[postIndex++] });
      }
      if (postIndex < posts.length) {
        items.push({ type: "post", data: posts[postIndex++] });
      }
      if (briefIndex < briefs.length) {
        items.push({ type: "brief", data: briefs[briefIndex++] });
      }
      if (postIndex < posts.length) {
        items.push({ type: "post", data: posts[postIndex++] });
      }
    }

    return items;
  }, [filteredPosts, fieldBriefs]);

  // The feed pulls 50 posts at once and mixes briefs in, which on a phone is
  // a single column running past 28,000px. Render a window of it and let the
  // reader ask for more.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleItems = masonryItems.slice(0, visibleCount);
  const hasMore = masonryItems.length > visibleCount;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeChannel, sortMode, query]);

  const selectBrief = (brief: FieldBrief) => {
    setSelectedBrief(brief);
    const channel = coerceChannel(brief.channel);
    setDraft((current) => ({
      ...current,
      location: brief.location,
      route: brief.route,
      mood: brief.mood,
      channel,
    }));
    setActiveChannel(channel);
  };

  /**
   * Two even columns at `lg`. Earlier the feed mixed 7/5, full-width and
   * 4/4/4 rows, so neighbouring cards were wildly different sizes and short
   * cards left a gap beside tall ones. A single six-of-twelve span keeps every
   * card the same width; the cards themselves stretch to the row height.
   * DOM order still matches visual order for keyboard users.
   */
  const feedSpanClass = (): string => "lg:col-span-6";

  const resolveVariant = (
    post: CommunityFeedPost,
    index: number,
  ): "image" | "feature" | "text" => {
    const hasImage = Boolean(post.media.length) || Boolean(post.image);
    if (!hasImage) return "text";
    // Position decides the hierarchy, not excerpt length: the lead card of
    // each rhythm is the feature, the rest stay uniform so the rail reads
    // calm. An editor's ordering is the hierarchy signal.
    return index % 6 === 0 ? "feature" : "image";
  };

  const handleGoogleLogin = async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setToast(t("community.error.googleNotConfigured"));
      return;
    }
    if (!getGoogleIdentityApi()) {
      setToast(t("community.error.googleScriptNotLoaded"));
      return;
    }
    try {
      const credential = await requestGoogleCredential(clientId);
      await signInWithGoogle(credential);
      syncAuth();
      setToast(AUTH_PROMPTS.googleConnectedPublish);
    } catch {
      setToast(t("community.error.googleSignInFailed"));
    }
  };

  const openFieldKit = () => {
    if (!isLoggedIn) {
      setToast(AUTH_PROMPTS.connectGoogleToPublish);
      return;
    }
    setIsKitOpen(true);
  };

  const handleKitPublish = async (kitDraft: {
    title: string;
    note: string;
    channel: PostChannel;
    media?: CommunityPostMedia[];
  }) => {
    const title = kitDraft.title.trim();
    const note = kitDraft.note.trim();

    setDraft((prev) => ({
      ...prev,
      title: kitDraft.title,
      note: kitDraft.note,
      channel: kitDraft.channel,
      media: kitDraft.media,
    }));

    // The kit is a modal with its own inline error region, so throwing is
    // enough: also setting a page toast would announce the same failure twice,
    // the second time behind the modal.
    if (!isLoggedIn) {
      throw new Error(AUTH_PROMPTS.connectGoogleToPublish);
    }

    if (!title && !note && !kitDraft.media?.length) {
      throw new Error(t("community.error.addContent"));
    }

    try {
      const created = await createCommunityFeedPost(
        {
          title,
          note,
          channel: kitDraft.channel,
          media: kitDraft.media,
          location: draft.location || selectedBrief?.location || "",
          route: draft.route || selectedBrief?.route || "",
          mood: draft.mood || selectedBrief?.mood || "",
          user: {
            id: user?.id,
            email: user?.email,
            name: user?.name || "Culvoy Guest",
            handle: user?.email ? `@${user.email.split("@")[0]}` : "@you",
            avatar: user?.avatarUrl || "",
          },
        },
      );

      const nextPosts = [created, ...optimisticPosts];
      const nextStamps = stampCount + 1;
      setOptimisticPosts(nextPosts);
      setStampCount(nextStamps);
      writeSyncedCommunityPosts(nextPosts);
      window.localStorage.setItem(LOCAL_STAMPS_KEY, String(nextStamps));
      setDraft(draftFromBrief(selectedBrief));
      setActiveChannel("All");
      setSortMode("Live");
      setIsKitOpen(false);
      setToast(
        created.status === "pending_review"
          ? t("community.success.pendingReview")
          : t("community.success.published"),
      );
      refetch();
    } catch (publishError) {
      const message =
        publishError instanceof Error
          ? publishError.message
          : t("community.error.submitFailed");
      throw publishError instanceof Error ? publishError : new Error(message);
    }
  };

  return (
    <CommunityJournalMotion
      motionKey={`${activeChannel}:${sortMode}:${query}:${masonryItems
        .map((item) => (item.type === "dispatch" ? item.id : item.data.id))
        .join("|")}`}
    >
    <div className="min-h-screen overflow-clip bg-[var(--paper-deep)] bg-grain text-[var(--river-deep)]">
      <section data-community-hero className="relative overflow-hidden border-b border-[var(--line)] py-land">
        <div className="site-container">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="font-[family:var(--font-display)] text-[clamp(3.25rem,15vw,5rem)] leading-[0.86] tracking-tight md:text-8xl lg:text-[8rem]">
              <span className="block overflow-hidden pb-1"><span data-community-title className="block">{t("community.hero.title")}</span></span>
              <span className="block overflow-hidden pb-3"><span data-community-title className="block italic text-[var(--gold)]">{t("community.hero.titleAccent")}</span></span>
            </h1>
            <p className="mx-auto mt-8 max-w-xl handwritten text-base leading-7 text-[var(--river-deep)]/85 sm:text-lg">
              What travellers noticed on the ground, and what the editors are chasing next.
            </p>
            <p aria-live="polite" className="mt-6 font-mono text-[12px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
              {allPosts.length} traveller notes · {fieldBriefs.length} editor briefs
            </p>
          </div>
        </div>
      </section>

      <section data-community-toolbar className="sticky top-[var(--site-header-height)] z-30 border-b border-[var(--line)] bg-[var(--paper-deep)]/92 bg-grain py-3 backdrop-blur-xl sm:py-4">
        <div className="site-container grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div
            role="group"
            aria-label={t("community.toolbar.channels")}
            className="scroll-fade-x scrollbar-hide flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0"
          >
            {channels.map((channel) => (
              <button
                key={channel}
                type="button"
                onClick={() => setActiveChannel(channel)}
                aria-pressed={activeChannel === channel}
                className={`min-h-11 shrink-0 border px-4 py-2 text-[12px] font-bold uppercase tracking-[0.14em] transition-colors sm:px-5 sm:text-[11px] ${
                  activeChannel === channel
                    ? "border-[var(--river-deep)] bg-[var(--river-deep)] text-white"
                    : "border-[var(--line)] bg-transparent text-[var(--river-deep)] hover:border-[var(--river-deep)]"
                }`}
              >
                {t(CHANNEL_I18N[channel])}
              </button>
            ))}
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:flex lg:items-center">
            <label className="relative min-w-0 lg:w-52">
              <span className="sr-only">{t("community.search.placeholder")}</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("community.search.placeholder")}
                className="h-[54px] w-full border-b border-[var(--line)] bg-transparent pl-9 pr-4 text-sm outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--river-deep)]"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </label>
            <div
              role="group"
              aria-label={t("community.toolbar.sort")}
              className="scrollbar-hide flex min-w-0 overflow-x-auto border border-[var(--line)] p-1"
            >
              {(["Live", "Loved", "Saved"] as SortMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSortMode(mode)}
                  aria-pressed={sortMode === mode}
                  className={`min-h-11 shrink-0 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition ${
                    sortMode === mode
                      ? "bg-[var(--river-deep)] text-white"
                      : "text-[var(--muted)] hover:text-[var(--cinnabar)]"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="site-container py-beat">
        {loading && !masonryItems.length ? (
          <div className="py-20 text-center">
            <p className="handwritten text-lg text-[var(--muted)]">
              {t("community.loading")}
            </p>
          </div>
        ) : error && !masonryItems.length ? (
          <div className="py-20 text-center">
            <p className="font-[family:var(--font-display)] text-4xl text-[var(--river-deep)]">
              {t("community.error.feedOffline")}
            </p>
            <p className="mt-4 text-sm text-[var(--muted)]">{error}</p>
            <button
              type="button"
              onClick={refetch}
              className="mt-6 border border-[var(--line)] px-6 py-3 text-xs font-bold uppercase tracking-widest text-[var(--river-deep)] transition hover:bg-[var(--river-deep)] hover:text-white"
            >
              {t("common.btn.retry")}
            </button>
          </div>
        ) : (
          <div className="grid gap-6 pb-6 sm:gap-8 lg:grid-cols-12">
            {visibleItems.length ? (
              visibleItems.map((item, index) => {
                const span = feedSpanClass();
                if (item.type === "dispatch") {
                  return (
                    <div key={item.id} data-community-card className={`min-w-0 ${span}`}>
                      <Reveal delay={index * 40} className="h-full">
                        <DispatchCard
                          stampCount={stampCount}
                          onDispatch={openFieldKit}
                          isLoggedIn={isLoggedIn}
                          onLogin={handleGoogleLogin}
                        />
                      </Reveal>
                    </div>
                  );
                }

                if (item.type === "brief") {
                  return (
                    <div key={item.data.id} data-community-card className={`min-w-0 ${span}`}>
                      <Reveal delay={index * 40} className="h-full">
                        <BriefCard
                          brief={item.data}
                          index={index}
                          onSelect={(brief) => {
                            selectBrief(brief);
                            openFieldKit();
                          }}
                        />
                      </Reveal>
                    </div>
                  );
                }

                if (item.type === "post") {
                  return (
                    <div key={item.data.id} data-community-card className={`min-w-0 ${span}`}>
                      <Reveal delay={index * 40} className="h-full">
                        <PostCard
                          post={item.data}
                          index={index}
                          variant={resolveVariant(item.data, index)}
                          onOpen={setSelectedPost}
                          isLoggedIn={isLoggedIn}
                          onRequireLogin={() => setToast(AUTH_PROMPTS.connectGoogleToInteract)}
                          onEngagementChange={updatePostEngagement}
                        />
                      </Reveal>
                    </div>
                  );
                }

                return null;
              })
            ) : (
              <div className="py-20 text-center lg:col-span-12">
                <p className="font-[family:var(--font-display)] text-4xl text-[var(--river-deep)]">
                  {t("community.empty")}
                </p>
                <p className="mx-auto mt-4 max-w-md text-base leading-7 text-[var(--muted)]">
                  {t("community.empty.body")}
                </p>
                <button
                  type="button"
                  onClick={openFieldKit}
                  className="btn-outline mt-8 px-8"
                >
                  {t("community.empty.cta")}
                </button>
              </div>
            )}
          </div>
        )}

        {hasMore ? (
          <div className="flex flex-col items-center gap-3 pb-20 pt-4">
            <p className="font-mono text-[12px] font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
              {visibleItems.length} / {masonryItems.length}
            </p>
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              className="btn-outline px-8"
            >
              Load more notes
            </button>
          </div>
        ) : (
          <div className="pb-20" />
        )}
      </section>

      <FieldKit
        isOpen={isKitOpen}
        onClose={() => setIsKitOpen(false)}
        isLoggedIn={isLoggedIn}
        onRequireLogin={() =>
          setToast(AUTH_PROMPTS.connectGoogleToPublish)
        }
        onPublish={handleKitPublish}
        initialBrief={
          selectedBrief
            ? {
                title: selectedBrief.title,
                prompt: selectedBrief.prompt,
                channel: coerceChannel(selectedBrief.channel),
              }
            : undefined
        }
        initialDraft={{
          title: draft.title,
          note: draft.note,
          channel: draft.channel,
          media: draft.media,
        }}
        channels={channels}
      />

      <PostDetailDialog
        post={selectedPost}
        onClose={() => {
          setSelectedPost(null);
          // Drop the ?post= deep-link parameter when the reader closes the
          // note, so back/refresh lands on the feed rather than reopening it.
          if (typeof window !== "undefined") {
            window.history.replaceState({}, "", "/community");
          }
        }}
        isLoggedIn={isLoggedIn}
        onRequireLogin={() => setToast(AUTH_PROMPTS.connectGoogleToInteract)}
        onEngagementChange={updatePostEngagement}
        currentUser={
          user
            ? {
                name: user.name,
                handle: user.email ? `@${user.email.split("@")[0]}` : undefined,
                avatar: user.avatarUrl,
              }
            : null
        }
      />

      {/* Toast is anchored to both edges on phones. With only `left-1/2` set,
          the shrink-to-fit rule caps its width at 50vw regardless of the
          message, so a one-line prompt wrapped to four lines at 320px. */}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-4 right-4 z-[70] flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--night)] px-5 py-3 text-sm text-white shadow-panel sm:left-1/2 sm:right-auto sm:w-auto sm:-translate-x-1/2 sm:justify-start sm:rounded-full"
        >
          <span>{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="-my-3 inline-flex min-h-11 shrink-0 items-center px-1 text-white/55 hover:text-white"
          >
            {t("community.toast.close")}
          </button>
        </div>
      ) : null}
    </div>
    </CommunityJournalMotion>
  );
}
