import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource, EntityManager, In, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { isStaff, hasRole } from '../../common/auth/roles';
import { isUUID } from 'class-validator';
import { User } from '../users/entities/user.entity';
import { City } from '../cities/entities/city.entity';
import { StoryRoute } from '../routes/entities/story-route.entity';
import { RouteCityLink } from '../routes/entities/route-city-link.entity';
import { AdminNotification } from '../notifications/entities/admin-notification.entity';
import { MailerService } from '../email/mailer.service';
import { BookingSubmission } from './entities/booking-submission.entity';
import { InterpreterProfile } from './entities/interpreter-profile.entity';
import { ServiceRequestAssignment, ServiceRequestMessage, ServiceRequestQuote, ServiceRequestRead } from './entities/service-request.entity';
import { SERVICE_PACKAGES } from './service-packages';
import type { ProcessStatus } from './service-packages';
import type { AcceptRequestQuoteDto, AssignRequestDto, CreateServiceRequestDto, OfferRequestQuoteDto, RequestListDto, RequestMessagesQueryDto } from './dto/service-request.dto';

export interface RequestActor { sub: string; role: string }
const TRANSITIONS: Record<ProcessStatus, ProcessStatus[]> = {
  received: ['assigned', 'cancelled'], assigned: ['in_progress', 'confirmed', 'cancelled'],
  in_progress: ['confirmed', 'cancelled'], quoted: ['cancelled'],
  confirmed: ['in_progress', 'completed', 'cancelled'], completed: [], cancelled: [],
};

@Injectable()
export class ServiceRequestsService {
  private readonly logger = new Logger(ServiceRequestsService.name);
  constructor(
    @InjectRepository(BookingSubmission) private readonly bookings: Repository<BookingSubmission>,
    private readonly dataSource: DataSource,
    private readonly mailer: MailerService,
  ) {}

  packages() {
    return { packages: SERVICE_PACKAGES.map(p => ({ ...p })), paymentPolicy: 'not_configured', checkoutEnabled: false };
  }

  private subject(actor: RequestActor): string {
    if (!actor?.sub || !isUUID(actor.sub) || (!hasRole(actor.role, 'traveler') && !isStaff(actor.role))) throw new UnauthorizedException('Authentication is required');
    return actor.sub;
  }
  private traveler(actor: RequestActor): string {
    const id = this.subject(actor);
    if (!hasRole(actor.role, 'traveler')) throw new ForbiddenException('A traveler account is required');
    return id;
  }
  private key(value?: string): string {
    if (!value || !/^[A-Za-z0-9_.:-]{8,80}$/.test(value)) throw new BadRequestException('An 8–80 character Idempotency-Key is required');
    return value;
  }
  private isRequest(request: BookingSubmission | null): request is BookingSubmission {
    return !!request?.userId && !!request.serviceType && request.serviceType !== 'legacy_interpretation';
  }
  private checkOwner(request: BookingSubmission | null, actor: RequestActor): BookingSubmission {
    const ownerId = this.traveler(actor);
    if (!this.isRequest(request) || request.userId !== ownerId) throw new NotFoundException('Service request not found');
    return request;
  }
  private checkAssigned(request: BookingSubmission | null, actor: RequestActor): BookingSubmission {
    const staffId = this.subject(actor);
    if (!this.isRequest(request)) throw new NotFoundException('Service request not found');
    if (!isStaff(actor.role) || request.assignedPlannerId !== staffId) throw new ForbiddenException('Assign this request to your staff account before accessing its private conversation');
    return request;
  }
  private access(request: BookingSubmission | null, actor: RequestActor, staff: boolean) {
    return staff ? this.checkAssigned(request, actor) : this.checkOwner(request, actor);
  }
  private async locked(manager: EntityManager, id: string) {
    return manager.findOne(BookingSubmission, { where: { id }, lock: { mode: 'pessimistic_write' } });
  }
  private active(request: BookingSubmission) {
    if (request.processStatus === 'cancelled' || request.processStatus === 'completed') throw new ConflictException('This request is closed');
  }

