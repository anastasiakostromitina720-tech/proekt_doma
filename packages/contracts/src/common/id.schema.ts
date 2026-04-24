import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export type UUID = z.infer<typeof uuidSchema>;

export const isoDateStringSchema = z.string().datetime({ offset: true });
export type ISODateString = z.infer<typeof isoDateStringSchema>;
