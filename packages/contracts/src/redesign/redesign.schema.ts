import { z } from 'zod';

import { isoDateStringSchema, uuidSchema } from '../common/id.schema';

export const redesignJobStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
]);
export type RedesignJobStatus = z.infer<typeof redesignJobStatusSchema>;

export const redesignRoomTypeSchema = z.enum([
  'LIVING_ROOM',
  'BEDROOM',
  'KITCHEN',
  'BATHROOM',
  'HALLWAY',
  'OTHER',
]);
export type RedesignRoomType = z.infer<typeof redesignRoomTypeSchema>;

export const redesignStyleSchema = z.enum([
  'MODERN',
  'SCANDI',
  'CLASSIC',
  'MINIMAL',
  'INDUSTRIAL',
  'BOHO',
]);
export type RedesignStyle = z.infer<typeof redesignStyleSchema>;

export const createRedesignJobSchema = z.object({
  sourceMediaId: uuidSchema,
  roomType: redesignRoomTypeSchema,
  style: redesignStyleSchema,
  prompt: z.string().min(1).max(2000),
});
export type CreateRedesignJobInput = z.infer<typeof createRedesignJobSchema>;

export const redesignJobDtoSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  sourceMediaId: uuidSchema,
  resultMediaId: uuidSchema.nullable(),
  roomType: redesignRoomTypeSchema,
  style: redesignStyleSchema,
  prompt: z.string(),
  status: redesignJobStatusSchema,
  errorMessage: z.string().nullable(),
  resultPreviewUrl: z.string().url().nullable(),
  provider: z.string(),
  externalJobId: z.string().nullable(),
  attempts: z.number().int().nonnegative(),
  startedAt: isoDateStringSchema.nullable(),
  completedAt: isoDateStringSchema.nullable(),
  lastErrorAt: isoDateStringSchema.nullable(),
  createdAt: isoDateStringSchema,
  updatedAt: isoDateStringSchema,
});
export type RedesignJobDto = z.infer<typeof redesignJobDtoSchema>;

export const redesignJobListResponseSchema = z.object({
  items: z.array(redesignJobDtoSchema),
});
export type RedesignJobListResponse = z.infer<typeof redesignJobListResponseSchema>;
