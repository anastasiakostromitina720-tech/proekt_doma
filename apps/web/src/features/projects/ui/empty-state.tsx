'use client';

import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  onCreate: () => void;
}

export function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <span aria-hidden className="text-xl font-semibold text-muted-foreground">
          +
        </span>
      </div>
      <h3 className="mt-4 text-base font-semibold">Пока нет проектов</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Создайте первый проект, чтобы начать проектировать планировку, подбирать материалы и
        визуализировать результат.
      </p>
      <Button className="mt-6" onClick={onCreate}>
        Создать проект
      </Button>
    </div>
  );
}
