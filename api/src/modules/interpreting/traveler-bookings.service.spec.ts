import { UnauthorizedException } from '@nestjs/common';
import { TravelerBookingsService } from './traveler-bookings.service';

describe('TravelerBookingsService', () => {
  const bookingRepo = {
    findAndCount: jest.fn(),
  };
  const service = new TravelerBookingsService(bookingRepo as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns bookings matched to the authenticated email', async () => {
    bookingRepo.findAndCount.mockResolvedValue([[{ id: 'booking-1' }], 1]);

    const result = await service.findForTraveler(
      ' Traveler@Example.com ',
      2,
      5,
    );

    expect(bookingRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { createdAt: 'DESC' },
        skip: 5,
        take: 5,
      }),
    );
    const options = bookingRepo.findAndCount.mock.calls[0][0];
    expect(options.where.contact.objectLiteralParameters).toEqual({
      travelerEmail: 'traveler@example.com',
    });
    expect(options.where.contact.type).toBe('raw');
    expect(result).toEqual({
      items: [{ id: 'booking-1' }],
      total: 1,
      page: 2,
      pageSize: 5,
      totalPages: 1,
    });
  });

  it('treats email wildcard characters literally in the ownership predicate', async () => {
    bookingRepo.findAndCount.mockResolvedValue([[], 0]);
    await service.findForTraveler('A_B%tag@example.com');
    const predicate = bookingRepo.findAndCount.mock.calls[0][0].where.contact;
    expect(predicate.type).toBe('raw');
    expect(predicate.getSql('booking.contact')).toBe(
      'LOWER(booking.contact) = :travelerEmail',
    );
    expect(predicate.objectLiteralParameters).toEqual({
      travelerEmail: 'a_b%tag@example.com',
    });
  });

  it('clamps pagination values', async () => {
    bookingRepo.findAndCount.mockResolvedValue([[], 0]);

    const result = await service.findForTraveler('a@example.com', -4, 500);

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
  });

  it('rejects requests without an authenticated email', async () => {
    await expect(service.findForTraveler(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(bookingRepo.findAndCount).not.toHaveBeenCalled();
  });
});
