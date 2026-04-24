'use client';

import {
  createEmptyFloorPlanData,
  FLOOR_PLAN_SCHEMA_VERSION,
  type Door,
  type FloorPlan,
  type FloorPlanData,
  type Room,
  type Wall,
  type Window as PlanWindow,
} from '@app/contracts';
import { create } from 'zustand';

import { rectanglePolygon, type Point } from './geometry';
import {
  clampPositionForOpeningOnWall,
  DEFAULT_DOOR,
  DEFAULT_WINDOW,
  worldPointToWallParameter,
} from './wall-openings';

export type Tool = 'select' | 'wall' | 'room' | 'door' | 'window' | 'delete';

/**
 * Selection stores only `{ type, id }` for walls, rooms, doors, windows.
 */
export type Selection =
  | { type: 'wall'; id: string }
  | { type: 'room'; id: string }
  | { type: 'door'; id: string }
  | { type: 'window'; id: string }
  | null;

export type Draft =
  | null
  | { type: 'wall'; start: Point; current: Point | null }
  | { type: 'room'; start: Point; current: Point | null };

export interface EditorState {
  planId: string | null;
  version: number;
  level: number;
  data: FloorPlanData;

  tool: Tool;
  selection: Selection;
  draft: Draft;
  dirty: boolean;

  scale: number;
  pan: Point;

  hydrate(plan: FloorPlan): void;
  reconcileSaved(plan: FloorPlan): void;

  setTool(tool: Tool): void;
  setSelection(selection: Selection): void;
  setScale(scale: number): void;
  setPan(pan: Point): void;
  setDraftCurrent(point: Point | null): void;
  cancelDraft(): void;

  beginWall(start: Point): void;
  commitWall(end: Point): void;
  beginRoom(start: Point): void;
  commitRoom(end: Point): void;

  /** Place a door on `wallId`; `world` is used only to derive `position` 0..1. */
  addDoorOnWall(wallId: string, world: Point): void;
  addWindowOnWall(wallId: string, world: Point): void;

  deleteWall(id: string): void;
  deleteRoom(id: string): void;
  deleteDoor(id: string): void;
  deleteWindow(id: string): void;
  deleteSelected(): void;
  updateWall(id: string, patch: Partial<Pick<Wall, 'thickness' | 'height'>>): void;
  updateRoom(id: string, patch: Partial<Pick<Room, 'name' | 'floorLevel'>>): void;
  updateDoor(id: string, patch: Partial<Pick<Door, 'wallId' | 'position' | 'width' | 'height'>>): void;
  updateWindow(
    id: string,
    patch: Partial<Pick<PlanWindow, 'wallId' | 'position' | 'width' | 'height' | 'sillHeight'>>,
  ): void;

  getPlanData(): FloorPlanData;
}

const MIN_SCALE = 20;
const MAX_SCALE = 400;
const DEFAULT_SCALE = 80;

