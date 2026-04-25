import type {
  MediaAssetDto,
  MediaListResponse,
  PresignedUploadResponse,
  RequestMediaUploadInput,
} from '@app/contracts';

import { api } from '@/shared/api/client';

export const projectMediaApi = {
  list(projectId: string): Promise<MediaListResponse> {
    return api.get<MediaListResponse>(`/projects/${projectId}/media`);
  },

  requestUpload(
    projectId: string,
    body: RequestMediaUploadInput,
  ): Promise<PresignedUploadResponse> {
    return api.post<PresignedUploadResponse>(`/projects/${projectId}/media/upload-url`, body);
  },

  confirm(projectId: string, mediaId: string): Promise<MediaAssetDto> {
    return api.post<MediaAssetDto>(`/projects/${projectId}/media/${mediaId}/confirm`);
  },

  remove(projectId: string, mediaId: string): Promise<void> {
    return api.delete(`/projects/${projectId}/media/${mediaId}`);
  },
};
