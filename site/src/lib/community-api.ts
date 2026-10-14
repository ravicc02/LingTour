import { apiGet, apiPost } from './api-client';
import type { CommunityFeedPost, CommunityPostMedia, CreateCommunityFeedInput } from './api-data';

export type CommunityContext = { citySlug?: string; routeId?: string; interpreterId?: string; location?: string; route?: string };
export type CommunityFilters = CommunityContext & { channel?: string; q?: string; sort?: 'latest' | 'loved' | 'saved'; page?: number; limit?: number };
export type CommunityPage = { data: CommunityFeedPost[]; total: number; page: number; pageSize: number };
export type CommunityAssociationOptions = {
  cities: { slug: string; name: string }[];
  routes: { id: string; slug: string; title: string }[];
  interpreters: { id: string; name: string }[];
};

const text = (value: unknown): string => typeof value === 'string' ? value : value && typeof value === 'object' ? text((value as Record<string, unknown>).en) : '';

export function mapAssociatedPost(raw: Record<string, unknown>): CommunityFeedPost {
  const user = (raw.user ?? {}) as Record<string, unknown>;
  const image = text(raw.image);
  const media = (Array.isArray(raw.media) ? raw.media : []).filter((item): item is CommunityPostMedia => Boolean(item?.url) && (item.type === 'image' || item.type === 'live'));
  const createdAt = text(raw.createdAt);
  const date = new Date(createdAt);
  return {
    id: text(raw.id), title: text(raw.title), excerpt: text(raw.excerpt), channel: text(raw.channel),
    user: { name: text(user.name) || 'Traveller', handle: text(user.handle), avatar: text(user.avatar) },
    image, media: media.length ? media : image ? [{ type: 'image', url: image }] : [],
    location: text(raw.location), route: text(raw.route),
    citySlug: text(raw.citySlug) || null, routeId: text(raw.routeId) || null, interpreterId: text(raw.interpreterId) || null,
    verifiedExperience: raw.verifiedExperience === true,
    createdAt, date: Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    readTime: '1 min', mood: text(raw.mood), tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    likes: Number(raw.likes) || 0, saves: Number(raw.saves) || 0, liked: raw.liked === true, saved: raw.saved === true,
    prompt: '', status: text(raw.status),
  };
}

export async function fetchAssociatedCommunityPosts(filters: CommunityFilters = {}): Promise<CommunityPage> {
  const result = await apiGet<{ data: Record<string, unknown>[]; total: number; page: number; pageSize: number }>('/public/community/posts', {
    ...filters, channel: filters.channel === 'All' ? undefined : filters.channel, q: filters.q?.trim() || undefined,
    page: filters.page ?? 1, limit: filters.limit ?? 12, sort: filters.sort ?? 'latest',
  });
  return { ...result, data: (result.data ?? []).map(mapAssociatedPost) };
}

export async function fetchScopedRoutePosts(routeId?: string) {
  if (!routeId) return [];
  return (await fetchAssociatedCommunityPosts({ routeId, limit: 12 })).data;
}

export async function fetchAssociatedCommunityPost(id: string) {
  return mapAssociatedPost(await apiGet<Record<string, unknown>>(`/public/community/posts/${encodeURIComponent(id)}`));
}

export const fetchCommunityAssociations = () => apiGet<CommunityAssociationOptions>('/public/community/associations');

export async function createAssociatedCommunityPost(input: CreateCommunityFeedInput & CommunityContext) {
  const title = input.title.trim() || input.note.trim().split(/[\n.!?]/)[0]?.trim() || 'Travel photo';
  const result = await apiPost<Record<string, unknown>>('/public/community/posts', {
    channel: input.channel, user: input.user, title, excerpt: input.note.trim() || title,
    citySlug: input.citySlug, routeId: input.routeId, interpreterId: input.interpreterId,
    location: input.location, route: input.route, mood: input.mood,
    tags: [input.channel, input.location, input.route].filter(Boolean),
    ...(input.image ? { image: input.image } : {}), ...(input.media?.length ? { media: input.media } : {}),
  });
  return mapAssociatedPost(result);
}

export function communityContextFromParams(params: Pick<URLSearchParams, 'get'>): CommunityContext {
  const context: CommunityContext = {};
  for (const field of ['citySlug', 'routeId', 'interpreterId', 'location', 'route'] as const) {
    const value = params.get(field);
    if (value) context[field] = value;
  }
  return context;
}

export function matchesCommunityContext(post: CommunityFeedPost, context: CommunityContext) {
  return (['citySlug', 'routeId', 'interpreterId', 'location', 'route'] as const).every((field) => !context[field] || post[field] === context[field]);
}

export function communityContextHref(context: CommunityContext, compose = false) {
  const params = new URLSearchParams();
  Object.entries(context).forEach(([field, value]) => { if (value) params.set(field, value); });
  if (compose) params.set('compose', '1');
  return `/community${params.size ? `?${params}` : ''}`;
}
