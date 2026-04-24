import type { AllowedImageMime } from '@app/contracts';

const MIME_EXT: Record<AllowedImageMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function fileExtensionForMime(mime: AllowedImageMime): string {
  return MIME_EXT[mime];
}

export function buildMediaStorageKey(
  userId: string,
  projectId: string,
  mediaId: string,
  mime: AllowedImageMime,
): string {
  const ext = fileExtensionForMime(mime);
  return `u/${userId}/p/${projectId}/m/${mediaId}.${ext}`;
}
