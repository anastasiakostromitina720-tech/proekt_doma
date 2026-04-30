'use client';

import { useEffect } from 'react';

import { configureApiClient } from '@/shared/api/client';

import { useSessionStore } from '../model/session.store';
import { handleAuthFailure, refreshSession } from '../lib/refresh';

/**
 * Module guard: in React 18 dev StrictMode the root remounts once; `useRef` resets, so
 * a ref alone would run configure+refresh twice. A module flag survives the remount.
 * (Cleared on full page reload / new JS bundle for HMR.)
 */
let didBootstrapClientSession = false;

/**
 * Wires the api client to the session store and bootstraps the session
 * on first client mount by attempting a silent refresh using the
 * httpOnly cookie.
 *
 * This component renders nothing. Mount it once at the root layout.
 */
export function SessionBootstrap(): null {
  useEffect(() => {
    if (didBootstrapClientSession) {
      return;
    }
    didBootstrapClientSession = true;

    configureApiClient({
      getAccessToken: () => useSessionStore.getState().accessToken,
      refresh: () => refreshSession(),
      onAuthFailure: () => handleAuthFailure(),
    });

    const { status, setLoading } = useSessionStore.getState();
    if (status !== 'idle') return;

    setLoading();
    void refreshSession();
  }, []);

  return null;
}
