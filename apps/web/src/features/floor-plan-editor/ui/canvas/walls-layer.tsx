'use client';

import type { Wall } from '@app/contracts';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Layer, Line } from 'react-konva';

import type { Selection, Tool } from '../../model/editor.store';

interface Props {
  walls: Wall[];
  tool: Tool;
  selection: Selection;
  onPick(id: string): void;
}

/**
 * Renders each wall as a Konva `Line` with `strokeWidth = wall.thickness`
 * in world-units (metres). Because the Stage applies the scale
 * transform, a 0.2m-thick wall naturally scales with zoom — which is
 * exactly how a real wall should feel.
 *
 * Only `select` and `delete` tools treat walls as interactive; during
 * `wall` or `room` drawing we turn listening off so a click on an
 * existing wall doesn't hijack the drawing gesture.
 */
export function WallsLayer({ walls, tool, selection, onPick }: Props) {
  const interactive = tool === 'select' || tool === 'delete';

  const handlers = (id: string) => ({
    onClick: (e: KonvaEventObject<MouseEvent>) => {
      if (!interactive) return;
      e.cancelBubble = true;
      onPick(id);
    },
    onTap: (e: KonvaEventObject<TouchEvent>) => {
      if (!interactive) return;
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
