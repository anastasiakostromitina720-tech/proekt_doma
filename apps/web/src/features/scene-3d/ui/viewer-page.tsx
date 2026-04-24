'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';

import { Button } from '@/components/ui/button';
import { useFloorPlan } from '@/features/floor-plan';
import { routes } from '@/shared/config/routes';

import { isPlanGeometryEmpty } from '../model/plan-to-scene';

const ViewerCanvas = dynamic(
  () => import('./viewer-canvas').then((m) => m.ViewerCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[420px] w-full items-center justify-center rounded-md border bg-muted/20 text-sm text-muted-foreground">
        Инициализация WebGL…
      </div>
    ),
  },
);

interface Props {
  projectId: string;
}

export function ViewerPage({ projectId }: Props) {
  const { plan, loadStatus, loadError, reload } = useFloorPlan(projectId);

  if (loadStatus === 'error') {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 p-4 text-center">
        <p className="text-sm text-destructive">
          {loadError ?? 'Не удалось загрузить floor plan'}
        </p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => void reload()}>
            Повторить
          </Button>
          <Button variant="ghost" asChild>
            <Link href={routes.dashboard.projects}>К проектам</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col gap-4">
        <ViewerNav projectId={projectId} />
        <div className="flex h-[min(70vh,560px)] w-full items-center justify-center rounded-md border bg-muted/30">
          <p className="text-sm text-muted-foreground">Загружаем план…</p>
        </div>
      </div>
    );
  }

  const data = plan.data;

  if (isPlanGeometryEmpty(data)) {
    return (
      <div className="flex flex-col gap-4">
        <ViewerNav projectId={projectId} />
        <div className="flex h-[min(70vh,560px)] w-full flex-col items-center justify-center gap-3 rounded-md border bg-muted/20 p-8 text-center">
          <p className="text-sm font-medium">В плане пока нет стен и комнат</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Добавьте элементы в 2D-редакторе и сохраните план — здесь появится read-only превью.
          </p>
          <Button asChild size="sm">
            <Link href={`/projects/${projectId}/floor-plan`}>Открыть редактор</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ViewerNav projectId={projectId} />
      <div className="h-[min(70vh,640px)] w-full overflow-hidden rounded-md border bg-white shadow-sm">
        <ViewerCanvas data={data} />
      </div>
      <p className="text-xs text-muted-foreground">
        ЛКМ — вращение, колесо — зум, ПКМ — панорама. Только просмотр; редактирование — в 2D.
      </p>
    </div>
  );
}

function ViewerNav({ projectId }: { projectId: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <Link
        href={routes.dashboard.projects}
        className="rounded-md px-2 py-1 transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        ← Проекты
      </Link>
      <span className="text-border">|</span>
      <Link
        href={`/projects/${projectId}/floor-plan`}
        className="rounded-md px-2 py-1 transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        2D редактор
      </Link>
      <span className="ml-auto font-mono text-xs text-muted-foreground/80">3D · read-only</span>
    </div>
  );
}
