'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

import type { FloorPlanConflictInfo, FloorPlanSaveStatus } from '@/features/floor-plan';

import { useEditorKeyboard } from '../hooks/use-editor-keyboard';
import { SidePanel } from './side-panel';
import { Toolbar } from './toolbar';

// Konva touches `window` at import time, so the canvas must be
// client-only. `ssr: false` prevents Next.js from even trying to
// render it on the server.
const EditorCanvas = dynamic(
  () => import('./canvas/editor-canvas').then((m) => m.EditorCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-white text-sm text-muted-foreground">
        Загружаем canvas…
      </div>
    ),
  },
);

interface Props {
  saveStatus: FloorPlanSaveStatus;
  saveError: string | null;
  conflict: FloorPlanConflictInfo | null;
  canSave: boolean;
  isMutatingBlocked: boolean;
  onSave(): void;
  onReload(): void;
}

/**
 * Layout glue. Owns keyboard shortcuts (attached exactly once at the
 * shell level), dispatches save/reload intents to the caller, and
 * places the canvas + toolbar + side panel.
 *
 * `isMutatingBlocked` is the single flag that gates mutations across
 * the tree; it is NOT applied to the toolbar (tool switch is UI) and
 * NOT applied to the canvas's pan/zoom/selection (navigation is UI).
 */
export function EditorShell({
  saveStatus,
  saveError,
  conflict,
  canSave,
  isMutatingBlocked,
  onSave,
  onReload,
}: Props) {
  useEditorKeyboard({ isMutatingBlocked });

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col">
      {/*
        Thin header strip dedicated to navigation/context. Kept
        separate from Toolbar (tool selection) on purpose — mixing
        "where am I" and "what tool" into one bar has bitten multiple
        CAD UIs; distinguishable rows scale better when we add
        breadcrumbs / project title / level switcher later.
      */}
      <div className="flex items-center gap-2 border-b bg-card px-4 py-2 text-sm text-muted-foreground">
        <Link
          href="/projects"
          className="transition-colors hover:text-foreground"
          aria-label="К списку проектов"
        >
          ← Проекты
        </Link>
      </div>
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <div className="flex-1">
          <EditorCanvas isMutatingBlocked={isMutatingBlocked} />
        </div>
        <SidePanel
          saveStatus={saveStatus}
          saveError={saveError}
          conflict={conflict}
          canSave={canSave}
          isMutatingBlocked={isMutatingBlocked}
          onSave={onSave}
          onReload={onReload}
        />
      </div>
    </div>
  );
}
