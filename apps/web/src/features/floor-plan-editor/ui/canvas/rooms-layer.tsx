'use client';

import type { Room } from '@app/contracts';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Fragment } from 'react';
import { Layer, Line, Text } from 'react-konva';

import { flattenPoints, polygonBounds } from '../../model/geometry';
import type { Selection, Tool } from '../../model/editor.store';

interface Props {
  rooms: Room[];
  tool: Tool;
  selection: Selection;
  scale: number;
  onPick(id: string): void;
}

/**
 * Room polygons. MVP rooms are axis-aligned rectangles (see `room`
 * tool in the store), but the renderer is polygon-general so the data
 * model doesn't leak its current "always rectangle" assumption.
 */
export function RoomsLayer({ rooms, tool, selection, scale, onPick }: Props) {
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
      {rooms.map((room) => {
        const points = flattenPoints(room.polygon);
        const selected = selection?.type === 'room' && selection.id === room.id;
        const b = polygonBounds(room.polygon);
        const cx = (b.minX + b.maxX) / 2;
        const cy = (b.minY + b.maxY) / 2;
        return (
          <Fragment key={room.id}>
            <Line
              points={points}
              closed
              fill={selected ? 'rgba(59, 130, 246, 0.18)' : 'rgba(148, 163, 184, 0.12)'}
              stroke={selected ? '#2563eb' : 'transparent'}
              strokeWidth={2}
              strokeScaleEnabled={false}
              {...handlers(room.id)}
            />
            <Text
              text={room.name}
              x={cx}
              y={cy}
              offsetX={(room.name.length * 6) / scale}
              offsetY={7 / scale}
              fontSize={12 / scale}
              fill="#475569"
              listening={false}
            />
          </Fragment>
        );
      })}
    </Layer>
  );
}
