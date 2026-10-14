import { describe, it, expect, vi, beforeEach } from 'vitest';
import { communityContextFromParams, communityContextHref, fetchAssociatedCommunityPosts, fetchScopedRoutePosts, mapAssociatedPost, matchesCommunityContext, createAssociatedCommunityPost } from '@/lib/community-api';
import { apiGet, apiPost } from '@/lib/api-client';
vi.mock('@/lib/api-client', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }));
const context = { citySlug: 'chaozhou', routeId: 'route-id', interpreterId: 'interpreter-id' };
const post = { id: 'post', title: 'Tea', excerpt: 'A walk', channel: 'Field Notes', user: { name: 'Traveller' }, ...context, createdAt: '2026-10-08', location: 'West Gate', route: 'tea-route' };
beforeEach(() => vi.clearAllMocks());
describe('community associated queries', () => {
  it('sends scope on search, sorting and later pages to server', async () => {
    vi.mocked(apiGet).mockResolvedValue({ data: [post], total: 21, page: 2, pageSize: 12 });
    const result = await fetchAssociatedCommunityPosts({ ...context, q: ' tea ', sort: 'loved', page: 2, channel: 'All' });
    expect(apiGet).toHaveBeenCalledWith('/public/community/posts', { ...context, q: 'tea', sort: 'loved', page: 2, limit: 12, channel: undefined });
    expect(result.total).toBe(21); expect(result.data[0]).toMatchObject(context);
  });
  it('does not fallback to global when a scoped feed is empty', async () => {
    vi.mocked(apiGet).mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 12 }); expect((await fetchAssociatedCommunityPosts(context)).data).toEqual([]); expect(apiGet).toHaveBeenCalledTimes(1);
  });
  it('never fetches global route posts when route UUID is missing', async () => { expect(await fetchScopedRoutePosts()).toEqual([]); expect(apiGet).not.toHaveBeenCalled(); });
  it('preserves stable IDs and legacy location through composer login link', () => {
    const href = communityContextHref({ ...context, location: 'West Gate' }, true);
    const params = new URLSearchParams(href.split('?')[1]); expect(communityContextFromParams(params)).toEqual({ ...context, location: 'West Gate' }); expect(params.get('compose')).toBe('1');
  });
  it('does not guess a stable association from text and applies every stable filter', () => {
    const legacy = mapAssociatedPost({ ...post, citySlug: null, routeId: null, interpreterId: null }); expect(matchesCommunityContext(legacy, context)).toBe(false); expect(legacy.citySlug).toBeNull(); expect(legacy.location).toBe('West Gate');
    expect(matchesCommunityContext(mapAssociatedPost(post), context)).toBe(true); expect(matchesCommunityContext(mapAssociatedPost({ ...post, routeId: 'other' }), context)).toBe(false);
  });
  it('preserves image-only records and drops unsupported media variants', () => { const value = mapAssociatedPost({ ...post, image: '/uploads/photo.jpg', media: [{ type: 'video', url: 'bad' }] }); expect(value.media).toEqual([{ type: 'image', url: '/uploads/photo.jpg' }]); });
  it('sends associations without verification or empty media and preserves body', async () => {
    vi.mocked(apiPost).mockResolvedValue({ ...post, status: 'pending_review' });
    await createAssociatedCommunityPost({ ...context, title: ' Tea ', note: 'Real note', channel: 'Field Notes', user: { name: 'Traveller' }, location: 'West Gate', route: 'tea-route', mood: '' });
    const body = vi.mocked(apiPost).mock.calls[0][1]; expect(body).toMatchObject({ ...context, title: 'Tea', excerpt: 'Real note' }); expect(body).not.toHaveProperty('verifiedExperience'); expect(body).not.toHaveProperty('media');
  });
});
