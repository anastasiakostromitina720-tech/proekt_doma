import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import type { ApiErrorBody } from './http-exception.filter';

interface MappedError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Translates known Prisma errors into the canonical API error envelope.
 *
 * We handle this in a dedicated filter (as opposed to folding it into
 * `AllExceptionsFilter`) so Prisma stays a concern of the persistence
 * boundary rather than the HTTP boundary. Unknown Prisma codes fall through
 * and are picked up by `AllExceptionsFilter` as a 500.
 *
 * Registration order in `main.ts` MUST put this filter BEFORE the catch-all
 * one — NestJS resolves filters by `Array.find` and `@Catch()` with no args
 * matches everything.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const mapped = this.map(exception);

    const body: ApiErrorBody = {
      statusCode: mapped.status,
      code: mapped.code,
      message: mapped.message,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
      ...(mapped.details !== undefined ? { details: mapped.details } : {}),
    };

    if (mapped.status >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${mapped.status} ${mapped.code}: ${mapped.message} (prisma=${exception.code})`,
        exception.stack,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.originalUrl} -> ${mapped.status} ${mapped.code} (prisma=${exception.code})`,
      );
    }

    response.status(mapped.status).json(body);
  }

  private map(e: Prisma.PrismaClientKnownRequestError): MappedError {
    switch (e.code) {
      // "An operation failed because it depends on one or more records that
      // were required but not found."
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'Resource not found',
        };

      // Unique constraint violation.
      case 'P2002': {
        const target = this.readTarget(e);
        return {
          status: HttpStatus.CONFLICT,
          code: 'CONFLICT',
          message: target
            ? `Unique constraint violation on: ${target}`
            : 'Unique constraint violation',
          details: target ? { fields: target.split(', ') } : undefined,
        };
      }

      // Foreign key constraint violation. For MVP we treat this as CONFLICT
      // because the caller is trying to reference/delete a row that's tied
      // to another entity; there's no meaningful recovery at the field level.
      case 'P2003':
        return {
          status: HttpStatus.CONFLICT,
          code: 'CONFLICT',
          message: 'Operation violates a foreign key constraint',
        };

      default:
        // Unknown Prisma error code. Respond with a canonical 500 directly:
        // re-throwing inside a filter is not a reliable way to delegate to
        // the catch-all filter across NestJS versions, and a hung response
        // is a worse failure mode than a generic 500.
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'DATABASE_ERROR',
          message: 'Database error',
        };
    }
  }

  private readTarget(e: Prisma.PrismaClientKnownRequestError): string | undefined {
    const meta = e.meta as { target?: string | string[] } | undefined;
    if (!meta?.target) return undefined;
    return Array.isArray(meta.target) ? meta.target.join(', ') : meta.target;
  }
}
