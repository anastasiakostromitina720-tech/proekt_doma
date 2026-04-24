import type { Point2D } from '@app/contracts';

/**
 * Re-export the domain Point type under the editor-local alias `Point`.
 * Keeping the editor on the contract type (via alias) means there is no
 * local divergence in shape; downstream editor code uses `Point` for
 * readability but the underlying shape is the domain's.
 */
export type Point = Point2D;

export const distance = (a: Point, b: Point): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export const pointsEqual = (a: Point, b: Point, epsilon = 1e-6): boolean =>
  Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon;

/**
 * Axis-aligned rectangle described by two diagonal corners. Produces a
 * closed polygon (CW) of four points. Used by the room tool, which is
 * rectangle-only for MVP.
 */
export const rectanglePolygon = (a: Point, b: Point): Point[] => {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
};

export const polygonBounds = (
  points: Point[],
): { minX: number; minY: number; maxX: number; maxY: number } => {
  const p0 = points[0];
  if (!p0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = p0.x;
  let maxX = p0.x;
  let minY = p0.y;
  let maxY = p0.y;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (!p) continue;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
};

/** Konva's Line/Polygon expects a flat [x0, y0, x1, y1, ...] array. */
export const flattenPoints = (points: Point[]): number[] => {
  const out: number[] = new Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!p) continue;
    out[i * 2] = p.x;
    out[i * 2 + 1] = p.y;
  }
  return out;
};
