import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';

/** Scoped to private request controllers, including guard/pipe failures. */
@Catch(HttpException)
export class PrivateRequestExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status = exception.getStatus();
    const payload = exception.getResponse();
    response.setHeader('Cache-Control', 'private, no-store');
    response.status(status).json({
      statusCode: status,
      message: typeof payload === 'string' ? payload : (payload as { message?: unknown }).message ?? payload,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
