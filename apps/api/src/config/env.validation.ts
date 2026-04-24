import { z } from 'zod';

const booleanFromString = z.enum(['true', 'false']).transform((v) => v === 'true');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    API_GLOBAL_PREFIX: z.string().default('api/v1'),

    WEB_ORIGIN: z
      .string()
      .min(1)
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),

    DATABASE_URL: z.string().url(),

    REDIS_URL: z.string().url().optional(),

    STORAGE_ENDPOINT: z.string().url().optional(),
    STORAGE_REGION: z.string().optional(),
    STORAGE_ACCESS_KEY: z.string().optional(),
    STORAGE_SECRET_KEY: z.string().optional(),
    STORAGE_BUCKET: z.string().optional(),
    STORAGE_FORCE_PATH_STYLE: booleanFromString.optional(),
    /** Browser-reachable S3 endpoint for presigned URLs (optional; falls back to STORAGE_ENDPOINT). */
    STORAGE_PUBLIC_URL: z.string().url().optional(),

    AUTH_JWT_ACCESS_SECRET: z.string().min(32, 'AUTH_JWT_ACCESS_SECRET must be at least 32 chars'),
    AUTH_JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'AUTH_JWT_REFRESH_SECRET must be at least 32 chars'),
    AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    AUTH_REFRESH_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 60 * 24 * 7),

    AUTH_COOKIE_NAME: z.string().default('refresh_token'),
    AUTH_COOKIE_DOMAIN: z.string().optional(),
    AUTH_COOKIE_SECURE: booleanFromString.default('false'),
    AUTH_COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    AUTH_BCRYPT_COST: z.coerce.number().int().min(8).max(14).default(12),
  })
  .superRefine((env, ctx) => {
    if (env.AUTH_JWT_ACCESS_SECRET === env.AUTH_JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUTH_JWT_REFRESH_SECRET'],
        message: 'AUTH_JWT_REFRESH_SECRET must differ from AUTH_JWT_ACCESS_SECRET',
      });
    }
    if (env.NODE_ENV === 'production' && !env.AUTH_COOKIE_SECURE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUTH_COOKIE_SECURE'],
        message: 'AUTH_COOKIE_SECURE must be true in production',
      });
    }
    if (env.NODE_ENV === 'production' && env.AUTH_COOKIE_SAMESITE === 'none' && !env.AUTH_COOKIE_SECURE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUTH_COOKIE_SECURE'],
        message: 'SameSite=None requires Secure cookie',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (raw: Record<string, unknown>): Env => {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const formatted = parsed.error.errors
      .map((e) => `  - ${e.path.join('.') || '(root)'}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${formatted}`);
  }
  return parsed.data;
};
