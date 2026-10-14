import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { Between, Repository } from 'typeorm';
import { CalendarNote } from './entities/calendar-note.entity';
import { CreateCalendarNoteDto, UpdateCalendarNoteDto } from './dto/calendar-note.dto';

@Injectable()
export class CalendarNotesService {
  constructor(@InjectRepository(CalendarNote) private readonly notes: Repository<CalendarNote>) {}

  private requireOwner(userId: string): void {
    // Undefined/null conditions can be ignored by TypeORM. Never send one to a query.
    if (!isUUID(userId)) throw new UnauthorizedException('A valid traveler session is required');
  }

  async list(userId: string, month: string): Promise<CalendarNote[]> {
    this.requireOwner(userId);
    if (!/^(?!0000)\d{4}-(?:0[1-9]|1[0-2])$/.test(month)) {
      throw new BadRequestException('month must be YYYY-MM');
    }
    const first = `${month}-01`;
    const lastDay = new Date(`${first}T00:00:00.000Z`);
    lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
    const last = lastDay.toISOString().slice(0, 10);
    return this.notes.find({
      where: { userId, date: Between(first, last) },
      order: { date: 'ASC', createdAt: 'ASC', id: 'ASC' },
    });
  }

  async findOne(userId: string, id: string): Promise<CalendarNote> {
    this.requireOwner(userId);
    if (!isUUID(id)) throw new NotFoundException('Calendar note not found');
    const note = await this.notes.findOne({ where: { id, userId } });
    // Foreign-owned and missing notes have the same response; staff gets no bypass.
    if (!note) throw new NotFoundException('Calendar note not found');
    return note;
  }

  async create(userId: string, dto: CreateCalendarNoteDto): Promise<CalendarNote> {
    this.requireOwner(userId);
    return this.notes.save(this.notes.create({
      userId, date: dto.date, title: dto.title, body: dto.body, citySlug: dto.citySlug ?? null,
    }));
  }

  async update(userId: string, id: string, dto: UpdateCalendarNoteDto): Promise<CalendarNote> {
    await this.findOne(userId, id);
    // Explicit projection prevents owner/id/timestamp injection even outside ValidationPipe.
    const patch: Partial<CalendarNote> = {};
    if (dto.date !== undefined) patch.date = dto.date;
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.body !== undefined) patch.body = dto.body;
    if (dto.citySlug !== undefined) patch.citySlug = dto.citySlug;
    if (!Object.keys(patch).length) throw new BadRequestException('Provide at least one note field');
    // Scope the mutation itself, not only the preceding ownership read.
    const result = await this.notes.update({ id, userId }, patch);
    if (!result.affected) throw new NotFoundException('Calendar note not found');
    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    this.requireOwner(userId);
    if (!isUUID(id)) throw new NotFoundException('Calendar note not found');
    const result = await this.notes.delete({ id, userId });
    if (!result.affected) throw new NotFoundException('Calendar note not found');
  }
}
