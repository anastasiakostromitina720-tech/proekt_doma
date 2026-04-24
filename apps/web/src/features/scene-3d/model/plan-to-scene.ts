import type {
  Door,
  FloorPlanData,
  Point2D,
  Room,
  Wall,
  Window as PlanWindow,
} from '@app/contracts';

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

/**
 * Simple 3D placeholder for a door/window: axis-aligned box on the wall face,
 * no boolean cuts (not CSG).
 */
export interface OpeningMarkerProps {
  openingId: string;
  kind: 'door' | 'window';
  position: [number, number, number];
  rotation: [number, number, number];
  boxArgs: [number, number, number];
  color: string;
}

function openingToMarkerProps(
  wall: Wall,
  opening: { position: number; width: number; height: number; sillHeight?: number },
  kind: 'door' | 'window',
  openingId: string,
): OpeningMarkerProps | null {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.y - wall.start.y;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return null;

  const t = opening.position;
  const px = wall.start.x + dx * t;
  const pz = wall.start.y + dz * t;

  const nx = -dz / len;
  const nz = dx / len;

  const bump = wall.thickness * 0.5 + 0.1;
  const theta = Math.atan2(dz, dx);

  const yWorld =
    kind === 'door'
      ? opening.height * 0.5
      : (opening.sillHeight ?? 0) + opening.height * 0.5;

  return {
    openingId,
    kind,
    position: [px + nx * bump, yWorld, pz + nz * bump],
    rotation: [0, theta, 0],
    boxArgs: [
      Math.max(opening.width, 0.05),
      Math.max(opening.height, 0.05),
      0.14,
    ],
    color: kind === 'door' ? '#ea580c' : '#0284c7',
  };
}

export function doorToMarkerProps(wall: Wall, door: Door): OpeningMarkerProps | null {
  return openingToMarkerProps(
    wall,
    { position: door.position, width: door.width, height: door.height },
    'door',
    door.id,
  );
}

export function windowToMarkerProps(
  wall: Wall,
  win: PlanWindow,
): OpeningMarkerProps | null {
  return openingToMarkerProps(
    wall,
    {
      position: win.position,
      width: win.width,
      height: win.height,
      sillHeight: win.sillHeight,
    },
    'window',
    win.id,
  );
}

export function collectOpeningMarkers(data: FloorPlanData): OpeningMarkerProps[] {
  const wallMap = new Map(data.walls.map((w) => [w.id, w]));
  const out: OpeningMarkerProps[] = [];
  for (const d of data.doors) {
    const w = wallMap.get(d.wallId);
    if (!w) continue;
    const m = doorToMarkerProps(w, d);
    if (m) out.push(m);
  }
  for (const win of data.windows) {
    const w = wallMap.get(win.wallId);
    if (!w) continue;
    const m = windowToMarkerProps(w, win);
    if (m) out.push(m);
  }
  return out;
}
