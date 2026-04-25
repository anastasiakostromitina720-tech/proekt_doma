import { ProjectRedesignPage } from '@/features/ai-redesign';

export const metadata = {
  title: 'AI редизайн',
};

interface Props {
  params: { projectId: string };
}

export default function Page({ params }: Props) {
  return <ProjectRedesignPage projectId={params.projectId} />;
}
