'use client';

import type { FloorPlan } from '@app/contracts';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

import { useEditorStore } from '../model/editor.store';
import { useEditorSaveState } from '../model/use-editor-save-state';
import { EditorShell } from './editor-shell';

interface Props {
  projectId: string;
}

/**
 * Top-level editor page. Owns the two distinct server-adoption
 * scenarios as separate code paths, plus two safety nets around
 * destructive transitions:
 *
 * Adoption scenarios:
 *
 *   A. Initial adoption / full reset — `hydrate` is called:
 *      - First time the editor sees this plan (mount or project
 *        switch with a clean store). Detected by `plan.id !==
 *        store.planId`.
 *      - User-initiated reload, handled IMPERATIVELY in `handleReload`:
 *        we await the fresh plan returned by `useFloorPlan.reload()`
 *        and call `hydrate` synchronously with that value.
 *      - Dirty project-switch, after explicit user confirmation in the
 *        `DirtySwitchPrompt`.
 *
 *   B. Post-save reconcile — `reconcileSaved` is called:
 *      - Gated by `postSaveRef`, which is set to `true` in
 *        `handleSave` just before calling `save()` and cleared when
 *        either the save completes (effect consumes it) or fails
 *        (handleSave clears it on a null result). This keeps
 *        reconcile strictly tied to successful saves — an unrelated
 *        refetch can no longer clear `dirty` as a side effect.
 *
 * Safety nets:
 *
 *   1. `useDirtyUnloadGuard` — native `beforeunload` prompt on tab
 *      close / refresh while `dirty === true`.
 *   2. `DirtySwitchPrompt` — when the loaded `plan.id` differs from
 *      the one currently in the store AND local state is dirty, we do
 *      NOT hydrate. Instead we render an explicit prompt: either
 *      discard and adopt, or navigate to the projects list (which
 *      preserves the dirty state so the user can go back and save).
 */
