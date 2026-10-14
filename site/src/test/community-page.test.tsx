import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
const state = vi.hoisted(() => ({ params: 'citySlug=chaozhou&routeId=route-1&interpreterId=interpreter-1', push: vi.fn(), user: null as unknown, feed: vi.fn(), associations: vi.fn(), create: vi.fn(), briefs: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }), useSearchParams: () => new URLSearchParams(state.params) }));
vi.mock('@/lib/auth-client', () => ({ readStoredUser: () => state.user }));
vi.mock('@/lib/community-api', async (importOriginal) => ({ ...await importOriginal<typeof import('@/lib/community-api')>(), fetchAssociatedCommunityPosts: state.feed, fetchCommunityAssociations: state.associations, createAssociatedCommunityPost: state.create }));
vi.mock('@/lib/api-data', () => ({ fetchCommunityBriefs: state.briefs, fetchCommunityReactionSummary: vi.fn().mockResolvedValue({ likedPostIds: [], savedPostIds: [] }) }));
vi.mock('@/components/community/CommunityJournalMotion', () => ({ CommunityJournalMotion: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/community/PostCard', () => ({ PostCard: ({ post }: { post: { title: string } }) => <article>{post.title}</article> }));
vi.mock('@/components/community/PostDetailDialog', () => ({ PostDetailDialog: () => null }));
vi.mock('@/components/community/BriefCard', () => ({ BriefCard: () => <p>Other city brief</p> }));
vi.mock('@/components/community/FieldKit', () => ({ FieldKit: ({ isOpen, children, onPublish }: { isOpen: boolean; children: ReactNode; onPublish: (draft: unknown) => void }) => isOpen ? <div role="dialog">{children}<button onClick={() => onPublish({ title: 'Tea', note: 'Observation', channel: 'Field Notes' })}>Submit test note</button></div> : null }));
import CommunityPage from '@/app/community/page';
beforeEach(() => {
  vi.clearAllMocks(); state.params = 'citySlug=chaozhou&routeId=route-1&interpreterId=interpreter-1'; state.user = null;
  state.feed.mockResolvedValue({ data: [], total: 30, page: 1, pageSize: 12 }); state.associations.mockResolvedValue({ cities: [{ slug: 'chaozhou', name: 'Chaozhou' }], routes: [{ id: 'route-1', title: 'Tea route' }], interpreters: [{ id: 'interpreter-1', name: 'Interpreter' }] }); state.briefs.mockResolvedValue([{ id: 'brief' }]); state.create.mockResolvedValue({ status: 'pending_review' });
});
const queryFromPush = () => new URL(state.push.mock.calls.at(-1)![0], 'http://localhost').searchParams;
describe('community URL filtering and composer', () => {
  it('loads scoped server data without any global briefs', async () => { render(<CommunityPage />); await screen.findByText('No posts here yet'); expect(state.feed).toHaveBeenCalledWith(expect.objectContaining({ citySlug: 'chaozhou', routeId: 'route-1', interpreterId: 'interpreter-1', page: 1 })); expect(state.briefs).not.toHaveBeenCalled(); expect(screen.queryByText('Other city brief')).not.toBeInTheDocument(); });
  it('search, sort and pagination links preserve all three stable IDs', async () => {
    render(<CommunityPage />); await screen.findByText('No posts here yet');
    fireEvent.change(screen.getByLabelText('Search posts'), { target: { value: 'tea' } }); fireEvent.click(screen.getByRole('button', { name: 'Search' })); expect(queryFromPush().get('q')).toBe('tea');
    fireEvent.change(screen.getByLabelText('Sort posts'), { target: { value: 'loved' } }); expect(queryFromPush().get('sort')).toBe('loved');
    fireEvent.click(screen.getByRole('button', { name: 'Next' })); const params = queryFromPush(); expect(params.get('page')).toBe('2'); expect(params.get('citySlug')).toBe('chaozhou'); expect(params.get('routeId')).toBe('route-1'); expect(params.get('interpreterId')).toBe('interpreter-1');
  });
  it('accessible plus sends anonymous traveller to login with compose and scope', async () => {
    render(<CommunityPage />); fireEvent.click(screen.getByRole('button', { name: 'Create a post' })); const next = queryFromPush().get('next')!; const params = new URL(next, 'http://localhost').searchParams; expect(params.get('compose')).toBe('1'); expect(params.get('citySlug')).toBe('chaozhou'); expect(params.get('routeId')).toBe('route-1'); expect(params.get('interpreterId')).toBe('interpreter-1');
  });
  it('login return opens composer and submits association IDs with no fake verification', async () => {
    state.user = { id: 'author', name: 'Traveller' }; state.params += '&compose=1'; render(<CommunityPage />); await screen.findByRole('dialog'); fireEvent.click(screen.getByRole('button', { name: 'Submit test note' })); await waitFor(() => expect(state.create).toHaveBeenCalledWith(expect.objectContaining({ citySlug: 'chaozhou', routeId: 'route-1', interpreterId: 'interpreter-1' }))); expect(state.create.mock.calls[0][0]).not.toHaveProperty('verifiedExperience'); await screen.findByText(/submitted for review/); expect(screen.queryByText('Tea', { selector: 'article' })).not.toBeInTheDocument();
  });
});
