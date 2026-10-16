jest.mock('uuid', () => ({ v4: () => 'test-order-id' }));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { InterpretingService } from './interpreting.service';

describe('InterpretingService public profiles', () => {
  it('keeps active profiles without avatars so the frontend can render its fallback', async () => {
    const profiles = [
      { id: 'with-avatar', avatar: '/uploads/interpreting/guide.webp' },
      { id: 'without-avatar', avatar: '' },
    ];
    const modeRepo = { find: jest.fn().mockResolvedValue([]) };
    const profileRepo = { find: jest.fn().mockResolvedValue(profiles) };
    const faqRepo = { find: jest.fn().mockResolvedValue([]) };
    const service = new InterpretingService(
      modeRepo as any,
      profileRepo as any,
      faqRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );

    const result = await service.getPublicPageData();

    expect(result.profiles).toEqual(profiles);
  });

  it('creates the booking and bound deposit order inside one transaction', async () => {
    const booking = {
      id: 'booking-id',
      status: 'deposit_pending',
      createdAt: new Date('2026-07-27T00:00:00Z'),
    };
    const manager = {
      create: jest.fn((_entity, value) => ({ ...value, id: 'booking-id' })),
      save: jest.fn().mockResolvedValue(booking),
    };
    const dataSource = { transaction: jest.fn((work) => work(manager)) };
    const ordersService = {
      createInterpretingDeposit: jest.fn().mockResolvedValue({
        orderNo: 'LT123',
        totalAmount: 120,
        currency: 'SGD',
        status: 'pending',
        paypalOrderId: 'pp_123',
        paypalApprovalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=pp_123',
      }),
    };
    const notificationsService = { notifyStaff: jest.fn() };
    const service = new InterpretingService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      ordersService as any,
      notificationsService as any,
      dataSource as any,
      { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );

    const result = await service.submitBookingWithDeposit({
      name: 'Guest',
      contact: 'guest@example.com',
      city: 'Zhanjiang',
      serviceDate: '2026-08-01',
      supportMode: 'City companion support',
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(ordersService.createInterpretingDeposit).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingSubmissionId: 'booking-id',
        depositAmount: 120,
      }),
      manager,
    );
    expect(result.bookingId).toBe('booking-id');
  });

  it('does not notify staff when the transactional deposit checkout fails', async () => {
    const notificationsService = { notifyStaff: jest.fn() };
    const service = new InterpretingService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      notificationsService as any,
      {
        transaction: jest.fn().mockRejectedValue(new Error('paypal failed')),
      } as any,
      { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );

    await expect(
      service.submitBookingWithDeposit({
        name: 'Guest',
        contact: 'guest@example.com',
        city: 'Zhanjiang',
        serviceDate: '2026-08-01',
        supportMode: 'City companion support',
      }),
    ).rejects.toThrow('paypal failed');
    expect(notificationsService.notifyStaff).not.toHaveBeenCalled();
  });

  it('rejects a duplicate booking idempotency key before creating another booking', async () => {
    const bookingRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'existing-booking' }),
      create: jest.fn(),
      save: jest.fn(),
    };
    const service = new InterpretingService(
      {} as any,
      {} as any,
      {} as any,
      bookingRepo as any,
      {} as any,
      {} as any,
      {} as any,
      { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );

    await expect(
      service.submitBookingWithDeposit(
        {
          name: 'Guest',
          contact: 'guest@example.com',
          city: 'Zhanjiang',
          serviceDate: '2026-08-01',
          supportMode: 'City companion support',
        },
        'booking-key-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(bookingRepo.create).not.toHaveBeenCalled();
  });
});

