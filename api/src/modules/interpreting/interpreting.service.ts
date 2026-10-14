import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, EntityTarget, Repository } from 'typeorm';
import { ServiceMode } from './entities/service-mode.entity';
import { InterpreterProfile } from './entities/interpreter-profile.entity';
import { Faq } from './entities/faq.entity';
import { BookingSubmission } from './entities/booking-submission.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { OrdersService } from '../orders/orders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailerService } from '../email/mailer.service';

/**
 * Booking 状态机（report P1-6）：白名单内的合法「从 → 到」流转。
 * 押金链 deposit_pending → deposit_paid 与常规链 new → … 并存；
 * completed / cancelled 是终态。`pending` 是历史遗留值，只读兼容。
 */
export const BOOKING_STATUS_TRANSITIONS: Record<string, string[]> = {
  new: ['read', 'contacted', 'confirmed', 'deposit_pending', 'cancelled'],
  pending: ['read', 'contacted', 'confirmed', 'deposit_pending', 'cancelled'],
  read: ['contacted', 'confirmed', 'deposit_pending', 'cancelled'],
  contacted: ['confirmed', 'deposit_pending', 'cancelled'],
  deposit_pending: ['deposit_paid', 'cancelled'],
  deposit_paid: ['confirmed', 'completed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

@Injectable()
export class InterpretingService {
  private readonly logger = new Logger(InterpretingService.name);

  constructor(
    @InjectRepository(ServiceMode)
    private readonly modeRepo: Repository<ServiceMode>,
    @InjectRepository(InterpreterProfile)
    private readonly profileRepo: Repository<InterpreterProfile>,
    @InjectRepository(Faq)
    private readonly faqRepo: Repository<Faq>,
    @InjectRepository(BookingSubmission)
    private readonly bookingRepo: Repository<BookingSubmission>,
    private readonly ordersService: OrdersService,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
    private readonly mailerService: MailerService,
  ) {}

  // ── Public: Full page data ──

  async getPublicPageData() {
    const [serviceModes, profiles, faqs] = await Promise.all([
      this.modeRepo.find({ order: { sortOrder: 'ASC' } }),
      this.profileRepo.find({
        where: { status: 'active' },
        order: { sortOrder: 'ASC' },
      }),
      this.faqRepo.find({ order: { sortOrder: 'ASC' } }),
    ]);

    return {
      service_modes: serviceModes,
      profiles,
      faqs,
    };
  }

  // ── Admin: Get all config ──

  async getAdminConfig() {
    return this.getPublicPageData();
  }

  async findModesAdmin(page = 1, pageSize = 20) {
    const [items, total] = await this.modeRepo.findAndCount({
      order: { sortOrder: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data: items, total, page, pageSize };
  }

  async findModeByIdAdmin(id: string) {
    const mode = await this.modeRepo.findOne({ where: { id } });
    if (!mode) throw new NotFoundException('Service mode not found');
    return mode;
  }

  async createMode(data: Partial<ServiceMode>) {
    const sortOrder = await this.getNextSortOrder(this.modeRepo);
    const mode = this.modeRepo.create({
      ...this.normalizeMode(data),
      sortOrder,
    });
    const saved = await this.modeRepo.save(mode);
    if (typeof data.sortOrder === 'number' && data.sortOrder !== sortOrder) {
      return this.moveEntityToSortOrder(
        this.modeRepo,
        saved.id,
        data.sortOrder,
      );
    }
    return saved;
  }

  async updateMode(id: string, data: Partial<ServiceMode>) {
    const mode = await this.findModeByIdAdmin(id);
    const requestedSortOrder = data.sortOrder;
    Object.assign(
      mode,
      this.normalizeMode({ ...data, sortOrder: mode.sortOrder }, mode),
    );
    const saved = await this.modeRepo.save(mode);
    if (
      typeof requestedSortOrder === 'number' &&
      requestedSortOrder !== saved.sortOrder
    ) {
      return this.moveEntityToSortOrder(this.modeRepo, id, requestedSortOrder);
    }
    return saved;
  }

  async deleteMode(id: string) {
    await this.modeRepo.delete(id);
    return { deleted: true };
  }

  async updateModeSort(id: string, sortOrder: number) {
    return this.moveEntityToSortOrder(this.modeRepo, id, sortOrder);
  }

  async findProfilesAdmin(page = 1, pageSize = 20, status?: string) {
    const qb = this.profileRepo
      .createQueryBuilder('p')
      .orderBy('p.sortOrder', 'ASC');
    if (status) qb.andWhere('p.status = :status', { status });
    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { data: items, total, page, pageSize };
  }

  async findProfileByIdAdmin(id: string) {
    const profile = await this.profileRepo.findOne({ where: { id } });
    if (!profile) throw new NotFoundException('Interpreter profile not found');
    return profile;
  }

  async createProfile(data: Partial<InterpreterProfile>) {
    const sortOrder = await this.getNextSortOrder(this.profileRepo);
    const profile = this.profileRepo.create({
      ...this.normalizeProfile(data),
      sortOrder,
    });
    const saved = await this.profileRepo.save(profile);
    if (typeof data.sortOrder === 'number' && data.sortOrder !== sortOrder) {
      return this.moveEntityToSortOrder(
        this.profileRepo,
        saved.id,
        data.sortOrder,
      );
    }
    return saved;
  }

  async updateProfile(id: string, data: Partial<InterpreterProfile>) {
    const profile = await this.findProfileByIdAdmin(id);
    const requestedSortOrder = data.sortOrder;
    Object.assign(
      profile,
      this.normalizeProfile({ ...data, sortOrder: profile.sortOrder }, profile),
    );
    const saved = await this.profileRepo.save(profile);
    if (
      typeof requestedSortOrder === 'number' &&
      requestedSortOrder !== saved.sortOrder
    ) {
      return this.moveEntityToSortOrder(
        this.profileRepo,
        id,
        requestedSortOrder,
      );
    }
    return saved;
  }

  async deleteProfile(id: string) {
    await this.profileRepo.delete(id);
    return { deleted: true };
  }

  async updateProfileStatus(id: string, status: string) {
    const profile = await this.findProfileByIdAdmin(id);
    profile.status = status;
    return this.profileRepo.save(profile);
  }

  async findFaqsAdmin(page = 1, pageSize = 20, category?: string) {
    const qb = this.faqRepo
      .createQueryBuilder('f')
      .orderBy('f.sortOrder', 'ASC');
    if (category) qb.andWhere('f.category = :category', { category });
    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { data: items, total, page, pageSize };
  }

  async findFaqByIdAdmin(id: string) {
    const faq = await this.faqRepo.findOne({ where: { id } });
    if (!faq) throw new NotFoundException('FAQ not found');
    return faq;
  }

  async createFaq(data: Partial<Faq>) {
    const sortOrder = await this.getNextSortOrder(this.faqRepo);
    const faq = this.faqRepo.create({
      ...this.normalizeFaq(data),
      sortOrder,
    });
    const saved = await this.faqRepo.save(faq);
    if (typeof data.sortOrder === 'number' && data.sortOrder !== sortOrder) {
      return this.moveEntityToSortOrder(this.faqRepo, saved.id, data.sortOrder);
    }
    return saved;
  }

  async updateFaq(id: string, data: Partial<Faq>) {
    const faq = await this.findFaqByIdAdmin(id);
    const requestedSortOrder = data.sortOrder;
    Object.assign(
      faq,
      this.normalizeFaq({ ...data, sortOrder: faq.sortOrder }, faq),
    );
    const saved = await this.faqRepo.save(faq);
    if (
      typeof requestedSortOrder === 'number' &&
      requestedSortOrder !== saved.sortOrder
    ) {
      return this.moveEntityToSortOrder(this.faqRepo, id, requestedSortOrder);
    }
    return saved;
  }

  async deleteFaq(id: string) {
    await this.faqRepo.delete(id);
    return { deleted: true };
  }

  async updateFaqSort(id: string, sortOrder: number) {
    return this.moveEntityToSortOrder(this.faqRepo, id, sortOrder);
  }

  // ── Admin: Full replace operations ──

  async replaceServiceModes(modes: Partial<ServiceMode>[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.delete(ServiceMode, {});
      if (modes.length) {
        const entities = modes.map((m, index) =>
          queryRunner.manager.create(ServiceMode, {
            sortOrder: index,
            ...this.normalizeMode(m),
            accent: m.accent ?? 'light',
            featured: m.featured ?? false,
          }),
        );
        await queryRunner.manager.save(entities);
      }
      await queryRunner.commitTransaction();
      return { updated: true, count: modes.length };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async replaceProfiles(profiles: Partial<InterpreterProfile>[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.delete(InterpreterProfile, {});
      if (profiles.length) {
        const entities = profiles.map((p, index) =>
          queryRunner.manager.create(InterpreterProfile, {
            sortOrder: index,
            ...this.normalizeProfile(p),
          }),
        );
        await queryRunner.manager.save(entities);
      }
      await queryRunner.commitTransaction();
      return { updated: true, count: profiles.length };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async replaceFaqs(faqs: Partial<Faq>[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.delete(Faq, {});
      if (faqs.length) {
        const entities = faqs.map((f, index) =>
          queryRunner.manager.create(Faq, {
            sortOrder: index,
            ...this.normalizeFaq(f),
          }),
        );
        await queryRunner.manager.save(entities);
      }
      await queryRunner.commitTransaction();
      return { updated: true, count: faqs.length };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ── Bookings: Public submit ──

  async submitBooking(dto: CreateBookingDto, idempotencyKey?: string) {
    const key = this.normalizeIdempotencyKey(idempotencyKey);
    if (key) {
      const existing = await this.bookingRepo.findOne({
        where: { idempotencyKey: key },
      });
      if (existing) return this.bookingResponse(existing);
    }

    const booking = this.bookingRepo.create({
      name: dto.name,
      contact: dto.contact,
      city: dto.city,
      serviceDate: dto.serviceDate,
      supportMode: dto.supportMode,
      groupSize: dto.groupSize ?? null,
      routeOrNeed: dto.routeOrNeed ?? null,
      status: 'new',
      idempotencyKey: key ?? null,
    });
    let saved: BookingSubmission;
    try {
      saved = await this.bookingRepo.save(booking);
    } catch (error: unknown) {
      if (!key || (error as { code?: string })?.code !== '23505') throw error;
      const existing = await this.bookingRepo.findOne({
        where: { idempotencyKey: key },
      });
      if (!existing) throw error;
      return this.bookingResponse(existing);
    }
    await this.notifyNewBooking(saved.id, dto);
    return this.bookingResponse(saved);
  }

  private bookingResponse(booking: BookingSubmission) {
    return {
      id: booking.id,
      message: 'Booking request received. We will contact you within 24 hours.',
      created_at: booking.createdAt,
    };
  }

  async submitBookingWithDeposit(dto: CreateBookingDto, idempotencyKey?: string) {
    const key = this.normalizeIdempotencyKey(idempotencyKey);
    if (key) {
      const existing = await this.bookingRepo.findOne({
        where: { idempotencyKey: key },
      });
      if (existing) {
        throw new ConflictException('This booking request was already submitted');
      }
    }

    const depositAmount = await this.calculateDepositAmount(dto);
    let checkout: {
      booking: BookingSubmission;
      depositOrder: Awaited<
        ReturnType<OrdersService['createInterpretingDeposit']>
      >;
    };
    try {
      checkout = await this.dataSource.transaction(async (manager) => {
        const booking = manager.create(BookingSubmission, {
          name: dto.name,
          contact: dto.contact,
          city: dto.city,
          serviceDate: dto.serviceDate,
          supportMode: dto.supportMode,
          groupSize: dto.groupSize ?? null,
          routeOrNeed: dto.routeOrNeed ?? null,
          status: 'deposit_pending',
          idempotencyKey: key ?? null,
        });
        const saved = await manager.save(BookingSubmission, booking);
        const depositOrder = await this.ordersService.createInterpretingDeposit(
          {
            bookingSubmissionId: saved.id,
            name: dto.name,
            contact: dto.contact,
            city: dto.city,
            serviceDate: dto.serviceDate,
            supportMode: dto.supportMode,
            groupSize: dto.groupSize ?? null,
            routeOrNeed: dto.routeOrNeed ?? null,
            depositAmount,
            currency: 'SGD',
          },
          manager,
        );

        return { booking: saved, depositOrder };
      });
    } catch (error: unknown) {
      if (key && (error as { code?: string })?.code === '23505') {
        throw new ConflictException('This booking request was already submitted');
      }
      throw error;
    }

    await this.notifyNewBooking(checkout.booking.id, dto);

    return {
      bookingId: checkout.booking.id,
      created_at: checkout.booking.createdAt,
      status: checkout.booking.status,
      message:
        'Booking request received. Secure the interpreter slot with the deposit below.',
      deposit: {
        orderNo: checkout.depositOrder.orderNo,
        amount: checkout.depositOrder.totalAmount,
        currency: checkout.depositOrder.currency,
        status: checkout.depositOrder.status,
        paymentLabel: this.describeDeposit(dto),
        paypalOrderId: checkout.depositOrder.paypalOrderId,
        paypalApprovalUrl: checkout.depositOrder.paypalApprovalUrl,
        publicStatusToken: checkout.depositOrder.publicStatusToken,
      },
    };
  }

  private normalizeIdempotencyKey(value?: string): string | undefined {
    const key = value?.trim();
    if (!key) return undefined;
    if (key.length > 100) {
      throw new BadRequestException('Idempotency-Key must be 100 characters or fewer');
    }
    return key;
  }

  // ── Bookings: Admin list ──

  async findBookingsAdmin(
    page = 1,
    size = 20,
    status?: string,
    q?: string,
    date?: string,
  ) {
    const qb = this.bookingRepo
      .createQueryBuilder('b')
      .orderBy('b.createdAt', 'DESC');

    if (status) {
      qb.andWhere('b.status = :status', { status });
    }
    if (q) {
      qb.andWhere(
        '(b.name ILIKE :q OR b.contact ILIKE :q OR b.city ILIKE :q)',
        { q: `%${q}%` },
      );
    }
    if (date) {
      qb.andWhere('b.serviceDate = :date', { date });
    }

    const [items, total] = await qb
      .skip((page - 1) * size)
      .take(size)
      .getManyAndCount();

    return { data: items, total, page: +page, pageSize: +size };
  }

  async findBookingByIdAdmin(id: string) {
    const booking = await this.bookingRepo.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async updateBookingStatus(id: string, status: string) {
    const booking = await this.findBookingByIdAdmin(id);
    const allowed = BOOKING_STATUS_TRANSITIONS[booking.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition booking from "${booking.status}" to "${status}"`,
      );
    }
    booking.status = status;
    return this.bookingRepo.save(booking);
  }

  async assignInterpreter(id: string, interpreterId: string) {
    const booking = await this.findBookingByIdAdmin(id);
    const interpreter = await this.findProfileByIdAdmin(interpreterId);
    const previousStatus = booking.status;
    booking.assignedInterpreterId = interpreter.id;
    booking.assignedInterpreterName = interpreter.name;
    // Assigning an interpreter means the engagement is settled, so move the
    // booking onto the confirmed track from any pre-confirmed state,
    // including the deposit flow (report P1-6: deposit_paid bookings used
    // to stay stuck after assignment).
    if (
      booking.status === 'new' ||
      booking.status === 'pending' ||
      booking.status === 'deposit_paid'
    ) {
      booking.status = 'confirmed';
    }
    const saved = await this.bookingRepo.save(booking);

    // The traveller is told only once the assignment is persisted, and only on
    // the transition *into* "confirmed" — re-assigning an interpreter to an
    // already-confirmed booking must not send a second confirmation.
    if (saved.status === 'confirmed' && previousStatus !== 'confirmed') {
      await this.sendBookingEmail(saved);
    }
    return saved;
  }

  private normalizeMode(
    data: Partial<ServiceMode>,
    fallback?: ServiceMode,
  ): Partial<ServiceMode> {
    return {
      sortOrder: data.sortOrder ?? fallback?.sortOrder ?? 0,
      title: data.title ?? fallback?.title ?? '',
      price: data.price ?? fallback?.price ?? '',
      bestFor: data.bestFor ?? fallback?.bestFor ?? '',
      body: data.body ?? fallback?.body ?? '',
      includes: data.includes ?? fallback?.includes ?? [],
      accent: data.accent ?? fallback?.accent ?? 'light',
      featured: data.featured ?? fallback?.featured ?? false,
      // P2-8: an explicit null clears the deposit; omitting it keeps the
      // existing value on update and defaults to null on create.
      depositCents:
        data.depositCents !== undefined
          ? data.depositCents
          : fallback
            ? fallback.depositCents
            : null,
    };
  }

  private normalizeProfile(
    data: Partial<InterpreterProfile>,
    fallback?: InterpreterProfile,
  ): Partial<InterpreterProfile> {
    return {
      sortOrder: data.sortOrder ?? fallback?.sortOrder ?? 0,
      name: data.name ?? fallback?.name ?? '',
      language: data.language ?? fallback?.language ?? '',
      focus: data.focus ?? fallback?.focus ?? '',
      helps: data.helps ?? fallback?.helps ?? [],
      avatar: data.avatar ?? fallback?.avatar ?? '',
      bio: data.bio ?? fallback?.bio ?? null,
      status: data.status ?? fallback?.status ?? 'pending_review',
      city: data.city ?? fallback?.city ?? '',
    };
  }

  private normalizeFaq(data: Partial<Faq>, fallback?: Faq): Partial<Faq> {
    return {
      sortOrder: data.sortOrder ?? fallback?.sortOrder ?? 0,
      question: data.question ?? fallback?.question ?? '',
      answer: data.answer ?? fallback?.answer ?? '',
      category: data.category ?? fallback?.category ?? 'interpreting',
    };
  }

  private async getNextSortOrder<T extends { sortOrder: number }>(
    repo: Repository<T>,
  ) {
    const top = await repo
      .createQueryBuilder('item')
      .orderBy('item.sortOrder', 'DESC')
      .limit(1)
      .getOne();
    return (top?.sortOrder ?? -1) + 1;
  }

  private async moveEntityToSortOrder<
    T extends { id: string; sortOrder: number },
  >(repo: Repository<T>, id: string, requestedSortOrder: number): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const target = repo.target;
      const items = await queryRunner.manager
        .createQueryBuilder<T>(target, 'item')
        .orderBy('item.sortOrder', 'ASC')
        .getMany();
      const currentIndex = items.findIndex((item) => item.id === id);
      if (currentIndex === -1) {
        throw new NotFoundException('Sorted entity not found');
      }

      const [current] = items.splice(currentIndex, 1);
      const safeIndex = Math.max(0, Math.min(requestedSortOrder, items.length));
      items.splice(safeIndex, 0, current);

      await this.resequenceSortOrder(queryRunner.manager, target, items);
      await queryRunner.commitTransaction();

      return queryRunner.manager.findOneOrFail(target, {
        where: { id } as any,
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async resequenceSortOrder<
    T extends { id: string; sortOrder: number },
  >(manager: EntityManager, target: EntityTarget<T>, items: T[]) {
    for (let index = 0; index < items.length; index += 1) {
      await manager
        .createQueryBuilder()
        .update(target)
        .set({ sortOrder: items.length + index + 1 })
        .where('id = :id', { id: items[index].id })
        .execute();
    }

    for (let index = 0; index < items.length; index += 1) {
      await manager
        .createQueryBuilder()
        .update(target)
        .set({ sortOrder: index })
        .where('id = :id', { id: items[index].id })
        .execute();
    }
  }

  /**
   * P2-8: deposit pricing. Priority order:
   * 1. fastTrack flat fee;
   * 2. the CMS deposit configured on the referenced service mode
   *    (depositCents, minor units) — the auditable, admin-controlled path;
   * 3. the legacy keyword heuristic on supportMode free text, kept as a
   *    fallback until every mode has a configured deposit.
   * An unknown serviceModeId is rejected outright instead of silently
   * degrading to the heuristic.
   */
  private async calculateDepositAmount(dto: CreateBookingDto): Promise<number> {
    if (dto.fastTrack) {
      return 90;
    }

    if (dto.serviceModeId) {
      const mode = await this.modeRepo.findOne({
        where: { id: dto.serviceModeId },
      });
      if (!mode) {
        throw new BadRequestException('Unknown serviceModeId');
      }
      if (mode.depositCents !== null && mode.depositCents !== undefined) {
        if (mode.depositCents < 0) {
          throw new BadRequestException(
            'Service mode deposit is misconfigured',
          );
        }
        return mode.depositCents / 100;
      }
    }

    const normalized = dto.supportMode.toLowerCase();
    if (normalized.includes('group') || normalized.includes('study')) {
      return 260;
    }
    if (normalized.includes('story') || normalized.includes('route')) {
      return 180;
    }
    return 120;
  }

  private describeDeposit(dto: CreateBookingDto): string {
    if (dto.fastTrack) {
      return 'Fast Track slot deposit';
    }

    const normalized = dto.supportMode.toLowerCase();
    if (normalized.includes('group') || normalized.includes('study')) {
      return 'Group visit interpreter deposit';
    }
    if (normalized.includes('story') || normalized.includes('route')) {
      return 'Story-led route interpreter deposit';
    }
    return 'City companion interpreter deposit';
  }

  private async notifyNewBooking(id: string, dto: CreateBookingDto) {
    await this.notificationsService.notifyStaff({
      type: 'booking',
      title: `新口译预约 · ${dto.city}`,
      body: `${dto.name} 计划于 ${dto.serviceDate} 使用 ${dto.supportMode} 服务。`,
      resourceType: 'booking',
      resourceId: id,
      link: '/admin/interpreting/bookings',
    });
  }

  // ─── Notification email ───────────────────────────────────────────

  /**
   * A booking carries only a free-form `contact`, which is often a phone
   * number — the confirmation email is therefore sent only when that value is
   * actually a mailbox, rather than bounced against a phone number.
   */
  private static isDeliverableEmail(value: string | null | undefined): boolean {
    if (!value) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
  }

  /** Short, human-readable booking reference derived from the row id. */
  private static bookingReference(booking: BookingSubmission): string {
    return `BK-${booking.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }

  /**
   * Sends the booking confirmation. Never throws — a mail failure must not
   * fail an admin assignment — and every attempt lands in the delivery log.
   */
  private async sendBookingEmail(
    booking: BookingSubmission,
  ): Promise<{ ok: boolean; message: string }> {
    const to = booking.contact?.trim() ?? '';
    if (!InterpretingService.isDeliverableEmail(to)) {
      return { ok: false, message: '该预约的联系方式不是邮箱地址，无法发送邮件。' };
    }

    const vars = {
      title: 'Booking confirmed',
      bookingReference: InterpretingService.bookingReference(booking),
      serviceName: booking.routeOrNeed?.trim() || booking.supportMode,
      scheduledAt: booking.serviceDate,
      siteName: 'Culvoy',
    };

    try {
      const sent = await this.mailerService.sendTemplated(
        'booking_confirmed',
        to,
        vars,
        'en',
        { resourceType: 'booking', resourceId: booking.id },
      );
      return sent
        ? { ok: true, message: `已发送至 ${to}。` }
        : { ok: false, message: '发送未成功，请在「发送日志」中查看原因。' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Booking confirmation for ${booking.id} failed: ${message}`,
      );
      return { ok: false, message: `发送失败：${message}` };
    }
  }

  /** Admin: re-send the confirmation email for an existing booking. */
  async resendBookingEmail(
    id: string,
  ): Promise<{ ok: boolean; message: string }> {
    const booking = await this.findBookingByIdAdmin(id);
    return this.sendBookingEmail(booking);
  }
}
