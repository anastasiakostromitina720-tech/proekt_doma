import { ProjectMediaPage } from '@/features/media-upload';

export const metadata = {
  title: 'Медиа проекта',
};

interface Props {
  params: { projectId: string };
}

export default function Page({ params }: Props) {
  return <ProjectMediaPage projectId={params.projectId} />;
}
