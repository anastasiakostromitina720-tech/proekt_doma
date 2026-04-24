'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/shared/api/client';

import { useProjects } from '../model/use-projects';
import { CreateProjectForm } from './create-project-form';
import { EmptyState } from './empty-state';
import { ProjectCard } from './project-card';

export function ProjectsPage() {
  const { projects, status, error, create, rename, remove, refresh } = useProjects();
  const [creating, setCreating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const openCreate = (): void => {
    setMutationError(null);
    setCreating(true);
  };
  const closeCreate = (): void => setCreating(false);

  const handleDelete = (id: string): void => {
    setMutationError(null);
    // Optimistic: the card unmounts immediately; we surface errors here.
    remove(id).catch((e) => {
      const message =
        e instanceof ApiError
          ? e.status === 404
            ? 'Проект уже удалён или недоступен'
            : e.message
          : 'Не удалось удалить проект';
      setMutationError(message);
    });
  };

  const handleRename = async (id: string, name: string): Promise<void> => {
    setMutationError(null);
    try {
      await rename(id, name);
    } catch (e) {
      const message =
        e instanceof ApiError
          ? e.status === 404
            ? 'Проект больше не существует'
            : e.message
          : 'Не удалось переименовать проект';
      setMutationError(message);
      // Re-throw so the card can show its inline error AND stay in edit mode.
      throw e;
    }
  };

  const isInitialLoading = status === 'loading' && projects.length === 0;
  const showEmpty = status === 'ready' && projects.length === 0 && !creating;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Мои проекты</h1>
          <p className="text-sm text-muted-foreground">
            Создавайте и управляйте проектами домов и квартир.
          </p>
        </div>
        {!creating && status === 'ready' && projects.length > 0 ? (
          <Button onClick={openCreate}>Создать проект</Button>
        ) : null}
      </header>

      {creating ? (
        <CreateProjectForm
          onSubmit={async (input) => {
            setMutationError(null);
            await create(input);
          }}
          onCancel={closeCreate}
        />
      ) : null}

      {mutationError ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{mutationError}</span>
          <Button variant="outline" size="sm" onClick={() => setMutationError(null)}>
            Закрыть
          </Button>
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{error ?? 'Не удалось загрузить проекты'}</span>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            Повторить
          </Button>
        </div>
      ) : null}

      {isInitialLoading ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed py-16 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-3">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Загружаем проекты…
          </span>
        </div>
      ) : null}

      {showEmpty ? <EmptyState onCreate={openCreate} /> : null}

      {projects.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
