"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { CommunityFeedPost } from '@/lib/api-data';
import { communityContextHref, fetchAssociatedCommunityPosts, type CommunityContext } from '@/lib/community-api';
import { PostCard } from './PostCard';
import { PostDetailDialog } from './PostDetailDialog';
import { readStoredUser } from '@/lib/auth-client';

/** One contextual review surface for cities, routes and interpreter profiles. */
export function RelatedCommunityPosts({ citySlug, routeId, interpreterId, title = 'Traveller posts', location }: CommunityContext & { title?: string }) {
  const [posts, setPosts] = useState<CommunityFeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<CommunityFeedPost | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const scope = { citySlug, routeId, interpreterId };
  const composeContext = { ...scope, location };
  const hasAssociation = Boolean(citySlug || routeId || interpreterId);
  const href = communityContextHref(scope);
  const composeHref = communityContextHref(composeContext, true);
  useEffect(() => {
    const sync = () => setLoggedIn(Boolean(readStoredUser()));
    sync(); window.addEventListener('culvoy-auth', sync);
    return () => window.removeEventListener('culvoy-auth', sync);
  }, []);
  useEffect(() => {
    let cancelled = false;
    setPosts([]); setSelected(null); setError(false); setLoading(hasAssociation);
    if (!hasAssociation) return;
    fetchAssociatedCommunityPosts({ citySlug, routeId, interpreterId, limit: 4 }).then((result) => {
      if (!cancelled) setPosts(result.data);
    }).catch(() => { if (!cancelled) setError(true); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [citySlug, routeId, interpreterId, location, hasAssociation, retry]);
  if (!hasAssociation) return null;
  return (
    <section className="border-t border-[var(--line)] py-10 sm:py-14" aria-label={title} aria-busy={loading}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-[family:var(--font-display)] text-3xl sm:text-4xl">{title}</h2>
        <Link className="btn-outline min-h-11 px-5" href={composeHref}>Write post</Link>
      </div>
      {loading ? <p role="status" className="text-[var(--muted)]">Loading posts…</p> : error ? (
        <div role="alert"><p>Posts could not be loaded.</p><button className="btn-outline mt-4 min-h-11 px-5" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>
      ) : posts.length ? (
        <div className="grid gap-5 md:grid-cols-2">{posts.map((post, index) => (
          <PostCard key={post.id} post={post} index={index} href={`${href}&post=${post.id}`} updateUrl={false} variant={post.media.length ? 'image' : 'text'} onOpen={setSelected} isLoggedIn={loggedIn}
            onRequireLogin={() => window.location.assign(`/login?next=${encodeURIComponent(href)}`)} />
        ))}</div>
      ) : <p className="text-base leading-7 text-[var(--muted)]">No posts here yet. Share an observation from this experience.</p>}
      <Link href={href} className="mt-6 inline-flex min-h-11 items-center underline underline-offset-4">View posts</Link>
      <PostDetailDialog post={selected} onClose={() => setSelected(null)} isLoggedIn={loggedIn} onRequireLogin={() => window.location.assign(`/login?next=${encodeURIComponent(href)}`)} />
    </section>
  );
}
