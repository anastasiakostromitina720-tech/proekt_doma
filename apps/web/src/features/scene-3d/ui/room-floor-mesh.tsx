'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

import type { RoomFloorShape } from '../model/plan-to-scene';
import { roomFloorShapeToPositions } from '../model/plan-to-scene';

export function RoomFloorMesh({ shape }: { shape: RoomFloorShape }) {
  const geometry = useMemo(() => {
    const positions = roomFloorShapeToPositions(shape);
    if (positions.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  }, [shape.roomId, shape.floorY, shape.floorLevel, shape.outlineXZ]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} position={[0, shape.floorY, 0]} receiveShadow>
      <meshStandardMaterial
        color="#94a3b8"
        roughness={0.85}
        metalness={0.02}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
