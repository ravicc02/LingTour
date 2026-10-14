import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventEntity } from './entities/event.entity';
import { EventPublicationEntity, EventPublicationActionEntity } from './entities/event-publication.entity';
import { shanghaiToday, snapshotEvent, validateEventContent } from './event-calendar.rules';

const draft = (): EventEntity => Object.assign(new EventEntity(), {
  id: 'event', slug: 'event', title: 'Original', summary: '', description: '', city: '', citySlug: '',
  date: '2026-10-08', endDate: '2026-10-31', media: [], image: null, slogan: '', extraInfo: '',
  displayOrder: 0, tags: [], relatedRouteSlugs: [], status: 'upcoming',
});

function fixture() {
  const event = draft();
  const previous: EventPublicationEntity[] = [];
  const actions: unknown[] = [];
  const publications = { find: jest.fn(async () => [...previous].sort((a, b) => b.version - a.version)),
    findOne: jest.fn(async ({ where }) => previous.find(p => p.id === where.id && p.eventId === where.eventId)),
    create: jest.fn(value => value), save: jest.fn(async value => {
      if (!value.id) { value.id = `publication-${value.version}`; previous.push(value); }
      return value;
    }), count: jest.fn(async () => previous.length) };
  const repo = { findOne: jest.fn(async () => event), create: jest.fn(value => value), save: jest.fn(async value => value), remove: jest.fn() };
  const actionRepo = { create: jest.fn(value => value), save: jest.fn(async value => actions.push(value)) };
  const manager = { query: jest.fn(async (_sql: string, _params?: unknown[]): Promise<any[]> => []), getRepository: jest.fn(entity => entity === EventEntity ? repo : entity === EventPublicationEntity ? publications : actionRepo) };
  const dataSource = { query: jest.fn(async () => [{ data: [], total: 0 }]), transaction: jest.fn(async callback => callback(manager)), getRepository: manager.getRepository };
  return { event, previous, actions, repo, manager, dataSource, service: new EventsService(repo as never, dataSource as never) };
}

beforeEach(() => { jest.useFakeTimers().setSystemTime(new Date('2026-10-08T04:00:00Z')); });
afterEach(() => jest.useRealTimers());

