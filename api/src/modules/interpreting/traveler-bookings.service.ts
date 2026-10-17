import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Raw, Repository } from 'typeorm';
import { BookingSubmission } from './entities/booking-submission.entity';

@Injectable()
export class TravelerBookingsService {
  constructor(
    @InjectRepository(BookingSubmission)
    private readonly bookingRepo: Repository<BookingSubmission>,
  ) {}

  async findForTraveler(email: string | undefined, page = 1, pageSize = 12) {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new UnauthorizedException('Authenticated email is required');
    }

    const safePage = Math.max(1, Math.floor(page) || 1);
    const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize) || 12));
    const [items, total] = await this.bookingRepo.findAndCount({
      where: {
        contact: Raw((alias) => `LOWER(${alias}) = :travelerEmail`, {
          travelerEmail: normalizedEmail,
        }),
      },
      select: {
        id: true,
        city: true,
        serviceDate: true,
        supportMode: true,
        groupSize: true,
        routeOrNeed: true,
        status: true,
        assignedInterpreterName: true,
        createdAt: true,
        updatedAt: true,
      },
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    });

    return {
      items,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
    };
  }
}
