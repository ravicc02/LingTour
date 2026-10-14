import { serverGet } from './server-api';
import { mapAssociatedPost } from './community-api';
import type { RouteCommunityPost } from './api-data';

/** No legacy title guessing or global fallback, including when a route has no ID. */
export async function fetchScopedRoutePosts(routeId?: string): Promise<RouteCommunityPost[]> {
  if (!routeId) return [];
  try {
    const result = await serverGet<{ data: Record<string, unknown>[] }>('/public/community/posts', { routeId, limit: 12, sort: 'latest' });
    return (result.data ?? []).map(mapAssociatedPost);
  } catch {
    return [];
  }
}
