jest.mock('../upload/upload.service', () => ({ UploadService: class {} }));
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CommunityService } from './community.service';
import { CommunityController } from './community.controller';
import { CommunityQueryDto } from './dto/community-query.dto';
import { UpsertCommunityPostDto } from './dto/upsert-community-post.dto';
import { City } from '../cities/entities/city.entity';
import { StoryRoute } from '../routes/entities/story-route.entity';
import { InterpreterProfile } from '../interpreting/entities/interpreter-profile.entity';
import { BookingSubmission } from '../interpreting/entities/booking-submission.entity';
import { AddCommunityAssociations1763200000000 } from '../../database/migrations/1763200000000-AddCommunityAssociations';

const routeId = '4f1e6395-15b8-48b8-811c-22d792660003';
const interpreterId = '4f1e6395-15b8-48b8-811c-22d792660004';
function setup() {
  const qb = Object.fromEntries(['where', 'andWhere', 'orderBy', 'addOrderBy', 'skip', 'take'].map((method) => [method, jest.fn().mockReturnThis()])) as any;
  qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
  const postRepo = { createQueryBuilder: jest.fn(() => qb), create: jest.fn((value) => value), save: jest.fn(async (value) => value), findOne: jest.fn() };
  const cities = { existsBy: jest.fn().mockResolvedValue(true), find: jest.fn().mockResolvedValue([]) };
  const routes = { existsBy: jest.fn().mockResolvedValue(true), find: jest.fn().mockResolvedValue([]) };
  const interpreters = { existsBy: jest.fn().mockResolvedValue(true), find: jest.fn().mockResolvedValue([]) };
  const bookings = { findOne: jest.fn() };
  const dataSource = { getRepository: jest.fn((entity) => entity === City ? cities : entity === StoryRoute ? routes : entity === InterpreterProfile ? interpreters : bookings) };
  const notify = { notifyStaff: jest.fn() };
  const service = new CommunityService(dataSource as never, postRepo as never, {} as never, {} as never, {} as never, notify as never, {} as never);
  return { service, qb, postRepo, cities, routes, interpreters, bookings, notify };
}
const input = { channel: 'Field Notes', user: { name: 'Traveller' }, title: 'Observation', excerpt: 'A walk', citySlug: 'chaozhou', routeId, interpreterId };

