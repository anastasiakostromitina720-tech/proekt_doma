'use client';

import type { Project } from '@app/contracts';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/shared/api/client';

import { projectsApi } from '../api/projects.api';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseProjectsListResult {
  projects: Project[];
  status: LoadStatus;
  error: string | null;
  refresh: () => Promise<void>;
  /**
   * Escape hatch for mutation hooks. Exposed so that `useProjectMutations`
   * can apply optimistic updates against the same state container without
   * us having to reach for a context / store. Consumers of `useProjects`
   * should NOT touch this directly.
   */
  setProjects: Dispatch<SetStateAction<Project[]>>;
}

const errorMessage = (e: unknown, fallback: string): string => {
  if (e instanceof ApiError) return e.message || fallback;
  if (e instanceof Error) return e.message;
  return fallback;
};

/**
 * Owns the "what projects does the current user have" state:
 * initial fetch, refresh, loading/error state. It deliberately does NOT
 * handle mutations — those live in `useProjectMutations`, which accepts
 * this hook's `setProjects` to keep the state authoritative in one place.
 */
export function useProjectsList(): UseProjectsListResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setStatus((prev) => (prev === 'ready' ? 'ready' : 'loading'));
    setError(null);
    try {
      const page = await projectsApi.list({ limit: 100, offset: 0 });
      setProjects(page.items);
      setStatus('ready');
    } catch (e) {
      setError(errorMessage(e, 'Не удалось загрузить проекты'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { projects, status, error, refresh, setProjects };
}
