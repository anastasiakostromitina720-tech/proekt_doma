'use client';

import type Konva from 'konva';
import type { Wall } from '@app/contracts';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Layer, Line } from 'react-konva';

import type { Point } from '../../model/geometry';
import type { Selection, Tool } from '../../model/editor.store';

interface Props {
  walls: Wall[];
  tool: Tool;
  selection: Selection;
  onPick(id: string): void;
  /** Door/window tools: wall click with world-space pointer. */
  onPlaceOpening?: (wallId: string, world: Point) => void;
}

function pointerToWorld(stage: Konva.Stage | null | undefined): Point | null {
  if (!stage) return null;
  const pointer = stage.getPointerPosition();
  if (!pointer) return null;
  return stage.getAbsoluteTransform().copy().invert().point(pointer);
}

/**
 * Walls render below openings. For `door` / `window` tools the layer
 * stays interactive so placement clicks hit the wall segment first
 * (openings layer sets `listening={false}` in those modes).
 */
export function WallsLayer({ walls, tool, selection, onPick, onPlaceOpening }: Props) {
  const selectOrDelete = tool === 'select' || tool === 'delete';
  const placeOpening = tool === 'door' || tool === 'window';
  const interactive = selectOrDelete || placeOpening;

  const handlers = (id: string) => ({
    onClick: (e: KonvaEventObject<MouseEvent>) => {
      if (placeOpening && onPlaceOpening) {
        e.cancelBubble = true;
        const world = pointerToWorld(e.target.getStage());
        if (world) onPlaceOpening(id, world);
        return;
      }
      if (!selectOrDelete) return;
      e.cancelBubble = true;
      onPick(id);
    },
    onTap: (e: KonvaEventObject<TouchEvent>) => {
      if (placeOpening && onPlaceOpening) {
        e.cancelBubble = true;
        const world = pointerToWorld(e.target.getStage());
        if (world) onPlaceOpening(id, world);
        return;
      }
      if (!selectOrDelete) return;
      e.cancelBubble = true;
      onPick(id);
    },
  });

  return (
    <Layer listening={interactive}>
      {walls.map((w) => {
        const selected = selection?.type === 'wall' && selection.id === w.id;
        return (
          <Line
            key={w.id}
            points={[w.start.x, w.start.y, w.end.x, w.end.y]}
            stroke={selected ? '#2563eb' : '#0f172a'}
            strokeWidth={w.thickness}
            lineCap="square"
            hitStrokeWidth={Math.max(w.thickness, 0.3)}
            {...handlers(w.id)}
          />
        );
      })}
    </Layer>
  );
}
