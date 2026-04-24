'use client';

import type { FloorPlanData } from '@app/contracts';
import { Canvas } from '@react-three/fiber';

import { SceneContent } from './scene-content';

interface Props {
  data: FloorPlanData;
}

/**
 * WebGL entry. Kept in its own module so the route can `dynamic(..., { ssr: false })`
 * and Next never executes R3F/three on the server.
 */
export function ViewerCanvas({ data }: Props) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [18, 14, 18], fov: 50, near: 0.1, far: 500 }}
      gl={{ antialias: true }}
    >
      <SceneContent data={data} />
    </Canvas>
  );
}
