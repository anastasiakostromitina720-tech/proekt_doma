import type { AuthSession, User } from '@app/contracts';
import { create } from 'zustand';

export type SessionStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface SessionState {
  status: SessionStatus;
  user: User | null;
  accessToken: string | null;
  accessTokenExpiresAt: string | null;

  setLoading: () => void;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
}

/**
 * In-memory session store.
 *
 * Access token is NEVER persisted to localStorage/sessionStorage — on page
 * reload the session is restored via /auth/refresh using the httpOnly cookie.
 */
export const useSessionStore = create<SessionState>((set) => ({
  status: 'idle',
  user: null,
  accessToken: null,
  accessTokenExpiresAt: null,

  setLoading: () => set({ status: 'loading' }),

  setSession: (session) =>
    set({
      status: 'authenticated',
      user: session.user,
      accessToken: session.accessToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
    }),

  clearSession: () =>
    set({
      status: 'unauthenticated',
      user: null,
      accessToken: null,
      accessTokenExpiresAt: null,
    }),
}));

export const selectUser = (s: SessionState): User | null => s.user;
export const selectStatus = (s: SessionState): SessionStatus => s.status;
export const selectAccessToken = (s: SessionState): string | null => s.accessToken;
