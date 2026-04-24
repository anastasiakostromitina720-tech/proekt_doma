import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  path: string;
  timestamp: string;
  details?: unknown;
}

/**
 * Global exception filter. Produces a consistent error envelope for clients
 * and hides internals in production. Validation errors from the global
 * ValidationPipe are plain HttpException(400) with `message` as a string or
 * a string array — both cases are normalized here.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, code, message, details } = this.normalize(exception);

    const body: ApiErrorBody = {
      statusCode: status,
      code,
      message,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
      ...(details !== undefined ? { details } : {}),
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${status} ${code}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.originalUrl} -> ${status} ${code}: ${message}`,
      );
    }

    response.status(status).json(body);
  }

  private normalize(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        return { status, code: this.codeFromStatus(status), message: res };
      }

      const obj = res as Record<string, unknown>;
      const rawMessage = obj.message;
      const message = Array.isArray(rawMessage)
        ? 'Validation failed'
        : typeof rawMessage === 'string'
          ? rawMessage
          : exception.message;

      // Preserve any structured `details` field the thrower attached
      // (e.g. ZodValidationPipe issues, optimistic-locking version info).
      // Fall back to Nest's default array-message convention otherwise.
      const details = Array.isArray(rawMessage)
        ? { errors: rawMessage }
        : obj.details !== undefined
          ? obj.details
          : undefined;

      return {
        status,
        code: typeof obj.error === 'string' ? this.slugify(obj.error) : this.codeFromStatus(status),
        message,
        details,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message:
        exception instanceof Error && process.env.NODE_ENV !== 'production'
          ? exception.message
          : 'Internal server error',
    };
  }

  private codeFromStatus(status: number): string {
    return (
      {
        400: 'BAD_REQUEST',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        409: 'CONFLICT',
        422: 'UNPROCESSABLE_ENTITY',
        429: 'TOO_MANY_REQUESTS',
        500: 'INTERNAL_ERROR',
      }[status] ?? `HTTP_${status}`
    );
  }

  private slugify(input: string): string {
    return input.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
  }
}
