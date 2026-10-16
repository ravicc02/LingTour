import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
import { BookingSubmission } from '../interpreting/entities/booking-submission.entity';

const makeOrder = (overrides: Partial<Order> = {}): Order =>
  ({
    id: 'order-id',
    orderNo: 'LT123',
    totalAmount: 120,
    currency: 'SGD',
    status: 'pending',
    paymentStatus: 'unpaid',
    paymentId: null,
    paymentFailureReason: null,
    paidAt: null,
    bookingSubmissionId: 'booking-id',
    orderType: 'interpreting_deposit',
    ...overrides,
  }) as Order;

const paypalConfig = {
  get: jest.fn((key: string) =>
    key === 'PAYPAL_CLIENT_ID'
      ? 'test-client-id'
      : key === 'PAYPAL_CLIENT_SECRET'
        ? 'test-client-secret'
        : undefined,
  ),
};

const approveLink = {
  rel: 'approve',
  href: 'https://www.sandbox.paypal.com/checkoutnow?token=pp_123',
};

describe('OrdersService shop checkout', () => {
  it('prices from published products and persists immutable item snapshots', async () => {
    const product = {
      id: 'product-id',
      slug: 'tea-bowl',
      name: 'Tea Bowl',
      image: '/uploads/products/tea-bowl.webp',
      price: 32,
      currency: 'SGD',
      stock: 5,
    };
    const productRepo = { find: jest.fn().mockResolvedValue([product]) };
    const manager = {
      find: jest.fn().mockResolvedValue([product]),
      create: jest.fn((_entity, value) => ({ ...value, id: 'order-id' })),
      save: jest.fn(async (_entity, value) => value),
    };
    const orderRepo = {
      manager: { transaction: jest.fn((work) => work(manager)) },
    };
    const notifications = { notifyStaff: jest.fn() };
    const service = new OrdersService(
      orderRepo as any,
      productRepo as any,
      paypalConfig as any,
      notifications as any,
      { getAdminSettings: jest.fn().mockResolvedValue({ payload: {} }) } as any,
      { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );
    jest
      .spyOn(service as any, 'createPayPalOrder')
      .mockResolvedValue({ id: 'pp_123', links: [approveLink] });

    const result = await service.createOrder({
      guestEmail: 'guest@example.com',
      items: [{ productId: 'product-id', quantity: 2 }],
      shippingAddress: {
        recipientName: 'Guest',
        street: '1 Main Street',
        city: 'Singapore',
        state: 'Singapore',
        postalCode: '123456',
        country: 'Singapore',
      },
    });

    expect(manager.create).toHaveBeenCalledWith(
      Order,
      expect.objectContaining({
        items: [
          expect.objectContaining({
            productId: 'product-id',
            productName: 'Tea Bowl',
            quantity: 2,
            unitPrice: 32,
          }),
        ],
        subtotal: 64,
        handlingAmount: 8,
        totalAmount: 72,
        currency: 'SGD',
      }),
    );
    expect(result.totalAmount).toBe(72);
    expect(product.stock).toBe(3);
    expect(manager.save).toHaveBeenCalledWith(expect.anything(), [product]);
    expect(manager.create).toHaveBeenCalledWith(
      Order,
      expect.objectContaining({ stockReserved: true }),
    );
    expect(result.publicStatusToken).toEqual(expect.any(String));
    expect(result.publicStatusToken).toHaveLength(43);
    expect(manager.create).toHaveBeenCalledWith(
      Order,
      expect.objectContaining({
        publicStatusTokenHash: createHash('sha256')
          .update(result.publicStatusToken)
          .digest('hex'),
      }),
    );
    expect(result.paymentMethod).toBe('paypal');
    expect(result.paypalOrderId).toBe('pp_123');
    expect(result.paypalApprovalUrl).toBe(approveLink.href);
    expect(manager.save).toHaveBeenLastCalledWith(
      Order,
      expect.objectContaining({ paymentMethod: 'paypal', paymentId: 'pp_123' }),
    );
  });

  it('rejects unavailable products instead of trusting request prices', async () => {
    const service = new OrdersService(
      {
        manager: {
          transaction: jest.fn((work) =>
            work({ find: jest.fn().mockResolvedValue([]) }),
          ),
        },
      } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { get: jest.fn().mockReturnValue(undefined) } as any,
      {} as any,
      { getAdminSettings: jest.fn().mockResolvedValue({ payload: {} }) } as any,
      { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );

    await expect(
      service.createOrder({
        guestEmail: 'guest@example.com',
        items: [{ productId: 'missing-product', quantity: 1 }],
        shippingAddress: {} as any,
      }),
    ).rejects.toThrow('One or more products are unavailable');
  });
  it('rejects PayPal checkout when PayPal credentials are not configured', async () => {
    const product = {
      id: 'product-id',
      slug: 'tea-bowl',
      name: { en: 'Tea Bowl', zh: '茶碗' },
      image: '/uploads/products/tea-bowl.webp',
      price: 32,
      currency: 'SGD',
      stock: 5,
    };
    const manager = {
      find: jest.fn().mockResolvedValue([product]),
      create: jest.fn((_entity, value) => ({ ...value, id: 'order-id' })),
      save: jest.fn(async (_entity, value) => value),
    };
    const service = new OrdersService(
      { manager: { transaction: jest.fn((work) => work(manager)) } } as any,
      { find: jest.fn().mockResolvedValue([product]) } as any,
      { get: jest.fn().mockReturnValue(undefined) } as any,
      { notifyStaff: jest.fn() } as any,
      { getAdminSettings: jest.fn().mockResolvedValue({ payload: {} }) } as any,
      { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );

    await expect(
      service.createOrder({
        guestEmail: 'guest@example.com',
        items: [{ productId: 'product-id', quantity: 1 }],
        shippingAddress: {
          recipientName: 'Guest',
          street: '1 Main Street',
          city: 'Singapore',
          state: 'Singapore',
          postalCode: '123456',
          country: 'Singapore',
        },
      }),
    ).rejects.toThrow('PayPal checkout is not configured');
  });
});

describe('OrdersService stock reservations', () => {
  it('releases reserved stock when payment fails', async () => {
    const order = makeOrder({
      orderType: 'shop',
      items: [
        {
          productId: 'product-id',
          productName: 'Tea Bowl',
          productImage: '',
          quantity: 2,
          unitPrice: 32,
        },
      ],
      stockReserved: true,
    });
    const manager = {
      findOne: jest.fn().mockResolvedValue(order),
      increment: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(order),
    };
    const service = new OrdersService(
      { manager: { transaction: jest.fn((work) => work(manager)) } } as any,
      {} as any,
      { get: jest.fn() } as any,
      {} as any,
      { getAdminSettings: jest.fn().mockResolvedValue({ payload: {} }) } as any,
      { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );

    await service.markPaymentFailed(order.orderNo, 'declined');

    expect(manager.increment).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'product-id' },
      'stock',
      2,
    );
    expect(order.stockReserved).toBe(false);
  });
});

describe('OrdersService public status', () => {
  const token = 'public-status-token';
  const hash = createHash('sha256').update(token).digest('hex');

  it('returns only limited status fields for the correct capability token', async () => {
    const order = makeOrder({
      publicStatusTokenHash: hash,
      paymentMethod: 'paypal',
      orderType: 'shop',
      items: [
        {
          productId: 'product-id',
          productName: 'Tea Bowl',
          productImage: '/tea.webp',
          quantity: 1,
          unitPrice: 120,
        },
      ],
      guestEmail: 'guest@example.com',
      shippingAddr: { street: 'Private address' },
    });
    const service = new OrdersService(
      { findOne: jest.fn().mockResolvedValue(order) } as any,
      {} as any,
      { get: jest.fn() } as any,
      {} as any,
      { getAdminSettings: jest.fn().mockResolvedValue({ payload: {} }) } as any,
      { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );

    const result = await service.findPublicStatus(order.orderNo, token);

    expect(result).toEqual({
      orderNo: 'LT123',
      status: 'pending',
      paymentStatus: 'unpaid',
      paymentMethod: 'paypal',
      totalAmount: 120,
      currency: 'SGD',
      orderType: 'shop',
    });
    expect(result).not.toHaveProperty('guestEmail');
    expect(result).not.toHaveProperty('shippingAddr');
    expect(result).not.toHaveProperty('items');
    expect(result).not.toHaveProperty('paymentId');
  });

  it('rejects an incorrect capability token without returning the order', async () => {
    const service = new OrdersService(
      {
        findOne: jest
          .fn()
          .mockResolvedValue(
            makeOrder({ publicStatusTokenHash: hash, orderType: 'shop' }),
          ),
      } as any,
      {} as any,
      { get: jest.fn() } as any,
      {} as any,
      { getAdminSettings: jest.fn().mockResolvedValue({ payload: {} }) } as any,
      { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );

    await expect(
      service.findPublicStatus('LT123', 'wrong-token'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('OrdersService interpreting deposits', () => {
  it('refuses deposit checkout when PayPal is not configured', async () => {
    const service = new OrdersService(
      {} as any,
      {} as any,
      { get: jest.fn().mockReturnValue(undefined) } as any,
      {} as any,
      { getAdminSettings: jest.fn().mockResolvedValue({ payload: {} }) } as any,
      { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );

    await expect(
      service.createInterpretingDeposit(
        {
          bookingSubmissionId: 'booking-id',
          name: 'Guest',
          contact: 'guest@example.com',
          city: 'Zhanjiang',
          serviceDate: '2026-08-01',
          supportMode: 'City companion support',
          depositAmount: 120,
        },
        {} as any,
      ),
    ).rejects.toThrow('Deposit payment is temporarily unavailable');
  });

  it('creates the PayPal checkout and persists the payment binding', async () => {
    const manager = {
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (_entity, value) => value),
    };
    const service = new OrdersService(
      {} as any,
      {} as any,
      paypalConfig as any,
      {} as any,
      { getAdminSettings: jest.fn().mockResolvedValue({ payload: {} }) } as any,
      { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );
    jest
      .spyOn(service as any, 'createPayPalOrder')
      .mockResolvedValue({ id: 'pp_123', links: [approveLink] });
    jest.spyOn(Date, 'now').mockReturnValue(1);
    jest.spyOn(Math, 'random').mockReturnValue(0.1);

    const result = await service.createInterpretingDeposit(
      {
        bookingSubmissionId: 'booking-id',
        name: 'Guest',
        contact: 'guest@example.com',
        city: 'Zhanjiang',
        serviceDate: '2026-08-01',
        supportMode: 'City companion support',
        depositAmount: 120,
        currency: 'CNY',
        interpretationPackage: { id: 'custom-5h', hours: 5, routeType: 'custom',
          currency: 'USD', priceCents: 50000, title: '5-hour interpretation — Custom route' },
      },
      manager as any,
    );

    expect(manager.create).toHaveBeenCalledWith(
      Order,
      expect.objectContaining({
        bookingSubmissionId: 'booking-id',
        orderType: 'interpreting_deposit',
        currency: 'USD',
        paymentMethod: 'paypal',
        publicStatusTokenHash: expect.any(String),
      }),
    );
    expect(result.currency).toBe('USD');
    expect(manager.create).toHaveBeenCalledWith(Order, expect.objectContaining({
      shippingAddr: expect.objectContaining({
        currency: 'USD', interpretationPackage: expect.objectContaining({ priceCents: 50000, currency: 'USD' }),
      }),
    }));
    expect(result.publicStatusToken).toEqual(expect.any(String));
    expect(result.publicStatusToken).toHaveLength(43);
    expect(manager.create).toHaveBeenCalledWith(
      Order,
      expect.objectContaining({
        publicStatusTokenHash: createHash('sha256')
          .update(result.publicStatusToken)
          .digest('hex'),
      }),
    );
    expect(result.paypalOrderId).toBe('pp_123');
    expect(result.paypalApprovalUrl).toBe(approveLink.href);
    expect(manager.save).toHaveBeenLastCalledWith(
      Order,
      expect.objectContaining({ paymentId: 'pp_123' }),
    );
  });
});

describe('OrdersService PayPal capture', () => {
  const fetchMock = (captureBody: Record<string, any>) =>
    jest.fn().mockImplementation((url: string) => {
      if (url.includes('/v1/oauth2/token')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ access_token: 'paypal-token' }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => captureBody });
    });

  it('rejects a captured payment whose amount does not match the bound order', async () => {
    const order = makeOrder({
      orderType: 'shop',
      paymentId: 'pp_123',
      paymentMethod: 'paypal',
    });
    const repository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(order),
    };
    const service = new OrdersService(
      repository as any,
      {} as any,
      paypalConfig as any,
      {} as any,
      { getAdminSettings: jest.fn().mockResolvedValue({ payload: {} }) } as any,
      { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(
        fetchMock({
          id: 'pp_123',
          status: 'COMPLETED',
          purchase_units: [
            {
              reference_id: 'LT123',
              custom_id: 'order-id',
              payments: {
                captures: [
                  {
                    id: 'cap_1',
                    status: 'COMPLETED',
                    amount: { currency_code: 'SGD', value: '100.00' },
                  },
                ],
              },
            },
          ],
        }) as any,
      );

    await expect(service.capturePayPalOrder('pp_123')).rejects.toThrow(
      'PayPal payment amount does not match order',
    );
  });

  it('rejects a capture linked to a different order or payment id', async () => {
    const order = makeOrder({
      orderType: 'shop',
      paymentId: 'pp_other',
      paymentMethod: 'paypal',
    });
    const repository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(order),
    };
    const service = new OrdersService(
      repository as any,
      {} as any,
      paypalConfig as any,
      {} as any,
      { getAdminSettings: jest.fn().mockResolvedValue({ payload: {} }) } as any,
      { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(
        fetchMock({
          id: 'pp_123',
          status: 'COMPLETED',
          purchase_units: [
            {
              reference_id: 'LT999',
              custom_id: 'order-id',
              payments: {
                captures: [
                  {
                    id: 'cap_1',
                    status: 'COMPLETED',
                    amount: { currency_code: 'SGD', value: '120.00' },
                  },
                ],
              },
            },
          ],
        }) as any,
      );

    await expect(service.capturePayPalOrder('pp_123')).rejects.toThrow(
      'PayPal payment is not linked to this order',
    );
  });
});

describe('OrdersService payment completion', () => {
  it.each([
    ['pending', 'confirmed'],
    ['shipped', 'delivered'],
    ['pending', 'cancelled'],
  ] as const)('preserves valid %s to %s transitions', async (status, next) => {
    const order = makeOrder({ status, paymentStatus: 'paid', stockReserved: false });
    const manager = {
      findOne: jest.fn().mockResolvedValue(order),
      save: jest.fn(async (_entity, value) => value),
    };
    const service = new OrdersService(
      { manager: { transaction: (work: any) => work(manager) } } as any,
      {} as any, paypalConfig as any, {} as any, {} as any, {} as any,
    );
    await expect(service.updateStatusAdmin(order.id, next)).resolves.toMatchObject({
      status: next,
      paymentStatus: 'paid',
    });
  });

  it('ships a paid confirmed order and sends the shipping notification', async () => {
    const order = makeOrder({
      status: 'confirmed', paymentStatus: 'paid', guestEmail: 'buyer@example.com',
    });
    const manager = {
      findOne: jest.fn().mockResolvedValue(order),
      save: jest.fn(async (_entity, value) => value),
    };
    const mailer = { sendTemplated: jest.fn().mockResolvedValue(true) };
    const service = new OrdersService(
      { manager: { transaction: (work: any) => work(manager) } } as any,
      {} as any, paypalConfig as any, {} as any, {} as any, mailer as any,
    );
    await expect(service.shipOrder(order.id, 'TRACK1')).resolves.toMatchObject({
      status: 'shipped', trackingNo: 'TRACK1',
    });
    expect(mailer.sendTemplated).toHaveBeenCalledWith(
      'order_shipped', 'buyer@example.com',
      expect.objectContaining({ trackingNo: 'TRACK1' }), 'en',
      expect.objectContaining({ resourceId: order.id }),
    );
  });

  it('cancels an unpaid reserved order and releases its stock', async () => {
    const order = makeOrder({
      stockReserved: true,
      items: [{ productId: 'p1', quantity: 2 } as any],
    });
    const manager = {
      findOne: jest.fn().mockResolvedValue(order),
      increment: jest.fn(),
      save: jest.fn(async (_entity, value) => value),
    };
    const service = new OrdersService(
      { manager: { transaction: (work: any) => work(manager) } } as any,
      {} as any, paypalConfig as any, {} as any, {} as any, {} as any,
    );
    await expect(service.updateStatusAdmin(order.id, 'cancelled')).resolves.toMatchObject({
      status: 'cancelled', stockReserved: false,
    });
    expect(manager.increment).toHaveBeenCalledWith(
      expect.anything(), { id: 'p1' }, 'stock', 2,
    );
  });

  describe('PayPal capture recovery', () => {
    afterEach(() => jest.restoreAllMocks());

    it.each([
      'already-captured', 'lost-response', 'paid-replay', 'refunded-replay',
      'wrong-amount', 'wrong-currency', 'wrong-binding', 'incomplete',
    ] as const)(
      'reconciles a %s capture using verified gateway details',
      async (scenario) => {
        const order = makeOrder({
          orderType: 'shop',
          paymentMethod: 'paypal',
          paymentId: scenario === 'paid-replay' || scenario === 'refunded-replay'
            ? 'cap_1' : 'pp_123',
          paymentStatus: scenario === 'paid-replay' ? 'paid'
            : scenario === 'refunded-replay' ? 'refunded' : 'unpaid',
        });
        const repository = {
          findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(order),
        };
        const service = new OrdersService(
          repository as any, {} as any, paypalConfig as any,
          {} as any, {} as any, {} as any,
        );
        const markPaid = jest.spyOn(service, 'markPaid').mockResolvedValue(order);
        const gateway = {
          id: 'pp_123', status: 'COMPLETED',
          purchase_units: [{
            reference_id: 'LT123', custom_id: 'order-id',
            payments: { captures: [{
              id: 'cap_1', status: 'COMPLETED',
              amount: { currency_code: 'SGD', value: '120.00' },
            }] },
          }],
        };
        const unit = gateway.purchase_units[0]!;
        const capture = unit.payments.captures[0]!;
        if (scenario === 'wrong-amount') capture.amount.value = '1.00';
        if (scenario === 'wrong-currency') capture.amount.currency_code = 'USD';
        if (scenario === 'wrong-binding') unit.reference_id = 'another-order';
        if (scenario === 'incomplete') gateway.status = 'APPROVED';
        const fetch = jest.spyOn(global, 'fetch').mockImplementation(async (url, options) => {
          if (String(url).includes('/oauth2/token')) {
            return { ok: true, json: async () => ({ access_token: 'mock' }) } as Response;
          }
          if (options?.method === 'POST') {
            if (scenario === 'lost-response') throw new Error('Connection reset');
            return {
              ok: false,
              json: async () => ({ details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] }),
            } as Response;
          }
          return { ok: true, json: async () => gateway } as Response;
        });
        if (scenario.startsWith('wrong-') || scenario === 'incomplete') {
          await expect(service.capturePayPalOrder('pp_123')).rejects.toBeInstanceOf(
            BadRequestException,
          );
          expect(markPaid).not.toHaveBeenCalled();
          return;
        }
        await expect(service.capturePayPalOrder('pp_123')).resolves.toBe(order);
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/v2/checkout/orders/pp_123'),
          expect.objectContaining({ method: 'GET' }),
        );
        if (scenario === 'refunded-replay') {
          expect(markPaid).not.toHaveBeenCalled();
        } else {
          expect(markPaid).toHaveBeenCalledWith('LT123', 'cap_1');
        }
      },
    );
  });

  it.each(['confirmed', 'shipped', 'delivered'] as const)(
    'rejects generic fulfilment transition to %s',
    async (next) => {
      const order = makeOrder({
        status: next === 'confirmed' ? 'pending' : next === 'shipped' ? 'confirmed' : 'shipped',
        paymentStatus: 'unpaid',
      });
      const manager = {
        findOne: jest.fn().mockResolvedValue(order),
        save: jest.fn(),
      };
      const service = new OrdersService(
        { manager: { transaction: (work: any) => work(manager) } } as any,
        {} as any, paypalConfig as any, {} as any, {} as any, {} as any,
      );
      await expect(service.updateStatusAdmin(order.id, next)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(manager.save).not.toHaveBeenCalled();
    },
  );

  it.each(['unpaid', 'paid'] as const)(
    'requires the dedicated shipping endpoint even for %s orders',
    async (paymentStatus) => {
      const order = makeOrder({ status: 'confirmed', paymentStatus });
      const manager = { findOne: jest.fn().mockResolvedValue(order), save: jest.fn() };
      const service = new OrdersService(
        { manager: { transaction: (work: any) => work(manager) } } as any,
        {} as any, paypalConfig as any, {} as any, {} as any, {} as any,
      );
      await expect(service.updateStatusAdmin(order.id, 'shipped')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it('does not downgrade a paid order when a late failure event arrives', async () => {
    const order = makeOrder({ paymentStatus: 'paid', status: 'confirmed' });
    const manager = {
      findOne: jest.fn().mockResolvedValue(order),
      save: jest.fn(),
    };
    const service = new OrdersService(
      { manager: { transaction: jest.fn((work) => work(manager)) } } as any,
      {} as any,
      { get: jest.fn().mockReturnValue(undefined) } as any,
      {} as any,
      { getAdminSettings: jest.fn().mockResolvedValue({ payload: {} }) } as any,
      { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );

    const result = await service.markPaymentFailed('LT123', 'late failure');

    expect(result.paymentStatus).toBe('paid');
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('atomically marks the bound order and booking paid', async () => {
    const order = makeOrder();
    const booking = {
      id: 'booking-id',
      status: 'deposit_pending',
    } as BookingSubmission;
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(order)
        .mockResolvedValueOnce(booking),
      save: jest.fn(async (_entity, value) => value),
    };
    const repository = {
      manager: { transaction: jest.fn((work) => work(manager)) },
    };
    const service = new OrdersService(
      repository as any,
      {} as any,
      { get: jest.fn().mockReturnValue(undefined) } as any,
      {} as any,
      { getAdminSettings: jest.fn().mockResolvedValue({ payload: {} }) } as any,
      { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );

    const result = await service.markPaid('LT123', 'cap_123');

    expect(result).toBe(order);
    expect(order.paymentStatus).toBe('paid');
    expect(order.status).toBe('confirmed');
    expect(order.paymentId).toBe('cap_123');
    expect(booking.status).toBe('deposit_paid');
    expect(manager.save).toHaveBeenCalledWith(Order, order);
    expect(manager.save).toHaveBeenCalledWith(BookingSubmission, booking);
  });

  it('stays idempotent for an already paid deposit order without re-promoting the booking', async () => {
    const order = makeOrder({
      paymentStatus: 'paid',
      status: 'confirmed',
      paymentId: 'cap_123',
    });
    const booking = {
      id: 'booking-id',
      status: 'deposit_pending',
    } as BookingSubmission;
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(order)
        .mockResolvedValueOnce(booking),
      save: jest.fn(async (_entity, value) => value),
    };
    const repository = {
      manager: { transaction: jest.fn((work) => work(manager)) },
    };
    const service = new OrdersService(
      repository as any,
      {} as any,
      { get: jest.fn().mockReturnValue(undefined) } as any,
      {} as any,
      { getAdminSettings: jest.fn().mockResolvedValue({ payload: {} }) } as any,
      { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );

    const result = await service.markPaid('LT123', 'cap_123');

    expect(result).toBe(order);
    expect(booking.status).toBe('deposit_paid');
    expect(manager.save).not.toHaveBeenCalledWith(Order, order);
    expect(manager.save).toHaveBeenCalledWith(BookingSubmission, booking);
  });

  it('refuses to complete a deposit order that is not linked to a booking', async () => {
    const order = makeOrder({ bookingSubmissionId: null });
    const manager = {
      findOne: jest.fn().mockResolvedValue(order),
      save: jest.fn(),
    };
    const repository = {
      manager: { transaction: jest.fn((work) => work(manager)) },
    };
    const service = new OrdersService(
      repository as any,
      {} as any,
      { get: jest.fn().mockReturnValue(undefined) } as any,
      {} as any,
      { getAdminSettings: jest.fn().mockResolvedValue({ payload: {} }) } as any,
      { sendTemplated: jest.fn().mockResolvedValue(true) } as any,
    );

    await expect(service.markPaid('LT123', 'cap_123')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    // The in-transaction order save is rolled back when the booking guard throws.
    expect(manager.save).not.toHaveBeenCalledWith(
      BookingSubmission,
      expect.anything(),
    );
  });
});

describe('OrdersService order notifications', () => {
  const buildService = (patch: Record<string, unknown> = {}) => {
    const order = {
      id: 'order-id',
      orderNo: 'LTABC123',
      guestEmail: 'traveller@example.com',
      currency: 'SGD',
      totalAmount: 100,
      status: 'pending',
      paymentStatus: 'unpaid',
      trackingNo: null,
      orderType: 'shop',
      ...patch,
    };
    const manager = {
      findOne: jest.fn().mockResolvedValue(order),
      save: jest.fn(async (_entity: unknown, value: unknown) => value),
    };
    const orderRepo = {
      manager: { transaction: jest.fn((work) => work(manager)) },
      findOne: jest.fn().mockResolvedValue(order),
    };
    const mailer = { sendTemplated: jest.fn().mockResolvedValue(true) };
    const service = new OrdersService(
      orderRepo as any,
      {} as any,
      {} as any,
      { notifyStaff: jest.fn() } as any,
      { getAdminSettings: jest.fn() } as any,
      mailer as any,
    );
    return { service, mailer, order };
  };

  it('sends the receipt once, on the transition into paid', async () => {
    const { service, mailer } = buildService();

    await service.markPaid('LTABC123', 'capture-1');

    expect(mailer.sendTemplated).toHaveBeenCalledTimes(1);
    expect(mailer.sendTemplated).toHaveBeenCalledWith(
      'order_paid',
      'traveller@example.com',
      expect.objectContaining({ orderNumber: 'LTABC123' }),
      'en',
      { resourceType: 'order', resourceId: 'order-id' },
    );
  });

  it('does not re-send the receipt when the capture is replayed', async () => {
    const { service, mailer } = buildService({ paymentStatus: 'paid' });

    await service.markPaid('LTABC123', 'capture-1');

    expect(mailer.sendTemplated).not.toHaveBeenCalled();
  });

  it('skips a phone-derived placeholder address instead of bouncing to it', async () => {
    const { service, mailer } = buildService({
      guestEmail: '13800138000@culvoy.local',
    });

    await service.markPaid('LTABC123', 'capture-1');

    expect(mailer.sendTemplated).not.toHaveBeenCalled();
  });

  it('refuses to re-send an event the order flow never emits', async () => {
    const { service } = buildService();

    await expect(
      service.resendOrderEmail('order-id', 'welcome'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