describe('Community stable associations and queries', () => {
  it('combines stable city, route, interpreter, search, legacy location and channel before paging', async () => {
    const { service, qb } = setup();
    await service.getPublicPosts({ citySlug: 'chaozhou', routeId, interpreterId, q: 'tea', location: 'West Gate', channel: 'Field Notes', page: 3, limit: 12, sort: 'saved' });
    expect(qb.where).toHaveBeenCalledWith('p.status = :status', { status: 'published' });
    for (const [field, value] of Object.entries({ citySlug: 'chaozhou', routeId, interpreterId })) expect(qb.andWhere).toHaveBeenCalledWith(`p.${field} = :${field}`, { [field]: value });
    expect(qb.andWhere).toHaveBeenCalledWith('p.location = :location', { location: 'West Gate' });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('p.title::text ILIKE :q'), { q: '%tea%' });
    expect(qb.skip).toHaveBeenCalledWith(24); expect(qb.take).toHaveBeenCalledWith(12);
    expect(qb.orderBy).toHaveBeenCalledWith('p.saves', 'DESC');
    expect(qb.addOrderBy).toHaveBeenCalledWith('p.createdAt', 'DESC'); expect(qb.addOrderBy).toHaveBeenCalledWith('p.id', 'DESC');
    expect(qb.andWhere.mock.invocationCallOrder.at(-1)).toBeLessThan(qb.skip.mock.invocationCallOrder[0]);
  });
  it.each([['latest', 'p.createdAt'], ['loved', 'p.likes'], ['saved', 'p.saves']] as const)('sorts %s at server before pagination', async (sort, column) => {
    const { service, qb } = setup(); await service.getPublicPosts({ citySlug: 'chaozhou', sort });
    expect(qb.orderBy).toHaveBeenCalledWith(column, 'DESC'); expect(qb.andWhere).toHaveBeenCalledWith('p.citySlug = :citySlug', { citySlug: 'chaozhou' });
  });
  it('returns empty scoped results unchanged, not global fallback', async () => {
    const { service, postRepo } = setup(); expect(await service.getPublicPosts({ citySlug: 'chaozhou' })).toEqual({ data: [], total: 0, page: 1, pageSize: 20 });
    expect(postRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
  });
  it('strips evidence, author IDs/email and moderation notes from public output', () => {
    const { service } = setup(); const result = service.publicPost({ id: 'post', verifiedExperience: true, verifiedBookingId: 'private', userId: 'private', userEmail: 'private', reviewedBy: 'private', rejectionReason: 'private', routeId } as never);
    expect(result).toEqual({ id: 'post', verifiedExperience: true, routeId, user: { name: '' } });
  });
  it('projects only public user profile fields, including legacy rows with embedded email', () => {
    const { service } = setup();
    expect(service.publicPost({ user: { name: 'Traveller', handle: '@traveller', avatar: '/uploads/photo.jpg', email: 'private@example.com', bookingId: 'private' } } as never).user).toEqual({ name: 'Traveller', handle: '@traveller', avatar: '/uploads/photo.jpg' });
  });
  it.each(['city', 'route', 'interpreter'])('rejects unpublished/nonexistent %s associations before persistence', async (kind) => {
    const { service, postRepo, cities, routes, interpreters } = setup(); const repo = kind === 'city' ? cities : kind === 'route' ? routes : interpreters; repo.existsBy.mockResolvedValue(false);
    await expect(service.create(input)).rejects.toBeInstanceOf(BadRequestException); expect(postRepo.save).not.toHaveBeenCalled();
  });
  it('allowlists published city/route and active interpreter values', async () => {
    const { service, cities, routes, interpreters } = setup(); await service.create(input);
    expect(cities.existsBy).toHaveBeenCalledWith({ slug: 'chaozhou', published: true }); expect(routes.existsBy).toHaveBeenCalledWith({ id: routeId, published: true }); expect(interpreters.existsBy).toHaveBeenCalledWith({ id: interpreterId, status: 'active' });
  });
  it('keeps legacy text without guessing stable associations and always starts unverified', async () => {
    const { service } = setup(); const result = await service.create({ ...input, citySlug: undefined, routeId: undefined, interpreterId: undefined, location: 'Chaozhou', route: 'Tea route', verifiedExperience: true, verifiedBookingId: 'fake' } as any);
    expect(result).toMatchObject({ citySlug: null, routeId: null, interpreterId: null, location: 'Chaozhou', route: 'Tea route', verifiedExperience: false, verifiedBookingId: null });
  });
  it('public controller overrides forged author/status/counters before creating and projects safely', async () => {
    const { service } = setup(); const create = jest.spyOn(service, 'create').mockResolvedValue({ ...input, status: 'pending_review', verifiedExperience: false } as any);
    const controller = new CommunityController(service, {} as never);
    await controller.createPublicPost({ ...input, status: 'published', userId: 'forged', featured: true, likes: 999, saves: 999 } as any, { user: { sub: 'real-user', email: 'real@example.com' } } as any);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'real-user', userEmail: 'real@example.com', status: 'pending_review', featured: false, likes: 0, saves: 0 }));
  });
  it('changing a stable association invalidates its previous evidence without changing text', async () => {
    const { service, postRepo } = setup(); postRepo.findOne.mockResolvedValue({ id: 'post', citySlug: 'chaozhou', routeId, verifiedExperience: true, verifiedBookingId: 'booking', location: 'West Gate' });
    const result = await service.updateAssociations('post', { citySlug: null }); expect(result).toMatchObject({ citySlug: null, routeId, verifiedExperience: false, verifiedBookingId: null, location: 'West Gate' });
  });
  it('generic update cannot write arbitrary verification fields', async () => {
    const { service, postRepo } = setup(); postRepo.findOne.mockResolvedValue({ id: 'post', citySlug: 'chaozhou', routeId, interpreterId, verifiedExperience: false, verifiedBookingId: null });
    const result = await service.update('post', { ...input, verifiedExperience: true, verifiedBookingId: 'fake' } as any); expect(result.verifiedExperience).toBe(false); expect(result.verifiedBookingId).toBeNull();
  });
  it('rejects invalid UUID/sort/slug/array filters and converts valid pagination', async () => {
    expect(await validate(plainToInstance(CommunityQueryDto, { routeId: 'bad', interpreterId: 'bad', citySlug: '../bad', sort: 'sql', page: '0', channel: ['a', 'b'] }))).not.toHaveLength(0);
    const dto = plainToInstance(CommunityQueryDto, { citySlug: 'chaozhou', routeId, page: '2', limit: '12', sort: 'latest' }); expect(await validate(dto)).toHaveLength(0); expect(dto.page).toBe(2);
    expect(await validate(plainToInstance(UpsertCommunityPostDto, { ...input, routeId: 'bad' }))).not.toHaveLength(0);
  });
  it('refuses destructive migration rollback', async () => {
    const runner = { query: jest.fn() };
    await expect(new AddCommunityAssociations1763200000000().down(runner as never)).rejects.toThrow('would discard data');
    expect(runner.query).not.toHaveBeenCalled();
  });
  it('migration is additive and contains no guessed backfill', async () => {
    const runner = { query: jest.fn() }; await new AddCommunityAssociations1763200000000().up(runner as never);
    const sql = runner.query.mock.calls.map(([value]) => value).join('\n'); expect(sql).toContain('city_slug'); expect(sql).toContain('FOREIGN KEY (route_id)'); expect(sql).not.toMatch(/\b(DROP|DELETE|TRUNCATE|UPDATE)\s+(TABLE|community_posts)/i);
  });
});

