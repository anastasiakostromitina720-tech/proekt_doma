import { EditorPage } from '@/features/floor-plan-editor';

export const metadata = {
  title: 'Floor plan · editor',
};

interface Props {
  params: { projectId: string };
}

export default function Page({ params }: Props) {
  return <EditorPage projectId={params.projectId} />;
}
