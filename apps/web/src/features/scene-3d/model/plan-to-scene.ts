import type { FloorPlanData, Point2D, Room, Wall } from '@app/contracts';

/**
 * Plan space: X horizontal, Y "depth" on the 2D drawing (floor plan).
 * Three.js scene: Y up, floor in the XZ plane.
 *
 * Mapping: plan (x, y) → world (x, z) with z = plan.y.
 * Walls extrude along +world Y from y=0 to y=wall.height.
 */

/** Vertical offset per `room.floorLevel` so stacked levels don't z-fight (MVP placeholder). */
const STORY_HEIGHT_M = 2.8;

/** Tiny lift above y=0 to reduce z-fighting with the ground grid. */
const FLOOR_EPSILON = 0.02;

export interface WallMeshProps {
  wallId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  /** boxGeometry args: [width along wall, height (world Y), depth (thickness)] */
  boxArgs: [number, number, number];
}

/**
 * Maps a domain `Wall` to an axis-aligned `BoxGeometry` pose in world space.
 * Box length runs along the segment plan.start → plan.end; thickness is the
 * short axis in XZ. Returns `null` for degenerate zero-length segments.
 */
export function wallToMeshProps(wall: Wall): WallMeshProps | null {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.y - wall.start.y;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return null;

  const cx = (wall.start.x + wall.end.x) / 2;
  const cz = (wall.start.y + wall.end.y) / 2;
  const cy = wall.height / 2;
  const theta = Math.atan2(dz, dx);

  return {
    wallId: wall.id,
    position: [cx, cy, cz],
    rotation: [0, theta, 0],
    boxArgs: [length, wall.height, wall.thickness],
  };
}

export interface RoomFloorShape {
  roomId: string;
  /** Closed polygon in world XZ; z comes from plan Point2D.y. */
  outlineXZ: Array<{ x: number; z: number }>;
  floorLevel: number;
  /** World-space Y of the floor surface (includes story stacking). */
  floorY: number;
}

/**
 * Pure data describing the room floor outline in XZ. No Three.js types —
 * R3F components turn this into `BufferGeometry` / materials.
 */
export function roomToFloorShape(room: Room): RoomFloorShape {
  return {
    roomId: room.id,
    outlineXZ: room.polygon.map((p: Point2D) => ({ x: p.x, z: p.y })),
    floorLevel: room.floorLevel,
    floorY: room.floorLevel * STORY_HEIGHT_M + FLOOR_EPSILON,
  };
}

/**
 * Fan triangulation from vertex 0. Valid for convex polygons only
 * (MVP editor produces axis-aligned rectangles).
 *
 * Returns non-indexed positions: each row is a triangle (x,y,z)×3 with y=0
 * in shape-local space; add `floorY` via mesh position.
 */
export function roomFloorShapeToPositions(shape: RoomFloorShape): Float32Array {
  const outline = shape.outlineXZ;
  const n = outline.length;
  if (n < 3) return new Float32Array(0);
  const out: number[] = [];
  const p0 = outline[0];
  if (!p0) return new Float32Array(0);
  for (let i = 1; i < n - 1; i++) {
    const p1 = outline[i];
    const p2 = outline[i + 1];
    if (!p1 || !p2) continue;
    out.push(p0.x, 0, p0.z, p1.x, 0, p1.z, p2.x, 0, p2.z);
  }
  return new Float32Array(out);
}

/** True when there is nothing meaningful to preview in 3D (MVP heuristic). */
export function isPlanGeometryEmpty(data: FloorPlanData): boolean {
  return data.walls.length === 0 && data.rooms.length === 0;
}
