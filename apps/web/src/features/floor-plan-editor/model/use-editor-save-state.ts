'use client';

import { useFloorPlan, type UseFloorPlanResult } from '@/features/floor-plan';

import { useEditorStore } from './editor.store';

/**
 * Shape returned by `useEditorSaveState`. Extends the persistence-layer
 * result with two derived flags the editor UI depends on. Centralising
 * the derivation prevents components from reinventing slightly
 * different versions of the same predicate.
 */
export interface EditorSaveState extends UseFloorPlanResult {
  /**
   * True iff the user has local unsaved edits and the save pipeline is
   * in a state that can accept a new save. False while saving is in
   * flight, while a conflict is unresolved, and when the plan is not
   * yet loaded. Also false when nothing has changed — there is no
   * point in calling PUT without edits.
   */
  canSave: boolean;

  /**
   * True iff the editor should refuse to apply any domain mutation
   * right now. Used to gate:
   *   - committing a draft wall/room,
   *   - deleting via the `delete` tool or the Delete/Backspace key,
   *   - edits to selected-element properties in the side panel.
   *
   * By design this is NOT used to gate pan, zoom, tool switches, or
   * selection — those are pure UI interactions that never touch
   * `data`.
   */
  isMutatingBlocked: boolean;
}

/**
 * Composes the floor-plan persistence-layer hook with the editor
 * store's `dirty` flag to expose a single, canonical source of
 * save-related derived booleans.
 *
 * Only one component in the tree (the editor page) calls this hook;
 * the flags travel downstream as props. This is deliberate — if two
 * components each called it, they'd open two subscriptions to
 * `useFloorPlan` and risk divergent views of save state.
 */
export function useEditorSaveState(projectId: string): EditorSaveState {
  const floorPlan = useFloorPlan(projectId);
  const dirty = useEditorStore((s) => s.dirty);

  const isMutatingBlocked =
    floorPlan.loadStatus !== 'ready' || floorPlan.saveStatus === 'saving';

  const canSave =
    floorPlan.loadStatus === 'ready' &&
    floorPlan.saveStatus !== 'saving' &&
    floorPlan.saveStatus !== 'conflict' &&
    dirty;

  return {
    ...floorPlan,
    canSave,
    isMutatingBlocked,
  };
}
