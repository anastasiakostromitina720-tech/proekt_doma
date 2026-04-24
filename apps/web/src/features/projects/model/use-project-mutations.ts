'use client';

import type { CreateProjectInput, Project, UpdateProjectInput } from '@app/contracts';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback } from 'react';

import { projectsApi } from '../api/projects.api';

export interface UseProjectMutationsResult {
  create: (input: CreateProjectInput) => Promise<Project>;
  update: (id: string, input: UpdateProjectInput) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/**
 * Mutation layer for the projects feature. Decoupled from the list fetcher
 * so each concern has one reason to change:
 *
 *   - `useProjectsList` owns "what are the current projects?"
 *   - `useProjectMutations` owns "how do we change them?"
 *
 * Optimistic strategy:
 *   - `rename` / `update` / `remove` mutate local state first and reconcile
 *     with the server response (or roll back on error).
 *   - `create` is NOT optimistic — we need the server-assigned id,
 *     createdAt, updatedAt before the row can render correctly.
 *
 * This hook doesn't own any state of its own; it mutates through the
 * `setProjects` updater handed in by `useProjectsList`. Callers that want
 * the combined UX API can use `useProjects()` from `./use-projects.ts`.
 */
export function useProjectMutations(
  setProjects: Dispatch<SetStateAction<Project[]>>,
): UseProjectMutationsResult {
  const create = useCallback(
    async (input: CreateProjectInput): Promise<Project> => {
      const created = await projectsApi.create(input);
      setProjects((prev) => [created, ...prev]);
      return created;
    },
    [setProjects],
  );

  const update = useCallback(
    async (id: string, input: UpdateProjectInput): Promise<void> => {
      let snapshot: Project[] = [];
      setProjects((prev) => {
        snapshot = prev;
        return prev.map((p) =>
          p.id === id
            ? {
                ...p,
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.description !== undefined ? { description: input.description } : {}),
                ...(input.type !== undefined ? { type: input.type } : {}),
                updatedAt: new Date().toISOString(),
              }
            : p,
        );
      });

      try {
        const fresh = await projectsApi.update(id, input);
        // Reconcile with server-authoritative values (e.g. real updatedAt).
        setProjects((prev) => prev.map((p) => (p.id === id ? fresh : p)));
      } catch (e) {
        setProjects(snapshot);
        throw e;
      }
    },
    [setProjects],
  );

  const rename = useCallback(
    async (id: string, name: string): Promise<void> => {
      await update(id, { name });
    },
    [update],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      let snapshot: Project[] = [];
      setProjects((prev) => {
        snapshot = prev;
        return prev.filter((p) => p.id !== id);
      });

      try {
        await projectsApi.remove(id);
      } catch (e) {
        setProjects(snapshot);
        throw e;
      }
    },
    [setProjects],
  );

  return { create, update, rename, remove };
}
