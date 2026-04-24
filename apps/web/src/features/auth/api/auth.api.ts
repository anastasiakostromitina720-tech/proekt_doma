import type { AuthSession, LoginInput, RegisterInput, User } from '@app/contracts';

import { api } from '@/shared/api/client';

export const authApi = {
  register: (input: RegisterInput): Promise<AuthSession> =>
    api.post<AuthSession>('/auth/register', input, { skipAuth: true }),

  login: (input: LoginInput): Promise<AuthSession> =>
    api.post<AuthSession>('/auth/login', input, { skipAuth: true }),

  refresh: (): Promise<AuthSession> =>
    api.post<AuthSession>('/auth/refresh', undefined, { skipAuth: true }),

  logout: (): Promise<void> => api.post<void>('/auth/logout', undefined, { skipAuth: true }),

  me: (): Promise<User> => api.get<User>('/auth/me'),
};
