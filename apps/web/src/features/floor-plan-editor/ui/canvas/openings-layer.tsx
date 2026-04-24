'use client';

import type { Door, Wall, Window as PlanWindow } from '@app/contracts';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Fragment } from 'react';
import { Arc, Group, Layer, Line } from 'react-konva';

import type { Selection, Tool } from '../../model/editor.store';
import {
  wallPointAt,
  wallSegmentLength,
  wallUnitNormal,
  wallUnitTangent,
} from '../../model/wall-openings';

interface Props {
  walls: Wall[];
  doors: Door[];
  windows: PlanWindow[];
  tool: Tool;
  selection: Selection;
  onPickDoor(id: string): void;
  onPickWindow(id: string): void;
}

/**
 * Read-only 2D glyphs for doors (opening segment + swing arc) and
 * windows (segment + perpendicular tick). Domain remains `doors` /
 * `windows` arrays on `FloorPlanData`.
 */
export function OpeningsLayer({
  walls,
  doors,
  windows,
  tool,
  selection,
  onPickDoor,
  onPickWindow,
}: Props) {
  const wallMap = new Map(walls.map((w) => [w.id, w]));
  const listening = tool === 'select' || tool === 'delete';

  const doorHandlers = (id: string) => ({
    onClick: (e: KonvaEventObject<MouseEvent>) => {
      if (!listening) return;
      e.cancelBubble = true;
      onPickDoor(id);
    },
    onTap: (e: KonvaEventObject<TouchEvent>) => {
      if (!listening) return;
      e.cancelBubble = true;
      onPickDoor(id);
    },
  });

  const windowHandlers = (id: string) => ({
    onClick: (e: KonvaEventObject<MouseEvent>) => {
      if (!listening) return;
      e.cancelBubble = true;
      onPickWindow(id);
    },
    onTap: (e: KonvaEventObject<TouchEvent>) => {
      if (!listening) return;
      e.cancelBubble = true;
      onPickWindow(id);
    },
  });

  return (
    <Layer listening={listening}>
      {doors.map((d) => {
        const w = wallMap.get(d.wallId);
        if (!w) return null;
        const C = wallPointAt(w, d.position);
        const u = wallUnitTangent(w);
        const half = d.width / 2;
        const hx = u.x * half;
        const hy = u.y * half;
        const selected = selection?.type === 'door' && selection.id === d.id;
        const thetaDeg = (Math.atan2(u.y, u.x) * 180) / Math.PI;
        const arcR = Math.min(d.width, Math.max(wallSegmentLength(w), d.width) * 0.35) * 0.45;
        const hingeX = C.x - hx;
        const hingeY = C.y - hy;
        return (
          <Fragment key={d.id}>
            <Group>
              <Line
                points={[C.x - hx, C.y - hy, C.x + hx, C.y + hy]}
                stroke={selected ? '#b45309' : '#ea580c'}
                strokeWidth={Math.max(0.06, w.thickness * 0.28)}
                lineCap="round"
                hitStrokeWidth={0.45}
                {...doorHandlers(d.id)}
              />
              <Arc
                x={hingeX}
                y={hingeY}
                innerRadius={0}
                outerRadius={arcR}
                angle={180}
                rotation={thetaDeg + 90}
                stroke={selected ? '#b45309' : '#c2410c'}
                strokeWidth={0.05}
                fill="rgba(234,88,12,0.14)"
                listening={false}
              />
            </Group>
          </Fragment>
        );
      })}
      {windows.map((win) => {
        const w = wallMap.get(win.wallId);
        if (!w) return null;
        const C = wallPointAt(w, win.position);
        const u = wallUnitTangent(w);
        const half = win.width / 2;
        const hx = u.x * half;
        const hy = u.y * half;
        const selected = selection?.type === 'window' && selection.id === win.id;
        const n = wallUnitNormal(w);
        const tick = Math.max(0.06, w.thickness * 0.4);
        return (
          <Group key={win.id}>
            <Line
              points={[C.x - hx, C.y - hy, C.x + hx, C.y + hy]}
              stroke={selected ? '#075985' : '#0284c7'}
              strokeWidth={Math.max(0.05, w.thickness * 0.22)}
              lineCap="square"
              hitStrokeWidth={0.4}
              {...windowHandlers(win.id)}
            />
            <Line
              points={[C.x - n.x * tick, C.y - n.y * tick, C.x + n.x * tick, C.y + n.y * tick]}
              stroke={selected ? '#075985' : '#0ea5e9'}
              strokeWidth={2}
              strokeScaleEnabled={false}
              listening={false}
            />
          </Group>
        );
      })}
    </Layer>
  );
}