describe('InterpretingService booking workflow', () => {
  const buildService = (booking: Record<string, unknown>) => {
    const bookingRepo = {
      findOne: jest.fn().mockResolvedValue(booking),
      save: jest.fn().mockImplementation(async (b) => b),
    };
    const service = new InterpretingService(
      {} as any,
      {} as any,
      {} as any,
      bookingRepo as any,
      {} as any,
      {} as any,
      {} as any,
      { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );
    return { service, bookingRepo };
  };

  it('allows a legal transition and persists the new status', async () => {
    const { service } = buildService({ id: 'b1', status: 'new' });
    const saved = await service.updateBookingStatus('b1', 'contacted');
    expect(saved.status).toBe('contacted');
  });

  it('rejects transitions outside the booking state machine', async () => {
    const { service } = buildService({ id: 'b1', status: 'completed' });
    await expect(
      service.updateBookingStatus('b1', 'confirmed'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps deposit workflow statuses reachable', async () => {
    const { service } = buildService({ id: 'b1', status: 'deposit_pending' });
    const saved = await service.updateBookingStatus('b1', 'deposit_paid');
    expect(saved.status).toBe('deposit_paid');
  });

  it('advances a deposit_paid booking to confirmed when assigning an interpreter', async () => {
    const profileRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'i1', name: 'Lin' }),
    };
    const bookingRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'b1', status: 'deposit_paid' }),
      save: jest.fn().mockImplementation(async (b) => b),
    };
    const service = new InterpretingService(
      {} as any,
      profileRepo as any,
      {} as any,
      bookingRepo as any,
      {} as any,
      {} as any,
      {} as any,
      { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );

    const saved = await service.assignInterpreter('b1', 'i1');
    expect(saved.status).toBe('confirmed');
    expect(saved.assignedInterpreterId).toBe('i1');
  });
});


describe('USD interpretation packages', () => {
  function setup() {
    const manager = {
      create: jest.fn((_entity, value) => ({ ...value, id: 'package-booking' })),
      save: jest.fn().mockResolvedValue({ id: 'package-booking', status: 'deposit_pending' }),
    };
    const orders = { createInterpretingDeposit: jest.fn().mockResolvedValue({
      orderNo: 'USD1', totalAmount: 180, currency: 'USD', status: 'pending',
    }) };
    const transaction = jest.fn((work) => work(manager));
    const service = new InterpretingService(
      { find: jest.fn().mockResolvedValue([]) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      {} as any, orders as any, { notifyStaff: jest.fn() } as any,
      { transaction } as any, { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );
    return { service, manager, orders, transaction };
  }
  const request = { name: 'Guest', contact: 'guest@example.com', city: 'Guangzhou',
    serviceDate: '2026-11-01', supportMode: 'client-supplied label' };
  it('publishes the six approved dollar prices from one server catalogue', async () => {
    const { service } = setup();
    const result = await service.getPublicPageData();
    expect(result.packages.map((item: any) => [item.hours, item.routeType, item.priceCents, item.currency]))
      .toEqual([[4,'fixed',30500,'USD'],[4,'custom',40000,'USD'],[5,'fixed',37500,'USD'],
        [5,'custom',50000,'USD'],[7,'fixed',52500,'USD'],[7,'custom',70000,'USD']]);
  });
  it('ignores client pricing and stores the server package snapshot', async () => {
    const { service, manager, orders } = setup();
    const result = await service.submitBookingWithDeposit({
      ...request, packageId: 'fixed-4h', amount: 1, currency: 'CNY',
    } as any);
    expect(orders.createInterpretingDeposit).toHaveBeenCalledWith(expect.objectContaining({
      currency: 'USD', depositAmount: 180, supportMode: '4-hour interpretation — Fixed route',
      interpretationPackage: expect.objectContaining({ id: 'fixed-4h', priceCents: 30500, currency: 'USD' }),
    }), manager);
    expect(manager.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      supportMode: '4-hour interpretation — Fixed route',
    }));
    expect(result.package?.priceCents).toBe(30500);
    expect(result.deposit.currency).toBe('USD');
  });
  it('rejects an invalid package before persistence even with fast track', async () => {
    const { service, transaction, orders } = setup();
    await expect(service.submitBookingWithDeposit({ ...request, packageId: 'fake', fastTrack: true }))
      .rejects.toThrow(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
    expect(orders.createInterpretingDeposit).not.toHaveBeenCalled();
  });
  it('prices new legacy requests in USD with their existing numeric deposit', async () => {
    const { service, manager, orders } = setup();
    await service.submitBookingWithDeposit({ ...request, supportMode: 'City companion support' });
    expect(orders.createInterpretingDeposit).toHaveBeenCalledWith(expect.objectContaining({ currency: 'USD', depositAmount: 120 }), manager);
  });
});
