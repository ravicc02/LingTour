import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { PublicContentCacheInterceptor } from './public-content-cache.interceptor';

const response = () => {
  const headers = new Map<string, string>();
  return {
    headers,
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
  };
};

const contextFor = (path: string, method = 'GET') => {
  const res = response();
  const request = {
    method,
    path,
    originalUrl: path,
    headers: {},
  };
  return {
    res,
    context: {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => res }),
    } as unknown as ExecutionContext,
  };
};

describe('PublicContentCacheInterceptor', () => {
  it('returns cached anonymous public content without calling the handler', async () => {
    const cache = {
      get: jest.fn().mockResolvedValue({ cached: true }),
      set: jest.fn(),
      invalidateAll: jest.fn(),
    };
    const interceptor = new PublicContentCacheInterceptor(cache as never);
    const { context, res } = contextFor('/api/v1/public/routes?limit=50');
    const handler = { handle: jest.fn(() => of({ fresh: true })) } as unknown as CallHandler;

    await expect(lastValueFrom(interceptor.intercept(context, handler))).resolves.toEqual({
      cached: true,
    });
    expect(handler.handle).not.toHaveBeenCalled();
    expect(res.headers.get('X-Content-Cache')).toBe('HIT');
  });

  it('never serves cached city content after unpublishing', async () => {
    const cache = { get: jest.fn(), set: jest.fn(), invalidateAll: jest.fn() };
    const interceptor = new PublicContentCacheInterceptor(cache as never);
    const { context, res } = contextFor('/api/v1/public/cities/shaoguan');
    const handler = { handle: jest.fn(() => of({ contentMarkdown: 'Current text' })) };
    await lastValueFrom(interceptor.intercept(context, handler));
    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
    expect(handler.handle).toHaveBeenCalled();
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('does not cache booking requests or invalidate for them', async () => {
    const cache = {
      get: jest.fn(),
      set: jest.fn(),
      invalidateAll: jest.fn(),
    };
    const interceptor = new PublicContentCacheInterceptor(cache as never);
    const { context } = contextFor('/api/v1/public/bookings', 'POST');
    const handler = { handle: jest.fn(() => of({ created: true })) } as unknown as CallHandler;

    await lastValueFrom(interceptor.intercept(context, handler));
    expect(cache.invalidateAll).not.toHaveBeenCalled();
  });
});
