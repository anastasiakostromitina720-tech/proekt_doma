'use client';

import {
  FLOOR_PLAN_SCHEMA_VERSION,
  createEmptyFloorPlanData,
  type FloorPlanData,
} from '@app/contracts';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

import { useFloorPlan } from '../model/use-floor-plan';

interface Props {
  projectId: string;
}

/**
 * Headless-ish debug view for the floor-plan persistence layer.
 *
 * Intentionally NOT a visual editor: no canvas, no Konva, no shape
 * manipulation. It exposes exactly what the persistence layer guarantees
 * — schemaVersion, version, counts, load/save status — so the persistence
 * iteration can be validated end-to-end before the editor lands.
 */
export function FloorPlanDebugView({ projectId }: Props) {
  const {
    plan,
    loadStatus,
    loadError,
    saveStatus,
    saveError,
    conflict,
    reload,
    save,
  } = useFloorPlan(projectId);

  const onSaveEmpty = (): void => {
    void save(createEmptyFloorPlanData());
  };

  const onSaveMock = (): void => {
    if (!plan) return;
    // Append one mock wall to whatever is currently stored. This is the
    // smallest non-trivial mutation we can round-trip through the PUT.
    const next: FloorPlanData = {
      ...plan.data,
      walls: [
        ...plan.data.walls,
        {
          id: crypto.randomUUID(),
          start: { x: 0, y: 0 },
          end: { x: 5, y: 0 },
          thickness: 0.2,
          height: 2.7,
        },
      ],
    };
    void save(next);
  };

  const isLoading = loadStatus === 'loading' && !plan;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Floor plan · debug</h1>
          <p className="text-sm text-muted-foreground">
            Persistence layer only — редактор появится в следующей итерации.
          </p>
        </div>
        <Link
          href="/projects"
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          ← К проектам
        </Link>
      </header>

      <section className="rounded-lg border p-4 text-sm">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Project id
        </div>
        <code className="font-mono text-xs break-all">{projectId}</code>
      </section>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed py-12 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-3">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Загружаем floor plan…
          </span>
        </div>
      ) : null}

      {loadStatus === 'error' ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{loadError ?? 'Не удалось загрузить floor plan'}</span>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            Повторить
          </Button>
        </div>
      ) : null}

      {plan ? (
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Метаданные
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <Field label="schemaVersion" value={String(plan.data.meta.schemaVersion)} />
            <Field
              label="client схема"
              value={String(FLOOR_PLAN_SCHEMA_VERSION)}
              mutedIf={plan.data.meta.schemaVersion === FLOOR_PLAN_SCHEMA_VERSION}
            />
            <Field label="version" value={String(plan.version)} />
            <Field label="level" value={String(plan.level)} />
            <Field label="units" value={plan.data.meta.units} />
            <Field label="scale" value={String(plan.data.meta.scale)} />
            <Field label="gridSize" value={String(plan.data.meta.gridSize)} />
            <Field label="updatedAt" value={plan.updatedAt} />
          </dl>

          <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Сущности
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Field label="walls" value={String(plan.data.walls.length)} />
            <Field label="rooms" value={String(plan.data.rooms.length)} />
            <Field label="doors" value={String(plan.data.doors.length)} />
            <Field label="windows" value={String(plan.data.windows.length)} />
          </dl>
        </section>
      ) : null}

      {conflict ? (
        <div className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <div className="font-medium">
            Конфликт версий — план обновили параллельно.
          </div>
          <div className="text-xs">
            Клиентская версия: {conflict.clientVersion}. На сервере:{' '}
            {conflict.currentVersion ?? '—'}.
          </div>
          <div>
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              Перечитать с сервера
            </Button>
          </div>
        </div>
      ) : null}

      {saveStatus === 'error' ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {saveError ?? 'Не удалось сохранить floor plan'}
        </div>
      ) : null}

      {saveStatus === 'saved' ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
          Сохранено. version = {plan?.version}
        </div>
      ) : null}

      <section className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={() => void reload()}
          disabled={loadStatus === 'loading'}
        >
          Reload
        </Button>
        <Button
          onClick={onSaveEmpty}
          disabled={!plan || saveStatus === 'saving'}
        >
          Save empty
        </Button>
        <Button
          variant="secondary"
          onClick={onSaveMock}
          disabled={!plan || saveStatus === 'saving'}
        >
          Save + 1 wall
        </Button>
        {saveStatus === 'saving' ? (
          <span className="text-sm text-muted-foreground">сохраняю…</span>
        ) : null}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  mutedIf,
}: {
  label: string;
  value: string;
  mutedIf?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={`font-mono text-sm ${
          mutedIf === false ? 'text-amber-600 dark:text-amber-400' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
