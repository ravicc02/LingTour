import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BookingSubmission } from './entities/booking-submission.entity';
import { City } from '../cities/entities/city.entity';
import { StoryRoute } from '../routes/entities/story-route.entity';
import { RouteCityLink } from '../routes/entities/route-city-link.entity';
import { User } from '../users/entities/user.entity';
import { InterpreterProfile } from './entities/interpreter-profile.entity';
import { AdminNotification } from '../notifications/entities/admin-notification.entity';
import { ServiceRequestAssignment, ServiceRequestMessage, ServiceRequestQuote, ServiceRequestRead } from './entities/service-request.entity';
import { ServiceRequestsService } from './service-requests.service';
import { CreateServiceRequestDto, RequestListDto } from './dto/service-request.dto';

const owner = { sub: '11111111-1111-4111-8111-111111111111', role: 'traveler' };
const staff = { sub: '22222222-2222-4222-8222-222222222222', role: 'admin,traveler' };
const stranger = { sub: '33333333-3333-4333-8333-333333333333', role: 'traveler' };
const id = '44444444-4444-4444-8444-444444444444';
const routeId = '55555555-5555-4555-8555-555555555555';
const base = (): CreateServiceRequestDto => ({ serviceType: 'free_route', citySlug: 'guangzhou', routeId, date: '2026-10-28', groupSize: 2, name: 'Traveler', contact: 'not-owner@example.com' });

