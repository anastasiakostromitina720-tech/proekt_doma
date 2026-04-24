'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { selectStatus, useSessionStore } from '../model/session.store';

interface DashboardGuardProps {
  children: ReactNode;
}

/**
 * Client-side guard for protected pages.
 *
 *   - 'idle' / 'loading'     → centered loader (session is being restored)
 *   - 'authenticated'        → render children
 *   - 'unauthenticated'      → redirect to /login with ?next=<current path>
 *
 * The redirect is done via Next router to preserve a clean history entry.
 */
export function DashboardGuard({ children }: DashboardGuardProps): ReactNode {
  const status = useSessionStore(selectStatus);
  const router = useRouter();

  useEffect(() => {
    if (status !== 'unauthenticated') return;
    if (typeof window === 'undefined') return;
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    router.replace(`/login?next=${next}`);
  }, [status, router]);

  if (status === 'authenticated') {
    return <>{children}</>;
  }

  return (
    <div className="flex h-svh w-full items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <span>Загрузка сессии…</span>
      </div>
    </div>
  );
}