  async create(actor: RequestActor, dto: CreateServiceRequestDto, idempotencyKey?: string) {
    const userId = this.traveler(actor);
    const key = this.key(idempotencyKey);
    // Select known fields deliberately: client amounts, owner IDs and payment
    // flags never become price or authorization inputs even in direct callers.
    const input = {
      serviceType: dto.serviceType, citySlug: dto.citySlug, routeId: dto.routeId ?? null,
      date: dto.date, groupSize: dto.groupSize, name: dto.name.trim(), contact: dto.contact.trim(),
      packageId: dto.packageId ?? null, preferredInterpreterId: dto.preferredInterpreterId ?? null,
      linkedRequestId: dto.linkedRequestId ?? null, languagePair: dto.languagePair?.trim() || null,
      preferences: {
        days: dto.preferences?.days ?? null, interests: dto.preferences?.interests ?? [],
        foodPreferences: dto.preferences?.foodPreferences ?? null, accommodation: dto.preferences?.accommodation ?? null,
        budget: dto.preferences?.budget ?? null, budgetAmount: dto.preferences?.budgetAmount ?? null,
        budgetCurrency: dto.preferences?.budgetCurrency ?? null, serviceContext: dto.preferences?.serviceContext ?? null,
        notes: dto.preferences?.notes ?? null,
      },
    };
    const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const replay = async () => {
      const existing = await this.bookings.findOne({ where: { userId, requestIdempotencyKey: key } });
      if (!existing) return null;
      if (existing.requestInputHash !== hash) throw new ConflictException('Idempotency-Key was already used with different request details');
      return this.present(existing, actor);
    };
    const existing = await replay();
    if (existing) return existing;
    if (!input.name || !input.contact || !['free_route', 'custom_route', 'interpretation'].includes(input.serviceType)) throw new BadRequestException('Complete the service request fields');
    const parsedDate = new Date(`${dto.date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dto.date) throw new BadRequestException('A real service date is required');
    if (!Number.isInteger(dto.groupSize) || dto.groupSize < 1 || dto.groupSize > 100) throw new BadRequestException('Group size must be 1–100');
    if (!!input.preferences.budgetAmount !== !!input.preferences.budgetCurrency) throw new BadRequestException('Budget amount and currency must be supplied together');
    const pkg = dto.packageId ? SERVICE_PACKAGES.find(p => p.id === dto.packageId && p.enabled) : null;
    if (dto.serviceType === 'interpretation' && (!pkg || !input.languagePair)) throw new BadRequestException('Choose an interpretation package and language pair');
    if (dto.serviceType !== 'interpretation' && (dto.packageId || dto.preferredInterpreterId || dto.linkedRequestId || dto.languagePair)) throw new BadRequestException('Interpretation preferences belong to a separate interpretation request');
    if ((dto.serviceType === 'free_route' || pkg?.routeType === 'fixed') && !dto.routeId) throw new BadRequestException('A published fixed route is required');
    let saved: BookingSubmission;
    try {
      saved = await this.dataSource.transaction(async manager => {
        const city = await manager.findOne(City, { where: { slug: dto.citySlug, published: true, deletedAt: IsNull() } });
        if (!city) throw new BadRequestException('Choose an available published city');
        if (dto.routeId) {
          const route = await manager.findOne(StoryRoute, { where: { id: dto.routeId, published: true, deletedAt: IsNull() } });
          const link = route && await manager.findOne(RouteCityLink, { where: { routeId: route.id, cityId: city.id } });
          if (!route || !link) throw new BadRequestException('Route must be published and associated with the selected city');
        }
        if (dto.preferredInterpreterId) {
          const profile = await manager.findOne(InterpreterProfile, { where: { id: dto.preferredInterpreterId, status: 'active' } });
          if (!profile) throw new BadRequestException('Preferred interpreter is unavailable');
        }
        if (dto.linkedRequestId) {
          const parent = this.checkOwner(await this.locked(manager, dto.linkedRequestId), actor);
          this.active(parent);
          if (!['free_route', 'custom_route'].includes(parent.serviceType) || parent.citySlug !== dto.citySlug || parent.serviceDate !== dto.date || Number(parent.groupSize) !== dto.groupSize || (parent.routeId && parent.routeId !== dto.routeId) || (parent.serviceType === 'free_route' ? pkg?.routeType !== 'fixed' : pkg?.routeType !== 'custom')) throw new BadRequestException('Linked request must be your matching route-planning trip');
        }
        const request = manager.create(BookingSubmission, {
          name: input.name, contact: input.contact, city: city.name, serviceDate: dto.date,
          supportMode: dto.serviceType, groupSize: String(dto.groupSize), routeOrNeed: dto.preferences?.notes ?? null,
          status: 'new', serviceType: dto.serviceType, userId, citySlug: city.slug, routeId: dto.routeId ?? null,
          linkedRequestId: dto.linkedRequestId ?? null, preferredInterpreterId: dto.preferredInterpreterId ?? null,
          requirements: { languagePair: input.languagePair ?? undefined, preferences: dto.preferences ?? {} },
          packageSnapshot: pkg ? { ...pkg } : null,
          priceSnapshot: { currency: 'USD', amountCents: pkg?.amountCents ?? (dto.serviceType === 'free_route' ? 0 : null), source: pkg ? 'package' : dto.serviceType === 'free_route' ? 'free' : 'quote_required' },
          assignedPlannerId: null, assignedInterpreterId: null, assignedInterpreterName: null,
          processStatus: 'received', requestPaymentStatus: dto.serviceType === 'free_route' ? 'not_required' : dto.serviceType === 'custom_route' ? 'quote_required' : 'confirmation_required',
          idempotencyKey: null, requestIdempotencyKey: key, requestInputHash: hash,
        });
        return manager.save(BookingSubmission, request);
      });
    } catch (error: unknown) {
      if ((error as { code?: string }).code === '23505') {
        const found = await replay();
        if (found) return found;
      }
      throw error;
    }
    await this.notify(saved, 'Service request received', true);
    return this.present(saved, actor);
  }

  async list(actor: RequestActor, query: RequestListDto, staff = false) {
    this.subject(actor);
    if (!staff) this.traveler(actor);
    if (staff && !isStaff(actor.role)) throw new ForbiddenException();
    const qb = this.bookings.createQueryBuilder('request').where('request.serviceType IN (:...types)', { types: ['free_route', 'custom_route', 'interpretation'] }).andWhere('request.userId IS NOT NULL');
    if (!staff) qb.andWhere('request.userId = :owner', { owner: actor.sub });
    if (query.serviceType) qb.andWhere('request.serviceType = :type', { type: query.serviceType });
    if (query.processStatus) qb.andWhere('request.processStatus = :status', { status: query.processStatus });
    if (query.citySlug) qb.andWhere('request.citySlug = :citySlug', { citySlug: query.citySlug });
    if (staff && query.q) qb.andWhere('(request.name ILIKE :q OR request.contact ILIKE :q)', { q: `%${query.q}%` });
    const [rows, total] = await qb.orderBy('request.createdAt', 'DESC').addOrderBy('request.id', 'DESC').skip((query.page - 1) * query.size).take(query.size).getManyAndCount();
    return { data: await Promise.all(rows.map(row => this.present(row, actor, staff))), total, page: query.page, size: query.size };
  }

  async detail(actor: RequestActor, id: string, staff = false) {
    const row = await this.bookings.findOne({ where: { id } });
    if (staff) {
      this.subject(actor);
    if (!isStaff(actor.role)) throw new ForbiddenException();
      if (!this.isRequest(row)) throw new NotFoundException('Service request not found');
    } else this.checkOwner(row, actor);
    const result = await this.present(row!, actor, staff);
    return staff ? { ...result, assignmentLog: await this.dataSource.manager.find(ServiceRequestAssignment, { where: { requestId: id }, order: { createdAt: 'ASC' } }) } : result;
  }

  async staffOptions(actor: RequestActor) {
    this.subject(actor);
    if (!isStaff(actor.role)) throw new ForbiddenException();
    const users = await this.dataSource.manager.find(User, { where: { status: 'active' }, select: { id: true, name: true, email: true, role: true } });
    return users.filter(user => isStaff(user.role)).map(user => ({ id: user.id, name: user.name || user.email, role: user.role }));
  }

  async assign(actor: RequestActor, id: string, dto: AssignRequestDto) {
    this.subject(actor);
    if (!isStaff(actor.role)) throw new ForbiddenException();
    const saved = await this.dataSource.transaction(async manager => {
      const row = await this.locked(manager, id);
      if (!this.isRequest(row)) throw new NotFoundException('Service request not found');
      this.active(row);
      const planner = await manager.findOne(User, { where: { id: dto.plannerId, status: 'active' } });
      if (!planner || !isStaff(planner.role)) throw new BadRequestException('Choose an active operation staff account');
      if (planner.id === row.userId) throw new BadRequestException('The request owner cannot be its assigned staff member');
      const profile = dto.interpreterId ? await manager.findOne(InterpreterProfile, { where: { id: dto.interpreterId, status: 'active' } }) : null;
      if (dto.interpreterId && (!profile || row.serviceType !== 'interpretation')) throw new BadRequestException('Only interpretation requests can be assigned an active interpreter');
      const previousPlannerId = row.assignedPlannerId;
      row.assignedPlannerId = planner.id;
      if (profile) { row.assignedInterpreterId = profile.id; row.assignedInterpreterName = profile.name; }
      if (row.processStatus === 'received') row.processStatus = 'assigned';
      await manager.save(ServiceRequestAssignment, manager.create(ServiceRequestAssignment, { requestId: id, assignedBy: actor.sub, plannerId: planner.id, previousPlannerId, interpreterId: row.assignedInterpreterId, reason: dto.reason?.trim() ?? '' }));
      return manager.save(BookingSubmission, row);
    });
    await this.notify(saved, 'Your service request has been assigned');
    return this.detail(actor, id, true);
  }

  async updateProcess(actor: RequestActor, id: string, next: ProcessStatus) {
    const saved = await this.dataSource.transaction(async manager => {
      const row = this.checkAssigned(await this.locked(manager, id), actor);
      if (!row.processStatus || !TRANSITIONS[row.processStatus].includes(next)) throw new ConflictException('Invalid request status transition');
      if ((next === 'confirmed' || next === 'completed') && row.serviceType === 'interpretation' && !row.assignedInterpreterId) {
        throw new ConflictException('Assign an active interpreter before confirming interpretation');
      }
      if (next === 'confirmed' && row.serviceType === 'custom_route') {
        const quote = await manager.findOne(ServiceRequestQuote, { where: { requestId: id, status: 'accepted' } });
        if (!quote) throw new ConflictException('The owner must accept a planning quote first');
      }
      row.processStatus = next;
      row.status = next === 'completed' || next === 'cancelled' || next === 'confirmed' ? next : 'contacted';
      return manager.save(BookingSubmission, row);
    });
    await this.notify(saved, `Service request ${next.replace('_', ' ')}`);
    return this.present(saved, actor, true);
  }

  async offerQuote(actor: RequestActor, id: string, dto: OfferRequestQuoteDto) {
    const saved = await this.dataSource.transaction(async manager => {
      const row = this.checkAssigned(await this.locked(manager, id), actor);
      this.active(row);
      if (row.serviceType !== 'custom_route') throw new BadRequestException('Planning quotes are only for custom route requests');
      if (!Number.isInteger(dto.amountCents) || dto.amountCents < 1 || dto.amountCents > 2147483647 || !dto.scope.trim()) throw new BadRequestException('Provide integer USD cents and a quote scope');
      const current = await manager.findOne(ServiceRequestQuote, { where: { requestId: id }, order: { revision: 'DESC' } });
      if ((current?.revision ?? 0) !== dto.expectedRevision) throw new ConflictException('Quote revision changed; reload before offering a quote');
      if (current?.status === 'accepted') throw new ConflictException('An accepted quote is immutable; do not overwrite the agreed planning price');
      if (current) { current.status = 'superseded'; await manager.save(ServiceRequestQuote, current); }
      await manager.save(ServiceRequestQuote, manager.create(ServiceRequestQuote, { requestId: id, revision: (current?.revision ?? 0) + 1, amountCents: dto.amountCents, currency: 'USD', scope: dto.scope.trim(), status: 'offered', offeredBy: actor.sub, acceptedAt: null }));
      row.processStatus = 'quoted';
      return manager.save(BookingSubmission, row);
    });
    await this.notify(saved, 'A custom route planning quote is ready');
    return this.present(saved, actor, true);
  }

  async acceptQuote(actor: RequestActor, id: string, dto: AcceptRequestQuoteDto) {
    const saved = await this.dataSource.transaction(async manager => {
      const row = this.checkOwner(await this.locked(manager, id), actor);
      this.active(row);
      const current = await manager.findOne(ServiceRequestQuote, { where: { requestId: id }, order: { revision: 'DESC' } });
      if (row.serviceType !== 'custom_route' || !current || current.id !== dto.quoteId || current.revision !== dto.revision || current.status === 'superseded') throw new ConflictException('This quote is no longer current');
      if (current.status === 'accepted') return row;
      current.status = 'accepted'; current.acceptedAt = new Date();
      await manager.save(ServiceRequestQuote, current);
      row.priceSnapshot = { currency: 'USD', amountCents: current.amountCents, source: 'quote' };
      row.requestPaymentStatus = 'confirmation_required'; row.processStatus = 'confirmed'; row.status = 'confirmed';
      return manager.save(BookingSubmission, row);
    });
    await this.notify(saved, 'Custom route planning quote accepted');
    return this.present(saved, actor);
  }

  async messages(actor: RequestActor, id: string, query: RequestMessagesQueryDto, staff = false) {
    return this.dataSource.transaction(async manager => {
      // The same request-row lock used by reassignment prevents an assignment
      // revocation racing a private conversation read.
      this.access(await this.locked(manager, id), actor, staff);
      const cursor = query.after ? await manager.findOne(ServiceRequestMessage, { where: { id: query.after, requestId: id } }) : null;
      if (query.after && !cursor) throw new BadRequestException('Message cursor does not belong to this request');
      const rows = await manager.find(ServiceRequestMessage, { where: { requestId: id, sequence: MoreThan(cursor?.sequence ?? 0) }, order: { sequence: 'ASC' }, take: query.size + 1 });
      const hasMore = rows.length > query.size;
      const data = rows.slice(0, query.size).map(row => this.messageView(row));
      return { data, hasMore, nextCursor: hasMore ? data.at(-1)?.id ?? null : null, unreadCount: await this.unread(id, actor.sub, manager) };
    });
  }
  private messageView(row: ServiceRequestMessage) { return { id: row.id, body: row.body, senderType: row.senderType, createdAt: row.createdAt }; }

  async sendMessage(actor: RequestActor, id: string, body: string, idempotencyKey?: string, staff = false) {
    const key = this.key(idempotencyKey);
    const text = body.trim();
    if (!text || text.length > 4000) throw new BadRequestException('Message must contain 1–4000 characters');
    const result = await this.dataSource.transaction(async manager => {
      const row = this.access(await this.locked(manager, id), actor, staff);
      const existing = await manager.findOne(ServiceRequestMessage, { where: { requestId: id, senderId: actor.sub, idempotencyKey: key } });
      if (existing) {
        if (existing.body !== text) throw new ConflictException('Idempotency-Key was used for a different message');
        return { row, message: existing, created: false };
      }
      this.active(row);
      const last = await manager.findOne(ServiceRequestMessage, { where: { requestId: id }, order: { sequence: 'DESC' } });
      const message = await manager.save(ServiceRequestMessage, manager.create(ServiceRequestMessage, { requestId: id, senderId: actor.sub, senderType: staff ? 'staff' : 'owner', body: text, sequence: (last?.sequence ?? 0) + 1, idempotencyKey: key }));
      return { row, message, created: true };
    });
    if (result.created) await this.notify(result.row, 'New private service request message', false, actor.sub);
    return this.messageView(result.message);
  }

  async readMessages(actor: RequestActor, id: string, messageId: string, staff = false) {
    await this.dataSource.transaction(async manager => {
      this.access(await this.locked(manager, id), actor, staff);
      const message = await manager.findOne(ServiceRequestMessage, { where: { id: messageId, requestId: id } });
      if (!message) throw new BadRequestException('Read marker does not belong to this request');
      const existing = await manager.findOne(ServiceRequestRead, { where: { requestId: id, userId: actor.sub } });
      const read = existing ?? manager.create(ServiceRequestRead, { requestId: id, userId: actor.sub, lastSequence: 0 });
      read.lastSequence = Math.max(read.lastSequence, message.sequence);
      await manager.save(ServiceRequestRead, read);
    });
    return { ok: true };
  }
  private async unread(id: string, userId: string, manager = this.dataSource.manager) {
    const marker = await manager.findOne(ServiceRequestRead, { where: { requestId: id, userId } });
    return manager.count(ServiceRequestMessage, { where: { requestId: id, sequence: MoreThan(marker?.lastSequence ?? 0), senderId: Not(userId) } });
  }

  private async present(row: BookingSubmission, actor: RequestActor, staff = false) {
    const quote = await this.dataSource.manager.findOne(ServiceRequestQuote, { where: { requestId: row.id }, order: { revision: 'DESC' } });
    const canReadConversation = staff ? isStaff(actor.role) && row.assignedPlannerId === actor.sub : row.userId === actor.sub;
    return {
      id: row.id, serviceType: row.serviceType, citySlug: row.citySlug, routeId: row.routeId,
      linkedRequestId: row.linkedRequestId, date: row.serviceDate, groupSize: Number(row.groupSize), name: row.name, contact: row.contact,
      requirements: row.requirements, preferredInterpreterId: row.preferredInterpreterId,
      assignedInterpreterId: row.assignedInterpreterId, assignedInterpreterName: row.assignedInterpreterName, assignedPlannerId: row.assignedPlannerId,
      packageSnapshot: row.packageSnapshot, priceSnapshot: row.priceSnapshot, processStatus: row.processStatus,
      paymentStatus: row.requestPaymentStatus, createdAt: row.createdAt, updatedAt: row.updatedAt,
      unreadCount: canReadConversation ? await this.unread(row.id, actor.sub) : 0,
      canReadConversation, quote: quote ? { id: quote.id, revision: quote.revision, amountCents: quote.amountCents, currency: quote.currency, scope: quote.scope, status: quote.status, createdAt: quote.createdAt, acceptedAt: quote.acceptedAt } : null,
      paymentPolicy: 'not_configured', checkoutEnabled: false,
    };
  }

  private async notify(row: BookingSubmission, title: string, triage = false, senderId?: string) {
    // Message bodies and user-supplied contact details never enter staff-wide
    // notifications/email logs. Conversation notification is link-only and
    // targets the current assigned staff and the authenticated owner's email.
    try {
      const manager = this.dataSource.manager;
      const staff = triage ? (await manager.find(User, { where: { status: 'active' }, select: { id: true, role: true } })).filter(u => isStaff(u.role)) : row.assignedPlannerId ? await manager.find(User, { where: { id: row.assignedPlannerId, status: 'active' } }) : [];
      const recipients = staff.filter(u => isStaff(u.role) && u.id !== senderId && u.id !== row.userId);
      if (recipients.length) await manager.save(AdminNotification, recipients.map(user => manager.create(AdminNotification, { recipientId: user.id, type: 'booking', title, body: 'Open the service request to review its current status.', resourceType: 'service_request', resourceId: row.id, link: '/admin/interpreting/bookings' })));
      if (senderId !== row.userId) {
        const owner = await manager.findOne(User, { where: { id: row.userId!, status: 'active' } });
        if (owner?.email) await this.mailer.sendTemplated('service_request_update', owner.email, { siteName: 'Culvoy', title, requestReference: row.id, serviceType: row.serviceType.replace('_', ' '), amount: row.priceSnapshot?.amountCents == null ? 'Planning quote required' : `USD ${(row.priceSnapshot.amountCents / 100).toFixed(2)}`, policyNotice: row.serviceType === 'free_route' ? 'The route booking has no route fee. Third-party travel costs are not included.' : 'Payment policy has not been configured. No deposit or payment is due through this request.', }, 'en', { resourceType: 'service_request', resourceId: row.id });
      }
    } catch { this.logger.warn('Service request notification could not be delivered'); }
  }
}
