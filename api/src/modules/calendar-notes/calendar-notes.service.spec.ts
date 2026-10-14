import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Between, Repository } from 'typeorm';
import { CalendarNotesService } from './calendar-notes.service';
import { CalendarNote } from './entities/calendar-note.entity';

const owner = 'a1111111-1111-4111-8111-111111111111';
const other = 'b1111111-1111-4111-8111-111111111111';
const id = 'c1111111-1111-4111-8111-111111111111';
const input = { date: '2026-10-14', title: 'Plan the afternoon', body: 'Check opening hours.' };

function setup() {
  const note = { ...input, id, userId: owner, citySlug: null, createdAt: new Date(), updatedAt: new Date() };
  const repository = {
    find: jest.fn().mockResolvedValue([note]),
    findOne: jest.fn().mockImplementation(async ({ where }) => where.userId === owner && where.id === id ? note : null),
    create: jest.fn((value) => value), save: jest.fn(async (value) => value),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockImplementation(async ({ userId }) => ({ affected: userId === owner ? 1 : 0 })),
  };
  return { repository, service: new CalendarNotesService(repository as unknown as Repository<CalendarNote>) };
}

describe('CalendarNotesService private ownership', () => {
  it('lists the complete owner month with a stable same-day order', async () => {
    const { repository, service } = setup();
    await service.list(owner, '2024-02');
    expect(repository.find).toHaveBeenCalledWith({ where: { userId: owner, date: Between('2024-02-01', '2024-02-29') }, order: { date: 'ASC', createdAt: 'ASC', id: 'ASC' } });
  });

  it('does not accept a missing or malformed owner on any operation', async () => {
    const { repository, service } = setup();
    for (const badOwner of [undefined, null, '', 'not-a-uuid']) {
      await expect(service.list(badOwner as unknown as string, '2026-10')).rejects.toThrow(UnauthorizedException);
      await expect(service.findOne(badOwner as unknown as string, id)).rejects.toThrow(UnauthorizedException);
      await expect(service.create(badOwner as unknown as string, input)).rejects.toThrow(UnauthorizedException);
      await expect(service.update(badOwner as unknown as string, id, input)).rejects.toThrow(UnauthorizedException);
      await expect(service.remove(badOwner as unknown as string, id)).rejects.toThrow(UnauthorizedException);
    }
    for (const mock of Object.values(repository)) expect(mock).not.toHaveBeenCalled();
  });

  it('does not reveal or update another traveler note', async () => {
    const { repository, service } = setup();
    await expect(service.findOne(other, id)).rejects.toThrow(NotFoundException);
    await expect(service.update(other, id, { title: 'Unauthorized' })).rejects.toThrow(NotFoundException);
    expect(repository.findOne).toHaveBeenCalledWith({ where: { id, userId: other } });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('scopes deletion to owner and returns the same 404 for a foreign note', async () => {
    const { repository, service } = setup();
    await expect(service.remove(other, id)).rejects.toThrow(NotFoundException);
    expect(repository.delete).toHaveBeenCalledWith({ id, userId: other });
    await expect(service.remove(owner, id)).resolves.toBeUndefined();
  });

  it('creates multiple notes on a day and projects only client-editable fields', async () => {
    const { repository, service } = setup();
    const attack = { ...input, userId: other, id, createdAt: 'injected' };
    await service.create(owner, attack);
    await service.create(owner, input);
    expect(repository.create).toHaveBeenNthCalledWith(1, { ...input, userId: owner, citySlug: null });
    expect(repository.save).toHaveBeenCalledTimes(2);
  });

  it('projects updates and scopes the actual SQL mutation to its owner', async () => {
    const { repository, service } = setup();
    await service.update(owner, id, { title: 'Edited', citySlug: null, userId: other } as never);
    expect(repository.update).toHaveBeenCalledWith({ id, userId: owner }, { title: 'Edited', citySlug: null });
  });

  it('handles a concurrent removal instead of returning success', async () => {
    const { repository, service } = setup();
    repository.update.mockResolvedValue({ affected: 0 });
    await expect(service.update(owner, id, { title: 'Edited' })).rejects.toThrow(NotFoundException);
  });

  it('rejects bad months and empty patches without modifying data', async () => {
    const { repository, service } = setup();
    for (const month of ['2026-13', '2026-1', '0000-01', '2026-10-01']) await expect(service.list(owner, month)).rejects.toThrow(BadRequestException);
    await expect(service.update(owner, id, {})).rejects.toThrow(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });
});