export function EditorPage({ projectId }: Props) {
  const {
    plan,
    loadStatus,
    loadError,
    saveStatus,
    saveError,
    conflict,
    canSave,
    isMutatingBlocked,
    save,
    reload,
  } = useEditorSaveState(projectId);

  const storePlanId = useEditorStore((s) => s.planId);
  const dirty = useEditorStore((s) => s.dirty);
  const hydrate = useEditorStore((s) => s.hydrate);
  const reconcileSaved = useEditorStore((s) => s.reconcileSaved);
  const getPlanData = useEditorStore((s) => s.getPlanData);

  // True between a successful save-call-dispatch and the corresponding
  // plan-ref change being consumed by the effect. Prevents unrelated
  // refetches (e.g. navigating back to a previously-edited project)
  // from clearing local `dirty` as collateral damage.
  const postSaveRef = useRef(false);

  // When a server plan arrives for a different id but the user has
  // unsaved local work, we stash it here instead of calling `hydrate`.
  // The UI renders a prompt until the user decides.
  const [pendingAdoption, setPendingAdoption] = useState<FloorPlan | null>(null);

  useDirtyUnloadGuard(dirty);

  useEffect(() => {
    if (!plan) return;

    if (plan.id === storePlanId) {
      // We're aligned with the stored plan. Any pending adoption for
      // a different plan is now stale (user navigated back) and must
      // be cleared so the editor is not permanently blocked.
      setPendingAdoption(null);

      // Only reconcile if THIS component initiated the save. Other
      // paths that change the plan reference (reload success,
      // navigation revisit) must not clear `dirty`.
      if (postSaveRef.current) {
        postSaveRef.current = false;
        reconcileSaved(plan);
      }
      return;
    }

    // New plan.id — either first-time adoption, or a project switch.
    // `useEditorStore.getState().dirty` is read imperatively (not as
    // an effect dep) so a later flip of `dirty` doesn't re-evaluate
    // the adoption decision for an already-decided plan.
    if (storePlanId !== null && useEditorStore.getState().dirty) {
      setPendingAdoption(plan);
      return;
    }
    hydrate(plan);
  }, [plan, storePlanId, hydrate, reconcileSaved]);

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;
    let data;
    try {
      data = getPlanData();
    } catch {
      // `getPlanData` only throws on schemaVersion mismatch, which is
      // a bug-class problem. Surface nothing here; user will see
      // saveStatus unchanged.
      return;
    }
    postSaveRef.current = true;
    const result = await save(data);
    if (result === null) {
      // Save was rejected (conflict) or errored — plan ref did not
      // change, so the effect will never fire. Clear the flag so a
      // later unrelated refetch does not accidentally reconcile.
      postSaveRef.current = false;
    }
  };

  const handleReload = async (): Promise<void> => {
    if (dirty) {
      const ok =
        typeof window !== 'undefined'
          ? window.confirm(
              'Перезагрузка с сервера сотрёт ваши несохранённые изменения. Продолжить?',
            )
          : true;
      if (!ok) return;
    }
    // Explicit reload: hydrate synchronously from the returned value,
    // bypassing the plan-ref effect. When the effect later fires it
    // will see plan.id === storePlanId and postSaveRef=false, and will
    // correctly do nothing.
    const fresh = await reload();
    if (fresh) hydrate(fresh);
  };

  const handleDiscardAndAdopt = (): void => {
    if (!pendingAdoption) return;
    hydrate(pendingAdoption);
    setPendingAdoption(null);
  };

  if (pendingAdoption) {
    return (
      <DirtySwitchPrompt
        onDiscardAndAdopt={handleDiscardAndAdopt}
      />
    );
  }

  if (loadStatus === 'error') {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm text-destructive">
          {loadError ?? 'Не удалось загрузить floor plan'}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void reload()}>
            Повторить
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/projects">К проектам</Link>
          </Button>
        </div>
      </div>
    );
  }

  // First-load gate: while the plan hasn't arrived yet we deliberately
  // don't render the shell with the store's default empty data — it
  // looks like a working canvas, which is misleading. A minimal
  // skeleton keeps the layout stable without pretending anything is
  // ready.
  if (!plan) {
    return <EditorLoadingSkeleton />;
  }

  return (
    <EditorShell
      saveStatus={saveStatus}
      saveError={saveError}
      conflict={conflict}
      canSave={canSave}
      isMutatingBlocked={isMutatingBlocked}
      onSave={handleSave}
      onReload={handleReload}
    />
  );
}

/**
 * Attaches a `beforeunload` listener when `dirty === true`. The browser
 * only shows its native prompt if an event handler sets
 * `event.returnValue` (the actual message is ignored in modern
 * browsers — a stock prompt is shown). When `dirty` is false the
 * listener is fully removed so we don't interfere with normal
 * navigation.
 */
function useDirtyUnloadGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
      // Legacy (and Chrome) requires setting returnValue.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}

function EditorLoadingSkeleton() {
  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col">
      <div className="flex items-center gap-2 border-b bg-card px-4 py-2 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">
          ← Проекты
        </Link>
      </div>
      <div className="h-11 border-b bg-card" aria-hidden />
      <div className="flex-1 bg-white">
        <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
          Загружаем план…
        </div>
      </div>
    </div>
  );
}

function DirtySwitchPrompt({
  onDiscardAndAdopt,
}: {
  onDiscardAndAdopt(): void;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 p-8 text-center">
      <h1 className="text-lg font-semibold">Несохранённые изменения в другом проекте</h1>
      <p className="text-sm text-muted-foreground">
        В редакторе остались локальные правки для другого проекта. Если открыть этот,
        правки будут потеряны безвозвратно. Чтобы не потерять работу, вернитесь к списку
        проектов и откройте исходный.
      </p>
      <div className="flex items-center gap-2">
        <Button variant="destructive" onClick={onDiscardAndAdopt}>
          Открыть без сохранения
        </Button>
        <Button variant="outline" asChild>
          <Link href="/projects">К проектам</Link>
        </Button>
      </div>
    </div>
  );
}
