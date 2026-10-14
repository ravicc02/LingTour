import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, of } from 'rxjs';
import { catchError, mergeMap, tap } from 'rxjs/operators';
import { PublicContentCacheService } from './public-content-cache.service';

@Injectable()
export class PublicContentCacheInterceptor implements NestInterceptor {
  constructor(private readonly cache: PublicContentCacheService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      path: string;
      originalUrl: string;
      headers: Record<string, string | string[] | undefined>;
    }>();
    const response = context.switchToHttp().getResponse<{
      setHeader(name: string, value: string): void;
    }>();
    const method = request.method.toUpperCase();

    if (method !== 'GET') {
      return next.handle().pipe(
        tap(() => {
          if (this.isPublicContentMutation(request.path, method)) {
            void this.cache.invalidateAll();
          }
        }),
      );
    }

    if (/^\/api\/v1\/public\/cities(?:\/|$)/.test(request.path)) {
      response.setHeader('Cache-Control', 'no-store');
      return next.handle();
    }

    if (!this.isCacheablePublicRequest(request)) return next.handle();

    const ttlSeconds = request.path.includes('/events') || request.path.endsWith('/home')
      ? 60
      : 300;
    const key = this.requestKey(request);
    response.setHeader(
      'Cache-Control',
      `public, max-age=60, s-maxage=${ttlSeconds}, stale-while-revalidate=600`,
    );

    return from(this.cache.get<unknown>(key)).pipe(
      mergeMap((cached) => {
        if (cached !== null) {
          response.setHeader('X-Content-Cache', 'HIT');
          return of(cached);
        }

        response.setHeader('X-Content-Cache', 'MISS');
        return next.handle().pipe(
          mergeMap((value) =>
            from(this.cache.set(key, value, ttlSeconds)).pipe(
              mergeMap(() => of(value)),
              catchError(() => of(value)),
            ),
          ),
        );
      }),
    );
  }

  private isPublicContentMutation(path: string, method: string): boolean {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return false;
    return [
      '/api/v1/admin/home',
      '/api/v1/admin/cities',
      '/api/v1/admin/routes',
      '/api/v1/admin/shop',
      '/api/v1/admin/events',
      '/api/v1/admin/interpreting',
      '/api/v1/admin/settings',
    ].some((prefix) => path.startsWith(prefix));
  }

  private isCacheablePublicRequest(request: {
    path: string;
    headers: Record<string, string | string[] | undefined>;
  }): boolean {
    const cacheablePaths = [
      '/api/v1/public/home',
      '/api/v1/public/cities',
      '/api/v1/public/routes',
      '/api/v1/public/shop/',
      '/api/v1/public/events',
      '/api/v1/public/interpreting',
      '/api/v1/public/settings',
    ];
    if (!cacheablePaths.some((path) => request.path.startsWith(path))) {
      return false;
    }
    const authorization = request.headers.authorization;
    const cookie = request.headers.cookie;
    return !authorization && !cookie;
  }

  private requestKey(request: {
    originalUrl: string;
    headers: Record<string, string | string[] | undefined>;
  }): string {
    const url = new URL(request.originalUrl, 'http://public-cache');
    url.searchParams.sort();
    return `${url.pathname}?${url.searchParams.toString()}`;
  }
}
