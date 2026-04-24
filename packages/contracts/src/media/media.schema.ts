import { z } from 'zod';

import { isoDateStringSchema, uuidSchema } from '../common/id.schema';

/** Upper bound for a single image upload (aligned with API / storage policy). */
export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;

export const mediaKindSchema = z.enum([
  'ROOM_PHOTO',
  'FACADE_PHOTO',
  'REDESIGN_RESULT',
  'PROJECT_THUMBNAIL',
]);
export type MediaKind = z.infer<typeof mediaKindSchema>;

export const mediaStatusSchema = z.enum(['PENDING_UPLOAD', 'READY']);
export type MediaStatus = z.infer<typeof mediaStatusSchema>;

export const allowedImageMimeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp']);
export type AllowedImageMime = z.infer<typeof allowedImageMimeSchema>;

export const requestMediaUploadSchema = z.object({
  kind: mediaKindSchema,
  mimeType: allowedImageMimeSchema,
  sizeBytes: z.number().int().positive().max(MEDIA_MAX_BYTES),
});
export type RequestMediaUploadInput = z.infer<typeof requestMediaUploadSchema>;

export const presignedUploadResponseSchema = z.object({
  mediaId: uuidSchema,
  uploadUrl: z.string().url(),
  uploadHeaders: z.record(z.string()),
  expiresInSeconds: z.number().int(),
});
export type PresignedUploadResponse = z.infer<typeof presignedUploadResponseSchema>;

export const mediaAssetDtoSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  kind: mediaKindSchema,
  status: mediaStatusSchema,
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  previewUrl: z.string().url().nullable(),
  createdAt: isoDateStringSchema,
});
export type MediaAssetDto = z.infer<typeof mediaAssetDtoSchema>;

export const mediaListResponseSchema = z.object({
  items: z.array(mediaAssetDtoSchema),
});
export type MediaListResponse = z.infer<typeof mediaListResponseSchema>;
