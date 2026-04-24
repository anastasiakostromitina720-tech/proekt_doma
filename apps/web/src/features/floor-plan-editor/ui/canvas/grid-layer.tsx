'use client';

import { Layer, Line } from 'react-konva';

interface Props {
  /** Stage width/height in screen pixels. */
  width: number;
  height: number;
  /** Pixels-per-metre (from editor store `scale`). */
  scale: number;
  /** Stage pan in pixels (from editor store `pan`). */
  panX: number;
  panY: number;
  /** Grid step in metres (from `data.meta.gridSize`). */
  gridSize: number;
}

/**
 * Renders a light grid that follows pan/zoom.
 *
 * We draw lines in WORLD coordinates (metres) and let the parent
 * Stage's scale/translate transform place them. `strokeScaleEnabled`
 * is `false` so lines stay crisp at any zoom.
 *
 * To avoid rendering millions of lines at low zoom we cap density: if
 * the grid step would fall below ~6 screen pixels, we skip (blank
 * background is better than noise).
 */
export function GridLayer({ width, height, scale, panX, panY, gridSize }: Props) {
  const screenStep = gridSize * scale;
  if (screenStep < 6) {
    return null;
  }

  // Visible world bounds — (screen(0,0) → world) to (screen(W,H) → world).
  const minX = (0 - panX) / scale;
  const minY = (0 - panY) / scale;
  const maxX = (width - panX) / scale;
  const maxY = (height - panY) / scale;

  const startX = Math.floor(minX / gridSize) * gridSize;
  const startY = Math.floor(minY / gridSize) * gridSize;
  const endX = Math.ceil(maxX / gridSize) * gridSize;
  const endY = Math.ceil(maxY / gridSize) * gridSize;

  const lines: React.ReactElement[] = [];

  for (let x = startX; x <= endX; x += gridSize) {
    // Every 10th line (1m multiples when gridSize=0.5 × 2? actually every 5m)
    // gets emphasised. We use a simple "integer-metre" check, which is
    // stable regardless of gridSize.
    const major = Math.abs(x - Math.round(x)) < 1e-6 && Math.round(x) % 5 === 0;
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, startY, x, endY]}
        stroke={major ? '#cbd5e1' : '#e5e7eb'}
        strokeWidth={major ? 1.2 : 1}
        strokeScaleEnabled={false}
        listening={false}
      />,
    );
  }

  for (let y = startY; y <= endY; y += gridSize) {
    const major = Math.abs(y - Math.round(y)) < 1e-6 && Math.round(y) % 5 === 0;
    lines.push(
      <Line
        key={`h-${y}`}
        points={[startX, y, endX, y]}
        stroke={major ? '#cbd5e1' : '#e5e7eb'}
        strokeWidth={major ? 1.2 : 1}
        strokeScaleEnabled={false}
        listening={false}
      />,
    );
  }

  // Origin axes — useful for orientation.
  lines.push(
    <Line
      key="origin-x"
      points={[startX, 0, endX, 0]}
      stroke="#94a3b8"
      strokeWidth={1.5}
      strokeScaleEnabled={false}
      listening={false}
    />,
    <Line
      key="origin-y"
      points={[0, startY, 0, endY]}
      stroke="#94a3b8"
      strokeWidth={1.5}
      strokeScaleEnabled={false}
      listening={false}
    />,
  );

  return <Layer listening={false}>{lines}</Layer>;
}
