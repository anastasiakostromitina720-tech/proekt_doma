'use client';

import {
  createEmptyFloorPlanData,
  FLOOR_PLAN_SCHEMA_VERSION,
  type FloorPlan,
  type FloorPlanData,
  type Room,
  type Wall,
} from '@app/contracts';
import { create } from 'zustand';

import { rectanglePolygon, type Point } from './geometry';

export type Tool = 'select' | 'wall' | 'room' | 'delete';

/**
 * Selection stores only the minimum needed to look up the element on
 * every render: its domain collection (`type`) and its id. The actual
 * object is always sourced from `data` — never cached — so it can't go
 * stale if the element is edited elsewhere.
 */
export type Selection = { type: 'wall' | 'room'; id: string } | null;

/**
 * Ephemeral state for the "in-progress" shape the user is drawing.
 * Unified naming (`start` + `current`) across tool kinds keeps the
 * preview layer small and the discriminator (`type`) identical in both
 * shape and the selection type.
 *
 *   - null: nothing is being drawn.
 *   - wall: after 1st click, `start` is fixed; `current` tracks the cursor
 *           (may be null before the first pointer-move event).
 *   - room: same semantics, for the second corner of the rectangle.
 */
export type Draft =
  | null
  | { type: 'wall'; start: Point; current: Point | null }
  | { type: 'room'; start: Point; current: Point | null };

export interface EditorState {
  // -------- Domain (single source of truth for the editor) --------
  planId: string | null;
  version: number;
  level: number;
  data: FloorPlanData;

  // -------- Editor state --------
  tool: Tool;
  selection: Selection;
  draft: Draft;
  dirty: boolean;

  // -------- Viewport --------
  /** Pixels per world-metre after zoom is applied. */
  scale: number;
  /** Stage translation in screen-pixels. */
  pan: Point;

  // -------- Actions: lifecycle --------
  /**
   * Full-reset adoption of a server plan. Resets domain state, clears
   * `selection`, `draft`, and `dirty`. Intended for two explicit
   * scenarios:
   *   1. First time the editor sees a plan (initial load or a switch
   *      to a different project).
   *   2. User-initiated reload (the user already confirmed any local
   *      changes will be lost).
   * Viewport (`scale`, `pan`) and the active `tool` are preserved —
   * they are session-scoped UI, not plan data.
   */
  hydrate(plan: FloorPlan): void;

  /**
   * Partial reconcile after a successful save. Updates `planId`,
   * `version`, `level`, `data` and clears `dirty`; preserves
   * `selection`, `draft`, `tool`, and viewport.
   *
   * Safe because save-initiated mutations are blocked on the UI side
   * while `saveStatus === 'saving'`, so at the moment the server
   * responds, `store.data === payload.data`. We reassign from the
   * server's authoritative copy anyway so any schema-level
   * normalisation (defaults, ordering) is picked up, but the operation
   * is effectively idempotent with respect to the user's current work.
   */
  reconcileSaved(plan: FloorPlan): void;

  // -------- Actions: UI state --------
  setTool(tool: Tool): void;
  setSelection(selection: Selection): void;
  setScale(scale: number): void;
  setPan(pan: Point): void;
  setDraftCurrent(point: Point | null): void;
  cancelDraft(): void;

  // -------- Actions: drawing --------
  /** First click of a wall — starts draft. */
  beginWall(start: Point): void;
  /** Second click of a wall — commits and clears draft. */
  commitWall(end: Point): void;
  /** First click of a room — starts draft. */
  beginRoom(start: Point): void;
  /** Second click of a room — commits rectangle. */
  commitRoom(end: Point): void;

  // -------- Actions: mutations --------
  deleteWall(id: string): void;
  deleteRoom(id: string): void;
  deleteSelected(): void;
  updateWall(id: string, patch: Partial<Pick<Wall, 'thickness' | 'height'>>): void;
  updateRoom(id: string, patch: Partial<Pick<Room, 'name' | 'floorLevel'>>): void;

  // -------- Selectors (pure functions over state) --------
  getPlanData(): FloorPlanData;
}

const MIN_SCALE = 20;
const MAX_SCALE = 400;
const DEFAULT_SCALE = 80;

const DEFAULT_WALL: Pick<Wall, 'thickness' | 'height'> = { thickness: 0.2, height: 2.7 };

/**
 * Generates an RFC 4122 v4 UUID.
 *
 *   1. Preferred: `crypto.randomUUID()` (all modern browsers).
 *   2. Fallback: construct a v4 UUID from `crypto.getRandomValues`.
 *      Available since IE 11 / very old Safari — in practice always
 *      present in environments we support.
 *   3. If neither exists, throw. A malformed id would silently fail
 *      server-side validation (`uuidSchema`) and break save; failing
 *      loudly here surfaces the real problem at the call site.
 */
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Per RFC 4122 §4.4: set version (0100) and variant (10xx) bits.
    const u6 = bytes[6] ?? 0;
    const u8 = bytes[8] ?? 0;
    bytes[6] = (u6 & 0x0f) | 0x40;
    bytes[8] = (u8 & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return (
      `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-` +
      `${hex.slice(16, 20)}-${hex.slice(20)}`
    );
  }

  throw new Error(
    'Cannot generate UUID: browser exposes neither crypto.randomUUID nor crypto.getRandomValues.',
  );
};

