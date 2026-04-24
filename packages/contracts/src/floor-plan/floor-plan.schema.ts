import { z } from 'zod';
import { isoDateStringSchema, uuidSchema } from '../common/id.schema';

/**
 * Current version of the FloorPlan JSON schema.
 * Bump this whenever the shape of FloorPlan.data changes in a non-backward-compatible way.
 * Consumers (api, web editor) must check `meta.schemaVersion` before reading.
 */
export const FLOOR_PLAN_SCHEMA_VERSION = 1;

export const point2dSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});
export type Point2D = z.infer<typeof point2dSchema>;

export const wallSchema = z.object({
  id: uuidSchema,
  start: point2dSchema,
  end: point2dSchema,
  thickness: z.number().positive(),
  height: z.number().positive(),
});
export type Wall = z.infer<typeof wallSchema>;

export const roomSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(120),
  polygon: z.array(point2dSchema).min(3),
  floorLevel: z.number().int().default(0),
});
export type Room = z.infer<typeof roomSchema>;

export const doorSchema = z.object({
  id: uuidSchema,
  wallId: uuidSchema,
  /** Position along the wall, 0..1. */
  position: z.number().min(0).max(1),
  width: z.number().positive(),
  height: z.number().positive(),
});
export type Door = z.infer<typeof doorSchema>;

export const windowSchema = z.object({
  id: uuidSchema,
  wallId: uuidSchema,
  position: z.number().min(0).max(1),
  width: z.number().positive(),
  height: z.number().positive(),
  sillHeight: z.number().min(0),
});
export type Window = z.infer<typeof windowSchema>;

export const lengthUnitSchema = z.enum(['m', 'cm', 'mm']);
export type LengthUnit = z.infer<typeof lengthUnitSchema>;

export const floorPlanMetaSchema = z.object({
  schemaVersion: z.literal(FLOOR_PLAN_SCHEMA_VERSION),
  units: lengthUnitSchema.default('m'),
  scale: z.number().positive().default(1),
  gridSize: z.number().positive().default(0.5),
});
export type FloorPlanMeta = z.infer<typeof floorPlanMetaSchema>;

export const floorPlanDataSchema = z.object({
  meta: floorPlanMetaSchema,
  walls: z.array(wallSchema).default([]),
  rooms: z.array(roomSchema).default([]),
  doors: z.array(doorSchema).default([]),
  windows: z.array(windowSchema).default([]),
});
export type FloorPlanData = z.infer<typeof floorPlanDataSchema>;

export const floorPlanSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  level: z.number().int().default(0),
  version: z.number().int().min(1),
  data: floorPlanDataSchema,
  createdAt: isoDateStringSchema,
  updatedAt: isoDateStringSchema,
});
export type FloorPlan = z.infer<typeof floorPlanSchema>;

export const updateFloorPlanSchema = z.object({
  version: z.number().int().min(1),
  data: floorPlanDataSchema,
});
export type UpdateFloorPlanInput = z.infer<typeof updateFloorPlanSchema>;

/**
 * Factory for an empty plan matching the current schema version.
 * Useful for tests and for creating a fresh plan on project init.
 */
export const createEmptyFloorPlanData = (): FloorPlanData => ({
  meta: {
    schemaVersion: FLOOR_PLAN_SCHEMA_VERSION,
    units: 'm',
    scale: 1,
    gridSize: 0.5,
  },
  walls: [],
  rooms: [],
  doors: [],
  windows: [],
});
