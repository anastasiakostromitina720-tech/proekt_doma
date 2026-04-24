'use client';

import { FLOOR_PLAN_SCHEMA_VERSION } from '@app/contracts';
import type { ChangeEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import type { FloorPlanConflictInfo, FloorPlanSaveStatus } from '@/features/floor-plan';

import { useEditorStore } from '../model/editor.store';
import { snapValue } from '../model/snap';

interface Props {
  saveStatus: FloorPlanSaveStatus;
  saveError: string | null;
  conflict: FloorPlanConflictInfo | null;
  canSave: boolean;
  /** True iff domain mutations are blocked (save in flight etc.). */
  isMutatingBlocked: boolean;
  onSave(): void;
  onReload(): void;
}

/**
 * Right-hand panel. Three sections, always visible (no tabs):
 *   1. Save status + action buttons
 *   2. Plan metadata (schemaVersion, version, counts)
 *   3. Properties of the selected element (wall / room / door / window)
 *
 * The selection section reads the selected wall/room straight from
 * `data` by id — it does not cache the object in local state. That way
 * it cannot go stale if the element is edited or removed elsewhere.
 */
export function SidePanel({
  saveStatus,
  saveError,
  conflict,
  canSave,
  isMutatingBlocked,
  onSave,
  onReload,
}: Props) {
  const dirty = useEditorStore((s) => s.dirty);
  const version = useEditorStore((s) => s.version);
  const data = useEditorStore((s) => s.data);
  const selection = useEditorStore((s) => s.selection);

  return (
    <aside className="flex h-full w-80 flex-col gap-4 overflow-y-auto border-l bg-card p-4 text-sm">
      <SaveSection
        saveStatus={saveStatus}
        saveError={saveError}
        conflict={conflict}
        canSave={canSave}
        dirty={dirty}
        version={version}
        onSave={onSave}
        onReload={onReload}
      />

      <MetaSection data={data} />

      <SelectionSection
        selection={selection}
        data={data}
        isMutatingBlocked={isMutatingBlocked}
      />
    </aside>
  );
}

function SaveSection({
  saveStatus,
  saveError,
  conflict,
  canSave,
  dirty,
  version,
  onSave,
  onReload,
}: {
  saveStatus: FloorPlanSaveStatus;
  saveError: string | null;
  conflict: FloorPlanConflictInfo | null;
  canSave: boolean;
  dirty: boolean;
  version: number;
  onSave(): void;
  onReload(): void;
}) {
  const badge: { label: string; className: string } = (() => {
    if (saveStatus === 'conflict') {
      return {
        label: 'Конфликт версий',
        className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
      };
    }
    if (saveStatus === 'saving') {
      return {
        label: 'Сохраняю…',
        className: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
      };
    }
    if (saveStatus === 'error') {
      return { label: 'Ошибка сохранения', className: 'bg-destructive/15 text-destructive' };
    }
    if (dirty) {
      return {
        label: 'Несохранённые изменения',
        className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
      };
    }
    return {
      label: 'Сохранено',
      className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    };
  })();

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Сохранение
        </h2>
        <span className="font-mono text-xs text-muted-foreground">v{version}</span>
      </div>
      <div className={`rounded-md px-3 py-2 text-xs font-medium ${badge.className}`}>
        {badge.label}
      </div>

      {saveStatus === 'error' && saveError ? (
        <p className="text-xs text-destructive">{saveError}</p>
      ) : null}

      {conflict ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
          <p className="mb-1">
            На сервере: v{conflict.currentVersion ?? '—'}. У вас: v{conflict.clientVersion}.
          </p>
          <p className="mb-2 text-muted-foreground">
            Синхронизация сотрёт ваши локальные правки.
          </p>
          <Button size="sm" variant="outline" onClick={onReload}>
            Перезагрузить с сервера
          </Button>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onSave} disabled={!canSave}>
          Сохранить
        </Button>
        <Button size="sm" variant="outline" onClick={onReload} disabled={saveStatus === 'saving'}>
          Reload
        </Button>
      </div>
    </section>
  );
}

function MetaSection({ data }: { data: ReturnType<typeof useEditorStore.getState>['data'] }) {
  const { meta, walls, rooms, doors, windows } = data;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        План
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <Field
          label="schemaVersion"
          value={String(meta.schemaVersion)}
          warn={meta.schemaVersion !== FLOOR_PLAN_SCHEMA_VERSION}
        />
        <Field label="units" value={meta.units} />
        <Field label="gridSize" value={`${meta.gridSize} ${meta.units}`} />
        <Field label="scale" value={String(meta.scale)} />
        <Field label="walls" value={String(walls.length)} />
        <Field label="rooms" value={String(rooms.length)} />
        <Field label="doors" value={String(doors.length)} />
        <Field label="windows" value={String(windows.length)} />
      </dl>
    </section>
  );
}