describe('ServiceRequestsService — private requests and payment policy', () => {
  let service: ServiceRequestsService;
  let rows: BookingSubmission[];
  let quotes: ServiceRequestQuote[];
  let messages: ServiceRequestMessage[];
  let reads: ServiceRequestRead[];
  let manager: any;
  let repo: any;
  let mailer: any;
  let sequence: number;
  let publishedCity: boolean;
  let publishedRoute: boolean;
  let routeLinked: boolean;
  let planner: any;
  beforeEach(() => {
    sequence = 0; rows = []; quotes = []; messages = []; reads = []; publishedCity = true; publishedRoute = true; routeLinked = true;
    planner = { id: staff.sub, status: 'active', role: staff.role, name: 'Operator' };
    manager = {
      create: jest.fn((_type, value) => ({ ...value })),
      save: jest.fn(async (type, value) => {
        if (Array.isArray(value)) return value;
        if (!value.id) value.id = `${(++sequence).toString().padStart(8, '0')}-0000-4000-8000-000000000000`;
        value.createdAt ??= new Date(); value.updatedAt = new Date();
        const target = type === BookingSubmission ? rows : type === ServiceRequestQuote ? quotes : type === ServiceRequestMessage ? messages : type === ServiceRequestRead ? reads : null;
        if (target && !target.some((item: any) => item.id === value.id)) target.push(value);
        return value;
      }),
      findOne: jest.fn(async (type, options) => {
        const w = options.where;
        if (type === City) return publishedCity ? { id: 'city-id', slug: 'guangzhou', name: 'Guangzhou' } : null;
        if (type === StoryRoute) return publishedRoute ? { id: routeId } : null;
        if (type === RouteCityLink) return routeLinked ? { id: 'link-id' } : null;
        if (type === InterpreterProfile) return { id: w.id, status: 'active', name: 'Interpreter' };
        if (type === User) return w.id === owner.sub || w.id === stranger.sub ? { id: w.id, email: 'owner@example.com' } : planner;
        const source: any[] = type === BookingSubmission ? rows : type === ServiceRequestQuote ? quotes : type === ServiceRequestMessage ? messages : type === ServiceRequestRead ? reads : [];
        let filtered = source.filter(item => Object.entries(w).every(([key, value]) => item[key] === value));
        if (options.order?.revision === 'DESC') filtered = filtered.sort((a, b) => b.revision - a.revision);
        if (options.order?.sequence === 'DESC') filtered = filtered.sort((a, b) => b.sequence - a.sequence);
        return filtered[0] ?? null;
      }),
      find: jest.fn(async (type, options) => {
        if (type === User) return [planner];
        if (type === ServiceRequestMessage) return messages.filter(m => m.requestId === options.where.requestId && m.sequence > options.where.sequence.value).slice(0, options.take);
        return [];
      }),
      count: jest.fn(async () => 0),
    };
    repo = { findOne: jest.fn(async ({ where }) => rows.find(row => Object.entries(where).every(([key, value]) => (row as any)[key] === value)) ?? null) };
    mailer = { sendTemplated: jest.fn(async () => true) };
    service = new ServiceRequestsService(repo, { manager, transaction: (fn: any) => fn(manager) } as never, mailer);
  });
  const submit = (dto = base(), key = 'request-001') => service.create(owner, dto, key);
  it('publishes only the six confirmed USD packages and no invented deposit', () => {
    const result = service.packages();
    expect(result.checkoutEnabled).toBe(false);
    expect(result.packages.map(p => [p.id, p.amountCents])).toEqual([['fixed4', 30500], ['fixed5', 37500], ['fixed7', 52500], ['custom4', 40000], ['custom5', 50000], ['custom7', 70000]]);
    expect(result.packages.every(p => p.currency === 'USD' && p.depositCents === null && p.paymentPolicy === 'not_configured')).toBe(true);
  });
  it('creates a free route request at USD zero without order or deposit state', async () => {
    const result = await submit({ ...base(), amountCents: 999999 } as any);
    expect(result.priceSnapshot).toEqual({ currency: 'USD', amountCents: 0, source: 'free' });
    expect(result.paymentStatus).toBe('not_required'); expect(result.processStatus).toBe('received'); expect(result.checkoutEnabled).toBe(false);
    expect(rows[0].userId).toBe(owner.sub); expect(rows[0].status).toBe('new');
    expect(manager.save.mock.calls.map((call: any[]) => call[0])).not.toContain('Order');
  });
  it('custom planning requires a quote and never invents a planning minimum', async () => {
    const result = await submit({ ...base(), serviceType: 'custom_route', routeId: undefined });
    expect(result.priceSnapshot?.amountCents).toBeNull(); expect(result.priceSnapshot?.source).toBe('quote_required'); expect(result.paymentStatus).toBe('quote_required');
  });
  it.each(['fixed4', 'fixed5', 'fixed7', 'custom4', 'custom5', 'custom7'])('snapshots server-owned %s price independent of malicious client amount', async packageId => {
    const result = await submit({ ...base(), serviceType: 'interpretation', packageId, languagePair: 'English / Mandarin', amountCents: 1, depositCents: 1 } as any);
    expect(result.priceSnapshot?.amountCents).toBe(service.packages().packages.find(p => p.id === packageId)?.amountCents);
    expect(result.packageSnapshot?.depositCents).toBeNull(); expect(result.paymentStatus).toBe('confirmation_required'); expect(result.checkoutEnabled).toBe(false);
    expect(result.assignedInterpreterId).toBeNull();
  });
  it('rejects missing fixed route, wrong/unpublished associations and invalid real dates', async () => {
    await expect(submit({ ...base(), routeId: undefined })).rejects.toBeInstanceOf(BadRequestException);
    publishedCity = false; await expect(submit()).rejects.toBeInstanceOf(BadRequestException);
    publishedCity = true; publishedRoute = false; await expect(submit()).rejects.toBeInstanceOf(BadRequestException);
    publishedRoute = true; routeLinked = false; await expect(submit()).rejects.toBeInstanceOf(BadRequestException);
    await expect(submit({ ...base(), date: '2026-02-30' })).rejects.toBeInstanceOf(BadRequestException);
    expect(rows).toHaveLength(0);
  });
  it('requires explicit interpretation package/language and disallows package on free route', async () => {
    await expect(submit({ ...base(), packageId: 'fixed4' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(submit({ ...base(), serviceType: 'interpretation' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(submit({ ...base(), serviceType: 'interpretation', packageId: 'made-up', languagePair: 'English / Cantonese' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('scopes request idempotency to the owner, validates payload reuse and survives lost-response retry', async () => {
    const first = await submit(); const second = await submit(); expect(second.id).toBe(first.id); expect(rows).toHaveLength(1);
    await expect(submit({ ...base(), groupSize: 3 })).rejects.toBeInstanceOf(ConflictException);
    const other = await service.create(stranger, base(), 'request-001'); expect(other.id).not.toBe(first.id); expect(rows).toHaveLength(2);
    expect(mailer.sendTemplated).toHaveBeenCalledTimes(2);
  });
  it('fails closed for absent/null/malformed subjects and staff-only account requests', async () => {
    for (const sub of [undefined, null, '', 'not-a-uuid']) await expect(service.create({ sub, role: 'traveler' } as any, base(), 'request-001')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.create({ ...staff, role: 'admin' }, base(), 'request-001')).rejects.toBeInstanceOf(ForbiddenException);
    expect(rows).toHaveLength(0);
  });
  it('cannot claim another request through matching email or guessed UUID; triage does not allow unassigned conversations', async () => {
    const result = await submit();
    await expect(service.detail(stranger, result.id)).rejects.toBeInstanceOf(NotFoundException);
    const triage = await service.detail(staff, result.id, true); expect(triage.canReadConversation).toBe(false);
    await expect(service.messages(staff, result.id, { size: 50 }, true)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.sendMessage(staff, result.id, 'private', 'message-001', true)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.messages(owner, id, { size: 50 })).rejects.toBeInstanceOf(NotFoundException);
  });
  it('checks active staff roles and does not treat preferred interpreter as assigned or confirmed', async () => {
    const result = await submit();
    planner.role = 'traveler'; await expect(service.assign(staff, result.id, { plannerId: staff.sub })).rejects.toBeInstanceOf(BadRequestException);
    planner.role = 'admin,traveler';
    await service.assign(staff, result.id, { plannerId: staff.sub, reason: 'Ready for triage' });
    expect(rows[0].processStatus).toBe('assigned'); expect(rows[0].status).toBe('new');
    expect(manager.save).toHaveBeenCalledWith(ServiceRequestAssignment, expect.objectContaining({ plannerId: staff.sub, assignedBy: staff.sub }));
  });
  it('links optional interpretation only to the same owned trip and route type', async () => {
    const first = await submit();
    const linked = { ...base(), serviceType: 'interpretation' as const, packageId: 'fixed4', languagePair: 'English / Mandarin', linkedRequestId: first.id };
    await expect(submit({ ...linked, groupSize: 3 }, 'linked-001')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(stranger, linked, 'linked-001')).rejects.toBeInstanceOf(NotFoundException);
    const result = await submit(linked, 'linked-001'); expect(result.linkedRequestId).toBe(first.id);
  });
  it('serializes quote revisions/acceptance with the same request lock; rejects stale offer and stale owner acceptance', async () => {
    const request = await submit({ ...base(), serviceType: 'custom_route' });
    await service.assign(staff, request.id, { plannerId: staff.sub });
    const first = await service.offerQuote(staff, request.id, { amountCents: 12345, scope: 'Two-day planning only', expectedRevision: 0 });
    await expect(service.offerQuote(staff, request.id, { amountCents: 99999, scope: 'conflicting', expectedRevision: 0 })).rejects.toBeInstanceOf(ConflictException);
    const second = await service.offerQuote(staff, request.id, { amountCents: 15000, scope: 'Revised planning only', expectedRevision: 1 });
    await expect(service.acceptQuote(owner, request.id, { quoteId: first.quote!.id, revision: 1 })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.acceptQuote(stranger, request.id, { quoteId: second.quote!.id, revision: 2 })).rejects.toBeInstanceOf(NotFoundException);
    const accepted = await service.acceptQuote(owner, request.id, { quoteId: second.quote!.id, revision: 2 });
    expect(accepted.quote?.status).toBe('accepted'); expect(accepted.priceSnapshot?.amountCents).toBe(15000); expect(accepted.paymentStatus).toBe('confirmation_required'); expect(accepted.checkoutEnabled).toBe(false);
    await expect(service.offerQuote(staff, request.id, { amountCents: 17000, scope: 'Overwrite', expectedRevision: 2 })).rejects.toBeInstanceOf(ConflictException);
    expect(manager.findOne).toHaveBeenCalledWith(BookingSubmission, expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
  });
  it('only custom planning can be quoted; integer cents and scope required', async () => {
    const request = await submit(); await service.assign(staff, request.id, { plannerId: staff.sub });
    await expect(service.offerQuote(staff, request.id, { amountCents: 1, scope: 'Planning', expectedRevision: 0 })).rejects.toBeInstanceOf(BadRequestException);
    const custom = await submit({ ...base(), serviceType: 'custom_route' }, 'custom-001'); await service.assign(staff, custom.id, { plannerId: staff.sub });
    await expect(service.offerQuote(staff, custom.id, { amountCents: 1.1, scope: 'Planning', expectedRevision: 0 })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('private message retry is idempotent; changed body conflicts; notification never includes private text', async () => {
    const request = await submit(); await service.assign(staff, request.id, { plannerId: staff.sub });
    mailer.sendTemplated.mockClear(); manager.save.mockClear();
    const first = await service.sendMessage(owner, request.id, 'secret body', 'message-001');
    const retry = await service.sendMessage(owner, request.id, 'secret body', 'message-001'); expect(retry.id).toBe(first.id); expect(messages).toHaveLength(1);
    await expect(service.sendMessage(owner, request.id, 'different body', 'message-001')).rejects.toBeInstanceOf(ConflictException);
    const notifications = manager.save.mock.calls.filter((c: any[]) => c[0] === AdminNotification);
    expect(JSON.stringify(notifications)).not.toContain('secret body'); expect(mailer.sendTemplated).not.toHaveBeenCalled();
    await service.sendMessage(staff, request.id, 'staff private text', 'message-002', true);
    expect(JSON.stringify(mailer.sendTemplated.mock.calls)).not.toContain('staff private text');
  });
  it('uses request-scoped cursor, stable message pagination and monotonic per-user read markers', async () => {
    const request = await submit();
    for (let i = 0; i < 3; i++) await service.sendMessage(owner, request.id, `Message ${i}`, `message-00${i}`);
    const first = await service.messages(owner, request.id, { size: 2 }); expect(first.data).toHaveLength(2); expect(first.hasMore).toBe(true);
    const second = await service.messages(owner, request.id, { size: 2, after: first.nextCursor! }); expect(second.data).toHaveLength(1); expect(second.hasMore).toBe(false);
    await service.readMessages(owner, request.id, second.data[0].id); await service.readMessages(owner, request.id, first.data[0].id); expect(reads[0].lastSequence).toBe(3);
    await expect(service.readMessages(owner, request.id, id)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('legacy entity rows with null ownership are never private request records', async () => {
    rows.push({ id, userId: null, serviceType: 'legacy_interpretation', contact: 'owner@example.com' } as BookingSubmission);
    await expect(service.detail(owner, id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.detail(staff, id, true)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('requires a real assigned interpreter before confirmation, separate from preferred profile', async () => {
    const request = await submit({ ...base(), serviceType: 'interpretation', packageId: 'fixed4', languagePair: 'English / Mandarin', preferredInterpreterId: routeId });
    await service.assign(staff, request.id, { plannerId: staff.sub });
    await expect(service.updateProcess(staff, request.id, 'confirmed')).rejects.toBeInstanceOf(ConflictException);
    await service.assign(staff, request.id, { plannerId: staff.sub, interpreterId: routeId });
    const confirmed = await service.updateProcess(staff, request.id, 'confirmed');
    expect(confirmed.processStatus).toBe('confirmed'); expect(confirmed.paymentStatus).toBe('confirmation_required'); expect(confirmed.checkoutEnabled).toBe(false);
  });
  it('accepts omitted default list filters but never relaxes invalid empty enum inputs', async () => {
    const defaults = plainToInstance(RequestListDto, { page: '1', size: '20' });
    expect(await validate(defaults)).toEqual([]);
    expect(defaults.page).toBe(1); expect(defaults.size).toBe(20);
    const invalid = plainToInstance(RequestListDto, { serviceType: '', processStatus: '' });
    expect((await validate(invalid)).map(e => e.property)).toEqual(expect.arrayContaining(['serviceType', 'processStatus']));
  });
  it('validates strict DTOs, rejects unknown client amount/owner and structured budget mismatches', async () => {
    const errors = await validate(plainToInstance(CreateServiceRequestDto, { ...base(), userId: stranger.sub, amountCents: 1 }), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map(e => e.property)).toEqual(expect.arrayContaining(['userId', 'amountCents']));
    const nested = await validate(plainToInstance(CreateServiceRequestDto, { ...base(), preferences: { budgetAmount: '10.123', budgetCurrency: 'EUR' } })); expect(nested.length).toBeGreaterThan(0);
    await expect(submit({ ...base(), preferences: { budgetAmount: '10.00' } })).rejects.toBeInstanceOf(BadRequestException);
  });
});
