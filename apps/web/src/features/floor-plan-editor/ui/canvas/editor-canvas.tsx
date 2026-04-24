'use client';

import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useEffect, useRef } from 'react';
import { Stage } from 'react-konva';

import { useCanvasSize } from '../../hooks/use-canvas-size';
import { useEditorStore, type EditorState } from '../../model/editor.store';
import { constrainOrtho } from '../../model/ortho';
import { snapPoint } from '../../model/snap';

import { GridLayer } from './grid-layer';
import { WallsLayer } from './walls-layer';
import { RoomsLayer } from './rooms-layer';
import { PreviewLayer } from './preview-layer';

interface Props {
  /**
   * When true, domain mutations are refused:
   *   - draft commits / begins (wall, room)
   *   - shape deletion in `delete` tool
   *   - Delete via keyboard (handled by keyboard hook)
   *
   * Pan, zoom, and selection remain available so the user can continue
   * navigating the plan while the save request is in flight.
   */
  isMutatingBlocked: boolean;
}

const ZOOM_MIN = 20;
const ZOOM_MAX = 400;
const ZOOM_STEP = 1.1;

/**
 * Converts a pointer event's stage-space coordinates into world-space
 * (metres) by inverting the stage's transform. Konva exposes this as
 * `getRelativePointerPosition` on most nodes, but on the Stage itself
 * we have to build it manually from its transform.
 */
function getWorldPoint(stage: Konva.Stage): { x: number; y: number } | null {
  const pointer = stage.getPointerPosition();
  if (!pointer) return null;
  const transform = stage.getAbsoluteTransform().copy().invert();
  return transform.point(pointer);
}

/**
 * The one place pointer events are routed into editor actions.
 * Shape-level handlers (wall/room click) live in their own layers and
 * call `cancelBubble` to prevent these stage-level handlers from
 * firing on top.
 */
