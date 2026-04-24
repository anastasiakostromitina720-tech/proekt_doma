'use client';

import type { WallMeshProps } from '../model/plan-to-scene';

export function WallMesh({ wall }: { wall: WallMeshProps }) {
  return (
    <mesh
      position={wall.position}
      rotation={wall.rotation}
      castShadow
      receiveShadow
    >
      <boxGeometry args={wall.boxArgs} />
      <meshStandardMaterial color="#334155" roughness={0.72} metalness={0.06} />
    </mesh>
  );
}
