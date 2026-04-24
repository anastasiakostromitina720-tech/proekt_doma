import { authApi } from '../api/auth.api';
import { useSessionStore } from '../model/session.store';

/**
 * Single-flight refresh. Concurrent callers share one in-flight promise,
 * so multiple 401s in parallel never trigger multiple /auth/refresh requests.
 *
 * Returns true if the session was successfully refreshed, false otherwise.
 * On failure the store is cleared so the UI can react.
 */
let inFlight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const session = await authApi.refresh();
      useSessionStore.getState().setSession(session);
      return true;
    } catch {
      useSessionStore.getState().clearSession();
      return false;
    }
  })();

  inFlight.finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/**
 * Global auth-failure handler used by the api client when a retry after
 * refresh still returns 401. Redirects to /login as a hard navigation,
 * which also clears any volatile React state.
 */
export function handleAuthFailure(): void {
  useSessionStore.getState().clearSession();
  if (typeof window === 'undefined') return;

  const { pathname, search } = window.location;
  const next = encodeURIComponent(pathname + search);
  // Only redirect if we're on a protected route; avoid loops on /login itself.
  if (!pathname.startsWith('/login') && !pathname.startsWith('/register')) {
    window.location.assign(`/login?next=${next}`);
  }
}
