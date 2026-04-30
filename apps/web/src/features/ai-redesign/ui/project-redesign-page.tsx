'use client';

import {
  type CreateRedesignJobInput,
  type MediaAssetDto,
  type RedesignJobDto,
  type RedesignRoomType,
  type RedesignStyle,
  redesignRoomTypeSchema,
  redesignStyleSchema,
} from '@app/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { projectMediaApi } from '@/features/media-upload/api/project-media.api';
import { ApiError } from '@/shared/api/client';

import { projectRedesignApi } from '../api/project-redesign.api';

const ROOM_LABELS: Record<RedesignRoomType, string> = {
  LIVING_ROOM: 'Гостиная',
  BEDROOM: 'Спальня',
  KITCHEN: 'Кухня',
  BATHROOM: 'Ванная',
  HALLWAY: 'Прихожая',
  OTHER: 'Другое',
};

const STYLE_LABELS: Record<RedesignStyle, string> = {
  MODERN: 'Модерн',
  SCANDI: 'Сканди',
  CLASSIC: 'Классика',
  MINIMAL: 'Минимализм',
  INDUSTRIAL: 'Лофт / индустриальный',
  BOHO: 'Бохо',
};

const POLL_MS = 2000;

interface Props {
  projectId: string;
}

export function ProjectRedesignPage({ projectId }: Props) {
  const [mediaItems, setMediaItems] = useState<MediaAssetDto[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [jobs, setJobs] = useState<RedesignJobDto[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const [sourceMediaId, setSourceMediaId] = useState<string>('');
  const [roomType, setRoomType] = useState<RedesignRoomType>('LIVING_ROOM');
  const [style, setStyle] = useState<RedesignStyle>('MODERN');
  const [prompt, setPrompt] = useState('Мягкий дневной свет, светлая палитра, минимум декора.');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [pollJobId, setPollJobId] = useState<string | null>(null);
  const [polledJob, setPolledJob] = useState<RedesignJobDto | null>(null);
  const pollTickBusy = useRef(false);

  const refreshMedia = useCallback(async (): Promise<void> => {
    setMediaLoading(true);
    setMediaError(null);
    try {
      const res = await projectMediaApi.list(projectId);
      const ready = res.items.filter((m) => m.status === 'READY');
      setMediaItems(ready);
      setSourceMediaId((prev) => {
        if (prev && ready.some((m) => m.id === prev)) return prev;
        return ready[0]?.id ?? '';
      });
    } catch (e) {
      setMediaError(e instanceof ApiError ? e.message : 'Не удалось загрузить медиа');
    } finally {
      setMediaLoading(false);
    }
  }, [projectId]);

  /** Только из фронтового env: подписи и warning не зависят от истории задач (у каждой задачи свой provider в списке). */
  const providerMode: 'mock' | 'replicate' =
    process.env.NEXT_PUBLIC_REDESIGN_PROVIDER === 'replicate' ? 'replicate' : 'mock';

  const refreshJobs = useCallback(async (): Promise<void> => {
    setJobsLoading(true);
    setJobsError(null);
    try {
      const res = await projectRedesignApi.list(projectId);
      setJobs(res.items);
    } catch (e) {
      setJobsError(e instanceof ApiError ? e.message : 'Не удалось загрузить задачи');
    } finally {
      setJobsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refreshMedia();
    void refreshJobs();
  }, [refreshMedia, refreshJobs]);

  useEffect(() => {
    if (!pollJobId) return;

    const tick = async (): Promise<void> => {
      if (pollTickBusy.current) {
        return;
      }
      pollTickBusy.current = true;
      try {
        const j = await projectRedesignApi.get(projectId, pollJobId);
        setPolledJob(j);
        if (j.status === 'SUCCEEDED' || j.status === 'FAILED') {
          setPollJobId(null);
          await refreshJobs();
        }
      } catch {
        /* keep polling until terminal or manual refresh */
      } finally {
        pollTickBusy.current = false;
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      window.clearInterval(id);
      pollTickBusy.current = false;
    };
  }, [pollJobId, projectId, refreshJobs]);

  const onCreate = async (): Promise<void> => {
    if (!sourceMediaId) {
      setCreateError('Выберите исходное фото');
      return;
    }
    setCreateBusy(true);
    setCreateError(null);
    setPolledJob(null);
    try {
      const body: CreateRedesignJobInput = {
        sourceMediaId,
        roomType,
        style,
        prompt: prompt.trim() || '—',
      };
      const job = await projectRedesignApi.create(projectId, body);
      setPolledJob(job);
      setPollJobId(job.id);
      await refreshJobs();
    } catch (e) {
      setCreateError(e instanceof ApiError ? e.message : 'Не удалось создать задачу');
    } finally {
      setCreateBusy(false);
    }
  };

  const displayJob = polledJob;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="text-xl font-semibold">AI редизайн</h1>
          <p className="text-sm text-muted-foreground">
            Выберите исходное фото, параметры и запустите обработку. Статус задачи обновляется
            автоматически.
          </p>
          {process.env.NEXT_PUBLIC_REDESIGN_PROVIDER !== 'replicate' ? (
            <div
              role="status"
              className="rounded-md border border-amber-200/80 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
            >
              <strong className="font-semibold">Mock-режим в интерфейсе.</strong> Подсказки соответствуют{' '}
              <code className="rounded bg-amber-100/80 px-1 text-xs dark:bg-amber-900/50">
                NEXT_PUBLIC_REDESIGN_PROVIDER
              </code>
              . Изображение на сервере при провайдере mock копируется без изменений. Для реальной
              генерации задайте на API{' '}
              <code className="rounded bg-amber-100/80 px-1 text-xs dark:bg-amber-900/50">
                REDESIGN_PROVIDER=replicate
              </code>{' '}
              и здесь{' '}
              <code className="rounded bg-amber-100/80 px-1 text-xs dark:bg-amber-900/50">
                NEXT_PUBLIC_REDESIGN_PROVIDER=replicate
              </code>
              .
            </div>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/projects/${projectId}/media`}>Медиа</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/projects">← Проекты</Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-6 rounded-lg border bg-card p-4 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Новая задача
          </h2>
          {mediaLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка фото…</p>
          ) : mediaError ? (
            <p className="text-sm text-destructive">{mediaError}</p>
          ) : mediaItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Нет готовых изображений. Сначала{' '}
              <Link href={`/projects/${projectId}/media`} className="underline">
                загрузите медиа
              </Link>
              .
            </p>
          ) : (
            <>
              <div>
                <Label htmlFor="src-media">Исходное фото</Label>
                <select
                  id="src-media"
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={sourceMediaId}
                  disabled={createBusy}
                  onChange={(e) => setSourceMediaId(e.target.value)}
                >
                  {mediaItems.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.kind} · {m.id.slice(0, 8)}…
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="room">Тип помещения</Label>
                <select
                  id="room"
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={roomType}
                  disabled={createBusy}
                  onChange={(e) => setRoomType(e.target.value as RedesignRoomType)}
                >
                  {redesignRoomTypeSchema.options.map((v) => (
                    <option key={v} value={v}>
                      {ROOM_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="style">Стиль</Label>
                <select
                  id="style"
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={style}
                  disabled={createBusy}
                  onChange={(e) => setStyle(e.target.value as RedesignStyle)}
                >
                  {redesignStyleSchema.options.map((v) => (
                    <option key={v} value={v}>
                      {STYLE_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="prompt">Промпт</Label>
                <Textarea
                  id="prompt"
                  className="mt-1 min-h-[100px]"
                  value={prompt}
                  disabled={createBusy}
                  maxLength={2000}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
              <Button onClick={() => void onCreate()} disabled={createBusy || !sourceMediaId}>
                {createBusy
                  ? 'Создаём…'
                  : providerMode === 'replicate'
                    ? 'Сгенерировать редизайн'
                    : 'Запустить mock-обработку'}
              </Button>
              {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
            </>
          )}
        </div>

        <div className="space-y-3 border-t pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Текущая задача
          </h2>
          {!displayJob ? (
            <p className="text-sm text-muted-foreground">Запустите задачу — статус обновляется каждые 2 с.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <div>
                Статус:{' '}
                <span className="font-medium">
                  {displayJob.status === 'PENDING' && 'В очереди'}
                  {displayJob.status === 'PROCESSING' && 'Обработка…'}
                  {displayJob.status === 'SUCCEEDED' && 'Готово'}
                  {displayJob.status === 'FAILED' && 'Ошибка'}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Провайдер: {displayJob.provider} · попыток входа в PROCESSING: {displayJob.attempts}
                {displayJob.externalJobId ? ` · внешний id: ${displayJob.externalJobId}` : null}
                {displayJob.startedAt
                  ? ` · старт ${new Date(displayJob.startedAt).toLocaleString('ru-RU')}`
                  : null}
                {displayJob.completedAt
                  ? ` · завершено ${new Date(displayJob.completedAt).toLocaleString('ru-RU')}`
                  : null}
              </div>
              {displayJob.status === 'FAILED' && displayJob.errorMessage ? (
                <p className="rounded-md bg-destructive/10 p-2 text-destructive">
                  {displayJob.errorMessage}
                </p>
              ) : null}
              {displayJob.resultPreviewUrl ? (
                <div className="overflow-hidden rounded-md border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayJob.resultPreviewUrl}
                    alt="Результат"
                    className="max-h-64 w-full object-contain"
                  />
                </div>
              ) : displayJob.status === 'SUCCEEDED' ? (
                <p className="text-muted-foreground">Превью недоступно (хранилище или срок URL).</p>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          История задач
        </h2>
        {jobsLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : jobsError ? (
          <p className="text-sm text-destructive">{jobsError}</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет задач</p>
        ) : (
          <ul className="space-y-3">
            {jobs.map((j) => (
              <li
                key={j.id}
                className="flex flex-wrap items-start gap-4 rounded-lg border bg-card p-3 text-sm"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="font-mono text-[10px] text-muted-foreground">{j.id}</div>
                  <div>
                    {ROOM_LABELS[j.roomType]} · {STYLE_LABELS[j.style]}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {j.status} · {j.provider} · попыток: {j.attempts} ·{' '}
                    {new Date(j.createdAt).toLocaleString('ru-RU')}
                  </div>
                  {j.status === 'FAILED' && j.errorMessage ? (
                    <p className="text-xs text-destructive">{j.errorMessage}</p>
                  ) : null}
                </div>
                {j.resultPreviewUrl ? (
                  <div className="h-20 w-28 shrink-0 overflow-hidden rounded border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={j.resultPreviewUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
