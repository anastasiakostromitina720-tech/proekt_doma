'use client';

import { type Project, type ProjectType } from '@app/contracts';
import Link from 'next/link';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/shared/api/client';

interface ProjectCardProps {
  project: Project;
  onRename: (id: string, name: string) => Promise<void>;
  /**
   * Fire-and-forget — the parent owns error handling because the card
   * is unmounted optimistically before the request resolves.
   */
  onDelete: (id: string) => void;
}

const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  HOUSE: 'Частный дом',
  APARTMENT: 'Квартира',
  OTHER: 'Другое',
};

const formatDate = (iso: string): string => {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export function ProjectCard({ project, onRename, onDelete }: ProjectCardProps) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(project.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit = (): void => {
    setDraftName(project.name);
    setError(null);
    setEditing(true);
  };

  const cancelEdit = (): void => {
    setDraftName(project.name);
    setError(null);
    setEditing(false);
  };

  const commitEdit = async (): Promise<void> => {
    const trimmed = draftName.trim();
    if (trimmed.length === 0) {
      setError('Название не может быть пустым');
      return;
    }
    if (trimmed === project.name) {
      cancelEdit();
      return;
    }

    setPending(true);
    setError(null);
    try {
      await onRename(project.id, trimmed);
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось переименовать');
    } finally {
      setPending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  const handleDelete = (): void => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `Удалить проект «${project.name}»? Это действие нельзя отменить.`,
      );
      if (!confirmed) return;
    }
    onDelete(project.id);
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        {editing ? (
          <div className="flex w-full flex-col gap-2">
            <Input
              ref={inputRef}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={pending}
              maxLength={200}
              aria-invalid={!!error}
              aria-label="Новое название проекта"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={commitEdit} disabled={pending}>
                {pending ? 'Сохраняем…' : 'Сохранить'}
              </Button>
              <Button size="sm" variant="outline" onClick={cancelEdit} disabled={pending}>
                Отмена
              </Button>
            </div>
          </div>
        ) : (
          <CardTitle className="flex-1 break-words">{project.name}</CardTitle>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-3 text-sm">
        {project.description ? (
          <p className="line-clamp-3 text-muted-foreground">{project.description}</p>
        ) : (
          <p className="italic text-muted-foreground/70">Без описания</p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium">
            {PROJECT_TYPE_LABELS[project.type]}
          </span>
          <span>Обновлён {formatDate(project.updatedAt)}</span>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </CardContent>

      <CardFooter className="flex w-full flex-col gap-3 border-t pt-4">
        {!editing ? (
          <>
            <p className="w-full text-xs font-medium text-muted-foreground">Действия</p>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              <Button variant="default" size="sm" asChild className="w-full justify-center" disabled={pending}>
                <Link href={`/projects/${project.id}/floor-plan`}>2D редактор</Link>
              </Button>
              <Button variant="secondary" size="sm" asChild className="w-full justify-center" disabled={pending}>
                <Link href={`/projects/${project.id}/viewer`}>3D просмотр</Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="w-full justify-center" disabled={pending}>
                <Link href={`/projects/${project.id}/media`}>Медиа</Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="w-full justify-center" disabled={pending}>
                <Link href={`/projects/${project.id}/redesign`}>AI редизайн</Link>
              </Button>
            </div>
            <div className="flex w-full flex-wrap justify-end gap-2 border-t border-border/60 pt-3">
              <Button variant="outline" size="sm" onClick={startEdit} disabled={pending}>
                Переименовать
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={pending}>
                Удалить
              </Button>
            </div>
          </>
        ) : null}
      </CardFooter>
    </Card>
  );
}
