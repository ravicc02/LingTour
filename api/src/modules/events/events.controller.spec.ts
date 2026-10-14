import 'reflect-metadata';
import { EventsController } from './events.controller';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

describe('Event calendar controller contract and authorization', () => {
  it('returns a raw paginated page as consumed by the calendar client', async () => {
    const page = { data: [], total: 0, page: 1, pageSize: 100 };
    const service = { listCalendar: jest.fn().mockResolvedValue(page) };
    const controller = new EventsController(service as never);
    expect(await controller.calendar('2026-10-01', '2026-10-31')).toEqual(page);
    expect(service.listCalendar).toHaveBeenCalledWith({ startDate: '2026-10-01', endDate: '2026-10-31', city: undefined, page: 1, limit: 100 });
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, controller.calendar)).toBe(true);
  });
  it('reserves historical withdrawal for admin while staff may publish and stop future dates', () => {
    expect(Reflect.getMetadata(ROLES_KEY, EventsController.prototype.withdraw)).toEqual(['admin']);
    expect(Reflect.getMetadata(ROLES_KEY, EventsController.prototype.publish)).toEqual(['admin', 'editor']);
    expect(Reflect.getMetadata(ROLES_KEY, EventsController.prototype.stopFuture)).toEqual(['admin', 'editor']);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, EventsController.prototype.publications)).toBeUndefined();
  });
  it('passes the authenticated actor, not a client-supplied owner, into lifecycle mutations', async () => {
    const service = { publicationAction: jest.fn().mockResolvedValue({ id: 'publication' }) };
    const controller = new EventsController(service as never);
    await controller.withdraw('event', 'publication', { reason: 'Correction' }, { user: { sub: 'operator', role: 'admin' } });
    expect(service.publicationAction).toHaveBeenCalledWith('event', 'publication', 'withdraw_history', 'Correction', { sub: 'operator', role: 'admin' });
  });
});