const DEFAULT_WALL: Pick<Wall, 'thickness' | 'height'> = { thickness: 0.2, height: 2.7 };

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
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
      draft: null,
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

  addDoorOnWall(wallId, world) {
    const wall = get().data.walls.find((w) => w.id === wallId);
    if (!wall) return;
    const tRaw = worldPointToWallParameter(wall, world);
    const position = clampPositionForOpeningOnWall(wall, tRaw, DEFAULT_DOOR.width);
    const door: Door = {
      id: generateId(),
      wallId,
      position,
      width: DEFAULT_DOOR.width,
      height: DEFAULT_DOOR.height,
    };
    set((prev) => ({
      data: { ...prev.data, doors: [...prev.data.doors, door] },
      dirty: true,
    }));
  },

  addWindowOnWall(wallId, world) {
    const wall = get().data.walls.find((w) => w.id === wallId);
    if (!wall) return;
    const tRaw = worldPointToWallParameter(wall, world);
    const position = clampPositionForOpeningOnWall(wall, tRaw, DEFAULT_WINDOW.width);
    const win: PlanWindow = {
      id: generateId(),
      wallId,
      position,
      width: DEFAULT_WINDOW.width,
      height: DEFAULT_WINDOW.height,
      sillHeight: DEFAULT_WINDOW.sillHeight,
    };
    set((prev) => ({
      data: { ...prev.data, windows: [...prev.data.windows, win] },
      dirty: true,
    }));
  },

  deleteWall(id) {
    set((prev) => {
      const sel = prev.selection;
      let nextSel = sel;
      if (sel?.type === 'wall' && sel.id === id) nextSel = null;
      else if (sel?.type === 'door') {
        const d = prev.data.doors.find((x) => x.id === sel.id);
        if (d?.wallId === id) nextSel = null;
      } else if (sel?.type === 'window') {
        const w = prev.data.windows.find((x) => x.id === sel.id);
        if (w?.wallId === id) nextSel = null;
      }
      return {
        data: {
          ...prev.data,
          walls: prev.data.walls.filter((w) => w.id !== id),
          doors: prev.data.doors.filter((d) => d.wallId !== id),
          windows: prev.data.windows.filter((w) => w.wallId !== id),
        },
        selection: nextSel,
        dirty: true,
      };
    });
  },

  deleteRoom(id) {
    set((prev) => ({
      data: { ...prev.data, rooms: prev.data.rooms.filter((r) => r.id !== id) },
      selection:
        prev.selection?.type === 'room' && prev.selection.id === id ? null : prev.selection,
      dirty: true,
    }));
  },

  deleteDoor(id) {
    set((prev) => ({
      data: { ...prev.data, doors: prev.data.doors.filter((d) => d.id !== id) },
      selection:
        prev.selection?.type === 'door' && prev.selection.id === id ? null : prev.selection,
      dirty: true,
    }));
  },

  deleteWindow(id) {
    set((prev) => ({
      data: { ...prev.data, windows: prev.data.windows.filter((w) => w.id !== id) },
      selection:
        prev.selection?.type === 'window' && prev.selection.id === id ? null : prev.selection,
      dirty: true,
    }));
  },

  deleteSelected() {
    const sel = get().selection;
    if (!sel) return;
    if (sel.type === 'wall') get().deleteWall(sel.id);
    else if (sel.type === 'room') get().deleteRoom(sel.id);
    else if (sel.type === 'door') get().deleteDoor(sel.id);
    else get().deleteWindow(sel.id);
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

  updateDoor(id, patch) {
    set((prev) => {
      const door = prev.data.doors.find((d) => d.id === id);
      if (!door) return prev;
      const nextWallId = patch.wallId ?? door.wallId;
      const wall = prev.data.walls.find((w) => w.id === nextWallId);
      if (!wall) return prev;
      const width = patch.width ?? door.width;
      const height = patch.height ?? door.height;
      let position = patch.position ?? door.position;
      position = clampPositionForOpeningOnWall(wall, position, width);
      return {
        data: {
          ...prev.data,
          doors: prev.data.doors.map((d) =>
            d.id === id ? { ...d, wallId: nextWallId, position, width, height } : d,
          ),
        },
        dirty: true,
      };
    });
  },

  updateWindow(id, patch) {
    set((prev) => {
      const win = prev.data.windows.find((w) => w.id === id);
      if (!win) return prev;
      const nextWallId = patch.wallId ?? win.wallId;
      const wall = prev.data.walls.find((w) => w.id === nextWallId);
      if (!wall) return prev;
      const width = patch.width ?? win.width;
      const height = patch.height ?? win.height;
      const sillHeight = patch.sillHeight ?? win.sillHeight;
      let position = patch.position ?? win.position;
      position = clampPositionForOpeningOnWall(wall, position, width);
      return {
        data: {
          ...prev.data,
          windows: prev.data.windows.map((w) =>
            w.id === id
              ? { ...w, wallId: nextWallId, position, width, height, sillHeight }
              : w,
          ),
        },
        dirty: true,
      };
    });
  },

  getPlanData() {
    const d = get().data;
    if (d.meta.schemaVersion !== FLOOR_PLAN_SCHEMA_VERSION) {
      throw new Error(
        `Editor domain state has wrong schemaVersion=${d.meta.schemaVersion}, expected ${FLOOR_PLAN_SCHEMA_VERSION}`,
      );
    }
    return d;
  },
}));
