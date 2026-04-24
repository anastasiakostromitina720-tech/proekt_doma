import { z } from 'zod';

import { isoDateStringSchema, uuidSchema } from '../common/id.schema';

export const projectTypeSchema = z.enum(['HOUSE', 'APARTMENT', 'OTHER']);
export type ProjectType = z.infer<typeof projectTypeSchema>;

export const projectSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  type: projectTypeSchema,
  thumbnailUrl: z.string().url().nullable(),
  createdAt: isoDateStringSchema,
  updatedAt: isoDateStringSchema,
});
export type Project = z.infer<typeof projectSchema>;

/**
 * Input for POST /projects.
 * Empty/whitespace names are rejected after trim.
 * `description` may be omitted; server stores it as NULL.
 */
export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Название обязательно').max(200),
  type: projectTypeSchema.default('HOUSE'),
  description: z.string().trim().max(2000).optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/**
 * Input for PATCH /projects/:id.
 *
 * Every field is optional, but at least one must be present — otherwise the
 * request is a no-op and we reject it with 400. Sending `description: null`
 * explicitly clears it; omitting it leaves it unchanged.
 *
 * `thumbnailUrl` is intentionally NOT here. Clients have no legitimate
 * reason to set it directly — it will be produced by the media module as a
 * side effect of uploading / generating a thumbnail. Server-side code that
 * needs to update it should bypass this DTO and go through an internal
 * repository method.
 */
export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    type: projectTypeSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

/**
 * Query params for GET /projects. Offset-based pagination is used for
 * simplicity — cursor pagination can be added later without breaking.
 */
export const listProjectsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

export const projectsListResponseSchema = z.object({
  items: z.array(projectSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});
export type ProjectsListResponse = z.infer<typeof projectsListResponseSchema>;
