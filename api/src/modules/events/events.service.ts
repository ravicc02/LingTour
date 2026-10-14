import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { clampPagination } from '../../common/pagination';
import {
  EVENT_STATUSES,
  EventEntity,
  type EventStatus,
} from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly repo: Repository<EventEntity>,
  ) {}

  async listPublic(query: {
    city?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const { page, limit } = clampPagination(query.page, query.limit);
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.status != :draft', { draft: 'draft' });
    if (query.city)
      qb.andWhere('(e.citySlug = :city OR e.city = :city)', {
        city: query.city,
      });
    if (query.startDate)
      qb.andWhere('e.date >= :startDate', { startDate: query.startDate });
    if (query.endDate)
      qb.andWhere('e.date <= :endDate', { endDate: query.endDate });
    const [items, total] = await qb
      .orderBy('e.date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data: items, total, page, pageSize: limit };
  }

  async getPublicBySlug(slug: string) {
    const item = await this.repo.findOne({ where: { slug } });
    if (!item || item.status === 'draft')
      throw new NotFoundException('Event not found');
    return item;
  }

  async listAdmin(query: {
    status?: string;
    city?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const qb = this.repo.createQueryBuilder('e');
    if (query.status) qb.andWhere('e.status = :status', { status: query.status });
    if (query.city) qb.andWhere('e.citySlug = :city', { city: query.city });
    if (query.startDate) qb.andWhere('e.date >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('e.date <= :endDate', { endDate: query.endDate });
    const [items, total] = await qb
      .orderBy('e.date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data: items, total, page, pageSize: limit };
  }

  async getAdminById(id: string) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Event not found');
    return item;
  }

  async create(dto: CreateEventDto) {
    return this.repo.save(
      this.repo.create({
        ...dto,
        summary: dto.summary ?? '',
        description: dto.description ?? '',
        city: dto.city ?? '',
        citySlug: dto.citySlug ?? '',
        endDate: dto.endDate ?? null,
        tags: dto.tags ?? [],
        image: dto.image ?? null,
        status: dto.status ?? 'draft',
        relatedRouteSlugs: dto.relatedRouteSlugs ?? [],
      }),
    );
  }

  async update(id: string, dto: UpdateEventDto) {
    const event = await this.getAdminById(id);
    Object.assign(event, dto);
    return this.repo.save(event);
  }

  async updateStatus(id: string, status: EventStatus) {
    if (!EVENT_STATUSES.includes(status)) {
      throw new BadRequestException('Invalid event status');
    }
    const event = await this.getAdminById(id);
    event.status = status;
    return this.repo.save(event);
  }

  async remove(id: string) {
    const event = await this.getAdminById(id);
    await this.repo.remove(event);
    return { success: true };
  }
}
