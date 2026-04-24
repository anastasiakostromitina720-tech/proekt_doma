import { Injectable } from '@nestjs/common';

import { envSchema, type Env } from './env.validation';

/**
 * Typed access to the validated environment.
 *
 * The env object is parsed once at construction via zod (same schema as the
 * `validate` hook in ConfigModule). No code in the rest of the app should
 * read `process.env` directly — go through this service.
 *
 * Note: we intentionally do NOT rely on `ConfigService.get(...)` because we
 * want:
 *   1. A single source of truth for the parsed/transformed values
 *      (e.g. `WEB_ORIGIN` is a parsed `string[]`, not the raw CSV).
 *   2. Strong typing keyed by `Env` without string literals.
 */
@Injectable()
export class EnvService {
  private readonly env: Env;

  constructor() {
    this.env = envSchema.parse(process.env);
  }

  get<K extends keyof Env>(key: K): Env[K] {
    return this.env[key];
  }

  get all(): Readonly<Env> {
    return this.env;
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get isDevelopment(): boolean {
    return this.env.NODE_ENV === 'development';
  }
}
