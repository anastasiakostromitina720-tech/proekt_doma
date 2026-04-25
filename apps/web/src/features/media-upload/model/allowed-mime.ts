import type { AllowedImageMime } from '@app/contracts';

const SET = new Set<AllowedImageMime>(['image/jpeg', 'image/png', 'image/webp']);

export function toAllowedImageMime(type: string): AllowedImageMime | null {
  if (SET.has(type as AllowedImageMime)) return type as AllowedImageMime;
  return null;
}
