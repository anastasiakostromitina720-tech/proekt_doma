'use client';

import type { FloorPlanData } from '@app/contracts';
import { Grid, OrbitControls } from '@react-three/drei';
import { useMemo } from 'react';

import {
  collectOpeningMarkers,
  roomToFloorShape,
  wallToMeshProps,
  type OpeningMarkerProps,
  type RoomFloorShape,
  type WallMeshProps,
} from '../model/plan-to-scene';

import { RoomFloorMesh } from './room-floor-mesh';
import { WallMesh } from './wall-mesh';

interface Props {
  data: FloorPlanData;
}

/**
 * Read-only scene graph derived from `FloorPlanData`. No fetch, no Zustand —
 * only pure conversion helpers + presentational meshes.
 */
export function SceneContent({ data }: Props) {
  const walls = useMemo((): WallMeshProps[] => {
    const out: WallMeshProps[] = [];
    for (const w of data.walls) {
      const p = wallToMeshProps(w);
      if (p) out.push(p);
    }
    return out;
  }, [data.walls]);

  const roomShapes = useMemo(() => data.rooms.map(roomToFloorShape), [data.rooms]);

  const openingMarkers = useMemo((): OpeningMarkerProps[] => collectOpeningMarkers(data), [data]);

  return (
    <>
      <color attach="background" args={['#f8fafc']} />

      <ambientLight intensity={0.52} />
      <directionalLight
        position={[14, 24, 12]}
        intensity={1.05}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <hemisphereLight args={['#e2e8f0', '#64748b', 0.38]} />

      <Grid
        infiniteGrid
        fadeDistance={45}
        fadeStrength={1}
        sectionColor="#94a3b8"
        cellColor="#cbd5e1"
        sectionSize={5}
        cellSize={data.meta.gridSize}
        position={[0, 0, 0]}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>

      {walls.map((w) => (
        <WallMesh key={w.wallId} wall={w} />
      ))}
      {openingMarkers.map((m) => (
        <mesh
          key={`${m.kind}-${m.openingId}`}
          position={m.position}
          rotation={m.rotation}
          castShadow
        >
          <boxGeometry args={m.boxArgs} />
          <meshStandardMaterial
            color={m.color}
            emissive={m.color}
            emissiveIntensity={0.12}
          />
        </mesh>
      ))}
      {roomShapes.map((s: RoomFloorShape) => (
        <RoomFloorMesh key={s.roomId} shape={s} />
      ))}

      <OrbitControls
        makeDefault
        minDistance={1.5}
        maxDistance={160}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 0, 0]}
      />
    </>
  );
}
