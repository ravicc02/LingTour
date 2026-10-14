import 'reflect-metadata';
import { HEADERS_METADATA, EXCEPTION_FILTERS_METADATA } from '@nestjs/common/constants';
import { AccountServiceRequestsController, AdminServiceRequestsController, ServicePackagesController } from './service-requests.controller';
import { PrivateRequestExceptionFilter } from './private-request-exception.filter';
import { getEmailEvent, renderEmailTemplate } from '../email/email-events';

describe('Service request controller security and notification contract', () => {
  it('marks all private routes no-store and installs HTTP error privacy filter', () => {
    for (const target of [AccountServiceRequestsController, AdminServiceRequestsController]) {
      expect(Reflect.getMetadata(EXCEPTION_FILTERS_METADATA, target)).toContain(PrivateRequestExceptionFilter);
      for (const name of Object.getOwnPropertyNames(target.prototype).filter(name => name !== 'constructor')) {
        const handler = (target.prototype as unknown as Record<string, Function>)[name];
        expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toEqual(expect.arrayContaining([{ name: 'Cache-Control', value: 'private, no-store' }]));
      }
    }
  });
  it('registers no new checkout or PayPal endpoint', () => {
    expect(Object.getOwnPropertyNames(AccountServiceRequestsController.prototype)).not.toContain('checkout');
    expect(Object.getOwnPropertyNames(AdminServiceRequestsController.prototype)).not.toContain('checkout');
    expect(Object.getOwnPropertyNames(ServicePackagesController.prototype)).toEqual(['constructor', 'packages']);
  });
  it('keeps admin message cursor/unread metadata through the axios generic-list adapter', async () => {
    const result = { data: [], hasMore: false, nextCursor: null, unreadCount: 3 };
    const requests = { messages: jest.fn(async () => result) };
    const controller = new AdminServiceRequestsController(requests as never);
    const response = await controller.messages({ user: { sub: 'staff', role: 'admin' } } as never, 'id', { size: 50 });
    expect(response).toEqual({ code: 200, data: result, message: 'success' });
    expect(requests.messages).toHaveBeenCalledWith({ sub: 'staff', role: 'admin' }, 'id', { size: 50 }, true);
  });
  it('renders a plain-English USD notification with no invented deposit or private-message variable', () => {
    const event = getEmailEvent('service_request_update')!;
    expect(event.status).toBe('active');
    expect(event.variables.map(v => v.key)).not.toEqual(expect.arrayContaining(['body', 'message', 'contact']));
    const rendered = renderEmailTemplate(event.defaultBodyHtml, { title: 'Service request received', requestReference: 'request', serviceType: 'interpretation', amount: 'USD 305.00', policyNotice: 'Payment policy has not been configured. No deposit or payment is due through this request.', siteName: 'Culvoy' });
    expect(rendered).toContain('USD 305.00'); expect(rendered).toContain('No deposit or payment is due'); expect(rendered).not.toContain('Secure the interpreter slot');
  });
});
