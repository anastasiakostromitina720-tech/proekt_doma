import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Validates input against a zod schema.
 *
 * Use per-endpoint, e.g. `@Body(new ZodValidationPipe(loginInputSchema))`.
 * We intentionally do NOT register this as a global pipe — different endpoints
 * need different schemas and we don't want implicit coupling to DTO classes.
 */
@Injectable()
export class ZodValidationPipe<TSchema extends ZodSchema> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        error: 'Bad Request',
        details: {
          issues: result.error.issues.map((i) => ({
            path: i.path.join('.'),
            code: i.code,
            message: i.message,
          })),
        },
      });
    }
    return result.data;
  }
}
