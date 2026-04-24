import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:isPublic';

/**
 * Marks a route handler (or whole controller) as publicly accessible.
 * The global `JwtAuthGuard` skips authentication for anything marked @Public().
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
