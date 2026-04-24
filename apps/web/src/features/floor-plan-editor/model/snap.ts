import type { Point } from './geometry';

/**
 * Snaps a world-space point to the nearest grid intersection.
 * The grid step comes from `floorPlanData.meta.gridSize` (metres).
 *
 * All user-facing drawing operations go through this — it is the single
 * place that controls "everything lands on the grid" for MVP.
 */
export const snapPoint = (p: Point, gridSize: number): Point => ({
  x: Math.round(p.x / gridSize) * gridSize,
  y: Math.round(p.y / gridSize) * gridSize,
});

/**
 * Snaps a single scalar (used e.g. for rounding editable input fields
 * in the side panel).
 */
export const snapValue = (v: number, gridSize: number): number =>
  Math.round(v / gridSize) * gridSize;
