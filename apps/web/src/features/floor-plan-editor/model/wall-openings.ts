import type { Wall } from '@app/contracts';

import type { Point } from './geometry';

/** Max distance (m) from pointer to wall axis to accept door/window placement. */
export const OPENING_PLACE_SNAP_METERS = 0.35;

export const DEFAULT_DOOR = { width: 0.9, height: 2.1 } as const;
export const DEFAULT_WINDOW = { width: 1.2, height: 1.4, sillHeight: 0.9 } as const;

export function wallSegmentLength(w: Wall): number {
  const dx = w.end.x - w.start.x;
  const dy = w.end.y - w.start.y;
  return Math.hypot(dx, dy);
}

/** Unit tangent from start → end. */
export function wallUnitTangent(w: Wall): { x: number; y: number } {
  const L = wallSegmentLength(w);
  if (L < 1e-9) return { x: 1, y: 0 };
  return { x: (w.end.x - w.start.x) / L, y: (w.end.y - w.start.y) / L };
}

/** Left normal (90° CCW from tangent). */
export function wallUnitNormal(w: Wall): { x: number; y: number } {
  const t = wallUnitTangent(w);
  return { x: -t.y, y: t.x };
}

export function wallPointAt(w: Wall, t: number): Point {
  return {
    x: w.start.x + t * (w.end.x - w.start.x),
    y: w.start.y + t * (w.end.y - w.start.y),
  };
}

/**
 * Normalized parameter t in [0,1] of the projection of `p` onto the
 * wall segment (clamped to segment).
 */
export function worldPointToWallParameter(w: Wall, p: Point): number {
  const ax = w.start.x;
  const ay = w.start.y;
  const abx = w.end.x - ax;
  const aby = w.end.y - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-12) return 0.5;
  const t = ((p.x - ax) * abx + (p.y - ay) * aby) / len2;
  return Math.min(1, Math.max(0, t));
}

/**
 * Closest point on segment to `p` and squared distance.
 */
export function closestPointOnWall(w: Wall, p: Point): { t: number; d2: number } {
  const t = worldPointToWallParameter(w, p);
  const c = wallPointAt(w, t);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { t, d2: dx * dx + dy * dy };
}

/**
 * If opening of width `openingWidth` (along wall) is centered at
 * parameter `t`, keep center within so the opening stays on the segment.
 */
export function clampPositionForOpeningOnWall(
  w: Wall,
  tRaw: number,
  openingWidthAlongWall: number,
): number {
  const L = wallSegmentLength(w);
  if (L < 1e-6) return 0.5;
  const half = openingWidthAlongWall / 2 / L;
  if (half >= 0.5) return 0.5;
  return Math.min(1 - half, Math.max(half, tRaw));
}

export function findClosestWall(
  walls: Wall[],
  p: Point,
  maxDist: number,
): { wall: Wall; t: number } | null {
  const maxD2 = maxDist * maxDist;
  let best: { wall: Wall; t: number; d2: number } | null = null;
  for (const wall of walls) {
    const { t, d2 } = closestPointOnWall(wall, p);
    if (d2 <= maxD2 && (!best || d2 < best.d2)) {
      best = { wall, t, d2 };
    }
  }
  return best ? { wall: best.wall, t: best.t } : null;
}