describe('Events publication rules', () => {
  it('snapshots a deep copy and preserves legacy image while edits remain separate', async () => {
    const f = fixture(); f.event.image = '/uploads/old.jpg';
    f.manager.query.mockImplementation(async (sql: string) => sql.startsWith('SELECT url') ? [{ url: '/uploads/old.jpg' }] : []);
    const publication = await f.service.publish('event', { startDate: '2026-10-08', endDate: '2026-10-31' }, { sub: 'editor', role: 'editor' });
    f.event.title = 'Changed draft';
    f.event.tags.push('new');
    expect(publication.snapshot.title).toBe('Original');
    expect(publication.snapshot.tags).toEqual([]);
    expect(publication.snapshot.image).toBe('/uploads/old.jpg');
    expect(f.actions).toEqual([expect.objectContaining({ action: 'publish', actorId: 'editor' })]);
  });
  it('publishes new versions and retains earlier dates instead of overwriting snapshots', async () => {
    const f = fixture();
    const first = await f.service.publish('event', { startDate: '2026-10-08', endDate: '2026-10-31' }, { sub: 'staff', role: 'editor' });
    f.event.title = 'New version';
    const second = await f.service.publish('event', { startDate: '2026-10-10', endDate: '2026-10-31' }, { sub: 'staff', role: 'editor' });
    expect(first.stopFrom).toBe('2026-10-10');
    expect(first.snapshot.title).toBe('Original');
    expect(second.version).toBe(2);
    expect(second.snapshot.title).toBe('New version');
    expect(f.actions).toHaveLength(3);
  });
  it('stops tomorrow only and requires admin plus reason for explicit historical withdrawal', async () => {
    const f = fixture();
    const publication = await f.service.publish('event', { startDate: '2026-10-08', endDate: '2026-10-31' }, { sub: 'staff', role: 'editor' });
    await f.service.publicationAction('event', publication.id, 'stop_future', 'Cancelled future dates', { sub: 'staff', role: 'editor' });
    expect(publication.stopFrom).toBe('2026-10-09');
    expect(publication.withdrawnAt).toBeNull();
    await expect(f.service.publicationAction('event', publication.id, 'withdraw_history', 'Correction', { sub: 'staff', role: 'editor' })).rejects.toThrow(ForbiddenException);
    await expect(f.service.publicationAction('event', publication.id, 'withdraw_history', ' ', { sub: 'admin', role: 'admin' })).rejects.toThrow(BadRequestException);
    await f.service.publicationAction('event', publication.id, 'withdraw_history', 'Incorrect content', { sub: 'admin', role: 'admin,traveler' });
    expect(publication.withdrawnAt).toEqual(new Date());
    expect(f.actions).toContainEqual(expect.objectContaining({ action: 'withdraw_history', oldValues: { stopFrom: '2026-10-09', withdrawnAt: null } }));
  });
  it('rejects past publication, invalid ranges, missing media, and unauthorized publication', async () => {
    const f = fixture();
    await expect(f.service.publish('event', { startDate: '2026-10-07', endDate: '2026-10-31' }, { sub: 'staff', role: 'editor' })).rejects.toThrow('Cannot fabricate');
    await expect(f.service.publish('event', { startDate: '2026-10-08', endDate: '2026-10-07' }, { sub: 'staff', role: 'editor' })).rejects.toThrow(BadRequestException);
    await expect(f.service.publish('event', { startDate: '2026-10-08', endDate: '2026-10-31' }, { sub: 'traveler', role: 'traveler' })).rejects.toThrow(ForbiddenException);
    f.event.image = '/uploads/missing.jpg';
    await expect(f.service.publish('event', { startDate: '2026-10-08', endDate: '2026-10-31' }, { sub: 'staff', role: 'editor' })).rejects.toThrow('missing from');
  });
  it('does not treat plain text /uploads references as missing authored media', async () => {
    const f = fixture(); f.event.description = 'Do not remove /uploads/explanation.jpg from a description of storage.';
    await expect(f.service.publish('event', { startDate: '2026-10-08', endDate: '2026-10-31' }, { sub: 'staff', role: 'editor' })).resolves.toBeDefined();
  });
  it('rejects unsupported video types and missing posters even through legacy status changes', async () => {
    const f = fixture(); f.event.media = [{ type: 'video', url: '/uploads/event.mp4' }];
    expect(() => validateEventContent(f.event)).toThrow('poster');
    await expect(f.service.updateStatus('event', 'upcoming')).rejects.toThrow('poster');
    f.event.image = '/uploads/poster.webp';
    expect(snapshotEvent(f.event).media[0].poster).toBe('/uploads/poster.webp');
    f.event.media[0].url = '/uploads/not-video.jpg';
    expect(() => validateEventContent(f.event)).toThrow('type');
  });
  it('preserves old public list/detail visibility before first explicit publication and rejects drafts', async () => {
    const f = fixture();
    const qb: any = {}; for (const name of ['where', 'andWhere', 'orderBy', 'addOrderBy', 'skip', 'take']) qb[name] = jest.fn(() => qb);
    qb.getManyAndCount = jest.fn(async () => [[f.event], 1]);
    (f.repo as any).createQueryBuilder = jest.fn(() => qb);
    expect(await f.service.getPublicBySlug('event')).toBe(f.event);
    const list = await f.service.listPublic({ startDate: '2026-10-01', endDate: '2026-10-31' });
    expect(list.data).toEqual([f.event]);
    expect(qb.andWhere).toHaveBeenCalledWith('COALESCE(e.endDate, e.date) >= :startDate', { startDate: '2026-10-01' });
    f.event.status = 'draft';
    await expect(f.service.getPublicBySlug('event')).rejects.toThrow('not found');
  });
  it('uses inclusive snapshot overlap and clips live compatibility before first future publication', async () => {
    const f = fixture();
    const result = await f.service.listCalendar({ startDate: '2026-10-01', endDate: '2026-10-31', page: 2, limit: 100 });
    const [sql, values] = f.dataSource.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('p.withdrawn_at IS NULL');
    expect(sql).toContain('LEAST(p.end_date, COALESCE(p.stop_from - 1, p.end_date)) >= $1::date');
    expect(sql).toContain('GREATEST(e.date, $3::date)');
    expect(sql).toContain('SELECT min(p.start_date) - 1');
    expect(sql).not.toContain('NOT EXISTS'); // Future-first publication must not remove today’s legacy content.
    expect(sql).toContain("e.status != 'draft'");
    expect(values).toEqual(['2026-10-01', '2026-10-31', '2026-10-08', null, 100, 100]);
    expect(result).toEqual({ data: [], total: 0, page: 2, pageSize: 100 });
  });
  it('refuses deletion after a publication exists', async () => {
    const f = fixture();
    await f.service.publish('event', { startDate: '2026-10-08', endDate: '2026-10-31' }, { sub: 'staff', role: 'editor' });
    await expect(f.service.remove('event')).rejects.toThrow('must be retained');
    expect(f.repo.remove).not.toHaveBeenCalled();
  });
  it('uses Shanghai midnight consistently', () => {
    expect(shanghaiToday(new Date('2026-10-07T16:00:00Z'))).toBe('2026-10-08');
  });
});
