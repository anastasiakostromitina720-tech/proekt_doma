import { z } from 'zod';

import { isoDateStringSchema } from '../common/id.schema';
import { userSchema } from '../user/user.schema';

export const emailSchema = z
  .string()
  .email()
  .max(254)
  .transform((v) => v.trim().toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, 'Пароль должен быть не короче 8 символов')
  .max(128);

export const registerInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(120),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const authSessionSchema = z.object({
  user: userSchema,
  accessToken: z.string().min(1),
  accessTokenExpiresAt: isoDateStringSchema,
});
export type AuthSession = z.infer<typeof authSessionSchema>;