describe('Community service evidence', () => {
  const post = { id: 'post', userId: 'author', citySlug: 'chaozhou', routeId, interpreterId, verifiedExperience: false };
  const booking = { id: 'booking', userId: 'author', processStatus: 'completed', status: 'completed', citySlug: 'chaozhou', routeId, assignedInterpreterId: interpreterId };
  it('marks only completed author-owned matching service and keeps private ID private', async () => {
    const { service, postRepo, bookings } = setup(); postRepo.findOne.mockResolvedValue({ ...post }); bookings.findOne.mockResolvedValue({ ...booking });
    const result = await service.verifyExperience('post', 'booking'); expect(result.verifiedExperience).toBe(true); expect(result.verifiedBookingId).toBe('booking'); expect(service.publicPost(result)).not.toHaveProperty('verifiedBookingId');
  });
  it.each([{ userId: 'other' }, { userId: null }, { processStatus: 'cancelled', status: 'completed' }, { citySlug: 'guangzhou' }, { routeId: null }, { assignedInterpreterId: null }])('rejects mismatched/incomplete evidence %j', async (patch) => {
    const { service, postRepo, bookings } = setup(); postRepo.findOne.mockResolvedValue({ ...post }); bookings.findOne.mockResolvedValue({ ...booking, ...patch });
    await expect(service.verifyExperience('post', 'booking')).rejects.toBeInstanceOf(BadRequestException); expect(postRepo.save).not.toHaveBeenCalled();
  });
  it('rejects an unlinked legacy author or association-free post', async () => {
    const { service, postRepo, bookings } = setup(); bookings.findOne.mockResolvedValue(booking);
    for (const patch of [{ userId: null }, { citySlug: null, routeId: null, interpreterId: null }]) { postRepo.findOne.mockResolvedValue({ ...post, ...patch }); await expect(service.verifyExperience('post', 'booking')).rejects.toBeInstanceOf(BadRequestException); }
  });
  it('allows staff to remove verification without revealing or fetching private service', async () => {
    const { service, postRepo, bookings } = setup(); postRepo.findOne.mockResolvedValue({ ...post, verifiedExperience: true, verifiedBookingId: 'booking' }); const result = await service.verifyExperience('post', null); expect(result.verifiedExperience).toBe(false); expect(result.verifiedBookingId).toBeNull(); expect(bookings.findOne).not.toHaveBeenCalled();
  });
});
