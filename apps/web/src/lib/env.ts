import { z } from 'zod';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

/**
 * Public env accessible from both server and browser.
 * Must be read from `process.env.NEXT_PUBLIC_*` literals — Next.js inlines
 * them at build time, so indexing by a variable will not work in the browser.
 */
export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});
