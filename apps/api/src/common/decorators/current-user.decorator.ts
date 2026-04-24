import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../../types/express';

/**
 * Returns the authenticated user attached by `JwtAuthGuard`.
 * Throws if no user is present (should be unreachable when the guard ran).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.user) {
      throw new UnauthorizedException();
    }
    return req.user;
  },
);
