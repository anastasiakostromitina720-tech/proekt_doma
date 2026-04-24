'use client';

import { Layer, Line, Circle } from 'react-konva';

import type { Draft } from '../../model/editor.store';
import { constrainOrtho } from '../../model/ortho';
import { rectanglePolygon, flattenPoints } from '../../model/geometry';

interface Props {
  draft: Draft;
}

/**
 * Renders the ephemeral "being drawn" shape driven by the active tool.
 * Reads the store's `draft` — a discriminated union on `type`:
 *
 *   - { type: 'wall', start, current }  → dashed line start → ortho(current)
 *   - { type: 'room', start, current }  → dashed rectangle between corners
 *
 * This layer never mutates state; it only mirrors `draft`. The commit
 * happens on the second click in `EditorCanvas`.
 */
export function PreviewLayer({ draft }: Props) {
  if (!draft) return null;

  if (draft.type === 'wall') {
    const { start, current } = draft;
    return (
      <Layer listening={false}>
        <Circle
          x={start.x}
          y={start.y}
          radius={4}
          fill="#2563eb"
          strokeScaleEnabled={false}
        />
        {current ? (
          (() => {
            const end = constrainOrtho(start, current);
            return (
              <Line
                points={[start.x, start.y, end.x, end.y]}
                stroke="#2563eb"
                strokeWidth={2}
                dash={[8, 6]}
                strokeScaleEnabled={false}
              />
            );
          })()
        ) : null}
      </Layer>
    );
  }

  // Room preview — axis-aligned rectangle in MVP.
  const { start, current } = draft;
  return (
    <Layer listening={false}>
      <Circle
        x={start.x}
        y={start.y}
        radius={4}
        fill="#2563eb"
        strokeScaleEnabled={false}
      />
      {current ? (
        (() => {
          const poly = rectanglePolygon(start, current);
          return (
            <Line
              points={flattenPoints(poly)}
              closed
              fill="rgba(37, 99, 235, 0.08)"
              stroke="#2563eb"
              strokeWidth={2}
              dash={[8, 6]}
              strokeScaleEnabled={false}
            />
          );
        })()
      ) : null}
    </Layer>
  );
}
