import { z } from 'zod';
import { isoDateStringSchema, uuidSchema } from '../common/id.schema';

export const userSchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  name: z.string().min(1).max(120),
  createdAt: isoDateStringSchema,
  updatedAt: isoDateStringSchema,
});
export type User = z.infer<typeof userSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1).max(120).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
