'use client';

import type { FloorPlan, FloorPlanData } from '@app/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/shared/api/client';

import { floorPlanApi } from '../api/floor-plan.api';

export type FloorPlanLoadStatus = 'idle' | 'loading' | 'ready' | 'error';
export type FloorPlanSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

export interface FloorPlanConflictInfo {
  currentVersion: number | null;
  clientVersion: number;
}

export interface UseFloorPlanResult {
  plan: FloorPlan | null;
  loadStatus: FloorPlanLoadStatus;
  loadError: string | null;
  saveStatus: FloorPlanSaveStatus;
  saveError: string | null;
  conflict: FloorPlanConflictInfo | null;
  /**
   * Force-refetch the floor plan. Returns the fresh plan on success, or
   * `null` on failure (error state is reported via `loadStatus` /
   * `loadError`). The returned plan is the same reference that's
   * written into internal `plan` state, so callers can synchronously
   * hydrate derived stores without waiting for React to re-render.
   */
  reload: () => Promise<FloorPlan | null>;
  /**
   * Persist a full replacement of `data` against the currently-known
   * version. Returns the fresh plan on success, or `null` if the save
   * failed (error state is exposed via `saveStatus` / `saveError` /
   * `conflict`). Never throws.
   *
   * Safe to call from an autosave `useEffect`: concurrent calls are
   * coalesced into a single in-flight PUT via an internal promise-ref.
   */
  save: (data: FloorPlanData) => Promise<FloorPlan | null>;
}

const errorMessage = (e: unknown, fallback: string): string => {
  if (e instanceof ApiError) return e.message || fallback;
  if (e instanceof Error) return e.message;
  return fallback;
};

const parseConflictDetails = (e: ApiError): FloorPlanConflictInfo | null => {
  if (!e.details || typeof e.details !== 'object') return null;
  const d = e.details as Record<string, unknown>;
  const current = d.currentVersion;
  const client = d.clientVersion;
  if (typeof client !== 'number') return null;
  return {
    currentVersion: typeof current === 'number' ? current : null,
    clientVersion: client,
  };
};

/**
 * State + persistence layer for a project's floor plan.
 *
 * Contract with future editor code:
 *   - The hook owns `plan` and `version`; the editor reads them.
 *   - On save, the editor hands in a full `FloorPlanData`; the hook
 *     sends `{ version: plan.version, data }` and, on success, updates
 *     both `plan.data` and `plan.version` to the server-authoritative
 *     values.
 *   - `save` is stable-referenced and reads the live version from a ref,
 *     so wiring an autosave effect won't suffer from stale closures.
 *   - On 409, `saveStatus === 'conflict'` and `conflict` carries
 *     `{ currentVersion, clientVersion }`. The editor decides how to
 *     resolve (typical flow: call `reload()` and merge/retry).
 */
export function useFloorPlan(projectId: string | null): UseFloorPlanResult {
  const [plan, setPlan] = useState<FloorPlan | null>(null);
  const [loadStatus, setLoadStatus] = useState<FloorPlanLoadStatus>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<FloorPlanSaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<FloorPlanConflictInfo | null>(null);

  // Live mirror of the current plan. Used by `save()` so the stable
  // callback always sees the latest `version` without being re-created
  // on every state change (important for autosave effects).
  const planRef = useRef<FloorPlan | null>(null);
  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  // Single-flight in-flight save promise. Second concurrent callers
  // receive the same promise, avoiding overlapping PUTs.
  const inFlightSaveRef = useRef<Promise<FloorPlan | null> | null>(null);
  // Single-flight for GET, symmetric with save. Two rapid clicks on
  // Reload (or a programmatic double-call) must not issue two parallel
  // fetches whose responses can arrive out-of-order.
  const inFlightLoadRef = useRef<Promise<FloorPlan | null> | null>(null);

  const reload = useCallback((): Promise<FloorPlan | null> => {
    if (!projectId) return Promise.resolve(null);
    if (inFlightLoadRef.current) return inFlightLoadRef.current;

    setLoadStatus((prev) => (prev === 'ready' ? 'ready' : 'loading'));
    setLoadError(null);

    const run = floorPlanApi
      .get(projectId)
      .then((fresh) => {
        setPlan(fresh);
        setLoadStatus('ready');
        // A fresh load invalidates any prior conflict — caller now has
        // an up-to-date baseline.
        setConflict(null);
        if (saveStatus === 'conflict') setSaveStatus('idle');
        return fresh;
      })
      .catch((e: unknown) => {
        setLoadError(errorMessage(e, 'Не удалось загрузить floor plan'));
        setLoadStatus('error');
        return null;
      })
      .finally(() => {
        inFlightLoadRef.current = null;
      });

    inFlightLoadRef.current = run;
    return run;
  }, [projectId, saveStatus]);

  useEffect(() => {
    if (!projectId) {
      setPlan(null);
      setLoadStatus('idle');
      setLoadError(null);
      return;
    }
    void reload();
    // We deliberately depend only on `projectId`; `reload` is a stable
    // callback but including it would tie the effect to the `saveStatus`
    // value captured by `reload`'s closure, causing an infinite refetch
    // after a conflict clears. Intentional eslint-disable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const save = useCallback(
    async (data: FloorPlanData): Promise<FloorPlan | null> => {
      if (!projectId) return null;
      const current = planRef.current;
      if (!current) return null;

      if (inFlightSaveRef.current) {
        return inFlightSaveRef.current;
      }

      setSaveStatus('saving');
      setSaveError(null);
      setConflict(null);

      const expectedVersion = current.version;
      const run = floorPlanApi
        .save(projectId, { version: expectedVersion, data })
        .then((fresh) => {
          setPlan(fresh);
          setSaveStatus('saved');
          return fresh;
        })
        .catch((e: unknown) => {
          if (e instanceof ApiError && e.status === 409) {
            setConflict(
              parseConflictDetails(e) ?? {
                currentVersion: null,
                clientVersion: expectedVersion,
              },
            );
            setSaveStatus('conflict');
            setSaveError(null);
            return null;
          }
          setSaveError(errorMessage(e, 'Не удалось сохранить floor plan'));
          setSaveStatus('error');
          return null;
        })
        .finally(() => {
          inFlightSaveRef.current = null;
        });

      inFlightSaveRef.current = run;
      return run;
    },
    [projectId],
  );

  return {
    plan,
    loadStatus,
    loadError,
    saveStatus,
    saveError,
    conflict,
    reload,
    save,
  };
}
