import { ViewerPage } from '@/features/scene-3d';

export const metadata = {
  title: '3D просмотр плана',
};

interface Props {
  params: { projectId: string };
}

export default function Page({ params }: Props) {
  return <ViewerPage projectId={params.projectId} />;
}
