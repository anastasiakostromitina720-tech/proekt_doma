import type {
  CreateProjectInput,
  ListProjectsQuery,
  Project,
  ProjectsListResponse,
  UpdateProjectInput,
} from '@app/contracts';

import { api } from '@/shared/api/client';

export const projectsApi = {
  list: (query?: Partial<ListProjectsQuery>): Promise<ProjectsListResponse> =>
    api.get<ProjectsListResponse>('/projects', {
      query: {
        limit: query?.limit,
        offset: query?.offset,
      },
    }),

  findOne: (id: string): Promise<Project> => api.get<Project>(`/projects/${id}`),

  create: (input: CreateProjectInput): Promise<Project> => api.post<Project>('/projects', input),

  update: (id: string, input: UpdateProjectInput): Promise<Project> =>
    api.patch<Project>(`/projects/${id}`, input),

  remove: (id: string): Promise<void> => api.delete<void>(`/projects/${id}`),
};
