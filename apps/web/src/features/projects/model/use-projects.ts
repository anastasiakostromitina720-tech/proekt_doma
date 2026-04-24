'use client';

import type { CreateProjectInput, Project, UpdateProjectInput } from '@app/contracts';

import { useProjectMutations } from './use-project-mutations';
import { type LoadStatus, useProjectsList } from './use-projects-list';

export type { LoadStatus } from './use-projects-list';

export interface UseProjectsResult {
  projects: Project[];
  status: LoadStatus;
  error: string | null;

  refresh: () => Promise<void>;
  create: (input: CreateProjectInput) => Promise<Project>;
  rename: (id: string, name: string) => Promise<void>;
  update: (id: string, input: UpdateProjectInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/**
 * Backward-compatible facade. Existing callers (the `/projects` page) get
 * the same shape they had before the split. New consumers that need only
 * the list or only the mutations should import `useProjectsList` /
 * `useProjectMutations` directly instead.
 */
export function useProjects(): UseProjectsResult {
  const list = useProjectsList();
  const mutations = useProjectMutations(list.setProjects);

  return {
    projects: list.projects,
    status: list.status,
    error: list.error,
    refresh: list.refresh,
    create: mutations.create,
    rename: mutations.rename,
    update: mutations.update,
    remove: mutations.remove,
  };
}