export function EditorCanvas({ isMutatingBlocked }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const panStateRef = useRef<
    | null
    | {
        startPointerX: number;
        startPointerY: number;
        startPanX: number;
        startPanY: number;
      }
  >(null);

  const size = useCanvasSize(containerRef);

  // Subscribe to the specific slices this component re-renders on.
  // Keeping these as individual selectors avoids re-rendering the whole
  // editor when an unrelated field (e.g. `dirty`) changes.
  const tool = useEditorStore((s) => s.tool);
  const selection = useEditorStore((s) => s.selection);
  const draft = useEditorStore((s) => s.draft);
  const scale = useEditorStore((s) => s.scale);
  const pan = useEditorStore((s) => s.pan);
  const walls = useEditorStore((s) => s.data.walls);
  const rooms = useEditorStore((s) => s.data.rooms);
  const gridSize = useEditorStore((s) => s.data.meta.gridSize);

  // Centre the view on first mount so the origin is roughly in the middle.
  useEffect(() => {
    if (size.width === 0 || size.height === 0) return;
    const store = useEditorStore.getState();
    if (store.pan.x === 0 && store.pan.y === 0) {
      store.setPan({ x: size.width / 2, y: size.height / 2 });
    }
  }, [size.width, size.height]);

  // Zoom — always allowed. Never a mutation.
  //
  // NB: we read `scale` and `pan` from the Zustand store, NOT from
  // `stage.scaleX()` / `stage.x()`. React-Konva only commits the new
  // transform to the Stage on re-render; Zustand updates synchronously.
  // Two wheel events inside the same React batch therefore see stale
  // values on the Stage but fresh values in the store — reading from
  // the store lets rapid-fire scroll compound through multiple zoom
  // steps instead of stalling at the first one.
  //
  // Only `stage.getPointerPosition()` still goes through Konva, because
  // it's the one piece of state we don't own (cursor position relative
  // to the canvas viewport).
  const handleWheel = (e: KonvaEventObject<WheelEvent>): void => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const store = useEditorStore.getState();
    const oldScale = store.scale;
    const oldPan = store.pan;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.min(
      ZOOM_MAX,
      Math.max(ZOOM_MIN, direction > 0 ? oldScale * ZOOM_STEP : oldScale / ZOOM_STEP),
    );

    // Keep the world point under the cursor fixed.
    const worldBefore = {
      x: (pointer.x - oldPan.x) / oldScale,
      y: (pointer.y - oldPan.y) / oldScale,
    };
    const newPan = {
      x: pointer.x - worldBefore.x * newScale,
      y: pointer.y - worldBefore.y * newScale,
    };

    store.setScale(newScale);
    store.setPan(newPan);
  };

  // Middle-mouse-button pan — always allowed. Never a mutation.
  //
  // Starting pan reads from the store (same rationale as handleWheel):
  // a pointer-down can arrive inside a React batch where the Stage's
  // position hasn't caught up yet.
  const handlePointerDown = (e: KonvaEventObject<PointerEvent>): void => {
    if (e.evt.button !== 1) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    e.evt.preventDefault();
    const storePan = useEditorStore.getState().pan;
    panStateRef.current = {
      startPointerX: pointer.x,
      startPointerY: pointer.y,
      startPanX: storePan.x,
      startPanY: storePan.y,
    };
  };

  const handleStageClick = (e: KonvaEventObject<MouseEvent | TouchEvent>): void => {
    // Konva's `click` fires only for primary button and bubbles up from
    // shapes — ignore if a shape's own handler already consumed it.
    if (e.target !== e.target.getStage()) return;

    const stage = stageRef.current;
    if (!stage) return;
    const world = getWorldPoint(stage);
    if (!world) return;
    const snapped = snapPoint(world, gridSize);

    const store = useEditorStore.getState();

    switch (store.tool) {
      case 'select':
        // Deselect — pure UI, always allowed.
        if (store.selection) store.setSelection(null);
        break;

      case 'wall': {
        // Drawing is a mutation: new entities in `data.walls`.
        if (isMutatingBlocked) return;
        if (store.draft?.type === 'wall') {
          const end = constrainOrtho(store.draft.start, snapped);
          store.commitWall(end);
        } else {
          store.beginWall(snapped);
        }
        break;
      }

      case 'room': {
        if (isMutatingBlocked) return;
        if (store.draft?.type === 'room') {
          store.commitRoom(snapped);
        } else {
          store.beginRoom(snapped);
        }
        break;
      }

      case 'delete':
        // Delete requires clicking a shape. Empty-stage click is a
        // no-op (intentionally — avoids "missed the wall" surprises).
        break;
    }
  };

  const handlePointerMove = (): void => {
    const stage = stageRef.current;
    if (!stage) return;

    // Pan gesture in progress — always allowed.
    if (panStateRef.current) {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const { startPointerX, startPointerY, startPanX, startPanY } = panStateRef.current;
      const nextPan = {
        x: startPanX + (pointer.x - startPointerX),
        y: startPanY + (pointer.y - startPointerY),
      };
      useEditorStore.getState().setPan(nextPan);
      return;
    }

    // Draft preview update. Cheap UI-only state — does NOT set `dirty`
    // and is not considered a mutation for the blocking predicate.
    const store = useEditorStore.getState();
    if (!store.draft) return;

    const world = getWorldPoint(stage);
    if (!world) return;
    const snapped = snapPoint(world, gridSize);
    store.setDraftCurrent(snapped);
  };

  const handlePointerUp = (e: KonvaEventObject<PointerEvent>): void => {
    if (e.evt.button === 1 && panStateRef.current) {
      panStateRef.current = null;
    }
  };

  const handleContextMenu = (e: KonvaEventObject<PointerEvent>): void => {
    // Prevent the browser menu; right-click is reserved for a future
    // context-menu — for MVP it simply cancels an in-progress draft.
    e.evt.preventDefault();
    const store = useEditorStore.getState();
    if (store.draft) store.cancelDraft();
  };

  // Cursor hints. When mutations are blocked but we're in a drawing
  // tool, fall back to `progress` on those tools only — select retains
  // its normal cursor because selection is still available.
  const cursor = (() => {
    switch (tool) {
      case 'wall':
      case 'room':
        return isMutatingBlocked ? 'progress' : 'crosshair';
      case 'delete':
        return isMutatingBlocked ? 'progress' : 'not-allowed';
      default:
        return 'default';
    }
  })();

  const onPickWall = (id: string): void => {
    const store = useEditorStore.getState();
    if (store.tool === 'delete') {
      if (isMutatingBlocked) return;
      store.deleteWall(id);
    } else {
      // Selection on shape click — always allowed.
      store.setSelection({ type: 'wall', id });
    }
  };

  const onPickRoom = (id: string): void => {
    const store = useEditorStore.getState();
    if (store.tool === 'delete') {
      if (isMutatingBlocked) return;
      store.deleteRoom(id);
    } else {
      store.setSelection({ type: 'room', id });
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-white"
      style={{ cursor }}
    >
      {size.width > 0 && size.height > 0 ? (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          scaleX={scale}
          scaleY={scale}
          x={pan.x}
          y={pan.y}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handleStageClick}
          onTap={handleStageClick}
          onContextMenu={handleContextMenu}
        >
          <GridLayer
            width={size.width}
            height={size.height}
            scale={scale}
            panX={pan.x}
            panY={pan.y}
            gridSize={gridSize}
          />
          <RoomsLayer
            rooms={rooms}
            tool={tool}
            selection={selection}
            scale={scale}
            onPick={onPickRoom}
          />
          <WallsLayer walls={walls} tool={tool} selection={selection} onPick={onPickWall} />
          <PreviewLayer draft={draft} />
        </Stage>
      ) : null}

      {/*
        Status pill, not a full-canvas curtain. `pointer-events: none`
        and absolute corner placement keep pan/zoom/selection fully
        interactive while a save is in flight.
      */}
      {isMutatingBlocked ? (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-muted-foreground shadow">
          сохраняю…
        </div>
      ) : null}
    </div>
  );
}

// Re-export the zustand state type so dynamic importers can satisfy
// their TS dependency without pulling the full module graph.
export type { EditorState };
