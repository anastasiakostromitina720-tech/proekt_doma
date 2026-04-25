import type {
  CreateRedesignJobInput,
  RedesignJobDto,
  RedesignJobListResponse,
} from '@app/contracts';

import { api } from '@/shared/api/client';

export const projectRedesignApi = {
  list(projectId: string): Promise<RedesignJobListResponse> {
    return api.get<RedesignJobListResponse>(`/projects/${projectId}/redesign/jobs`);
  },

  get(projectId: string, jobId: string): Promise<RedesignJobDto> {
    return api.get<RedesignJobDto>(`/projects/${projectId}/redesign/jobs/${jobId}`);
  },

  create(projectId: string, body: CreateRedesignJobInput): Promise<RedesignJobDto> {
    return api.post<RedesignJobDto>(`/projects/${projectId}/redesign/jobs`, body);
  },
};
