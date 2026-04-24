'use client';

import { useEffect, useRef } from 'react';

import { configureApiClient } from '@/shared/api/client';

import { useSessionStore } from '../model/session.store';
import { handleAuthFailure, refreshSession } from '../lib/refresh';

/**
 * Wires the api client to the session store and bootstraps the session
 * on first client mount by attempting a silent refresh using the
 * httpOnly cookie.
 *
 * This component renders nothing. Mount it once at the root layout.
 */
export function SessionBootstrap(): null {
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

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
