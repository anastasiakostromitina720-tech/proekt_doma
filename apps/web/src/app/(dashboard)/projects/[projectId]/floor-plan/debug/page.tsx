import { FloorPlanDebugView } from '@/features/floor-plan';

export const metadata = {
  title: 'Floor plan · debug',
};

interface Props {
  params: { projectId: string };
}

/**
 * Legacy debug route kept for persistence-layer smoke tests. Shows
 * schemaVersion/version/counts and raw reload/save controls without
 * the canvas. Useful when investigating save/load regressions
 * independently of the editor.
 */
export default function Page({ params }: Props) {
  return <FloorPlanDebugView projectId={params.projectId} />;
}