/**
 * Zustand store for the floor plan editor.
 *
 * Design rules:
 *   1. Domain (`data`) is the source of truth. Walls and rooms are
 *      independent domain entities — the store never derives one from
 *      the other, never "closes" a room based on walls, and never
 *      recomputes polygons on wall edits.
 *   2. Mutations go through actions. Each domain-mutating action sets
 *      `dirty = true`; only `hydrate` / `reconcileSaved` can clear it,
 *      and each is called from exactly one place in the orchestrator.
 *   3. New walls and rooms receive ids on the client via
 *      `crypto.randomUUID()`. The server never generates ids for
 *      editor entities.
 *   4. Viewport (`scale`, `pan`) lives here to survive component
 *      re-mounts but is intentionally NOT persisted — per-session only.
 */
export const useEditorStore = create<EditorState>((set, get) => ({
  planId: null,
  version: 1,
  level: 0,
  data: createEmptyFloorPlanData(),

  tool: 'select',
  selection: null,
  draft: null,
  dirty: false,

  scale: DEFAULT_SCALE,
  pan: { x: 0, y: 0 },

  hydrate(plan) {
    set({
      planId: plan.id,
      version: plan.version,
      level: plan.level,
      data: plan.data,
      selection: null,
      draft: null,
      dirty: false,
    });
  },

  reconcileSaved(plan) {
    set({
      planId: plan.id,
      version: plan.version,
      level: plan.level,
      data: plan.data,
      dirty: false,
    });
  },

  setTool(tool) {
    set((prev) => ({
      tool,
      // Changing tool always drops any in-progress draft; it's not
      // meaningful to "have a half-drawn wall" while switching modes.
      draft: null,
      // Selection only makes sense in `select` mode; for symmetry we
      // clear it elsewhere so the sidebar doesn't lie about context.
      selection: tool === 'select' ? prev.selection : null,
    }));
  },

  setSelection(selection) {
    set({ selection });
  },

  setScale(scale) {
    set({ scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)) });
  },

  setPan(pan) {
    set({ pan });
  },

  setDraftCurrent(point) {
    const draft = get().draft;
    if (!draft) return;
    set({ draft: { ...draft, current: point } });
  },

  cancelDraft() {
    set({ draft: null });
  },

  beginWall(start) {
    set({ draft: { type: 'wall', start, current: null }, selection: null });
  },

  commitWall(end) {
    const draft = get().draft;
    if (!draft || draft.type !== 'wall') return;
    // Degenerate zero-length walls are silently dropped; the user can
    // retry without the draft resetting awkwardly.
    if (draft.start.x === end.x && draft.start.y === end.y) {
      set({ draft: null });
      return;
    }
    const wall: Wall = {
      id: generateId(),
      start: draft.start,
      end,
      thickness: DEFAULT_WALL.thickness,
      height: DEFAULT_WALL.height,
    };
    set((prev) => ({
      data: { ...prev.data, walls: [...prev.data.walls, wall] },
      draft: null,
      dirty: true,
    }));
  },

  beginRoom(start) {
    set({ draft: { type: 'room', start, current: null }, selection: null });
  },

  commitRoom(end) {
    const draft = get().draft;
    if (!draft || draft.type !== 'room') return;
    const polygon = rectanglePolygon(draft.start, end);
    const p0 = polygon[0];
    const p2 = polygon[2];
    if (!p0 || !p2) {
      set({ draft: null });
      return;
    }
    // Rectangle collapsed onto a line/point — drop silently.
    if (p0.x === p2.x || p0.y === p2.y) {
      set({ draft: null });
      return;
    }
    const nextIndex = get().data.rooms.length + 1;
    const room: Room = {
      id: generateId(),
      name: `Комната ${nextIndex}`,
      polygon,
      floorLevel: 0,
    };
    set((prev) => ({
      data: { ...prev.data, rooms: [...prev.data.rooms, room] },
      draft: null,
      dirty: true,
    }));
  },

  deleteWall(id) {
    set((prev) => ({
      data: {
        ...prev.data,
        walls: prev.data.walls.filter((w) => w.id !== id),
        // Cascade: doors/windows reference walls by id — keeping orphan
        // references in the saved JSON would break domain invariants.
        // This is a REFERENTIAL cascade, not a geometric one: rooms are
        // unaffected even if they share edges with the removed wall.
        doors: prev.data.doors.filter((d) => d.wallId !== id),
        windows: prev.data.windows.filter((w) => w.wallId !== id),
      },
      selection:
        prev.selection?.type === 'wall' && prev.selection.id === id ? null : prev.selection,
      dirty: true,
    }));
  },

  deleteRoom(id) {
    set((prev) => ({
      data: { ...prev.data, rooms: prev.data.rooms.filter((r) => r.id !== id) },
      selection:
        prev.selection?.type === 'room' && prev.selection.id === id ? null : prev.selection,
      dirty: true,
    }));
  },

  deleteSelected() {
    const sel = get().selection;
    if (!sel) return;
    if (sel.type === 'wall') get().deleteWall(sel.id);
    else get().deleteRoom(sel.id);
  },

  updateWall(id, patch) {
    set((prev) => ({
      data: {
        ...prev.data,
        walls: prev.data.walls.map((w) => (w.id === id ? { ...w, ...patch } : w)),
      },
      dirty: true,
    }));
  },

  updateRoom(id, patch) {
    set((prev) => ({
      data: {
        ...prev.data,
        rooms: prev.data.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      },
      dirty: true,
    }));
  },

  getPlanData() {
    const d = get().data;
    // Re-assert schemaVersion: defensive in case of future dev-branch
    // drift. Server will reject mismatch anyway, but failing fast here
    // is nicer for debugging.
    if (d.meta.schemaVersion !== FLOOR_PLAN_SCHEMA_VERSION) {
      throw new Error(
        `Editor domain state has wrong schemaVersion=${d.meta.schemaVersion}, expected ${FLOOR_PLAN_SCHEMA_VERSION}`,
      );
    }
    return d;
  },
}));
