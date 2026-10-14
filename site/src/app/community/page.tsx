"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchCommunityBriefs, fetchCommunityReactionSummary, type CommunityFeedPost, type CommunityPostMedia } from '@/lib/api-data';
import { communityContextFromParams, createAssociatedCommunityPost, fetchAssociatedCommunityPost, fetchAssociatedCommunityPosts, fetchCommunityAssociations, type CommunityAssociationOptions, type CommunityContext } from '@/lib/community-api';
import { readStoredUser, type LocalUser } from '@/lib/auth-client';
import { PostCard } from '@/components/community/PostCard';
import { PostDetailDialog } from '@/components/community/PostDetailDialog';
import { BriefCard } from '@/components/community/BriefCard';
import { FieldKit } from '@/components/community/FieldKit';
import { CommunityJournalMotion } from '@/components/community/CommunityJournalMotion';
import { useApiQuery } from '@/lib/use-api-query';

const channels = ['All', 'Field Notes', 'Food Map', 'Hidden Stop', 'Culture Desk'] as const;
type PostChannel = Exclude<(typeof channels)[number], 'All'>;
const sorts = [{ value: 'latest', label: 'Latest' }, { value: 'loved', label: 'Loved' }, { value: 'saved', label: 'Saved' }] as const;

function CommunityFeed() {
  const router = useRouter();
  const params = useSearchParams();
  const paramsKey = params.toString();
  const context = useMemo(() => communityContextFromParams(new URLSearchParams(paramsKey)), [paramsKey]);
  const channel = params.get('channel') || 'All';
  const q = params.get('q') || '';
  const sort = params.get('sort') === 'loved' ? 'loved' : params.get('sort') === 'saved' ? 'saved' : 'latest';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const scoped = Boolean(Object.keys(context).length);
  const [search, setSearch] = useState(q);
  const [user, setUser] = useState<LocalUser | null>(null);
  const [selected, setSelected] = useState<CommunityFeedPost | null>(null);
  const [kitOpen, setKitOpen] = useState(false);
  const [draftContext, setDraftContext] = useState<CommunityContext>(context);
  const [options, setOptions] = useState<CommunityAssociationOptions | null>(null);
  const [optionsError, setOptionsError] = useState(false);
  const [toast, setToast] = useState('');
  const [reactions, setReactions] = useState<Record<string, Partial<CommunityFeedPost>>>({});
  const { data: feed, loading, error, refetch } = useApiQuery(
    async () => ({ ...await fetchAssociatedCommunityPosts({ ...context, channel, q, sort, page, limit: 12 }), requestKey: paramsKey }),
    [paramsKey], { keepPreviousData: false },
  );
  // Briefs have only legacy location text. They cannot safely be assigned to any context.
  const { data: briefs } = useApiQuery(() => scoped ? Promise.resolve([]) : fetchCommunityBriefs(), [scoped]);
  const posts = (feed?.requestKey === paramsKey ? feed.data : []).map((post) => ({ ...post, ...reactions[post.id] }));
  const updateParams = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(paramsKey);
    Object.entries(patch).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    router.push(`/community?${next}`, { scroll: false });
  }, [paramsKey, router]);
  const login = useCallback((compose = false) => {
    const next = new URLSearchParams(paramsKey);
    if (compose) next.set('compose', '1');
    router.push(`/login?next=${encodeURIComponent(`/community?${next}`)}`);
  }, [paramsKey, router]);
  const closeKit = useCallback(() => {
    setKitOpen(false);
    if (params.get('compose') === '1') updateParams({ compose: null });
  }, [params, updateParams]);
  const openKit = () => {
    if (!user) { login(true); return; }
    setDraftContext(context); setKitOpen(true);
  };
  useEffect(() => { setSearch(q); }, [q]);
  useEffect(() => {
    const sync = () => setUser(readStoredUser());
    sync(); window.addEventListener('culvoy-auth', sync); window.addEventListener('storage', sync);
    return () => { window.removeEventListener('culvoy-auth', sync); window.removeEventListener('storage', sync); };
  }, []);
  useEffect(() => {
    if (params.get('compose') !== '1') return;
    if (!readStoredUser()) { login(true); return; }
    setDraftContext(context); setKitOpen(true);
  }, [params, context, login]);
  useEffect(() => {
    let cancelled = false;
    fetchCommunityAssociations().then((data) => { if (!cancelled) setOptions(data); }).catch(() => { if (!cancelled) setOptionsError(true); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const id = params.get('post');
    let cancelled = false;
    if (id) fetchAssociatedCommunityPost(id).then((post) => { if (!cancelled) setSelected(post); }).catch(() => { if (!cancelled) setToast('This post is unavailable.'); });
    return () => { cancelled = true; };
  }, [params]);
  useEffect(() => {
    let cancelled = false;
    if (!user) { setReactions({}); return; }
    fetchCommunityReactionSummary().then((summary) => {
      if (cancelled) return;
      const liked = new Set(summary.likedPostIds), saved = new Set(summary.savedPostIds);
      setReactions(Object.fromEntries((feed?.data ?? []).map((post) => [post.id, { liked: liked.has(post.id), saved: saved.has(post.id) }])));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [user, feed]);
  const publish = async (draft: { title: string; note: string; channel: PostChannel; media?: CommunityPostMedia[] }) => {
    if (!user) { login(true); throw new Error('Log in to post.'); }
    await createAssociatedCommunityPost({ ...draft, ...draftContext, location: draftContext.location || '', route: draftContext.route || '', mood: '', user: { name: user.name, avatar: user.avatarUrl } });
    closeKit(); setToast('Your post was submitted for review. It will appear after approval.'); refetch();
  };
  const updateEngagement = (post: CommunityFeedPost) => {
    setReactions((current) => ({ ...current, [post.id]: { liked: post.liked, likes: post.likes, saved: post.saved, saves: post.saves } }));
    setSelected((current) => current?.id === post.id ? post : current);
  };
  return (
    <CommunityJournalMotion motionKey={`${paramsKey}:${feed?.data.map((post) => post.id).join('|')}`}>
      <div className="min-h-screen overflow-clip bg-[var(--paper-deep)] text-[var(--river-deep)]">
        <section data-community-hero className="border-b border-[var(--line)] py-land">
          <div className="site-container relative">
            <div className="flex justify-end"><button type="button" aria-label="Create a post" onClick={openKit} className="inline-flex h-12 w-12 items-center justify-center border border-[var(--river-deep)] bg-[var(--river-deep)] text-3xl text-white">+</button></div>
            <h1 data-community-title className="text-center font-[family:var(--font-display)] text-6xl leading-[1.1] sm:text-8xl">Posts</h1>
            <p className="mx-auto mt-5 max-w-xl text-center text-base leading-7 text-[var(--muted)]">Observations and experiences shared by travellers.</p>
            {scoped ? <p className="mt-4 break-words text-center text-base">{context.citySlug ? `City: ${options?.cities.find((city) => city.slug === context.citySlug)?.name || context.citySlug}` : context.routeId ? `Route: ${options?.routes.find((route) => route.id === context.routeId)?.title || 'Selected route'}` : context.interpreterId ? `Interpreter: ${options?.interpreters.find((interpreter) => interpreter.id === context.interpreterId)?.name || 'Selected interpreter'}` : context.location || context.route}</p> : null}
          </div>
        </section>
        <section data-community-toolbar className="sticky top-[var(--site-header-height)] z-30 border-b border-[var(--line)] bg-[var(--paper-deep)]/95 py-3 backdrop-blur-xl">
          <div className="site-container grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div role="group" aria-label="Post channels" className="flex gap-2 overflow-x-auto pb-1">
              {channels.map((item) => <button key={item} type="button" aria-pressed={channel === item} onClick={() => updateParams({ channel: item === 'All' ? null : item, page: null })} className={`min-h-11 shrink-0 border px-4 text-xs font-bold ${channel === item ? 'border-[var(--river-deep)] bg-[var(--river-deep)] text-white' : 'border-[var(--line)]'}`}>{item}</button>)}
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              <form className="flex min-w-0 flex-1" onSubmit={(event) => { event.preventDefault(); updateParams({ q: search.trim() || null, page: null }); }}>
                <label className="sr-only" htmlFor="community-search">Search posts</label><input id="community-search" value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-11 min-w-0 w-full border border-[var(--line)] bg-transparent px-3 text-base" placeholder="Search posts" /><button type="submit" className="min-h-11 border border-[var(--line)] px-3">Search</button>
              </form>
              <label className="sr-only" htmlFor="community-sort">Sort posts</label><select id="community-sort" value={sort} onChange={(event) => updateParams({ sort: event.target.value, page: null })} className="min-h-11 border border-[var(--line)] bg-transparent px-3 text-base">{sorts.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            </div>
          </div>
        </section>
        <section className="site-container py-beat" aria-busy={loading}>
          {loading ? <p role="status" className="py-10 text-center">Loading posts…</p> : error ? <div role="alert" className="py-10 text-center"><p>Posts could not be loaded.</p><p className="mt-2 text-[var(--muted)]">{error}</p><button onClick={refetch} className="btn-outline mt-5 min-h-11 px-6">Retry</button></div> : posts.length ? <>
            <p role="status" className="mb-6 text-sm text-[var(--muted)]">{feed?.total} posts</p>
            <div className="grid gap-6 lg:grid-cols-2">{posts.map((post, index) => <div key={post.id} data-community-card className="min-w-0"><PostCard post={post} index={index} variant={post.media.length ? 'image' : 'text'} onOpen={setSelected} isLoggedIn={Boolean(user)} onRequireLogin={() => login()} onEngagementChange={updateEngagement} /></div>)}</div>
          </> : <div className="py-12 text-center"><h2 className="font-[family:var(--font-display)] text-3xl">No posts here yet</h2><p className="mt-3 text-base text-[var(--muted)]">{q ? 'No posts match this search in the selected context.' : 'Share your observation. New posts are reviewed before publication.'}</p><button onClick={openKit} className="btn-outline mt-6 min-h-11 px-6">Write post</button></div>}
          {!loading && !error && feed && (feed.total > feed.pageSize || page > 1) ? <nav aria-label="Posts pagination" className="mt-8 flex items-center justify-center gap-4"><button disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })} className="btn-outline min-h-11 px-4 disabled:opacity-40">Previous</button><span>Page {page}</span><button disabled={page * feed.pageSize >= feed.total} onClick={() => updateParams({ page: String(page + 1) })} className="btn-outline min-h-11 px-4 disabled:opacity-40">Next</button></nav> : null}
          {!scoped && briefs?.length ? <div className="mt-12"><h2 className="mb-5 font-[family:var(--font-display)] text-3xl">Editor briefs</h2><div className="grid gap-6 lg:grid-cols-2">{briefs.map((brief, index) => <BriefCard key={brief.id} brief={brief} index={index} onSelect={() => { setDraftContext({ location: brief.location, route: brief.route }); if (!user) { const next = new URLSearchParams(paramsKey); next.set('location', brief.location); next.set('route', brief.route); next.set('compose', '1'); router.push(`/login?next=${encodeURIComponent(`/community?${next}`)}`); } else setKitOpen(true); }} />)}</div></div> : null}
        </section>
        <FieldKit isOpen={kitOpen} onClose={closeKit} isLoggedIn={Boolean(user)} onRequireLogin={() => login(true)} onPublish={publish} channels={channels}>
          <div className="grid gap-4">
            <p className="text-sm text-[var(--muted)]">Choose related content if applicable. A link is not a verified-experience claim.</p>
            {optionsError ? <p role="alert">Association choices are unavailable. Existing context is preserved; retry loading the page to choose another.</p> : null}
            <label className="grid gap-2 text-base">City<select value={draftContext.citySlug || ''} onChange={(event) => setDraftContext((current) => ({ ...current, citySlug: event.target.value || undefined }))} className="min-h-11 w-full border border-[var(--line)] bg-transparent px-3 text-base"><option value="">No city</option>{draftContext.citySlug && !options?.cities.some((item) => item.slug === draftContext.citySlug) ? <option value={draftContext.citySlug}>{draftContext.citySlug}</option> : null}{options?.cities.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>
            <label className="grid gap-2 text-base">Route<select value={draftContext.routeId || ''} onChange={(event) => setDraftContext((current) => ({ ...current, routeId: event.target.value || undefined }))} className="min-h-11 w-full border border-[var(--line)] bg-transparent px-3 text-base"><option value="">No route</option>{draftContext.routeId && !options?.routes.some((item) => item.id === draftContext.routeId) ? <option value={draftContext.routeId}>Selected route</option> : null}{options?.routes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            <label className="grid gap-2 text-base">Interpreter<select value={draftContext.interpreterId || ''} onChange={(event) => setDraftContext((current) => ({ ...current, interpreterId: event.target.value || undefined }))} className="min-h-11 w-full border border-[var(--line)] bg-transparent px-3 text-base"><option value="">No interpreter</option>{draftContext.interpreterId && !options?.interpreters.some((item) => item.id === draftContext.interpreterId) ? <option value={draftContext.interpreterId}>Selected interpreter</option> : null}{options?.interpreters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="grid gap-2 text-base">Location details<input maxLength={200} value={draftContext.location || ''} onChange={(event) => setDraftContext((current) => ({ ...current, location: event.target.value }))} className="min-h-11 w-full border border-[var(--line)] bg-transparent px-3 text-base" /></label>
          </div>
        </FieldKit>
        <PostDetailDialog post={selected} onClose={() => { setSelected(null); if (params.has('post')) updateParams({ post: null }); }} isLoggedIn={Boolean(user)} onRequireLogin={() => login()} onEngagementChange={updateEngagement} />
        {toast ? <div role="status" className="fixed bottom-5 left-4 right-4 z-[70] flex items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-[var(--night)] px-5 py-3 text-white sm:left-1/2 sm:right-auto sm:max-w-xl sm:-translate-x-1/2"><span>{toast}</span><button onClick={() => setToast('')} className="min-h-11 shrink-0 px-2">Close</button></div> : null}
      </div>
    </CommunityJournalMotion>
  );
}

export default function CommunityPage() {
  return <Suspense fallback={<p role="status" className="site-container py-land">Loading posts…</p>}><CommunityFeed /></Suspense>;
}
