import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, type EntityManager } from 'typeorm';
import { clampPagination } from '../../common/pagination';
import { hasRole, isStaff } from '../../common/auth/roles';
import { EVENT_STATUSES, EventEntity, type EventStatus } from './entities/event.entity';
import { EventPublicationEntity, EventPublicationActionEntity } from './entities/event-publication.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { PublishEventDto } from './dto/event-publication.dto';
import { assertDateRange, assertCalendarDate, shanghaiToday, snapshotEvent, validateEventContent } from './event-calendar.rules';

export type EventActor = { sub?: string; role?: string };
type EventQuery = { city?: string; status?: string; startDate?: string; endDate?: string; page?: number; limit?: number; q?: string };

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(EventEntity) private readonly repo: Repository<EventEntity>,
    private readonly dataSource: DataSource,
  ) {}

  private validateQuery(query: EventQuery) {
    if (query.startDate) assertCalendarDate(query.startDate);
    if (query.endDate) assertCalendarDate(query.endDate);
    if (query.startDate && query.endDate) assertDateRange(query.startDate, query.endDate);
  }

  /** Compatibility list/detail remain live non-draft records, not invented history. */
  async listPublic(query: EventQuery) {
    this.validateQuery(query);
    const { page, limit, skip } = clampPagination(query.page, query.limit);
    const qb = this.repo.createQueryBuilder('e').where('e.status != :draft', { draft: 'draft' });
    if (query.city) qb.andWhere('(e.citySlug = :city OR e.city = :city)', { city: query.city });
    if (query.startDate) qb.andWhere('COALESCE(e.endDate, e.date) >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('e.date <= :endDate', { endDate: query.endDate });
    const [items, total] = await qb.orderBy('e.date', 'DESC').addOrderBy('e.displayOrder', 'ASC').addOrderBy('e.id', 'ASC').skip(skip).take(limit).getManyAndCount();
    return { data: items, total, page, pageSize: limit };
  }

  async getPublicBySlug(slug: string) {
    const item = await this.repo.findOne({ where: { slug } });
    if (!item || item.status === 'draft') throw new NotFoundException('Event not found');
    return item;
  }

  /** One atomic UNION query: complete inclusive overlap and stable cross-source paging. */
  async listCalendar(query: EventQuery) {
    if (!query.startDate || !query.endDate) throw new BadRequestException('Calendar date range is required');
    assertDateRange(query.startDate, query.endDate);
    const span = Date.parse(query.endDate) - Date.parse(query.startDate);
    if (span > 62 * 86400000) throw new BadRequestException('Calendar range must not exceed 63 days');
    const { page, limit, skip } = clampPagination(query.page, query.limit, 100, 100);
    const today = shanghaiToday();
    const [result] = await this.dataSource.query(`
      WITH calendar AS (
        SELECT p.id::text AS key, p.display_order AS ordering, p.start_date AS starts,
          p.snapshot || jsonb_build_object(
            'id', p.id, 'publicationId', p.id, 'eventId', p.event_id, 'version', p.version,
            'date', p.start_date::text,
            'endDate', LEAST(p.end_date, COALESCE(p.stop_from - 1, p.end_date))::text,
            'displayOrder', p.display_order, 'publishedAt', p.published_at, 'source', 'publication') AS item
        FROM event_publications p
        WHERE p.withdrawn_at IS NULL AND p.start_date <= $2::date
          AND LEAST(p.end_date, COALESCE(p.stop_from - 1, p.end_date)) >= $1::date
          AND (p.stop_from IS NULL OR p.stop_from > p.start_date)
          AND ($4::text IS NULL OR p.snapshot->>'citySlug' = $4 OR p.snapshot->>'city' = $4)
        UNION ALL
        SELECT e.id::text, e.display_order, GREATEST(e.date, $3::date),
          jsonb_build_object('id', e.id, 'eventId', e.id, 'publicationId', NULL, 'version', 0,
            'source', 'legacy', 'publishedAt', NULL, 'slug', e.slug, 'title', e.title,
            'summary', e.summary, 'description', e.description, 'city', e.city, 'citySlug', e.city_slug,
            'date', GREATEST(e.date, $3::date)::text, 'endDate', LEAST(COALESCE(e.end_date, e.date), COALESCE((SELECT min(p.start_date) - 1 FROM event_publications p WHERE p.event_id = e.id), COALESCE(e.end_date, e.date)))::text,
            'eventDate', e.date::text, 'eventEndDate', e.end_date::text, 'image', e.image,
            'media', e.media, 'slogan', e.slogan, 'extraInfo', e.extra_info, 'displayOrder', e.display_order,
            'tags', e.tags, 'relatedRouteSlugs', e.related_route_slugs, 'status', e.status)
        FROM events e
        WHERE e.status != 'draft' AND GREATEST(e.date, $3::date) <= $2::date
          AND COALESCE(e.end_date, e.date) >= GREATEST($1::date, $3::date)
          AND ($4::text IS NULL OR e.city_slug = $4 OR e.city = $4)
          AND LEAST(COALESCE(e.end_date, e.date), COALESCE((SELECT min(p.start_date) - 1 FROM event_publications p WHERE p.event_id = e.id), COALESCE(e.end_date, e.date))) >= GREATEST($1::date, $3::date)
      ), paged AS (
        SELECT * FROM calendar ORDER BY ordering, starts, key LIMIT $5 OFFSET $6
      )
      SELECT COALESCE((SELECT jsonb_agg(item ORDER BY ordering, starts, key) FROM paged), '[]'::jsonb) AS data,
        (SELECT count(*)::int FROM calendar) AS total
    `, [query.startDate, query.endDate, today, query.city || null, limit, skip]);
    return { data: result.data, total: result.total, page, pageSize: limit };
  }

  async listAdmin(query: EventQuery) {
    this.validateQuery(query);
    const { page, limit, skip } = clampPagination(query.page, query.limit, 20, 200);
    const qb = this.repo.createQueryBuilder('e');
    if (query.status) qb.andWhere('e.status = :status', { status: query.status });
    if (query.city) qb.andWhere('(e.citySlug = :city OR e.city = :city)', { city: query.city });
    if (query.q) qb.andWhere('(e.title::text ILIKE :q OR e.slug ILIKE :q)', { q: `%${query.q}%` });
    if (query.startDate) qb.andWhere('COALESCE(e.endDate, e.date) >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('e.date <= :endDate', { endDate: query.endDate });
    const [items, total] = await qb.orderBy('e.date', 'DESC').addOrderBy('e.id', 'ASC').skip(skip).take(limit).getManyAndCount();
    return { data: items, total, page, pageSize: limit };
  }

  async getAdminById(id: string) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Event not found');
    return item;
  }

  async create(dto: CreateEventDto) {
    const event = this.repo.create({ ...dto, summary: dto.summary ?? '', description: dto.description ?? '',
      city: dto.city ?? '', citySlug: dto.citySlug ?? '', endDate: dto.endDate || null,
      tags: dto.tags ?? [], image: dto.image || null, media: dto.media ?? [], slogan: dto.slogan ?? '',
      extraInfo: dto.extraInfo ?? '', displayOrder: dto.displayOrder ?? 0,
      status: dto.status ?? 'draft', relatedRouteSlugs: dto.relatedRouteSlugs ?? [] });
    validateEventContent(event);
    return this.repo.save(event);
  }

  async update(id: string, dto: UpdateEventDto) {
    const event = await this.getAdminById(id);
    Object.assign(event, dto);
    if ('endDate' in dto) event.endDate = dto.endDate || null;
    validateEventContent(event);
    return this.repo.save(event);
  }

  async updateStatus(id: string, status: EventStatus) {
    if (!EVENT_STATUSES.includes(status)) throw new BadRequestException('Invalid event status');
    const event = await this.getAdminById(id);
    validateEventContent(event);
    event.status = status;
    return this.repo.save(event);
  }

  async remove(id: string) {
    const event = await this.getAdminById(id);
    if (await this.dataSource.getRepository(EventPublicationEntity).count({ where: { eventId: id } })) {
      throw new BadRequestException('Published event history must be retained; stop future display or withdraw a publication instead');
    }
    await this.repo.remove(event);
    return { success: true };
  }

  private requireActor(actor: EventActor, adminOnly = false): string {
    if (!actor.sub || !isStaff(actor.role) || (adminOnly && !hasRole(actor.role, 'admin'))) {
      throw new ForbiddenException('Insufficient publication permission');
    }
    return actor.sub;
  }

  async publications(id: string) {
    await this.getAdminById(id);
    const publications = await this.dataSource.getRepository(EventPublicationEntity).find({ where: { eventId: id }, order: { version: 'DESC' } });
    const actions = publications.length ? await this.dataSource.getRepository(EventPublicationActionEntity)
      .createQueryBuilder('a').where('a.publicationId IN (:...ids)', { ids: publications.map(p => p.id) }).orderBy('a.createdAt', 'DESC').getMany() : [];
    return { publications, actions };
  }

  private async recordAction(manager: EntityManager, publication: EventPublicationEntity,
    actorId: string, action: EventPublicationActionEntity['action'], reason: string,
    oldValues: Record<string, unknown> | null, newValues: Record<string, unknown>) {
    const repo = manager.getRepository(EventPublicationActionEntity);
    await repo.save(repo.create({ publicationId: publication.id, actorId, action, reason, oldValues, newValues }));
  }

  async publish(id: string, dto: PublishEventDto, actor: EventActor) {
    const actorId = this.requireActor(actor);
    assertDateRange(dto.startDate, dto.endDate);
    if (dto.startDate < shanghaiToday()) throw new BadRequestException('Cannot fabricate a past publication');
    return this.dataSource.transaction(async manager => {
      const event = await manager.getRepository(EventEntity).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!event) throw new NotFoundException('Event not found');
      validateEventContent(event);
      // Serialize with upload deletion, then verify references still exist in
      // the media registry before inserting an immutable snapshot.
      await manager.query('LOCK TABLE event_publications IN ROW EXCLUSIVE MODE');
      const snapshot = snapshotEvent(event);
      const paths = [...new Set([
        snapshot.image,
        ...snapshot.media.flatMap(asset => [asset.url, asset.poster]),
        // Authored Markdown images are historical media too; only actual image
        // references count, never arbitrary text that mentions /uploads/.
        ...[snapshot.summary, snapshot.description, snapshot.extraInfo].flatMap(text =>
          [...text.matchAll(/!\[[^\]]*\]\(<?(\/uploads\/[^\s)>]+)>?(?:\s+[^)]*)?\)|<img\b[^>]*\bsrc=["'](\/uploads\/[^"']+)["']/gi)].map(match => match[1] || match[2])),
      ].filter((path): path is string => Boolean(path)))];
      if (paths.length) {
        const registered: Array<{ url: string }> = await manager.query('SELECT url FROM media_files WHERE url = ANY($1::text[])', [paths]);
        const found = new Set(registered.map(file => file.url));
        if (paths.some(path => !found.has(path))) throw new BadRequestException('Publication media is missing from the media library; reindex or restore it before publishing');
      }
      const repo = manager.getRepository(EventPublicationEntity);
      const previous = await repo.find({ where: { eventId: id }, order: { version: 'DESC' } });
      for (const old of previous) {
        if (!old.withdrawnAt && old.endDate >= dto.startDate && (!old.stopFrom || old.stopFrom > dto.startDate)) {
          const before = { stopFrom: old.stopFrom };
          old.stopFrom = dto.startDate;
          await repo.save(old);
          await this.recordAction(manager, old, actorId, 'supersede', dto.reason?.trim() || '新版本接替展示', before, { stopFrom: old.stopFrom });
        }
      }
      const publication = await repo.save(repo.create({ eventId: id, version: (previous[0]?.version ?? 0) + 1,
        startDate: dto.startDate, endDate: dto.endDate, displayOrder: event.displayOrder,
        snapshot, publishedBy: actorId, stopFrom: null, withdrawnAt: null }));
      await this.recordAction(manager, publication, actorId, 'publish', dto.reason?.trim() || '发布已保存内容', null,
        { version: publication.version, startDate: publication.startDate, endDate: publication.endDate, snapshot: publication.snapshot });
      return publication;
    });
  }

  async publicationAction(eventId: string, publicationId: string, mode: 'stop_future' | 'withdraw_history', reason: string, actor: EventActor) {
    const actorId = this.requireActor(actor, mode === 'withdraw_history');
    if (!reason?.trim()) throw new BadRequestException('Operation reason is required');
    return this.dataSource.transaction(async manager => {
      // Same lock ordering as publishing prevents racing a replacement and a stop.
      const event = await manager.getRepository(EventEntity).findOne({ where: { id: eventId }, lock: { mode: 'pessimistic_write' } });
      if (!event) throw new NotFoundException('Event not found');
      const repo = manager.getRepository(EventPublicationEntity);
      const publication = await repo.findOne({ where: { id: publicationId, eventId } });
      if (!publication) throw new NotFoundException('Publication not found');
      const before = { stopFrom: publication.stopFrom, withdrawnAt: publication.withdrawnAt };
      if (mode === 'withdraw_history') {
        if (publication.withdrawnAt) return publication;
        publication.withdrawnAt = new Date();
      } else {
        const tomorrow = new Date(`${shanghaiToday()}T00:00:00Z`);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        const stopFrom = tomorrow.toISOString().slice(0, 10);
        if (publication.stopFrom && publication.stopFrom <= stopFrom) return publication;
        publication.stopFrom = stopFrom;
      }
      await repo.save(publication);
      await this.recordAction(manager, publication, actorId, mode, reason.trim(), before,
        { stopFrom: publication.stopFrom, withdrawnAt: publication.withdrawnAt });
      return publication;
    });
  }
}
