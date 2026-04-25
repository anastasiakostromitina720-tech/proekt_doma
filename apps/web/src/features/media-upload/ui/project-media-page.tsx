'use client';

import {
  MEDIA_MAX_BYTES,
  type MediaAssetDto,
  type MediaKind,
  mediaKindSchema,
} from '@app/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/shared/api/client';

import { projectMediaApi } from '../api/project-media.api';
import { toAllowedImageMime } from '../model/allowed-mime';

const KIND_OPTIONS: { value: MediaKind; label: string }[] = mediaKindSchema.options.map((value) => {
  const labels: Record<MediaKind, string> = {
    ROOM_PHOTO: 'Фото помещения',
    FACADE_PHOTO: 'Фото фасада',
    REDESIGN_RESULT: 'Результат AI редизайна',
    PROJECT_THUMBNAIL: 'Обложка проекта',
  };
  return { value, label: labels[value] };
});

interface Props {
  projectId: string;
}

export function ProjectMediaPage({ projectId }: Props) {
  const [items, setItems] = useState<MediaAssetDto[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [uploadKind, setUploadKind] = useState<MediaKind>('ROOM_PHOTO');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshList = useCallback(async (): Promise<void> => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await projectMediaApi.list(projectId);
      setItems(res.items);
    } catch (e) {
      setListError(e instanceof ApiError ? e.message : 'Не удалось загрузить список');
    } finally {
      setListLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const uploadFile = async (file: File): Promise<void> => {
    setUploadError(null);
    if (file.size > MEDIA_MAX_BYTES) {
      setUploadError(`Файл больше ${Math.round(MEDIA_MAX_BYTES / (1024 * 1024))} МБ`);
      return;
    }
    const mime = toAllowedImageMime(file.type);
    if (!mime) {
      setUploadError('Допустимы только JPEG, PNG или WebP');
      return;
    }

    setUploadBusy(true);
    try {
      const presign = await projectMediaApi.requestUpload(projectId, {
        kind: uploadKind,
        mimeType: mime,
        sizeBytes: file.size,
      });
      const put = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: presign.uploadHeaders,
        body: file,
      });
      if (!put.ok) {
        throw new Error(`Загрузка в хранилище: ${put.status} ${put.statusText}`);
      }
      await projectMediaApi.confirm(projectId, presign.mediaId);
      await refreshList();
    } catch (e) {
      setUploadError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setUploadBusy(false);
    }
  };

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0];
    if (f) void uploadFile(f);
  };

  const onDragOver = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onPickFile = (): void => {
    inputRef.current?.click();
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) void uploadFile(f);
  };

  const onDelete = async (id: string): Promise<void> => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm('Удалить этот файл?');
      if (!ok) return;
    }
    setDeletingId(id);
    try {
      await projectMediaApi.remove(projectId, id);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setListError(e instanceof ApiError ? e.message : 'Не удалось удалить');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Медиа проекта</h1>
          <p className="text-sm text-muted-foreground">
            Загрузка напрямую в объектное хранилище (presigned URL). Бинарник не проходит через API.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/projects">← Проекты</Link>
        </Button>
      </div>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <Label htmlFor="media-kind">Тип вложения</Label>
        <select
          id="media-kind"
          className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={uploadKind}
          disabled={uploadBusy}
          onChange={(e) => setUploadKind(e.target.value as MediaKind)}
        >
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <div
          role="button"
          tabIndex={0}
          className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground transition hover:bg-muted/50"
          onDrop={onDrop}
          onDragOver={onDragOver}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onPickFile();
            }
          }}
          onClick={onPickFile}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onInputChange}
          />
          {uploadBusy ? (
            <span>Загрузка…</span>
          ) : (
            <>
              <span className="font-medium text-foreground">Перетащите фото сюда или нажмите для выбора</span>
              <span className="mt-1">JPEG, PNG, WebP · до {MEDIA_MAX_BYTES / (1024 * 1024)} МБ</span>
            </>
          )}
        </div>
        {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Загруженные файлы
        </h2>
        {listLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка списка…</p>
        ) : listError ? (
          <p className="text-sm text-destructive">{listError}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет файлов</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {items.map((m) => (
              <li
                key={m.id}
                className="flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm"
              >
                <div className="relative aspect-video bg-muted">
                  {m.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.previewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      {m.status === 'PENDING_UPLOAD' ? 'Ожидает загрузки' : 'Нет превью'}
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-3 text-xs">
                  <div className="font-mono text-[10px] text-muted-foreground">{m.id.slice(0, 8)}…</div>
                  <div>
                    {KIND_OPTIONS.find((k) => k.value === m.kind)?.label ?? m.kind} ·{' '}
                    {(m.sizeBytes / 1024).toFixed(0)} КБ
                  </div>
                  <div className="text-muted-foreground">{m.mimeType}</div>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={deletingId === m.id}
                    onClick={() => void onDelete(m.id)}
                  >
                    {deletingId === m.id ? 'Удаление…' : 'Удалить'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