function SelectionSection({
  selection,
  data,
  isMutatingBlocked,
}: {
  selection: ReturnType<typeof useEditorStore.getState>['selection'];
  data: ReturnType<typeof useEditorStore.getState>['data'];
  isMutatingBlocked: boolean;
}) {
  const updateWall = useEditorStore((s) => s.updateWall);
  const updateRoom = useEditorStore((s) => s.updateRoom);
  const updateDoor = useEditorStore((s) => s.updateDoor);
  const updateWindow = useEditorStore((s) => s.updateWindow);
  const deleteSelected = useEditorStore((s) => s.deleteSelected);

  if (!selection) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Выделение
        </h2>
        <p className="text-xs text-muted-foreground">
          Ничего не выделено. Режим «Выбрать»: клик по стене, комнате, двери или окну.
        </p>
      </section>
    );
  }

  if (selection.type === 'wall') {
    const wall = data.walls.find((w) => w.id === selection.id);
    if (!wall) return null;

    const onThickness = (e: ChangeEvent<HTMLInputElement>): void => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v) || v <= 0) return;
      updateWall(wall.id, { thickness: snapValue(v, 0.01) });
    };
    const onHeight = (e: ChangeEvent<HTMLInputElement>): void => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v) || v <= 0) return;
      updateWall(wall.id, { height: snapValue(v, 0.01) });
    };

    return (
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Стена
          </h2>
          <code className="font-mono text-[10px] text-muted-foreground">
            {wall.id.slice(0, 8)}
          </code>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <Label className="text-[10px] text-muted-foreground">start</Label>
            <div className="font-mono">
              {wall.start.x.toFixed(2)}, {wall.start.y.toFixed(2)}
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">end</Label>
            <div className="font-mono">
              {wall.end.x.toFixed(2)}, {wall.end.y.toFixed(2)}
            </div>
          </div>
        </div>
        <div>
          <Label htmlFor="wall-thickness" className="text-xs">
            Толщина, м
          </Label>
          <Input
            id="wall-thickness"
            type="number"
            step="0.01"
            min="0.01"
            value={wall.thickness}
            disabled={isMutatingBlocked}
            onChange={onThickness}
          />
        </div>
        <div>
          <Label htmlFor="wall-height" className="text-xs">
            Высота, м
          </Label>
          <Input
            id="wall-height"
            type="number"
            step="0.01"
            min="0.01"
            value={wall.height}
            disabled={isMutatingBlocked}
            onChange={onHeight}
          />
        </div>
        <Button
          size="sm"
          variant="destructive"
          onClick={deleteSelected}
          disabled={isMutatingBlocked}
        >
          Удалить стену
        </Button>
      </section>
    );
  }

  if (selection.type === 'door') {
    const door = data.doors.find((d) => d.id === selection.id);
    if (!door) return null;

    const onWidth = (e: ChangeEvent<HTMLInputElement>): void => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v) || v <= 0) return;
      updateDoor(door.id, { width: snapValue(v, 0.01) });
    };
    const onHeight = (e: ChangeEvent<HTMLInputElement>): void => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v) || v <= 0) return;
      updateDoor(door.id, { height: snapValue(v, 0.01) });
    };
    const onPosition = (e: ChangeEvent<HTMLInputElement>): void => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v)) return;
      const t = Math.min(1, Math.max(0, v));
      updateDoor(door.id, { position: t });
    };
    const onWallId = (e: ChangeEvent<HTMLSelectElement>): void => {
      updateDoor(door.id, { wallId: e.target.value });
    };

    return (
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Дверь
          </h2>
          <code className="font-mono text-[10px] text-muted-foreground">
            {door.id.slice(0, 8)}
          </code>
        </div>
        <div>
          <Label htmlFor="door-wall" className="text-xs">
            Стена (wallId)
          </Label>
          <select
            id="door-wall"
            className={cn(
              'mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'ring-offset-background focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
            value={door.wallId}
            disabled={isMutatingBlocked || data.walls.length === 0}
            onChange={onWallId}
          >
            {data.walls.map((w) => (
              <option key={w.id} value={w.id}>
                {w.id.slice(0, 8)}… ({w.start.x.toFixed(1)},{w.start.y.toFixed(1)}) → (
                {w.end.x.toFixed(1)},{w.end.y.toFixed(1)})
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="door-position" className="text-xs">
            Позиция вдоль стены (0…1)
          </Label>
          <Input
            id="door-position"
            type="number"
            step="0.01"
            min={0}
            max={1}
            value={door.position}
            disabled={isMutatingBlocked}
            onChange={onPosition}
          />
        </div>
        <div>
          <Label htmlFor="door-width" className="text-xs">
            Ширина проёма, м
          </Label>
          <Input
            id="door-width"
            type="number"
            step="0.01"
            min="0.01"
            value={door.width}
            disabled={isMutatingBlocked}
            onChange={onWidth}
          />
        </div>
        <div>
          <Label htmlFor="door-height" className="text-xs">
            Высота, м
          </Label>
          <Input
            id="door-height"
            type="number"
            step="0.01"
            min="0.01"
            value={door.height}
            disabled={isMutatingBlocked}
            onChange={onHeight}
          />
        </div>
        <Button
          size="sm"
          variant="destructive"
          onClick={deleteSelected}
          disabled={isMutatingBlocked}
        >
          Удалить дверь
        </Button>
      </section>
    );
  }

  if (selection.type === 'window') {
    const win = data.windows.find((w) => w.id === selection.id);
    if (!win) return null;

    const onWidth = (e: ChangeEvent<HTMLInputElement>): void => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v) || v <= 0) return;
      updateWindow(win.id, { width: snapValue(v, 0.01) });
    };
    const onHeight = (e: ChangeEvent<HTMLInputElement>): void => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v) || v <= 0) return;
      updateWindow(win.id, { height: snapValue(v, 0.01) });
    };
    const onSill = (e: ChangeEvent<HTMLInputElement>): void => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v) || v < 0) return;
      updateWindow(win.id, { sillHeight: snapValue(v, 0.01) });
    };
    const onPosition = (e: ChangeEvent<HTMLInputElement>): void => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v)) return;
      const t = Math.min(1, Math.max(0, v));
      updateWindow(win.id, { position: t });
    };
    const onWallId = (e: ChangeEvent<HTMLSelectElement>): void => {
      updateWindow(win.id, { wallId: e.target.value });
    };

    return (
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Окно
          </h2>
          <code className="font-mono text-[10px] text-muted-foreground">
            {win.id.slice(0, 8)}
          </code>
        </div>
        <div>
          <Label htmlFor="window-wall" className="text-xs">
            Стена (wallId)
          </Label>
          <select
            id="window-wall"
            className={cn(
              'mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'ring-offset-background focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
            value={win.wallId}
            disabled={isMutatingBlocked || data.walls.length === 0}
            onChange={onWallId}
          >
            {data.walls.map((w) => (
              <option key={w.id} value={w.id}>
                {w.id.slice(0, 8)}… ({w.start.x.toFixed(1)},{w.start.y.toFixed(1)}) → (
                {w.end.x.toFixed(1)},{w.end.y.toFixed(1)})
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="window-position" className="text-xs">
            Позиция вдоль стены (0…1)
          </Label>
          <Input
            id="window-position"
            type="number"
            step="0.01"
            min={0}
            max={1}
            value={win.position}
            disabled={isMutatingBlocked}
            onChange={onPosition}
          />
        </div>
        <div>
          <Label htmlFor="window-width" className="text-xs">
            Ширина проёма, м
          </Label>
          <Input
            id="window-width"
            type="number"
            step="0.01"
            min="0.01"
            value={win.width}
            disabled={isMutatingBlocked}
            onChange={onWidth}
          />
        </div>
        <div>
          <Label htmlFor="window-height" className="text-xs">
            Высота проёма, м
          </Label>
          <Input
            id="window-height"
            type="number"
            step="0.01"
            min="0.01"
            value={win.height}
            disabled={isMutatingBlocked}
            onChange={onHeight}
          />
        </div>
        <div>
          <Label htmlFor="window-sill" className="text-xs">
            Высота подоконника, м
          </Label>
          <Input
            id="window-sill"
            type="number"
            step="0.01"
            min={0}
            value={win.sillHeight}
            disabled={isMutatingBlocked}
            onChange={onSill}
          />
        </div>
        <Button
          size="sm"
          variant="destructive"
          onClick={deleteSelected}
          disabled={isMutatingBlocked}
        >
          Удалить окно
        </Button>
      </section>
    );
  }

  const room = data.rooms.find((r) => r.id === selection.id);
  if (!room) return null;

  const onName = (e: ChangeEvent<HTMLInputElement>): void => {
    updateRoom(room.id, { name: e.target.value });
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Комната
        </h2>
        <code className="font-mono text-[10px] text-muted-foreground">
          {room.id.slice(0, 8)}
        </code>
      </div>
      <div>
        <Label htmlFor="room-name" className="text-xs">
          Название
        </Label>
        <Input
          id="room-name"
          value={room.name}
          disabled={isMutatingBlocked}
          onChange={onName}
          maxLength={120}
        />
      </div>
      <div className="text-xs text-muted-foreground">Вершин: {room.polygon.length}</div>
      <Button
        size="sm"
        variant="destructive"
        onClick={deleteSelected}
        disabled={isMutatingBlocked}
      >
        Удалить комнату
      </Button>
    </section>
  );
}

function Field({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`font-mono ${warn ? 'text-amber-600 dark:text-amber-400' : ''}`}>{value}</dd>
    </div>
  );
}
